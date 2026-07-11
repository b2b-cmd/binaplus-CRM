import { Jimp } from 'jimp'

// Source: purple wordmark on BLACK. Key out black with a tight ramp so the wordmark is
// crisp/solid and only the thin stroke edges are anti-aliased. Background → fully transparent.
const img = await Jimp.read('src/assets/bina-logo.png')
const data = img.bitmap.data
const LO = 14, HI = 55 // lum <= LO → transparent, >= HI → opaque, between → smooth edge
for (let i = 0; i < data.length; i += 4) {
  const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  let a = lum <= LO ? 0 : lum >= HI ? 255 : Math.round((lum - LO) / (HI - LO) * 255)
  data[i + 3] = a
}
await img.write('src/assets/bina-logo-t.png')
console.log('wrote crisp transparent PNG', img.bitmap.width + 'x' + img.bitmap.height)
