import { useEffect } from 'react'
import { STATUS_ICON, companyOf, timeOf } from './lib/core'
import { fmtShort } from './lib/dates'

export function Sheet({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function Back({ onClick, children = '‹ Voltar' }) {
  return (
    <button className="back" onClick={onClick}>
      {children}
    </button>
  )
}

export function PeriodNav({ label, onPrev, onNext }) {
  return (
    <div className="nav">
      <button onClick={onPrev} aria-label="Anterior">‹</button>
      <strong>{label}</strong>
      <button onClick={onNext} aria-label="Próximo">›</button>
    </div>
  )
}

// Caixinha de status: ✅ atendido, ❌ falta, ⚠️ trocado, 🔄 reposição.
export function StatusBox({ entry, onClick }) {
  const { status, isReplacement } = entry
  let icon = STATUS_ICON[status]
  let cls = status
  if (isReplacement) {
    cls = `repl ${status}`
    icon = status === 'absent' ? '❌' : '🔄'
  }
  const label = { pending: 'A marcar', done: 'Atendido', absent: 'Falta', swapped: 'Trocado' }[status]
  return (
    <button className={`sbox ${cls}`} onClick={onClick} aria-label={isReplacement ? `Reposição: ${label}` : label}>
      {icon || '▢'}
    </button>
  )
}

export function statusNote(entry) {
  const { rec, status, isReplacement } = entry
  if (isReplacement) return status === 'done' ? `Reposto por ${fmtShort(rec.replacementFor)}` : status === 'absent' ? `Falta na reposição de ${fmtShort(rec.replacementFor)}` : `Reposição de ${fmtShort(rec.replacementFor)}`
  if (status === 'swapped') return `Reposição em ${fmtShort(rec.swapTo)}${rec.swapTime ? ` às ${rec.swapTime}` : ''}`
  if (status === 'absent') return rec?.reason ? `Falta · ${rec.reason}` : 'Falta'
  if (status === 'done' && rec?.observation) return 'Atendido · com observação'
  return ''
}

// Linha de paciente (nome colorido pela empresa + caixinha de status).
export function EntryRow({ state, entry, onOpenPatient, onOpenStatus }) {
  const p = entry.patient
  const company = companyOf(state, p.companyId)
  const color = company?.color || '#888'
  const note = statusNote(entry)
  return (
    <div className="row">
      <div className="bar" style={{ background: color }} />
      {timeOf(entry) && <div className="time">{timeOf(entry)}</div>}
      <button className="main" onClick={() => onOpenPatient(p.id)}>
        <div className="name" style={{ color }}>{p.name}</div>
        <div className="meta">{company?.name || 'Sem empresa'}{note ? ` · ${note}` : ''}</div>
      </button>
      <StatusBox entry={entry} onClick={() => onOpenStatus(entry)} />
    </div>
  )
}

export const Field = ({ label, children }) => (
  <label className="f">
    <span>{label}</span>
    {children}
  </label>
)

export function Chips({ options, value, onChange, multi = false, small = false }) {
  const isOn = (v) => (multi ? value.includes(v) : value === v)
  const click = (v) => {
    if (multi) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
    else onChange(v)
  }
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o.value} className={`chip${small ? ' small' : ''}${isOn(o.value) ? ' on' : ''}`} onClick={() => click(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
