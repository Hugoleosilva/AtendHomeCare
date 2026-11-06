import { useMemo } from 'react'
import { companyOf, entriesOnDay, monthStats, occurrences, timeOf } from '../lib/core'
import { WD_SHORT, addDays, addMonths, brl, eachDay, fmtLongDate, fmtMonth, fmtShort, monthOf, monthRange, today, weekStart, weekday } from '../lib/dates'
import { useStore } from '../lib/store'
import { EntryRow, PeriodNav } from '../ui'

const iconOf = (o) => (o.isReplacement ? (o.status === 'absent' ? '❌' : '🔄') : { done: '✅', absent: '❌', swapped: '⚠️', pending: '' }[o.status])

function DayList({ date, onOpenPatient, onOpenStatus }) {
  const { state } = useStore()
  const entries = entriesOnDay(state, date)
  if (!entries.length) return <div className="empty">Nenhum atendimento neste dia.<br />Use “Novo paciente” para incluir.</div>
  return entries.map((e) => <EntryRow key={e.key} state={state} entry={e} onOpenPatient={onOpenPatient} onOpenStatus={onOpenStatus} />)
}

export function DayScreen({ date, setDate, onOpenPatient, onOpenStatus }) {
  const t = today()
  const label = date === t ? 'Hoje' : date === addDays(t, 1) ? 'Amanhã' : date === addDays(t, -1) ? 'Ontem' : 'Atendimentos'
  return (
    <>
      <PeriodNav label={label} onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} onToday={date !== t ? () => setDate(t) : null} />
      <p className="sub" style={{ textAlign: 'center', marginTop: -8 }}>{fmtLongDate(date)}</p>
      <DayList date={date} onOpenPatient={onOpenPatient} onOpenStatus={onOpenStatus} />
    </>
  )
}

export function WeekScreen({ date, setDate, onPickDay }) {
  const { state } = useStore()
  const start = weekStart(date)
  const days = eachDay(start, addDays(start, 6))
  const occ = useMemo(() => occurrences(state, days[0], days[6]), [state, days[0]])
  const t = today()
  return (
    <>
      <PeriodNav label={`${fmtShort(days[0])} – ${fmtShort(days[6])}`} onPrev={() => setDate(addDays(date, -7))} onNext={() => setDate(addDays(date, 7))} onToday={weekStart(t) !== start ? () => setDate(t) : null} />
      <div className="weeks">
        {days.map((d) => {
          const list = occ.filter((o) => o.date === d).sort((a, b) => (timeOf(a) || '99').localeCompare(timeOf(b) || '99'))
          return (
            <button className={`week${d === t ? ' is-today' : ''}`} key={d} onClick={() => onPickDay(d)}>
              <div className={`d${d === t ? ' today' : ''}`}><span>{WD_SHORT[weekday(d)].toUpperCase()}</span><b>{Number(d.slice(8))}</b></div>
              <ul>
                {list.length === 0 && <li className="muted">livre</li>}
                {list.map((o) => {
                  const c = companyOf(state, o.patient.companyId)
                  return (
                    <li key={o.key}>
                      <i style={{ background: c?.color || '#888' }} />
                      <span style={{ flex: 1 }}>{timeOf(o) ? `${timeOf(o)} ` : ''}{o.patient.name}</span>
                      <span>{iconOf(o)}</span>
                    </li>
                  )
                })}
              </ul>
            </button>
          )
        })}
      </div>
    </>
  )
}

export function MonthScreen({ ym, setYm, date, setDate, onOpenPatient, onOpenStatus, onOpenClosing }) {
  const { state } = useStore()
  const { first, last } = monthRange(ym)
  // grade completa de semanas (inclui dias do mês anterior e do seguinte, esmaecidos)
  const gridStart = weekStart(first)
  const gridEnd = addDays(last, 6 - weekday(last))
  const days = eachDay(gridStart, gridEnd)
  const occ = useMemo(() => occurrences(state, gridStart, gridEnd), [state, ym])
  const stats = useMemo(() => monthStats(state, ym), [state, ym])
  const t = today()
  const byDay = {}
  for (const o of occ) (byDay[o.date] ||= []).push(o)
  for (const k of Object.keys(byDay)) byDay[k].sort((a, b) => (timeOf(a) || '99').localeCompare(timeOf(b) || '99'))
  const sel = date.startsWith(ym) ? date : first
  const usedCompanies = state.companies.filter((c) => state.patients.some((p) => p.companyId === c.id))
  const netNow = stats.companies.reduce((s, c) => s + c.net, 0)

  return (
    <div className="month-wrap">
      <div>
        <PeriodNav label={fmtMonth(ym)} onPrev={() => setYm(addMonths(ym, -1))} onNext={() => setYm(addMonths(ym, 1))} onToday={monthOf(t) !== ym || sel !== t ? () => setDate(t) : null} />
        <div className="mgrid" role="grid">
          {WD_SHORT.map((w, i) => <div className={`mwd${i === 0 || i === 6 ? ' we' : ''}`} key={w}>{w}</div>)}
          {days.map((d) => {
            const list = byDay[d] || []
            const out = !d.startsWith(ym)
            const wd = weekday(d)
            return (
              <button key={d} className={`mcell${out ? ' out' : ''}${wd === 0 || wd === 6 ? ' we' : ''}${d === t ? ' today' : ''}${d === sel ? ' sel' : ''}`} onClick={() => setDate(d)} aria-label={fmtLongDate(d)}>
                <span className="dn">{Number(d.slice(8))}</span>
                <span className="dots">
                  {list.slice(0, 6).map((o) => (
                    <i key={o.key} className={o.status === 'absent' ? 'miss' : ''} style={{ background: companyOf(state, o.patient.companyId)?.color || '#888', opacity: o.status === 'swapped' ? 0.35 : 1 }} />
                  ))}
                </span>
                <span className="evs">
                  {list.slice(0, 3).map((o) => (
                    <span key={o.key} className={`ev${o.status === 'absent' ? ' miss' : ''}${o.status === 'swapped' ? ' faded' : ''}`} style={{ '--c': companyOf(state, o.patient.companyId)?.color || '#888' }}>
                      <span className="t">{timeOf(o)}</span>
                      <span className="n">{o.patient.name}</span>
                      <span className="s">{iconOf(o)}</span>
                    </span>
                  ))}
                  {list.length > 3 && <span className="more">+{list.length - 3} mais</span>}
                </span>
              </button>
            )
          })}
        </div>
        <div className="legend">
          {usedCompanies.map((c) => <span key={c.id}><b style={{ background: c.color }} />{c.name}</span>)}
          <span>✅ atendido · ❌ falta · ⚠️ trocado · 🔄 reposição</span>
        </div>

        <button className="card" style={{ width: '100%', textAlign: 'left' }} onClick={onOpenClosing}>
          <div className="kv"><span className="muted">Recebido até agora (líquido)</span><span className="money green">{brl(netNow)}</span></div>
          <div className="kv"><span className="muted">Projeção do mês</span><span className="money">{brl(stats.total.projNet)}</span></div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Competência {fmtMonth(ym)} · toque para ver o fechamento ›</div>
        </button>
      </div>
      <div>
        <h2>{fmtLongDate(sel)}</h2>
        <DayList date={sel} onOpenPatient={onOpenPatient} onOpenStatus={onOpenStatus} />
      </div>
    </div>
  )
}
