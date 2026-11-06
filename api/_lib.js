import crypto from 'node:crypto'
import { MongoClient } from 'mongodb'

let client
export async function db() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não configurada')
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 })
    await client.connect()
  }
  return client.db(process.env.MONGODB_DB || 'homecare')
}

const hmac = (body) => crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(body).digest('base64url')

export const sign = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${hmac(body)}`
}

export function verify(token) {
  if (!token || !process.env.SESSION_SECRET) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(hmac(body))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return p.exp > Date.now() ? p : null
  } catch {
    return null
  }
}

export function session(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)hc_session=([^;]+)/)
  return verify(m && decodeURIComponent(m[1]))
}

// Comparação em tempo constante (hash antes, para ignorar diferença de tamanho).
export const safeEq = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest())

export function send(res, status, obj) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(obj))
}

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body
  const chunks = []
  for await (const c of req) chunks.push(c)
  const t = Buffer.concat(chunks).toString()
  return t ? JSON.parse(t) : {}
}
