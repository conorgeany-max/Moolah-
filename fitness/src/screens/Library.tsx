import { useMemo, useState } from 'react'
import { ExerciseFigure } from '../components/ExerciseFigure'
import { Screen } from '../components/Layout'
import { Badge, Button, Chip, ConfirmSheet, EmptyState, inputCls, ListGroup, ListRow, Notice, SectionHeader, Segmented, toast } from '../components/ui'
import { CATEGORY_LABEL, EQUIPMENT_LABEL, TRACKS, trackOf } from '../data/exercises'
import { MOBILITY_ROUTINES, ROUTINE_MAP } from '../data/mobility'
import { allExercises, ctxFromProfile, getExercise, unavailableReason } from '../engine/library'
import { newWorkout, rangeFor, routineBlock } from '../engine/programme'
import { setSlotExercise } from '../lib/actions'
import { dayKey } from '../lib/date'
import { navigate, useRoute } from '../lib/router'
import { startCustom } from '../lib/session'
import { getState, useStore } from '../lib/store'
import type { Exercise, ExerciseCategory } from '../lib/types'
import { ExerciseInfo } from './WorkoutPlayer'

type Tab = 'exercises' | 'routines' | 'pathways'

const CATEGORIES: ExerciseCategory[] = ['push', 'legs', 'unilateral', 'hinge', 'core', 'pull', 'jump', 'conditioning', 'running-drill', 'mobility', 'stretch']

const DIFFICULTY = ['', 'Beginner', 'Easy', 'Intermediate', 'Hard', 'Advanced']

export function Library() {
  const { query } = useRoute()
  const tab = (query.get('tab') as Tab) || 'exercises'
  const setTab = (t: Tab) => navigate(t === 'exercises' ? '/library' : `/library?tab=${t}`, { replace: true })
  return (
    <Screen title="Library">
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { value: 'exercises', label: 'Exercises' },
          { value: 'routines', label: 'Mobility' },
          { value: 'pathways', label: 'Pathways' },
        ]}
      />
      {tab === 'exercises' && <ExerciseList />}
      {tab === 'routines' && <RoutineList />}
      {tab === 'pathways' && <PathwayList />}
    </Screen>
  )
}

function ExerciseList() {
  const profile = useStore((s) => s.profile)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<ExerciseCategory | 'all'>('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const ctx = useMemo(() => ctxFromProfile(profile), [profile])
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return allExercises()
      .filter((e) => cat === 'all' || e.category === cat)
      .filter((e) => !onlyMine || !unavailableReason(e, ctx))
      .filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.muscles.some((m) => m.toLowerCase().includes(needle)) || CATEGORY_LABEL[e.category].toLowerCase().includes(needle))
      .sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name))
  }, [q, cat, onlyMine, ctx])

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search exercises or muscles"
        aria-label="Search exercises"
        className={inputCls}
      />
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
        <Chip selected={cat === 'all'} onClick={() => setCat('all')}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={cat === c} onClick={() => setCat(c)} className="shrink-0">
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[14px] text-muted">
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="w-5 h-5 accent-[var(--accent)]" />
        Only show exercises that fit my setup
      </label>
      <p className="text-[13px] text-faint">{list.length} exercises</p>
      {list.length === 0 ? (
        <EmptyState icon="search" title="Nothing matches" body="Try a different search or category." />
      ) : (
        <ListGroup>
          {list.map((e) => (
            <ExerciseRow key={e.id} ex={e} reason={unavailableReason(e, ctx)} />
          ))}
        </ListGroup>
      )}
    </div>
  )
}

function ExerciseRow({ ex, reason }: { ex: Exercise; reason: string | null }) {
  return (
    <button type="button" onClick={() => navigate(`/library/${ex.id}`)} className="press w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-raised">
      <span className="w-14 h-11 shrink-0 rounded-[10px] bg-sunken border border-line p-1">
        <ExerciseFigure figure={ex.figure} label="" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15.5px] font-semibold truncate">{ex.name}</span>
        <span className="block text-[13px] text-muted truncate">
          {CATEGORY_LABEL[ex.category]} · {DIFFICULTY[ex.difficulty]}
          {ex.equipment !== 'none' ? ` · ${EQUIPMENT_LABEL[ex.equipment]}` : ''}
        </span>
      </span>
      {reason && <Badge tone="warn">Not for you</Badge>}
    </button>
  )
}

