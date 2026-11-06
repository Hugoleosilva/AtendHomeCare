import { useMemo, useState } from 'react'
import { companyOf, patientMonth, planValue, statusOf, uid } from '../lib/core'
import { WD_SHORT, addMonths, brl, fmtBR, fmtMonth, fmtShort, today } from '../lib/dates'
import { useStore } from '../lib/store'
import { Back, Chips, Field, PeriodNav, Sheet } from '../ui'

const scheduleText = (p) => {
  const s = p.schedule || {}
  const parts = []
  if (s.weekdays?.length) parts.push(`Toda ${s.weekdays.map((d) => WD_SHORT[d]).join(' · ')}`)
  if (s.extraDates?.length) parts.push(`Pontual: ${s.extraDates.slice().sort().map(fmtShort).join(', ')}`)
  if (s.time) parts.push(s.time)
  return parts.join(' · ') || 'Sem dias definidos'
}

// ---------------- Lista -----------------
// Gerencia as situações do paciente: renomear, marcar se interrompem a agenda, adicionar e retirar.
function StatusManager({ onClose }) {
  const { state, update } = useStore()
  const [list, setList] = useState(() => state.statuses.map((s) => ({ ...s })))
  const [err, setErr] = useState('')
  const set = (i, p) => setList((l) => l.map((s, n) => (n === i ? { ...s, ...p } : s)))
  const used = (id) => state.patients.some((p) => p.status === id)
  const remove = (i) => {
    const s = list[i]
    if (s.id === 'ativo') return
    if (used(s.id)) return setErr(`“${s.label}” está em uso por algum paciente. Mude a situação desses pacientes antes de retirar.`)
    setErr('')
    setList((l) => l.filter((_, n) => n !== i))
  }
  const save = () => {
    if (list.some((s) => !s.label.trim())) return setErr('Toda situação precisa de um nome.')
    const clean = list.map((s) => ({ ...s, label: s.label.trim() }))
    update((st) => ({
      ...st,
      statuses: clean,
      patients: st.patients.map((p) => { const s = clean.find((x) => x.id === p.status); return s ? { ...p, statusHalts: s.halts } : p }),
    }))
    onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <h3>Situações do paciente</h3>
      <p className="sub">Renomeie, adicione ou retire. Marque “interrompe a agenda” nas situações em que o paciente deixa de ser atendido (alta, óbito…).</p>
      {list.map((s, i) => (
        <div className="card" key={s.id}>
          <div className="inline">
            <input type="text" value={s.label} onChange={(e) => set(i, { label: e.target.value })} aria-label="Nome da situação" />
            {s.id !== 'ativo' && <button type="button" className="btn danger" aria-label={`Retirar ${s.label}`} onClick={() => remove(i)}>✕</button>}
          </div>
          {s.id !== 'ativo'
            ? <label className="inline" style={{ marginTop: 8 }}><input type="checkbox" checked={s.halts} onChange={(e) => set(i, { halts: e.target.checked })} style={{ width: 22, height: 22 }} /> Interrompe a agenda (não gera mais atendimentos)</label>
            : <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Situação padrão; não pode ser retirada.</div>}
        </div>
      ))}
      <button type="button" className="btn ghost block" onClick={() => setList((l) => [...l, { id: uid(), label: '', halts: false }])}>＋ Nova situação</button>
      {err && <div className="err">{err}</div>}
      <div className="actions"><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn" onClick={save}>Salvar</button></div>
    </Sheet>
  )
}

