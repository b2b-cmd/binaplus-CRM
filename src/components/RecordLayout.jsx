import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SCHEMA } from '../lib/schema'
import { toast } from './Toaster'
import Icon from './Icon'
import ActivityFeed from './ActivityFeed'
import CustomFields from './CustomFields'
import RecordFormModal from './RecordFormModal'
import ResourceList from './ResourceList'
import { confirmDialog } from './Dialogs'

/* Each related object gets its own icon and hue, so the chips are
   distinguishable at a glance instead of nine identical pills.

   Both the short keys the detail pages actually use (opps/pay/tk/att) and the
   full resource names are mapped - keying only on the resource names meant
   almost every chip silently fell through to the default colour. */
const REL_STYLE = {
  orders: { icon: 'file', hue: 262 },
  opps: { icon: 'tag', hue: 199 }, opportunities: { icon: 'tag', hue: 199 },
  pay: { icon: 'money', hue: 152 }, payments: { icon: 'money', hue: 152 },
  tk: { icon: 'inbox', hue: 24 }, tickets: { icon: 'inbox', hue: 24 },
  att: { icon: 'calendar', hue: 340 }, attendance: { icon: 'calendar', hue: 340 },
  people: { icon: 'users', hue: 291 }, students: { icon: 'users', hue: 291 },
  lessons: { icon: 'book', hue: 219 },
  cycles: { icon: 'calendar', hue: 45 },
  modules: { icon: 'book', hue: 175 },
  products: { icon: 'grid', hue: 280 },
}
const relStyle = (key) => REL_STYLE[key] || { icon: 'grid', hue: 270 }

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
      if (!await confirmDialog(`להשבית את ${def.labelOne} "${title}"? (ניתן להפעיל מחדש בכל עת)`)) return
      const { error } = await supabase.from(def.table).update({ active: false }).eq('id', recordId)
      if (error) return toast('ההשבתה נכשלה', 'err')
      toast('הושבת')
      return nav(backTo || def.listPath || '/')
    }
    if (!await confirmDialog(`למחוק ${def.labelOne} "${title}"? ${def.softDelete ? '(ניתן לשחזר מסל המיחזור)' : ''}`)) return
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
          // Only relations that actually have records. An empty "הזמנות 0" on a
          // fresh lead is noise; creating one is still offered by the + pills.
          const withRows = related.filter(r => (r.count ?? r.rows?.length ?? 0) > 0)
          if (!withRows.length && !relations.length) return null
          return (
            <div className="rel-chips">
              {withRows.map(r => {
                const st = relStyle(r.key)
                const active = openRel === r.key
                return (
                  <div key={r.key} className={`rel-chip ${active ? 'active' : ''}`}
                    style={{
                      '--rel-h': st.hue,
                      background: `hsl(${st.hue} 78% ${active ? 86 : 94}%)`,
                      borderColor: `hsl(${st.hue} 60% ${active ? 52 : 74}%)`,
                      color: `hsl(${st.hue} 72% 27%)`,
                    }}
                    onClick={() => setOpenRel(active ? null : r.key)}>
                    <Icon name={st.icon} size={14} />
                    {r.label}
                    <span className="cnt" style={{ background: `hsl(${st.hue} 55% 42%)` }}>
                      {r.count ?? (r.rows?.length || 0)}
                    </span>
                  </div>
                )
              })}
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

  /* When the relation declares `resource` + `fk`, render the same ResourceList
     the standalone screens use. That gives the expanded panel selection
     checkboxes, bulk actions, column show/hide/reorder, sorting and filters -
     everything the plain read-only table lacked. */
  if (r.resource && r.fk && r.recordId) {
    /* Derive the list columns from the relation's existing `columns` config
       when the page has not supplied a richer one. That means every relation
       gets the full table without each of the nine detail pages having to
       restate its columns in a second format. Derived columns carry no
       `source`, so they are not sortable - a page can pass `listColumns`
       with sources when sorting matters. */
    const cols = r.listColumns || (r.columns || []).map((c, i) => ({
      source: c.source || `c${i}`,
      label: c.label,
      render: c.get,
      csv: c.get,
      sortable: false,
    }))
    return (
      <div className="mt-3">
        <ResourceList
          resource={r.resource}
          storeKey={`rel_${r.resource}`}
          filter={{ [r.fk]: r.recordId }}
          sort={r.sort || { field: 'created_at', order: 'DESC' }}
          perPage={r.perPage || 10}
          columns={cols}
          presets={r.presets}
          facets={r.facets}
          search={r.search ?? false}
          rowPath={r.onOpen}
          bulkActions={r.bulkActions}
          exportName={r.resource}
        />
      </div>
    )
  }

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
