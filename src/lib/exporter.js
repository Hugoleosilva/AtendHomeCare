import { PROFESSIONAL } from './core'
import { MONTHS, fmtBR } from './dates'

// ---------- utilidades ----------
const clean = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()
const genStamp = () => fmtBR(new Date().toISOString().slice(0, 10))
const generatedBy = () => `Gerado por ${PROFESSIONAL.name} em ${genStamp()}`
const profLine = `${PROFESSIONAL.name} - ${PROFESSIONAL.crefito}`
const hex = (c) => c.replace('#', '').toUpperCase()

export function fileBase({ company, ym, patients, allSelected }) {
  const mes = MONTHS[Number(ym.slice(5, 7)) - 1]
  const single = patients.length === 1 && !allSelected
  const tail = single ? `${clean(patients[0].name)}_EVOLUCAO` : 'PACIENTES_EVOLUCOES'
  return `${clean(company.name)}_${clean(mes)}_${ym.slice(0, 4)}_${tail}`
}

async function loadImage(src) {
  if (!src) return null
  try {
    const blob = await (await fetch(src)).blob()
    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
    const dims = await new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 1, h: 1 }); i.src = dataUrl })
    const ext = blob.type.includes('png') ? 'png' : 'jpeg'
    return { dataUrl, base64: dataUrl.split(',')[1], ext, ...dims }
  } catch {
    return null
  }
}

