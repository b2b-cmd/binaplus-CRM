import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { chipColor } from '../lib/constants'
import ResourceList from '../components/ResourceList'

const TYPE_BADGE = { 'חברתי': 'mp', 'העברת ידע': 'info', 'תרגול פרקטי': 'ok' }
const lectNames = r => (r.lesson_lecturers || []).map(x => x.user?.full_name).filter(Boolean)

export default function Lessons() {
  const [products, setProducts] = useState([])

  useEffect(() => {
    supabase.from('products').select('id, name').order('name').then(({ data }) => setProducts(data || []))
  }, [])

  const columns = [
    { source: 'number', label: '#', csv: r => r.number,
      render: r => <span style={{ fontWeight: 700, color: 'var(--mp)' }}>{r.number}</span> },
    { source: 'name', label: 'שם המפגש', csv: r => r.name,
      render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { source: 'type', label: 'סוג', csv: r => r.type,
      render: r => r.type ? <span className={`badge ${TYPE_BADGE[r.type] || 'gray'}`}>{r.type}</span> : '-' },
    { source: 'lecturer_name', label: 'מרצה', csv: r => lectNames(r).join(', ') || r.lecturer_name,
      render: r => <span className="small">{lectNames(r).join(', ') || r.lecturer_name || '-'}</span> },
  ]

  // Products act as the preset row, matching how the screen worked before.
  const presets = [
    { key: 'all', label: 'כל ההכשרות' },
    ...products.map(p => ({ key: p.id, label: p.name, filter: { product_id: p.id } })),
  ]

  return (
    <ResourceList
      resource="lessons" storeKey="lsn" exportName="lessons"
      sort={{ field: 'number', order: 'ASC' }}
      columns={columns} presets={presets}
      search="חיפוש שיעור / תוכן"
      rowPath={r => `/lessons/${r.id}`}
    />
  )
}
