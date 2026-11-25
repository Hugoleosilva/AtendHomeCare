import { useEffect } from 'react'
import { STATUS_ICON, companyOf, timeOf } from './lib/core'
import { fmtShort } from './lib/dates'
import { isDarkNow, setTheme, useTheme } from './lib/theme'

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

// Campo de horário próprio (hora e minuto), no lugar do seletor de relógio nativo do navegador,
// que no celular corta os botões. Valor em 'HH:MM' ou '' (sem horário).
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export function TimeField({ value, onChange, ariaLabel = 'Horário' }) {
  const [h = '', m = ''] = (value || '').split(':')
  const minutes = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES // mantém um minuto fora do passo de 5, se já existir
  const setH = (nh) => onChange(nh ? `${nh}:${m || '00'}` : '')
  const setM = (nm) => onChange(`${h || '08'}:${nm}`)
  return (
    <div className="timefield" role="group" aria-label={ariaLabel}>
      <select value={h} onChange={(e) => setH(e.target.value)} aria-label="Hora">
        <option value="">--</option>
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select value={h ? m || '00' : ''} onChange={(e) => setM(e.target.value)} disabled={!h} aria-label="Minuto">
        {!h && <option value="">--</option>}
        {minutes.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </div>
  )
}

// Alterna Claro ↔ Escuro (o modo Automático fica em Mais › Aparência).
export function ThemeButton({ labeled = false, className = '' }) {
  const t = useTheme()
  const dark = isDarkNow(t)
  return (
    <button className={`theme-btn ${className}`} onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Mudar para modo claro' : 'Mudar para modo escuro'} title={dark ? 'Modo claro' : 'Modo escuro'}>
      <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span>{labeled && <span className="tlabel">{dark ? 'Modo claro' : 'Modo escuro'}</span>}
    </button>
  )
}

export function Back({ onClick, children = '‹ Voltar' }) {
  return (
    <button className="back" onClick={onClick}>
      {children}
    </button>
  )
}

export function PeriodNav({ label, onPrev, onNext, onToday }) {
  return (
    <div className="nav">
      <button onClick={onPrev} aria-label="Anterior">‹</button>
      <div className="nav-mid">
        <strong>{label}</strong>
        {onToday && <button className="today-btn" onClick={onToday}>Hoje</button>}
      </div>
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
        <div className="name" style={{ color: `color-mix(in srgb, ${color} 70%, var(--text))` }}>{p.name}</div>
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

export function Chips({ options, value, onChange, multi = false, small = false, equal = false }) {
  const isOn = (v) => (multi ? value.includes(v) : value === v)
  const click = (v) => {
    if (multi) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
    else onChange(v)
  }
  return (
    <div className={`chips${equal ? ' equal' : ''}`}>
      {options.map((o) => (
        <button type="button" key={o.value} className={`chip${small ? ' small' : ''}${isOn(o.value) ? ' on' : ''}`} onClick={() => click(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
