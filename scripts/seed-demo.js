/**
 * Seed reference + demo data (service role bypasses RLS).
 * Idempotent-ish: clears demo tables first. Usage: node scripts/seed-demo.js
 */
import 'dotenv/config'

const URL = process.env.VITE_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }

async function rest(method, path, body) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text(); let j; try { j = JSON.parse(text) } catch { j = text }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(j).slice(0, 300)}`)
  return j
}
const del = (path) => rest('DELETE', path)
// PostgREST bulk insert requires every row to share the same keys — fill the union with null.
function uniform(rows) {
  const keys = [...new Set(rows.flatMap(Object.keys))]
  return rows.map(r => Object.fromEntries(keys.map(k => [k, k in r ? r[k] : null])))
}
const ins = (table, rows) => rest('POST', table, uniform(rows))

// admin rep id (from seed-admin)
const adminRep = (await rest('GET', 'users?select=id&email=eq.b2b@vitrue.co.il'))[0]?.id

// wipe demo (order matters for FKs)
for (const t of ['ticket_messages', 'tickets', 'knowledge_base', 'cycles', 'modules', 'people', 'products']) {
  await del(`${t}?id=neq.00000000-0000-0000-0000-000000000000`)
}

// products
const products = await ins('products', [
  { name: 'מפתחי AI לייב', type: 'לייב + דיגיטלי', syllabus_url: 'https://bina-plus.co.il/syllabus/' },
  { name: 'מובילי AI', type: 'לייב + דיגיטלי', syllabus_url: 'https://bina-plus.co.il/syllabus-ai/' },
  { name: 'הכשרה דיגיטלית מפתחי AI', type: 'דיגיטלי', syllabus_url: 'https://bina-plus.co.il/syllabus-digital/' },
])
const P = Object.fromEntries(products.map(p => [p.name, p.id]))

// modules for מפתחי AI לייב (11) — editable later in settings
const modNames = ['מבוא לעולם ה-AI', 'הנדסת פרומפטים', 'אוטומציות (Make / n8n)', 'סוכני AI וצ׳אטבוטים',
  'חיבור סוכנים לעולם החיצון (API)', 'אבחון ואיפיון פתרונות', 'בניית אפליקציות AI', 'RAG ומאגרי ידע',
  'קול ומולטימודליות', 'פריסה ותפעול', 'פרויקט גמר']
const modules = await ins('modules', modNames.map((name, i) => ({ product_id: P['מפתחי AI לייב'], number: i + 1, name })))
const M = Object.fromEntries(modules.map(m => [m.number, m.id]))

// cycles (from the new-student form COHORTS)
const cycles = await ins('cycles', [
  { product_id: P['מפתחי AI לייב'], name: 'אוגוסט 2026 - ערב', lecturer_name: 'אליאל טרבלסי', start_date: '2026-08-03', seats_total: 25 },
  { product_id: P['מפתחי AI לייב'], name: 'ספטמבר 2026 - ערב', lecturer_name: 'אליאל טרבלסי', start_date: '2026-09-07', seats_total: 25 },
  { product_id: P['מובילי AI'], name: 'ספטמבר 2026 - ערב', lecturer_name: 'מור ניסים', start_date: '2026-09-07', seats_total: 20 },
])
const C = Object.fromEntries(cycles.map(c => [c.name + '|' + c.product_id, c.id]))
const cycAug = cycles[0].id, cycSep = cycles[1].id

// people (students)
const people = await ins('people', [
  { full_name: 'דנה כהן', phone: '0525551234', email: 'dana@example.com', source: 'וובינר', sales_status: 'active_student' },
  { full_name: 'יוסי לוי', phone: '0546667788', email: 'yossi@example.com', source: 'וואטסאפ', sales_status: 'active_student' },
  { full_name: 'מאיה בר', phone: '0501112233', email: 'maya@example.com', source: 'המלצה', sales_status: 'paid_deposit' },
  { full_name: 'אבי שלום', phone: '0587778899', email: 'avi@example.com', source: 'פייסבוק', sales_status: 'active_student' },
])
const PE = Object.fromEntries(people.map(p => [p.full_name, p.id]))

// tickets
const now = Date.now()
const iso = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString()
const tickets = await ins('tickets', [
  { person_id: PE['דנה כהן'], type: 'גישה לפורטל / הקלטות', module_id: M[4], cycle_id: cycAug, summary: 'לא מצליחה להיכנס לפורטל ההקלטות', channel: 'whatsapp', status: 'new', urgency: 'high', assigned_rep: adminRep, created_at: iso(0) },
  { person_id: PE['יוסי לוי'], type: 'שאלה מקצועית / תוכן', module_id: M[5], cycle_id: cycAug, summary: 'שאלה על חיבור API בסוכן', channel: 'email', status: 'in_progress', urgency: 'med', assigned_rep: adminRep, handled_by: 'human', created_at: iso(1) },
  { person_id: PE['מאיה בר'], type: 'הרשמה ותשלום', cycle_id: cycSep, summary: 'מתי מתחיל מחזור ספטמבר?', channel: 'whatsapp', status: 'closed', urgency: 'low', handled_by: 'ai', resolved_at: iso(2), created_at: iso(3) },
  { person_id: PE['אבי שלום'], type: 'תמיכה טכנית', module_id: M[3], cycle_id: cycAug, summary: 'שגיאה בהתקנת n8n', channel: 'whatsapp', status: 'waiting', urgency: 'med', assigned_rep: adminRep, created_at: iso(1) },
  { person_id: PE['דנה כהן'], type: 'לוח זמנים ומחזור', cycle_id: cycAug, summary: 'בקשה לדחות מפגש', channel: 'phone', status: 'closed', urgency: 'low', handled_by: 'human', resolved_at: iso(5), created_at: iso(6) },
])
const T = tickets.map(t => t.id)

// thread messages for the first ticket
await ins('ticket_messages', [
  { ticket_id: T[0], direction: 'in', channel: 'whatsapp', sender: 'דנה כהן', body: 'היי, אני לא מצליחה להיכנס לפורטל ההקלטות, כותב לי שאין הרשאה 🙁', ai_generated: false, created_at: iso(0) },
  { ticket_id: T[1], direction: 'in', channel: 'email', sender: 'יוסי לוי', body: 'שלום, בתרגיל של חיבור API אני מקבל שגיאת 401. מה כדאי לבדוק?', ai_generated: false, created_at: iso(1) },
  { ticket_id: T[1], direction: 'out', channel: 'email', sender: 'צוות בינה+', body: 'היי יוסי, נבדוק מיד. בדוק שה-Authorization header מכיל Bearer <token> תקין.', ai_generated: false, created_at: iso(1) },
])

console.log(`✓ seeded: ${products.length} products, ${modules.length} modules, ${cycles.length} cycles, ${people.length} people, ${tickets.length} tickets`)
