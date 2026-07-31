import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '../ui/button'

/* Theme switch in the header. The app has always driven the theme from
   :root[data-theme], and theme-bridge.css retargets tailwind's `dark:`
   variant to that same attribute, so this one toggle drives both systems. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <Button variant="ghost" size="icon" className="size-9"
      onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
      title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
      aria-label={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}>
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
