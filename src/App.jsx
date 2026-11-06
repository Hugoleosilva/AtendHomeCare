import { useEffect, useState } from 'react'
import { monthOf, today, WD_SHORT } from './lib/dates'
import { useStore } from './lib/store'
import { ThemeButton } from './ui'
import { DayScreen, MonthScreen, WeekScreen } from './screens/Calendar'
import Closing from './screens/Closing'
import Login from './screens/Login'
import Evolution from './screens/Evolution'
import { PatientDetail, PatientForm, PatientsScreen } from './screens/Patients'
import { BackupScreen, CompaniesScreen, MoreScreen, ProceduresScreen } from './screens/Settings'
import StatusSheet from './screens/StatusSheet'

const TABS = [
  ['dia', '📅', 'Dia'],
  ['semana', '🗓️', 'Semana'],
  ['mes', '🗒️', 'Mês'],
  ['pacientes', '👥', 'Pacientes'],
  ['mais', '☰', 'Mais'],
]

const SYNC = { saving: ['⏳', 'Salvando…'], saved: ['☁️', 'Salvo'], offline: ['📴', 'Sem internet · salvo no aparelho'], error: ['⚠️', 'Falha ao sincronizar · toque para tentar'] }

function SyncBadge() {
  const { sync, retrySync } = useStore()
  const s = SYNC[sync]
  if (!s) return null
  return <button className="muted" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={retrySync} title={s[1]}>{s[0]} {s[1]}</button>
}

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])
  const d = now
  return (
    <div className="topline">
      <span className="clock">{String(d.getHours()).padStart(2, '0')}:{String(d.getMinutes()).padStart(2, '0')}</span>
      <small>{WD_SHORT[d.getDay()].toLowerCase()}., {d.getDate()} de {['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][d.getMonth()]}.</small>
      <SyncBadge />
      <ThemeButton className="top-theme" />
    </div>
  )
}

export default function App() {
  const { auth } = useStore()
  const [tab, setTab] = useState('dia')
  const [stack, setStack] = useState([]) // telas empilhadas sobre as abas
  const [date, setDate] = useState(today())
  const [ym, setYm] = useState(monthOf(today()))
  const [statusEntry, setStatusEntry] = useState(null)

  const push = (v) => setStack((s) => [...s, v])
  const pop = () => setStack((s) => s.slice(0, -1))
  const view = stack[stack.length - 1]

  const openPatient = (id) => push({ t: 'patient', id })
  const openStatus = (entry) => setStatusEntry(entry)
  const newPatient = () => push({ t: 'form', defaultDate: tab === 'dia' || tab === 'mes' ? date : undefined })
  const go = (k) => push({ t: k })
  const changeTab = (k) => { setStack([]); setTab(k) }

  let body
  if (view) {
    switch (view.t) {
      case 'patient': body = <PatientDetail key={view.id} id={view.id} ym={ym} setYm={setYm} onBack={pop} onEdit={(id) => push({ t: 'form', id })} onOpenStatus={openStatus} />; break
      case 'form': body = <PatientForm id={view.id} defaultDate={view.defaultDate} onCancel={pop} onDone={(id) => { setStack((s) => [...s.slice(0, -1).filter((x) => !(x.t === 'patient' && x.id === id)), { t: 'patient', id }]) }} />; break
      case 'closing': body = <Closing ym={ym} setYm={setYm} onBack={pop} onOpenPatient={openPatient} />; break
      case 'evolution': body = <Evolution ym={ym} onBack={pop} />; break
      case 'companies': body = <CompaniesScreen onBack={pop} />; break
      case 'procedures': body = <ProceduresScreen onBack={pop} />; break
      case 'backup': body = <BackupScreen onBack={pop} />; break
      default: body = null
    }
  } else if (tab === 'dia') body = <DayScreen date={date} setDate={setDate} onOpenPatient={openPatient} onOpenStatus={openStatus} />
  else if (tab === 'semana') body = <WeekScreen date={date} setDate={setDate} onPickDay={(d) => { setDate(d); setTab('dia') }} />
  else if (tab === 'mes') body = <MonthScreen ym={monthOf(date)} setYm={(m) => setDate(`${m}-01`)} date={date} setDate={(d) => { setDate(d); setYm(monthOf(d)) }} onOpenPatient={openPatient} onOpenStatus={openStatus} onOpenClosing={() => { setYm(monthOf(date)); go('closing') }} />
  else if (tab === 'pacientes') body = <PatientsScreen onOpen={openPatient} onNew={newPatient} />
  else body = <MoreScreen go={(k) => { setYm(monthOf(date)); go(k) }} />

  if (auth.status === 'checking') return <div className="empty" style={{ paddingTop: '40vh' }}>Carregando…</div>
  if (auth.status === 'login') return <Login />

  const showFab = !view && ['dia', 'semana', 'mes', 'pacientes'].includes(tab)

  return (
    <div className="app">
      <main className="screen">
        {!view && (tab === 'dia' || tab === 'semana' || tab === 'mes') && <Clock />}
        {body}
      </main>
      {showFab && <button className="fab" aria-label="Novo paciente" title="Novo paciente" onClick={newPatient}><span className="plus" aria-hidden="true">+</span><span className="fab-label">Novo paciente</span></button>}
      <nav className="tabs">
        <div className="brand">
          <img className="logo-light" src="/images/logo-light.png" alt="HomePlanner – Gestão de HomeCare" />
          <img className="logo-dark" src="/images/logo-dark.png" alt="" />
        </div>
        {TABS.map(([k, ic, label]) => (
          <button key={k} className={!view && tab === k ? 'on' : ''} onClick={() => changeTab(k)}>
            <span className="ic">{ic}</span>{label}
          </button>
        ))}
        <div className="side-foot"><ThemeButton labeled /></div>
      </nav>
      {statusEntry && <StatusSheet key={statusEntry.key} entry={statusEntry} onClose={() => setStatusEntry(null)} onOpenPatient={openPatient} />}
    </div>
  )
}
