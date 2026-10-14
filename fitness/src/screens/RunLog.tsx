import { useState } from 'react'
import { Screen } from '../components/Layout'
import { Button, Field, inputCls, NumberInput, Segmented, toast, cx } from '../components/ui'
import { isRunSession, planFor, SESSION_INFO } from '../engine/schedule'
import { addManualRun } from '../lib/actions'
import { dayKey } from '../lib/date'
import { navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import type { Feel, RunPain, SessionType } from '../lib/types'
import { PainCheck } from '../components/Training'
import { formatPace, toMeters } from '../lib/units'

export function RunLog() {
  const { query } = useRoute()
  const units = useStore((s) => s.profile!.units)
  const programme = useStore((s) => s.programme)
  const [date, setDate] = useState(query.get('date') ?? dayKey())
  const planned = programme ? planFor(programme, date) : null
  const plannedRun = planned && isRunSession(planned.type) ? planned.type : null
  const [linkToPlan, setLinkToPlan] = useState(true)
  const [hours, setHours] = useState<number | undefined>(0)
  const [minutes, setMinutes] = useState<number | undefined>(undefined)
  const [seconds, setSeconds] = useState<number | undefined>(0)
  const [distance, setDistance] = useState<number | undefined>(undefined)
  const [feel, setFeel] = useState<Feel>('moderate')
  const [rpe, setRpe] = useState(5)
  const [notes, setNotes] = useState('')
  const [pain, setPain] = useState<RunPain | undefined>(undefined)

  const totalSec = (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0)
  const meters = distance ? toMeters(distance, units) : 0
  const pace = meters > 0 && totalSec > 0 ? totalSec / (meters / 1000) : undefined
  const valid = totalSec > 0 && date <= dayKey()

  const save = () => {
    const type: SessionType | 'manual' = linkToPlan && plannedRun ? plannedRun : 'manual'
    const res = addManualRun({
      date,
      sessionType: type,
      title: type === 'manual' ? 'Run' : SESSION_INFO[type].label,
      source: 'manual',
      distanceM: meters,
      activeMs: totalSec * 1000,
      feel,
      rpe,
      notes: notes.trim() || undefined,
      completedPlan: true,
      pain,
    })
    toast(res.message ?? 'Run saved', 'accent')
    navigate(`/run/${res.run.id}`, { replace: true })
  }

  return (
    <Screen back="/train" title="Log a run" tabbar={false}>
      <div className="space-y-5 pb-6">
        <p className="text-[15px] text-muted leading-relaxed">For runs tracked elsewhere (a watch, Apple Health, a treadmill) or when GPS wasn’t available.</p>
        <Field label="Date">
          <input type="date" className={inputCls} value={date} max={dayKey()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {plannedRun && (
          <Segmented
            value={linkToPlan ? 'plan' : 'extra'}
            onChange={(v) => setLinkToPlan(v === 'plan')}
            options={[
              { value: 'plan', label: `Counts as ${SESSION_INFO[plannedRun].short}` },
              { value: 'extra', label: 'Extra run' },
            ]}
          />
        )}
        <Field label="Duration">
          <div className="grid grid-cols-3 gap-2">
            <NumberInput value={hours} onChange={setHours} suffix="h" inputMode="numeric" ariaLabel="Hours" max={23} />
            <NumberInput value={minutes} onChange={setMinutes} suffix="min" inputMode="numeric" ariaLabel="Minutes" max={59} placeholder="0" />
            <NumberInput value={seconds} onChange={setSeconds} suffix="s" inputMode="numeric" ariaLabel="Seconds" max={59} />
          </div>
        </Field>
        <Field label={`Distance (${units.distance})`} hint="Optional, but needed for pace">
          <NumberInput value={distance} onChange={setDistance} suffix={units.distance} placeholder="e.g. 5.0" ariaLabel="Distance" />
        </Field>
        {pace && (
          <p className="text-[15px] px-1">
            Average pace: <span className="num font-semibold">{formatPace(pace, units)}</span>
          </p>
        )}
        <PainCheck value={pain} onChange={setPain} />
        <Field label="How did it feel?">
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
        </Field>
        <div>
          <div className="flex justify-between mb-1 px-1">
            <span className="text-[14px] font-medium text-muted">Effort</span>
            <span className="num font-bold text-accent-fg">{rpe} / 10</span>
          </div>
          <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="w-full accent-[var(--accent)] h-8" aria-label="Effort from 1 to 10" />
        </div>
        <Field label="Notes">
          <textarea className={cx(inputCls, 'h-20 py-3 resize-none')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button size="xl" block disabled={!valid} onClick={save}>
          Save run
        </Button>
      </div>
    </Screen>
  )
}
