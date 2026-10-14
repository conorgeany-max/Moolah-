import { useEffect, useMemo, useRef, useState } from 'react'
import { ExerciseFigure } from '../components/ExerciseFigure'
import { Icon } from '../components/Icon'
import { Badge, Button, ConfirmSheet, cx, EmptyState, IconButton, inputCls, ProgressBar, ProgressRing, Segmented, Sheet, Stepper, Toggle } from '../components/ui'
import { ctxFromProfile, getExercise, nextInTrack, substitutes, unavailableReason } from '../engine/library'
import { rangeFor } from '../engine/programme'
import { valueOf } from '../engine/progression'
import { buildSteps, elapsedMs, exerciseAt, type Step } from '../engine/steps'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'
import { discardWorkout, finishWorkout, saveWorkout, setSlotExercise, updateSettings } from '../lib/actions'
import { beep, speak, unlockAudio } from '../lib/feedback'
import { formatDuration } from '../lib/format'
import { uid } from '../lib/id'
import { navigate } from '../lib/router'
import { getState, useStore } from '../lib/store'
import type { Effort, Exercise, ExerciseLog, Feel, Technique, Workout } from '../lib/types'

// ───────────── helpers ─────────────

/** The current position is derived from logged data, so it survives reloads and edits. */
function currentIndex(w: Workout, steps: Step[]) {
  const i = steps.findIndex((s) => exerciseAt(w, s).sets.length <= s.setIndex)
  return i < 0 ? steps.length : i
}

function update(w: Workout, fn: (draft: Workout) => void) {
  const copy: Workout = structuredClone(w)
  fn(copy)
  saveWorkout(copy)
  return copy
}

function lastPerformance(exerciseId: string, excludeId: string) {
  for (const w of getState().workouts) {
    if (w.id === excludeId || w.status === 'active') continue
    for (const b of w.blocks) for (const x of b.exercises) if (x.exerciseId === exerciseId && x.sets.length) return { date: w.date, sets: x.sets.map(valueOf), effort: x.effort }
  }
  return null
}

const unit = (ex: Exercise) => (ex.metric === 'time' ? 's' : ex.metric === 'distance' ? 'm' : 'reps')
const targetOf = (x: ExerciseLog, ex: Exercise) => (ex.metric === 'time' ? (x.targetSeconds ?? 30) : ex.metric === 'distance' ? (ex.defaults.meters ?? 20) : (x.targetReps ?? 10))

// ───────────── Player ─────────────

export function WorkoutPlayer() {
  const workout = useStore((s) => s.workouts.find((w) => w.status === 'active'))
  if (!workout)
    return (
      <div className="min-h-dvh pt-safe max-w-[560px] mx-auto px-4">
        <EmptyState
          icon="bolt"
          title="No workout in progress"
          body="Start today’s session from Home, or build a custom workout."
          action={<Button onClick={() => navigate('/', { replace: true })}>Go to Home</Button>}
        />
      </div>
    )
  return <Player key={workout.id} workout={workout} />
}

