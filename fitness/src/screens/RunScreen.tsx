import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Layout'
import { Badge, Button, Card, ConfirmSheet, cx, IconButton, inputCls, Notice, NumberInput, Segmented, SectionHeader, Sheet, toast } from '../components/ui'
import { buildRunPlan, freeRunPlan, gpsIncrement, MAX_ACCURACY_M, type RunPlan } from '../engine/running'
import { isRunSession, planFor } from '../engine/schedule'
import { elapsedMs } from '../engine/steps'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import { discardRun, finishRun, saveRun } from '../lib/actions'
import { dayKey } from '../lib/date'
import { beep, speak, unlockAudio } from '../lib/feedback'
import { formatDuration, formatSeconds } from '../lib/format'
import { uid } from '../lib/id'
import { navigate, useRoute } from '../lib/router'
import { getState, useStore } from '../lib/store'
import type { Feel, GeoPoint, Run, RunSegment, SessionType } from '../lib/types'
import { distanceValue, formatPace, toMeters } from '../lib/units'

const SEG_TONE: Record<RunSegment['kind'], string> = {
  warmup: 'bg-raised',
  cooldown: 'bg-raised',
  walk: 'bg-calm-soft text-calm',
  recover: 'bg-calm-soft text-calm',
  run: 'bg-run-soft text-run',
  steady: 'bg-run-soft text-run',
  hard: 'bg-accent text-accent-ink',
}

export function RunScreen() {
  const active = useStore((s) => s.runs.find((r) => r.status === 'active'))
  if (active) return <ActiveRun key={active.id} run={active} />
  return <RunSetup />
}

function useRunPlan(): { plan: RunPlan; type: SessionType | 'free'; date: string } {
  const { query } = useRoute()
  const profile = useStore((s) => s.profile)
  const programme = useStore((s) => s.programme)
  const date = query.get('date') ?? dayKey()
  const q = query.get('type') as SessionType | null
  return useMemo(() => {
    if (!profile || !programme) return { plan: freeRunPlan(), type: 'free' as const, date }
    const dayPlan = planFor(programme, date)
    const type = q && isRunSession(q) ? q : isRunSession(dayPlan.type) && !q ? dayPlan.type : null
    if (!type || q === ('free' as SessionType)) return { plan: freeRunPlan(), type: 'free' as const, date }
    const minutes = Number(query.get('minutes')) || undefined
    return {
      plan: buildRunPlan(type, profile, programme, { deload: dayPlan.isDeload, lighten: query.get('lighten') === '1' || dayPlan.lighten, minutes, week: dayPlan.week }),
      type,
      date,
    }
  }, [profile, programme, date, q, query])
}

