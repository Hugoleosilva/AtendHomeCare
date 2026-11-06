import { useState } from 'react'
import { useStore } from '../lib/store'
import { ThemeButton } from '../ui'

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
    <>
    <ThemeButton labeled className="login-theme" />
    <form onSubmit={submit} className="login">
      <img className="logo logo-light" src="/images/logo-light.png" alt="HomePlanner – Gestão de HomeCare" />
      <img className="logo logo-dark" src="/images/logo-dark.png" alt="" />
      <h1>Entrar</h1>
      <p className="sub">Digite a senha para entrar.</p>
      <label className="f">
        <span>Senha</span>
        <input type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      {auth.error && <div className="err" role="alert">{auth.error}</div>}
      <button className="btn block" disabled={busy || !pw}>{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
    </>
  )
}