function download(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

// groups: [{ patient, rows: [{ date, specialty, procs, evolution, observation }] }]
const specialtyOf = (items, procedures) => {
  const codes = [...new Set((items || []).map((i) => procedures.find((p) => p.id === i.procId)?.code || 'M'))]
  return codes.join(' / ') || 'M'
}

export function buildGroups(state, occs, withObs) {
  const map = new Map()
  for (const o of occs) {
    if (!map.has(o.patient.id)) map.set(o.patient.id, { patient: o.patient, rows: [] })
    map.get(o.patient.id).rows.push({
      date: o.date,
      specialty: specialtyOf(o.rec.items, state.procedures),
      procs: (o.rec.items || []).map((i) => i.name).join(', '),
      evolution: o.rec.evolution || '',
      observation: withObs ? o.rec.observation || '' : '',
    })
  }
  return [...map.values()].sort((a, b) => a.patient.name.localeCompare(b.patient.name)).map((g) => ({ ...g, rows: g.rows.sort((a, b) => a.date.localeCompare(b.date)) }))
}

const periodLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const obsLines = (rows) => rows.filter((r) => r.observation).map((r) => `${fmtBR(r.date)} – ${r.observation}`)

const REI_FOOT = 'Endereço: Rua Santo Elias, 475, Espinheiro, Recife-PE, CEP 52020-095, Telefone: (81) 3072-6772, (81) 9.9742-7777, contato@reintegrarsaude.com.br'

// ---------- EXCEL ----------
export async function exportExcel({ company, ym, groups, withObs, base }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = PROFESSIONAL.name
  const logo = await loadImage(company.logo)
  const color = hex(company.color)
  const border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } }, left: { style: 'thin', color: { argb: 'FF9CA3AF' } }, bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } }, right: { style: 'thin', color: { argb: 'FF9CA3AF' } } }
  const used = new Set()

  for (const { patient, rows } of groups) {
    let name = patient.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || 'Paciente'
    while (used.has(name.toLowerCase())) name = name.slice(0, 26) + '_' + (used.size + 1)
    used.add(name.toLowerCase())
    const ws = wb.addWorksheet(name, { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
    const layout = company.layout || 'padrao'

    const cols = layout === 'reintegrar'
      ? [{ w: 16, h: 'Data' }, { w: 22, h: 'Especialidade' }, { w: 40, h: 'Profissional' }, { w: 34, h: 'Paciente/Responsável' }]
      : layout === 'residencia'
        ? [{ w: 14, h: 'Data' }, { w: 100, h: 'Evolução' }]
        : [{ w: 14, h: 'Data' }, { w: 34, h: 'Procedimentos' }, { w: 80, h: 'Evolução' }]
    ws.columns = cols.map((c) => ({ width: c.w }))
    const last = cols.length

    // Cabeçalho com logo
    if (logo) {
      const h = 64, w = Math.round((logo.w / logo.h) * h)
      const id = wb.addImage({ base64: logo.base64, extension: logo.ext })
      ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: w, height: h } })
    }
    ws.getRow(1).height = 24; ws.getRow(2).height = 24; ws.getRow(3).height = 14
    const title = layout === 'reintegrar' ? 'FICHA DE FREQUÊNCIA' : layout === 'residencia' ? 'Evolução Clínica' : `Evolução do Paciente – ${company.name}`
    ws.mergeCells(2, 1, 2, last)
    const t = ws.getCell(2, 1)
    t.value = title
    t.font = { bold: true, size: 16, color: { argb: 'FF' + (layout === 'residencia' ? '1F4E8C' : '1F2937') } }
    t.alignment = { horizontal: 'center', vertical: 'middle' }

    let r = 4
    const info = (label, value, span = last) => {
      ws.mergeCells(r, 1, r, span)
      const c = ws.getCell(r, 1)
      c.value = { richText: [{ text: `${label} `, font: { bold: true, size: 12 } }, { text: value, font: { size: 12 } }] }
      r++
    }
    if (layout === 'reintegrar') { info('Paciente:', patient.name); info('Convênio:', 'Fisio'); info('Mês de Ref.:', periodLabel(ym)) }
    else if (layout === 'residencia') { info('Nome:', patient.name); info('Competência:', periodLabel(ym)) }
    else { info('Paciente:', patient.name); info('Empresa:', company.name); info('Competência:', periodLabel(ym)) }
    r++

    // Tabela
    const head = ws.getRow(r)
    cols.forEach((c, i) => {
      const cell = head.getCell(i + 1)
      cell.value = c.h
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = border
    })
    head.height = 22
    r++
    for (const row of rows) {
      const vals = layout === 'reintegrar' ? [fmtBR(row.date), row.specialty, profLine, ''] : layout === 'residencia' ? [fmtBR(row.date), row.evolution] : [fmtBR(row.date), row.procs, row.evolution]
      const rr = ws.getRow(r)
      vals.forEach((v, i) => {
        const cell = rr.getCell(i + 1)
        cell.value = v
        cell.border = border
        cell.alignment = { vertical: 'top', wrapText: true, horizontal: i === 0 || layout === 'reintegrar' ? 'center' : 'left' }
      })
      rr.height = layout === 'reintegrar' ? 24 : Math.max(22, Math.ceil((row.evolution || '').length / 95) * 17)
      r++
    }

    // Observações: logo abaixo da última linha, fora da tabela
    const obs = withObs ? obsLines(rows) : []
    if (obs.length) {
      r++
      ws.mergeCells(r, 1, r, last)
      ws.getCell(r, 1).value = 'Observações:'
      ws.getCell(r, 1).font = { bold: true, size: 12 }
      r++
      for (const l of obs) {
        ws.mergeCells(r, 1, r, last)
        const c = ws.getCell(r, 1)
        c.value = l
        c.alignment = { wrapText: true, vertical: 'top' }
        ws.getRow(r).height = Math.max(18, Math.ceil(l.length / 120) * 16)
        r++
      }
    }

    r++
    ws.mergeCells(r, 1, r, last)
    const foot = ws.getCell(r, 1)
    foot.value = layout === 'residencia' ? `Toda anotação deve ser assinada e carimbada pelo profissional que o faz.  ${profLine}` : generatedBy()
    foot.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
    r++
    if (layout === 'residencia' || layout === 'padrao' || layout === 'reintegrar') {
      ws.mergeCells(r, 1, r, last)
      const g = ws.getCell(r, 1)
      g.value = layout === 'residencia' ? generatedBy() : layout === 'reintegrar' ? REI_FOOT : profLine
      g.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
      g.alignment = { wrapText: true }
      if (layout === 'reintegrar') ws.getRow(r).height = 28
      r++
      if (layout === 'reintegrar') {
        ws.mergeCells(r, 1, r, last)
        const g2 = ws.getCell(r, 1)
        g2.value = generatedBy()
        g2.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`)
}

// ---------- PDF ----------
export async function exportPdf({ company, ym, groups, withObs, base }) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const logo = await loadImage(company.logo)
  const rgb = (h) => [parseInt(hex(h).slice(0, 2), 16), parseInt(hex(h).slice(2, 4), 16), parseInt(hex(h).slice(4, 6), 16)]
  const layout = company.layout || 'padrao'
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  groups.forEach(({ patient, rows }, gi) => {
    if (gi) doc.addPage()
    let y = 36
    if (logo) {
      const h = 52, w = (logo.w / logo.h) * h
      doc.addImage(logo.dataUrl, logo.ext === 'png' ? 'PNG' : 'JPEG', 40, y, w, h)
    }
    y += 78
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(31, 41, 55)
    const title = layout === 'reintegrar' ? 'FICHA DE FREQUÊNCIA' : layout === 'residencia' ? 'Evolução Clínica' : `Evolução do Paciente – ${company.name}`
    doc.text(title, W / 2, y, { align: 'center' })
    y += 26
    doc.setFontSize(11)
    const info = (l, v) => { doc.setFont('helvetica', 'bold').text(`${l} `, 40, y); doc.setFont('helvetica', 'normal').text(v, 40 + doc.getTextWidth(`${l} `) + 2, y); y += 17 }
    if (layout === 'reintegrar') { info('Paciente:', patient.name); info('Convênio:', 'Fisio'); info('Mês de Ref.:', periodLabel(ym)) }
    else if (layout === 'residencia') { info('Nome:', patient.name); info('Competência:', periodLabel(ym)) }
    else { info('Paciente:', patient.name); info('Empresa:', company.name); info('Competência:', periodLabel(ym)) }

    const head = layout === 'reintegrar' ? ['Data', 'Especialidade', 'Profissional', 'Paciente/Responsável'] : layout === 'residencia' ? ['Data', 'Evolução'] : ['Data', 'Procedimentos', 'Evolução']
    const body = rows.map((r) => (layout === 'reintegrar' ? [fmtBR(r.date), r.specialty, profLine, ''] : layout === 'residencia' ? [fmtBR(r.date), r.evolution] : [fmtBR(r.date), r.procs, r.evolution]))
    autoTable(doc, {
      startY: y + 6, head: [head], body, theme: 'grid', margin: { left: 40, right: 40, bottom: 70 },
      styles: { fontSize: 10, cellPadding: 5, lineColor: [156, 163, 175], lineWidth: 0.5, minCellHeight: layout === 'reintegrar' ? 22 : 0 },
      headStyles: { fillColor: rgb(company.color), textColor: 255, halign: 'center' },
      columnStyles: layout === 'reintegrar' ? { 0: { halign: 'center', cellWidth: 70 }, 1: { halign: 'center', cellWidth: 80 }, 3: { cellWidth: 130 } } : { 0: { halign: 'center', cellWidth: 70 } },
    })
    let ey = doc.lastAutoTable.finalY + 18
    const obs = withObs ? obsLines(rows) : []
    if (obs.length) {
      doc.setFont('helvetica', 'bold').setFontSize(11).text('Observações:', 40, ey)
      ey += 15
      doc.setFont('helvetica', 'normal').setFontSize(10)
      for (const l of obs) {
        const lines = doc.splitTextToSize(l, W - 80)
        if (ey + lines.length * 13 > H - 60) { doc.addPage(); ey = 50 }
        doc.text(lines, 40, ey)
        ey += lines.length * 13 + 3
      }
    }
    doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(107, 114, 128)
    const pages = doc.getNumberOfPages()
    doc.setPage(pages)
    const foot = layout === 'residencia' ? [`Toda anotação deve ser assinada e carimbada pelo profissional que o faz.  ${profLine}`, generatedBy()] : layout === 'reintegrar' ? [REI_FOOT, generatedBy()] : [profLine, generatedBy()]
    let fy = H - 42
    for (const f of foot) { const ls = doc.splitTextToSize(f, W - 80); doc.text(ls, 40, fy); fy += ls.length * 10 }
  })

  doc.save(`${base}.pdf`)
}
