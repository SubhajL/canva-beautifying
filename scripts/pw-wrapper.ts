#!/usr/bin/env tsx
import { spawn } from 'node:child_process'

function run(cmd: string, args: string[], env = process.env): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      env,
      shell: true,
    })

    // Handle cleanup on process termination
    const cleanup = () => {
      if (!child.killed) {
        child.kill('SIGTERM')
      }
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    child.on('exit', code => {
      process.removeListener('SIGINT', cleanup)
      process.removeListener('SIGTERM', cleanup)
      resolve(code ?? 0)
    })

    child.on('error', err => {
      console.error('Process error:', err)
      resolve(1)
    })
  })
}

async function compact() {
  try {
    await run('npx', ['tsx', 'scripts/compact-pw.ts', 'test-results/pw.json', 'test-results/pw.compact.json'])
  } catch {}
}

async function main() {
  const args = process.argv.slice(2)
  const code = await run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['playwright', 'test', ...args])
  await compact()
  process.exit(code)
}

main().catch(async (e) => { console.error(e); await compact(); process.exit(1) })

