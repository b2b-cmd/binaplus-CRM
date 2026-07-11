// Shared CSV parser (quotes, "" escapes, embedded newlines/commas).
import fs from 'fs'
export function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}
export function readCSV(path) { return parseCSV(fs.readFileSync(path, 'utf8')) }
// header → index map (first matching column wins)
export function headerIndex(header) {
  const m = {}
  header.forEach((h, i) => { const k = (h || '').trim(); if (k && !(k in m)) m[k] = i })
  return m
}
