/**
 * Remove system/notification/ad email tickets (keep real people).
 * Deletes matching email tickets (messages cascade) + their orphaned people.
 */
import 'dotenv/config'

const U = process.env.VITE_SUPABASE_URL, S = process.env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' }
const SYSTEM = /noreply|no-reply|notification|updates\.|invites@|notify-|@make\.com|mentions@|daily@|@example\.com/i

const rest = async (m, p, b) => {
  const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: { ...h, Prefer: 'return=representation' }, body: b ? JSON.stringify(b) : undefined })
  const t = await r.text(); try { return JSON.parse(t) } catch { return t }
}

const tickets = await rest('GET', 'tickets?select=id,person_id,summary,person:people(email)&channel=eq.email')
const del = tickets.filter(t => SYSTEM.test(t.person?.email || ''))
const keep = tickets.filter(t => !SYSTEM.test(t.person?.email || ''))

console.log(`\nDELETING ${del.length} system tickets:`)
del.forEach(t => console.log('  ✗', t.person?.email, '|', (t.summary || '').slice(0, 40)))
console.log(`\nKEEPING ${keep.length} real tickets:`)
keep.forEach(t => console.log('  ✓', t.person?.email, '|', (t.summary || '').slice(0, 40)))

for (const t of del) {
  await rest('DELETE', `tickets?id=eq.${t.id}`)                 // ticket_messages cascade
  // delete the person if they have no remaining tickets
  const remaining = await rest('GET', `tickets?select=id&person_id=eq.${t.person_id}`)
  if (Array.isArray(remaining) && remaining.length === 0) await rest('DELETE', `people?id=eq.${t.person_id}`)
}
console.log(`\n✓ Done. Removed ${del.length}, kept ${keep.length}.`)