export function PatientsScreen({ onOpen, onNew }) {
  const { state } = useStore()
  const [filter, setFilter] = useState('ativo')
  const [manage, setManage] = useState(false)
  const statusOpts = state.statuses.map((s) => ({ value: s.id, label: s.label }))
  const [q, setQ] = useState('')
  const list = state.patients.filter((p) => (filter === 'todos' || p.status === filter) && p.name.toLowerCase().includes(q.toLowerCase()))
  const groups = state.companies.map((c) => ({ c, items: list.filter((p) => p.companyId === c.id).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.items.length)

  return (
    <>
      <h1>Pacientes</h1>
      <input type="text" placeholder="Buscar paciente…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <Chips small equal value={filter} onChange={setFilter} options={[...statusOpts.map((o) => (o.value === 'ativo' ? { ...o, label: 'Ativos' } : o)), { value: 'todos', label: 'Todos' }]} />
      <div className="inline" style={{ marginTop: 8 }}><button className="link" onClick={() => setManage(true)}>✏️ Adicionar ou retirar situações</button></div>
      {manage && <StatusManager onClose={() => setManage(false)} />}
      {groups.length === 0 && <div className="empty">{state.patients.length ? 'Nenhum paciente neste filtro.' : 'Nenhum paciente cadastrado ainda.'}<br /><br /><button className="btn" onClick={onNew}>+ Novo paciente</button></div>}
      {groups.map(({ c, items }) => (
        <div key={c.id}>
          <h2 style={{ color: c.color }}>{c.name} <span className="muted" style={{ fontWeight: 400 }}>({items.length})</span></h2>
          {items.map((p) => (
            <button className="row" key={p.id} style={{ width: '100%' }} onClick={() => onOpen(p.id)}>
              <div className="bar" style={{ background: c.color }} />
              <div className="main">
                <div className="name" style={{ color: c.color }}>{p.name}</div>
                <div className="meta">{scheduleText(p)}</div>
              </div>
              {p.status !== 'ativo' && <span className="tag">{statusOf(state, p.status).label}</span>}
              <span className="money">{brl(planValue(p))}</span>
            </button>
          ))}
        </div>
      ))}
    </>
  )
}

// ---------------- Detalhes -----------------
export function PatientDetail({ id, ym, setYm, onBack, onEdit, onOpenStatus }) {
  const { state, update } = useStore()
  const p = state.patients.find((x) => x.id === id)
  if (!p) return <Back onClick={onBack} />
  const company = companyOf(state, p.companyId)
  const m = patientMonth(state, p, ym)
  const repl = m.done.filter((o) => o.isReplacement)
  const normalDone = m.done.filter((o) => !o.isReplacement)
  const all = [...m.done, ...m.absent, ...m.swapped, ...m.pending].sort((a, b) => a.date.localeCompare(b.date))
  const net = (v) => company.discounts?.reduce((s, d) => s - (v * (Number(d.percent) || 0)) / 100, v) ?? v

  const del = () => {
    if (!confirm(`Excluir ${p.name}? Todo o histórico de atendimentos dele será apagado.`)) return
    update((s) => ({ ...s, patients: s.patients.filter((x) => x.id !== id), records: Object.fromEntries(Object.entries(s.records).filter(([k]) => !k.startsWith(`${id}|`))) }))
    onBack()
  }

  const line = (o) => {
    const r = o.rec
    const ic = o.isReplacement ? (o.status === 'absent' ? '❌' : '🔄') : { done: '✅', absent: '❌', swapped: '⚠️', pending: '▢' }[o.status]
    const txt = o.isReplacement ? `Reposição de ${fmtShort(r.replacementFor)}${o.status === 'done' ? ' · atendido' : o.status === 'absent' ? ' · falta' : ' · a marcar'}` : o.status === 'swapped' ? `Trocado → reposição em ${fmtShort(r.swapTo)}` : o.status === 'absent' ? `Falta${r.reason ? ` · ${r.reason}` : ''}` : o.status === 'done' ? `Atendido · ${brl(r.amount)}` : 'A marcar'
    return (
      <button key={o.key} className="dateline" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenStatus(o)}>
        <span style={{ width: 28 }}>{ic}</span><b style={{ width: 48 }}>{fmtShort(o.date)}</b><span className="muted">{txt}</span>
      </button>
    )
  }

  return (
    <>
      <Back onClick={onBack} />
      <h1 style={{ color: company?.color }}>{p.name}</h1>
      <p className="sub">{company?.name} · {scheduleText(p)}{p.status !== 'ativo' && ` · ${statusOf(state, p.status).label}${p.statusDate ? ` em ${fmtBR(p.statusDate)}` : ''}`}</p>

      <PeriodNav label={`Competência ${fmtMonth(ym)}`} onPrev={() => setYm(addMonths(ym, -1))} onNext={() => setYm(addMonths(ym, 1))} />

      <div className="card">
        <div className="kv"><span>✅ Atendimentos</span><b>{normalDone.length}</b></div>
        <div className="kv"><span>❌ Faltas</span><b>{m.absent.length}</b></div>
        <div className="kv"><span>⚠️ Reposições</span><b>{m.swapped.length}</b></div>
        <div className="kv"><span>🔄 Atendimentos Reposições</span><b>{repl.length}</b></div>
      </div>
      <div className="card">
        <div className="kv"><span>Valor até agora ({normalDone.length + repl.length} atend.)</span><span className="money green big" style={{ fontSize: 20 }}>{brl(m.gross)}</span></div>
        <div className="kv"><span>Projeção do mês</span><span className="money">{brl(m.projected)}</span></div>
        {company?.discounts?.length > 0 && <div className="kv"><span className="muted">Líquido estimado (após {company.discounts.map((d) => `${d.name} ${d.percent}%`).join(', ')})</span><span className="money">{brl(net(m.projected))}</span></div>}
      </div>

      <h2>Dias do mês</h2>
      <div className="card">{all.length ? all.map(line) : <div className="muted">Sem atendimentos nesta competência.</div>}</div>

      <h2>Procedimentos por atendimento</h2>
      <div className="card">
        {(p.items || []).map((i, n) => <div className="kv" key={n}><span>{i.name}</span><span className="money">{brl(i.value)}</span></div>)}
        <div className="kv"><b>Total por atendimento</b><b className="money">{brl(planValue(p))}</b></div>
      </div>
      {p.notes && <><h2>Anotações</h2><div className="card" style={{ whiteSpace: 'pre-wrap' }}>{p.notes}</div></>}

      <div className="actions">
        <button className="btn danger" onClick={del}>Excluir</button>
        <button className="btn" onClick={() => onEdit(p.id)}>Editar</button>
      </div>
    </>
  )
}

// ---------------- Cadastro / edição -----------------
export function PatientForm({ id, defaultDate, onDone, onCancel }) {
  const { state, update } = useStore()
  const editing = state.patients.find((x) => x.id === id)
  const [f, setF] = useState(() => editing ? JSON.parse(JSON.stringify(editing)) : {
    id: uid(), name: '', companyId: state.companies[0]?.id || '', status: 'ativo', statusDate: '', notes: '',
    items: [{ procId: state.procedures[0]?.id || '__new', value: '', name: '' }],
    schedule: { weekdays: [], extraDates: defaultDate ? [defaultDate] : [], time: '', from: defaultDate || today(), until: '' },
  })
  const [withTime, setWithTime] = useState(!!f.schedule.time)
  const [extra, setExtra] = useState('')
  const [err, setErr] = useState('')
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const setSched = (patch) => setF((x) => ({ ...x, schedule: { ...x.schedule, ...patch } }))
  const price = (companyId, procId) => state.prices[companyId]?.[procId]

  const setItem = (n, patch) => setF((x) => ({ ...x, items: x.items.map((it, i) => (i === n ? { ...it, ...patch } : it)) }))
  const pickProc = (n, procId) => {
    const pr = price(f.companyId, procId)
    setItem(n, { procId, ...(pr != null && procId !== '__new' ? { value: pr } : {}) })
  }
  const changeCompany = (companyId) => setF((x) => ({ ...x, companyId, items: x.items.map((it) => (it.procId !== '__new' && price(companyId, it.procId) != null ? { ...it, value: price(companyId, it.procId) } : it)) }))

  const total = useMemo(() => f.items.reduce((s, i) => s + (Number(i.value) || 0), 0), [f.items])

  const save = () => {
    if (!f.name.trim()) return setErr('Informe o nome do paciente.')
    if (!f.companyId) return setErr('Cadastre e escolha uma empresa.')
    if (!f.items.length || f.items.some((i) => (i.procId === '__new' ? !i.newName?.trim() : !i.procId) || i.value === '' || Number(i.value) < 0)) return setErr('Informe procedimento e valor em todas as linhas.')
    if (!f.schedule.weekdays.length && !f.schedule.extraDates.length) return setErr('Escolha ao menos um dia da semana ou uma data pontual.')
    if (statusOf(state, f.status).halts && !f.statusDate) return setErr('Informe a data da mudança de situação.')

    update((s) => {
      let procedures = [...s.procedures]
      const prices = { ...s.prices, [f.companyId]: { ...(s.prices[f.companyId] || {}) } }
      const items = f.items.map((it) => {
        let procId = it.procId
        if (procId === '__new') {
          const name = it.newName.trim()
          let proc = procedures.find((p) => p.name.toLowerCase() === name.toLowerCase())
          if (!proc) { proc = { id: uid(), name, code: 'M', description: '' }; procedures.push(proc) }
          procId = proc.id
        }
        const proc = procedures.find((p) => p.id === procId)
        if (prices[f.companyId][procId] == null) prices[f.companyId][procId] = Number(it.value)
        return { procId, name: proc.name, value: Number(it.value) }
      })
      const patient = { ...f, name: f.name.trim(), items, schedule: { ...f.schedule, time: withTime ? f.schedule.time : '' }, statusDate: statusOf(state, f.status).halts ? f.statusDate : '', statusHalts: statusOf(state, f.status).halts }
      delete patient.newName
      const exists = s.patients.some((x) => x.id === patient.id)
      return { ...s, procedures, prices, patients: exists ? s.patients.map((x) => (x.id === patient.id ? patient : x)) : [...s.patients, patient] }
    })
    onDone(f.id)
  }

  return (
    <>
      <Back onClick={onCancel} />
      <h1>{editing ? 'Editar paciente' : 'Novo paciente'}</h1>

      <Field label="Nome do paciente"><input type="text" value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!editing} /></Field>

      <span className="lbl">Empresa Homecare</span>
      {state.companies.length ? (
        <div className="chips equal">
          {state.companies.map((c) => (
            <button key={c.id} type="button" className={`chip${f.companyId === c.id ? ' on' : ''}`} style={f.companyId === c.id ? { background: c.color, color: '#111' } : { borderLeft: `6px solid ${c.color}` }} onClick={() => changeCompany(c.id)}>{c.name}</button>
          ))}
        </div>
      ) : <div className="err">Cadastre uma empresa em Mais › Empresas.</div>}

      <h2>Quando atende</h2>
      <span className="lbl">Dias fixos da semana</span>
      <Chips multi small value={f.schedule.weekdays} onChange={(v) => setSched({ weekdays: v })} options={WD_SHORT.map((w, i) => ({ value: i, label: w }))} />
      <span className="lbl" style={{ marginTop: 12 }}>Datas pontuais</span>
      <div className="chips" style={{ marginBottom: 8 }}>
        {f.schedule.extraDates.slice().sort().map((d) => (
          <button key={d} type="button" className="chip small on" onClick={() => setSched({ extraDates: f.schedule.extraDates.filter((x) => x !== d) })}>{fmtShort(d)} ✕</button>
        ))}
      </div>
      <div className="inline">
        <input type="date" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <button className="btn ghost" type="button" onClick={() => { if (extra && !f.schedule.extraDates.includes(extra)) setSched({ extraDates: [...f.schedule.extraDates, extra] }); setExtra('') }}>Adicionar</button>
      </div>
      <div className="inline" style={{ marginTop: 12 }}>
        <Field label="A partir de"><input type="date" value={f.schedule.from || ''} onChange={(e) => setSched({ from: e.target.value })} /></Field>
        <Field label="Até (opcional)"><input type="date" value={f.schedule.until || ''} onChange={(e) => setSched({ until: e.target.value })} /></Field>
      </div>
      <label className="inline" style={{ margin: '8px 0' }}>
        <input type="checkbox" checked={withTime} onChange={(e) => setWithTime(e.target.checked)} style={{ width: 22, height: 22 }} /> Definir horário (opcional)
      </label>
      {withTime && <input type="time" value={f.schedule.time || ''} onChange={(e) => setSched({ time: e.target.value })} />}

      <h2>Procedimentos e valores</h2>
      {f.items.map((it, n) => (
        <div className="card" key={n}>
          <select value={it.procId} onChange={(e) => pickProc(n, e.target.value)}>
            {state.procedures.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">+ Novo procedimento…</option>
          </select>
          {it.procId === '__new' && <input type="text" style={{ marginTop: 8 }} placeholder="Nome do novo procedimento" value={it.newName || ''} onChange={(e) => setItem(n, { newName: e.target.value })} />}
          <div className="inline" style={{ marginTop: 8 }}>
            <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="Valor (R$)" value={it.value} onChange={(e) => setItem(n, { value: e.target.value })} />
            {f.items.length > 1 && <button type="button" className="btn danger" onClick={() => set({ items: f.items.filter((_, i) => i !== n) })}>Remover</button>}
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost block" onClick={() => set({ items: [...f.items, { procId: state.procedures[0]?.id || '__new', value: '', name: '' }] })}>+ Outro procedimento no mesmo atendimento</button>
      <div className="kv" style={{ marginTop: 8 }}><b>Total por atendimento</b><b className="money green">{brl(total)}</b></div>

      <h2>Situação do paciente</h2>
      <Chips small equal value={f.status} onChange={(v) => set({ status: v })} options={state.statuses.map((s) => ({ value: s.id, label: s.label }))} />
      {statusOf(state, f.status).halts && <Field label="A partir de quando"><input type="date" value={f.statusDate || ''} onChange={(e) => set({ statusDate: e.target.value })} /></Field>}
      <Field label="Anotações sobre o paciente (opcional)"><textarea value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></Field>

      {err && <div className="err">{err}</div>}
      <div className="actions">
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn" onClick={save}>Salvar</button>
      </div>
    </>
  )
}
