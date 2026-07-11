import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { chipColor } from '../lib/constants'
import EditableCell from '../components/EditableCell'
import RecordFormModal from '../components/RecordFormModal'
import Icon from '../components/Icon'

export default function Modules() {
  const nav = useNavigate()
  const [mods, setMods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('modules')
      .select('id, number, name, title, module_products(product:products(name)), module_lecturers(user:users(full_name))')
      .order('number')
    setMods(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  const patchRow = (id) => (field, value) => setMods(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))

  return (
    <div>
      <div className="toolbar"><div className="spacer" /><button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> מודול חדש</button></div>
      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>#</th><th>מודול</th><th>כותרת</th><th>מוצרים</th><th>מרצים</th></tr></thead>
            <tbody>{mods.map(m => (
              <tr key={m.id} className="clickable" onClick={() => nav(`/modules/${m.id}`)}>
                <td onClick={e => e.stopPropagation()} className="small muted"><EditableCell row={m} table="modules" field="number" display={v => v || '-'} onSaved={patchRow(m.id)} /></td>
                <td onClick={e => e.stopPropagation()} style={{ fontWeight: 600 }}><EditableCell row={m} table="modules" field="name" display={v => v || '-'} onSaved={patchRow(m.id)} /></td>
                <td onClick={e => e.stopPropagation()} className="small"><EditableCell row={m} table="modules" field="title" display={v => v || '-'} onSaved={patchRow(m.id)} /></td>
                <td>{(m.module_products || []).map((p, i) => <span key={i} className="badge" style={{ ...chipColor(p.product?.name || ''), marginInlineEnd: 4 }}>{p.product?.name}</span>)}</td>
                <td className="small">{(m.module_lecturers || []).map(l => l.user?.full_name).filter(Boolean).join(', ') || '-'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {showNew && <RecordFormModal type="module" defaults={{ number: mods.length + 1 }} onClose={() => setShowNew(false)} onCreated={row => nav(`/modules/${row.id}`)} />}
    </div>
  )
}
