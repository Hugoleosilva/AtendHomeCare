import { readBody, safeEq, send, session, sign } from './_lib.js'

const cookie = (value, maxAge) => `hc_session=${value}; Path=/; HttpOnly; ${process.env.VERCEL ? 'Secure; ' : ''}SameSite=Strict; Max-Age=${maxAge}`

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const s = session(req)
      return s ? send(res, 200, { role: s.role }) : send(res, 401, { error: 'Sem sessão' })
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', cookie('', 0))
      return send(res, 200, { ok: true })
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' })
    if (!process.env.SESSION_SECRET) return send(res, 500, { error: 'Servidor sem SESSION_SECRET configurada' })

    const { password = '' } = await readBody(req)
    let role = null
    if (process.env.ADMIN_PASSWORD && safeEq(password, process.env.ADMIN_PASSWORD)) role = 'admin'
    else if (process.env.USER_PASSWORD && safeEq(password, process.env.USER_PASSWORD)) role = 'user'
    if (!role) {
      await new Promise((r) => setTimeout(r, 1200)) // freia tentativas em série
      return send(res, 401, { error: 'Senha incorreta' })
    }
    const maxAge = 60 * 60 * 24 * 30
    res.setHeader('Set-Cookie', cookie(encodeURIComponent(sign({ role, exp: Date.now() + maxAge * 1000 })), maxAge))
    return send(res, 200, { role })
  } catch (e) {
    return send(res, 500, { error: 'Erro interno' })
  }
}
