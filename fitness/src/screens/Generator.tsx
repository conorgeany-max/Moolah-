import { useMemo, useState } from 'react'
import { Screen } from '../components/Layout'
import { IntensityBadge } from '../components/Training'
import { Button, Card, Chip, Notice, SectionHeader, Segmented, Toggle } from '../components/ui'
import { generateWorkout, FOCUS_LABEL, type Energy, type Focus } from '../engine/generator'
import { getExercise } from '../engine/library'
import { useRoute } from '../lib/router'
import { startCustom } from '../lib/session'
import { getState, useStore } from '../lib/store'

const MINUTES = [10, 15, 20, 30, 45, 60]

export function Generator() {
  const { query } = useRoute()
  const profile = useStore((s) => s.profile)
  const programme = useStore((s) => s.programme)
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs)
  const outdoor = useStore((s) => s.settings.outdoorMode)
  const initial = Number(query.get('minutes'))
  const [minutes, setMinutes] = useState(MINUTES.includes(initial) ? initial : 20)
  const [focus, setFocus] = useState<Focus>((query.get('focus') as Focus) || 'full')
  const [energy, setEnergy] = useState<Energy>('normal')
  const [noEquipment, setNoEquipment] = useState(outdoor)

  const result = useMemo(
    () => (profile ? generateWorkout({ minutes, focus, energy, noEquipment }, profile, programme, workouts, runs) : null),
    [minutes, focus, energy, noEquipment, profile, programme, workouts, runs],
  )
  if (!profile || !result) return null
  const { workout, explanation } = result

  return (
    <Screen title="Generator" eyebrow="Build a session" back="/train">
      <div className="space-y-5">
        <section>
          <SectionHeader title="Time available" />
          <div className="grid grid-cols-6 gap-1.5">
            {MINUTES.map((m) => (
              <Chip key={m} selected={minutes === m} onClick={() => setMinutes(m)} className="justify-center">
                {m}
              </Chip>
            ))}
          </div>
        </section>
        <section>
          <SectionHeader title="Focus" />
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FOCUS_LABEL) as Focus[]).map((f) => (
              <Chip key={f} selected={focus === f} onClick={() => setFocus(f)}>
                {FOCUS_LABEL[f]}
              </Chip>
            ))}
          </div>
        </section>
        <section>
          <SectionHeader title="Energy today" />
          <Segmented
            value={energy}
            onChange={setEnergy}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
            ]}
          />
        </section>
        <Card className="px-4 py-1">
          <Toggle checked={noEquipment} onChange={setNoEquipment} label="Floor only" description="No wall, step, bar or hill: anywhere you can stand and lie down." />
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[18px] font-bold">{workout.title}</div>
              <div className="text-[13.5px] text-muted mt-0.5">About {workout.estimatedMinutes} min</div>
            </div>
            <IntensityBadge intensity={workout.intensity} />
          </div>
          <div className="mt-4 space-y-4">
            {workout.blocks.map((b, bi) => (
              <div key={bi}>
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted mb-1.5">
                  {b.title}
                  {(b.rounds ?? 0) > 1 ? ` · ${b.rounds} rounds` : ''}
                </div>
                <ul className="space-y-1">
                  {b.exercises.map((x) => {
                    const ex = getExercise(x.exerciseId)
                    const dose = x.targetSeconds ? `${x.targetSeconds}s` : x.targetReps ? `${x.targetReps}` : ''
                    return (
                      <li key={x.id} className="flex justify-between text-[14.5px]">
                        <span>{ex?.name}</span>
                        <span className="num text-muted">
                          {(b.rounds ?? 0) > 1 ? dose : `${x.targetSets} × ${dose}`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>
        {explanation.length > 0 && (
          <Notice icon="info" title="Why this session">
            <ul className="list-disc pl-4 space-y-1">
              {explanation.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Notice>
        )}
        <Button size="xl" block icon="play" onClick={() => startCustom({ ...workout, outdoorMode: noEquipment || getState().settings.outdoorMode })}>
          Start this workout
        </Button>
        <p className="text-[12.5px] text-faint text-center">Generated sessions don’t replace your plan. Your levels still update from what you log.</p>
      </div>
    </Screen>
  )
}
