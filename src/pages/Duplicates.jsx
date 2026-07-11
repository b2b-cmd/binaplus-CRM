import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Icon from '../components/Icon'

const digits = s => (s || '').replace(/\D/g, '')

export default function Duplicates() {
  const nav = useNavigate()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const scan = async () => {
    setLoading(true)
    const { data } = await supabase.from('people').select('id, full_name, phone, email, created_at').is('deleted_at', null)
    const byKey = {}
    for (const p of data || []) {
      const keys = [digits(p.phone) && 'p:' + digits(p.phone), p.email && 'e:' + p.email.trim().toLowerCase()].filter(Boolean)
      for (const k of keys) (byKey[k] ||= []).push(p)
    }
    const seen = new Set(), gs = []
    for (const arr of Object.values(byKey)) {
      if (arr.length < 2) continue
      const ids = arr.map(x => x.id).sort().join(',')
      if (seen.has(ids)) continue; seen.add(ids)
      gs.push(arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
    }
    setGroups(gs); setLoading(false)
  }
  useEffect(() => { scan() }, [])

  const merge = async (group) => {
    if (!confirm(`למזג ${group.length} רשומות? הראשונה תישאר, השאר יאוחדו אליה.`)) return
    setBusy(group[0].id)
    const primary = group[0].id, dupes = group.slice(1).map(x => x.id)
    for (const tbl of ['tickets', 'orders', 'opportunities', 'payments']) {
      await supabase.from(tbl).update({ person_id: primary }).in('person_id', dupes)
    }
    await supabase.from('activities').update({ record_id: primary }).eq('object_type', 'people').in('record_id', dupes)
    await supabase.from('people').update({ deleted_at: new Date().toISOString() }).in('id', dupes)
    setBusy(null); scan()
  }

  if (loading) return <div className="empty"><span className="spinner" /></div>

  return (
    <div>
      <div className="toolbar"><div className="card-title" style={{ border: 'none', margin: 0 }}><Icon name="users" /> כפילויות ({groups.length})</div><div className="spacer" /><button className="btn ghost sm" onClick={scan}>סריקה מחדש</button></div>
      {groups.length === 0 ? <div className="card"><div className="empty">לא נמצאו כפילויות. המאגר נקי.</div></div>
        : groups.map((g, i) => (
          <div key={i} className="card" style={{ marginBottom: 12 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <b>{g.length} רשומות זהות</b><div className="spacer" />
              <button className="btn sm" disabled={busy === g[0].id} onClick={() => merge(g)}>{busy === g[0].id ? <span className="spinner light" style={{ width: 14, height: 14 }} /> : 'מזג'}</button>
            </div>
            {g.map((p, j) => (
              <div key={p.id} className="row small clickable" style={{ padding: '6px 8px', borderRadius: 8, background: j === 0 ? 'var(--xlp)' : 'var(--surface-2)', marginBottom: 4 }} onClick={() => nav(`/people/${p.id}`)}>
                {j === 0 && <span className="badge mp" style={{ fontSize: '0.62rem' }}>ראשי</span>}
                <b>{p.full_name}</b><span className="muted" dir="ltr">{p.phone}</span><span className="muted" dir="ltr">{p.email}</span>
              </div>
            ))}
          </div>
        ))}
    </div>
  )
}
