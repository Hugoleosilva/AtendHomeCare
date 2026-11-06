import { addDays, addMonths, eachDay, fmtShort, monthOf, monthRange, weekday } from './dates'

export const PROFESSIONAL = { name: 'Thais Souza Cavalcanti', crefito: 'CREFITO 175056-F' }

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
export const recKey = (pid, date) => `${pid}|${date}`

// Situações do paciente. As que interrompem a agenda param de gerar atendimentos após a data informada.
export const PATIENT_STATUS = {
  ativo: { label: 'Ativo', halts: false },
  internado: { label: 'Internado', halts: false },
  recusou: { label: 'Recusou tratamento', halts: true },
  obito: { label: 'Óbito', halts: true },
  alta: { label: 'Alta', halts: true },
  suspenso: { label: 'Suspenso', halts: true },
}

export const ABSENCE_REASONS = ['Paciente não quis', 'Paciente internado', 'Paciente em consulta/exame', 'Chuva', 'Compromisso meu', 'Consulta médica minha', 'Outro']

export const STATUS_ICON = { pending: '', done: '✅', absent: '❌', swapped: '⚠️' }

export const planValue = (p) => (p.items || []).reduce((s, i) => s + (Number(i.value) || 0), 0)

export function isScheduled(p, date) {
  const s = p.schedule || {}
  if (PATIENT_STATUS[p.status]?.halts && p.statusDate && date > p.statusDate) return false
  if ((s.extraDates || []).includes(date)) return true
  if (s.from && date < s.from) return false
  if (s.until && date > s.until) return false
  return (s.weekdays || []).includes(weekday(date))
}

// Competência (mês da folha): respeita o dia de corte da empresa, a menos que haja ajuste manual.
export function competencyOf(company, date, rec) {
  if (rec?.competency) return rec.competency
  const ym = monthOf(date)
  const cut = Number(company?.cutoffDay) || 0
  if (cut && Number(date.slice(8, 10)) > cut) return addMonths(ym, 1)
  return ym
}

export const companyOf = (state, id) => state.companies.find((c) => c.id === id)

// Todos os atendimentos (previstos ou com registro) no intervalo.
export function occurrences(state, from, to) {
  const out = []
  const days = eachDay(from, to)
  // Registros extras: reposição no mesmo dia em que o paciente já tem atendimento (chave 'paciente|data|origem').
  const extra = {}
  for (const [key, rec] of Object.entries(state.records)) {
    const [pid, date, orig] = key.split('|')
    if (orig) (extra[`${pid}|${date}`] ||= []).push([key, rec])
  }
  for (const p of state.patients) {
    for (const d of days) {
      const key = recKey(p.id, d)
      const rec = state.records[key]
      if (rec || isScheduled(p, d)) out.push({ patient: p, date: d, key, rec, status: rec?.status || 'pending', isReplacement: !!rec?.replacementFor })
      for (const [k, r] of extra[key] || []) out.push({ patient: p, date: d, key: k, rec: r, status: r.status || 'pending', isReplacement: true })
    }
  }
  return out
}

// Horário do atendimento: o do registro (opcional, ex.: reposição) ou o padrão do paciente.
export const timeOf = (o) => o.rec?.time || o.patient.schedule?.time || ''

export function entriesOnDay(state, date) {
  return occurrences(state, date, date).sort((a, b) => (timeOf(a) || '99:99').localeCompare(timeOf(b) || '99:99') || a.patient.name.localeCompare(b.patient.name))
}

