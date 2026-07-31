import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearOptionsCache } from '../lib/api'
import RecordFormModal from '../components/RecordFormModal'
import Icon from '../components/Icon'

export default function Settings() {
  const [tab, setTab] = useState('appearance')

  return (
    <div>
      <div className="toolbar">
        <button className={`chip ${tab === 'appearance' ? 'active' : ''}`} onClick={() => setTab('appearance')}>תצוגה</button>
        <button className={`chip ${tab === 'trash' ? 'active' : ''}`} onClick={() => setTab('trash')}>סל מיחזור</button>
        <button className={`chip ${tab === 'api' ? 'active' : ''}`} onClick={() => setTab('api')}>API וגיבויים</button>
        <button className={`chip ${tab === 'integrations' ? 'active' : ''}`} onClick={() => setTab('integrations')}>אינטגרציות</button>
      </div>
      <div className="card" style={{ marginBottom: 16, background: 'var(--surface-2)' }}>
        <div className="small muted"><Icon name="tag" size={13} /> שדות מותאמים ורשימות מנוהלים כעת ישירות מתוך מסך הרשומה (כרטיס "שדות מותאמים" ← "ניהול שדות"). מוצרים, מודולים ומחזורים מנוהלים במסכים הייעודיים שלהם.</div>
      </div>

      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'trash' && <TrashTab />}
      {tab === 'api' && <ApiBackupTab />}

      {tab === 'integrations' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          <InfoCard icon="sparkles" title="סוכן AI (Claude)" status="ממתין למפתח" body="מפתח Anthropic מוגדר ב-Edge Function ai-draft (צד שרת). יופעל בשלב הבא." />
          <InfoCard icon="inbox" title="סנכרון מייל" status="ממתין להגדרה" body="תיבת binaplus@bina-plus.co.il תסונכרן דרך Edge Function email-sync (IMAP). כל מייל = פנייה." />
          <InfoCard icon="grid" title="וואטסאפ (CloudChat)" status="API נכנס" body="הסוכן שולח פניות ל-API הנכנס inbound-ticket. הטמעת שיחה חיה במסך הטיפול." />
          <InfoCard icon="save" title="גיבוי 24ש׳" status="Phase 4" body="Snapshot יומי של כל הטבלאות ל-Storage + שחזור 24 שעות אחורה." />
          <InfoCard icon="shield" title="API ציבורי + מפתחות" status="Phase 4" body="REST חיצוני עם API-keys, scopes ולוג קריאות עם הסבר תיקון לכל שגיאה." />
          <ThemeCard />
        </div>
      )}
    </div>
  )
}

