import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { URGENCY } from '../lib/constants'
import Icon from './Icon'

// local YYYY-MM-DD (avoid toISOString UTC shift that rolls the date back in +UTC zones)
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d) }
const DATE_PRESETS = [
  { label: 'היום', get: () => addDays(0) },
  { label: 'מחר', get: () => addDays(1) },
  { label: '+3 ימים', get: () => addDays(3) },
  { label: '+שבוע', get: () => addDays(7) },
]

// Polymorphic feed for any record: notes (+files, +replies) and tasks (+urgency, assignee, due).
export default function ActivityFeed({ objectType, recordId }) {
  const rep = useAuthStore(s => s.rep)
  const isManager = useAuthStore(s => s.isManager)()
  const [items, setItems] = useState([])
  const [tasks, setTasks] = useState([])
  const [reps, setReps] = useState([])
  const [mode, setMode] = useState('note')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  // task fields
  const [due, setDue] = useState(addDays(0))
  const [urgency, setUrgency] = useState('med')
  const [assignee, setAssignee] = useState('')
  const [busy, setBusy] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const fileRef = useRef()

  const load = async () => {
    const [{ data: a }, { data: t }, o] = await Promise.all([
      supabase.from('activities').select('*, author_user:users!activities_author_fkey(full_name)').eq('object_type', objectType).eq('record_id', recordId).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*, assignee_user:users!tasks_assignee_fkey(full_name)').eq('object_type', objectType).eq('record_id', recordId).order('created_at', { ascending: false }),
      loadOptions(),
    ])
    setItems(a || []); setTasks(t || []); setReps(o.reps || [])
    if (!assignee && rep?.id) setAssignee(rep.id)
  }
  useEffect(() => { if (recordId) load() }, [objectType, recordId])

  const addNote = async () => {
    if (!text.trim() && !file) return
    setBusy(true)
    let file_url = null, kind = 'note'
    if (file) {
      const ext = (file.name.match(/\.[a-z0-9]{1,8}$/i) || [''])[0]
      const path = `${objectType}/${recordId}/${Date.now()}${ext}` // ASCII-safe key
      const { error } = await supabase.storage.from('attachments').upload(path, file)
      if (!error) { file_url = supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl; kind = 'file' }
    }
    const { data } = await supabase.from('activities').insert({ object_type: objectType, record_id: recordId, kind, author: rep?.id, body: text.trim() || null, file_url }).select('*, author_user:users!activities_author_fkey(full_name)').single()
    if (data) { setItems(x => [data, ...x]); setText(''); setFile(null); if (fileRef.current) fileRef.current.value = '' }
    setBusy(false)
  }
  const addReply = async (parent) => {
    if (!replyText.trim()) return
    setBusy(true)
    const { data } = await supabase.from('activities').insert({ object_type: objectType, record_id: recordId, kind: 'note', author: rep?.id, body: replyText.trim(), parent_id: parent.id }).select('*, author_user:users!activities_author_fkey(full_name)').single()
    if (data) { setItems(x => [...x, data]); setReplyText(''); setReplyTo(null) }
    setBusy(false)
  }
  const addTask = async () => {
    if (!text.trim()) return
    setBusy(true)
    const { data } = await supabase.from('tasks').insert({ object_type: objectType, record_id: recordId, title: text.trim(), due_date: due || null, urgency, assignee: assignee || rep?.id, created_by: rep?.id }).select('*, assignee_user:users!tasks_assignee_fkey(full_name)').single()
    if (data) { setTasks(x => [data, ...x]); setText(''); setDue(addDays(0)); setUrgency('med') }
    setBusy(false)
  }
  const toggleTask = async (t) => { await supabase.from('tasks').update({ status: t.status === 'open' ? 'done' : 'open' }).eq('id', t.id); setTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: x.status === 'open' ? 'done' : 'open' } : x)) }
  const delItem = async (i) => { if (confirm('למחוק?')) { await supabase.from('activities').delete().eq('id', i.id); setItems(x => x.filter(y => y.id !== i.id && y.parent_id !== i.id)) } }

  const topNotes = items.filter(n => !n.parent_id)
  const repliesOf = (id) => items.filter(n => n.parent_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const openTasks = tasks.filter(t => t.status === 'open')

  return (
    <div className="card">
      <div className="card-title"><Icon name="book" /> פעילות</div>
      <div className="row" style={{ marginBottom: 10, gap: 8 }}>
        <button className={`chip ${mode === 'note' ? 'active' : ''}`} onClick={() => setMode('note')}><Icon name="edit" size={13} /> הערה</button>
        <button className={`chip ${mode === 'task' ? 'active' : ''}`} onClick={() => setMode('task')}><Icon name="calendar" size={13} /> משימה</button>
      </div>

      <div className="feed-composer">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={mode === 'note' ? 'הוסיפו הערה…' : 'תיאור המשימה…'} />
        {mode === 'task' && (
          <>
            <div className="feed-date-presets">
              {DATE_PRESETS.map(p => { const v = p.get(); return <button key={p.label} className={`date-preset ${due === v ? 'active' : ''}`} onClick={() => setDue(v)}>{p.label}</button> })}
              <input type="date" value={due} onChange={e => setDue(e.target.value)} dir="ltr" style={{ padding: '3px 8px', fontSize: '0.78rem', width: 140 }} />
            </div>
            <div className="row wrap" style={{ marginTop: 8, gap: 8 }}>
              <span className="small muted">דחיפות:</span>
              {Object.entries(URGENCY).map(([k, u]) => (
                <button key={k} className="urg-btn" onClick={() => setUrgency(k)}
                  style={urgency === k ? { background: u.color, color: '#fff', borderColor: u.color } : { color: u.color }}>{u.label}</button>
              ))}
              <select className="input" style={{ width: 150, padding: '5px 8px', fontSize: '0.8rem' }} value={assignee} onChange={e => setAssignee(e.target.value)}>
                <option value="">מבצע…</option>
                {reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="feed-footer">
          {mode === 'note' && (
            <label className="feed-attach">
              <Icon name="link" size={13} /> {file ? file.name : 'צרף קובץ'}
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
            </label>
          )}
          <div className="spacer" />
          <button className="btn sm" onClick={mode === 'note' ? addNote : addTask} disabled={busy || !text.trim()}>{busy ? <span className="spinner light" style={{ width: 14, height: 14 }} /> : 'פרסם'}</button>
        </div>
      </div>

      {openTasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {openTasks.map(t => (
            <div key={t.id} className="feed-task" style={{ borderInlineStartColor: URGENCY[t.urgency]?.color || 'var(--mp)' }}>
              <input type="checkbox" checked={false} onChange={() => toggleTask(t)} />
              <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 600 }}>{t.title}</span>
              {t.urgency && <span className="badge" style={{ background: URGENCY[t.urgency]?.color, color: '#fff' }}>{URGENCY[t.urgency]?.label}</span>}
              {t.assignee_user?.full_name && <span className="badge gray" style={{ fontSize: '0.68rem' }}>{t.assignee_user.full_name}</span>}
              {t.due_date && <span className="muted small">{new Date(t.due_date).toLocaleDateString('he-IL')}</span>}
            </div>
          ))}
        </div>
      )}

      {topNotes.length === 0 && tasks.filter(t => t.status === 'done').length === 0 ? <div className="empty small">אין פעילות עדיין</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
          {topNotes.map(n => (
            <div key={n.id} className="feed-item">
              <div className="feed-meta">
                <div className="avatar" style={{ width: 22, height: 22, fontSize: '0.62rem' }}>{(n.author_user?.full_name || '?').slice(0, 2)}</div>
                <b style={{ color: 'var(--heading)', fontSize: '0.82rem' }}>{n.author_user?.full_name || 'נציג'}</b>
                <span className="muted small">· {new Date(n.created_at).toLocaleString('he-IL')}</span>
                <div className="spacer" />
                {(n.author === rep?.id || isManager) && <button className="link-btn" style={{ color: 'var(--err)' }} onClick={() => delItem(n)}><Icon name="x" size={12} /></button>}
              </div>
              {n.body && <div className="feed-body">{n.body}</div>}
              {n.file_url && <a className="small" href={n.file_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 4, marginTop: 4 }}><Icon name="link" size={12} /> קובץ מצורף</a>}

              {repliesOf(n.id).map(r => (
                <div key={r.id} className="feed-reply">
                  <div>
                    <div className="feed-meta"><b style={{ color: 'var(--heading)', fontSize: '0.78rem' }}>{r.author_user?.full_name || 'נציג'}</b><span className="muted small">· {new Date(r.created_at).toLocaleString('he-IL')}</span>{(r.author === rep?.id || isManager) && <><div className="spacer" /><button className="link-btn" style={{ color: 'var(--err)' }} onClick={() => delItem(r)}><Icon name="x" size={11} /></button></>}</div>
                    <div className="feed-body" style={{ fontSize: '0.82rem' }}>{r.body}</div>
                  </div>
                </div>
              ))}

              {replyTo === n.id ? (
                <div className="feed-reply">
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="תגובה…" style={{ minHeight: 44, fontSize: '0.82rem' }} autoFocus />
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm" disabled={busy || !replyText.trim()} onClick={() => addReply(n)}>שלח</button>
                    <button className="link-btn" onClick={() => { setReplyTo(null); setReplyText('') }}>ביטול</button>
                  </div>
                </div>
              ) : (
                <button className="link-btn" style={{ marginTop: 6 }} onClick={() => { setReplyTo(n.id); setReplyText('') }}><Icon name="reply" size={13} /> השב</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
