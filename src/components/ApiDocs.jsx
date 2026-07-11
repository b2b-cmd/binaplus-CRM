import { useState } from 'react'
import { SALES_STATUS_META, TICKET_TYPES, URGENCY } from '../lib/constants'
import Icon from './Icon'

// Swagger-like interactive docs for the public-api Edge Function.
// Documents leads (people) + tickets: create / update / search+filter / delete,
// with a live "try it" console that fires real requests using a chosen API key.

const METHOD_BADGE = { GET: 'info', POST: 'ok', PATCH: 'warn', DELETE: 'err' }
const enumVals = (obj) => Object.keys(obj).join(' · ')

// Writable fields per resource (source of truth: app schema + DB columns).
const FIELDS = {
  leads: [
    { key: 'full_name', type: 'text', req: true, note: 'שם מלא של הליד/תלמיד' },
    { key: 'phone', type: 'text', note: 'טלפון (ספרות בלבד מומלץ)' },
    { key: 'email', type: 'text', note: 'כתובת מייל' },
    { key: 'source', type: 'text', note: 'מקור הגעה (וובינר / המלצה / פייסבוק…)' },
    { key: 'sales_status', type: 'enum', note: enumVals(SALES_STATUS_META) },
    { key: 'assigned_sales_rep', type: 'uuid', note: 'מזהה נציג מטפל (users.id)' },
    { key: 'product_id', type: 'uuid', note: 'מזהה מוצר (products.id)' },
    { key: 'cycle_id', type: 'uuid', note: 'מזהה מחזור (cycles.id)' },
    { key: 'notes', type: 'text', note: 'הערות חופשי' },
    { key: 'entry_date', type: 'date', note: 'תאריך כניסה (YYYY-MM-DD)' },
  ],
  tickets: [
    { key: 'summary', type: 'text', req: true, note: 'נושא הפנייה' },
    { key: 'description', type: 'text', note: 'תיאור מלא' },
    { key: 'person_id', type: 'uuid', note: 'מזהה התלמיד (people.id)' },
    { key: 'type', type: 'enum', note: TICKET_TYPES.join(' · ') },
    { key: 'urgency', type: 'enum', note: enumVals(URGENCY) + ' (ברירת מחדל med)' },
    { key: 'status', type: 'enum', note: 'new · in_progress · waiting · closed' },
    { key: 'channel', type: 'text', note: 'manual · whatsapp · email · form · phone' },
  ],
}

// GET filter params per resource.
const FILTERS = {
  leads: [
    { key: 'q', note: 'חיפוש טקסט חופשי בשם / טלפון / מייל' },
    { key: 'sales_status', note: 'סינון לפי סטטוס מכירתי' },
    { key: 'assigned_sales_rep', note: 'כל הלידים של נציג מסוים (users.id)' },
    { key: 'product_id', note: 'לפי מוצר' },
    { key: 'cycle_id', note: 'לפי מחזור' },
    { key: 'from', note: 'נוצר מתאריך (ISO, למשל 2026-07-01)' },
    { key: 'to', note: 'נוצר עד תאריך (ISO)' },
    { key: 'limit', note: 'מספר תוצאות מרבי (עד 500)' },
    { key: 'include_deleted', note: 'true כדי לכלול רשומות שנמחקו' },
  ],
  tickets: [
    { key: 'q', note: 'חיפוש טקסט חופשי בנושא / תיאור' },
    { key: 'status', note: 'new · in_progress · waiting · closed' },
    { key: 'person_id', note: 'כל הפניות של תלמיד מסוים (people.id)' },
    { key: 'urgency', note: 'low · med · high' },
    { key: 'type', note: 'לפי סוג פנייה' },
    { key: 'from', note: 'נוצר מתאריך (ISO)' },
    { key: 'to', note: 'נוצר עד תאריך (ISO)' },
    { key: 'limit', note: 'מספר תוצאות מרבי (עד 500)' },
    { key: 'include_deleted', note: 'true כדי לכלול רשומות שנמחקו' },
  ],
}

