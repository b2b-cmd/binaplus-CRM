/**
 * Sync products + modules + lessons from the live syllabi (scratchpad/syllabus-data.json).
 * - Renames products to match syllabus titles.
 * - Updates the 11 existing מפתחי-AI modules IN PLACE (preserves ticket FKs), links them
 *   to BOTH הכשרת מפתחי AI and the digital product (same curriculum).
 * - Creates the 7 מובילי-AI modules.
 * - Seeds all lessons per module (skips modules that already have lessons).
 */
import 'dotenv/config'
import fs from 'fs'

const DATA = JSON.parse(fs.readFileSync('C:/Users/sahar/AppData/Local/Temp/claude/C--Users-sahar-Claude-Code/e7104040-cae7-4464-b4aa-0df4ef5f447d/scratchpad/syllabus-data.json', 'utf8'))
const U = process.env.VITE_SUPABASE_URL, S = process.env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' }
const rest = async (m, p, b, prefer = 'return=representation') => {
  const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: { ...h, Prefer: prefer }, body: b ? JSON.stringify(b) : undefined })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  if (!r.ok) throw new Error(`${m} ${p} ${r.status}: ${JSON.stringify(j).slice(0, 200)}`)
  return j
}
const contentsOf = m => [m.sub, m.skills?.length ? 'מיומנויות: ' + m.skills.join(', ') : '', m.tools?.length ? 'כלים: ' + m.tools.join(', ') : ''].filter(Boolean).join('\n')

// ---- 1. products ----
const products = await rest('GET', 'products?select=id,name')
const renames = [
  [/מפתחי AI לייב|^מפתחי AI$/, 'הכשרת מפתחי AI'],
  [/מובילי AI/, 'הכשרת מובילי AI'],
  [/דיגיטלית/, 'הכשרה דיגיטלית - מפתחי AI'],
]
for (const p of products) {
  const r = renames.find(([re]) => re.test(p.name))
  if (r && p.name !== r[1]) { await rest('PATCH', `products?id=eq.${p.id}`, { name: r[1] }); console.log(`product: "${p.name}" → "${r[1]}"`) }
}
const prods = await rest('GET', 'products?select=id,name')
const pDev = prods.find(p => p.name === 'הכשרת מפתחי AI')
const pLead = prods.find(p => p.name === 'הכשרת מובילי AI')
const pDig = prods.find(p => p.name === 'הכשרה דיגיטלית - מפתחי AI')

// ---- 2. מפתחי AI modules: update existing in place by position ----
const existing = (await rest('GET', 'modules?select=id,number,name&order=number')).filter(m => m.number != null)
const dev = DATA['syllabus']
const devModuleIds = []
for (let i = 0; i < dev.length; i++) {
  const m = dev[i]
  const patch = { number: m.num, name: m.title, title: m.sub || null, contents: contentsOf(m) }
  let id
  if (existing[i]) { id = existing[i].id; await rest('PATCH', `modules?id=eq.${id}`, patch) }
  else { id = (await rest('POST', 'modules', { ...patch, product_id: pDev.id }))[0].id }
  devModuleIds.push({ id, lessons: m.lessons })
  // M2M: link to both dev + digital
  for (const pid of [pDev?.id, pDig?.id].filter(Boolean)) {
    await rest('POST', 'module_products', { module_id: id, product_id: pid }, 'resolution=ignore-duplicates')
  }
}
console.log(`מפתחי AI: ${devModuleIds.length} modules updated/linked (dev+digital)`)

// ---- 3. מובילי AI modules: create ----
const lead = DATA['syllabus-ai']
const leadModuleIds = []
const allNames = new Set((await rest('GET', 'modules?select=name')).map(x => x.name))
for (const m of lead) {
  const name = allNames.has(m.title) && m.title === 'Claude Code' ? 'Claude Code (מובילי AI)' : m.title
  let row = (await rest('GET', `modules?select=id&name=eq.${encodeURIComponent(name)}`))[0]
  if (!row) row = (await rest('POST', 'modules', { number: m.num, name, title: m.sub || null, contents: contentsOf(m), product_id: pLead.id }))[0]
  leadModuleIds.push({ id: row.id, lessons: m.lessons })
  await rest('POST', 'module_products', { module_id: row.id, product_id: pLead.id }, 'resolution=ignore-duplicates')
}
console.log(`מובילי AI: ${leadModuleIds.length} modules created/linked`)

// ---- 4. lessons ----
let created = 0, skipped = 0
for (const { id, lessons } of [...devModuleIds, ...leadModuleIds]) {
  const have = await rest('GET', `lessons?select=id&module_id=eq.${id}&limit=1`)
  if (have.length) { skipped++; continue }
  const rows = lessons.map((l, i) => ({ module_id: id, position: i + 1, name: l.name, description: l.desc || null }))
  if (rows.length) { await rest('POST', 'lessons', rows); created += rows.length }
}
console.log(`lessons: created ${created} (skipped ${skipped} modules that already had lessons)`)
console.log('✓ syllabus sync complete')
