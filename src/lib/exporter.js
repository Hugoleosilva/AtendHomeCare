import { PROFESSIONAL } from './core'
import { MONTHS, fmtBR } from './dates'

// Fontes da coluna de evolução. As cursivas são livres (licença OFL) e ficam em /public/fonts.
export const FONTS = {
  arial: { label: 'Normal (Arial)', xl: 'Arial', pdf: 'helvetica', file: null, size: 11 },
  shantell: { label: 'Cursiva – Shantell Sans', xl: 'Shantell Sans', pdf: 'ShantellSans', file: '/fonts/ShantellSans-Regular.ttf', size: 12 },
  caveat: { label: 'Cursiva – Caveat', xl: 'Caveat', pdf: 'Caveat', file: '/fonts/Caveat-Regular.ttf', size: 14 },
}

// ---------- utilidades ----------
const clean = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()
const genStamp = () => fmtBR(new Date().toISOString().slice(0, 10))
const generatedBy = () => `Gerado por ${PROFESSIONAL.name} em ${genStamp()}`
const profLine = `${PROFESSIONAL.name} - ${PROFESSIONAL.crefito}`
const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1]
const periodLabel = (ym) => `${monthName(ym)} ${ym.slice(0, 4)}`

export function fileBase({ company, ym, patients, allSelected, cfg }) {
  const single = patients.length === 1 && !allSelected
  const word = cfg?.fileWord || 'EVOLUCAO'
  const tail = single ? `${clean(patients[0].name)}_${word}` : `PACIENTES_${word === 'EVOLUCAO' ? 'EVOLUCOES' : word + 'S'}`
  return `${clean(company.name)}_${clean(monthName(ym))}_${ym.slice(0, 4)}_${tail}`
}

// Recorta a margem branca/transparente ao redor do logo (só no navegador; sem canvas, mantém o original).
function trimWhite(img, w, h) {
  try {
    if (!img || w < 2 || h < 2) return null
    const cv = document.createElement('canvas')
    cv.width = w; cv.height = h
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, w, h).data
    let x0 = w, y0 = h, x1 = -1, y1 = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const bg = d[i + 3] < 10 || (d[i] > 238 && d[i + 1] > 238 && d[i + 2] > 238)
        if (!bg) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      }
    }
    if (x1 < 0) return null
    const pad = 2
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad)
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1
    if (cw >= w - 4 && ch >= h - 4) return null // já está justo
    const out = document.createElement('canvas')
    out.width = cw; out.height = ch
    out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch)
    return { dataUrl: out.toDataURL('image/png'), w: cw, h: ch }
  } catch {
    return null
  }
}

// Altura do logo por tamanho escolhido: PDF em pontos, Excel em pixels.
const LOGO_PT = { sm: 40, md: 54, lg: 82 }
const LOGO_PX = { sm: 52, md: 70, lg: 108 }

async function loadImage(src) {
  if (!src) return null
  try {
    const blob = await (await fetch(src)).blob()
    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
    const dims = await new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight, el: i }); i.onerror = () => res({ w: 1, h: 1 }); i.src = dataUrl })
    const ext = blob.type.includes('png') ? 'png' : 'jpeg'
    const cropped = trimWhite(dims.el, dims.w, dims.h) // tira a margem branca do arquivo do logo
    if (cropped) return { dataUrl: cropped.dataUrl, base64: cropped.dataUrl.split(',')[1], ext: 'png', w: cropped.w, h: cropped.h }
    return { dataUrl, base64: dataUrl.split(',')[1], ext, w: dims.w, h: dims.h }
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

const specialtyOf = (items, procedures) => [...new Set((items || []).map((i) => procedures.find((p) => p.id === i.procId)?.code || 'M'))].join(' / ') || 'M'

export function buildGroups(state, occs) {
  const map = new Map()
  for (const o of occs) {
    if (!map.has(o.patient.id)) map.set(o.patient.id, { patient: o.patient, rows: [] })
    map.get(o.patient.id).rows.push({
      date: o.date,
      specialty: specialtyOf(o.rec.items, state.procedures),
      procs: (o.rec.items || []).map((i) => i.name).join(', '),
      evolution: o.rec.evolution || '',
      observation: o.rec.observation || '',
    })
  }
  return [...map.values()].sort((a, b) => a.patient.name.localeCompare(b.patient.name)).map((g) => ({ ...g, rows: g.rows.sort((a, b) => a.date.localeCompare(b.date)) }))
}
const obsLines = (rows) => rows.filter((r) => r.observation).map((r) => `${fmtBR(r.date)} – ${r.observation}`)