const OPS = [
  { id: 'search', method: 'GET', title: 'חיפוש / רשימה עם סינון', qs: (r) => `?resource=${r}&q=…&status=…&from=…&to=…&limit=50`, needsId: false, needsBody: false, kind: 'filters' },
  { id: 'get', method: 'GET', title: 'שליפת רשומה בודדת לפי מזהה', qs: (r) => `?resource=${r}&id=<record-id>`, needsId: true, needsBody: false },
  { id: 'create', method: 'POST', title: 'יצירת רשומה חדשה', qs: (r) => `?resource=${r}`, needsId: false, needsBody: true },
  { id: 'update', method: 'PATCH', title: 'עדכון רשומה קיימת', qs: (r) => `?resource=${r}&id=<record-id>`, needsId: true, needsBody: true },
  { id: 'delete', method: 'DELETE', title: 'מחיקת רשומה (רכה — לסל המיחזור)', qs: (r) => `?resource=${r}&id=<record-id>`, needsId: true, needsBody: false, kind: 'delete' },
]

export default function ApiDocs({ base, keys = [] }) {
  const [resource, setResource] = useState('leads')
  const url = `${base}/public-api`
  const activeKeys = keys.filter(k => k.active)

  return (
    <div className="card">
      <div className="card-title"><Icon name="book" /> דוקומנטציית API — לידים ופניות</div>

      {/* base + auth */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--rs)', padding: 12, marginBottom: 14 }}>
        <div className="small" style={{ lineHeight: 2 }}>
          <b>Base URL:</b> <code dir="ltr">{url}</code><br />
          <b>אימות:</b> כותרת <code>x-api-key: &lt;המפתח&gt;</code> (הפיקו מפתח בכרטיס "מפתחות API" למעלה).<br />
          <b>Content-Type:</b> <code>application/json</code> ל-POST/PATCH · <b>Scopes:</b> קריאה/כתיבה פר משאב.<br />
          <b>מבנה תשובה:</b> הצלחה → <code dir="ltr">{'{ "data": … }'}</code> · שגיאה → <code dir="ltr">{'{ "error", "remediation" }'}</code> (הסבר תיקון בעברית).
        </div>
      </div>

      {/* resource switch */}
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className={`chip ${resource === 'leads' ? 'active' : ''}`} onClick={() => setResource('leads')}>לידים / תלמידים <code dir="ltr" style={{ fontSize: '0.7rem' }}>resource=leads</code></button>
        <button className={`chip ${resource === 'tickets' ? 'active' : ''}`} onClick={() => setResource('tickets')}>פניות שירות <code dir="ltr" style={{ fontSize: '0.7rem' }}>resource=tickets</code></button>
      </div>

      {/* operations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OPS.map(op => <Operation key={`${op.id}-${resource}`} op={op} resource={resource} url={url} keys={activeKeys} />)}
      </div>

      {/* field reference */}
      <div className="card-title" style={{ marginTop: 20 }}><Icon name="tag" /> שדות ל-{resource === 'leads' ? 'ליד' : 'פנייה'}</div>
      <div className="table-wrap">
        <table className="grid" style={{ fontSize: '0.82rem' }}>
          <thead><tr><th>שדה</th><th>סוג</th><th>חובה</th><th>הערות / ערכים</th></tr></thead>
          <tbody>
            {FIELDS[resource].map(f => (
              <tr key={f.key}>
                <td><code dir="ltr">{f.key}</code></td>
                <td><span className="badge gray">{f.type}</span></td>
                <td>{f.req ? <span className="badge err">חובה</span> : <span className="muted">—</span>}</td>
                <td className="small">{f.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Operation({ op, resource, url, keys }) {
  const [open, setOpen] = useState(op.id === 'search' || op.id === 'create')
  const [keyVal, setKeyVal] = useState(keys[0]?.key || '')
  const [recId, setRecId] = useState('')
  const [hard, setHard] = useState(false)
  const [bodyText, setBodyText] = useState(() => JSON.stringify(sampleBody(resource), null, 2))
  const [filters, setFilters] = useState({})
  const [resp, setResp] = useState(null)
  const [busy, setBusy] = useState(false)

  const badge = METHOD_BADGE[op.method]
  const filterList = FILTERS[resource]

  const buildUrl = () => {
    let u = `${url}?resource=${resource}`
    if (op.needsId && recId) u += `&id=${encodeURIComponent(recId)}`
    if (op.kind === 'filters') for (const [k, v] of Object.entries(filters)) if (v !== '' && v != null) u += `&${k}=${encodeURIComponent(v)}`
    if (op.kind === 'delete' && hard) u += `&hard=true`
    return u
  }

  const curl = () => {
    const u = buildUrl()
    let c = `curl -X ${op.method} "${u}" \\\n  -H "x-api-key: <KEY>"`
    if (op.needsBody) c += ` \\\n  -H "content-type: application/json" \\\n  -d '${bodyText.replace(/\s+/g, ' ').trim()}'`
    return c
  }

  const send = async () => {
    if (!keyVal) { setResp({ status: 0, body: { error: 'בחרו מפתח API להרצה' } }); return }
    setBusy(true); setResp(null)
    try {
      const opts = { method: op.method, headers: { 'x-api-key': keyVal } }
      if (op.needsBody) { opts.headers['content-type'] = 'application/json'; opts.body = bodyText }
      const r = await fetch(buildUrl(), opts)
      const body = await r.json().catch(() => ({}))
      setResp({ status: r.status, body })
    } catch (e) { setResp({ status: 0, body: { error: String(e?.message || e) } }) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ border: '1.5px solid var(--border-soft)', borderRadius: 'var(--rs)', overflow: 'hidden' }}>
      <button className="row" style={{ width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', gap: 10, textAlign: 'start' }} onClick={() => setOpen(o => !o)}>
        <span className={`badge ${badge}`} style={{ fontFamily: 'monospace', minWidth: 62, justifyContent: 'center' }}>{op.method}</span>
        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{op.title}</span>
        <div className="spacer" />
        <code className="small muted" dir="ltr" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>{op.qs(resource)}</code>
        <Icon name="chevron" size={15} style={{ transform: open ? 'rotate(90deg)' : 'rotate(-90deg)', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {op.kind === 'filters' && (
            <div>
              <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>פילטרים (query params) — כולם אופציונליים</div>
              <div className="table-wrap">
                <table className="grid" style={{ fontSize: '0.8rem' }}>
                  <tbody>{filterList.map(f => (
                    <tr key={f.key}><td style={{ width: 150 }}><code dir="ltr">{f.key}</code></td><td className="small">{f.note}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* curl */}
          <div>
            <div className="small muted" style={{ marginBottom: 4 }}>דוגמת cURL:</div>
            <pre dir="ltr" style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8, fontSize: '0.72rem', overflowX: 'auto', margin: 0 }}>{curl()}</pre>
          </div>

          {/* try-it console */}
          <div style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)', borderRadius: 'var(--rs)', padding: 12 }}>
            <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}><Icon name="sparkles" size={13} /> נסה עכשיו</div>
            <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
              <select className="input" style={{ width: 200 }} value={keyVal} onChange={e => setKeyVal(e.target.value)}>
                <option value="">בחרו מפתח API…</option>
                {keys.map(k => <option key={k.id} value={k.key}>{k.name} ({k.key.slice(0, 8)}…)</option>)}
              </select>
              {op.needsId && <input className="input" style={{ width: 250 }} dir="ltr" placeholder="record id (uuid)" value={recId} onChange={e => setRecId(e.target.value)} />}
              {op.kind === 'delete' && <label className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><input type="checkbox" checked={hard} onChange={e => setHard(e.target.checked)} /> מחיקה קשה (לא לסל)</label>}
            </div>

            {op.kind === 'filters' && (
              <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
                {filterList.slice(0, 6).map(f => (
                  <input key={f.key} className="input" style={{ width: 150 }} dir={f.key === 'q' ? 'auto' : 'ltr'} placeholder={f.key}
                    value={filters[f.key] || ''} onChange={e => setFilters(s => ({ ...s, [f.key]: e.target.value }))} />
                ))}
              </div>
            )}

            {op.needsBody && (
              <textarea className="input" dir="ltr" style={{ fontFamily: 'monospace', fontSize: '0.78rem', minHeight: 130, marginBottom: 8 }} value={bodyText} onChange={e => setBodyText(e.target.value)} />
            )}

            <div className="row">
              <button className="btn sm" onClick={send} disabled={busy}>{busy ? <span className="spinner light" style={{ width: 14, height: 14 }} /> : `שלח ${op.method}`}</button>
              {resp && <span className={`badge ${resp.status >= 200 && resp.status < 300 ? 'ok' : 'err'}`}>HTTP {resp.status}</span>}
            </div>

            {resp && (
              <pre dir="ltr" style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', padding: 10, borderRadius: 8, fontSize: '0.72rem', overflow: 'auto', maxHeight: 240, marginTop: 8 }}>{JSON.stringify(resp.body, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function sampleBody(resource) {
  return resource === 'leads'
    ? { full_name: 'שם הליד', phone: '0501234567', email: 'lead@example.com', source: 'API', sales_status: 'new_lead' }
    : { summary: 'נושא הפנייה', description: 'פירוט הבקשה', urgency: 'med', status: 'new', channel: 'manual' }
}
