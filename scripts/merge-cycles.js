/** Merge duplicate cycles + clean names. Idempotent-ish (matches by name+product). */
import 'dotenv/config'
const U = process.env.VITE_SUPABASE_URL, S = process.env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' }
const rest = async (m, p, b, prefer) => {
  const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: { ...h, Prefer: prefer || 'return=representation' }, body: b ? JSON.stringify(b) : undefined })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  if (!r.ok) throw new Error(`${m} ${p} ${r.status}: ${JSON.stringify(j).slice(0, 200)}`)
  return j
}
const g = p => rest('GET', p)

const products = await g('products?select=id,name')
const P = Object.fromEntries(products.map(p => [p.name, p.id]))
const dev = P['הכשרת מפתחי AI'], lead = P['הכשרת מובילי AI'], digital = P['הכשרה דיגיטלית - מפתחי AI']
const cycles = await g('cycles?select=id,name,product_id,start_date')
const find = (name, pid) => cycles.filter(c => c.name === name && c.product_id === pid)

// reassign all FKs from loser → survivor, then delete loser
async function merge(loser, survivor, patch) {
  for (const tbl of ['people', 'orders', 'tickets', 'cycle_lessons', 'cycle_modules', 'attendance']) {
    try { await rest('PATCH', `${tbl}?cycle_id=eq.${loser}`, { cycle_id: survivor }, 'return=minimal') } catch (e) { console.log(`  (${tbl} skip: ${e.message.slice(0, 80)})`) }
  }
  if (patch) await rest('PATCH', `cycles?id=eq.${survivor}`, patch, 'return=minimal')
  await rest('DELETE', `cycles?id=eq.${loser}`, null, 'return=minimal')
}
const rename = (id, name) => rest('PATCH', `cycles?id=eq.${id}`, { name }, 'return=minimal')

// 1) August (dev): survivor "אוגוסט 2026", merge "אוגוסט 2026 - ערב"
const augS = find('אוגוסט 2026', dev)[0], augL = find('אוגוסט 2026 - ערב', dev)[0]
if (augS && augL) { await merge(augL.id, augS.id, { start_date: augL.start_date }); console.log('✓ merged August (dev)') }

// 2) September (dev): survivor "ספטמבר 2026", merge "ספטמבר 2026 - ערב" (dev)
const sepS = find('ספטמבר 2026', dev)[0], sepL = find('ספטמבר 2026 - ערב', dev)[0]
if (sepS && sepL) { await merge(sepL.id, sepS.id, { start_date: sepL.start_date }); console.log('✓ merged September (dev)') }

// 3) September (lead): rename "ספטמבר 2026 - ערב" → "ספטמבר 2026"
const sepLead = find('ספטמבר 2026 - ערב', lead)[0]
if (sepLead) { await rename(sepLead.id, 'ספטמבר 2026'); console.log('✓ renamed September (lead)') }

// 4) Digital: rename "דיגיטלי" → "הכשרה דיגיטלית"
const dig = find('דיגיטלי', digital)[0] || cycles.find(c => c.name === 'דיגיטלי')
if (dig) { await rename(dig.id, 'הכשרה דיגיטלית'); if (!dig.product_id && digital) await rest('PATCH', `cycles?id=eq.${dig.id}`, { product_id: digital }, 'return=minimal'); console.log('✓ renamed Digital') }

const after = await g('cycles?select=name,product:products(name),start_date&order=name')
console.log('\nCYCLES NOW:', after.length)
after.forEach(c => console.log(` - ${c.name} · ${c.product?.name || '—'}${c.start_date ? ' · ' + c.start_date : ''}`))