function RoutineList() {
  return (
    <div className="space-y-3">
      <p className="text-[14.5px] text-muted leading-relaxed">Short guided flows. Gentle on rest days, useful before and after training. Move slowly and stay well short of pain.</p>
      <ListGroup>
        {MOBILITY_ROUTINES.map((r) => (
          <ListRow key={r.id} icon="leaf" iconTone="calm" title={r.name} subtitle={`${r.goal} · about ${r.minutes} min · ${r.items.length} moves`} onClick={() => navigate(`/library/routine/${r.id}`)} />
        ))}
      </ListGroup>
    </div>
  )
}

function PathwayList() {
  const profile = useStore((s) => s.profile)
  const programme = useStore((s) => s.programme)
  const ctx = useMemo(() => ctxFromProfile(profile), [profile])
  return (
    <div className="space-y-6">
      <p className="text-[14.5px] text-muted leading-relaxed">Each pathway is a ladder of variations. Your programme moves you up a step when your logged sets and effort show you are ready, not on a fixed date.</p>
      {Object.values(TRACKS).map((t) => {
        const current = programme?.slots[t.id]?.exerciseId
        return (
          <section key={t.id}>
            <SectionHeader title={t.name} />
            <p className="text-[13.5px] text-muted mb-2 -mt-1">{t.description}</p>
            <ListGroup>
              {t.exerciseIds.map((id, i) => {
                const ex = getExercise(id)
                if (!ex) return null
                const reason = unavailableReason(ex, ctx)
                return (
                  <ListRow
                    key={id}
                    title={
                      <span className="flex items-center gap-2">
                        <span className="num text-faint text-[13px] w-5">{i + 1}</span>
                        {ex.name}
                      </span>
                    }
                    right={current === id ? <Badge tone="accent">You</Badge> : reason ? <Badge tone="warn">Unavailable</Badge> : undefined}
                    onClick={() => navigate(`/library/${id}`)}
                  />
                )
              })}
            </ListGroup>
          </section>
        )
      })}
    </div>
  )
}

