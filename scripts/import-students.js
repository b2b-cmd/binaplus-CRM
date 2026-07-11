/**
 * Import students from the Monday CSV export into people (+ orders).
 * Matches existing people by phone/email (the cross-match feature). All product = מפתחי AI.
 * Usage: node scripts/import-students.js
 */
import 'dotenv/config'
import fs from 'fs'

const CSV_PATH = 'C:/Users/sahar/Downloads/שתפ Vitrue & Flow - לקוחות.csv'
const U = process.env.VITE_SUPABASE_URL, S = process.env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' }
const rest = async (m, p, b, prefer) => {
  const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: { ...h, Prefer: prefer || 'return=representation' }, body: b ? JSON.stringify(b) : undefined })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  if (!r.ok) throw new Error(`${m} ${p} ${r.status}: ${JSON.stringify(j).slice(0, 200)}`)
  return j
}

// ---- CSV parser (handles quotes, "" escapes, embedded newlines/commas) ----
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

const digits = s => (s || '').replace(/\D/g, '')
function normPhone(s) {
  let d = digits(s)
  if (d.startsWith('972')) d = '0' + d.slice(3)
  if (d.length === 9 && d[0] === '5') d = '0' + d
  return d.length >= 9 && d.length <= 10 ? d : null
}
const normEmail = s => { const m = (s || '').trim().toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i); return m ? m[0] : null }
const num = s => { const n = parseFloat((s || '').replace(/[^\d.]/g, '')); return isNaN(n) ? null : n }
const bool = s => /true|כן/i.test(s || '')
function toISO(s) { const m = (s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null }

// cohort text → normalized cycle name
function cohortName(raw) {
  const s = (raw || '').trim()
  if (!s || /מיכאל לא שלח/.test(s)) return null
  if (/דיגיטלי/.test(s)) return 'דיגיטלי'
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  const months = { '02': 'פברואר', '04': 'אפריל', '06': 'יוני', '08': 'אוגוסט', '09': 'ספטמבר', '10': 'אוקטובר' }
  if (m) { const mm = m[2].padStart(2, '0'); return `${months[mm] || mm} ${m[3]}` }
  if (/אוקטובר/.test(s)) return 'אוקטובר 2026'
  if (/ספטמבר/.test(s)) return 'ספטמבר 2026'
  if (/אוגוסט/.test(s)) return 'אוגוסט 2026'
  return null
}

// ---- main ----
const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8')).filter(r => r.some(c => c && c.trim()))
const header = rows.shift()
const idx = { date: 0, product: 1, status: 2, name: 3, cohort: 4, phone: 5, email: 6, mgr: 7, access: 8, deal: 9, deposit: 10, remaining: 11, agreement: 12, notes: 13, group: 14, crm: 15, collect: 16 }

// products + cycles maps
const products = await rest('GET', 'products?select=id,name')
const prodDev = products.find(p => p.name === 'מפתחי AI לייב') || products.find(p => /מפתחי AI$/.test(p.name)) || products[0]
const prodDigital = products.find(p => /דיגיטלי/.test(p.name)) || prodDev
let cycles = await rest('GET', `cycles?select=id,name,product_id`)
async function cycleId(name, productId) {
  if (!name) return null
  let c = cycles.find(x => x.name === name && x.product_id === productId)
  if (!c) { c = (await rest('POST', 'cycles', { name, product_id: productId }))[0]; cycles.push(c) }
  return c.id
}

const people = await rest('GET', 'people?select=id,phone,email')
const byPhone = new Map(people.filter(p => p.phone).map(p => [normPhone(p.phone), p.id]))
const byEmail = new Map(people.filter(p => p.email).map(p => [normEmail(p.email), p.id]))

let created = 0, updated = 0, orders = 0
for (const r of rows) {
  const name = (r[idx.name] || '').trim()
  if (!name || /מיכאל לא שלח/.test(name)) continue
  const phone = normPhone(r[idx.phone]), email = normEmail(r[idx.email])
  if (!phone && !email) continue
  const isDigital = /דיגיטלי/.test(r[idx.product] || '')
  const productId = isDigital ? prodDigital.id : prodDev.id
  const cyId = await cycleId(cohortName(r[idx.cohort]), productId)
  const sales_status = /בוטל/.test(r[idx.status]) ? 'cancelled' : 'active_student'

  const personFields = {
    full_name: name, phone, email, source: 'Monday',
    sales_status, product_id: productId, cycle_id: cyId,
    entry_date: toISO(r[idx.date]), received_access: bool(r[idx.access]),
    added_to_group: bool(r[idx.group]), manager_call: bool(r[idx.mgr]),
    agreement_status: (r[idx.agreement] || '').trim() || null,
    in_crm: bool(r[idx.crm]), notes: (r[idx.notes] || '').trim() || null,
  }
  const existId = (phone && byPhone.get(phone)) || (email && byEmail.get(email))
  let personId
  if (existId) { await rest('PATCH', `people?id=eq.${existId}`, personFields); personId = existId; updated++ }
  else { personId = (await rest('POST', 'people', personFields))[0].id; created++; if (phone) byPhone.set(phone, personId); if (email) byEmail.set(email, personId) }

  const deal = num(r[idx.deal]), deposit = num(r[idx.deposit]), remaining = num(r[idx.remaining])
  if (deal) {
    const status = sales_status === 'cancelled' ? 'cancelled' : (remaining === 0 || (!remaining && !deposit)) ? 'paid_full' : deposit ? 'deposit' : 'awaiting'
    await rest('POST', 'orders', {
      person_id: personId, product_id: productId, cycle_id: cyId, close_date: toISO(r[idx.date]),
      deal_amount: deal, deposit, remaining, status, agreement_status: (r[idx.agreement] || '').trim() || null,
      collection_notes: (r[idx.collect] || '').trim() || null,
    })
    orders++
  }
}
console.log(`✓ Import done. created ${created}, updated ${updated} people; ${orders} orders. cycles now: ${cycles.length}`)
