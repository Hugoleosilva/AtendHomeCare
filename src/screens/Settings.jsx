import { useRef, useState } from 'react'
import { uid } from '../lib/core'
import { useStore } from '../lib/store'
import { Back, Field } from '../ui'

const COLORS = ['#f47b20', '#3b82f6', '#22c55e', '#e11d74', '#a855f7', '#eab308', '#14b8a6', '#ef4444']
const LAYOUTS = [
  { value: 'padrao', label: 'Padrão (tabela simples)' },
  { value: 'reintegrar', label: 'Reintegrar – Ficha de Frequência' },
  { value: 'residencia', label: 'Saúde Residência – Evolução Clínica' },
]

export function MoreScreen({ go }) {
  const { auth, logout, sync } = useStore()
  const items = [
    ['closing', '💰', 'Fechamento do mês', 'Proventos, descontos e líquido por empresa'],
    ['evolution', '📝', 'Evolução e exportação', 'Filtrar, ver em tabela e baixar Excel/PDF'],
    ['companies', '🏢', 'Empresas', 'Cores, descontos (ISS…), dia de corte e preços'],
    ['procedures', '🩺', 'Procedimentos', 'Lista de procedimentos e siglas'],
    ['backup', '💾', 'Backup', 'Exportar / importar todos os dados'],
  ]
  return (
    <>
      <h1>Mais</h1>
      {items.map(([k, ic, t, d]) => (
        <button className="row" key={k} style={{ width: '100%' }} onClick={() => go(k)}>
          <span style={{ fontSize: 26 }}>{ic}</span>
          <div className="main"><div className="name">{t}</div><div className="meta">{d}</div></div>
          <span className="muted">›</span>
        </button>
      ))}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="kv"><span className="muted">Acesso</span><b>{auth.role === 'admin' ? 'Administrador' : 'Usuária'}</b></div>
        <div className="kv"><span className="muted">Sincronização</span><b>{{ saved: '☁️ Em dia', saving: '⏳ Salvando…', offline: '📴 Sem internet', error: '⚠️ Falhou', idle: '—' }[sync]}</b></div>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => confirm('Sair do app neste aparelho?') && logout()}>Sair</button>
      </div>
    </>
  )
}

// ---------------- Empresas -----------------
export function CompaniesScreen({ onBack }) {
  const { state } = useStore()
  const [editing, setEditing] = useState(null)
  if (editing) return <CompanyForm initial={editing === 'new' ? null : state.companies.find((c) => c.id === editing)} onDone={() => setEditing(null)} />
  return (
    <>
      <Back onClick={onBack} />
      <h1>Empresas</h1>
      <p className="sub">Cada empresa tem cor própria, descontos, dia de corte da folha e tabela de preços.</p>
      {state.companies.map((c) => (
        <button className="row" key={c.id} style={{ width: '100%' }} onClick={() => setEditing(c.id)}>
          <div className="bar" style={{ background: c.color }} />
          <div className="main"><div className="name" style={{ color: c.color }}>{c.name}</div><div className="meta">{c.discounts?.length ? c.discounts.map((d) => `${d.name} ${d.percent}%`).join(' · ') : 'Sem descontos'}{c.cutoffDay ? ` · corte dia ${c.cutoffDay}` : ''}</div></div>
          <span className="muted">Editar ›</span>
        </button>
      ))}
      <button className="btn block" onClick={() => setEditing('new')}>+ Nova empresa</button>
    </>
  )
}

