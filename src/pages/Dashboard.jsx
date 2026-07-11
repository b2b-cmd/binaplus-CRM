import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { TICKET_STATUS_OPEN, TICKET_STATUS, URGENCY, SALES_STATUS_META, chipColor } from '../lib/constants'
import Icon from '../components/Icon'

function Kpi({ label, value, sub, icon }) {
  return (
    <div className="kpi">
      {icon && <div className="accent"><Icon name={icon} size={18} /></div>}
      <div className="label">{label}</div>
      <div className="value anta">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [tab, setTab] = useState('service')
  const [tickets, setTickets] = useState([])
  const [people, setPeople] = useState([])
  const [orders, setOrders] = useState([])
  const [opts, setOpts] = useState({ reps: [], products: [], cycles: [], modules: [] })
  const [f, setF] = useState({ from: '', to: '', rep: '', product_id: '', cycle_id: '', module_id: '', status: '' })

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: p }, { data: o }, oo] = await Promise.all([
        supabase.from('tickets').select('status, handled_by, type, module_id, cycle_id, assigned_rep, urgency, csat_score, created_at'),
        supabase.from('people').select('sales_status, source, product_id, cycle_id, assigned_sales_rep, created_at'),
        supabase.from('orders').select('deal_amount, status, cycle_id, product_id, owner, created_at'),
        loadOptions(),
      ])
      setTickets(t || []); setPeople(p || []); setOrders(o || []); setOpts(oo)
    })()
  }, [])

  const inRange = (d) => (!f.from || new Date(d) >= new Date(f.from)) && (!f.to || new Date(d) <= new Date(f.to + 'T23:59:59'))

  const svc = useMemo(() => {
    const t = tickets.filter(x => inRange(x.created_at) && (!f.rep || x.assigned_rep === f.rep) && (!f.module_id || x.module_id === f.module_id) && (!f.cycle_id || x.cycle_id === f.cycle_id) && (!f.status || x.status === f.status))
    const closed = t.filter(x => x.status === 'closed')
    const byType = {}, byModule = {}, byCycle = {}
    const mName = Object.fromEntries(opts.modules.map(m => [m.id, m.name]))
    const cName = Object.fromEntries(opts.cycles.map(c => [c.id, c.name]))
    t.forEach(x => { byType[x.type || 'ללא'] = (byType[x.type || 'ללא'] || 0) + 1; if (x.module_id) byModule[mName[x.module_id] || '-'] = (byModule[mName[x.module_id] || '-'] || 0) + 1; if (x.cycle_id) byCycle[cName[x.cycle_id] || '-'] = (byCycle[cName[x.cycle_id] || '-'] || 0) + 1 })
    const rName = Object.fromEntries(opts.reps.map(r => [r.id, r.full_name]))
    const byRep = {}
    closed.forEach(x => { if (x.assigned_rep) byRep[rName[x.assigned_rep] || 'לא ידוע'] = (byRep[rName[x.assigned_rep] || 'לא ידוע'] || 0) + 1 })
    const scored = t.filter(x => x.csat_score)
    const csat = scored.length ? (scored.reduce((s, x) => s + x.csat_score, 0) / scored.length).toFixed(1) : null
    return { total: t.length, open: t.filter(x => TICKET_STATUS_OPEN.includes(x.status)).length, ai: closed.filter(x => x.handled_by === 'ai').length, human: closed.filter(x => x.handled_by === 'human').length, byType, byModule, byCycle, byRep, csat, csatCount: scored.length }
  }, [tickets, f, opts])

  const sales = useMemo(() => {
    const p = people.filter(x => inRange(x.created_at) && (!f.rep || x.assigned_sales_rep === f.rep) && (!f.product_id || x.product_id === f.product_id) && (!f.cycle_id || x.cycle_id === f.cycle_id))
    const o = orders.filter(x => inRange(x.created_at) && (!f.rep || x.owner === f.rep) && (!f.product_id || x.product_id === f.product_id) && (!f.cycle_id || x.cycle_id === f.cycle_id))
    const byStatus = {}; p.forEach(x => { byStatus[x.sales_status] = (byStatus[x.sales_status] || 0) + 1 })
    const bySource = {}; p.forEach(x => { bySource[x.source || 'לא ידוע'] = (bySource[x.source || 'לא ידוע'] || 0) + 1 })
    const cName = Object.fromEntries(opts.cycles.map(c => [c.id, c.name])), pName = Object.fromEntries(opts.products.map(pr => [pr.id, pr.name]))
    const revByCycle = {}, revByProduct = {}, revByRep = {}; let rev = 0
    const rName = Object.fromEntries(opts.reps.map(r => [r.id, r.full_name]))
    o.forEach(x => { if (x.status === 'cancelled') return; const a = x.deal_amount || 0; rev += a; revByCycle[cName[x.cycle_id] || '-'] = (revByCycle[cName[x.cycle_id] || '-'] || 0) + a; revByProduct[pName[x.product_id] || '-'] = (revByProduct[pName[x.product_id] || '-'] || 0) + a; if (x.owner) revByRep[rName[x.owner] || 'לא ידוע'] = (revByRep[rName[x.owner] || 'לא ידוע'] || 0) + a })
    return { total: p.length, byStatus, bySource, rev, revByCycle, revByProduct, revByRep }
  }, [people, orders, f, opts])

  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  return (
    <div>
      <div className="toolbar">
        <button className={`chip ${tab === 'service' ? 'active' : ''}`} onClick={() => setTab('service')}>שירות</button>
        <button className={`chip ${tab === 'sales' ? 'active' : ''}`} onClick={() => setTab('sales')}>מכירות</button>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
          <div className="field" style={{ margin: 0 }}><label>מתאריך</label><input type="date" value={f.from} onChange={e => set('from', e.target.value)} /></div>
          <div className="field" style={{ margin: 0 }}><label>עד תאריך</label><input type="date" value={f.to} onChange={e => set('to', e.target.value)} /></div>
          <Sel label="נציג" v={f.rep} on={v => set('rep', v)} opts={opts.reps.map(r => [r.id, r.full_name])} />
          {tab === 'service'
            ? <><Sel label="מודול" v={f.module_id} on={v => set('module_id', v)} opts={opts.modules.map(m => [m.id, m.name])} /><Sel label="מחזור" v={f.cycle_id} on={v => set('cycle_id', v)} opts={opts.cycles.map(c => [c.id, c.name])} /><Sel label="סטטוס" v={f.status} on={v => set('status', v)} opts={Object.entries(TICKET_STATUS).map(([k, m]) => [k, m.label])} /></>
            : <><Sel label="מוצר" v={f.product_id} on={v => set('product_id', v)} opts={opts.products.map(p => [p.id, p.name])} /><Sel label="מחזור" v={f.cycle_id} on={v => set('cycle_id', v)} opts={opts.cycles.map(c => [c.id, c.name])} /></>}
          <div className="field" style={{ margin: 0, justifyContent: 'end' }}><button className="btn subtle sm" onClick={() => setF({ from: '', to: '', rep: '', product_id: '', cycle_id: '', module_id: '', status: '' })}>ניקוי</button></div>
        </div>
      </div>

      {tab === 'service' && (
        <>
          <div className="kpi-grid">
            <Kpi label="פניות שהתקבלו" value={svc.total} icon="inbox" />
            <Kpi label="פניות פתוחות" value={svc.open} icon="filter" />
            <Kpi label="טופלו - סוכן AI" value={svc.ai} icon="sparkles" />
            <Kpi label="טופלו - נציג אנושי" value={svc.human} icon="users" />
            {svc.csat && <Kpi label="שביעות רצון" value={svc.csat} sub={`מתוך 5 · ${svc.csatCount} דירוגים`} icon="users" />}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, marginTop: 16 }}>
            <Breakdown title="לפי סוג פנייה" icon="tag" data={Object.entries(svc.byType).sort((a, b) => b[1] - a[1])} />
            <Breakdown title="לפי מודול" icon="book" data={Object.entries(svc.byModule).sort((a, b) => b[1] - a[1])} />
            <Breakdown title="לפי מחזור" icon="calendar" data={Object.entries(svc.byCycle).sort((a, b) => b[1] - a[1])} />
            <Breakdown title="פניות שנסגרו לפי נציג" icon="users" data={Object.entries(svc.byRep).sort((a, b) => b[1] - a[1])} />
          </div>
        </>
      )}

      {tab === 'sales' && (
        <>
          <div className="kpi-grid">
            <Kpi label="סה״כ לידים/תלמידים" value={sales.total} icon="users" />
            <Kpi label="תלמידים פעילים" value={sales.byStatus.active_student || 0} icon="users" />
            <Kpi label="לידים חדשים" value={sales.byStatus.new_lead || 0} icon="tag" />
            <Kpi label="הכנסה כוללת" value={`₪${Math.round(sales.rev).toLocaleString()}`} icon="money" />
            <Kpi label="אחוז המרה" value={`${Math.round(100 * (sales.byStatus.active_student || 0) / (sales.total || 1))}%`} sub="פעילים / סה״כ" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, marginTop: 16 }}>
            <Breakdown title="לפי סטטוס מכירתי" icon="filter" data={Object.entries(sales.byStatus).map(([k, v]) => [SALES_STATUS_META[k]?.label || k, v])} />
            <Breakdown title="הכנסה לפי מחזור" icon="calendar" money data={Object.entries(sales.revByCycle).sort((a, b) => b[1] - a[1])} />
            <Breakdown title="הכנסה לפי מוצר" icon="grid" money colorize data={Object.entries(sales.revByProduct).sort((a, b) => b[1] - a[1])} />
            <Breakdown title="לפי מקור הגעה" icon="tag" data={Object.entries(sales.bySource).sort((a, b) => b[1] - a[1])} />
            <Breakdown title="הכנסה לפי נציג" icon="users" money data={Object.entries(sales.revByRep).sort((a, b) => b[1] - a[1])} />
          </div>
        </>
      )}
    </div>
  )
}

function Sel({ label, v, on, opts }) {
  return <div className="field" style={{ margin: 0 }}><label>{label}</label><select value={v} onChange={e => on(e.target.value)}><option value="">הכול</option>{opts.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select></div>
}
function Breakdown({ title, icon, data, money, colorize }) {
  const max = Math.max(1, ...data.map(d => d[1]))
  return (
    <div className="card">
      <div className="card-title"><Icon name={icon} /> {title}</div>
      {data.length === 0 ? <div className="empty small">אין נתונים</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {data.slice(0, 8).map(([k, v]) => (
            <div key={k}>
              <div className="row small" style={{ justifyContent: 'space-between' }}><span>{colorize ? <span className="badge" style={chipColor(k)}>{k}</span> : k}</span><b>{money ? `₪${Math.round(v).toLocaleString()}` : v}</b></div>
              <div style={{ height: 6, background: 'var(--xlp)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${100 * v / max}%`, height: '100%', background: colorize ? chipColor(k).color : 'var(--g2)' }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
