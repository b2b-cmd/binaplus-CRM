import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { computeFinancing } from '../lib/finance'
import { PAYMENT_TYPES, TRAINING_TYPES } from '../lib/constants'
import { toast } from './Toaster'
import { useAuthStore } from '../stores/authStore'
import Modal from './Modal'
import Icon from './Icon'

// In-system "הקמת תלמיד" - models the external new-student form but writes real
// linked records: people(active) → opportunity(won) → order → payment(s) + financing.
// Does NOT touch the external bina-plus.co.il/new-student form.
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n }
const trainingTypeFor = (name = '') => /מובילי/.test(name) ? 'מובילי AI' : /דיגיטל/.test(name) ? 'הכשרה דיגיטלית' : /מפתחי/.test(name) ? 'מפתחי AI' : TRAINING_TYPES[0]

export default function StudentSetupModal({ person, onClose, onDone }) {
  const rep = useAuthStore(s => s.rep)
  const [opts, setOpts] = useState({ products: [], cycles: [] })
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    product_id: person.product_id || '', cycle_id: person.cycle_id || '',
    deal_amount: '', close_date: today(), agreement: false, notes: '',
    sales_status: 'active_student',
  })
  const [pays, setPays] = useState([{ method: 'אשראי', amount: '', installments: '1', notes: '' }])

  useEffect(() => { loadOptions().then(setOpts) }, [])
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const setPay = (i, k, v) => setPays(ps => ps.map((p, j) => j === i ? { ...p, [k]: v } : p))
  const addPay = () => setPays(ps => [...ps, { method: 'אשראי', amount: '', installments: '1', notes: '' }])
  const rmPay = (i) => setPays(ps => ps.length > 1 ? ps.filter((_, j) => j !== i) : ps)

  const cyclesForProduct = useMemo(() => opts.cycles.filter(c => !f.product_id || c.product_id === f.product_id), [opts.cycles, f.product_id])
  const paidTotal = pays.reduce((s, p) => s + num(p.amount), 0)
  const deal = num(f.deal_amount)
  const remaining = Math.max(0, deal - paidTotal)

  const save = async () => {
    if (!f.product_id) { toast('בחרו מוצר/הכשרה', 'err'); return }
    setBusy(true)
    try {
      // 1) person → active + product/cycle
      await supabase.from('people').update({
        sales_status: f.sales_status, product_id: f.product_id, cycle_id: f.cycle_id || null,
        agreement_status: f.agreement ? 'חתום' : (person.agreement_status || null),
      }).eq('id', person.id)

      // 2) opportunity: reuse an open one, else create - mark won
      const prodName = opts.products.find(p => p.id === f.product_id)?.name
      let oppId
      const { data: openOpp } = await supabase.from('opportunities').select('id').eq('person_id', person.id).is('deleted_at', null).neq('status', 'lost').order('created_at', { ascending: false }).limit(1)
      if (openOpp?.[0]) { oppId = openOpp[0].id; await supabase.from('opportunities').update({ status: 'won', training_type: trainingTypeFor(prodName) }).eq('id', oppId) }
      else { const { data } = await supabase.from('opportunities').insert({ person_id: person.id, training_type: trainingTypeFor(prodName), status: 'won', owner: rep?.id }).select('id').single(); oppId = data?.id }

      // 3) order
      const status = deal <= 0 ? 'awaiting' : remaining <= 0 ? 'paid_full' : paidTotal > 0 ? 'deposit' : 'awaiting'
      const { data: order } = await supabase.from('orders').insert({
        person_id: person.id, opportunity_id: oppId, product_id: f.product_id, cycle_id: f.cycle_id || null, owner: rep?.id,
        close_date: f.close_date || null, deal_amount: deal || null, deposit: paidTotal || null, remaining,
        status, agreement_status: f.agreement ? 'חתום' : null, collection_notes: f.notes || null,
      }).select('id').single()

      // 4) payments (+ financing)
      const payRows = pays.filter(p => num(p.amount) > 0).map(p => {
        const n = Math.max(1, parseInt(p.installments) || 1)
        const fin = computeFinancing({ amountInclVat: num(p.amount), paymentType: p.method, numPayments: n })
        return {
          order_id: order?.id, person_id: person.id, opportunity_id: oppId,
          payment_type: p.method, amount_incl_vat: num(p.amount), amount_excl_vat: fin.amountExclVat,
          num_payments: n, per_payment: fin.perPayment, financing_pct: fin.pct,
          after_financing_incl: fin.afterInclVat, after_financing_excl: fin.afterExclVat,
          owner: rep?.id, notes: p.notes || null,
        }
      })
      if (payRows.length) await supabase.from('payments').insert(payRows)

      toast('התלמיד הוקם בהצלחה 🎓')
      onDone?.()
      onClose()
    } catch (e) { toast('ההקמה נכשלה', 'err') } finally { setBusy(false) }
  }

  return (
    <Modal title={`הקמת תלמיד - ${person.full_name}`} icon="user-plus" onClose={onClose} maxWidth={640}>
      <div className="muted small" style={{ marginTop: -6, marginBottom: 12 }}>
        {[person.phone, person.email].filter(Boolean).join(' · ') || 'ליד ללא פרטי קשר'}
      </div>

      <div className="field-grid">
        <div className="field"><label>הכשרה (מוצר) <span className="req">*</span></label>
          <select value={f.product_id} onChange={e => set('product_id', e.target.value)}>
            <option value="">בחרו הכשרה…</option>
            {opts.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field"><label>מחזור</label>
          <select value={f.cycle_id} onChange={e => set('cycle_id', e.target.value)}>
            <option value="">ללא מחזור</option>
            {cyclesForProduct.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field"><label>סכום עסקה (₪)</label><input type="number" dir="ltr" value={f.deal_amount} onChange={e => set('deal_amount', e.target.value)} /></div>
        <div className="field"><label>תאריך סגירה</label><input type="date" dir="ltr" value={f.close_date} onChange={e => set('close_date', e.target.value)} /></div>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={f.agreement} onChange={e => set('agreement', e.target.checked)} /><label>הסכם חתום</label>
        </div>
        <div className="field"><label>סטטוס לאחר הקמה</label>
          <select value={f.sales_status} onChange={e => set('sales_status', e.target.value)}>
            <option value="active_student">תלמיד פעיל</option>
            <option value="paid_deposit">שילם מקדמה</option>
            <option value="seat_reserved">שריון כיסא</option>
          </select>
        </div>
      </div>
      <div className="field"><label>הערות</label><textarea value={f.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: 52 }} /></div>

      {/* Payments */}
      <div className="card-title" style={{ fontSize: '0.95rem' }}><Icon name="money" /> תשלומים
        <div className="spacer" /><button className="btn subtle sm" onClick={addPay}><Icon name="plus" size={13} /> שורה</button>
      </div>
      {pays.map((p, i) => (
        <div key={i} className="row wrap" style={{ gap: 8, marginBottom: 8, alignItems: 'end', background: 'var(--surface-2)', padding: 10, borderRadius: 'var(--rs)' }}>
          <div className="field" style={{ margin: 0, width: 130 }}><label>אמצעי</label>
            <select value={p.method} onChange={e => setPay(i, 'method', e.target.value)}>{PAYMENT_TYPES.map(m => <option key={m} value={m}>{m}</option>)}</select>
          </div>
          <div className="field" style={{ margin: 0, width: 100 }}><label>סכום (₪)</label><input type="number" dir="ltr" value={p.amount} onChange={e => setPay(i, 'amount', e.target.value)} /></div>
          <div className="field" style={{ margin: 0, width: 80 }}><label>תשלומים</label><input type="number" dir="ltr" min="1" value={p.installments} onChange={e => setPay(i, 'installments', e.target.value)} /></div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 100 }}><label>הערה</label><input value={p.notes} onChange={e => setPay(i, 'notes', e.target.value)} /></div>
          <div className="small muted" style={{ paddingBottom: 8, minWidth: 70 }}>מימון {computeFinancing({ amountInclVat: num(p.amount), paymentType: p.method, numPayments: Math.max(1, parseInt(p.installments) || 1) }).pct}%</div>
          {pays.length > 1 && <button className="btn subtle sm" style={{ color: 'var(--err)' }} onClick={() => rmPay(i)}><Icon name="x" size={13} /></button>}
        </div>
      ))}
      <div className="row small" style={{ marginBottom: 14, gap: 14 }}>
        <span>סה״כ עסקה: <b>₪{deal.toLocaleString()}</b></span>
        <span>שולם: <b>₪{paidTotal.toLocaleString()}</b></span>
        <span>נותר: <b style={{ color: remaining > 0 ? 'var(--warn)' : 'var(--ok)' }}>₪{remaining.toLocaleString()}</b></span>
      </div>

      <div className="row">
        <button className="btn" disabled={busy || !f.product_id} onClick={save}>{busy ? <span className="spinner light" style={{ width: 15, height: 15 }} /> : 'הקמת תלמיד'}</button>
        <button className="btn subtle" onClick={onClose}>ביטול</button>
      </div>
    </Modal>
  )
}