function ListCard({ title, icon, rows, onAdd, onDel, onEdit }) {
  return (
    <div className="card">
      <div className="card-title"><Icon name={icon} /> {title} <div className="spacer" /><button className="btn subtle sm" onClick={onAdd}><Icon name="plus" size={14} /> הוסף</button></div>
      {rows.length === 0 ? <div className="empty small">ריק</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map(r => (
            <div key={r.id} className="row" style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--surface-2)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 600 }}>{r.main}</div>
                {r.sub && <div className="small muted">{r.sub}</div>}
              </div>
              {onEdit && <button className="btn subtle sm" style={{ padding: '4px 8px' }} onClick={() => onEdit(r.id, r.name)}><Icon name="edit" size={13} /></button>}
              <button className="btn subtle sm" style={{ color: 'var(--err)', padding: '4px 8px' }} onClick={() => onDel(r.id)}><Icon name="x" size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ApiBackupTab() {
  const [keys, setKeys] = useState([])
  const [logs, setLogs] = useState([])
  const [backups, setBackups] = useState([])
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState({ leads: { read: true, write: false }, tickets: { read: true, write: false } })
  const [newKey, setNewKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const FUNCTIONS = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')

  const load = async () => {
    const [{ data: k }, { data: l }, { data: b }] = await Promise.all([
      supabase.from('api_keys').select('*').order('created_at', { ascending: false }),
      supabase.from('api_logs').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('backups').select('*').order('created_at', { ascending: false }).limit(20),
    ])
    setKeys(k || []); setLogs(l || []); setBackups(b || [])
  }
  useEffect(() => { load() }, [])

  const createKey = async () => {
    const key = 'sk_' + crypto.randomUUID().replace(/-/g, '')
    await supabase.from('api_keys').insert({ name: name || 'מפתח', key, scopes })
    setNewKey(key); setName(''); load()
  }
  const toggle = async (k) => { await supabase.from('api_keys').update({ active: !k.active }).eq('id', k.id); load() }
  const delKey = async (id) => { if (confirm('למחוק מפתח?')) { await supabase.from('api_keys').delete().eq('id', id); load() } }
  const runBackup = async () => {
    setBusy(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${FUNCTIONS}/backup-nightly`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ action: 'backup' }) })
    setBusy(false); load()
  }
  const restore = async (path) => {
    if (!confirm(`לשחזר את הרשומות למצב מ-${path}? (שחזור ממזג רשומות שהשתנו/נמחקו)`)) return
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch(`${FUNCTIONS}/backup-nightly`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ action: 'restore', path }) })
    const j = await r.json(); alert(j.ok ? `שוחזרו ${j.restored} רשומות` : 'שגיאה בשחזור')
  }

  const scopeBox = (res, kind) => <label className="small" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={scopes[res][kind]} onChange={e => setScopes(s => ({ ...s, [res]: { ...s[res], [kind]: e.target.checked } }))} /> {kind === 'read' ? 'קריאה' : 'כתיבה'}</label>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <div className="card">
        <div className="card-title"><Icon name="shield" /> מפתחות API</div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--rs)', padding: 12, marginBottom: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>שם מפתח</label><input value={name} onChange={e => setName(e.target.value)} placeholder="למשל: אתר / אוטומציה" /></div>
          <div className="row wrap" style={{ marginTop: 8, gap: 12 }}>
            <span className="small muted">לידים:</span>{scopeBox('leads', 'read')}{scopeBox('leads', 'write')}
            <span className="small muted">פניות:</span>{scopeBox('tickets', 'read')}{scopeBox('tickets', 'write')}
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={createKey}><Icon name="plus" size={14} /> הפק מפתח</button>
          {newKey && <div className="small" style={{ marginTop: 8, wordBreak: 'break-all', color: 'var(--ok)' }}>המפתח (העתיקו - מוצג פעם אחת): <b dir="ltr">{newKey}</b></div>}
        </div>
        {keys.map(k => (
          <div key={k.id} className="row small" style={{ padding: '7px 9px', borderRadius: 8, background: 'var(--surface-2)', marginBottom: 6 }}>
            <b>{k.name}</b>
            <span className="muted" dir="ltr">{k.key.slice(0, 10)}…</span>
            <div className="spacer" />
            <button className={`badge ${k.active ? 'ok' : 'gray'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => toggle(k)}>{k.active ? 'פעיל' : 'מושבת'}</button>
            <button className="btn subtle sm" style={{ color: 'var(--err)', padding: '2px 6px' }} onClick={() => delKey(k.id)}><Icon name="x" size={12} /></button>
          </div>
        ))}
        <div className="muted small" style={{ marginTop: 8 }}>נקודת קצה: <code dir="ltr">{FUNCTIONS}/public-api?resource=leads|tickets</code> · כותרת <code>x-api-key</code></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="card-title"><Icon name="save" /> גיבויים <div className="spacer" /><button className="btn subtle sm" onClick={runBackup} disabled={busy}>{busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'גבה עכשיו'}</button></div>
          <div className="muted small" style={{ marginBottom: 8 }}>גיבוי אוטומטי יומי (02:00). שחזור ממזג רשומות שהשתנו/נמחקו.</div>
          {backups.length === 0 ? <div className="empty small">אין גיבויים</div> : backups.map(b => (
            <div key={b.id} className="row small" style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--surface-2)', marginBottom: 5 }}>
              <span>{new Date(b.created_at).toLocaleString('he-IL')}</span>
              <div className="spacer" />
              <button className="btn subtle sm" onClick={() => restore(b.path)}>שחזר</button>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title"><Icon name="inbox" /> לוג קריאות API</div>
          {logs.length === 0 ? <div className="empty small">אין קריאות</div> : (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>{logs.map(l => (
              <div key={l.id} className="small" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-soft)' }}>
                <div className="row"><span className={`badge ${l.ok ? 'ok' : 'err'}`} style={{ fontSize: '0.65rem' }}>{l.status}</span><b dir="ltr">{l.method} {l.endpoint}</b><div className="spacer" /><span className="muted">{new Date(l.created_at).toLocaleTimeString('he-IL')}</span></div>
                {!l.ok && <div className="muted" style={{ marginTop: 3 }}>{l.error} - {l.remediation}</div>}
              </div>
            ))}</div>
          )}
        </div>
        <div className="card">
          <div className="card-title"><Icon name="book" /> דוקומנטציית API</div>
          <div className="small muted" style={{ marginBottom: 10 }}>המדריך המלא (יצירה · עדכון · חיפוש עם פילטרים · מחיקה) עם "נסה עכשיו" חי, בדף ייעודי.</div>
          <a className="btn sm" href="#/api-docs"><Icon name="book" size={14} /> פתח דוקומנטציית API</a>
        </div>
      </div>
    </div>
  )
}

const OBJECTS = [['people', 'לידים/תלמידים'], ['tickets', 'פניות'], ['orders', 'הזמנות'], ['payments', 'תשלומים'], ['opportunities', 'הזדמנויות'], ['modules', 'מודולים'], ['cycles', 'מחזורים'], ['products', 'מוצרים']]
const FIELD_TYPES = [['text', 'טקסט'], ['number', 'מספר'], ['date', 'תאריך'], ['select', 'בחירה'], ['checkbox', 'כן/לא']]

function SchemaTab() {
  const [picklists, setPicklists] = useState([])
  const [fields, setFields] = useState([])
  const [obj, setObj] = useState('people')
  const [nf, setNf] = useState({ key: '', label: '', type: 'text', options: '' })

  const load = async () => {
    const [{ data: pl }, { data: cf }] = await Promise.all([
      supabase.from('picklists').select('*').order('key'),
      supabase.from('custom_fields').select('*').order('position'),
    ])
    setPicklists(pl || []); setFields(cf || [])
  }
  useEffect(() => { load() }, [])

  const savePicklist = async (id, text) => { await supabase.from('picklists').update({ options: text.split(',').map(s => s.trim()).filter(Boolean) }).eq('id', id); load() }
  const addField = async () => {
    if (!nf.key.trim() || !nf.label.trim()) return
    await supabase.from('custom_fields').insert({ object_type: obj, key: nf.key.trim(), label: nf.label.trim(), type: nf.type, options: nf.options ? nf.options.split(',').map(s => s.trim()).filter(Boolean) : [] })
    setNf({ key: '', label: '', type: 'text', options: '' }); load()
  }
  const delField = async (id) => { if (confirm('למחוק שדה?')) { await supabase.from('custom_fields').delete().eq('id', id); load() } }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <div className="card">
        <div className="card-title"><Icon name="tag" /> שדות מותאמים</div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--rs)', padding: 12, marginBottom: 12 }}>
          <div className="field" style={{ margin: 0 }}><label>אובייקט</label><select value={obj} onChange={e => setObj(e.target.value)}>{OBJECTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <input className="input" placeholder="מפתח (אנגלית)" dir="ltr" value={nf.key} onChange={e => setNf(f => ({ ...f, key: e.target.value }))} />
            <input className="input" placeholder="תווית" value={nf.label} onChange={e => setNf(f => ({ ...f, label: e.target.value }))} />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <select className="input" value={nf.type} onChange={e => setNf(f => ({ ...f, type: e.target.value }))}>{FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            {nf.type === 'select' && <input className="input" placeholder="אפשרויות, מופרד בפסיק" value={nf.options} onChange={e => setNf(f => ({ ...f, options: e.target.value }))} />}
          </div>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={addField}><Icon name="plus" size={14} /> הוסף שדה</button>
        </div>
        {OBJECTS.map(([v, l]) => {
          const fs = fields.filter(f => f.object_type === v)
          if (!fs.length) return null
          return <div key={v} style={{ marginBottom: 8 }}><div className="small muted" style={{ fontWeight: 700 }}>{l}</div>
            {fs.map(f => <div key={f.id} className="row small" style={{ padding: '5px 8px', background: 'var(--surface-2)', borderRadius: 8, marginTop: 4 }}><b>{f.label}</b><span className="muted" dir="ltr">{f.key} · {f.type}</span><div className="spacer" /><button className="btn subtle sm" style={{ color: 'var(--err)', padding: '2px 6px' }} onClick={() => delField(f.id)}><Icon name="x" size={11} /></button></div>)}
          </div>
        })}
      </div>

      <div className="card">
        <div className="card-title"><Icon name="filter" /> רשימות בחירה (דרופדאונים)</div>
        {picklists.map(pl => (
          <div key={pl.id} className="field"><label>{pl.label || pl.key}</label>
            <textarea defaultValue={(pl.options || []).join(', ')} onBlur={e => savePicklist(pl.id, e.target.value)} style={{ minHeight: 50 }} />
          </div>
        ))}
        <div className="muted small">מופרד בפסיק. נשמר אוטומטית ביציאה מהשדה.</div>
      </div>
    </div>
  )
}

function TrashTab() {
  const [data, setData] = useState({ people: [], tickets: [], opportunities: [], orders: [], payments: [] })
  const load = async () => {
    const [p, t, op, or, pay] = await Promise.all([
      supabase.from('people').select('id, full_name, phone, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
      supabase.from('tickets').select('id, summary, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
      supabase.from('opportunities').select('id, training_type, person:people(full_name), deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
      supabase.from('orders').select('id, deal_amount, person:people(full_name), deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
      supabase.from('payments').select('id, amount_incl_vat, person:people(full_name), deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
    ])
    setData({ people: p.data || [], tickets: t.data || [], opportunities: op.data || [], orders: or.data || [], payments: pay.data || [] })
  }
  useEffect(() => { load() }, [])
  const restore = async (tbl, id) => { await supabase.from(tbl).update({ deleted_at: null }).eq('id', id); load() }
  const Card = ({ icon, title, rows, tbl, label }) => (
    <div className="card">
      <div className="card-title"><Icon name={icon} /> {title}</div>
      {rows.length === 0 ? <div className="empty small">ריק</div> : rows.map(r => (
        <div key={r.id} className="row small" style={{ padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 5 }}><span style={{ flex: 1 }}>{label(r)}</span><button className="btn subtle sm" onClick={() => restore(tbl, r.id)}>שחזר</button></div>
      ))}
    </div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16, alignItems: 'start' }}>
      <Card icon="users" title="לידים/תלמידים שנמחקו" rows={data.people} tbl="people" label={r => `${r.full_name} · ${r.phone || ''}`} />
      <Card icon="inbox" title="פניות שנמחקו" rows={data.tickets} tbl="tickets" label={r => r.summary || '-'} />
      <Card icon="tag" title="הזדמנויות שנמחקו" rows={data.opportunities} tbl="opportunities" label={r => `${r.person?.full_name || ''} · ${r.training_type || ''}`} />
      <Card icon="file" title="הזמנות שנמחקו" rows={data.orders} tbl="orders" label={r => `${r.person?.full_name || ''} · ₪${(r.deal_amount || 0).toLocaleString()}`} />
      <Card icon="money" title="תשלומים שנמחקו" rows={data.payments} tbl="payments" label={r => `${r.person?.full_name || ''} · ₪${(r.amount_incl_vat || 0).toLocaleString()}`} />
    </div>
  )
}

function ThemeCard() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light')
  const apply = (t) => { document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); setTheme(t) }
  return (
    <div className="card">
      <div className="card-title"><Icon name="cog" /> עיצוב תצוגה</div>
      <div className="row">
        <button className={`chip ${theme === 'light' ? 'active' : ''}`} onClick={() => apply('light')}>☀️ בהיר</button>
        <button className={`chip ${theme === 'dark' ? 'active' : ''}`} onClick={() => apply('dark')}>🌙 כהה</button>
      </div>
    </div>
  )
}

function ApiDocsCard({ base }) {
  const ex = `curl -X GET "${base}/public-api?resource=leads" \\\n  -H "x-api-key: <KEY>"`
  const ex2 = `curl -X POST "${base}/public-api?resource=tickets" \\\n  -H "x-api-key: <KEY>" -H "content-type: application/json" \\\n  -d '{"summary":"פנייה חדשה","urgency":"high"}'`
  return (
    <div className="card">
      <div className="card-title"><Icon name="book" /> דוקומנטציית API</div>
      <div className="small" style={{ lineHeight: 1.8 }}>
        <b>Base:</b> <code dir="ltr">{base}/public-api</code><br />
        <b>אימות:</b> כותרת <code>x-api-key</code> (הפק מפתח למעלה).<br />
        <b>משאבים:</b> <code>?resource=leads</code> · <code>?resource=tickets</code><br />
        <b>מתודות:</b> GET (רשימה/פריט לפי <code>?id=</code>) · POST (יצירה) · PATCH (<code>?id=</code> עדכון).<br />
        <b>Scopes:</b> קריאה/כתיבה פר משאב לכל מפתח.<br />
        <b>שגיאות:</b> כל תגובת שגיאה כוללת <code>error</code> + <code>remediation</code> (הסבר תיקון בעברית), ונרשמת בלוג.
      </div>
      <pre dir="ltr" style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, fontSize: '0.72rem', overflowX: 'auto', marginTop: 8 }}>{ex}</pre>
      <pre dir="ltr" style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, fontSize: '0.72rem', overflowX: 'auto' }}>{ex2}</pre>
    </div>
  )
}

