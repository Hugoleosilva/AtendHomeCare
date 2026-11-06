import { useMemo } from 'react'
import { monthStats } from '../lib/core'
import { addMonths, brl, fmtMonth } from '../lib/dates'
import { useStore } from '../lib/store'
import { Back, PeriodNav } from '../ui'

export default function Closing({ ym, setYm, onBack, onOpenPatient }) {
  const { state } = useStore()
  const stats = useMemo(() => monthStats(state, ym), [state, ym])
  const shown = stats.companies.filter((c) => c.patients.length || state.patients.some((p) => p.companyId === c.company.id))

  return (
    <>
      <Back onClick={onBack} />
      <h1>Fechamento</h1>
      <p className="sub">Competência (mês da folha). Só entram atendimentos marcados como realizados.</p>
      <PeriodNav label={fmtMonth(ym)} onPrev={() => setYm(addMonths(ym, -1))} onNext={() => setYm(addMonths(ym, 1))} />

      {shown.map(({ company, patients, gross, discounts, net, projNet, doneCount, pendingCount }) => (
        <div className="card" key={company.id} style={{ borderLeft: `6px solid ${company.color}` }}>
          <h2 style={{ margin: '0 0 8px', color: company.color }}>{company.name}</h2>
          {patients.map((r) => (
            <button key={r.patient.id} className="kv" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenPatient(r.patient.id)}>
              <span>{r.patient.name}<span className="muted"> · {r.done.length} atend.{r.absent.length ? ` · ${r.absent.length} falta(s)` : ''}</span></span>
              <span className="money">{brl(r.gross)}</span>
            </button>
          ))}
          {!patients.length && <div className="muted">Sem atendimentos nesta competência.</div>}
          <div style={{ height: 8 }} />
          <div className="kv"><span>Proventos <span className="muted">({doneCount} atend.)</span></span><span className="money">{brl(gross)}</span></div>
          {discounts.length ? discounts.map((d) => <div className="kv" key={d.name}><span>Desconto: {d.name} {d.percent}%</span><span className="money" style={{ color: 'var(--bad)' }}>− {brl(d.value)}</span></div>) : <div className="kv"><span>Descontos</span><span className="muted">N/A</span></div>}
          <div className="kv"><b>Líquido</b><b className="money green">{brl(net)}</b></div>
          {pendingCount > 0 && <div className="kv"><span className="muted">Projeção (+{pendingCount} a marcar)</span><span className="money">{brl(projNet)}</span></div>}
        </div>
      ))}

      <div className="card" style={{ background: '#1f2a1f' }}>
        <div className="muted">Total a receber no mês</div>
        <div className="big green money">{brl(stats.total.net)}</div>
        <div className="muted" style={{ marginTop: 6 }}>Projeção ao final do mês: <b className="money" style={{ color: 'var(--text)' }}>{brl(stats.total.projNet)}</b></div>
      </div>
    </>
  )
}