function CompanyForm({ initial, onDone }) {
  const { state, update } = useStore()
  const [f, setF] = useState(() => initial ? JSON.parse(JSON.stringify(initial)) : { id: uid(), name: '', color: COLORS[state.companies.length % COLORS.length], logo: '', layout: 'padrao', cutoffDay: 0, discounts: [] })
  const [prices, setPrices] = useState(() => ({ ...(state.prices[f.id] || {}) }))
  const [err, setErr] = useState('')
  const fileRef = useRef()
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const used = initial && state.patients.some((p) => p.companyId === initial.id)

  const onLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => set({ logo: r.result })
    r.readAsDataURL(file)
  }
  const save = () => {
    if (!f.name.trim()) return setErr('Informe o nome da empresa.')
    const cleanPrices = Object.fromEntries(Object.entries(prices).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, Number(v)]))
    const company = { ...f, name: f.name.trim(), cutoffDay: Number(f.cutoffDay) || 0, discounts: f.discounts.filter((d) => d.name.trim() && Number(d.percent) > 0).map((d) => ({ ...d, percent: Number(d.percent) })) }
    update((s) => ({ ...s, companies: s.companies.some((c) => c.id === company.id) ? s.companies.map((c) => (c.id === company.id ? company : c)) : [...s.companies, company], prices: { ...s.prices, [company.id]: cleanPrices } }))
    onDone()
  }
  const del = () => {
    if (used) return alert('Há pacientes nesta empresa. Mova ou exclua os pacientes antes.')
    if (!confirm(`Excluir a empresa ${f.name}?`)) return
    update((s) => ({ ...s, companies: s.companies.filter((c) => c.id !== f.id) }))
    onDone()
  }

  return (
    <>
      <Back onClick={onDone} />
      <h1>{initial ? 'Editar empresa' : 'Nova empresa'}</h1>
      <Field label="Nome da empresa Homecare"><input type="text" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <span className="lbl">Cor nos pacientes</span>
      <div className="chips">
        {COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => set({ color: c })} style={{ width: 44, height: 44, borderRadius: 22, background: c, outline: f.color === c ? '3px solid #fff' : 'none', outlineOffset: 2 }} />)}
        <input type="color" value={f.color} onChange={(e) => set({ color: e.target.value })} style={{ width: 44, height: 44, padding: 2 }} />
      </div>

      <h2>Descontos / encargos (ISS, etc.)</h2>
      {f.discounts.map((d, n) => (
        <div className="inline" key={n} style={{ marginBottom: 8 }}>
          <input type="text" placeholder="Nome (ex.: ISS)" value={d.name} onChange={(e) => set({ discounts: f.discounts.map((x, i) => (i === n ? { ...x, name: e.target.value } : x)) })} />
          <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="%" style={{ maxWidth: 90 }} value={d.percent} onChange={(e) => set({ discounts: f.discounts.map((x, i) => (i === n ? { ...x, percent: e.target.value } : x)) })} />
          <button type="button" className="btn danger" onClick={() => set({ discounts: f.discounts.filter((_, i) => i !== n) })}>✕</button>
        </div>
      ))}
      <button type="button" className="btn ghost block" onClick={() => set({ discounts: [...f.discounts, { id: uid(), name: '', percent: '' }] })}>+ Adicionar desconto</button>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Cada percentual incide sobre o total bruto da empresa no mês. Sem descontos = “N/A”.</div>

      <h2>Folha</h2>
      <Field label="Dia de corte da folha (0 = mês corrido)">
        <input type="number" inputMode="numeric" min="0" max="31" value={f.cutoffDay} onChange={(e) => set({ cutoffDay: e.target.value })} />
      </Field>
      <div className="muted" style={{ fontSize: 13 }}>Atendimentos depois desse dia entram na competência do mês seguinte. Dá para ajustar atendimento por atendimento.</div>

      <h2>Preços por procedimento</h2>
      {state.procedures.map((p) => (
        <div className="inline" key={p.id} style={{ marginBottom: 8 }}>
          <div style={{ flex: 1 }}>{p.name}</div>
          <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="R$" style={{ maxWidth: 130 }} value={prices[p.id] ?? ''} onChange={(e) => setPrices((x) => ({ ...x, [p.id]: e.target.value }))} />
        </div>
      ))}

      <h2>Exportação</h2>
      <Field label="Modelo da planilha de evolução">
        <select value={f.layout} onChange={(e) => set({ layout: e.target.value })}>{LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
      </Field>
      <div className="inline">
        {f.logo && <img src={f.logo} alt="" style={{ height: 48, background: '#fff', borderRadius: 8, padding: 4 }} />}
        <button type="button" className="btn ghost" onClick={() => fileRef.current.click()}>{f.logo ? 'Trocar logo' : 'Enviar logo'}</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={onLogo} />
      </div>

      {err && <div className="err">{err}</div>}
      <div className="actions">
        {initial && <button className="btn danger" onClick={del}>Excluir</button>}
        <button className="btn" onClick={save}>Salvar</button>
      </div>
    </>
  )
}

