// Datas sempre como string 'YYYY-MM-DD' (sem fuso) e competência como 'YYYY-MM'.
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const WD_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const WD_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

export const pad = (n) => String(n).padStart(2, '0')
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => toIso(new Date())
export const addDays = (s, n) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return toIso(d)
}
export const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
export const monthOf = (s) => s.slice(0, 7)
export const monthRange = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return { first: `${ym}-01`, last: toIso(new Date(y, m, 0)) }
}
export const weekday = (s) => parse(s).getDay()
export const weekStart = (s) => addDays(s, -weekday(s))
export const fmtBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '')
export const fmtShort = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '')
export const fmtMonth = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
export const fmtLongDate = (s) => {
  const d = parse(s)
  return `${WD_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`
}
export function eachDay(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}
export const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
