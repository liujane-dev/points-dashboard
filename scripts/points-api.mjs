import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const dataFile = path.join(repoRoot, 'data', 'points.json')
const port = Number(process.env.POINTS_API_PORT ?? 5174)

async function readData() {
  const raw = await readFile(dataFile, 'utf8')
  return JSON.parse(raw)
}

async function writeData(data) {
  await writeFile(dataFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function send(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

function ensureText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function ensurePositiveNumber(value, fallback = 1) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback
}

function ensureRecordKind(value) {
  return value === 'deduct' ? 'deduct' : 'earn'
}

function ensureCategory(value) {
  const allowed = new Set(['fitness', 'gaming', 'habit', 'other'])
  return allowed.has(value) ? value : 'other'
}

async function handleRequest(request, response) {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

    if (request.method === 'GET' && url.pathname === '/api/points') {
      send(response, 200, await readData())
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/records') {
      const body = await readBody(request)
      const data = await readData()
      const record = {
        id: randomUUID(),
        kind: ensureRecordKind(body.kind),
        category: ensureCategory(body.category),
        title: ensureText(body.title, '未命名记录'),
        points: ensurePositiveNumber(body.points),
        note: ensureText(body.note, ''),
        createdAt: new Date().toISOString(),
        deletedAt: null,
      }
      data.records = [record, ...(Array.isArray(data.records) ? data.records : [])]
      await writeData(data)
      send(response, 201, record)
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/records/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/records/', ''))
      const data = await readData()
      data.records = (Array.isArray(data.records) ? data.records : []).map((record) => {
        return record.id === id ? { ...record, deletedAt: record.deletedAt ?? new Date().toISOString() } : record
      })
      await writeData(data)
      send(response, 200, { ok: true })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/rewards') {
      const body = await readBody(request)
      const data = await readData()
      const reward = {
        id: randomUUID(),
        name: ensureText(body.name, '未命名奖励'),
        cost: ensurePositiveNumber(body.cost),
        note: ensureText(body.note, ''),
        createdAt: new Date().toISOString(),
        deletedAt: null,
      }
      data.rewards = [reward, ...(Array.isArray(data.rewards) ? data.rewards : [])]
      await writeData(data)
      send(response, 201, reward)
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/rewards/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/rewards/', ''))
      const data = await readData()
      data.rewards = (Array.isArray(data.rewards) ? data.rewards : []).map((reward) => {
        return reward.id === id ? { ...reward, deletedAt: reward.deletedAt ?? new Date().toISOString() } : reward
      })
      await writeData(data)
      send(response, 200, { ok: true })
      return
    }

    send(response, 404, { error: 'Not found' })
  } catch (error) {
    send(response, 500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

createServer(handleRequest).listen(port, () => {
  console.log(`Points API listening on http://localhost:${port}`)
})