function RunSetup() {
  const { plan, type, date } = useRunPlan()
  const geoAvailable = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const [mode, setMode] = useState<'gps' | 'timer'>(geoAvailable ? 'gps' : 'timer')
  const units = useStore((s) => s.profile?.units)!

  const start = () => {
    unlockAudio()
    const run: Run = {
      id: uid('run'),
      date,
      sessionType: type,
      title: plan.title,
      source: mode,
      startedAt: new Date().toISOString(),
      status: 'active',
      distanceM: 0,
      activeMs: 0,
      runningSince: Date.now(),
      points: [],
      plan: plan.segments.length ? plan.segments : undefined,
    }
    saveRun(run)
    beep('go')
    if (plan.segments[0]) speak(plan.segments[0].label)
  }

  return (
    <Screen back="/train" title={plan.title} eyebrow={type === 'free' ? 'Run' : 'Today’s run'} tabbar={false}>
      <div className="space-y-5">
        <p className="text-[15.5px] text-muted leading-relaxed">{plan.purpose}</p>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="heart" size={18} className="text-run" />
            <span className="font-semibold">Effort</span>
          </div>
          <p className="text-[14.5px] text-muted leading-relaxed">{plan.effort}</p>
          {units && getState().profile?.easyPaceSecPerKm && plan.sessionType !== 'free' && (
            <p className="text-[13.5px] text-faint mt-2">Your easy pace is around {formatPace(getState().profile!.easyPaceSecPerKm!, units)}. Effort matters more than pace on hills, heat or tired days.</p>
          )}
        </Card>

        {plan.segments.length > 0 && (
          <section>
            <SectionHeader title={`Structure · ${formatSeconds(plan.totalSec)}`} />
            <div className="flex h-3 rounded-full overflow-hidden gap-[2px] mb-3" aria-hidden="true">
              {plan.segments.map((s, i) => (
                <div key={i} className={cx('h-full', SEG_TONE[s.kind])} style={{ flexGrow: s.seconds, background: s.kind === 'hard' ? 'var(--accent)' : undefined }} />
              ))}
            </div>
            <Card className="divide-y divide-line max-h-[260px] overflow-y-auto">
              {plan.segments.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cx('w-2.5 h-2.5 rounded-full', s.kind === 'hard' ? 'bg-accent' : s.kind === 'run' || s.kind === 'steady' ? 'bg-run' : s.kind === 'walk' || s.kind === 'recover' ? 'bg-calm' : 'bg-faint')} />
                  <span className="flex-1 text-[15px]">{s.label}</span>
                  <span className="num text-[14px] text-muted">{formatSeconds(s.seconds)}</span>
                </div>
              ))}
            </Card>
          </section>
        )}

        {plan.notes.map((n) => (
          <Notice key={n} icon="info">
            {n}
          </Notice>
        ))}

        <div className="space-y-2">
          <p className="text-[14px] text-muted">
            <strong className="text-ink">Warm-up:</strong> {plan.warmup}
          </p>
          <p className="text-[14px] text-muted">
            <strong className="text-ink">Cool-down:</strong> {plan.cooldown}
          </p>
        </div>

        <section>
          <SectionHeader title="Tracking" />
          <Segmented
            value={mode}
            onChange={setMode}
            size="lg"
            options={[
              { value: 'gps', label: geoAvailable ? 'GPS + timer' : 'GPS unavailable' },
              { value: 'timer', label: 'Timer only' },
            ]}
          />
          <p className="text-[13.5px] text-muted mt-2 leading-relaxed">
            {mode === 'gps'
              ? 'GPS works while Forge is open and the screen is on. iPhone pauses web apps when locked or in the background, so Forge keeps the screen awake. Gaps are never filled with invented data.'
              : 'Times your run without location. Enter the distance at the end if you know it.'}
          </p>
        </section>

        <div className="pt-2 pb-4 space-y-2">
          <Button size="xl" block icon="play" onClick={start} disabled={mode === 'gps' && !geoAvailable}>
            Start {type === 'free' ? 'run' : plan.segments.some((s) => s.kind === 'walk') ? 'run/walk' : 'run'}
          </Button>
          <Button size="lg" variant="ghost" block onClick={() => navigate(`/run/log?date=${date}&type=${type}`)}>
            Log a run manually instead
          </Button>
        </div>
      </div>
    </Screen>
  )
}

function segmentAt(segments: RunSegment[], elapsedSec: number) {
  let t = 0
  for (let i = 0; i < segments.length; i++) {
    if (elapsedSec < t + segments[i].seconds) return { index: i, remaining: t + segments[i].seconds - elapsedSec, seg: segments[i] }
    t += segments[i].seconds
  }
  return null
}

