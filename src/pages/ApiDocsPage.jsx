import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ApiDocs from '../components/ApiDocs'
import Icon from '../components/Icon'

// Dedicated full-page API documentation (Swagger-like). Loads the API keys so the
// in-page "try it" console can fire real requests. Key management stays in Settings → API.
export default function ApiDocsPage() {
  const [keys, setKeys] = useState([])
  const FUNCTIONS = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')

  useEffect(() => {
    supabase.from('api_keys').select('*').order('created_at', { ascending: false }).then(({ data }) => setKeys(data || []))
  }, [])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 16, background: 'var(--surface-2)' }}>
        <div className="row" style={{ gap: 10 }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--heading)' }}>REST API · לידים ופניות</div>
            <div className="muted small" style={{ marginTop: 4 }}>
              ממשק חיצוני ליצירה, עדכון, חיפוש ומחיקה של לידים ופניות. {keys.length === 0
                ? <>אין עדיין מפתחות. הפיקו מפתח ב<a href="#/settings">הגדרות ← API</a>.</>
                : <>יש {keys.filter(k => k.active).length} מפתחות פעילים. ניהול מפתחות ב<a href="#/settings">הגדרות ← API</a>.</>}
            </div>
          </div>
          <div className="spacer" />
          <a className="btn subtle sm" href="#/settings"><Icon name="cog" size={14} /> ניהול מפתחות</a>
        </div>
      </div>

      <ApiDocs base={FUNCTIONS} keys={keys} />
    </div>
  )
}