function Player({ workout: w }: { workout: Workout }) {
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)
  const steps = useMemo(() => buildSteps(w), [w])
  const idx = currentIndex(w, steps)
  const step = steps[idx] as Step | undefined
  const x = step ? exerciseAt(w, step) : undefined
  const ex = x ? getExercise(x.exerciseId) : undefined
  const block = step ? w.blocks[step.blockIndex] : undefined
  const paused = w.runningSince === null
  const now = useNow(true, 250)
  const elapsed = elapsedMs(w, now)
  const outdoor = !!(w.outdoorMode || settings.outdoorMode)
  useWakeLock(settings.keepAwake)

  const [sheet, setSheet] = useState<null | 'menu' | 'swap' | 'hurt' | 'info' | 'note' | 'finish' | 'discard'>(null)
  const [effortFor, setEffortFor] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('outdoor', outdoor)
    return () => document.documentElement.classList.remove('outdoor')
  }, [outdoor])

  // Rest timer derived from timestamps.
  const rest = w.rest
  const restRemaining = rest ? (rest.pausedRemainingMs ?? rest.durationSec * 1000 - (now - rest.startedAt)) : 0
  const lastBeep = useRef<number>(-1)
  useEffect(() => {
    if (!rest || rest.pausedRemainingMs !== null || paused) return
    const sec = Math.ceil(restRemaining / 1000)
    if (sec !== lastBeep.current && sec <= 3 && sec > 0) {
      lastBeep.current = sec
      beep('tick')
    }
    if (restRemaining <= 0) {
      lastBeep.current = -1
      beep('go')
      if (ex) speak(`Go. ${ex.name}${step && step.totalSets > 1 ? `, set ${step.setIndex + 1}` : ''}`)
      update(w, (d) => (d.rest = null))
    }
  }, [rest, restRemaining, paused, w, ex, step])

  // Freeze the rest timer when the whole workout is paused.
  const togglePause = () => {
    unlockAudio()
    update(w, (d) => {
      const t = Date.now()
      if (d.runningSince) {
        d.activeMs += t - d.runningSince
        d.runningSince = null
        if (d.rest && d.rest.pausedRemainingMs === null) d.rest.pausedRemainingMs = Math.max(0, d.rest.durationSec * 1000 - (t - d.rest.startedAt))
      } else {
        d.runningSince = t
        if (d.rest && d.rest.pausedRemainingMs !== null) {
          d.rest.startedAt = t - (d.rest.durationSec * 1000 - d.rest.pausedRemainingMs)
          d.rest.pausedRemainingMs = null
        }
      }
    })
  }

  const logSet = (value: number) => {
    if (!step || !x || !ex) return
    unlockAudio()
    const isLastSetOfExercise = !step.isCircuit && step.setIndex === x.targetSets - 1
    const restSec = idx < steps.length - 1 ? step.restAfterSec : 0
    update(w, (d) => {
      const dx = d.blocks[step.blockIndex].exercises[step.exerciseIndex]
      const prevSet = dx.sets.at(-1)
      dx.sets.push({
        id: uid('set'),
        reps: ex.metric === 'reps' ? value : undefined,
        seconds: ex.metric === 'time' ? value : undefined,
        meters: ex.metric === 'distance' ? value : undefined,
        completedAt: new Date().toISOString(),
        restTakenSec: prevSet ? Math.round((Date.now() - Date.parse(prevSet.completedAt)) / 1000) : undefined,
      })
      if (d.runningSince === null) d.runningSince = Date.now()
      d.rest = restSec > 10 && settings.autoStartRest ? { startedAt: Date.now(), durationSec: restSec, pausedRemainingMs: null } : null
      d.cursor = idx + 1
    })
    beep('tick')
    if (isLastSetOfExercise && (block?.kind === 'main' || block?.kind === 'finisher')) setEffortFor(x.id)
    if (idx + 1 >= steps.length) setSheet('finish')
  }

  const setEffort = (effort?: Effort, technique?: Technique) =>
    update(w, (d) => {
      for (const b of d.blocks)
        for (const e of b.exercises)
          if (e.id === effortFor) {
            if (effort) e.effort = effort
            if (technique) e.technique = technique
          }
    })

  const skipExercise = () => {
    if (!step) return
    update(w, (d) => {
      const dx = d.blocks[step.blockIndex].exercises[step.exerciseIndex]
      if (dx.sets.length) dx.targetSets = dx.sets.length
      else dx.skipped = true
      d.rest = null
    })
    setSheet(null)
  }

  // Warm-up and cool-down run as a follow-along countdown. The set records the time actually spent, not invented reps.
  const guidedDone = (secondsSpent: number) => {
    if (!step) return
    update(w, (d) => {
      const dx = d.blocks[step.blockIndex].exercises[step.exerciseIndex]
      dx.sets.push({ id: uid('set'), seconds: Math.max(1, Math.round(secondsSpent)), completedAt: new Date().toISOString() })
      if (d.runningSince === null) d.runningSince = Date.now()
      d.rest = null
    })
    if (idx + 1 >= steps.length) setSheet('finish')
  }
  const skipRestOfBlock = () => {
    if (!step) return
    update(w, (d) => {
      for (const dx of d.blocks[step.blockIndex].exercises) {
        if (dx.sets.length) dx.targetSets = dx.sets.length
        else dx.skipped = true
      }
      d.rest = null
    })
    if (step.blockIndex === w.blocks.length - 1) setSheet('finish')
  }

  const progress = steps.length ? idx / steps.length : 0
  const finished = idx >= steps.length

  return (
    <div className={cx('min-h-dvh flex flex-col max-w-[560px] mx-auto', outdoor && 'text-[17px]')}>
      {/* Top bar */}
      <div className="pt-safe px-4 sticky top-0 z-20 bg-canvas">
        <div className="flex items-center gap-2 h-14">
          <IconButton icon="x" label="End or exit workout" variant="ghost" size={44} className="-ml-2" onClick={() => setSheet('menu')} />
          <div className="flex-1 min-w-0 text-center">
            <div className="text-[13px] text-muted truncate">{w.title}</div>
            <div className={cx('num font-bold text-[20px] leading-tight', paused && 'animate-pulse-soft text-muted')}>{formatDuration(elapsed)}</div>
          </div>
          <IconButton icon={paused ? 'play' : 'pause'} label={paused ? 'Resume workout' : 'Pause workout'} variant={paused ? 'primary' : 'secondary'} size={44} onClick={togglePause} />
        </div>
        <ProgressBar value={progress} label="Workout progress" />
        <div className="flex justify-between text-[12px] text-faint mt-1.5 mb-1">
          <span>{block?.title ?? 'Finished'}</span>
          <span className="num">
            {Math.min(idx + 1, steps.length)} / {steps.length}
          </span>
        </div>
      </div>

      {paused && !finished && (
        <div className="mx-4 mt-2 p-3 rounded-[14px] bg-raised text-center text-[14.5px] font-medium">
          Paused. Your progress is saved.{' '}
          <button className="text-accent-fg font-semibold ml-1" onClick={togglePause}>
            Resume
          </button>
        </div>
      )}

      {finished ? (
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div className="animate-pop">
            <span className="inline-grid place-items-center w-20 h-20 rounded-full bg-accent text-accent-ink">
              <Icon name="check" size={40} strokeWidth={2.6} />
            </span>
            <h2 className="text-[26px] font-bold mt-5">All sets done</h2>
            <p className="text-muted mt-2">Finish to save your workout and see your summary.</p>
            <Button size="xl" className="mt-6" onClick={() => setSheet('finish')}>
              Finish workout
            </Button>
          </div>
        </div>
      ) : rest && step && x && ex ? (
        <RestView
          remainingMs={restRemaining}
          rest={rest}
          paused={paused}
          next={{ ex, x, step }}
          effortFor={effortFor ? w.blocks.flatMap((b) => b.exercises).find((e) => e.id === effortFor) : undefined}
          onEffort={setEffort}
          onDoneEffort={() => setEffortFor(null)}
          onSkip={() => update(w, (d) => (d.rest = null))}
          onAdd={(s) => update(w, (d) => d.rest && (d.rest.pausedRemainingMs !== null ? (d.rest.pausedRemainingMs += s * 1000) : (d.rest.durationSec += s)))}
          onReset={() => update(w, (d) => d.rest && ((d.rest.startedAt = Date.now()), d.rest.pausedRemainingMs !== null && (d.rest.pausedRemainingMs = d.rest.durationSec * 1000)))}
          onTogglePause={() =>
            update(w, (d) => {
              if (!d.rest) return
              if (d.rest.pausedRemainingMs === null) d.rest.pausedRemainingMs = Math.max(0, d.rest.durationSec * 1000 - (Date.now() - d.rest.startedAt))
              else {
                d.rest.startedAt = Date.now() - (d.rest.durationSec * 1000 - d.rest.pausedRemainingMs)
                d.rest.pausedRemainingMs = null
              }
            })
          }
        />
      ) : step && x && ex && (block?.kind === 'warmup' || block?.kind === 'cooldown') ? (
        <GuidedView
          key={`${x.id}-${step.setIndex}`}
          w={w}
          step={step}
          steps={steps}
          x={x}
          ex={ex}
          paused={paused}
          outdoor={outdoor}
          onDone={guidedDone}
          onSkipBlock={skipRestOfBlock}
          onSheet={setSheet}
        />
      ) : step && x && ex ? (
        <ExerciseView
          key={`${x.id}-${step.setIndex}`}
          w={w}
          step={step}
          x={x}
          ex={ex}
          outdoor={outdoor}
          effortFor={effortFor ? w.blocks.flatMap((b) => b.exercises).find((e) => e.id === effortFor) : undefined}
          onEffort={setEffort}
          onDoneEffort={() => setEffortFor(null)}
          onLog={logSet}
          onSheet={setSheet}
          onEditSet={(setIdx, value) =>
            update(w, (d) => {
              const s = d.blocks[step.blockIndex].exercises[step.exerciseIndex].sets[setIdx]
              if (ex.metric === 'reps') s.reps = value
              else if (ex.metric === 'time') s.seconds = value
              else s.meters = value
            })
          }
        />
      ) : null}

      {/* Sheets */}
      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Workout">
        <div className="grid gap-2">
          <Button size="lg" block onClick={() => setSheet('finish')}>
            Finish and save
          </Button>
          <Button size="lg" variant="secondary" block onClick={() => (setSheet(null), navigate('/'))}>
            Leave and keep in progress
          </Button>
          <div className="rounded-[16px] bg-raised overflow-hidden">
            <Toggle
              checked={outdoor}
              onChange={(v) => (update(w, (d) => (d.outdoorMode = v)), updateSettings({ outdoorMode: v }))}
              label="Outdoor mode"
              description="Maximum contrast, bigger controls, no-equipment swaps"
            />
            <Toggle checked={settings.voice} onChange={(v) => updateSettings({ voice: v })} label="Voice cues" description="Announces the next exercise when rest ends" />
            <Toggle checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} label="Sounds" />
          </div>
          <Button size="lg" variant="danger" block onClick={() => setSheet('discard')}>
            Discard workout
          </Button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={sheet === 'discard'}
        onClose={() => setSheet(null)}
        title="Discard this workout?"
        body="Logged sets from this session will be deleted. This can’t be undone."
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          discardWorkout(w.id)
          navigate('/', { replace: true })
        }}
      />
      {x && ex && profile && (
        <SwapSheet
          open={sheet === 'swap'}
          onClose={() => setSheet(null)}
          ex={ex}
          x={x}
          strict={outdoor}
          onSwap={(to, always) => {
            if (!step) return
            update(w, (d) => {
              const b = d.blocks[step.blockIndex]
              const dx = b.exercises[step.exerciseIndex]
              const range = rangeFor(to)
              const sameMetric = to.metric === ex.metric
              const target = sameMetric ? ((to.metric === 'time' ? dx.targetSeconds : dx.targetReps) ?? range[0]) : range[0]
              const fresh: ExerciseLog = {
                ...dx,
                id: uid('xl'),
                exerciseId: to.id,
                originalExerciseId: dx.originalExerciseId ?? dx.exerciseId,
                targetReps: to.metric === 'reps' ? target : undefined,
                targetSeconds: to.metric === 'time' ? target : undefined,
                perSide: to.perSide,
                restSec: dx.restSec,
                sets: [],
                effort: undefined,
                technique: undefined,
              }
              if (dx.sets.length && !step.isCircuit) {
                fresh.targetSets = dx.targetSets - dx.sets.length
                dx.targetSets = dx.sets.length
                b.exercises.splice(step.exerciseIndex + 1, 0, fresh)
              } else {
                b.exercises[step.exerciseIndex] = { ...fresh, sets: dx.sets }
              }
              d.rest = null
            })
            if (always && x.slotId) setSlotExercise(x.slotId, to.id, rangeFor(to)[0], rangeFor(to), to.metric)
            setSheet(null)
          }}
        />
      )}
      <Sheet open={sheet === 'hurt'} onClose={() => setSheet(null)} title="Something hurts?">
        <div className="space-y-4 text-[15px] leading-relaxed">
          <p>
            <strong>Stop this exercise.</strong> Muscle burn, fatigue and mild soreness are normal effort. Sharp or stabbing pain, joint pain, pain that changes how you move, numbness, tingling, chest
            pain or dizziness are not.
          </p>
          <p className="text-muted">If symptoms are severe, worsening or don’t settle, stop training and get advice from a qualified professional. Forge can’t diagnose injuries.</p>
          <div className="grid gap-2">
            {ex && x?.slotId && profile && nextInTrack(trackFor(x), ex.id, -1, ctxFromProfile(profile)) && (
              <Button
                size="lg"
                variant="secondary"
                block
                onClick={() => {
                  const easier = nextInTrack(trackFor(x), ex.id, -1, ctxFromProfile(profile))!
                  update(w, (d) => {
                    const dx = d.blocks[step!.blockIndex].exercises[step!.exerciseIndex]
                    dx.note = [dx.note, `Discomfort reported; swapped to ${easier.name}`].filter(Boolean).join('. ')
                  })
                  setSheet('swap')
                }}
              >
                Try an easier variation
              </Button>
            )}
            <Button
              size="lg"
              variant="secondary"
              block
              onClick={() => (
                update(w, (d) => {
                  const dx = d.blocks[step!.blockIndex].exercises[step!.exerciseIndex]
                  dx.note = [dx.note, 'Skipped: discomfort'].filter(Boolean).join('. ')
                }),
                skipExercise()
              )}
            >
              Skip this exercise
            </Button>
            <Button size="lg" variant="danger" block onClick={() => setSheet('finish')}>
              End the workout
            </Button>
          </div>
        </div>
      </Sheet>
      {ex && (
        <Sheet open={sheet === 'info'} onClose={() => setSheet(null)} title={ex.name} tall>
          <ExerciseInfo ex={ex} />
        </Sheet>
      )}
      {x && step && (
        <NoteSheet
          open={sheet === 'note'}
          onClose={() => setSheet(null)}
          initial={x.note ?? ''}
          onSave={(note) => update(w, (d) => (d.blocks[step.blockIndex].exercises[step.exerciseIndex].note = note || undefined))}
          onSkip={skipExercise}
        />
      )}
      <FinishSheet
        open={sheet === 'finish'}
        onClose={() => setSheet(null)}
        incomplete={!finished}
        onFinish={(info) => {
          const r = finishWorkout(w.id, info, !finished)
          if (r) navigate(`/workout/summary/${w.id}`, { replace: true })
        }}
      />
    </div>
  )
}

