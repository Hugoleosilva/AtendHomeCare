import { useState } from 'react'
import { SOURCES, TOKENS } from '../lib/docs'
import { Chips, Field, Sheet } from '../ui'

const move = (arr, i, d) => {
  const j = i + d
  if (j < 0 || j >= arr.length) return arr
  const a = [...arr]
  ;[a[i], a[j]] = [a[j], a[i]]
  return a
}

// Editor de um documento (ficha) da empresa: título, campos, colunas, rodapé e cores.
export default function DocEditor({ initial, canDelete, isNew, onSave, onDelete, onReset, onClose }) {
  const [f, setF] = useState(() => JSON.parse(JSON.stringify(initial)))
  const [err, setErr] = useState('')
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const setStyle = (p) => setF((x) => ({ ...x, style: { ...x.style, ...p } }))
  const setCol = (i, p) => set({ columns: f.columns.map((c, n) => (n === i ? { ...c, ...p } : c)) })
  const setField = (li, fi, p) => set({ fields: f.fields.map((line, a) => (a === li ? line.map((fl, b) => (b === fi ? { ...fl, ...p } : fl)) : line)) })

  const save = () => {
    if (!f.name.trim()) return setErr('Dê um nome ao documento.')
    if (!f.columns.length) return setErr('Inclua ao menos uma coluna na tabela.')
    if (f.columns.some((c) => !c.h.trim())) return setErr('Toda coluna precisa de um título.')
    onSave({ ...f, name: f.name.trim(), fields: f.fields.filter((l) => l.length) })
  }

  return (
    <Sheet onClose={onClose}>
      <h3>{isNew ? 'Novo documento' : 'Editar documento'}</h3>
      <p className="sub">Monte a ficha como a empresa pede. Os textos aceitam marcadores que são trocados na exportação.</p>

      <Field label="Nome do documento (aparece no botão)"><input type="text" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>

      <h2>Cabeçalho</h2>
      <Field label="Título da ficha"><input type="text" value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <span className="lbl">Alinhamento do título</span>
      <Chips small value={f.titleAlign} onChange={(v) => set({ titleAlign: v })} options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }]} />
      <Field label="Texto ao lado do título (ex.: nome do hospital) — opcional"><input type="text" value={f.headerText || ''} onChange={(e) => set({ headerText: e.target.value })} /></Field>
      <span className="lbl">Posição do logo da empresa</span>
      <Chips small value={f.logoSide} onChange={(v) => set({ logoSide: v })} options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Direita' }]} />

      <h2>Campos acima da tabela</h2>
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Cada linha pode ter 1 ou 2 campos. Ex.: “Paciente:” → {'{paciente}'}.</div>
      {f.fields.map((line, li) => (
        <div className="card" key={li}>
          {line.map((fl, fi) => (
            <div className="inline" key={fi} style={{ marginBottom: 8 }}>
              <input type="text" placeholder="Rótulo (ex.: Paciente:)" value={fl.label} onChange={(e) => setField(li, fi, { label: e.target.value })} />
              <input type="text" placeholder="Valor (ex.: {paciente})" value={fl.value} onChange={(e) => setField(li, fi, { value: e.target.value })} />
              {line.length > 1 && <button type="button" className="btn danger" aria-label="Remover campo" onClick={() => set({ fields: f.fields.map((l, a) => (a === li ? l.filter((_, b) => b !== fi) : l)) })}>✕</button>}
            </div>
          ))}
          <div className="inline">
            {line.length < 2 && <button type="button" className="chip small" onClick={() => set({ fields: f.fields.map((l, a) => (a === li ? [...l, { label: '', value: '' }] : l)) })}>+ campo na mesma linha</button>}
            <button type="button" className="chip small" onClick={() => set({ fields: move(f.fields, li, -1) })} aria-label="Subir linha">↑</button>
            <button type="button" className="chip small" onClick={() => set({ fields: move(f.fields, li, 1) })} aria-label="Descer linha">↓</button>
            <button type="button" className="chip small" style={{ color: 'var(--bad)' }} onClick={() => set({ fields: f.fields.filter((_, a) => a !== li) })}>Remover linha</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost block" onClick={() => set({ fields: [...f.fields, [{ label: '', value: '' }]] })}>+ Nova linha de campo</button>

      <h2>Colunas da tabela</h2>
      {f.columns.map((c, i) => (
        <div className="card" key={i}>
          <Field label="Título da coluna"><input type="text" value={c.h} onChange={(e) => setCol(i, { h: e.target.value })} /></Field>
          <Field label="O que preenche esta coluna">
            <select value={c.src} onChange={(e) => setCol(i, { src: e.target.value })}>{SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </Field>
          {c.src === 'text' && <Field label="Texto fixo (igual em todas as linhas)"><input type="text" value={c.text || ''} onChange={(e) => setCol(i, { text: e.target.value })} /></Field>}
          <div className="inline">
            <Field label="Largura (%)"><input type="number" min="5" max="90" value={c.w} onChange={(e) => setCol(i, { w: e.target.value })} /></Field>
            <div style={{ flex: 1 }}>
              <span className="lbl">Alinhamento</span>
              <Chips small value={c.align} onChange={(v) => setCol(i, { align: v })} options={[{ value: 'left', label: 'Esq.' }, { value: 'center', label: 'Centro' }]} />
            </div>
          </div>
          <div className="inline" style={{ marginTop: 8 }}>
            <button type="button" className="chip small" onClick={() => set({ columns: move(f.columns, i, -1) })} aria-label="Mover para a esquerda">← mover</button>
            <button type="button" className="chip small" onClick={() => set({ columns: move(f.columns, i, 1) })} aria-label="Mover para a direita">mover →</button>
            <button type="button" className="chip small" style={{ color: 'var(--bad)' }} onClick={() => set({ columns: f.columns.filter((_, n) => n !== i) })}>Remover coluna</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost block" onClick={() => set({ columns: [...f.columns, { h: 'Nova coluna', src: 'blank', w: 20, align: 'left' }] })}>+ Nova coluna</button>
      <Field label="Linhas em branco mínimas (a ficha sai com linhas vazias, como no papel)"><input type="number" min="0" max="80" value={f.minRows} onChange={(e) => set({ minRows: e.target.value })} /></Field>

      <h2>Rodapé</h2>
      <Field label="Texto do rodapé (uma linha por parágrafo)"><textarea value={(f.footer || []).join('\n')} onChange={(e) => set({ footer: e.target.value.split('\n') })} /></Field>
      <span className="lbl">Alinhamento</span>
      <Chips small value={f.footerAlign} onChange={(v) => set({ footerAlign: v })} options={[{ value: 'left', label: 'Esquerda' }, { value: 'center', label: 'Centro' }]} />
      <label className="inline" style={{ margin: '12px 0 4px' }}><input type="checkbox" checked={!!f.footerBold} onChange={(e) => set({ footerBold: e.target.checked })} style={{ width: 22, height: 22 }} /> Rodapé em negrito</label>
      <label className="inline" style={{ margin: '4px 0' }}><input type="checkbox" checked={!!f.stamp} onChange={(e) => set({ stamp: e.target.checked })} style={{ width: 22, height: 22 }} /> Incluir carimbo da profissional (nome, fisioterapeuta, CREFITO)</label>

      <h2>Aparência</h2>
      <span className="lbl">Fonte</span>
      <Chips small value={f.style.font} onChange={(v) => setStyle({ font: v })} options={[{ value: 'sans', label: 'Sem serifa' }, { value: 'serif', label: 'Com serifa' }]} />
      <div className="inline" style={{ flexWrap: 'wrap', marginTop: 12 }}>
        {[['line', 'Linhas da tabela'], ['headFill', 'Fundo do cabeçalho'], ['headText', 'Texto do cabeçalho'], ['titleColor', 'Cor do título'], ['footerColor', 'Cor do rodapé']].map(([k, label]) => (
          <label key={k} className="f" style={{ margin: '4px 12px 4px 0' }}>
            <span>{label}</span>
            <input type="color" value={f.style[k] || '#29b2e8'} onChange={(e) => setStyle({ [k]: e.target.value })} style={{ width: 64, height: 42, padding: 2 }} />
          </label>
        ))}
      </div>
      {!f.style.headFill && <div className="muted" style={{ fontSize: 13 }}>Fundo do cabeçalho em automático: usa a cor da empresa. Escolha uma cor para fixar.</div>}

      <h2>Marcadores disponíveis</h2>
      <div className="muted" style={{ fontSize: 13 }}>
        {TOKENS.map(([t, d]) => <span key={t} className="tag" title={d}>{t} = {d}</span>)}
      </div>

      {err && <div className="err">{err}</div>}
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        {!isNew && canDelete && <button className="btn danger" onClick={() => confirm(`Excluir o documento “${f.name}”?`) && onDelete()}>Excluir</button>}
        {!isNew && <button className="btn ghost" onClick={() => confirm('Restaurar os modelos padrão desta empresa? As edições feitas serão perdidas.') && onReset()}>Restaurar padrão</button>}
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn" onClick={save}>Salvar</button>
      </div>
    </Sheet>
  )
}
