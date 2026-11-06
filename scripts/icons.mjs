// Gera os ícones PNG do PWA (sem dependências externas).
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size) {
  const bg = [15, 16, 18], accent = [255, 138, 76], white = [255, 255, 255]
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const cx = size / 2, cy = size / 2, R = size * 0.34, arm = size * 0.17, th = size * 0.055
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let col = bg
      const d = Math.hypot(x - cx, y - cy)
      if (d <= R) col = accent
      const inCross = (Math.abs(x - cx) <= th && Math.abs(y - cy) <= arm) || (Math.abs(y - cy) <= th && Math.abs(x - cx) <= arm)
      if (inCross) col = white
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', png(192))
writeFileSync('public/icons/icon-512.png', png(512))
writeFileSync('public/icons/apple-touch-icon.png', png(180))
console.log('ícones gerados')
