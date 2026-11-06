import { useState } from 'react'
import { useStore } from '../lib/store'

export default function Login() {
  const { auth, login } = useStore()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!pw) return
    setBusy(true)
    await login(pw)
    setBusy(false)
  }
  return (
    <form onSubmit={submit} style={{ maxWidth: 360, margin: '0 auto', padding: '18vh 24px 24px' }}>
      <img src="/icons/icon-192.png" alt="" width="72" height="72" style={{ borderRadius: 18 }} />
      <h1>HomeCare</h1>
      <p className="sub">Digite a senha para entrar.</p>
      <label className="f">
        <span>Senha</span>
        <input type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      {auth.error && <div className="err" role="alert">{auth.error}</div>}
      <button className="btn block" disabled={busy || !pw}>{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  )
}