function trackFor(x: ExerciseLog) {
  return (x.slotId ?? 'push') as Parameters<typeof nextInTrack>[0]
}

// ───────────── Exercise (active set) ─────────────

function ExerciseView({
  w,
  step,
  x,
  ex,
  outdoor,
  effortFor,
  onEffort,
  onDoneEffort,
  onLog,
  onSheet,
  onEditSet,
}: {
  w: Workout
  step: Step
  x: ExerciseLog
  ex: Exercise
  outdoor: boolean
  effortFor?: ExerciseLog
  onEffort: (e?: Effort, t?: Technique) => void
  onDoneEffort: () => void
  onLog: (v: number) => void
  onSheet: (s: 'swap' | 'hurt' | 'info' | 'note') => void
  onEditSet: (i: number, v: number) => void
}) {
  const target = targetOf(x, ex)
  const [value, setValue] = useState(() => (x.sets.at(-1) ? valueOf(x.sets.at(-1)!) : target))
  const [showHow, setShowHow] = useState(x.sets.length === 0 && step.setIndex === 0 && !outdoor)
  const [editing, setEditing] = useState<number | null>(null)
  const last = useMemo(() => lastPerformance(ex.id, w.id), [ex.id, w.id])

  return (
    <div className="flex-1 flex flex-col px-4 pb-safe">
      {effortFor && <EffortPrompt x={effortFor} onEffort={onEffort} onDone={onDoneEffort} />}

      <div className="pt-3 animate-rise">
        <div className="flex items-center gap-2 flex-wrap">
          {step.totalSets > 1 && <Badge tone="accent">{step.isCircuit ? `Round ${step.setIndex + 1} of ${step.totalSets}` : `Set ${step.setIndex + 1} of ${step.totalSets}`}</Badge>}
          {ex.perSide && <Badge>Each side</Badge>}
          {x.originalExerciseId && <Badge tone="calm">Substituted</Badge>}
        </div>
        <h1 className={cx('font-bold tracking-[-0.02em] leading-[1.1] mt-2', outdoor ? 'text-[34px]' : 'text-[30px]')}>{ex.name}</h1>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="num text-[22px] font-semibold text-accent-fg">
            {target} {unit(ex)}
          </span>
          <span className="text-muted text-[15px]">target{ex.perSide ? ' per side' : ''}</span>
          {x.restSec > 10 && !step.isCircuit && <span className="text-faint text-[14px] ml-auto">Rest {x.restSec}s</span>}
        </div>
      </div>

      {!outdoor && (
        <div className="mt-3 rounded-[20px] bg-surface border border-line overflow-hidden">
          <button type="button" className="w-full flex items-center gap-3 p-3" onClick={() => setShowHow(!showHow)} aria-expanded={showHow}>
            <div className="w-[84px] h-[60px] rounded-[12px] bg-sunken shrink-0 p-1">
              <ExerciseFigure figure={ex.figure} animated={!getState().settings.reducedMotion} label={`${ex.name} diagram`} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-[14.5px] font-semibold">How to</div>
              <div className="text-[13.5px] text-muted truncate">{ex.cues.join(' · ')}</div>
            </div>
            <Icon name={showHow ? 'chevronUp' : 'chevronDown'} size={18} className="text-faint" />
          </button>
          {showHow && (
            <div className="px-4 pb-4 animate-fade">
              <ol className="space-y-1.5 text-[14.5px] leading-relaxed list-decimal pl-5 marker:text-faint">
                {ex.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="text-[13.5px] text-muted mt-2">
                <strong className="text-ink">Breathing:</strong> {ex.breathing}
              </p>
              <button type="button" className="text-[14px] font-semibold text-accent-fg mt-2" onClick={() => onSheet('info')}>
                Mistakes, safety and variations
              </button>
            </div>
          )}
        </div>
      )}

      {/* Logged sets & last time */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 min-h-[36px]">
        {x.sets.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setEditing(i)}
            className="press h-9 px-3 rounded-full bg-accent-soft text-accent-fg text-[14px] font-semibold num"
            aria-label={`Edit set ${i + 1}: ${valueOf(s)} ${unit(ex)}`}
          >
            {valueOf(s)}
            {ex.metric === 'time' ? 's' : ''}
          </button>
        ))}
        {last && (
          <span className="text-[13px] text-muted ml-auto">
            Last time: <span className="num text-ink">{last.sets.join(', ')}</span>
            {ex.metric === 'time' ? ' s' : ''}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Logging control */}
      <div className="pt-4">
        {ex.metric === 'reps' && (
          <>
            <Stepper value={value} onChange={setValue} min={0} max={300} label="Reps" unit={ex.perSide ? 'reps / side' : 'reps'} size="xl" />
            <Button size="xl" block className={cx('mt-4', outdoor && 'h-20 text-[20px]')} icon="check" onClick={() => onLog(value)}>
              Log set
            </Button>
          </>
        )}
        {ex.metric === 'time' && <HoldTimer target={target} perSide={!!ex.perSide} outdoor={outdoor} onLog={onLog} />}
        {ex.metric === 'distance' && (
          <Button size="xl" block className={cx(outdoor && 'h-20 text-[20px]')} icon="check" onClick={() => onLog(target)}>
            Done · {target} m
          </Button>
        )}
        <div className="grid grid-cols-4 gap-1 mt-3">
          <MiniAction icon="swap" label="Swap" onClick={() => onSheet('swap')} />
          <MiniAction icon="note" label="Note / skip" onClick={() => onSheet('note')} />
          <MiniAction icon="info" label="Details" onClick={() => onSheet('info')} />
          <MiniAction icon="alert" label="It hurts" onClick={() => onSheet('hurt')} />
        </div>
      </div>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={`Edit set ${(editing ?? 0) + 1}`}>
        {editing !== null && x.sets[editing] && (
          <EditSet initial={valueOf(x.sets[editing])} unitLabel={unit(ex)} step={ex.metric === 'time' ? 5 : 1} onSave={(v) => (onEditSet(editing, v), setEditing(null))} />
        )}
      </Sheet>
    </div>
  )
}

