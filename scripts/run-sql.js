/**
 * Apply a SQL file to the bina-crm Supabase project via the Management API.
 * Usage: node scripts/run-sql.js [file]   (default: schema.sql)
 */
import 'dotenv/config'
import fs from 'fs'

const PAT = process.env.SUPABASE_ACCESS_TOKEN
const REF = process.env.SUPABASE_PROJECT_REF
if (!PAT || !REF) throw new Error('SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF missing in .env')

const file = process.argv[2] || 'schema.sql'
const sql = fs.readFileSync(file, 'utf8')

async function run(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  let body; try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}

const r = await run(sql)
if (r.status === 201) {
  console.log(`✓ Applied ${file} (${sql.length} bytes)`)
} else {
  console.error(`✗ HTTP ${r.status}:`, JSON.stringify(r.body).slice(0, 800))
  process.exit(1)
}