function ActiveRun({ run }: { run: Run }) {
  const units = useStore((s) => s.profile!.units)
  const keepAwake = useStore((s) => s.settings.keepAwake)
  const now = useNow(true, 500)
  const elapsed = elapsedMs(run, now)
  const paused = run.runningSince === null
  const wake = useWakeLock(keepAwake)
  const [gps, setGps] = useState<{ status: 'waiting' | 'ok' | 'poor' | 'denied' | 'error'; acc?: number }>({ status: 'waiting' })
  const [finishing, setFinishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const runRef = useRef(run)
  runRef.current = run

  // GPS: foreground watchPosition while running.
  useEffect(() => {
    if (run.source !== 'gps' || paused || !('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const r = runRef.current
        if (r.runningSince === null) return
        const p: GeoPoint = { t: pos.timestamp || Date.now(), lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, alt: pos.coords.altitude }
        setGps({ status: p.acc <= MAX_ACCURACY_M ? 'ok' : 'poor', acc: Math.round(p.acc) })
        // Never join a point from before a pause to one after it: that gap was not run.
        const prev = [...r.points].reverse().find((x) => x.acc <= MAX_ACCURACY_M && x.t >= (r.runningSince ?? 0))
        const inc = gpsIncrement(prev, p)
        saveRun({ ...r, points: [...r.points, p], distanceM: r.distanceM + inc }, { throttle: true })
      },
      (err) => setGps({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error' }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [run.source, paused])

  // Segment guidance.
  const seg = run.plan ? segmentAt(run.plan, Math.floor(elapsed / 1000)) : null
  const lastSeg = useRef<number | null>(seg?.index ?? null)
  const lastTick = useRef<number>(-1)
  const segIndex = seg?.index
  const segRemaining = seg ? Math.ceil(seg.remaining) : -1
  useEffect(() => {
    if (segIndex === undefined || paused || !run.plan) return
    const s = run.plan[segIndex]
    if (lastSeg.current !== segIndex) {
      lastSeg.current = segIndex
      beep('go')
      speak(`${s.label}. ${formatSeconds(s.seconds)}`)
    } else if (segRemaining <= 3 && segRemaining > 0 && lastTick.current !== segRemaining) {
      lastTick.current = segRemaining
      beep('tick')
    }
  }, [segIndex, segRemaining, paused, run.plan])
  const planDone = run.plan && !seg

  const togglePause = () => {
    const t = Date.now()
    if (run.runningSince) saveRun({ ...run, activeMs: run.activeMs + (t - run.runningSince), runningSince: null })
    else saveRun({ ...run, runningSince: t })
  }

  // Current pace from the last ~30 s of accepted GPS points.
  const recentPace = useMemo(() => {
    if (run.source !== 'gps') return undefined
    const pts = run.points.filter((p) => p.acc <= MAX_ACCURACY_M)
    const cutoff = now - 30_000
    const window = pts.filter((p) => p.t >= cutoff)
    if (window.length < 3) return undefined
    let d = 0
    for (let i = 1; i < window.length; i++) d += gpsIncrement(window[i - 1], window[i])
    const sec = (window.at(-1)!.t - window[0].t) / 1000
    return d > 15 ? sec / (d / 1000) : undefined
  }, [run.points, run.source, now])
  const avgPace = run.distanceM > 50 ? elapsed / 1000 / (run.distanceM / 1000) : undefined

  return (
    <div className="min-h-dvh flex flex-col max-w-[560px] mx-auto px-4 pt-safe pb-safe">
      <div className="flex items-center justify-between h-14">
        <IconButton icon="chevronLeft" label="Leave (run keeps going)" variant="ghost" className="-ml-2" onClick={() => navigate('/')} />
        <div className="flex items-center gap-2">
          {run.source === 'gps' && (
            <Badge tone={gps.status === 'ok' ? 'accent' : gps.status === 'waiting' ? 'neutral' : 'warn'}>
              <Icon name="pin" size={13} />
              {gps.status === 'ok' ? `GPS ±${gps.acc}m` : gps.status === 'poor' ? `Weak GPS ±${gps.acc}m` : gps.status === 'waiting' ? 'Finding GPS…' : gps.status === 'denied' ? 'Location blocked' : 'GPS error'}
            </Badge>
          )}
          {keepAwake && <Badge tone={wake.active ? 'neutral' : 'warn'}>{wake.active ? 'Screen on' : 'Keep screen on'}</Badge>}
        </div>
      </div>

      {gps.status === 'denied' && (
        <Notice tone="warn" icon="pin" title="Location permission is off">
          Distance can’t be measured. The timer keeps running; you can enter distance at the end. To allow location, enable it for Safari or the Home Screen app in iPhone Settings → Privacy & Security → Location Services.
        </Notice>
      )}

      {seg && (
        <div className={cx('mt-2 rounded-[24px] p-5 text-center', SEG_TONE[seg.seg.kind])} style={seg.seg.kind === 'hard' ? { background: 'var(--accent)' } : undefined}>
          <div className="text-[13px] font-semibold uppercase tracking-[0.1em] opacity-80">{seg.seg.kind === 'hard' ? 'Push' : seg.seg.kind === 'walk' || seg.seg.kind === 'recover' ? 'Recover' : seg.seg.kind === 'warmup' ? 'Warm up' : seg.seg.kind === 'cooldown' ? 'Cool down' : 'Run'}</div>
          <div className="text-[28px] font-bold mt-1">{seg.seg.label}</div>
          <div className="num text-[44px] font-bold leading-none mt-1">{formatDuration(seg.remaining * 1000)}</div>
          {run.plan![seg.index + 1] && <div className="text-[14px] opacity-80 mt-2">Next: {run.plan![seg.index + 1].label} · {formatSeconds(run.plan![seg.index + 1].seconds)}</div>}
        </div>
      )}
      {planDone && (
        <div className="mt-2 rounded-[24px] p-5 text-center bg-accent-soft text-accent-fg">
          <div className="text-[22px] font-bold">Plan complete</div>
          <div className="text-[14.5px] mt-1">Walk to cool down, then finish.</div>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center py-6">
        <div className="text-center">
          <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">Time</div>
          <div className={cx('num text-[76px] font-bold leading-none tracking-tight mt-1', paused && 'text-muted animate-pulse-soft')}>{formatDuration(elapsed)}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-8 text-center">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Distance</div>
            <div className="num text-[30px] font-bold mt-1">{run.source === 'gps' ? distanceValue(run.distanceM, units).toFixed(2) : '—'}</div>
            <div className="text-[12.5px] text-muted">{units.distance}</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Pace now</div>
            <div className="num text-[30px] font-bold mt-1">{formatPace(recentPace, units).split(' ')[0]}</div>
            <div className="text-[12.5px] text-muted">/{units.distance}</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Average</div>
            <div className="num text-[30px] font-bold mt-1">{formatPace(avgPace, units).split(' ')[0]}</div>
            <div className="text-[12.5px] text-muted">/{units.distance}</div>
          </div>
        </div>
        {run.source === 'gps' && !wake.supported && <p className="text-center text-[13px] text-warn mt-6">This browser can’t keep the screen on. Keep it awake manually so GPS keeps recording.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button size="xl" variant={paused ? 'primary' : 'secondary'} icon={paused ? 'play' : 'pause'} onClick={togglePause}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button size="xl" variant={paused || planDone ? 'primary' : 'outline'} icon="stop" onClick={() => setFinishing(true)}>
          Finish
        </Button>
      </div>
      <button type="button" className="text-[14px] text-muted font-medium mt-3 py-2" onClick={() => setDiscarding(true)}>
        Discard run
      </button>

      <FinishRunSheet open={finishing} onClose={() => setFinishing(false)} run={run} elapsedMs={elapsed} planDone={!!planDone} />
      <ConfirmSheet
        open={discarding}
        onClose={() => setDiscarding(false)}
        title="Discard this run?"
        body="Nothing from this run will be saved."
        confirmLabel="Discard run"
        danger
        onConfirm={() => {
          discardRun(run.id)
          navigate('/', { replace: true })
        }}
      />
    </div>
  )
}

function FinishRunSheet({ open, onClose, run, elapsedMs: ms, planDone }: { open: boolean; onClose: () => void; run: Run; elapsedMs: number; planDone: boolean }) {
  const units = useStore((s) => s.profile!.units)
  const [feel, setFeel] = useState<Feel>('moderate')
  const [rpe, setRpe] = useState(5)
  const [notes, setNotes] = useState('')
  const [manualDist, setManualDist] = useState<number | undefined>(undefined)
  const [completedPlan, setCompletedPlan] = useState(true)
  useEffect(() => setCompletedPlan(planDone || !run.plan), [planDone, run.plan, open])
  const measured = run.source === 'gps' ? distanceValue(run.distanceM, units) : undefined
  return (
    <Sheet open={open} onClose={onClose} title="Finish run">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 text-center">
            <div className="text-[12px] text-muted font-semibold uppercase">Time</div>
            <div className="num text-[22px] font-bold">{formatDuration(ms)}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-[12px] text-muted font-semibold uppercase">GPS distance</div>
            <div className="num text-[22px] font-bold">{measured !== undefined ? `${measured.toFixed(2)} ${units.distance}` : '—'}</div>
          </Card>
        </div>
        <label className="block">
          <span className="block text-[14px] font-medium text-muted mb-1.5">
            {run.source === 'gps' ? `Correct the distance (optional, ${units.distance})` : `Distance if known (${units.distance})`}
          </span>
          <NumberInput value={manualDist} onChange={setManualDist} placeholder={measured !== undefined ? measured.toFixed(2) : 'e.g. 4.2'} suffix={units.distance} ariaLabel="Distance" />
        </label>
        {run.plan && (
          <Segmented
            value={completedPlan ? 'yes' : 'no'}
            onChange={(v) => setCompletedPlan(v === 'yes')}
            options={[
              { value: 'yes', label: 'Completed the plan' },
              { value: 'no', label: 'Cut it short' },
            ]}
          />
        )}
        <div>
          <div className="font-semibold text-[15px] mb-2">How did it feel?</div>
          <Segmented
            value={feel}
            onChange={setFeel}
            size="lg"
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'hard', label: 'Difficult' },
            ]}
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="font-semibold text-[15px]">Effort</span>
            <span className="num font-bold text-accent-fg">{rpe} / 10</span>
          </div>
          <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="w-full accent-[var(--accent)] h-8" aria-label="Run effort from 1 to 10" />
        </div>
        <textarea className={cx(inputCls, 'h-20 py-3 resize-none')} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (route, weather, how your legs felt)" />
        <Button
          size="xl"
          block
          icon="check"
          onClick={() => {
            const state = getState()
            const live = state.runs.find((r) => r.id === run.id)
            if (live && manualDist !== undefined) saveRun({ ...live, distanceM: toMeters(manualDist, units), notes: [notes, run.source === 'gps' ? 'Distance adjusted manually' : ''].filter(Boolean).join(' · ') || undefined })
            const res = finishRun(run.id, { feel, rpe, notes: manualDist !== undefined && run.source === 'gps' ? [notes, 'Distance adjusted manually'].filter(Boolean).join(' · ') : notes || undefined, completedPlan })
            if (res?.message) toast(res.message, 'accent')
            navigate(`/run/${run.id}`, { replace: true })
          }}
        >
          Save run
        </Button>
      </div>
    </Sheet>
  )
}
