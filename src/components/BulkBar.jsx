import Icon from './Icon'

// Floating bulk-action bar. actions: [{label, onClick, danger}]. selectEl: optional custom control node.
export default function BulkBar({ count, actions = [], onClear, children }) {
  if (!count) return null
  return (
    <div style={{ position: 'sticky', bottom: 16, zIndex: 30, display: 'flex', justifyContent: 'center', marginTop: 12 }}>
      <div className="row" style={{ background: 'var(--dp)', color: '#fff', borderRadius: 50, padding: '8px 16px', gap: 12, boxShadow: 'var(--sh3)' }}>
        <b>{count} נבחרו</b>
        {children}
        {actions.map((a, i) => (
          <button key={i} className="btn sm" style={{ background: a.danger ? 'var(--err)' : 'var(--g2)' }} onClick={a.onClick}>{a.label}</button>
        ))}
        <button className="qa-btn" style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: '#fff' }} onClick={onClear}><Icon name="x" size={16} /></button>
      </div>
    </div>
  )
}
