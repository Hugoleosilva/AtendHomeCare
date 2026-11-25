import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_STATUSES, uid } from './core'

// Armazenamento: cache local (localStorage) + sincronização com a API (Vercel + MongoDB).
// O app funciona offline; as alterações sobem quando houver conexão. Em conflito, vale a última gravação.
const KEY = 'homecare:v1'
const DIRTY = 'homecare:dirty'
const ROLE = 'homecare:role'
const PREV = 'homecare:prev' // cópia local do que estava no aparelho antes de ser trocado pelo da nuvem

// Cores das empresas: tons da logo (azul e rosa).
const interne = () => ({ id: uid(), name: 'Interne', color: '#8fdcbc', logo: '/images/Interne.png', layout: 'interne', headerText: 'HOSPITAL DA AERONAUTICA', cutoffDay: 0, discounts: [] })
const OLD_COLORS = { '#f47b20': '#f78fbc', '#3b82f6': '#29b2e8', '#0b7fb0': '#8fdcbc' }

const seed = () => {
  const m = uid(), mf = uid(), rei = uid(), res = uid()
  return {
    version: 1,
    flags: { interne: true },
    statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
    companies: [
      { id: rei, name: 'Reintegrar Saúde', color: '#f78fbc', logo: '/images/Reintegrar_Saude.jpeg', layout: 'reintegrar', cutoffDay: 0, discounts: [] },
      { id: res, name: 'Saúde Residência', color: '#29b2e8', logo: '/images/Saude_Residencia.png', layout: 'residencia', cutoffDay: 0, discounts: [] },
      interne(),
    ],
    procedures: [
      { id: m, name: 'Fisioterapia Motora', code: 'M', description: '' },
      { id: mf, name: 'Fisioterapia Motora e Funcional', code: 'M/F', description: '' },
    ],
    prices: {}, // prices[companyId][procedureId] = valor
    patients: [],
    records: {}, // records['pacienteId|AAAA-MM-DD'] = { status, amount, evolution, observation, ... }
  }
}

const lsGet = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* ignore */ } }

// Monta o estado a partir de dados salvos (local ou da nuvem), aplicando ajustes de versões anteriores.
function hydrate(data) {
  const s = { ...seed(), ...data, flags: data.flags || {} }
  if (!data.statuses?.length) s.statuses = DEFAULT_STATUSES.map((x) => ({ ...x }))
  s.companies = s.companies.map((c) => (OLD_COLORS[c.color] ? { ...c, color: OLD_COLORS[c.color] } : c))
  if (!s.flags.interne) { // empresa Interne entra uma vez só nos dados que já existiam
    if (!s.companies.some((c) => /interne/i.test(c.name))) s.companies = [...s.companies, interne()]
    s.flags = { ...s.flags, interne: true }
  }
  return s
}

function load() {
  try {
    const raw = lsGet(KEY)
    if (raw) return hydrate(JSON.parse(raw))
  } catch { /* segue com dados vazios */ }
  return seed()
}

