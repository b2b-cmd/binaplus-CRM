import Icon from './Icon'

// Embeds the CloudChat inbox for a subscriber. If framing is blocked, the link still works.
export default function CloudChatEmbed({ cloudchatId, compact }) {
  if (!cloudchatId) return compact ? null : <div className="empty small">אין שיחת CloudChat מקושרת</div>
  const url = `https://console.thecloud.chat/inbox/${cloudchatId}`
  return (
    <div>
      <a className="btn ghost sm block" href={url} target="_blank" rel="noreferrer" style={{ marginBottom: 8 }}>
        <Icon name="link" size={14} /> פתח שיחה ב-CloudChat
      </a>
      {!compact && (
        <iframe src={url} title="CloudChat" style={{ width: '100%', height: 380, border: '1px solid var(--border-soft)', borderRadius: 'var(--rs)' }} />
      )}
    </div>
  )
}
