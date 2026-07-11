import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { clearOptionsCache } from '../lib/api'
import EditField from './EditField'
import Icon from './Icon'

const EMPTY = { label: '', key: '', type: 'text', options: '', width: 1 }

// Custom fields for a record: renders values (everyone) + lets managers define/position
// fields (add/delete/width/reorder) directly from the record screen - no Settings trip.
export default function CustomFields({ objectType, recordId, table }) {
  const isManager = useAuthStore(s => s.isManager)()
  const [defs, setDefs] = useState([])
  const [custom, setCustom] = useState({})
  const [ready, setReady] = useState(false)
  const [managing, setManaging] = useState(false)
  const [nf, setNf] = useState(EMPTY)

  const load = async () => {
    const [{ data: fields }, { data: rec }] = await Promise.all([
      supabase.from('custom_fields').select('*').eq('object_type', objectType).eq('active', true).order('position').order('created_at'),
      supabase.from(table).select('custom').eq('id', recordId).single(),
    ])
    setDefs(fields || []); setCustom(rec?.custom || {}); setReady(true)
  }
  useEffect(() => { load() }, [objectType, recordId, table])

  const save = async (key, value) => {
    const next = { ...custom, [key]: value }; setCustom(next)
    await supabase.from(table).update({ custom: next }).eq('id', recordId)
  }

  const addField = async () => {
    const key = (nf.key || nf.label).trim().replace(/\s+/g, '_')
    if (!nf.label.trim() || !key) return
    await supabase.from('custom_fields').insert({
      object_type: objectType, key, label: nf.label.trim(), type: nf.type,
      options: nf.type === 'select' ? nf.options.split(',').map(s => s.trim()).filter(Boolean) : [],
      width: nf.width, position: defs.length, active: true,
    })
    setNf(EMPTY); clearOptionsCache(); load()
  }
  const delField = async (id) => { if (confirm('למחוק שדה מותאם?')) { await supabase.from('custom_fields').delete().eq('id', id); load() } }
  const setWidth = async (id, width) => { await supabase.from('custom_fields').update({ width }).eq('id', id); load() }
  const move = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= defs.length) return
    const a = [...defs];[a[i], a[j]] = [a[j], a[i]]
    setDefs(a)
    await Promise.all(a.map((d, idx) => supabase.from('custom_fields').update({ position: idx }).eq('id', d.id)))
  }

  if (!ready) return null
  if (defs.length === 0 && !isManager) return null

  return (
    <div className="card">
      <div className="card-title"><Icon name="tag" /> שדות מותאמים
        {isManager && <><div className="spacer" />
          <button className="btn subtle sm" onClick={() => setManaging(m => !m)}><Icon name={managing ? 'x' : 'cog'} size={13} /> {managing ? 'סיום' : 'ניהול שדות'}</button>
        </>}
      </div>

      {defs.length === 0 ? <div className="empty small">אין שדות מותאמים{isManager ? ' - הוסיפו בעזרת "ניהול שדות"' : ''}</div> : (
        <div className="field-grid">
          {defs.map((d, i) => (
            <div key={d.id} style={{ gridColumn: d.width === 2 ? '1 / -1' : 'auto', position: 'relative' }}>
              <EditField label={d.label} value={custom[d.key]}
                type={d.type === 'select' ? 'select' : ['number', 'date', 'checkbox'].includes(d.type) ? d.type : 'text'}
                options={(d.options || []).map(o => ({ value: o, label: o }))}
                onSave={v => save(d.key, v)} />
              {managing && (
                <div className="row" style={{ gap: 4, marginTop: 4 }}>
                  <button className="btn subtle sm" style={{ padding: '2px 6px' }} onClick={() => move(i, -1)} title="הקדם">↑</button>
                  <button className="btn subtle sm" style={{ padding: '2px 6px' }} onClick={() => move(i, 1)} title="אחר">↓</button>
                  <button className="btn subtle sm" style={{ padding: '2px 6px' }} onClick={() => setWidth(d.id, d.width === 2 ? 1 : 2)} title="רוחב">{d.width === 2 ? 'חצי' : 'מלא'}</button>
                  <button className="btn subtle sm" style={{ padding: '2px 6px', color: 'var(--err)' }} onClick={() => delField(d.id)}><Icon name="trash" size={12} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {managing && (
        <div style={{ marginTop: 14, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--rs)', border: '1px dashed var(--border)' }}>
          <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>הוספת שדה חדש</div>
          <div className="field-grid">
            <div className="field" style={{ margin: 0 }}><label>שם השדה</label><input value={nf.label} onChange={e => setNf(f => ({ ...f, label: e.target.value }))} placeholder="לדוגמה: מקור מלגה" /></div>
            <div className="field" style={{ margin: 0 }}><label>סוג</label>
              <select value={nf.type} onChange={e => setNf(f => ({ ...f, type: e.target.value }))}>
                <option value="text">טקסט</option><option value="number">מספר</option><option value="date">תאריך</option><option value="checkbox">כן/לא</option><option value="select">רשימה</option>
              </select>
            </div>
            {nf.type === 'select' && <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}><label>ערכי הרשימה (מופרדים בפסיק)</label><input value={nf.options} onChange={e => setNf(f => ({ ...f, options: e.target.value }))} placeholder="ערך 1, ערך 2, ערך 3" /></div>}
            <div className="field" style={{ margin: 0 }}><label>רוחב</label>
              <select value={nf.width} onChange={e => setNf(f => ({ ...f, width: +e.target.value }))}><option value={1}>חצי</option><option value={2}>מלא</option></select>
            </div>
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={addField} disabled={!nf.label.trim()}><Icon name="plus" size={14} /> הוסף שדה</button>
        </div>
      )}
    </div>
  )
}
