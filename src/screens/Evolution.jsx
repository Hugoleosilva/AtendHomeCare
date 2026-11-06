import { useMemo, useState } from 'react'
import { competencyOf, occurrences } from '../lib/core'
import { addMonths, fmtBR, monthRange } from '../lib/dates'
import { buildGroups, exportExcel, exportPdf, fileBase } from '../lib/exporter'
import { useStore } from '../lib/store'
import { Back, Chips, Field } from '../ui'

export default function Evolution({ ym: initialYm, onBack }) {
  const { state } = useStore()
  const [companyId, setCompanyId] = useState(state.companies[0]?.id || '')
  const [ym, setYm] = useState(initialYm)
  const [custom, setCustom] = useState(false)
  const [from, setFrom] = useState(monthRange(initialYm).first)
  const [to, setTo] = useState(monthRange(initialYm).last)
  const [sel, setSel] = useState([]) // vazio = todos
  const [procs, setProcs] = useState([]) // vazio = todos
  const [withObs, setWithObs] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const company = state.companies.find((c) => c.id === companyId)
  const companyPatients = state.patients.filter((p) => p.companyId === companyId).sort((a, b) => a.name.localeCompare(b.name))
  const chosen = sel.length ? companyPatients.filter((p) => sel.includes(p.id)) : companyPatients

  const groups = useMemo(() => {
    if (!company) return []
    const ids = new Set(chosen.map((p) => p.id))
    const win = custom ? [from, to] : [`${addMonths(ym, -1)}-01`, monthRange(addMonths(ym, 1)).last]
    let occ = occurrences({ ...state, patients: state.patients.filter((p) => ids.has(p.id)) }, win[0], win[1]).filter((o) => o.status === 'done')
    occ = custom ? occ : occ.filter((o) => competencyOf(company, o.date, o.rec) === ym)
    if (procs.length) occ = occ.filter((o) => (o.rec.items || []).some((i) => procs.includes(i.procId)))
    return buildGroups(state, occ, withObs)
  }, [state, company, chosen.map((p) => p.id).join(), ym, custom, from, to, procs.join(), withObs])

  const total = groups.reduce((s, g) => s + g.rows.length, 0)
  const refYm = custom ? from.slice(0, 7) : ym

  const run = async (kind) => {
    if (!groups.length) return setMsg('Nada para exportar com estes filtros.')
    setBusy(kind); setMsg('')
    try {
      const args = { company, ym: refYm, groups, withObs, base: fileBase({ company, ym: refYm, patients: groups.map((g) => g.patient), allSelected: !sel.length }) }
      await (kind === 'xlsx' ? exportExcel(args) : exportPdf(args))
      setMsg(`${args.base}.${kind} gerado.`)
    } catch (e) {
      setMsg('Não foi possível gerar o arquivo: ' + e.message)
    }
    setBusy('')
  }

  return (
    <>
      <Back onClick={onBack} />
      <h1>Evolução</h1>
      <p className="sub">Filtre, confira na tabela e baixe a planilha da empresa.</p>

      <span className="lbl">Empresa</span>
      <div className="chips">
        {state.companies.map((c) => (
          <button key={c.id} className={`chip${companyId === c.id ? ' on' : ''}`} style={companyId === c.id ? { background: c.color, color: '#111' } : { borderLeft: `6px solid ${c.color}` }} onClick={() => { setCompanyId(c.id); setSel([]) }}>{c.name}</button>
        ))}
      </div>

      <span className="lbl" style={{ marginTop: 14 }}>Pacientes {sel.length ? `(${sel.length})` : '(todos)'}</span>
      <div className="chips">
        <button className={`chip small${!sel.length ? ' on' : ''}`} onClick={() => setSel([])}>Todos</button>
        {companyPatients.map((p) => (
          <button key={p.id} className={`chip small${sel.includes(p.id) ? ' on' : ''}`} onClick={() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id])}>{p.name}</button>
        ))}
        {!companyPatients.length && <span className="muted">Sem pacientes nesta empresa.</span>}
      </div>

      <h2>Período</h2>
      <div className="chips" style={{ marginBottom: 8 }}>
        <button className={`chip small${!custom ? ' on' : ''}`} onClick={() => setCustom(false)}>Competência (mês da folha)</button>
        <button className={`chip small${custom ? ' on' : ''}`} onClick={() => setCustom(true)}>Datas específicas</button>
      </div>
      {custom ? (
        <div className="inline"><Field label="De"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Até"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>
      ) : <input type="month" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} />}

      <h2>Procedimentos {procs.length ? `(${procs.length})` : '(todos)'}</h2>
      <Chips multi small value={procs} onChange={setProcs} options={state.procedures.map((p) => ({ value: p.id, label: p.name }))} />

      <label className="inline" style={{ margin: '14px 0' }}>
        <input type="checkbox" checked={withObs} onChange={(e) => setWithObs(e.target.checked)} style={{ width: 22, height: 22 }} /> Incluir observações (aparecem abaixo da tabela)
      </label>

      <h2>{total} atendimento(s) realizado(s)</h2>
      {groups.map(({ patient, rows }) => (
        <div className="card" key={patient.id}>
          <b>{patient.name}</b> <span className="muted">· {rows.length}</span>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Data</th><th>Proc.</th><th>Evolução</th>{withObs && <th>Observação</th>}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}><td>{fmtBR(r.date)}</td><td>{r.specialty}</td><td style={{ minWidth: 160 }}>{r.evolution || <span className="muted">—</span>}</td>{withObs && <td style={{ minWidth: 140 }}>{r.observation}</td>}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!groups.length && <div className="empty">Nenhum atendimento realizado com estes filtros.</div>}

      {company && <p className="muted" style={{ fontSize: 13 }}>Modelo: {company.layout === 'reintegrar' ? 'Ficha de Frequência (Reintegrar)' : company.layout === 'residencia' ? 'Evolução Clínica (Saúde Residência)' : 'Tabela padrão'} · mude em Empresas.</p>}
      <div className="actions">
        <button className="btn" disabled={!!busy || !groups.length} onClick={() => run('xlsx')}>{busy === 'xlsx' ? 'Gerando…' : 'Baixar Excel'}</button>
        <button className="btn ghost" disabled={!!busy || !groups.length} onClick={() => run('pdf')}>{busy === 'pdf' ? 'Gerando…' : 'Baixar PDF'}</button>
      </div>
      {msg && <div className="card" style={{ marginTop: 12, wordBreak: 'break-all' }}>{msg}</div>}
    </>
  )
}
