import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// Feature flag: scheduled email sending is hidden (buggy, deprioritized 2026-07).
// All the scheduling code below + the outbox/dispatch-outbox backend are kept intact -
// flip this to true to restore the "תזמון" UI. See also TicketDetail.send() (sendAt branch).
const SCHEDULED_SEND_ENABLED = false

// Rich-text email composer with attachments + immediate/scheduled send.
// onSend({ html, text, files, sendAt }) → returns falsy to keep the composer as-is (e.g. error),
//   truthy to clear it. sendAt null = send now, else ISO string.
// editorApi (optional ref): populated with { insert(html), clear() } so callers (e.g. AI draft)
//   can inject content on demand WITHOUT wiping what the user already typed.
export default function ReplyComposer({ onSend, sending, channel, kb = [], editorApi }) {
  const ed = useRef(null)
  const schedRef = useRef(null)
  const [files, setFiles] = useState([])
  const [schedOpen, setSchedOpen] = useState(false)
  const [customAt, setCustomAt] = useState('')

  const exec = (cmd, val) => { ed.current?.focus(); document.execCommand(cmd, false, val) }
  const addLink = () => { const url = prompt('כתובת הקישור:', 'https://'); if (url) exec('createLink', url) }
  const insertText = (t) => { ed.current.focus(); document.execCommand('insertText', false, t) }

  // expose an imperative API for injecting AI drafts etc.
  useEffect(() => {
    if (!editorApi) return
    editorApi.current = {
      insert: (html) => { ed.current.focus(); document.execCommand('insertHTML', false, html) },
      clear: () => { if (ed.current) ed.current.innerHTML = '' },
    }
  }, [editorApi])

  // close the schedule popup on outside click
  useEffect(() => {
    const h = (e) => { if (schedRef.current && !schedRef.current.contains(e.target)) setSchedOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const doSend = async (sendAt) => {
    const html = ed.current?.innerHTML || ''
    const text = (ed.current?.innerText || '').trim()
    if (!text && files.length === 0) return
    const ok = await onSend({ html, text, files, sendAt })
    if (ok !== false) { ed.current.innerHTML = ''; setFiles([]); setSchedOpen(false); setCustomAt('') }
  }

  const presets = () => {
    const now = new Date()
    const inHour = new Date(now.getTime() + 3600000)
    const tomorrow = new Date(now.getTime() + 86400000)
    const sunday = new Date(now); sunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7)); sunday.setHours(9, 0, 0, 0)
    return [
      { label: 'בעוד שעה', at: inHour },
      { label: 'מחר באותה שעה', at: tomorrow },
      { label: 'יום ראשון בבוקר (09:00)', at: sunday },
    ]
  }

  const isEmail = channel === 'email'
  return (
    <div className="composer">
      {isEmail && (
        <div className="composer-toolbar">
          <button type="button" title="מודגש" onClick={() => exec('bold')}><b>B</b></button>
          <button type="button" title="נטוי" onClick={() => exec('italic')}><i>I</i></button>
          <button type="button" title="קו תחתון" onClick={() => exec('underline')}><u>U</u></button>
          <button type="button" title="קישור" onClick={addLink}><Icon name="link" size={14} /></button>
          <span style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <select title="גודל טקסט" onChange={e => { exec('fontSize', e.target.value); e.target.value = '' }} defaultValue="">
            <option value="" disabled>גודל</option>
            <option value="2">קטן</option><option value="3">רגיל</option><option value="5">גדול</option><option value="6">כותרת</option>
          </select>
          {kb.length > 0 && (
            <select title="מאגר ידע" defaultValue="" onChange={e => { const it = kb.find(k => k.id === e.target.value); if (it) insertText(it.answer); e.target.value = '' }}>
              <option value="">ממאגר הידע…</option>
              {kb.map(k => <option key={k.id} value={k.id}>{(k.topic || k.question || k.answer || '').slice(0, 34)}</option>)}
            </select>
          )}
        </div>
      )}
      <div ref={ed} className="composer-editor" contentEditable suppressContentEditableWarning
        data-ph={isEmail ? 'כתבו את המענה… (ניתן לעצב: מודגש, נטוי, קישור)' : 'כתבו את המענה…'} />
      <div className="composer-foot">
        <label className="feed-attach">
          <Icon name="file" size={14} /> צרף קבצים
          <input type="file" multiple style={{ display: 'none' }} onChange={e => { setFiles(f => [...f, ...Array.from(e.target.files)]); e.target.value = '' }} />
        </label>
        {files.map((f, i) => (
          <span key={i} className="badge gray">{f.name} <span style={{ cursor: 'pointer', color: 'var(--err)' }} onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}>✕</span></span>
        ))}
        <div className="spacer" />
        {SCHEDULED_SEND_ENABLED && (
          <div ref={schedRef} style={{ position: 'relative' }}>
            <button className="btn ghost sm" onClick={() => setSchedOpen(o => !o)} disabled={sending}><Icon name="calendar" size={14} /> תזמון</button>
            {schedOpen && (
              <div className="pop" style={{ position: 'absolute', bottom: 44, insetInlineEnd: 0, width: 250, padding: 12, zIndex: 60 }}>
                <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>מתי לשלוח?</div>
                {presets().map(p => (
                  <button key={p.label} className="btn subtle sm block" style={{ marginBottom: 6, justifyContent: 'space-between' }}
                    onClick={() => doSend(p.at.toISOString())}>
                    <span>{p.label}</span>
                    <span className="small muted">{p.at.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </button>
                ))}
                <div className="field" style={{ margin: '10px 0 0' }}>
                  <label className="small">תאריך ושעה מותאמים</label>
                  <input type="datetime-local" value={customAt} onChange={e => setCustomAt(e.target.value)} dir="ltr" />
                </div>
                <button className="btn sm block" style={{ marginTop: 8 }} disabled={!customAt} onClick={() => doSend(new Date(customAt).toISOString())}>תזמן שליחה</button>
              </div>
            )}
          </div>
        )}
        <button className="btn" disabled={sending} onClick={() => doSend(null)}>{sending ? <span className="spinner light" style={{ width: 16, height: 16 }} /> : (SCHEDULED_SEND_ENABLED ? 'שלח עכשיו' : 'שלח')}</button>
      </div>
    </div>
  )
}
