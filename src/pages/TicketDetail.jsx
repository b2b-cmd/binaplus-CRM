import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField, loadOptions } from '../lib/api'
import { draftReply } from '../lib/ai'
import { sendEmailReply } from '../lib/email'
import { toast } from '../components/Toaster'
import { useAuthStore } from '../stores/authStore'
import { TICKET_STATUS, URGENCY, CHANNEL, TICKET_TYPES } from '../lib/constants'
import CloudChatEmbed from '../components/CloudChatEmbed'
import EmailMessage from '../components/EmailMessage'
import ReplyComposer from '../components/ReplyComposer'
import Modal from '../components/Modal'
import Icon from '../components/Icon'

const SELECT = '*, person:people(*), module:modules(name), cycle:cycles(name), assignee:users!tickets_assigned_rep_fkey(full_name)'

export default function TicketDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const [t, setT] = useState(null)
  const [messages, setMessages] = useState([])
  const [prior, setPrior] = useState([])
  const [opts, setOpts] = useState({ reps: [], modules: [] })
  const [loading, setLoading] = useState(true)
  const [bullets, setBullets] = useState('')
  const [notes, setNotes] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState('')
  const [aiDraft, setAiDraft] = useState('')     // AI suggestion - lives in its OWN panel
  const [sending, setSending] = useState(false)
  const composerApi = useRef({})                 // imperative handle into ReplyComposer
  const [kb, setKb] = useState([])
  const [askStatus, setAskStatus] = useState(false)   // post-reply "update status?" prompt

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('tickets').select(SELECT).eq('id', id).single()
      setT(data); setNotes(data?.internal_notes || '')
      const [{ data: msgs }, o, { data: kbItems }] = await Promise.all([
        supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at'),
        loadOptions(),
        supabase.from('knowledge_base').select('id, topic, question, answer, module_id').order('updated_at', { ascending: false }).limit(40),
      ])
      setMessages(msgs || []); setOpts(o)
      // module-relevant entries first
      setKb((kbItems || []).sort((a, b) => (b.module_id === data?.module_id ? 1 : 0) - (a.module_id === data?.module_id ? 1 : 0)))
      if (data?.person_id) {
        const { data: pr } = await supabase.from('tickets').select('id, summary, status, created_at').eq('person_id', data.person_id).neq('id', id).order('created_at', { ascending: false })
        setPrior(pr || [])
      }
      setLoading(false)
    })()
  }, [id])

  const patch = async (field, value) => { setT(p => ({ ...p, [field]: value })); await updateField('tickets', t, field, value) }

  const saveNotes = async () => { if (notes !== (t.internal_notes || '')) await patch('internal_notes', notes) }

  const runAI = async (mode) => {
    setAiBusy(true); setAiMsg('')
    try {
      const { draft } = await draftReply({ ticket: t, person: t.person, messages, bullets, mode })
      setAiDraft(draft)   // suggestion only - does NOT touch what the rep wrote in "מענה"
    } catch (e) {
      setAiMsg(e.notDeployed
        ? 'סוכן ה-AI יופעל לאחר פריסת ה-Edge Function ומפתח Anthropic (ראו הגדרות).'
        : 'שגיאה בקבלת טיוטה מה-AI.')
    } finally { setAiBusy(false) }
  }

  const reloadMessages = async () => { const { data } = await supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at'); setMessages(data || []) }

  // payload from ReplyComposer: { html, text, files, sendAt }. Returns true on success (composer clears), false to keep.
  const send = async ({ html, text, files: pending = [], sendAt }) => {
    if (!text?.trim() && pending.length === 0) return false
    const emailChannel = t.channel === 'email'
    if (emailChannel && !t.person?.email) { toast('לתלמיד אין כתובת מייל - לא ניתן לשלוח/לתזמן מייל', 'err'); return false }
    if (sendAt && !emailChannel) { toast('תזמון שליחה זמין לפניות מייל בלבד', 'err'); return false }
    setSending(true)
    const subject = 'Re: ' + (t.summary || 'פנייתך לבינה+')
    try {
      // upload files → public URLs (bucket is public so Gmail/Apps-Script can fetch them)
      const uploaded = []
      let ai = 0
      for (const f of pending) {
        const ext = (f.name.match(/\.[a-z0-9]{1,8}$/i) || [''])[0]
        const path = `email/${id}/${Date.now()}_${ai++}${ext}`
        const { error } = await supabase.storage.from('attachments').upload(path, f)
        if (error) throw new Error('העלאת קובץ נכשלה')
        uploaded.push({ name: f.name, url: supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl })
      }
      const filesNote = uploaded.length ? ` (${uploaded.length} קבצים)` : ''

      if (sendAt) {
        await supabase.from('outbox').insert({ ticket_id: id, to_email: t.person.email, subject, body: text, body_html: html, thread_ref: t.source_ref, attachments: uploaded, send_at: sendAt, created_by: rep?.id })
        await supabase.from('ticket_messages').insert({ ticket_id: id, direction: 'out', channel: t.channel, sender: rep?.full_name || 'צוות בינה+', body: text, body_html: html, email_subject: subject, email_to: t.person.email, attachments: uploaded, scheduled: true })
        toast(`המייל תוזמן ל-${new Date(sendAt).toLocaleString('he-IL')}${filesNote}`)
      } else {
        if (emailChannel) await sendEmailReply({ to: t.person.email, subject, body: text, htmlBody: html, threadId: t.source_ref, attachments: uploaded })
        await supabase.from('ticket_messages').insert({ ticket_id: id, direction: 'out', channel: t.channel, sender: rep?.full_name || 'צוות בינה+', body: text, body_html: html, email_subject: emailChannel ? subject : null, email_to: emailChannel ? t.person?.email : null, attachments: uploaded })
        const upd = { handled_by: 'human' }
        if (!t.first_response_at) upd.first_response_at = new Date().toISOString()
        for (const [k, v] of Object.entries(upd)) await patch(k, v)
        toast(`המענה נשלח${filesNote}`)
        setAskStatus(true)
      }
      await reloadMessages()
      return true
    } catch (e) {
      toast(e.pending ? 'המייל יישלח לאחר חיבור ה-Apps Script (ראו הגדרות)' : `השליחה נכשלה: ${e.message || ''}`, 'err')
      return false
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!t) return <div className="card"><div className="empty">הפנייה לא נמצאה.</div></div>

  const repOpts = opts.reps
  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn ghost sm" onClick={() => nav('/tickets')}><Icon name="chevron" size={16} style={{ transform: 'scaleX(-1)' }} /> חזרה</button>
        <div className="spacer" />
        <span className={`badge ${CHANNEL[t.channel] ? 'mp' : 'gray'}`}><Icon name={CHANNEL[t.channel]?.icon || 'edit'} size={12} /> {CHANNEL[t.channel]?.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 330px', gap: 16, alignItems: 'start' }}>
        {/* MAIN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ticket meta */}
          <div className="card">
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <Select label="סטטוס" value={t.status} onChange={v => patch('status', v)} options={Object.entries(TICKET_STATUS).map(([k, v]) => [k, v.label])} />
              <Select label="דחיפות" value={t.urgency} onChange={v => patch('urgency', v)} options={Object.entries(URGENCY).map(([k, v]) => [k, v.label])} />
              <Select label="סוג פנייה" value={t.type || ''} onChange={v => patch('type', v)} options={TICKET_TYPES.map(x => [x, x])} />
              <Select label="נציג מטפל" value={t.assigned_rep || ''} onChange={v => patch('assigned_rep', v)} options={repOpts.map(r => [r.id, r.full_name])} />
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="muted small">מודול: {t.module?.name || '-'} · מחזור: {t.cycle?.name || '-'}</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 6 }}>{t.summary || 'ללא נושא'}</div>
              {t.description && <p className="muted" style={{ marginTop: 6 }}>{t.description}</p>}
            </div>
          </div>

          {/* conversation */}
          <div className="card">
            <div className="card-title"><Icon name="inbox" /> השיחה המלאה</div>
            {messages.length === 0 ? <div className="empty small">אין הודעות עדיין</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map(m => (
                  m.channel === 'email'
                    ? <div key={m.id}>
                        {m.scheduled && <span className="badge warn" style={{ marginBottom: 6 }}><Icon name="calendar" size={11} /> מתוזמן לשליחה</span>}
                        <EmailMessage m={m} subject={m.email_subject || t.summary} />
                      </div>
                    : <div key={m.id} style={{ alignSelf: m.direction === 'out' ? 'flex-start' : 'flex-end', maxWidth: '80%' }}>
                        <div style={{ background: m.direction === 'out' ? 'var(--xlp)' : 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '9px 13px' }}>
                          <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                          {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {m.attachments.map((a, i) => <a key={i} className="chip" href={a.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><Icon name="file" size={12} /> {a.name}</a>)}
                            </div>
                          )}
                        </div>
                        <div className="small muted" style={{ marginTop: 3, textAlign: m.direction === 'out' ? 'start' : 'end' }}>{m.sender}{m.ai_generated ? ' · AI' : ''} · {new Date(m.created_at).toLocaleString('he-IL')}</div>
                      </div>
                ))}
              </div>
            )}
          </div>

          {/* AI assistant */}
          <div className="card" style={{ borderColor: 'var(--lp)' }}>
            <div className="card-title"><Icon name="sparkles" /> סוכן AI - הצעת מענה (בינה)</div>
            <div className="field" style={{ margin: 0 }}>
              <label>נקודות עיקריות מהמרצה (אופציונלי) - ה-AI ינסח מהן תשובה מלאה</label>
              <textarea value={bullets} onChange={e => setBullets(e.target.value)} placeholder={'לדוגמה:\n- לאפס סיסמה בפורטל\n- לשלוח קישור התחברות מחדש'} style={{ minHeight: 70 }} />
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" disabled={aiBusy} onClick={() => runAI('suggest')}>{aiBusy ? <span className="spinner light" style={{ width: 16, height: 16 }} /> : <><Icon name="sparkles" size={15} /> הצע תשובה</>}</button>
              <button className="btn ghost sm" disabled={aiBusy || !bullets.trim()} onClick={() => runAI('expand')}>הרחב נקודות לתשובה</button>
              {aiMsg && <span className="small" style={{ color: 'var(--warn)' }}>{aiMsg}</span>}
            </div>
            {aiDraft && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', border: '1px dashed var(--lp)', borderRadius: 'var(--rs)' }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="small" style={{ fontWeight: 700 }}>הצעת מענה מ-AI</span>
                  <div className="spacer" />
                  <button className="btn subtle sm" onClick={() => { composerApi.current?.insert?.(aiDraft.replace(/\n/g, '<br>')); toast('ההצעה הוכנסה למענה') }}>הכנס למענה</button>
                  <button className="btn subtle sm" onClick={() => { navigator.clipboard?.writeText(aiDraft); toast('הועתק') }}>העתק</button>
                  <button className="btn subtle sm" style={{ padding: '4px 8px' }} onClick={() => setAiDraft('')} title="נקה"><Icon name="x" size={13} /></button>
                </div>
                <div className="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 220, overflow: 'auto' }}>{aiDraft}</div>
              </div>
            )}
          </div>

          {/* reply */}
          <div className="card">
            <div className="card-title"><Icon name="mail" /> מענה לפנייה - {CHANNEL[t.channel]?.label || 'תלמיד'}</div>
            <ReplyComposer channel={t.channel} kb={kb} sending={sending} onSend={send} editorApi={composerApi} />
            <div className="row" style={{ marginTop: 8 }}>
              <span className="muted small">המענה יישלח בערוץ המקורי.</span>
            </div>
          </div>

          {/* customer feedback (CSAT) */}
          {t.status === 'closed' && (
            <div className="card">
              <div className="card-title"><Icon name="users" /> משוב תלמיד</div>
              <div className="row wrap" style={{ gap: 12 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="small muted">ציון שביעות רצון:</span>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => patch('csat_score', n)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid var(--border)', cursor: 'pointer', fontWeight: 700, background: t.csat_score === n ? 'var(--g2)' : 'var(--surface)', color: t.csat_score === n ? '#fff' : 'var(--text-2)' }}>{n}</button>
                  ))}
                </div>
                <div className="spacer" />
                {t.person?.phone && (
                  <a className="btn ghost sm" target="_blank" rel="noreferrer"
                    href={`https://wa.me/972${t.person.phone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(`היי ${t.person.full_name?.split(' ')[0] || ''}, כאן צוות בינה+. נשמח לדעת איך היה הטיפול בפנייה שלך - בדירוג של 1 עד 5. תודה רבה!`)}`}>
                    <Icon name="message" size={14} /> בקש משוב בוואטסאפ
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SIDE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title"><Icon name="users" /> פרטי תלמיד</div>
            <Detail label="שם" value={t.person?.full_name} />
            <Detail label="טלפון" value={t.person?.phone} ltr />
            <Detail label="מייל" value={t.person?.email} ltr />
            <Detail label="מחזור" value={t.cycle?.name} />
            <Detail label="סטטוס מכירתי" value={t.person?.sales_status} />
            {t.person?.id && <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => nav(`/people/${t.person.id}`)}>לכרטיס התלמיד</button>}
            {t.person?.cloudchat_id && <div style={{ marginTop: 8 }}><CloudChatEmbed cloudchatId={t.person.cloudchat_id} compact /></div>}
          </div>

          <div className="card">
            <div className="card-title"><Icon name="inbox" /> פניות קודמות</div>
            {prior.length === 0 ? <div className="empty small">אין פניות קודמות</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {prior.map(p => (
                  <div key={p.id} className="row" style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: 8, background: 'var(--surface-2)' }} onClick={() => nav(`/tickets/${p.id}`)}>
                    <span className={`badge ${TICKET_STATUS[p.status]?.badge || 'gray'}`} style={{ fontSize: '0.68rem' }}>{TICKET_STATUS[p.status]?.label}</span>
                    <span className="small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.summary || '-'}</span>
                    <span className="small muted">{new Date(p.created_at).toLocaleDateString('he-IL')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title"><Icon name="book" /> הערות פנימיות</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} placeholder="הערות לצוות (לא נשלח לתלמיד)…" style={{ minHeight: 90 }} />
          </div>
        </div>
      </div>

      {askStatus && (
        <Modal title="מה לעשות עם סטטוס הפנייה?" icon="inbox" onClose={() => setAskStatus(false)} maxWidth={420}>
          <p className="muted small" style={{ marginTop: -6, marginBottom: 14 }}>המענה נשלח. תרצו לעדכן את סטטוס הפנייה?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(TICKET_STATUS).filter(([k]) => k !== t.status).map(([k, v]) => (
              <button key={k} className="btn ghost block" onClick={() => { patch('status', k); setAskStatus(false) }}>
                עדכן ל{v.label}
              </button>
            ))}
            <button className="btn subtle block" onClick={() => setAskStatus(false)}>כלום (השאר {TICKET_STATUS[t.status]?.label})</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div className="field" style={{ margin: 0, minWidth: 130 }}>
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">-</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}
function Detail({ label, value, ltr }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span className="small muted">{label}</span>
      <span className="small" style={{ fontWeight: 600, direction: ltr ? 'ltr' : 'rtl' }}>{value || '-'}</span>
    </div>
  )
}
