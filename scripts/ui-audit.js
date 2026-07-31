/* ============================================================
   UI defect scanner.

   Exists because visual regressions kept shipping: DOM-level checks ("the
   element is there, the count is right") pass happily while the rendered UI
   is broken. This walks the live DOM and reports objective, reproducible
   defects instead of relying on eyeballing a screenshot.

   Usage: paste the body of `audit()` into the page (the SPA uses hash
   routing, so it survives navigation) and call window.__audit() per route.
   Returns { route, viewport, theme, counts, defects[] }.
   ============================================================ */

window.__audit = function () {
  const defects = []
  const add = (type, el, detail) => defects.push({
    type,
    tag: el.tagName.toLowerCase(),
    text: (el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40),
    cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
    detail,
  })

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    // sr-only text is clipped to a 1px box and is never seen, so judging its
    // contrast produced a false failure on every screen (the sidebar trigger's
    // "Toggle Sidebar" label reported 1.14:1).
    if (/inset\(50%\)/.test(cs.clipPath) || el.closest('.sr-only')) return false
    return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
  }

  // 1. Buttons whose label touches the edges
  document.querySelectorAll('button, [role="button"], a.btn').forEach(el => {
    if (!visible(el)) return
    const cs = getComputedStyle(el)
    const ps = parseFloat(cs.paddingInlineStart) || 0
    const pe = parseFloat(cs.paddingInlineEnd) || 0
    // sr-only labels are not visible text, so an icon-only control that
    // carries one (e.g. the sidebar trigger) must not count as "has a label".
    const srOnly = el.querySelector('.sr-only')
    const label = ((el.innerText || '').replace(srOnly?.textContent || '', '')).trim()
    // Icon-only controls legitimately have little padding. So do buttons that
    // wrap an already-padded child (e.g. a badge used as a toggle) - the
    // child supplies the breathing room, so this is not a defect.
    const paddedChild = [...el.children].some(c => {
      const cc = getComputedStyle(c)
      return (parseFloat(cc.paddingInlineStart) || 0) >= 6
    })
    if (label.length > 1 && !paddedChild && (ps < 8 || pe < 8)) {
      add('button-no-padding', el, `padding-inline ${ps}/${pe}px`)
    }
  })

  // 2. Tap targets that are too small to hit reliably
  document.querySelectorAll('button, [role="button"], a, input, select, [role="checkbox"], [role="switch"]').forEach(el => {
    if (!visible(el)) return
    const r = el.getBoundingClientRect()
    if (r.height < 28 || r.width < 20) add('tap-target-small', el, `${Math.round(r.width)}x${Math.round(r.height)}`)
  })

  // 3. Horizontal overflow (content wider than its container)
  document.querySelectorAll('div, section, main, header, aside, table').forEach(el => {
    if (!visible(el)) return
    const cs = getComputedStyle(el)
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') return
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      add('overflow-x', el, `scroll ${el.scrollWidth} > client ${el.clientWidth}`)
    }
  })

  // 4. Text clipped by its own box
  document.querySelectorAll('span, p, h1, h2, h3, td, th, label, div').forEach(el => {
    if (!visible(el) || el.children.length) return
    const cs = getComputedStyle(el)
    if (cs.textOverflow === 'ellipsis' || cs.overflow !== 'visible') return
    if (el.scrollWidth > el.clientWidth + 2 && (el.innerText || '').trim().length > 2) {
      add('text-clipped', el, `${el.scrollWidth} > ${el.clientWidth}`)
    }
  })

  // 5. Controls that visually collide with the next control
  const controls = [...document.querySelectorAll('button, input, select, [role="button"]')].filter(visible)
  for (let i = 0; i < controls.length; i++) {
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j]
      if (a.contains(b) || b.contains(a)) continue
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
      if (ox > 2 && oy > 2) { add('overlap', a, `overlaps <${b.tagName.toLowerCase()}> by ${Math.round(ox)}x${Math.round(oy)}px`); break }
    }
  }

  // 6. Contrast (approximate: element colour vs nearest opaque ancestor background)
  /* Resolve any CSS colour to RGB by painting it on a 1x1 canvas.
     Naive regex parsing cannot handle the modern colour functions tailwind
     emits for opacity utilities - `oklab(0.97 0.005 -0.007 / 0.6)` parsed as
     if it were rgb() reported a 16:1 heading as 1.23:1, i.e. the scanner
     invented contrast failures. Painting composites alpha correctly too. */
  const cv = document.createElement('canvas'); cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const toRGB = (col, under) => {
    try {
      cx.clearRect(0, 0, 1, 1)
      if (under) { cx.fillStyle = under; cx.fillRect(0, 0, 1, 1) }
      cx.fillStyle = col; cx.fillRect(0, 0, 1, 1)
      const d = cx.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2]]
    } catch { return null }
  }
  const lum = (c, under) => {
    const rgb = toRGB(c, under); if (!rgb) return null
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
  }
  const bgOf = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n)
      // A gradient background has no single colour to compare against. Walking
      // past it found the card underneath and compared white-on-white, i.e.
      // reported every gradient button as exactly 1.00:1.
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      const bg = cs.backgroundColor
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg
      n = n.parentElement
    }
    return getComputedStyle(document.body).backgroundColor
  }
  document.querySelectorAll('span, p, td, th, label, a, button, h1, h2, h3').forEach(el => {
    if (!visible(el) || el.children.length) return
    const txt = (el.innerText || '').trim(); if (txt.length < 3) return
    const cs = getComputedStyle(el)
    const bg = bgOf(el)
    if (!bg) return // gradient-backed: not measurable
    const l1 = lum(cs.color, bg), l2 = lum(bg, 'rgb(255,255,255)')
    if (l1 == null || l2 == null) return
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700
    const min = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5
    if (ratio < min) add('low-contrast', el, `${ratio.toFixed(2)}:1 (needs ${min})`)
  })

  // 7. Inputs with no accessible name
  document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => {
    if (!visible(el)) return
    const named = el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
      el.getAttribute('placeholder') || el.closest('label')
    if (!named) add('input-unlabelled', el, el.name || el.id || '(anonymous)')
  })

  // 8. Legacy design-system classes still rendered
  const LEGACY = ['btn', 'card', 'card-title', 'chip', 'badge', 'field', 'field-grid', 'toolbar', 'row',
    'spacer', 'small', 'muted', 'empty', 'spinner', 'input', 'table-wrap', 'grid', 'qa-btn', 'rel-chip',
    'stage', 'ef', 'ef-label', 'ef-val', 'kpi', 'nav-item', 'sidebar', 'topbar', 'content', 'main', 'app']
  const legacyCount = {}
  document.querySelectorAll('[class]').forEach(el => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/) : []
    cls.forEach(c => { if (LEGACY.includes(c)) legacyCount[c] = (legacyCount[c] || 0) + 1 })
  })

  const byType = {}
  defects.forEach(d => { byType[d.type] = (byType[d.type] || 0) + 1 })

  return {
    route: location.hash || '/',
    viewport: `${innerWidth}x${innerHeight}`,
    theme: document.documentElement.dataset.theme || 'light',
    total: defects.length,
    byType,
    legacyClasses: legacyCount,
    defects: defects.slice(0, 40),
  }
}
'audit installed'
