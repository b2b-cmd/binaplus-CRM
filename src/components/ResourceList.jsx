import { useNavigate } from 'react-router-dom'
import { ListBase, useListContext } from 'ra-core'
import { Download } from 'lucide-react'
import { DataTable } from './admin/data-table'
import { Button } from './ui/button'
import Toolbar from './list/Toolbar'
import Pagination from './list/Pagination'
import { exportCsv } from '../lib/export'

/* ============================================================
   The single list framework every list screen sits on.

   Replaces the per-screen hand-rolled tables (useColumns + ColumnMenu +
   BulkBar + manual sort/filter), which is where the recurring gaps came
   from: each screen re-implemented a thinner version of the same thing.

   ra-core's ListBase supplies server-side pagination, sorting, filtering
   and selection. The chrome (toolbar, faceted filters, paginator) follows
   satnaing/shadcn-admin (MIT) so the whole app reads as one design system
   rather than our old CSS wrapped around a shadcn table.

   Screens pass a column config instead of a table:
     columns:  [{ source, label, render, csv, sortable }]
     presets:  [{ key, label, filter }]      quick tabs
     facets:   [{ field, title, options }]   multi-select popovers
   ============================================================ */

function ExportButton({ columns, name }) {
  const { data } = useListContext()
  const disabled = !data?.length
  return (
    <Button variant="outline" size="sm" className="h-9" disabled={disabled} onClick={() => {
      const cols = columns.filter(c => c.csv !== false)
      exportCsv(name, cols.map(c => c.label),
        data.map(r => cols.map(c => (c.csv ? c.csv(r) : r[c.source] ?? ''))))
    }}>
      <Download className="size-4" /> ייצוא
    </Button>
  )
}

function Body({ columns, rowPath, bulkActions }) {
  const { isPending, data } = useListContext()
  const nav = useNavigate()

  if (isPending) return <div className="empty"><span className="spinner" /></div>
  if (!data?.length) return <div className="card"><div className="empty">לא נמצאו רשומות.</div></div>

  return (
    // DataTable renders its own rounded/bordered container, so it is styled
    // directly here rather than nested in .table-wrap (which drew a second
    // border around it).
    <div className="rl-table min-w-0">
      <DataTable
        rowClick={rowPath ? (id, _r, record) => { nav(rowPath(record)); return false } : false}
        bulkActionButtons={bulkActions}
        /* Columns flagged `hidden` are declared but off by default, which is
           what makes them ADDABLE from the columns menu - the selector can only
           offer columns the table knows about. */
        hiddenColumns={columns.filter(c => c.hidden).map(c => c.source || c.label)}
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
  presets, facets, search, extra, actions, rowPath, bulkActions, exportName,
}) {
  return (
    <ListBase resource={resource} sort={sort} perPage={perPage} filter={filter}
      filterDefaultValues={filterDefault} storeKey={storeKey || resource}>
      <Toolbar
        presets={presets} facets={facets} search={search} extra={extra}
        actions={<><ExportButton columns={columns} name={exportName || resource} />{actions}</>}
      />
      <Body columns={columns} rowPath={rowPath} bulkActions={bulkActions} />
      <Pagination />
    </ListBase>
  )
}