function EditSet({ initial, unitLabel, step, onSave }: { initial: number; unitLabel: string; step: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(initial)
  return (
    <div className="space-y-5 pt-2">
      <Stepper value={v} onChange={setV} step={step} min={0} max={600} unit={unitLabel} size="xl" label="Value" />
      <Button size="lg" block onClick={() => onSave(v)}>
        Save
      </Button>
    </div>
  )
}

function MiniAction({ icon, label, onClick }: { icon: Parameters<typeof Icon>[0]['name']; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex flex-col items-center gap-1 py-2 rounded-[14px] text-muted hover:bg-raised">
      <Icon name={icon} size={20} />
      <span className="text-[11.5px] font-medium">{label}</span>
    </button>
  )
}

function HoldTimer({ target, perSide, outdoor, onLog }: { target: number; perSide: boolean; outdoor: boolean; onLog: (v: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [side1, setSide1] = useState<number | null>(null)
  const [manual, setManual] = useState(target)
  const now = useNow(startedAt !== null, 100)
  const held = startedAt ? Math.floor((now - startedAt) / 1000) : 0
  const remaining = target - held
  const beeped = useRef(-1)
  useEffect(() => {
    if (!startedAt) return
    if (remaining <= 3 && remaining > 0 && beeped.current !== remaining) {
      beeped.current = remaining
      beep('tick')
    }
    if (remaining === 0 && beeped.current !== 0) {
      beeped.current = 0
      beep('done')
    }
  }, [remaining, startedAt])

  const stop = () => {
    const secs = held
    setStartedAt(null)
    beeped.current = -1
    if (secs < 1) return // stopped straight away: treat as a cancelled start, not a 0-second set
    if (perSide && side1 === null) {
      setSide1(secs)
      return
    }
    onLog(perSide && side1 !== null ? Math.min(side1, secs) : secs)
  }
  const sideLabel = perSide ? (side1 === null ? 'First side' : 'Second side') : null

  if (startedAt === null) {
    return (
      <div>
        {sideLabel && (
          <p className="text-center text-[15px] font-semibold mb-2">
            {sideLabel}
            {side1 !== null ? ` · first side ${side1}s` : ''}
          </p>
        )}
        <Button size="xl" block className={cx(outdoor && 'h-20 text-[20px]')} icon="play" onClick={() => (unlockAudio(), setStartedAt(Date.now()))}>
          Start {target}s hold
        </Button>
        {side1 === null && (
          <details className="mt-3 rounded-[16px] bg-surface border border-line">
            <summary className="px-4 py-3 text-[14px] font-semibold text-muted cursor-pointer">Log a time manually</summary>
            <div className="px-4 pb-4">
              <Stepper value={manual} onChange={setManual} step={5} min={0} max={600} unit="s" label="Seconds" />
              <Button block className="mt-3" variant="secondary" onClick={() => onLog(manual)}>
                Log {manual}s
              </Button>
            </div>
          </details>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center">
      {sideLabel && <p className="text-[15px] font-semibold mb-2">{sideLabel}</p>}
      <ProgressRing value={Math.min(1, held / target)} size={outdoor ? 220 : 190} stroke={12} label={`${held} of ${target} seconds`}>
        <div className="text-center">
          <div className={cx('num font-bold leading-none', outdoor ? 'text-[64px]' : 'text-[56px]')}>{remaining > 0 ? remaining : `+${-remaining}`}</div>
          <div className="text-[13px] text-muted mt-1">{remaining > 0 ? 'seconds left' : 'over target'}</div>
        </div>
      </ProgressRing>
      <Button size="xl" block className={cx('mt-5', outdoor && 'h-20 text-[20px]')} icon="stop" variant={remaining > 0 ? 'secondary' : 'primary'} onClick={stop}>
        {remaining > 0 ? `Stop at ${held}s` : `Done · ${held}s`}
      </Button>
    </div>
  )
}

function EffortPrompt({ x, onEffort, onDone }: { x: ExerciseLog; onEffort: (e?: Effort, t?: Technique) => void; onDone: () => void }) {
  const ex = getExercise(x.exerciseId)
  const choose = (e: Effort, t?: Technique) => {
    onEffort(e, t)
    onDone()
  }
  const options: { label: string; sub: string; pick: () => void }[] = [
    { label: 'Easy', sub: '3+ reps left', pick: () => choose('easy') },
    { label: 'Solid', sub: '1–2 left', pick: () => choose('solid') },
    { label: 'Max', sub: 'nothing left', pick: () => choose('max') },
    { label: 'Form slipped', sub: 'reps got sloppy', pick: () => choose('max', 'breakdown') },
  ]
  return (
    <div className="mt-3 p-4 rounded-[20px] bg-raised border border-line animate-rise">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold">How was the last set of {ex?.name ?? 'that'}?</div>
        <button type="button" className="text-[13.5px] text-muted font-medium px-1 py-1" onClick={onDone}>
          Skip
        </button>
      </div>
      <p className="text-[12.5px] text-muted mt-0.5">One tap. This decides when you’re ready to progress.</p>
      <div className="grid grid-cols-4 gap-1.5 mt-3" role="group" aria-label="Effort on the last set">
        {options.map((o) => (
          <button key={o.label} type="button" onClick={o.pick} className="press rounded-[14px] bg-sunken border border-line px-1 py-2.5 text-center">
            <span className="block text-[14px] font-semibold leading-tight">{o.label}</span>
            <span className="block text-[11px] text-muted mt-0.5 leading-tight">{o.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ───────────── Guided warm-up / cool-down ─────────────

/** Seconds a follow-along move lasts: its hold time, or about 2 s per rep (both sides when per side). */
function guidedSeconds(x: ExerciseLog) {
  if (x.targetSeconds) return x.targetSeconds * (x.perSide ? 2 : 1)
  return Math.max(20, (x.targetReps ?? 8) * 2 * (x.perSide ? 2 : 1))
}

function GuidedView({
  w,
  step,
  steps,
  x,
  ex,
  paused,
  outdoor,
  onDone,
  onSkipBlock,
  onSheet,
}: {
  w: Workout
  step: Step
  steps: Step[]
  x: ExerciseLog
  ex: Exercise
  paused: boolean
  outdoor: boolean
  onDone: (seconds: number) => void
  onSkipBlock: () => void
  onSheet: (s: 'swap' | 'info') => void
}) {
  const total = guidedSeconds(x)
  const [spentMs, setSpentMs] = useState(0)
  const last = useRef(Date.now())
  const finished = useRef(false)
  useEffect(() => {
    last.current = Date.now()
    if (paused) return
    const id = setInterval(() => {
      const t = Date.now()
      setSpentMs((v) => v + (t - last.current))
      last.current = t
    }, 200)
    return () => clearInterval(id)
  }, [paused])
  const remaining = Math.max(0, Math.ceil(total - spentMs / 1000))
  const lastTick = useRef(-1)
  useEffect(() => {
    if (finished.current) return
    if (remaining <= 3 && remaining > 0 && remaining !== lastTick.current) {
      lastTick.current = remaining
      beep('tick')
    }
    if (remaining === 0) {
      finished.current = true
      beep('go')
      onDone(total)
    }
  }, [remaining, total, onDone])

  const block = w.blocks[step.blockIndex]
  const inBlock = steps.filter((s) => s.blockIndex === step.blockIndex)
  const pos = inBlock.findIndex((s) => s.exerciseIndex === step.exerciseIndex && s.setIndex === step.setIndex)
  const nextStep = steps[steps.indexOf(step) + 1]
  const nextEx = nextStep ? getExercise(exerciseAt(w, nextStep).exerciseId) : undefined
  const dose = x.targetSeconds ? `${x.targetSeconds}s${x.perSide ? ' each side' : ''}` : `${x.targetReps ?? 8} reps${x.perSide ? ' each side' : ''}`

  return (
    <div className="flex-1 flex flex-col px-4 pb-safe">
      <div className="pt-3 animate-rise">
        <div className="flex items-center gap-2">
          <Badge tone="calm">
            {block.kind === 'warmup' ? 'Warm-up' : 'Cool-down'} · {pos + 1} of {inBlock.length}
          </Badge>
          <span className="text-[13px] text-muted">Follow along. It moves on by itself.</span>
        </div>
        <h1 className={cx('font-bold tracking-[-0.02em] mt-3 leading-tight', outdoor ? 'text-[36px]' : 'text-[30px]')}>{ex.name}</h1>
        <div className="text-[17px] text-accent-fg font-semibold mt-1">{dose}</div>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <div className="w-36 shrink-0 rounded-[18px] bg-sunken border border-line p-2 aspect-[3/2]">
          <ExerciseFigure figure={ex.figure} animated={!getState().settings.reducedMotion} label={`${ex.name} diagram`} />
        </div>
        <p className="text-[14.5px] text-muted leading-snug">{ex.cues.slice(0, 2).join(' · ')}</p>
      </div>
      <div className="flex-1 grid place-items-center py-6">
        <ProgressRing value={total ? spentMs / 1000 / total : 0} size={outdoor ? 220 : 196} stroke={10} tone="calm" label="Time left on this move">
          <div className="text-center">
            <div className={cx('num font-bold leading-none', outdoor ? 'text-[64px]' : 'text-[56px]', paused && 'text-muted')}>{formatDuration(remaining * 1000)}</div>
            <div className="text-[13px] text-muted mt-1">{paused ? 'paused' : x.perSide && !x.targetSeconds ? 'switch sides halfway' : 'left'}</div>
          </div>
        </ProgressRing>
      </div>
      {nextEx && nextStep.blockIndex === step.blockIndex && <p className="text-center text-[14px] text-muted mb-3">Next: {nextEx.name}</p>}
      <Button
        size="xl"
        block
        iconRight="skip"
        className={cx(outdoor && 'h-20 text-[20px]')}
        onClick={() => {
          if (finished.current) return
          finished.current = true
          onDone(spentMs / 1000)
        }}
      >
        Next move
      </Button>
      <div className="grid grid-cols-3 gap-2 mt-3 mb-2 text-[13.5px]">
        <button type="button" className="press py-2.5 text-muted font-medium" onClick={() => onSheet('swap')}>
          Swap
        </button>
        <button type="button" className="press py-2.5 text-muted font-medium" onClick={() => onSheet('info')}>
          How to
        </button>
        <button type="button" className="press py-2.5 text-muted font-medium" onClick={onSkipBlock}>
          Skip {block.kind === 'warmup' ? 'warm-up' : 'cool-down'}
        </button>
      </div>
    </div>
  )
}

// ───────────── Rest ─────────────

function RestView({
  remainingMs,
  rest,
  paused,
  next,
  effortFor,
  onEffort,
  onDoneEffort,
  onSkip,
  onAdd,
  onReset,
  onTogglePause,
}: {
  remainingMs: number
  rest: NonNullable<Workout['rest']>
  paused: boolean
  next: { ex: Exercise; x: ExerciseLog; step: Step }
  effortFor?: ExerciseLog
  onEffort: (e?: Effort, t?: Technique) => void
  onDoneEffort: () => void
  onSkip: () => void
  onAdd: (s: number) => void
  onReset: () => void
  onTogglePause: () => void
}) {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000))
  const restPaused = rest.pausedRemainingMs !== null || paused
  return (
    <div className="flex-1 flex flex-col px-4 pb-safe">
      {effortFor && <EffortPrompt x={effortFor} onEffort={onEffort} onDone={onDoneEffort} />}
      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted mb-4">Rest</div>
        <ProgressRing value={remainingMs / (rest.durationSec * 1000)} size={220} stroke={10} label={`${sec} seconds of rest left`}>
          <div className="text-center">
            <div className={cx('num text-[68px] font-bold leading-none tracking-tight', restPaused && 'text-muted')}>{formatDuration(sec * 1000)}</div>
            {restPaused && <div className="text-[13px] text-muted mt-1">paused</div>}
          </div>
        </ProgressRing>
        <div className="flex items-center gap-3 mt-6">
          <IconButton icon="reset" label="Reset rest timer" size={52} onClick={onReset} />
          <IconButton
            icon={rest.pausedRemainingMs !== null ? 'play' : 'pause'}
            label={rest.pausedRemainingMs !== null ? 'Resume rest timer' : 'Pause rest timer'}
            size={52}
            onClick={onTogglePause}
            disabled={paused}
          />
          <Button variant="secondary" size="md" className="rounded-full h-[52px]" onClick={() => onAdd(15)}>
            +15s
          </Button>
        </div>
      </div>
      <div className="p-4 rounded-[20px] bg-surface border border-line flex items-center gap-3">
        <div className="w-[64px] h-[46px] rounded-[10px] bg-sunken p-0.5 shrink-0">
          <ExerciseFigure figure={next.ex.figure} animated={false} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] text-muted font-semibold uppercase tracking-[0.06em]">Up next</div>
          <div className="font-semibold truncate">{next.ex.name}</div>
          <div className="text-[13.5px] text-muted">
            {next.step.isCircuit ? `Round ${next.step.setIndex + 1}` : `Set ${next.step.setIndex + 1} of ${next.step.totalSets}`} · {targetOf(next.x, next.ex)} {unit(next.ex)}
          </div>
        </div>
      </div>
      <Button size="xl" block className="mt-3" iconRight="skip" onClick={onSkip}>
        Skip rest
      </Button>
    </div>
  )
}

// ───────────── Sheets ─────────────

function SwapSheet({ open, onClose, ex, x, strict, onSwap }: { open: boolean; onClose: () => void; ex: Exercise; x: ExerciseLog; strict: boolean; onSwap: (to: Exercise, always: boolean) => void }) {
  const profile = useStore((s) => s.profile)
  const [always, setAlways] = useState(false)
  const ctx = ctxFromProfile(profile, strict)
  const track = x.slotId ? trackFor(x) : undefined
  const easier = track ? nextInTrack(track, ex.id, -1, ctx) : ex.easierId ? getExercise(ex.easierId) : undefined
  const harder = track ? nextInTrack(track, ex.id, 1, ctx) : ex.harderId ? getExercise(ex.harderId) : undefined
  const subs = substitutes(ex, ctx).filter((s) => s.id !== easier?.id && s.id !== harder?.id)
  const Row = ({ e, tag }: { e: Exercise; tag?: string }) => (
    <button type="button" onClick={() => onSwap(e, always)} className="press w-full flex items-center gap-3 p-3 rounded-[16px] bg-raised text-left">
      <div className="w-[56px] h-[40px] rounded-[10px] bg-sunken p-0.5 shrink-0">
        <ExerciseFigure figure={e.figure} animated={false} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] truncate">{e.name}</div>
        <div className="text-[13px] text-muted truncate">{e.muscles.slice(0, 3).join(', ')}</div>
      </div>
      {tag && <Badge tone={tag === 'Easier' ? 'calm' : tag === 'Harder' ? 'accent' : 'neutral'}>{tag}</Badge>}
    </button>
  )
  return (
    <Sheet open={open} onClose={onClose} title={`Swap ${ex.name}`}>
      <div className="space-y-2">
        {easier && <Row e={easier} tag="Easier" />}
        {harder && <Row e={harder} tag="Harder" />}
        {subs.map((s) => (
          <Row key={s.id} e={s} tag="Similar" />
        ))}
        {!easier && !harder && !subs.length && <p className="text-muted text-[14.5px]">No comparable alternatives fit your equipment and restrictions. Skipping this exercise is fine.</p>}
      </div>
      {x.slotId && (
        <div className="mt-3 rounded-[16px] bg-surface border border-line">
          <Toggle checked={always} onChange={setAlways} label="Use in my programme from now on" description="Otherwise the swap applies to this workout only." />
        </div>
      )}
      <p className="text-[12.5px] text-faint mt-3">Alternatives keep the same movement pattern and only use equipment you have.</p>
    </Sheet>
  )
}

function NoteSheet({ open, onClose, initial, onSave, onSkip }: { open: boolean; onClose: () => void; initial: string; onSave: (n: string) => void; onSkip: () => void }) {
  const [note, setNote] = useState(initial)
  useEffect(() => setNote(initial), [initial, open])
  return (
    <Sheet open={open} onClose={onClose} title="Exercise note">
      <textarea className={cx(inputCls, 'h-28 py-3 resize-none')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="How did it feel? What to improve?" />
      <div className="grid gap-2 mt-3">
        <Button size="lg" block onClick={() => (onSave(note), onClose())}>
          Save note
        </Button>
        <Button size="lg" variant="secondary" block icon="skip" onClick={onSkip}>
          Skip rest of this exercise
        </Button>
      </div>
    </Sheet>
  )
}

function FinishSheet({ open, onClose, incomplete, onFinish }: { open: boolean; onClose: () => void; incomplete: boolean; onFinish: (info: { rpe?: number; feel?: Feel; notes?: string }) => void }) {
  const [rpe, setRpe] = useState(6)
  const [feel, setFeel] = useState<Feel>('moderate')
  const [notes, setNotes] = useState('')
  return (
    <Sheet open={open} onClose={onClose} title={incomplete ? 'End workout early?' : 'Nice work. How was it?'}>
      <div className="space-y-5">
        {incomplete && <p className="text-[14.5px] text-muted">Logged sets are saved. Unfinished exercises won’t count towards progression.</p>}
        <div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold text-[15px]">Overall effort</span>
            <span className="num text-accent-fg font-bold">{rpe} / 10</span>
          </div>
          <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="w-full accent-[var(--accent)] h-8" aria-label="Session effort from 1 to 10" />
          <div className="flex justify-between text-[12px] text-faint">
            <span>Very easy</span>
            <span>Maximal</span>
          </div>
        </div>
        <Segmented
          value={feel}
          options={[
            { value: 'easy', label: 'Felt easy' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'hard', label: 'Hard' },
          ]}
          onChange={setFeel}
          size="lg"
        />
        <textarea className={cx(inputCls, 'h-24 py-3 resize-none')} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes: how you felt, what was difficult, what to improve" />
        <Button size="xl" block icon="check" onClick={() => onFinish({ rpe, feel, notes: notes.trim() || undefined })}>
          Save workout
        </Button>
      </div>
    </Sheet>
  )
}

export function ExerciseInfo({ ex }: { ex: Exercise }) {
  const profile = useStore((s) => s.profile)
  const reason = profile ? unavailableReason(ex, ctxFromProfile(profile)) : null
  const easier = ex.easierId ? getExercise(ex.easierId) : undefined
  const harder = ex.harderId ? getExercise(ex.harderId) : undefined
  return (
    <div className="space-y-5 pb-4">
      <div className="rounded-[20px] bg-sunken border border-line p-3 aspect-[3/2]">
        <ExerciseFigure figure={ex.figure} animated={!getState().settings.reducedMotion} label={`${ex.name} diagram`} />
      </div>
      <p className="text-[15.5px] leading-relaxed">{ex.summary}</p>
      {reason && (
        <div className="p-3 rounded-[14px] bg-warn-soft text-[14px]">
          <strong>Not in your plan:</strong> {reason}.
        </div>
      )}
      <InfoList title="Steps" items={ex.steps} ordered />
      <InfoList title="Cues" items={ex.cues} />
      <div>
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1.5">Breathing</h3>
        <p className="text-[15px] leading-relaxed">{ex.breathing}</p>
      </div>
      <InfoList title="Common mistakes" items={ex.mistakes} />
      <InfoList title="Safety" items={ex.safety} />
      {(easier || harder) && (
        <div className="grid grid-cols-2 gap-2">
          {easier && (
            <div className="p-3 rounded-[14px] bg-raised">
              <div className="text-[12px] text-muted font-semibold">EASIER</div>
              <div className="text-[14.5px] font-semibold mt-0.5">{easier.name}</div>
            </div>
          )}
          {harder && (
            <div className="p-3 rounded-[14px] bg-raised">
              <div className="text-[12px] text-muted font-semibold">HARDER</div>
              <div className="text-[14.5px] font-semibold mt-0.5">{harder.name}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoList({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <div>
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted mb-1.5">{title}</h3>
      <Tag className={cx('space-y-1.5 text-[15px] leading-relaxed pl-5', ordered ? 'list-decimal' : 'list-disc', 'marker:text-faint')}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </Tag>
    </div>
  )
}