// ---------------- Procedimentos -----------------
export function ProceduresScreen({ onBack }) {
  const { state, upsert, remove } = useStore()
  const [edit, setEdit] = useState(null)
  const save = () => {
    if (!edit.name.trim()) return
    upsert('procedures', { ...edit, name: edit.name.trim(), code: edit.code.trim() || 'M' })
    setEdit(null)
  }
  const del = (p) => {
    if (state.patients.some((x) => x.items?.some((i) => i.procId === p.id))) return alert('Este procedimento está em uso por algum paciente.')
    if (confirm(`Excluir ${p.name}?`)) remove('procedures', p.id)
  }
  return (
    <>
      <Back onClick={onBack} />
      <h1>Procedimentos</h1>
      <p className="sub">A sigla aparece na coluna “Especialidade” das fichas (padrão M ou M/F).</p>
      {state.procedures.map((p) => (
        <div className="row" key={p.id}>
          <div className="main"><div className="name">{p.name}</div><div className="meta">Sigla: {p.code}{p.description ? ` · ${p.description}` : ''}</div></div>
          <button className="link" onClick={() => setEdit({ ...p })}>Editar</button>
          <button className="link" style={{ color: 'var(--bad)' }} onClick={() => del(p)}>✕</button>
        </div>
      ))}
      {edit ? (
        <div className="card">
          <Field label="Nome"><input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Sigla na ficha"><input type="text" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
          <Field label="Descrição (opcional)"><input type="text" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Ex.: M = Motora" /></Field>
          <div className="actions"><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn" onClick={save}>Salvar</button></div>
        </div>
      ) : <button className="btn block" onClick={() => setEdit({ id: uid(), name: '', code: 'M', description: '' })}>+ Novo procedimento</button>}
    </>
  )
}

// ---------------- Backup -----------------
export function BackupScreen({ onBack }) {
  const { state, replaceAll, auth } = useStore()
  const ref = useRef()
  const [msg, setMsg] = useState('')
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `homecare_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setMsg('Backup baixado.')
  }
  const importJson = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data.patients) || !Array.isArray(data.companies)) throw new Error('inválido')
      if (!confirm('Substituir todos os dados atuais pelo backup?')) return
      replaceAll(data)
      setMsg('Backup restaurado.')
    } catch {
      setMsg('Arquivo inválido.')
    }
  }
  return (
    <>
      <Back onClick={onBack} />
      <h1>Backup</h1>
      <p className="sub">Os dados ficam salvos na nuvem e em cada aparelho. Ainda assim, baixe um backup de vez em quando.</p>
      <button className="btn block" onClick={exportJson}>Baixar backup (.json)</button>
      <div style={{ height: 10 }} />
      {auth.role === 'admin' ? (
        <>
          <button className="btn ghost block" onClick={() => ref.current.click()}>Restaurar de um backup (substitui tudo na nuvem)</button>
          <input ref={ref} type="file" accept="application/json" hidden onChange={importJson} />
        </>
      ) : <div className="muted" style={{ fontSize: 13 }}>Restaurar backup é uma ação do administrador.</div>}
      {msg && <div className="card" style={{ marginTop: 12 }}>{msg}</div>}
    </>
  )
}