function InfoCard({ icon, title, status, body }) {
  return (
    <div className="card">
      <div className="card-title"><Icon name={icon} /> {title}</div>
      <span className="badge warn" style={{ marginBottom: 8 }}>{status}</span>
      <p className="muted small">{body}</p>
    </div>
  )
}

/* Theme control. There is also a toggle in the header, but it is an unlabelled
   icon and users looking for the setting go to Settings first - with nothing
   here, dark mode reads as "removed". */
function AppearanceTab() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const apply = (t) => {
    setTheme(t)
    document.documentElement.dataset.theme = t
    localStorage.setItem('theme', t)
  }
  const OPTIONS = [
    { key: 'light', label: 'בהיר', icon: 'sun' },
    { key: 'dark', label: 'כהה', icon: 'moon' },
  ]
  return (
    <div className="card">
      <div className="card-title"><Icon name="cog" /> ערכת נושא</div>
      <p className="muted small" style={{ marginTop: -8, marginBottom: 14 }}>
        ניתן להחליף גם מהאייקון שבסרגל העליון.
      </p>
      <div className="row" style={{ gap: 10 }}>
        {OPTIONS.map(o => (
          <button key={o.key} className={`btn ${theme === o.key ? '' : 'ghost'}`} onClick={() => apply(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
