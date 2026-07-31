import logo from '../assets/bina-logo-t.png'

/* Real בינה+ wordmark on a transparent background. On dark surfaces it is
   rendered white (brightness/invert on the transparent artwork, no box); on
   light surfaces it keeps its native dark purple.

   alignSelf/flexShrink matter: inside a flex-column container (the sidebar
   header) the default `align-items: stretch` overrides `width: auto` and
   stretched the image to the container width, distorting the wordmark. */
export default function Logo({ size = 1.3, light = false }) {
  return (
    <img
      src={logo}
      alt="בינה+"
      style={{
        height: `${size * 1.05}rem`,
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        alignSelf: 'flex-start',
        flexShrink: 0,
        display: 'block',
        filter: light ? 'brightness(0) invert(1)' : 'none',
      }}
    />
  )
}
