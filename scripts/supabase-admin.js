/**
 * Supabase Management API helper for bina-crm.
 *   node scripts/supabase-admin.js list                 → orgs + projects
 *   node scripts/supabase-admin.js create <org_id> <region> <db_pass>
 *   node scripts/supabase-admin.js keys <project_ref>
 *   node scripts/supabase-admin.js status <project_ref>
 *
 * Token resolution order: bina-crm/.env → repo-root .env (SUPABASE_ACCESS_TOKEN).
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'

function token() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN
  const root = path.resolve('..', '.env')
  try {
    const m = fs.readFileSync(root, 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)
    if (m) return m[1].trim()
  } catch {}
  throw new Error('SUPABASE_ACCESS_TOKEN not found (bina-crm/.env or repo-root .env)')
}
const PAT = token()

async function api(method, pathname, body) {
  const res = await fetch(`https://api.supabase.com${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json; try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, json }
}

const cmd = process.argv[2]

if (cmd === 'list') {
  const orgs = await api('GET', '/v1/organizations')
  console.log('ORGS:', JSON.stringify(orgs.json, null, 2))
  const projects = await api('GET', '/v1/projects')
  const slim = Array.isArray(projects.json)
    ? projects.json.map(p => ({ name: p.name, ref: p.id, org: p.organization_id, region: p.region, status: p.status }))
    : projects.json
  console.log('PROJECTS:', JSON.stringify(slim, null, 2))
} else if (cmd === 'create') {
  const [, , , org, region, dbpass] = process.argv
  if (!org || !region || !dbpass) { console.error('usage: create <org_id> <region> <db_pass>'); process.exit(1) }
  const r = await api('POST', '/v1/projects', {
    name: 'bina-crm',
    organization_id: org,
    region,
    db_pass: dbpass,
  })
  console.log(r.status, JSON.stringify(r.json, null, 2))
} else if (cmd === 'keys') {
  const ref = process.argv[3]
  const r = await api('GET', `/v1/projects/${ref}/api-keys`)
  console.log(r.status, JSON.stringify(r.json, null, 2))
} else if (cmd === 'status') {
  const ref = process.argv[3]
  const r = await api('GET', `/v1/projects/${ref}`)
  console.log(r.status, JSON.stringify(r.json, null, 2))
} else {
  console.log('commands: list | create <org> <region> <db_pass> | keys <ref> | status <ref>')
}
