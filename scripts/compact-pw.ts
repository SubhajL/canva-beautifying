#!/usr/bin/env tsx
import * as fs from 'node:fs'

// Handle EPIPE errors on stdout
process.stdout.on('error', (err: any) => {
  if (err.code === 'EPIPE') {
    process.exit(0)
  }
})

const inFile = process.argv[2] || 'test-results/pw.json'
const outFile = process.argv[3] || 'test-results/pw.compact.json'
const maxBytes = Number(process.env.MAX_BYTES || 300_000)

try {
  const raw = fs.readFileSync(inFile, 'utf8')
  let data: any
  try {
    data = JSON.parse(raw)
  } catch (e) {
    // If it's newline-delimited JSON, keep the last one
    const lines = raw.trim().split(/\n+/)
    data = JSON.parse(lines[lines.length - 1])
  }

  // Best-effort stripping of large fields
  const strip = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    delete (obj as any).attachments
    delete (obj as any).stdout
    delete (obj as any).stderr
    if (Array.isArray(obj.results)) {
      obj.results = obj.results.map((r: any) => {
        if (Array.isArray(r.steps) && r.steps.length > 50) {
          r.steps = r.steps.slice(-50)
        }
        strip(r)
        return r
      })
    }
    for (const k of Object.keys(obj)) strip(obj[k])
  }
  strip(data)

  let out = JSON.stringify(data)
  if (Buffer.byteLength(out, 'utf8') > maxBytes) {
    // Truncate from the front by keeping tail bytes
    const buf = Buffer.from(out, 'utf8')
    out = `…[truncated ${buf.length - maxBytes} bytes]…` + buf.subarray(buf.length - maxBytes).toString('utf8')
  }

  fs.mkdirSync(require('path').dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, out)
  console.log(`Wrote compact report to ${outFile}`)
} catch (e: any) {
  // Handle EPIPE errors silently
  if (e.code === 'EPIPE') {
    // Stdout was closed, exit silently
    process.exit(0)
  }
  console.error(`Failed to compact ${inFile}:`, e?.message || e)
  // Exit gracefully instead of with error code
  process.exit(0)
}

