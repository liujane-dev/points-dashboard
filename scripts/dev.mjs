import { spawn } from 'node:child_process'

const children = [
  spawn('node', ['scripts/points-api.mjs'], { stdio: 'inherit' }),
  spawn('vite', [], { stdio: 'inherit', shell: true }),
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
