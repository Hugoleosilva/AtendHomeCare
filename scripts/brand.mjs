// Gera a partir de assets-src/logo-original.jpg: logo transparente (claro/escuro) e ícones do PWA.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const src = 'assets-src/logo-original.jpg'
mkdirSync('public/icons', { recursive: true })
mkdirSync('public/images', { recursive: true })

async function transparent(input, { lightenGray }) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const m = Math.min(r, g, b)
    // fundo branco -> transparente; cores originais ficam opacas (rampa curta só na borda)
    const a = m >= 250 ? 0 : m <= 225 ? 255 : Math.round(((250 - m) / 25) * 255)
    if (a === 0) { data[i + 3] = 0; continue }
    const sat = Math.max(r, g, b) - m
    if (lightenGray && sat < 40) { data[i] = 232; data[i + 1] = 236; data[i + 2] = 240 } // texto cinza -> claro no modo escuro
    data[i + 3] = a
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
}

for (const [name, lighten] of [['logo-light', false], ['logo-dark', true]]) {
  const img = await transparent(src, { lightenGray: lighten })
  const buf = await img.png().toBuffer()
  await sharp(buf).trim().resize({ width: 900, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(`public/images/${name}.png`)
}

// Ícone do app: só a casa (parte de cima), sobre fundo branco, com margem.
const lightMeta = await sharp('public/images/logo-light.png').metadata()
const top = await sharp('public/images/logo-light.png').extract({ left: 0, top: 0, width: lightMeta.width, height: Math.round(lightMeta.height * 0.58) }).trim().png().toBuffer()
const make = async (size, file, pad) => {
  const inner = Math.round(size * (1 - pad * 2))
  const icon = await sharp(top).resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } }).composite([{ input: icon, gravity: 'center' }]).png().toFile(`public/icons/${file}`)
}
await make(192, 'icon-192.png', 0.08)
await make(512, 'icon-512.png', 0.13) // com margem extra: serve de "maskable"
await make(180, 'apple-touch-icon.png', 0.08)
console.log('marca gerada')