// ---------- modelo de cada ficha ----------
// A ficha é montada a partir da configuração (src/lib/docs.js), editável no app.
function spec(cfg, company, ym, patient, headerMonth = 'auto') {
  // mês mostrado no cabeçalho: do período (auto), outro mês escolhido ('AAAA-MM') ou em branco ('blank', para preencher à mão)
  const hm = headerMonth === 'blank' ? null : /^\d{4}-\d{2}$/.test(headerMonth) ? headerMonth : ym
  const ctx = { paciente: patient.name, empresa: company.name, mes: hm ? monthName(hm) : '', MES: hm ? monthName(hm).toUpperCase() : '', ano: hm ? hm.slice(0, 4) : '', competencia: hm ? periodLabel(hm) : '', profissional: PROFESSIONAL.name, crefito: PROFESSIONAL.crefito }
  const T = (str) => String(str ?? '').replace(/\{(\w+)\}/g, (m, k) => ctx[k] ?? m)
  const st = cfg.style || {}
  const hex = (c, fb) => String(c || fb).replace('#', '').toUpperCase()
  const serif = st.font === 'serif'
  const sum = cfg.columns.reduce((a, c) => a + (Number(c.w) || 1), 0)
  const getters = { date: (r) => fmtBR(r.date), sigla: (r) => r.specialty, procs: (r) => r.procs, evolution: (r) => r.evolution, observation: (r) => r.observation, professional: () => profLine, blank: () => '' }
  return {
    font: serif ? 'Times New Roman' : 'Calibri', pdfFont: serif ? 'times' : 'helvetica',
    line: hex(st.line, '9CA3AF'), headFill: hex(st.headFill || company.color, '29B2E8'), headText: hex(st.headText, 'FFFFFF'), titleColor: hex(st.titleColor, '1F2937'),
    // título que termina em campo de mês (ex.: “… - MÊS {MES}”): vira texto + linha para o mês, como no papel
    titleLine: (() => { const m = String(cfg.title || '').match(/^(.*?)\s*\{(MES|mes|competencia)\}\s*$/); return m ? { prefix: T(m[1]), value: T(`{${m[2]}}`) } : null })(),
    logoSide: cfg.logoSide || 'left', title: T(cfg.title), titleAlign: cfg.titleAlign || 'left', side: T(cfg.headerText || ''),
    minRows: Number(cfg.minRows) || 0,
    fields: (cfg.fields || []).filter((l) => l.length).map((line) => line.map((f) => [T(f.label), T(f.value)])),
    cols: cfg.columns.map((c) => ({
      h: T(c.h), pw: (Number(c.w) || 1) / sum, w: Math.max(8, Math.round(((Number(c.w) || 1) / sum) * 110)), center: c.align === 'center',
      get: c.src === 'text' ? () => T(c.text) : getters[c.src] || (() => ''), wrap: ['evolution', 'observation', 'procs'].includes(c.src), evo: c.src === 'evolution',
    })),
    footer: (cfg.footer || []).map(T).filter((x) => x.trim()), footerAlign: cfg.footerAlign || 'left', footerBold: !!cfg.footerBold, footerColor: hex(st.footerColor, '6B7280'),
    stamp: cfg.stamp ? [PROFESSIONAL.name, 'Fisioterapeuta', PROFESSIONAL.crefito.replace('CREFITO ', '')] : null,
  }
}

const hexRgb = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]