// ---- divisão do estado para a API: 'meta' + registros por mês ----
const metaOf = (s) => ({ version: s.version, flags: s.flags, statuses: s.statuses, companies: s.companies, procedures: s.procedures, prices: s.prices, patients: s.patients })
function monthsOf(records) {
  const out = {}
  for (const [k, v] of Object.entries(records)) (out[k.split('|')[1].slice(0, 7)] ||= {})[k] = v
  return out
}
const snapOf = (s) => ({ meta: JSON.stringify(metaOf(s)), months: Object.fromEntries(Object.entries(monthsOf(s.records)).map(([ym, o]) => [ym, JSON.stringify(o)])) })

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(load)
  const [auth, setAuth] = useState({ status: 'checking', role: null, error: '' })
  const [sync, setSync] = useState('idle') // idle | saving | saved | offline | error
  const hydrated = useRef(false)
  const snap = useRef({ meta: '', months: {} })
  const forceReplace = useRef(false)
  const stateRef = useRef(state)
  const busy = useRef(false)
  const serverSet = useRef(null) // último estado que veio da nuvem (não é alteração local)
  const lastSeen = useRef(state)
  const pushTimer = useRef(null)
  stateRef.current = state

  // cache local
  useEffect(() => { lsSet(KEY, JSON.stringify(state)) }, [state])

  // ---- sincronização ----
  const pull = useCallback(async () => {
    const r = await api('/api/data')
    if (r.status === 401) { setAuth({ status: 'login', role: null, error: 'Sessão expirada. Entre novamente.' }); return false }
    if (!r.ok) throw new Error('pull')
    if (r.body.empty) {
      snap.current = { meta: '', months: {} } // banco vazio: sobe os dados locais (migração)
    } else if (lsGet(DIRTY) === '1') {
      snap.current = snapOf({ ...seed(), ...r.body.meta, records: r.body.records }) // há alterações locais pendentes: elas prevalecem
    } else {
      // o snapshot guarda o que está na nuvem; ajustes de versão (cores, Interne) viram diferença e sobem em seguida
      snap.current = snapOf({ ...seed(), ...r.body.meta, records: r.body.records })
      const server = hydrate({ ...r.body.meta, records: r.body.records })
      // se o aparelho tinha MAIS dados que a nuvem, guarda uma cópia local antes de trocar (dá para recuperar em Mais › Backup)
      const local = stateRef.current
      if (local.patients.length > server.patients.length || Object.keys(local.records).length > Object.keys(server.records).length) lsSet(PREV, JSON.stringify(local))
      // IMPORTANTE: atualiza já a referência usada por push(). Antes ela só mudava depois da renderização,
      // e push() calculava o que enviar com o estado ANTIGO, gravando-o por cima da nuvem.
      stateRef.current = server
      serverSet.current = server
      setState(server)
    }
    hydrated.current = true
    return true
  }, [])

  const push = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      if (!hydrated.current && !(await pull())) return
      const s = stateRef.current
      const now = snapOf(s)
      const body = {}
      const replace = forceReplace.current
      if (replace || now.meta !== snap.current.meta) body.meta = metaOf(s)
      const months = monthsOf(s.records)
      const out = {}
      for (const ym of new Set([...Object.keys(months), ...Object.keys(snap.current.months)])) {
        if (replace ? !!months[ym] : now.months[ym] !== snap.current.months[ym]) out[ym] = months[ym] || {}
      }
      if (Object.keys(out).length) body.months = out
      if (replace) body.replace = true
      if (!body.meta && !body.months && !replace) { lsSet(DIRTY, null); setSync('saved'); return }
      setSync('saving')
      const r = await api('/api/data', { method: 'PUT', body: JSON.stringify(body) })
      if (r.status === 401) { setAuth({ status: 'login', role: null, error: 'Sessão expirada. Entre novamente.' }); return }
      if (!r.ok) throw new Error('push')
      snap.current = now
      forceReplace.current = false
      if (JSON.stringify(snapOf(stateRef.current)) === JSON.stringify(now)) lsSet(DIRTY, null) // nada novo desde o envio
      setSync('saved')
    } catch {
      setSync(navigator.onLine ? 'error' : 'offline')
    } finally {
      busy.current = false
    }
  }, [pull])

  // alteração local → marca pendente e envia (com pequeno atraso)
  useEffect(() => {
    if (lastSeen.current === state) return // só mudou a sessão (login/checagem), não os dados
    lastSeen.current = state
    if (auth.status !== 'ready' || state === serverSet.current) return // veio da nuvem: não é alteração local
    lsSet(DIRTY, '1')
    setSync('saving')
    clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(push, 700)
  }, [state, auth.status, push])

  // tentativas periódicas, ao voltar a conexão e ao reabrir o app
  useEffect(() => {
    if (auth.status !== 'ready') return
    const tick = () => { if (document.visibilityState === 'visible') push() }
    const iv = setInterval(tick, 30000)
    window.addEventListener('online', tick)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(iv); window.removeEventListener('online', tick); document.removeEventListener('visibilitychange', tick) }
  }, [auth.status, push])

  // ---- sessão ----
  useEffect(() => {
    (async () => {
      try {
        const r = await api('/api/login')
        if (r.ok) { lsSet(ROLE, r.body.role); setAuth({ status: 'ready', role: r.body.role, error: '' }); push() }
        else setAuth({ status: 'login', role: null, error: '' })
      } catch {
        const cached = lsGet(ROLE) // sem internet: segue com os dados do aparelho
        if (cached) { setAuth({ status: 'ready', role: cached, error: '' }); setSync('offline') }
        else setAuth({ status: 'login', role: null, error: 'Sem conexão com o servidor.' })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (password) => {
    try {
      const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) })
      if (!r.ok) return setAuth({ status: 'login', role: null, error: r.body.error || 'Não foi possível entrar.' })
      lsSet(ROLE, r.body.role)
      hydrated.current = false
      setAuth({ status: 'ready', role: r.body.role, error: '' })
      push()
    } catch {
      setAuth({ status: 'login', role: null, error: 'Sem conexão com o servidor.' })
    }
  }, [push])

  const logout = useCallback(async () => {
    try { await api('/api/login', { method: 'DELETE' }) } catch { /* ignore */ }
    lsSet(ROLE, null)
    hydrated.current = false
    setAuth({ status: 'login', role: null, error: '' })
  }, [])

  const update = useCallback((fn) => setState((s) => fn(s)), [])
  const upsert = useCallback((col, item) => setState((s) => {
    const list = s[col]
    const i = list.findIndex((x) => x.id === item.id)
    return { ...s, [col]: i >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] }
  }), [])
  const remove = useCallback((col, id) => setState((s) => ({ ...s, [col]: s[col].filter((x) => x.id !== id) })), [])
  // recupera a cópia local guardada antes de o aparelho ser sincronizado com uma nuvem com menos dados
  const restoreLocalPrev = useCallback(() => {
    const raw = lsGet(PREV)
    if (!raw) return false
    try { setState(hydrate(JSON.parse(raw))); return true } catch { return false }
  }, [])
  const reloadFromCloud = useCallback(() => { lsSet(DIRTY, null); window.location.reload() }, [])
  const replaceAll = useCallback((data) => { forceReplace.current = true; setState(hydrate(data)) }, [])

  const value = useMemo(() => ({ state, update, upsert, remove, replaceAll, auth, login, logout, sync, retrySync: push, restoreLocalPrev, reloadFromCloud }), [state, update, upsert, remove, replaceAll, auth, login, logout, sync, push, restoreLocalPrev, reloadFromCloud])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
