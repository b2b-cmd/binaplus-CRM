import { useEffect, useRef, useState } from 'react'
import { updateField } from '../lib/api'

/* Inline-editable table cell. mode: 'select' | 'text'.
   options: [{ value, label }] for select. onSaved(field, value) lets the caller
   refresh once the write lands.

   Both modes render the READ view until the cell is clicked. That matters:
   rendering a native <select> in every row put a dropdown chevron in every
   cell and threw away the `display` renderer, so status/product/cycle badges
   never appeared in a list. Now the badge shows, and the editor only opens
   on click. */
export default function EditableCell({ row, field, table = 'tickets', mode = 'text', options = [], display, placeholder, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const selectRef = useRef(null)
  const value = row[field]

  // Open the native picker as soon as the select mounts, so one click edits.
  useEffect(() => {
    if (editing && mode === 'select') selectRef.current?.focus()
  }, [editing, mode])

  const save = async (newVal) => {
    if (newVal === value || (newVal === '' && value == null)) { setEditing(false); return }
    setSaving(true)
    try {
      await updateField(table, row, field, newVal === '' ? null : newVal)
      onSaved?.(field, newVal === '' ? null : newVal)
    } catch { /* keep old */ } finally { setSaving(false); setEditing(false) }
  }

  if (editing && mode === 'select') {
    return (
      <select
        ref={selectRef}
        className="input" style={{ padding: '4px 8px', fontSize: '0.85rem', minWidth: 110, opacity: saving ? 0.5 : 1 }}
        value={value ?? ''} disabled={saving}
        onClick={e => e.stopPropagation()}
        onBlur={() => setEditing(false)}
        onChange={e => { e.stopPropagation(); save(e.target.value) }}
      >
        <option value="">-</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  if (editing) {
    return (
      <input
        className="input" style={{ padding: '4px 8px', fontSize: '0.85rem' }} autoFocus defaultValue={value ?? ''}
        onClick={e => e.stopPropagation()}
        onBlur={e => save(e.target.value.trim())}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }

  const shown = display ? display(value) : (value || <span className="muted">{placeholder || '-'}</span>)
  return (
    <span className="cell-edit" style={{ opacity: saving ? 0.5 : 1 }}
      onClick={e => { e.stopPropagation(); setEditing(true) }} title="לחצו לעריכה">
      {shown}
    </span>
  )
}
