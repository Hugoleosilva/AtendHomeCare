import { useState } from 'react'
import { ABSENCE_REASONS, companyOf, competencyOf, isScheduled, planValue, recKey, saveNotes, setStatus } from '../lib/core'
import { addDays, brl, fmtBR, fmtLongDate, fmtMonth, fmtShort, today } from '../lib/dates'
import { useStore } from '../lib/store'
import { Chips, Sheet } from '../ui'

const OPTIONS = [
  { v: 'done', e: '✅', t: 'Atendido' },
  { v: 'absent', e: '❌', t: 'Falta' },
  { v: 'swapped', e: '⚠️', t: 'Trocado de dia' },
  { v: 'pending', e: '▢', t: 'Limpar' },
]

export default function StatusSheet({ entry, onClose, onOpenPatient }) {
  const { state, update } = useStore()
  const { patient, date, rec, isReplacement } = entry
  const company = companyOf(state, patient.companyId)
  const [status, setSt] = useState(entry.status)
  const [reason, setReason] = useState(rec?.reason || '')
  const [swapTo, setSwapTo] = useState(rec?.swapTo || addDays(date, 1))
  const [evolution, setEvolution] = useState(rec?.evolution || '')
  const [observation, setObservation] = useState(rec?.observation || '')
  const [competency, setCompetency] = useState(rec?.competency || '')
  const [swapTime, setSwapTime] = useState(rec?.swapTime || '')
  const [time, setTime] = useState(rec?.time || '')
  const [error, setError] = useState('')

  const autoComp = competencyOf(company, date, null)
  const future = date > today()
  const options = isReplacement ? OPTIONS.filter((o) => o.v !== 'swapped') : OPTIONS

  const save = () => {
    try {
      let next = state
      const changed = status !== entry.status || (status === 'swapped' && (swapTo !== rec?.swapTo || swapTime !== (rec?.swapTime || ''))) || (status === 'absent' && reason !== (rec?.reason || ''))
      if (status === 'swapped' && changed) {
        const other = state.records[recKey(patient.id, swapTo)]
        const sameDay = isScheduled(patient, swapTo) || (other && other.replacementFor !== date)
        const alreadyMine = rec?.swapTo === swapTo
        if (sameDay && !alreadyMine && !confirm(`${patient.name} já tem atendimento em ${fmtBR(swapTo)}. Deseja marcar 2 sessões no mesmo dia?`)) return
      }
      if (changed) next = setStatus(next, patient, date, status, { reason, swapTo, time: swapTime, key: entry.key })
      const key = entry.key
      const hasText = evolution || observation || competency || time
      if (next.records[key] || hasText) next = saveNotes(next, key, { evolution, observation, competency: competency || undefined, time: time || undefined })
      update(() => next)
      onClose()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h3 style={{ color: company?.color }}>{patient.name}</h3>
      <div className="sub">
        {fmtLongDate(date)} · {company?.name}
        {isReplacement && <> · <b>Reposição de {fmtShort(rec.replacementFor)}</b></>}
      </div>

      <div className="statusbtns">
        {options.map((o) => (
          <button key={o.v} className={`sbtn${status === o.v ? ' on' : ''}`} disabled={o.v === 'done' && future} title={o.v === 'done' && future ? 'Não dá para marcar como atendido uma data futura' : undefined} onClick={() => setSt(o.v)}>
            <span className="e">{o.e}</span>
            {o.v === 'done' && isReplacement ? 'Atendido (reposição)' : o.t}
          </button>
        ))}
      </div>

      {future && <div className="muted" style={{ fontSize: 13 }}>Data futura: ainda não dá para marcar como atendido.</div>}
      {status === 'done' && (
        <div className="card">
          {(entry.status === 'done' ? rec.items : patient.items).map((i, n) => (
            <div className="kv" key={n}><span>{i.name || state.procedures.find((p) => p.id === i.procId)?.name}</span><span className="money">{brl(i.value)}</span></div>
          ))}
          <div className="kv"><b>Valor do dia</b><b className="money green">{brl(entry.status === 'done' ? rec.amount : planValue(patient))}</b></div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Se o paciente recusou ao chegar, marque Atendido e escreva em Observações.</div>
        </div>
      )}

      {status === 'absent' && (
        <div>
          <span className="lbl">Motivo</span>
          <Chips small options={ABSENCE_REASONS.map((r) => ({ value: r, label: r }))} value={reason} onChange={setReason} />
          <label className="f"><span>Outro motivo</span><input type="text" value={ABSENCE_REASONS.includes(reason) ? '' : reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="muted" style={{ fontSize: 13 }}>Falta não gera valor neste dia.</div>
        </div>
      )}

      {status === 'swapped' && (
        <div>
          <label className="f"><span>Dia da reposição</span><input type="date" value={swapTo} onChange={(e) => setSwapTo(e.target.value)} /></label>
          <label className="f"><span>Horário da reposição (opcional)</span>
            <div className="inline"><input type="time" value={swapTime} onChange={(e) => setSwapTime(e.target.value)} />{swapTime && <button className="chip small" onClick={() => setSwapTime('')}>Sem horário</button>}</div>
          </label>
          <span className="lbl">Motivo (opcional)</span>
          <Chips small options={ABSENCE_REASONS.filter((r) => r !== 'Outro').map((r) => ({ value: r, label: r }))} value={reason} onChange={setReason} />
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Este dia não conta como falta. O atendimento passa a valer em {fmtBR(swapTo)}, marcado como 🔄 reposição. Se o paciente já tiver atendimento nesse dia, vira uma 2ª sessão — use o horário para organizar.</div>
        </div>
      )}

      <label className="f"><span>Horário deste atendimento (opcional) · padrão {patient.schedule?.time || 'sem horário'}</span>
        <div className="inline"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} />{time && <button className="chip small" onClick={() => setTime('')}>Padrão</button>}</div>
      </label>
      <label className="f"><span>Evolução do paciente</span><textarea value={evolution} onChange={(e) => setEvolution(e.target.value)} placeholder="Como o paciente evoluiu nesta sessão…" /></label>
      <label className="f"><span>Observações (ocorrências fora da sessão)</span><textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Ex.: plano do paciente mudou, avisar a empresa…" /></label>
      <label className="f">
        <span>Competência (mês da folha) · padrão {fmtMonth(autoComp)}</span>
        <div className="inline">
          <input type="month" value={competency} onChange={(e) => setCompetency(e.target.value)} />
          {competency && <button className="chip small" onClick={() => setCompetency('')}>Padrão</button>}
        </div>
      </label>

      {error && <div className="err">{error}</div>}
      <div className="actions">
        <button className="btn ghost" onClick={() => { onClose(); onOpenPatient(patient.id) }}>Ver paciente</button>
        <button className="btn" onClick={save}>Salvar</button>
      </div>
    </Sheet>
  )
}
