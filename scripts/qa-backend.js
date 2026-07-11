/** Backend QA: finance, public-api (scopes+log), RLS enforcement. Cleans up test data. */
import 'dotenv/config'
import { computeFinancing, financingPct } from '../src/lib/finance.js'

const U = process.env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const FB = U.replace('.supabase.co', '.functions.supabase.co')
const svc = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }
const results = []
const chk = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? '✓' : '✗ FAIL'}  ${name}${detail ? ' — ' + detail : ''}`) }
const rest = (m, p, b, h = svc) => fetch(`${U}/rest/v1/${p}`, { method: m, headers: { ...h, Prefer: 'return=representation' }, body: b ? JSON.stringify(b) : undefined })

// ---- 1. FINANCE ----
console.log('\n== FINANCE ==')
chk('ERN 12mo = 9%', financingPct('ERN', 12) === 9, `${financingPct('ERN', 12)}`)
chk('ERN 8mo = 6%', financingPct('ERN', 8) === 6, `${financingPct('ERN', 8)}`)
chk('פיימנט 12mo = 9%', financingPct('פיימנט', 12) === 9)
chk('אשראי 6mo = 3%', financingPct('אשראי', 6) === 3, `${financingPct('אשראי', 6)}`)
chk('אשראי 12mo = 6%', financingPct('אשראי', 12) === 6, `${financingPct('אשראי', 12)}`)
chk('העברה = 0%', financingPct('העברה בנקאית', 12) === 0)
const c = computeFinancing({ amountInclVat: 8700, paymentType: 'אשראי', numPayments: 12 })
chk('compute 8700/credit/12 afterIncl=9222', c.afterInclVat === 9222, `${c.afterInclVat}`)
chk('compute perPayment=768.5', c.perPayment === 768.5, `${c.perPayment}`)
const c0 = computeFinancing({ amountInclVat: 0, paymentType: 'אשראי', numPayments: 1 })
chk('edge amount=0 → 0', c0.afterInclVat === 0)

// ---- 2. PUBLIC-API ----
console.log('\n== PUBLIC-API ==')
async function apiTests() {
  // key with read-only leads
  const kRead = 'sk_qa_r_' + Math.random().toString(36).slice(2, 9)
  await rest('POST', 'api_keys', { name: 'qa-read', key: kRead, scopes: { leads: { read: true, write: false }, tickets: { read: false, write: false } } })
  // key with full leads+tickets
  const kFull = 'sk_qa_f_' + Math.random().toString(36).slice(2, 9)
  await rest('POST', 'api_keys', { name: 'qa-full', key: kFull, scopes: { leads: { read: true, write: true }, tickets: { read: true, write: true } } })

  let r = await fetch(`${FB}/public-api?resource=leads`, { headers: { 'x-api-key': kRead } })
  chk('GET leads (read scope) 200', r.status === 200)
  r = await fetch(`${FB}/public-api?resource=leads`, { method: 'POST', headers: { 'x-api-key': kRead, 'Content-Type': 'application/json' }, body: '{"full_name":"x"}' })
  let j = await r.json()
  chk('POST leads no-write → 403+remediation', r.status === 403 && !!j.remediation, `${r.status}`)
  r = await fetch(`${FB}/public-api?resource=tickets`, { headers: { 'x-api-key': kRead } })
  chk('GET tickets no-read → 403', r.status === 403)
  r = await fetch(`${FB}/public-api`, { headers: { 'x-api-key': kRead } })
  chk('missing resource → 400', r.status === 400)
  r = await fetch(`${FB}/public-api?resource=leads`, { headers: { 'x-api-key': 'bogus' } })
  chk('bad key → 401', r.status === 401)
  // create + patch a lead with full key
  r = await fetch(`${FB}/public-api?resource=leads`, { method: 'POST', headers: { 'x-api-key': kFull, 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: 'QA API Lead', source: 'qa' }) })
  j = await r.json(); const newId = j.data?.id
  chk('POST leads (write) creates', r.status === 200 && !!newId)
  if (newId) {
    r = await fetch(`${FB}/public-api?resource=leads&id=${newId}`, { method: 'PATCH', headers: { 'x-api-key': kFull, 'Content-Type': 'application/json' }, body: '{"source":"qa2"}' })
    j = await r.json(); chk('PATCH leads updates', r.status === 200 && j.data?.source === 'qa2')
    await rest('DELETE', `people?id=eq.${newId}`)
  }
  // log written?
  const logs = await rest('GET', 'api_logs?select=id&order=created_at.desc&limit=5').then(r => r.json())
  chk('api_logs recording calls', Array.isArray(logs) && logs.length > 0)
  await rest('DELETE', `api_keys?key=eq.${kRead}`); await rest('DELETE', `api_keys?key=eq.${kFull}`)
}

// ---- 3. RLS (non-manager) ----
console.log('\n== RLS ==')
async function rlsTests() {
  const email = `qa-user-${Date.now()}@bina-plus.co.il`, pass = 'QaTest123!'
  // create auth user
  let res = await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: svc, body: JSON.stringify({ email, password: pass, email_confirm: true }) })
  const authId = (await res.json()).id
  // users row as non-manager
  const urow = (await rest('POST', 'users', { auth_id: authId, full_name: 'QA User', email, permission_level: 'user', user_type: 'service', active: true }).then(r => r.json()))[0]
  // admin rep id
  const admin = (await rest('GET', 'users?select=id&email=eq.b2b@vitrue.co.il').then(r => r.json()))[0]
  // create a ticket assigned to ADMIN (not test user) + one unassigned
  const tAdmin = (await rest('POST', 'tickets', { summary: 'QA-admin-only', status: 'new', assigned_rep: admin.id }).then(r => r.json()))[0]
  const tNull = (await rest('POST', 'tickets', { summary: 'QA-unassigned', status: 'new', assigned_rep: null }).then(r => r.json()))[0]
  // sign in as test user
  const tok = await fetch(`${U}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) }).then(r => r.json())
  const uh = { apikey: ANON, Authorization: `Bearer ${tok.access_token}` }
  const seen = await fetch(`${U}/rest/v1/tickets?select=id,summary,assigned_rep`, { headers: uh }).then(r => r.json())
  const ids = new Set((seen || []).map(t => t.id))
  chk('non-manager does NOT see other-rep ticket', !ids.has(tAdmin.id), `saw ${seen.length} tickets`)
  chk('non-manager DOES see unassigned ticket', ids.has(tNull.id))
  // non-manager cannot write to users table (manager-only)
  const wr = await fetch(`${U}/rest/v1/users?id=eq.${admin.id}`, { method: 'PATCH', headers: { ...uh, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: '{"full_name":"HACKED"}' }).then(r => r.json())
  chk('non-manager cannot edit users (RLS)', !(Array.isArray(wr) && wr.length && wr[0].full_name === 'HACKED'))
  // cleanup
  await rest('DELETE', `tickets?id=eq.${tAdmin.id}`); await rest('DELETE', `tickets?id=eq.${tNull.id}`)
  await rest('DELETE', `users?id=eq.${urow.id}`)
  await fetch(`${U}/auth/v1/admin/users/${authId}`, { method: 'DELETE', headers: svc })
}

await apiTests()
await rlsTests()
const failed = results.filter(r => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`)
if (failed.length) { console.log('FAILURES:', failed.map(f => f.name).join(' | ')); process.exit(1) }
