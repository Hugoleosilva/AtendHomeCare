import { useMemo } from 'react'
import { companyOf, entriesOnDay, monthStats, occurrences, timeOf } from '../lib/core'
import { WD_SHORT, addDays, addMonths, brl, eachDay, fmtLongDate, fmtMonth, fmtShort, monthRange, parse, today, weekStart, weekday } from '../lib/dates'
import { useStore } from '../lib/store'
import { EntryRow, PeriodNav } from '../ui'

function DayList({ date, onOpenPatient, onOpenStatus }) {
  const { state } = useStore()
  const entries = entriesOnDay(state, date)
  if (!entries.length) return <div className="empty">Nenhum atendimento neste dia.<br />Toque em + para incluir um paciente.</div>
  return entries.map((e) => <EntryRow key={e.key} state={state} entry={e} onOpenPatient={onOpenPatient} onOpenStatus={onOpenStatus} />)
}

export function DayScreen({ date, setDate, onOpenPatient, onOpenStatus }) {
  const t = today()
  const label = date === t ? 'Hoje' : date === addDays(t, 1) ? 'Amanhã' : date === addDays(t, -1) ? 'Ontem' : 'Atendimentos'
  return (
    <>
      <PeriodNav label={label} onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} />
      <p className="sub" style={{ textAlign: 'center', marginTop: -8 }}>
        {fmtLongDate(date)}
        {date !== t && <button className="link" onClick={() => setDate(t)}> · ir para hoje</button>}
      </p>
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
      <PeriodNav label={`${fmtShort(days[0])} – ${fmtShort(days[6])}`} onPrev={() => setDate(addDays(date, -7))} onNext={() => setDate(addDays(date, 7))} />
      {days.map((d) => {
        const list = occ.filter((o) => o.date === d).sort((a, b) => (timeOf(a) || '99').localeCompare(timeOf(b) || '99'))
        return (
          <button className="week" key={d} onClick={() => onPickDay(d)}>
            <div className={`d${d === t ? ' today' : ''}`}>{WD_SHORT[weekday(d)].toUpperCase()}<b>{Number(d.slice(8))}</b></div>
            <ul>
              {list.length === 0 && <li className="muted">livre</li>}
              {list.map((o) => {
                const c = companyOf(state, o.patient.companyId)
                const icon = o.isReplacement ? '🔄' : { done: '✅', absent: '❌', swapped: '⚠️', pending: '' }[o.status]
                return (
                  <li key={o.key}>
                    <i style={{ background: c?.color || '#888' }} />
                    <span style={{ flex: 1 }}>{timeOf(o) ? `${timeOf(o)} ` : ''}{o.patient.name}</span>
                    <span>{icon}</span>
                  </li>
                )
              })}
            </ul>
          </button>
        )
      })}
    </>
  )
}

export function MonthScreen({ ym, setYm, date, setDate, onOpenPatient, onOpenStatus, onOpenClosing }) {
  const { state } = useStore()
  const { first, last } = monthRange(ym)
  const lead = weekday(first)
  const occ = useMemo(() => occurrences(state, first, last), [state, ym])
  const stats = useMemo(() => monthStats(state, ym), [state, ym])
  const t = today()
  const byDay = {}
  for (const o of occ) (byDay[o.date] ||= []).push(o)
  const cells = [...Array(lead).fill(null), ...eachDay(first, last)]
  const sel = date.startsWith(ym) ? date : first
  const usedCompanies = state.companies.filter((c) => state.patients.some((p) => p.companyId === c.id))
  const netNow = stats.companies.reduce((s, c) => s + c.net, 0)

  return (
    <>
      <PeriodNav label={fmtMonth(ym)} onPrev={() => setYm(addMonths(ym, -1))} onNext={() => setYm(addMonths(ym, 1))} />
      <div className="cal">
        {WD_SHORT.map((w) => <div className="wd" key={w}>{w}</div>)}
        {cells.map((d, i) =>
          d ? (
            <button key={d} className={`day${d === t ? ' today' : ''}${d === sel ? ' sel' : ''}`} onClick={() => setDate(d)}>
              {Number(d.slice(8))}
              <span className="dots">
                {(byDay[d] || []).slice(0, 6).map((o) => (
                  <i key={o.key} className={o.status === 'absent' ? 'miss' : ''} style={{ background: companyOf(state, o.patient.companyId)?.color || '#888', opacity: o.status === 'swapped' ? 0.35 : 1 }} />
                ))}
              </span>
            </button>
          ) : (
            <div key={`e${i}`} />
          ),
        )}
      </div>
      <div className="legend">
        {usedCompanies.map((c) => <span key={c.id}><b style={{ background: c.color }} />{c.name}</span>)}
      </div>

      <button className="card" style={{ width: '100%', textAlign: 'left' }} onClick={onOpenClosing}>
        <div className="kv"><span className="muted">Recebido até agora (líquido)</span><span className="money green">{brl(netNow)}</span></div>
        <div className="kv"><span className="muted">Projeção do mês</span><span className="money">{brl(stats.total.projNet)}</span></div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Competência {fmtMonth(ym)} · toque para ver o fechamento ›</div>
      </button>

      <h2>{fmtLongDate(sel)}</h2>
      <DayList date={sel} onOpenPatient={onOpenPatient} onOpenStatus={onOpenStatus} />
    </>
  )
}
