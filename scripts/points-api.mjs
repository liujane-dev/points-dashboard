import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const dataDir = path.join(repoRoot, 'data')
const jsonDataFile = path.join(dataDir, 'points.json')
const sqliteDataFile = path.join(dataDir, 'points.sqlite')
const port = Number(process.env.POINTS_API_PORT ?? 5174)
const debugMode = process.env.POINTS_DEBUG === '1' || process.argv.includes('--debug')

mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(sqliteDataFile)

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      points INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS records_created_at_idx ON records (created_at DESC);
    CREATE INDEX IF NOT EXISTS records_deleted_at_idx ON records (deleted_at);
    CREATE INDEX IF NOT EXISTS records_category_idx ON records (category);

    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cost INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS rewards_created_at_idx ON rewards (created_at DESC);
    CREATE INDEX IF NOT EXISTS rewards_deleted_at_idx ON rewards (deleted_at);

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      points INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );
  `)

  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM records) +
      (SELECT COUNT(*) FROM rewards) +
      (SELECT COUNT(*) FROM rules) AS total
  `).get()

  if (Number(row?.total ?? 0) === 0 && existsSync(jsonDataFile)) {
    importJsonData()
  }

  db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)').run('version', '1')
}

function importJsonData() {
  const data = JSON.parse(readFileSync(jsonDataFile, 'utf8'))
  const insertRecord = db.prepare(`
    INSERT OR IGNORE INTO records (id, kind, category, title, points, note, created_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertReward = db.prepare(`
    INSERT OR IGNORE INTO rewards (id, name, cost, note, created_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertRule = db.prepare(`
    INSERT OR IGNORE INTO rules (id, kind, category, title, points, enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN')
  try {
    for (const record of Array.isArray(data.records) ? data.records : []) {
      insertRecord.run(
        ensureText(record.id, randomUUID()),
        ensureRecordKind(record.kind),
        ensureCategory(record.category),
        ensureText(record.title, '未命名记录'),
        ensurePositiveNumber(record.points),
        ensureText(record.note, ''),
        ensureText(record.createdAt, new Date().toISOString()),
        record.deletedAt || null,
      )
    }

    for (const reward of Array.isArray(data.rewards) ? data.rewards : []) {
      insertReward.run(
        ensureText(reward.id, randomUUID()),
        ensureText(reward.name, '未命名奖励'),
        ensurePositiveNumber(reward.cost),
        ensureText(reward.note, ''),
        ensureText(reward.createdAt, new Date().toISOString()),
        reward.deletedAt || null,
      )
    }

    for (const rule of Array.isArray(data.rules) ? data.rules : []) {
      insertRule.run(
        ensureText(rule.id, randomUUID()),
        ensureRecordKind(rule.kind),
        ensureCategory(rule.category),
        ensureText(rule.title, '未命名规则'),
        ensurePositiveNumber(rule.points),
        rule.enabled === false ? 0 : 1,
      )
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function readData() {
  const versionRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('version')

  return {
    version: Number(versionRow?.value ?? 1),
    debug: {
      enabled: debugMode,
    },
    records: db.prepare(`
      SELECT
        id,
        kind,
        category,
        title,
        points,
        note,
        created_at AS createdAt,
        deleted_at AS deletedAt
      FROM records
      ORDER BY created_at DESC
    `).all(),
    rewards: db.prepare(`
      SELECT
        id,
        name,
        cost,
        note,
        created_at AS createdAt,
        deleted_at AS deletedAt
      FROM rewards
      ORDER BY created_at DESC
    `).all(),
    rules: db.prepare(`
      SELECT
        id,
        kind,
        category,
        title,
        points,
        enabled
      FROM rules
      ORDER BY id ASC
    `).all().map((rule) => ({ ...rule, enabled: Boolean(rule.enabled) })),
  }
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
      send(response, 200, readData())
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/records') {
      const body = await readBody(request)
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
      db.prepare(`
        INSERT INTO records (id, kind, category, title, points, note, created_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id,
        record.kind,
        record.category,
        record.title,
        record.points,
        record.note,
        record.createdAt,
        record.deletedAt,
      )
      send(response, 201, record)
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/records/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/records/', ''))
      if (url.searchParams.get('hard') === '1') {
        if (!debugMode) {
          send(response, 403, { error: 'Hard delete is only available in debug mode' })
          return
        }

        const result = db.prepare('DELETE FROM records WHERE id = ? AND deleted_at IS NOT NULL').run(id)
        if (result.changes === 0) {
          send(response, 409, { error: 'Only deleted records can be hard deleted' })
          return
        }

        send(response, 200, { ok: true })
        return
      }

      db.prepare('UPDATE records SET deleted_at = COALESCE(deleted_at, ?) WHERE id = ?').run(new Date().toISOString(), id)
      send(response, 200, { ok: true })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/rewards') {
      const body = await readBody(request)
      const reward = {
        id: randomUUID(),
        name: ensureText(body.name, '未命名奖励'),
        cost: ensurePositiveNumber(body.cost),
        note: ensureText(body.note, ''),
        createdAt: new Date().toISOString(),
        deletedAt: null,
      }
      db.prepare(`
        INSERT INTO rewards (id, name, cost, note, created_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        reward.id,
        reward.name,
        reward.cost,
        reward.note,
        reward.createdAt,
        reward.deletedAt,
      )
      send(response, 201, reward)
      return
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/rewards/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/rewards/', ''))
      if (url.searchParams.get('hard') === '1') {
        if (!debugMode) {
          send(response, 403, { error: 'Hard delete is only available in debug mode' })
          return
        }

        const result = db.prepare('DELETE FROM rewards WHERE id = ? AND deleted_at IS NOT NULL').run(id)
        if (result.changes === 0) {
          send(response, 409, { error: 'Only deleted rewards can be hard deleted' })
          return
        }

        send(response, 200, { ok: true })
        return
      }

      db.prepare('UPDATE rewards SET deleted_at = COALESCE(deleted_at, ?) WHERE id = ?').run(new Date().toISOString(), id)
      send(response, 200, { ok: true })
      return
    }

    send(response, 404, { error: 'Not found' })
  } catch (error) {
    send(response, 500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
}

initializeDatabase()

const server = createServer(handleRequest).listen(port, () => {
  console.log(`Points API listening on http://localhost:${port}`)
  console.log(`SQLite data file: ${sqliteDataFile}`)
  console.log(`Debug mode: ${debugMode ? 'on' : 'off'}`)
})

function closeDatabase() {
  server.close()
  db.close()
}

process.once('SIGINT', closeDatabase)
process.once('SIGTERM', closeDatabase)