// ---------- EXCEL ----------
export async function exportExcel({ company, ym, groups, withObs, base, cfg, evoFont = 'arial', blank = false, headerMonth = 'auto' }) {
  const ef = FONTS[evoFont] || FONTS.arial
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = PROFESSIONAL.name
  const logo = await loadImage(company.logo)
  const used = new Set()

  for (const { patient, rows } of groups) {
    const sp = spec(cfg, company, ym, patient, headerMonth)
    if (blank) sp.minRows = Math.max(sp.minRows, 25)
    let name = patient.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || (blank ? 'Em branco' : 'Paciente')
    while (used.has(name.toLowerCase())) name = name.slice(0, 26) + '_' + (used.size + 1)
    used.add(name.toLowerCase())
    const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } } })
    ws.columns = sp.cols.map((c) => ({ width: c.w }))
    const last = sp.cols.length
    const side = { style: 'thin', color: { argb: 'FF' + sp.line } }
    const border = { top: side, left: side, bottom: side, right: side }
    const F = (o = {}) => ({ name: sp.font, size: 12, ...o })

    // cabeçalho: logo + título
    const lpx = LOGO_PX[cfg.logoSize] || LOGO_PX.md
    ws.getRow(1).height = 26; ws.getRow(2).height = 26; ws.getRow(3).height = Math.max(16, lpx * 0.75 + 6 - 52)
    if (logo) {
      const h = lpx, w = Math.round((logo.w / logo.h) * h)
      const id = wb.addImage({ base64: logo.base64, extension: logo.ext })
      const widths = sp.cols.map((c) => c.w)
      const totalW = widths.reduce((a, b) => a + b, 0)
      const colPos = sp.logoSide === 'right' ? { col: Math.max(0, last - 1), colOff: 0 } : { col: 0, colOff: 0 }
      ws.addImage(id, sp.logoSide === 'center' ? { tl: { col: Math.max(0, last / 2 - 0.5), row: 0 }, ext: { width: w, height: h } } : { tl: { col: colPos.col + (sp.logoSide === 'right' ? 0.15 : 0), row: 0 }, ext: { width: w, height: h } })
      void totalW
    }
    let r = 4
    if (sp.logoSide === 'center') r = 4
    // título (e texto do lado, como o nome do hospital na ficha da Interne)
    const titleLast = sp.side ? Math.max(1, last - 1) : last
    if (sp.titleLine && titleLast > 1) {
      // texto do título + célula com linha embaixo para o mês (alinhada ao título, como no papel)
      const need = sp.titleLine.prefix.length * 1.3 // largura estimada do texto (fonte 15, negrito)
      const widths = sp.cols.map((c) => c.w)
      let k = 1, acc = widths[0]
      while (k < titleLast - 1 && acc < need) { acc += widths[k]; k++ }
      ws.mergeCells(r, 1, r, k)
      const t0 = ws.getCell(r, 1)
      t0.value = sp.titleLine.prefix
      t0.font = F({ bold: true, size: 15, color: { argb: 'FF' + sp.titleColor } })
      t0.alignment = { horizontal: 'left', vertical: 'bottom' }
      ws.mergeCells(r, k + 1, r, titleLast)
      const tv = ws.getCell(r, k + 1)
      tv.value = sp.titleLine.value
      tv.font = F({ bold: true, size: 15, color: { argb: 'FF' + sp.titleColor } })
      tv.alignment = { horizontal: 'center', vertical: 'bottom' }
      for (let c = k + 1; c <= titleLast; c++) ws.getCell(r, c).border = { bottom: { style: 'thin', color: { argb: 'FF' + sp.line } } }
    } else {
      ws.mergeCells(r, 1, r, titleLast)
      const t = ws.getCell(r, 1)
      t.value = sp.title
      t.font = F({ bold: true, size: 15, color: { argb: 'FF' + sp.titleColor } })
      t.alignment = { horizontal: sp.titleAlign, vertical: 'middle' }
    }
    if (sp.side) {
      const s = ws.getCell(r, last)
      s.value = sp.side
      s.font = F({ bold: true, size: 13 })
      s.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
    }
    ws.getRow(r).height = 28
    r += 2

    // campos (Paciente, Convênio, Mês...)
    for (const line of sp.fields) {
      const parts = line.length
      const span = Math.floor(last / parts)
      line.forEach(([label, value], i) => {
        const c1 = 1 + i * span, c2 = i === parts - 1 ? last : c1 + span - 1
        if (c2 > c1) ws.mergeCells(r, c1, r, c2)
        const cell = ws.getCell(r, c1)
        cell.value = { richText: [{ text: `${label} `, font: F({ bold: true }) }, { text: value, font: F() }] }
        cell.alignment = { vertical: 'middle' }
        for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = { bottom: { style: 'thin', color: { argb: 'FF' + sp.line } } }
      })
      ws.getRow(r).height = 22
      r += 1
    }
    r += 1

    // tabela (só ela recebe as linhas coloridas)
    const head = ws.getRow(r)
    sp.cols.forEach((c, i) => {
      const cell = head.getCell(i + 1)
      cell.value = c.h
      cell.font = F({ bold: true, color: { argb: 'FF' + sp.headText } })
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + sp.headFill } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = border
    })
    head.height = 24
    r++
    const total = Math.max(rows.length, sp.minRows)
    for (let n = 0; n < total; n++) {
      const row = rows[n]
      const rr = ws.getRow(r)
      sp.cols.forEach((c, i) => {
        const cell = rr.getCell(i + 1)
        cell.value = row ? c.get(row) : ''
        cell.font = c.evo ? F({ name: ef.xl, size: ef.size }) : F({ size: 11 })
        cell.border = border
        cell.alignment = { vertical: 'middle', wrapText: true, horizontal: c.center ? 'center' : 'left' }
      })
      const lines = row ? Math.max(1, ...sp.cols.filter((c) => c.wrap).map((c) => Math.ceil(String(c.get(row) || '').length / (c.w * 0.95)))) : 1
      rr.height = Math.max(22, lines * 16)
      r++
    }

    // observações: logo abaixo da tabela, fora dela
    const obs = withObs ? obsLines(rows) : []
    if (obs.length) {
      r++
      ws.mergeCells(r, 1, r, last)
      ws.getCell(r, 1).value = 'Observações:'
      ws.getCell(r, 1).font = F({ bold: true })
      r++
      for (const l of obs) {
        ws.mergeCells(r, 1, r, last)
        const c = ws.getCell(r, 1)
        c.value = l
        c.font = F({ size: 11 })
        c.alignment = { wrapText: true, vertical: 'top' }
        ws.getRow(r).height = Math.max(18, Math.ceil(l.length / 110) * 16)
        r++
      }
    }

    // rodapé e carimbo
    r++
    for (const f of sp.footer) {
      ws.mergeCells(r, 1, r, last)
      const g = ws.getCell(r, 1)
      g.value = f
      g.font = F({ size: 10, bold: !!sp.footerBold, color: { argb: 'FF' + sp.footerColor } })
      g.alignment = { wrapText: true, horizontal: sp.footerAlign, vertical: 'top' }
      ws.getRow(r).height = Math.max(16, Math.ceil(f.length / 105) * 14)
      r++
    }
    if (sp.stamp) {
      for (const l of sp.stamp) {
        ws.mergeCells(r, 1, r, last)
        const c = ws.getCell(r, 1)
        c.value = l
        c.font = F({ size: 11, bold: true, color: { argb: 'FF2F3C7E' } })
        c.alignment = { horizontal: 'right' }
        r++
      }
    }
    ws.mergeCells(r, 1, r, last)
    const gb = ws.getCell(r, 1)
    gb.value = generatedBy()
    gb.font = F({ size: 9, italic: true, color: { argb: 'FF9CA3AF' } })
    gb.alignment = { horizontal: sp.footerAlign === 'center' ? 'center' : 'left' }
  }

  const buf = await wb.xlsx.writeBuffer()
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`)
}

// ---------- PDF ----------
export async function exportPdf({ company, ym, groups, withObs, base, cfg, evoFont = 'arial', blank = false, headerMonth = 'auto' }) {
  const ef = FONTS[evoFont] || FONTS.arial
  const { jsPDF } = await import('jspdf')
  const atMod = await import('jspdf-autotable')
  const autoTable = typeof atMod.default === 'function' ? atMod.default : atMod.default?.default ?? atMod.autoTable
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const logo = await loadImage(company.logo)
  if (ef.file) { // embute a fonte cursiva no PDF
    const bytes = new Uint8Array(await (await fetch(ef.file)).arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    const vfs = ef.file.split('/').pop()
    pdf.addFileToVFS(vfs, btoa(bin))
    pdf.addFont(vfs, ef.pdf, 'normal')
  }
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 40

  groups.forEach(({ patient, rows }, gi) => {
    if (gi) pdf.addPage()
    const sp = spec(cfg, company, ym, patient, headerMonth)
    if (blank) sp.minRows = Math.max(sp.minRows, 25)
    const line = hexRgb(sp.line)
    const font = sp.pdfFont
    let y = 34
    const lpt = LOGO_PT[cfg.logoSize] || LOGO_PT.md
    if (logo) {
      const h = lpt, w = (logo.w / logo.h) * h
      const x = sp.logoSide === 'right' ? W - M - w : sp.logoSide === 'center' ? (W - w) / 2 : M
      pdf.addImage(logo.dataUrl, logo.ext === 'png' ? 'PNG' : 'JPEG', x, y, w, h)
    }
    y += (logo ? lpt : 0) + 26
    pdf.setFont(font, 'bold').setFontSize(sp.titleAlign === 'center' ? 16 : 13).setTextColor(...hexRgb(sp.titleColor))
    if (sp.titleLine) {
      const pw = pdf.getTextWidth(`${sp.titleLine.prefix} `)
      const lineW = Math.min(190, W - M * 2 - pw - 8)
      const x0 = sp.titleAlign === 'center' ? (W - (pw + 4 + lineW)) / 2 : M
      pdf.text(sp.titleLine.prefix, x0, y)
      const lx1 = x0 + pw + 4
      pdf.setDrawColor(...hexRgb(sp.line)).setLineWidth(0.8).line(lx1, y + 3, lx1 + lineW, y + 3)
      if (sp.titleLine.value) pdf.text(sp.titleLine.value, lx1 + lineW / 2, y, { align: 'center' })
    } else {
      pdf.text(sp.title, sp.titleAlign === 'center' ? W / 2 : M, y, { align: sp.titleAlign === 'center' ? 'center' : 'left' })
    }
    if (sp.side) pdf.setFontSize(13).text(sp.side, W - M, y, { align: 'right' })
    y += 24
    pdf.setFontSize(11).setTextColor(31, 41, 55)
    for (const lineFields of sp.fields) {
      const span = (W - M * 2) / lineFields.length
      lineFields.forEach(([label, value], i) => {
        const x = M + i * span
        pdf.setFont(font, 'bold').text(`${label} `, x, y)
        const lw = pdf.getTextWidth(`${label} `)
        pdf.setFont(font, 'normal').text(value, x + lw, y)
        pdf.setDrawColor(...line).setLineWidth(0.6).line(x + lw - 2, y + 3, x + span - 12, y + 3)
      })
      y += 20
    }

    const body = rows.map((r) => sp.cols.map((c) => c.get(r)))
    while (body.length < sp.minRows) body.push(sp.cols.map(() => ''))
    const tw = W - M * 2
    autoTable(pdf, {
      startY: y + 6, head: [sp.cols.map((c) => c.h)], body, theme: 'grid', margin: { left: M, right: M, bottom: 70 },
      styles: { font, fontSize: 10, cellPadding: 4, lineColor: line, lineWidth: 0.6, textColor: [31, 41, 55], minCellHeight: 18, valign: 'middle' },
      headStyles: { fillColor: hexRgb(sp.headFill), textColor: hexRgb(sp.headText), halign: 'center', fontStyle: 'bold' },
      columnStyles: Object.fromEntries(sp.cols.map((c, i) => [i, { cellWidth: tw * c.pw, halign: c.center ? 'center' : 'left', ...(c.evo && ef.file ? { font: ef.pdf, fontSize: ef.size - 1 } : {}) }])),
    })
    let ey = pdf.lastAutoTable.finalY + 16
    const obs = withObs ? obsLines(rows) : []
    if (obs.length) {
      pdf.setFont(font, 'bold').setFontSize(11).setTextColor(31, 41, 55).text('Observações:', M, ey)
      ey += 15
      pdf.setFont(font, 'normal').setFontSize(10)
      for (const l of obs) {
        const ls = pdf.splitTextToSize(l, W - M * 2)
        if (ey + ls.length * 13 > H - 60) { pdf.addPage(); ey = 50 }
        pdf.text(ls, M, ey)
        ey += ls.length * 13 + 3
      }
    }
    // rodapé na última página do paciente
    const lines = [...sp.footer.flatMap((f) => pdf.splitTextToSize(f, W - M * 2)), ...(sp.stamp ? [] : [])]
    pdf.setFont(font, sp.footerBold ? 'bold' : 'normal').setFontSize(8).setTextColor(...hexRgb(sp.footerColor))
    let fy = H - 18 - lines.length * 10 - (sp.stamp ? 34 : 0)
    if (fy < ey) { pdf.addPage(); fy = H - 18 - lines.length * 10 - (sp.stamp ? 34 : 0) }
    for (const l of lines) { pdf.text(l, sp.footerAlign === 'center' ? W / 2 : M, fy, { align: sp.footerAlign === 'center' ? 'center' : 'left' }); fy += 10 }
    if (sp.stamp) {
      pdf.setFont(font, 'bold').setFontSize(9).setTextColor(47, 60, 126)
      sp.stamp.forEach((l, i) => pdf.text(l, W - M, H - 52 + i * 11, { align: 'right' }))
    }
  })

  pdf.save(`${base}.pdf`)
}