// ---- Mudança de status ------------------------------------------------------
export function setStatus(state, patient, date, status, opts = {}) {
  const key = opts.key || recKey(patient.id, date)
  const rec = state.records[key] || {}
  const records = { ...state.records }

  // Desfaz a reposição criada por uma troca anterior, quando a troca muda.
  if (rec.status === 'swapped' && rec.swapTo && (status !== 'swapped' || opts.swapTo !== rec.swapTo)) {
    const rk = rec.swapKey || recKey(patient.id, rec.swapTo)
    const r = records[rk]
    if (r?.replacementFor === date) {
      if (r.status === 'done') throw new Error(`A reposição de ${fmtShort(rec.swapTo)} já foi marcada como atendida. Desfaça-a antes.`)
      delete records[rk]
    }
  }

  const base = { evolution: rec.evolution, observation: rec.observation, competency: rec.competency, replacementFor: rec.replacementFor, time: rec.time }
  const hasText = base.evolution || base.observation || base.competency || base.time

  if (status === 'pending') {
    if (!rec.replacementFor && !hasText) delete records[key]
    else records[key] = { ...base, status: 'pending' }
  } else if (status === 'done') {
    records[key] = { ...base, status: 'done', amount: planValue(patient), items: (patient.items || []).map((i) => ({ ...i })) }
  } else if (status === 'absent') {
    records[key] = { ...base, status: 'absent', reason: opts.reason || '' }
  } else if (status === 'swapped') {
    const to = opts.swapTo
    if (!to || to === date) throw new Error('Informe o dia da reposição.')
    // Se o paciente já tem atendimento no dia da reposição, a reposição vira uma 2ª sessão (chave própria).
    let tk = rec.swapTo === to && rec.swapKey ? rec.swapKey : recKey(patient.id, to)
    const existing = records[tk]
    if (!(existing?.replacementFor === date) && (existing || isScheduled(patient, to))) tk = `${recKey(patient.id, to)}|${date}`
    const current = records[tk]?.replacementFor === date ? records[tk] : { status: 'pending', replacementFor: date }
    records[tk] = { ...current, time: opts.time || undefined }
    records[key] = { ...base, status: 'swapped', swapTo: to, swapKey: tk, swapTime: opts.time || undefined, reason: opts.reason || '' }
  }
  return { ...state, records }
}

export function saveNotes(state, key, patch) {
  const rec = { status: 'pending', ...(state.records[key] || {}), ...patch }
  const records = { ...state.records }
  if (rec.status === 'pending' && !rec.replacementFor && !rec.evolution && !rec.observation && !rec.competency && !rec.time) delete records[key]
  else records[key] = rec
  return { ...state, records }
}

// ---- Financeiro -------------------------------------------------------------
export function monthStats(state, ym) {
  const from = `${addMonths(ym, -1)}-01`
  const to = monthRange(addMonths(ym, 1)).last
  const occ = occurrences(state, from, to).filter((o) => competencyOf(companyOf(state, o.patient.companyId), o.date, o.rec) === ym)

  const byPatient = new Map()
  for (const o of occ) {
    let row = byPatient.get(o.patient.id)
    if (!row) {
      row = { patient: o.patient, done: [], absent: [], swapped: [], pending: [], gross: 0, projected: 0 }
      byPatient.set(o.patient.id, row)
    }
    if (o.status === 'done') {
      row.done.push(o)
      row.gross += o.rec.amount ?? planValue(o.patient)
    } else if (o.status === 'absent') row.absent.push(o)
    else if (o.status === 'swapped') row.swapped.push(o)
    else row.pending.push(o)
  }
  for (const row of byPatient.values()) row.projected = row.gross + row.pending.length * planValue(row.patient)

  const companies = state.companies.map((company) => {
    const patients = [...byPatient.values()].filter((r) => r.patient.companyId === company.id).sort((a, b) => a.patient.name.localeCompare(b.patient.name))
    const gross = patients.reduce((s, r) => s + r.gross, 0)
    const projGross = patients.reduce((s, r) => s + r.projected, 0)
    const discounts = (company.discounts || []).map((d) => ({ name: d.name, percent: Number(d.percent) || 0, value: (gross * (Number(d.percent) || 0)) / 100, projValue: (projGross * (Number(d.percent) || 0)) / 100 }))
    const totalDiscount = discounts.reduce((s, d) => s + d.value, 0)
    const projDiscount = discounts.reduce((s, d) => s + d.projValue, 0)
    return {
      company, patients, gross, discounts, totalDiscount, net: gross - totalDiscount, projGross, projNet: projGross - projDiscount,
      doneCount: patients.reduce((s, r) => s + r.done.length, 0),
      pendingCount: patients.reduce((s, r) => s + r.pending.length, 0),
    }
  })
  const total = {
    gross: companies.reduce((s, c) => s + c.gross, 0),
    net: companies.reduce((s, c) => s + c.net, 0),
    projNet: companies.reduce((s, c) => s + c.projNet, 0),
  }
  return { companies, total, byPatient }
}

// Resumo de um paciente em uma competência (para a tela de detalhes).
export function patientMonth(state, patient, ym) {
  const stats = monthStats(state, ym)
  return stats.byPatient.get(patient.id) || { patient, done: [], absent: [], swapped: [], pending: [], gross: 0, projected: 0 }
}
