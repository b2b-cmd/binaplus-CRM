import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SCHEMA } from '../lib/schema'
import { toast } from './Toaster'
import Icon from './Icon'
import ActivityFeed from './ActivityFeed'
import CustomFields from './CustomFields'
import RecordFormModal from './RecordFormModal'

// Fireberry-style record shell: header (title/status/quick-actions/related-chips),
// optional stage bar, main field sections (children) + activity feed sidebar.
// related: [{ key, label, count, columns:[{label,get}], rows, onOpen }]
// actions: [{ icon, title, href?, onClick? }]
// stage: { stages:[{key,label}], current, onSet }
// recordType: schema key (enables dynamic related-create buttons + delete)
// record: the current row (used to inherit FK values into created children)
// onRelatedCreated: called after a linked record is created (e.g. reload)
export default function RecordLayout({ title, subtitle, status, backTo, actions = [], related = [], stage, objectType, recordId, table, recordType, record, onRelatedCreated, feed = true, children }) {
  const nav = useNavigate()
  const [openRel, setOpenRel] = useState(null)
  const [createRel, setCreateRel] = useState(null) // relation being created

  const def = recordType ? SCHEMA[recordType] : null
  const relations = def?.relations || []

  const del = async () => {
    if (!def) return
    // users are never hard-deleted (auth + FK integrity) - deactivate instead
    if (def.deactivate) {
      if (!confirm(`להשבית את ${def.labelOne} "${title}"? (ניתן להפעיל מחדש בכל עת)`)) return
      const { error } = await supabase.from(def.table).update({ active: false }).eq('id', recordId)
      if (error) return toast('ההשבתה נכשלה', 'err')
      toast('הושבת')
      return nav(backTo || def.listPath || '/')
    }
    if (!confirm(`למחוק ${def.labelOne} "${title}"? ${def.softDelete ? '(ניתן לשחזר מסל המיחזור)' : ''}`)) return
    if (def.softDelete) {
      const { error } = await supabase.from(def.table).update({ deleted_at: new Date().toISOString() }).eq('id', recordId)
      if (error) return toast('המחיקה נכשלה', 'err')
    } else {
      const { error } = await supabase.from(def.table).delete().eq('id', recordId)
      if (error) return toast('המחיקה נכשלה (ייתכן שיש רשומות מקושרות)', 'err')
    }
    toast('נמחק')
    nav(backTo || def.listPath || '/')
  }

  return (
    <div>
      <div className="rec-header">
        <div className="row" style={{ gap: 10 }}>
          {backTo && <button className="btn ghost sm" onClick={() => nav(backTo)}><Icon name="chevron" size={16} style={{ transform: 'scaleX(-1)' }} /></button>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rec-title">{title}</div>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          {status && <span className={`badge ${status.badge || 'gray'}`}>{status.label}</span>}
          {actions.map((a, i) => {
            const inner = <><Icon name={a.icon} size={15} /><span className="qa-label">{a.title}</span></>
            return a.href
              ? <a key={i} className="qa-btn" href={a.href} target="_blank" rel="noreferrer" title={a.title}>{inner}</a>
              : <button key={i} className="qa-btn" onClick={a.onClick} title={a.title}>{inner}</button>
          })}
          {def && <button className="qa-btn danger" onClick={del} title={`${def.deactivate ? 'השבת' : 'מחק'} ${def.labelOne}`}><Icon name={def.deactivate ? 'x' : 'trash'} size={15} /><span className="qa-label">{def.deactivate ? 'השבת' : 'מחק'}</span></button>}
        </div>

        {stage && (
          <div className="stage-bar">
            {stage.stages.map((s, i) => {
              const curIdx = stage.stages.findIndex(x => x.key === stage.current)
              const cls = s.key === stage.current ? 'current' : i < curIdx ? 'done' : ''
              return <div key={s.key} className={`stage ${cls}`} onClick={() => stage.onSet?.(s.key)}>{s.label}</div>
            })}
          </div>
        )}

        {(() => {
          // Show every defined connectivity (even count 0) so links are always discoverable.
          const withRows = related
          if (!withRows.length && !relations.length) return null
          return (
            <div className="rel-chips">
              {withRows.map(r => (
                <div key={r.key} className={`rel-chip ${openRel === r.key ? 'active' : ''}`} onClick={() => setOpenRel(openRel === r.key ? null : r.key)}>
                  {r.label} <span className="cnt">{r.count ?? (r.rows?.length || 0)}</span>
                </div>
              ))}
              {relations.map(rel => (
                <button key={rel.childType} className="rel-add" onClick={() => setCreateRel(rel)} title={`צור ${rel.label}`}>
                  <Icon name="plus" size={12} /> {rel.label}
                </button>
              ))}
            </div>
          )
        })()}
        {openRel && <RelatedPanel r={related.find(x => x.key === openRel)} nav={nav} />}
      </div>

      <div className="rec-grid" style={{ gridTemplateColumns: feed ? '1fr 1fr' : '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {children}
          {table && objectType && recordId && <CustomFields objectType={objectType} recordId={recordId} table={table} />}
        </div>
        {feed && <ActivityFeed objectType={objectType} recordId={recordId} />}
      </div>

      {createRel && (
        <RecordFormModal
          type={createRel.childType}
          defaults={buildInherit(createRel, record, recordId)}
          onClose={() => setCreateRel(null)}
          onCreated={(row) => { setCreateRel(null); onRelatedCreated ? onRelatedCreated(createRel.childType, row) : nav(SCHEMA[createRel.childType].detailPath?.(row.id) || backTo || '/') }}
        />
      )}
    </div>
  )
}

// Compose the child record's default values: the FK to this record + any inherited fields.
function buildInherit(rel, record, recordId) {
  const d = { [rel.fkOnChild]: recordId }
  if (rel.inherit && record) {
    for (const [parentField, childField] of Object.entries(rel.inherit)) {
      if (record[parentField] != null) d[childField] = record[parentField]
    }
  }
  return d
}

function RelatedPanel({ r, nav }) {
  if (!r) return null
  const rows = r.rows || []
  return (
    <div className="table-wrap" style={{ marginTop: 12 }}>
      {rows.length === 0 ? <div className="empty small">אין רשומות</div> : (
        <table className="grid">
          <thead><tr>{r.columns.map((c, i) => <th key={i}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className={r.onOpen ? 'clickable' : ''} onClick={() => r.onOpen && nav(r.onOpen(row))}>
                {r.columns.map((c, i) => <td key={i}>{c.get(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
