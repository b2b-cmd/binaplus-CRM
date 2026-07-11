/**
 * Create the first system-admin: an auth user + a public.users row.
 * Usage: node scripts/seed-admin.js <email> <password> "<full name>"
 */
import 'dotenv/config'

const URL = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE) throw new Error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')

const email = process.argv[2] || 'b2b@vitrue.co.il'
const password = process.argv[3] || 'Bina1212!'
const fullName = process.argv[4] || 'מנהל מערכת'

const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

// 1) create (or find) the auth user
async function ensureAuthUser() {
  let res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  let body = await res.json()
  if (res.ok) { console.log('✓ auth user created'); return body.id }
  if (res.status === 422 || JSON.stringify(body).includes('already')) {
    // already exists → find id
    const list = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: h }).then(r => r.json())
    const u = (list.users || []).find(x => x.email?.toLowerCase() === email.toLowerCase())
    if (u) { console.log('• auth user existed'); return u.id }
  }
  throw new Error('auth create failed: ' + JSON.stringify(body))
}

// 2) upsert public.users row
async function upsertRep(authId) {
  const res = await fetch(`${URL}/rest/v1/users?on_conflict=email`, {
    method: 'POST',
    headers: { ...h, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      auth_id: authId, full_name: fullName, email,
      permission_level: 'system_admin', user_type: 'general_manager', active: true,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error('users upsert failed: ' + JSON.stringify(body))
  console.log('✓ public.users row ready:', body[0]?.id)
}

const id = await ensureAuthUser()
await upsertRep(id)
console.log(`\nLogin → ${email} / ${password}`)
