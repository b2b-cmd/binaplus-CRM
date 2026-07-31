import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListBase, useListContext } from 'ra-core'
import { DataTable } from './admin/data-table'
import { ColumnsButton } from './admin/columns-button'
import { exportCsv } from '../lib/export'
import Icon from './Icon'

/* ============================================================
   The single list framework every list screen sits on.

   Replaces the per-screen hand-rolled tables (useColumns + ColumnMenu +
   BulkBar + manual sort/filter), which is where the recurring gaps came
   from: each screen re-implemented a thinner version of the same thing.

   ra-core's ListBase supplies server-side pagination, sorting, filtering
   and selection; the ported DataTable supplies column show/hide/reorder
   (persisted per storeKey) and the bulk-actions toolbar. Screens now pass
   a column config instead of a table.
   ============================================================ */

function Toolbar({ presets, presetField, search, filtersUI, actions, columns, exportName }) {
  const { filterValues, setFilters, total, isPending, data } = useListContext()
  const [q, setQ] = useState(filterValues?.q || '')

  // Debounce the free-text box so typing does not fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = { ...filterValues }
      if (q) next.q = q; else delete next.q
      if ((filterValues?.q || '') !== q) setFilters(next, null, false)
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  // Compare by value, not identity: some presets carry array filters
  // (e.g. status@in: [...open statuses]) which never match by reference.
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const activePreset = presets?.find(p =>
    p.filter === undefined
      ? Object.keys(filterValues || {}).filter(k => k !== 'q').length === 0
      : same({ ...p.filter }, Object.fromEntries(Object.entries(filterValues || {}).filter(([k]) => k !== 'q'))))

  const setPreset = (p) => {
    const next = { ...(p.filter || {}) }
    if (filterValues?.q) next.q = filterValues.q
    setFilters(next, null, false)
  }

  const doExport = () => {
    if (!columns || !data?.length) return
    const cols = columns.filter(c => c.csv !== false)
    exportCsv(exportName, cols.map(c => c.label), data.map(r => cols.map(c => (c.csv ? c.csv(r) : r[c.source] ?? ''))))
  }

  return (
    <>
      <div className="toolbar">
        {presets?.map(p => (
          <button key={p.key} className={`chip ${activePreset?.key === p.key ? 'active' : ''}`} onClick={() => setPreset(p)}>
            {p.label}
          </button>
        ))}
        <div className="spacer" />
        <ColumnsButton />
        <button className="btn ghost sm" onClick={doExport}><Icon name="save" size={14} /> ייצוא</button>
        {actions}
      </div>
      <div className="toolbar">
        {search !== false && (
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={16} style={{ position: 'absolute', insetInlineStart: 10, top: 10, color: 'var(--text-3)' }} />
            <input className="input" style={{ paddingInlineStart: 32, width: 230 }}
              placeholder={search || 'חיפוש'} value={q} onChange={e => setQ(e.target.value)} />
          </div>
        )}
        {filtersUI}
        <div className="spacer" />
        <span className="muted small">{isPending ? '' : `${total ?? 0} רשומות`}</span>
      </div>
    </>
  )
}

function Pager() {
  const { page, setPage, total, perPage, isPending } = useListContext()
  const pages = Math.ceil((total || 0) / perPage)
  if (isPending || pages <= 1) return null
  return (
    <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 14 }}>
      <button className="btn subtle sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>הקודם</button>
      <span className="small muted">עמוד {page} מתוך {pages}</span>
      <button className="btn subtle sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>הבא</button>
    </div>
  )
}

function Body({ columns, rowPath, bulkActions }) {
  const { isPending, data } = useListContext()
  const nav = useNavigate()
  if (isPending) return <div className="empty"><span className="spinner" /></div>
  if (!data?.length) return <div className="card"><div className="empty">לא נמצאו רשומות.</div></div>
  return (
    <div className="table-wrap">
      <DataTable
        rowClick={rowPath ? (id, _r, record) => { nav(rowPath(record)); return false } : false}
        bulkActionButtons={bulkActions}
      >
        {columns.map(c => (
          <DataTable.Col key={c.source || c.label} source={c.sortable === false ? undefined : c.source}
            label={c.label} disableSort={c.sortable === false} render={c.render} />
        ))}
      </DataTable>
    </div>
  )
}

export default function ResourceList({
  resource, storeKey, sort, perPage = 50, filter, filterDefault, columns,
  presets, search, filtersUI, actions, rowPath, bulkActions, exportName,
}) {
  return (
    <ListBase resource={resource} sort={sort} perPage={perPage} filter={filter}
      filterDefaultValues={filterDefault} storeKey={storeKey || resource}>
      <Toolbar presets={presets} search={search} filtersUI={filtersUI} actions={actions}
        columns={columns} exportName={exportName || resource} />
      <Body columns={columns} rowPath={rowPath} bulkActions={bulkActions} />
      <Pager />
    </ListBase>
  )
}
