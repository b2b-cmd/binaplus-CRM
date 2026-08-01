import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { URGENCY } from '../lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Input } from './ui/input'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import Attachment from './Attachment'
import { toast } from './Toaster'
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
    let file_name = null, file_type = null, file_size = null
    if (file) {
      // Storage keys must be ASCII, so the original (often Hebrew) filename is
      // kept on the row instead of being encoded into the path.
      const ext = (file.name.match(/\.[a-z0-9]{1,8}$/i) || [''])[0]
      const path = `${objectType}/${recordId}/${Date.now()}${ext}`
      const { error } = await supabase.storage.from('attachments').upload(path, file)
      if (error) {
        // Never save the note as if the file had been attached - that is how
        // attachments silently disappeared.
        setBusy(false)
        toast(`העלאת הקובץ נכשלה: ${error.message || ''}`, 'err')
        return
      }
      file_url = supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl
      kind = 'file'
      file_name = file.name
      file_type = file.type || null
      file_size = file.size ?? null
    }
    const { data, error } = await supabase.from('activities')
      .insert({ object_type: objectType, record_id: recordId, kind, author: rep?.id, body: text.trim() || null, file_url, file_name, file_type, file_size })
      .select('*, author_user:users!activities_author_fkey(full_name)').single()
    if (error) { toast(`שמירת ההערה נכשלה: ${error.message || ''}`, 'err'); setBusy(false); return }
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
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base"><Icon name="book" size={16} /> פעילות</CardTitle>
      </CardHeader>
      <CardContent>
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant={mode === 'note' ? 'default' : 'outline'} onClick={() => setMode('note')}><Icon name="edit" size={13} /> הערה</Button>
        <Button size="sm" variant={mode === 'task' ? 'default' : 'outline'} onClick={() => setMode('task')}><Icon name="calendar" size={13} /> משימה</Button>
      </div>

      <div className="bg-card focus-within:border-ring mb-4 rounded-lg border p-3 transition-colors">
        <Textarea className="min-h-24 resize-y" value={text} onChange={e => setText(e.target.value)} placeholder={mode === 'note' ? 'הוסיפו הערה…' : 'תיאור המשימה…'} />
        {mode === 'task' && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {DATE_PRESETS.map(p => { const v = p.get(); return (
                <Button key={p.label} size="sm" variant={due === v ? 'secondary' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setDue(v)}>{p.label}</Button>
              ) })}
              <Input className="h-7 w-36 text-xs" type="date" dir="ltr" value={due} onChange={e => setDue(e.target.value)} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">דחיפות:</span>
              {Object.entries(URGENCY).map(([k, u]) => (
                <Button key={k} size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setUrgency(k)}
                  style={urgency === k ? { background: u.color, color: '#fff', borderColor: u.color } : { color: u.color }}>{u.label}</Button>
              ))}
              <Select value={assignee || '__none__'} onValueChange={v => setAssignee(v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="מבצע…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא מבצע</SelectItem>
                  {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {mode === 'note' && (
            <label className="border-input hover:bg-accent inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors">
              <Icon name="link" size={13} /> {file ? file.name : 'צרף קובץ'}
              <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
            </label>
          )}
          <Button size="sm" className="ms-auto" onClick={mode === 'note' ? addNote : addTask} disabled={busy || !text.trim()}>
            {busy ? <span className="spinner light" style={{ width: 14, height: 14 }} /> : 'פרסם'}
          </Button>
        </div>
      </div>

      {openTasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {openTasks.map(t => (
            <div key={t.id} className="bg-muted/40 flex items-center gap-2 rounded-md border-s-4 p-2" style={{ borderInlineStartColor: URGENCY[t.urgency]?.color || 'var(--mp)' }}>
              <input type="checkbox" checked={false} onChange={() => toggleTask(t)} />
              <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 600 }}>{t.title}</span>
              {t.urgency && <span className="badge" style={{ background: URGENCY[t.urgency]?.color, color: '#fff' }}>{URGENCY[t.urgency]?.label}</span>}
              {t.assignee_user?.full_name && <span className="badge gray" style={{ fontSize: '0.68rem' }}>{t.assignee_user.full_name}</span>}
              {t.due_date && <span className="muted small">{new Date(t.due_date).toLocaleDateString('he-IL')}</span>}
            </div>
          ))}
        </div>
      )}

      {topNotes.length === 0 && tasks.filter(t => t.status === 'done').length === 0 ? <p className="text-muted-foreground py-6 text-center text-sm">אין פעילות עדיין</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
          {topNotes.map(n => (
            <div key={n.id} className="bg-muted/30 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Avatar className="size-6"><AvatarFallback className="bg-primary text-primary-foreground text-[0.6rem]">{(n.author_user?.full_name || '?').slice(0, 2)}</AvatarFallback></Avatar>
                <b style={{ color: 'var(--heading)', fontSize: '0.82rem' }}>{n.author_user?.full_name || 'נציג'}</b>
                <span className="text-muted-foreground text-xs">· {new Date(n.created_at).toLocaleString('he-IL')}</span>
                {(n.author === rep?.id || isManager) && <Button variant="ghost" size="icon" className="ms-auto size-6 text-[var(--err)]" onClick={() => delItem(n)}><Icon name="x" size={12} /></Button>}
              </div>
              {n.body && <div className="mt-1.5 text-sm whitespace-pre-wrap">{n.body}</div>}
              {n.file_url && <Attachment url={n.file_url} name={n.file_name} size={n.file_size} />}

              {repliesOf(n.id).map(r => (
                <div key={r.id} className="border-border mt-2 border-s-2 ps-3">
                  <div className="flex items-center gap-2">
                    <b className="text-[0.78rem]" style={{ color: 'var(--heading)' }}>{r.author_user?.full_name || 'נציג'}</b>
                    <span className="text-muted-foreground text-xs">· {new Date(r.created_at).toLocaleString('he-IL')}</span>
                    {(r.author === rep?.id || isManager) && <Button variant="ghost" size="icon" className="ms-auto size-5 text-[var(--err)]" onClick={() => delItem(r)}><Icon name="x" size={11} /></Button>}
                  </div>
                  <div className="mt-1 text-[0.82rem] whitespace-pre-wrap">{r.body}</div>
                </div>
              ))}

              {replyTo === n.id ? (
                <div className="border-border mt-2 space-y-2 border-s-2 ps-3">
                  <Textarea className="min-h-16 text-[0.82rem]" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="תגובה…" autoFocus />
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={busy || !replyText.trim()} onClick={() => addReply(n)}>שלח</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText('') }}>ביטול</Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="mt-1.5 h-7 px-2 text-xs" onClick={() => { setReplyTo(n.id); setReplyText('') }}><Icon name="reply" size={13} /> השב</Button>
              )}
            </div>
          ))}
        </div>
      )}
      </CardContent>
    </Card>
  )
}