export function ExerciseDetail({ id }: { id: string }) {
  const programme = useStore((s) => s.programme)
  const profile = useStore((s) => s.profile)
  const [confirm, setConfirm] = useState(false)
  const ex = getExercise(id)
  if (!ex) {
    return (
      <Screen title="Exercise" back="/library">
        <EmptyState icon="search" title="Exercise not found" body="It may have been removed in an update." action={<Button onClick={() => navigate('/library')}>Back to library</Button>} />
      </Screen>
    )
  }
  const trackId = trackOf(ex.id)
  const track = trackId ? TRACKS[trackId] : undefined
  const slot = trackId ? programme?.slots[trackId] : undefined
  const reason = profile ? unavailableReason(ex, ctxFromProfile(profile)) : null
  const range = rangeFor(ex)
  const dose = ex.metric === 'time' ? `${ex.defaults.sets} × ${range[0]}–${range[1]} s` : ex.metric === 'distance' ? `${ex.defaults.sets} × ${range[0]} m` : `${ex.defaults.sets} × ${range[0]}–${range[1]}${ex.perSide ? ' each side' : ''}`

  return (
    <Screen title={ex.name} eyebrow={CATEGORY_LABEL[ex.category]} back="/library">
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Badge>{DIFFICULTY[ex.difficulty]}</Badge>
        <Badge tone={ex.intensity === 'high' ? 'danger' : ex.intensity === 'moderate' ? 'warn' : 'calm'}>{ex.intensity === 'high' ? 'High intensity' : ex.intensity === 'moderate' ? 'Moderate' : 'Low intensity'}</Badge>
        <Badge>{EQUIPMENT_LABEL[ex.equipment]}</Badge>
        {slot?.exerciseId === ex.id && <Badge tone="accent">Your current level</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-5 text-[14px]">
        <div className="p-3 rounded-[14px] bg-surface border border-line">
          <div className="text-[12px] text-muted font-semibold">TYPICAL DOSE</div>
          <div className="font-semibold mt-0.5 num">{dose}</div>
          <div className="text-muted text-[12.5px]">Rest about {ex.defaults.restSec}s</div>
        </div>
        <div className="p-3 rounded-[14px] bg-surface border border-line">
          <div className="text-[12px] text-muted font-semibold">WORKS</div>
          <div className="font-medium mt-0.5 leading-snug">{ex.muscles.join(', ')}</div>
        </div>
      </div>
      {ex.equipment !== 'none' && ex.alternativeId && getExercise(ex.alternativeId) && (
        <div className="mb-5">
          <Notice icon="info" title={`Needs: ${EQUIPMENT_LABEL[ex.equipment].toLowerCase()}`}>
            No access? Try{' '}
            <button type="button" className="underline font-semibold" onClick={() => navigate(`/library/${ex.alternativeId}`)}>
              {getExercise(ex.alternativeId)!.name}
            </button>{' '}
            instead.
          </Notice>
        </div>
      )}
      {ex.category === 'pull' && (
        <div className="mb-5">
          <Notice tone="warn" icon="alert" title="About pulling without a bar">
            Floor exercises can strengthen the upper back and shoulder blades, but they cannot fully replace hanging and pulling your body weight. For genuine pull-up strength you need a sturdy bar, a playground or a park rig. Never pull on doors, tables or chairs.
          </Notice>
        </div>
      )}
      <ExerciseInfo ex={ex} />

      {track && (
        <section className="mt-6">
          <SectionHeader title={track.name} />
          <ol className="flex flex-wrap gap-1.5">
            {track.exerciseIds.map((tid, i) => {
              const t = getExercise(tid)
              if (!t) return null
              return (
                <li key={tid}>
                  <button
                    type="button"
                    onClick={() => navigate(`/library/${tid}`, { replace: true })}
                    className={`press px-3 py-2 rounded-full text-[13.5px] font-medium border ${tid === ex.id ? 'bg-accent text-accent-ink border-transparent' : 'bg-surface border-line'}`}
                    aria-current={tid === ex.id ? 'step' : undefined}
                  >
                    {i + 1}. {t.name}
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {slot && slot.exerciseId !== ex.id && !reason && (
        <div className="mt-6">
          <Button block variant="secondary" size="lg" icon="target" onClick={() => setConfirm(true)}>
            Use this as my {track?.name.toLowerCase()} level
          </Button>
        </div>
      )}
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Switch to ${ex.name}?`}
        body={`Your programme will use ${ex.name} for ${track?.name.toLowerCase()} from your next session, starting at the bottom of its range (${range[0]}${ex.metric === 'time' ? 's' : ''}). Progression continues from there based on your logged sets.`}
        confirmLabel="Switch"
        onConfirm={() => {
          if (!trackId) return
          setSlotExercise(trackId, ex.id, range[0], range, ex.metric)
          toast(`${ex.name} is now in your plan`, 'accent')
        }}
      />
    </Screen>
  )
}

export function RoutineDetail({ id }: { id: string }) {
  const r = ROUTINE_MAP[id]
  const profile = useStore((s) => s.profile)
  if (!r) {
    return (
      <Screen title="Routine" back="/library?tab=routines">
        <EmptyState icon="leaf" title="Routine not found" body="It may have been renamed." action={<Button onClick={() => navigate('/library?tab=routines')}>All routines</Button>} />
      </Screen>
    )
  }
  const start = () => {
    const ctx = ctxFromProfile(profile, getState().settings.outdoorMode)
    const block = routineBlock(r, ctx)
    startCustom(
      newWorkout({
        date: dayKey(),
        sessionType: 'mobility',
        title: r.name,
        purpose: r.description,
        intensity: 'easy',
        blocks: [block],
        modifiers: [],
      }),
    )
  }
  return (
    <Screen title={r.name} eyebrow={`${r.goal} · ${r.minutes} min`} back="/library?tab=routines">
      <p className="text-[15.5px] leading-relaxed mb-5">{r.description}</p>
      <ListGroup className="mb-6">
        {r.items.map((it, i) => {
          const ex = getExercise(it.exerciseId)
          if (!ex) return null
          return (
            <button key={i} type="button" onClick={() => navigate(`/library/${ex.id}`)} className="press w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-raised">
              <span className="w-14 h-11 shrink-0 rounded-[10px] bg-sunken border border-line p-1">
                <ExerciseFigure figure={ex.figure} label="" />
              </span>
              <span className="flex-1 min-w-0 text-[15.5px] font-medium">{ex.name}</span>
              <span className="num text-[14px] text-muted">{it.seconds ? `${it.seconds}s` : `${it.reps}${ex.perSide ? '/side' : ''}`}</span>
            </button>
          )
        })}
      </ListGroup>
      <Button size="xl" block icon="play" onClick={start}>
        Start routine
      </Button>
      <p className="text-[13px] text-faint mt-3 text-center">Mobility should feel like gentle tension, never sharp pain.</p>
    </Screen>
  )
}
