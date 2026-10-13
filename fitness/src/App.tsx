import { useEffect, useState } from 'react'
import { TabBar } from './components/Layout'
import { Button, Skeleton, Toaster, toast } from './components/ui'
import { reviewPreviousWeek } from './lib/actions'
import { useRoute } from './lib/router'
import { useStore } from './lib/store'
import { applyUpdate, onUpdateAvailable } from './lib/sw'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { Train } from './screens/Train'
import { Progress } from './screens/Progress'
import { Library, ExerciseDetail, RoutineDetail } from './screens/Library'
import { ProfileScreen } from './screens/Profile'
import { WorkoutPlayer } from './screens/WorkoutPlayer'
import { WorkoutSummary } from './screens/WorkoutSummary'
import { RunScreen } from './screens/RunScreen'
import { RunLog } from './screens/RunLog'
import { History, WorkoutDetail, RunDetail } from './screens/History'
import { CalendarScreen } from './screens/Calendar'
import { Generator } from './screens/Generator'
import { SettingsScreen } from './screens/Settings'
import { DataScreen } from './screens/DataScreen'
import { BodyScreen } from './screens/Body'
import { PlanScreen } from './screens/Plan'
import { AboutScreen } from './screens/About'

function useAppearance() {
  const settings = useStore((s) => s.settings)
  const live = useStore((s) => s.workouts.some((w) => w.status === 'active') || s.runs.some((r) => r.status === 'active'))
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset.theme = dark ? 'dark' : 'light'
      const meta = document.querySelectorAll('meta[name="theme-color"]')
      meta.forEach((m) => m.setAttribute('content', dark ? '#0B0C0E' : '#F3F3EF'))
    }
    apply()
    root.classList.toggle('large-text', settings.largeText)
    root.classList.toggle('reduce-motion', settings.reducedMotion)
    root.classList.toggle('has-live', live)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings.theme, settings.largeText, settings.reducedMotion, live])
}

function Routes() {
  const { parts } = useRoute()
  const [a, b, c] = parts
  switch (a) {
    case undefined:
      return <Home />
    case 'train':
      return <Train />
    case 'progress':
      return <Progress />
    case 'library':
      if (b === 'routine' && c) return <RoutineDetail id={c} />
      if (b) return <ExerciseDetail id={b} />
      return <Library />
    case 'profile':
      return <ProfileScreen />
    case 'settings':
      return <SettingsScreen />
    case 'data':
      return <DataScreen />
    case 'body':
      return <BodyScreen />
    case 'plan':
      return <PlanScreen />
    case 'about':
      return <AboutScreen />
    case 'workout':
      if (b === 'summary' && c) return <WorkoutSummary id={c} />
      return <WorkoutPlayer />
    case 'run':
      if (b === 'log') return <RunLog />
      if (b) return <RunDetail id={b} />
      return <RunScreen />
    case 'history':
      if (b) return <WorkoutDetail id={b} />
      return <History />
    case 'calendar':
      return <CalendarScreen />
    case 'generate':
      return <Generator />
    case 'onboarding':
      return <Onboarding editing />
    default:
      return <Home />
  }
}

const FULLSCREEN = new Set(['workout', 'run', 'onboarding'])

export default function App() {
  useAppearance()
  const status = useStore((s) => s.status)
  const error = useStore((s) => s.error)
  const onboarded = useStore((s) => !!s.profile?.onboardedAt)
  const { parts } = useRoute()
  const [update, setUpdate] = useState(false)

  useEffect(() => onUpdateAvailable((w) => setUpdate(!!w)), [])
  useEffect(() => {
    if (status !== 'ready' || !onboarded) return
    const msg = reviewPreviousWeek()
    if (msg) toast(msg, 'accent')
  }, [status, onboarded])

  if (status === 'loading')
    return (
      <div className="pt-safe px-4 max-w-[560px] mx-auto" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-40 mt-16" />
        <Skeleton className="h-56 mt-6 rounded-[22px]" />
        <Skeleton className="h-24 mt-4 rounded-[22px]" />
        <Skeleton className="h-24 mt-4 rounded-[22px]" />
      </div>
    )
  if (status === 'error')
    return (
      <div className="pt-safe px-6 max-w-[480px] mx-auto text-center">
        <h1 className="text-[24px] font-bold mt-24">Storage unavailable</h1>
        <p className="text-muted mt-3 leading-relaxed">Forge couldn’t open local storage on this device ({error}). Private browsing can block it. Try opening Forge normally, or from the Home Screen.</p>
        <Button className="mt-6" onClick={() => location.reload()}>
          Try again
        </Button>
      </div>
    )
  if (!onboarded) return (
    <>
      <Onboarding />
      <Toaster />
    </>
  )

  const fullscreen = FULLSCREEN.has(parts[0] ?? '') && !(parts[0] === 'run' && parts[1])
  return (
    <>
      <Routes />
      {!fullscreen && <TabBar />}
      <Toaster />
      {error && status === 'ready' && (
        <div className="fixed top-0 inset-x-0 z-50 pt-safe px-4">
          <div className="max-w-[520px] mx-auto bg-danger-soft text-danger border border-line rounded-[14px] px-4 py-3 text-[14px] font-medium backdrop-blur-xl">{error}</div>
        </div>
      )}
      {update && !fullscreen && (
        <div className="fixed inset-x-0 z-50 px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}>
          <div className="max-w-[520px] mx-auto flex items-center gap-3 bg-raised border border-line-strong rounded-[16px] p-3 pl-4 shadow-card">
            <span className="flex-1 text-[14.5px]">A new version of Forge is ready.</span>
            <Button size="sm" onClick={applyUpdate}>
              Update
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
