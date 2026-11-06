import { useState } from 'react'
import { useStore } from '../lib/store'
import { ThemeButton } from '../ui'

export default function Login() {
  const { auth, login } = useStore()
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true)
    await login(pw)
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <ThemeButton labeled className="login-theme" />
      <form onSubmit={submit} className="login-card">
        <div className="login-brand">
          <img className="login-logo logo-light" src="/images/logo-light.png" alt="HomePlanner – Gestão de HomeCare" />
          <img className="login-logo logo-dark" src="/images/logo-dark.png" alt="" />
        </div>

        <h1 className="login-title">Acesse sua agenda</h1>
        <p className="login-sub">Digite a senha para continuar</p>

        <label className="login-field">
          <span>Senha</span>
          <div className="login-input">
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              enterKeyHint="go"
              autoFocus
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              aria-invalid={!!auth.error}
            />
            <button type="button" className="login-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show}>
              {show ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        {auth.error && <div className="login-err" role="alert">{auth.error}</div>}

        <button className="login-btn" disabled={busy || !pw}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <div className="login-foot">🔒 Acesso protegido</div>
      </form>
    </div>
  )
}
