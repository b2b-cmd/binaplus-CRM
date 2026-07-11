import Icon from './Icon'

// Minimal HTML sanitizer for displaying inbound email bodies.
function sanitize(html) {
  if (!html) return ''
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|title)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/ on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '$1="#"')
}

// Full email-style card for an email thread message (in or out).
export default function EmailMessage({ m }) {
  const out = m.direction === 'out'
  const atts = Array.isArray(m.attachments) ? m.attachments : []
  return (
    <div style={{ border: '1px solid var(--border-soft)', borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--sh1)' }}>
      <div style={{ background: out ? 'var(--xlp)' : 'var(--surface-2)', padding: '10px 14px', borderBottom: '1px solid var(--border-soft)' }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge mp" style={{ fontSize: '0.66rem' }}><Icon name="mail" size={11} /> {out ? 'נשלח' : 'התקבל'}</span>
          {m.email_subject && <b style={{ fontSize: '0.92rem' }}>{m.email_subject}</b>}
          <div className="spacer" />
          <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{new Date(m.received_at || m.created_at).toLocaleString('he-IL')}</span>
        </div>
        <div className="small muted" style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span><b>מאת:</b> {m.sender}</span>
          {m.email_to && <span dir="ltr" style={{ textAlign: 'start' }}><b style={{ direction: 'rtl', display: 'inline' }}>אל: </b>{m.email_to}</span>}
          {m.email_cc && <span dir="ltr" style={{ textAlign: 'start' }}><b style={{ direction: 'rtl', display: 'inline' }}>עותק: </b>{m.email_cc}</span>}
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        {m.body_html
          ? <div className="email-html" dangerouslySetInnerHTML={{ __html: sanitize(m.body_html) }} />
          : <div className="small" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.body}</div>}
        {atts.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
            {atts.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer" className="chip" style={{ textDecoration: 'none' }}>
                <Icon name="file" size={14} /> {a.name || 'קובץ'}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
