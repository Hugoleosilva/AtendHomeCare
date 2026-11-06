import { useMemo, useState } from 'react'
import { competencyOf, occurrences } from '../lib/core'
import { addMonths, fmtBR, monthRange } from '../lib/dates'
import { blankDoc, resolveDocs } from '../lib/docs'
import { FONTS, buildGroups, exportExcel, exportPdf, fileBase } from '../lib/exporter'
import { useStore } from '../lib/store'
import { Back, Chips, Field } from '../ui'
import DocEditor from './DocEditor'

export default function Evolution({ ym: initialYm, onBack }) {
  const { state, upsert } = useStore()
  const [companyId, setCompanyId] = useState(state.companies[0]?.id || '')
  const [ym, setYm] = useState(initialYm)
  const [custom, setCustom] = useState(false)
  const [from, setFrom] = useState(monthRange(initialYm).first)
  const [to, setTo] = useState(monthRange(initialYm).last)
  const [sel, setSel] = useState([]) // vazio = todos os pacientes
  const [procs, setProcs] = useState([]) // vazio = todos
  const [withObs, setWithObs] = useState(false)
  const [docSel, setDocSel] = useState('')
  const [hdrMode, setHdrMode] = useState('auto') // mês do cabeçalho: auto (do período) | custom | blank
  const [hdrYm, setHdrYm] = useState(initialYm)
  const [blankNoMonth, setBlankNoMonth] = useState(true) // documento em branco: mês sem preenchimento (só a linha)
  const [evoFont, setEvoFontState] = useState(() => { try { const f = localStorage.getItem('homecare:evofont'); return FONTS[f] ? f : 'arial' } catch { return 'arial' } })
  const setEvoFont = (f) => { setEvoFontState(f); try { localStorage.setItem('homecare:evofont', f) } catch { /* ignore */ } }
  const [editor, setEditor] = useState(null) // { cfg, isNew }
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const company = state.companies.find((c) => c.id === companyId)
  const docs = resolveDocs(company)
  const cfg = docs.find((d) => d.id === docSel) || docs[0]
  const companyPatients = state.patients.filter((p) => p.companyId === companyId).sort((a, b) => a.name.localeCompare(b.name))
  const chosen = sel.length ? companyPatients.filter((p) => sel.includes(p.id)) : companyPatients

  const groups = useMemo(() => {
    if (!company) return []
    const ids = new Set(chosen.map((p) => p.id))
    const win = custom ? [from, to] : [`${addMonths(ym, -1)}-01`, monthRange(addMonths(ym, 1)).last]
    let occ = occurrences({ ...state, patients: state.patients.filter((p) => ids.has(p.id)) }, win[0], win[1]).filter((o) => o.status === 'done')
    occ = custom ? occ : occ.filter((o) => competencyOf(company, o.date, o.rec) === ym)
    if (procs.length) occ = occ.filter((o) => (o.rec.items || []).some((i) => procs.includes(i.procId)))
    return buildGroups(state, occ)
  }, [state, company, chosen.map((p) => p.id).join(), ym, custom, from, to, procs.join()])

  const total = groups.reduce((s, g) => s + g.rows.length, 0)
  const refYm = custom ? from.slice(0, 7) : ym

  const saveDocs = (list) => upsert('companies', { ...company, docs: list })
  const onSaveDoc = (d) => {
    saveDocs(docs.some((x) => x.id === d.id) ? docs.map((x) => (x.id === d.id ? d : x)) : [...docs, d])
    setDocSel(d.id)
    setEditor(null)
  }
  const onDeleteDoc = (id) => { saveDocs(docs.filter((x) => x.id !== id)); setDocSel(''); setEditor(null) }
  const onResetDocs = () => { upsert('companies', { ...company, docs: undefined }); setDocSel(''); setEditor(null) }

  const headerMonth = hdrMode === 'blank' ? 'blank' : hdrMode === 'custom' ? hdrYm : 'auto'
  const run = async (kind, blank = false) => {
    if (!blank && !groups.length) return setMsg('Nada para exportar com estes filtros.')
    setBusy(blank ? `${kind}-blank` : kind); setMsg('')
    try {
      const args = blank
        ? { company, ym: refYm, groups: [{ patient: { id: 'blank', name: '' }, rows: [] }], withObs: false, cfg, evoFont, blank: true, headerMonth: blankNoMonth ? 'blank' : headerMonth, base: `${fileBase({ company, ym: refYm, patients: [{ name: 'x' }], allSelected: true, cfg }).split('_').slice(0, -3).join('_')}_${cfg.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_EM_BRANCO` }
        : { company, ym: refYm, groups, withObs, cfg, evoFont, headerMonth, base: fileBase({ company, ym: refYm, patients: groups.map((g) => g.patient), allSelected: !sel.length, cfg }) }
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
      <div className="chips equal">
        {state.companies.map((c) => (
          <button key={c.id} className={`chip${companyId === c.id ? ' on' : ''}`} style={companyId === c.id ? { background: c.color, borderColor: c.color, color: '#111' } : { borderLeft: `6px solid ${c.color}` }} onClick={() => { setCompanyId(c.id); setSel([]); setDocSel('') }}>{c.name}</button>
        ))}
      </div>

      <span className="lbl" style={{ marginTop: 14 }}>Pacientes {companyPatients.length ? (sel.length ? `(${sel.length} selecionado${sel.length > 1 ? 's' : ''})` : '(todos)') : ''}</span>
      {companyPatients.length ? (
        <>
          <div className="chips">
            <button className={`chip small${!sel.length ? ' on' : ''}`} onClick={() => setSel([])} title="Inclui todos os pacientes da empresa">Todos os pacientes</button>
            {companyPatients.map((p) => (
              <button key={p.id} className={`chip small${sel.includes(p.id) ? ' on' : ''}`} onClick={() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id])}>{p.name}</button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Toque em um ou mais nomes para escolher só eles. “Todos os pacientes” volta ao padrão.</div>
        </>
      ) : <div className="card muted">Nenhum paciente cadastrado nesta empresa. Cadastre em <b>Pacientes</b> para gerar documentos.</div>}

      <h2>Documento</h2>
      <div className="chips equal">
        {docs.map((d) => (
          <button key={d.id} className={`chip small${cfg?.id === d.id ? ' on' : ''}`} onClick={() => setDocSel(d.id)}>{d.name}</button>
        ))}
        <button className="chip small dashed" onClick={() => setEditor({ cfg: blankDoc(cfg), isNew: true })}>＋ Novo documento</button>
      </div>
      <div className="inline" style={{ marginTop: 8 }}>
        <button className="link" onClick={() => setEditor({ cfg, isNew: false })}>✏️ Editar “{cfg?.name}”</button>
      </div>

      <h2>Mês no cabeçalho do documento</h2>
      <Chips small value={hdrMode} onChange={setHdrMode} options={[{ value: 'auto', label: 'Mesmo do período' }, { value: 'custom', label: 'Escolher outro mês' }, { value: 'blank', label: 'Em branco (preencher à mão)' }]} />
      {hdrMode === 'custom' && <input type="month" style={{ marginTop: 8 }} value={hdrYm} onChange={(e) => e.target.value && setHdrYm(e.target.value)} />}
      {hdrMode === 'blank' && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>O mês sai como uma linha vazia, como na ficha de papel.</div>}

      <h2>Fonte da evolução</h2>
      <Chips small value={evoFont} onChange={setEvoFont} options={Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label }))} />
      {evoFont !== 'arial' && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          No PDF a fonte já vai embutida. No Excel, ela aparece se estiver instalada no computador: <a className="link" href={FONTS[evoFont].file} download>baixar {FONTS[evoFont].xl}</a> e abrir o arquivo → Instalar. Sem ela, o Excel usa uma fonte comum no lugar.
        </div>
      )}

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
                  <tr key={r.date}><td>{fmtBR(r.date)}</td><td>{r.specialty}</td><td style={{ minWidth: 160, fontFamily: evoFont === 'arial' ? undefined : `'${FONTS[evoFont].xl}', cursive`, fontSize: evoFont === 'caveat' ? 17 : undefined }}>{r.evolution || <span className="muted">—</span>}</td>{withObs && <td style={{ minWidth: 140 }}>{r.observation}</td>}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!groups.length && <div className="empty">Nenhum atendimento realizado com estes filtros.</div>}

      <div className="actions">
        <button className="btn" disabled={!!busy || !groups.length} onClick={() => run('xlsx')}>{busy === 'xlsx' ? 'Gerando…' : 'Baixar Excel'}</button>
        <button className="btn ghost" disabled={!!busy || !groups.length} onClick={() => run('pdf')}>{busy === 'pdf' ? 'Gerando…' : 'Baixar PDF'}</button>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <b>Documento em branco</b>
        <div className="muted" style={{ fontSize: 13, margin: '4px 0 10px' }}>“{cfg?.name}” com logo, título e linhas vazias, sem dados de paciente. Útil para preencher à mão, repor uma via perdida ou fazer um complemento de última hora.</div>
        <label className="inline" style={{ margin: '0 0 10px' }}>
          <input type="checkbox" checked={blankNoMonth} onChange={(e) => setBlankNoMonth(e.target.checked)} style={{ width: 22, height: 22 }} /> Deixar o mês sem preenchimento (só a linha, para escrever à mão)
        </label>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn ghost" disabled={!!busy || !cfg} onClick={() => run('xlsx', true)}>{busy === 'xlsx-blank' ? 'Gerando…' : 'Em branco (Excel)'}</button>
          <button className="btn ghost" disabled={!!busy || !cfg} onClick={() => run('pdf', true)}>{busy === 'pdf-blank' ? 'Gerando…' : 'Em branco (PDF)'}</button>
        </div>
      </div>
      {msg && <div className="card" style={{ marginTop: 12, wordBreak: 'break-all' }}>{msg}</div>}

      {editor && (
        <DocEditor
          key={editor.cfg.id + (editor.isNew ? 'n' : 'e')}
          initial={editor.cfg}
          isNew={editor.isNew}
          canDelete={docs.length > 1}
          onSave={onSaveDoc}
          onDelete={() => onDeleteDoc(editor.cfg.id)}
          onReset={onResetDocs}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}
