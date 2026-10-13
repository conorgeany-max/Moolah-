import { useMemo } from 'react'
import { Icon } from '../components/Icon'
import { Screen } from '../components/Layout'
import { RecommendationCard } from '../components/Training'
import { Badge, Button, Card, EmptyState, SectionHeader, Stat } from '../components/ui'
import { getExercise } from '../engine/library'
import { valueOf } from '../engine/progression'
import { totalReps, workingSets } from '../engine/steps'
import { formatDuration } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'

export function WorkoutSummary({ id }: { id: string }) {
  const w = useStore((s) => s.workouts.find((x) => x.id === id))
  const recs = useStore((s) => s.recommendations.filter((r) => r.createdAt >= (w?.completedAt ?? '9') && r.status !== 'dismissed'))
  const prs = useMemo(() => (w?.records ?? []).filter((r) => r.kind !== 'first'), [w])
  const firsts = useMemo(() => (w?.records ?? []).filter((r) => r.kind === 'first'), [w])

  if (!w) return <Screen back="/" title="Summary"><EmptyState icon="alert" title="Workout not found" body="It may have been deleted." /></Screen>

  const main = w.blocks.filter((b) => b.kind === 'main' || b.kind === 'finisher')
  const completedExercises = main.flatMap((b) => b.exercises).filter((x) => x.sets.length > 0)
  const sets = workingSets(w)

  return (
    <Screen tabbar={false}>
      <div className="text-center pt-4 animate-rise">
        <span className="inline-grid place-items-center w-20 h-20 rounded-full bg-accent text-accent-ink animate-pop">
          <Icon name={prs.length ? 'trophy' : 'check'} size={38} strokeWidth={2.4} />
        </span>
        <h1 className="text-[30px] font-bold tracking-[-0.02em] mt-5">{w.status === 'ended' ? 'Workout saved' : 'Workout complete'}</h1>
        <p className="text-muted mt-1">{w.title}</p>
      </div>

      <Card className="p-5 mt-6 grid grid-cols-3 gap-3">
        <Stat label="Time" value={formatDuration(w.activeMs)} />
        <Stat label="Sets" value={sets} />
        <Stat label={w.blocks.some((b) => b.exercises.some((x) => x.sets.some((s) => s.reps))) ? 'Reps' : 'Exercises'} value={totalReps(w) || completedExercises.length} />
      </Card>
      <p className="text-[12.5px] text-faint mt-2 px-1">Total reps and sets show volume. They are not personal records.</p>

      {(prs.length > 0 || firsts.length > 0) && (
        <section className="mt-6">
          <SectionHeader title={prs.length ? 'Personal records' : 'Baselines set'} />
          <Card className="divide-y divide-line">
            {prs.map((r) => {
              const ex = getExercise(r.exerciseId)
              return (
                <div key={r.exerciseId} className="flex items-center gap-3 p-4">
                  <span className="w-10 h-10 rounded-[12px] bg-accent text-accent-ink grid place-items-center">
                    <Icon name="trophy" size={20} />
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold">{ex?.name}</div>
                    <div className="text-[13.5px] text-muted">
                      {r.kind === 'hold' ? 'Longest hold' : 'Best single set'}: <span className="num text-ink font-semibold">{r.value}{r.kind === 'hold' ? 's' : ' reps'}</span> (was {r.previous}
                      {r.kind === 'hold' ? 's' : ''})
                    </div>
                  </div>
                </div>
              )
            })}
            {firsts.map((r) => (
              <div key={r.exerciseId} className="flex items-center gap-3 p-4">
                <span className="w-10 h-10 rounded-[12px] bg-raised grid place-items-center">
                  <Icon name="sparkle" size={20} />
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{getExercise(r.exerciseId)?.name}</div>
                  <div className="text-[13.5px] text-muted">First time logged. This sets your baseline.</div>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {recs.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="What changes next time" />
          <div className="space-y-3">
            {recs.map((r) =>
              r.status === 'pending' ? (
                <RecommendationCard key={r.id} rec={r} />
              ) : (
                <Card key={r.id} className="p-4 flex gap-3">
                  <Icon name={r.toTarget >= r.fromTarget ? 'chevronUp' : 'chevronDown'} size={20} className="text-accent-fg shrink-0 mt-0.5" strokeWidth={2.4} />
                  <p className="text-[14.5px] leading-relaxed">
                    <strong>{getExercise(r.fromExerciseId)?.name}:</strong> {r.reason}
                  </p>
                </Card>
              ),
            )}
          </div>
        </section>
      )}

      <section className="mt-6">
        <SectionHeader title="Exercises" />
        <Card className="divide-y divide-line">
          {completedExercises.length === 0 && <p className="p-4 text-muted">No working sets were logged.</p>}
          {completedExercises.map((x) => {
            const ex = getExercise(x.exerciseId)
            const target = x.targetReps ?? x.targetSeconds
            const hit = target ? x.sets.every((s) => valueOf(s) >= target) && x.sets.length >= x.targetSets : true
            return (
              <div key={x.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-semibold">{ex?.name}</span>
                  {hit ? <Badge tone="accent">Target hit</Badge> : <Badge>Below target</Badge>}
                </div>
                <div className="text-[14px] text-muted mt-1 num">
                  {x.sets.map(valueOf).join(' · ')} {ex?.metric === 'time' ? 's' : ex?.metric === 'distance' ? 'm' : 'reps'}
                  {target ? ` (target ${target})` : ''}
                  {x.effort && ` · ${x.effort === 'easy' ? '3+ in reserve' : x.effort === 'solid' ? '1–2 in reserve' : 'max effort'}`}
                </div>
                {x.note && <p className="text-[13.5px] mt-1">{x.note}</p>}
              </div>
            )
          })}
        </Card>
      </section>

      {w.notes && (
        <Card className="p-4 mt-4">
          <div className="text-[13px] text-muted font-semibold uppercase tracking-[0.06em] mb-1">Notes</div>
          <p className="text-[15px]">{w.notes}</p>
        </Card>
      )}

      <div className="grid gap-2 mt-8 pb-6">
        <Button size="xl" block onClick={() => navigate('/', { replace: true })}>
          Done
        </Button>
        <Button size="lg" variant="ghost" block onClick={() => navigate('/library/routine/post-run')}>
          Cool down with stretches
        </Button>
      </div>
    </Screen>
  )
}
