import logo from '../assets/bina-logo-t.png'

// Real בינה+ wordmark on a transparent background. On dark surfaces we render it white
// (brightness/invert on the transparent artwork - no background box). On light surfaces
// it shows in its native dark purple.
export default function Logo({ size = 1.3, light = false }) {
  return (
    <img
      src={logo}
      alt="בינה+"
      style={{
        height: `${size * 1.05}rem`,
        width: 'auto',
        display: 'block',
        filter: light ? 'brightness(0) invert(1)' : 'none',
      }}
    />
  )
}
