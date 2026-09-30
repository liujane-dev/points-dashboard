import { spawn } from 'node:child_process'

const debugMode = process.argv.includes('--debug')
const env = {
  ...process.env,
  ...(debugMode ? { POINTS_DEBUG: '1' } : {}),
}

const children = [
  spawn('node', ['scripts/points-api.mjs'], { env, stdio: 'inherit' }),
  spawn('vite', [], { env, stdio: 'inherit', shell: true }),
]

function shutdown(signal) {
  for (const child of children) {
    child.kill(signal)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown('SIGTERM')
      process.exit(code)
    }
  })
}
