import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { chipColor } from '../lib/constants'
import Icon from '../components/Icon'

const TYPE_BADGE = { 'חברתי': 'mp', 'העברת ידע': 'info', 'תרגול פרקטי': 'ok' }

export default function Lessons() {
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [product, setProduct] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: ls }, { data: pr }] = await Promise.all([
        supabase.from('lessons').select('id, number, name, type, lecturer_name, product_id, product:products(name), lesson_lecturers(user:users(full_name))').is('deleted_at', null).order('number'),
        supabase.from('products').select('id, name').order('name'),
      ])
      setRows(ls || []); setProducts(pr || [])
      if (pr?.length) setProduct(pr.find(p => /מפתחי/.test(p.name) && !/דיגיטלית/.test(p.name))?.id || pr[0].id)
      setLoading(false)
    })()
  }, [])

  const lectNames = r => (r.lesson_lecturers || []).map(x => x.user?.full_name).filter(Boolean)
  const filtered = useMemo(() => rows.filter(r => {
    if (product && r.product_id !== product) return false
    if (q && !`${r.name} ${lectNames(r).join(' ')} ${r.lecturer_name || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, product, q])

  return (
    <div>
      <div className="toolbar">
        {products.map(p => <button key={p.id} className={`chip ${product === p.id ? 'active' : ''}`} onClick={() => setProduct(p.id)}><span style={{ width: 8, height: 8, borderRadius: 8, background: chipColor(p.name).color, display: 'inline-block', marginInlineEnd: 6 }} />{p.name}</button>)}
        <div className="spacer" />
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={16} style={{ position: 'absolute', insetInlineStart: 10, top: 10, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingInlineStart: 32, width: 220 }} placeholder="חיפוש שיעור / מרצה" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <span className="muted small">{filtered.length} שיעורים</span>
      </div>

      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th style={{ width: 50 }}>#</th><th>שם המפגש</th><th>סוג</th><th>מרצה</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="clickable" onClick={() => nav(`/lessons/${r.id}`)}>
                  <td style={{ fontWeight: 700, color: 'var(--mp)' }}>{r.number}</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{r.type ? <span className={`badge ${TYPE_BADGE[r.type] || 'gray'}`}>{r.type}</span> : '-'}</td>
                  <td className="small">{lectNames(r).join(', ') || r.lecturer_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
