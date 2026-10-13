import { useState } from 'react'
import { getExercise } from '../engine/library'
import { readinessOf } from '../engine/readiness'
import { dayStatus, SESSION_INFO, weekPlan, type DayPlan, type DayStatus } from '../engine/schedule'
import { acceptRecommendation, dismissRecommendation, saveCheckIn, setOverride } from '../lib/actions'
import { dayKey, parseDay, WEEKDAY_LETTER } from '../lib/date'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import type { CheckIn, Recommendation, SessionType } from '../lib/types'
import { Icon, type IconName } from './Icon'
import { Badge, Button, Card, cx, Segmented, toast, type Tone } from './ui'

export const KIND_META: Record<ReturnType<typeof kindOf>, { icon: IconName; tone: Tone; label: string }> = {
  strength: { icon: 'bolt', tone: 'accent', label: 'Strength' },
  run: { icon: 'run', tone: 'run', label: 'Running' },
  conditioning: { icon: 'flame', tone: 'warn', label: 'Conditioning' },
  mobility: { icon: 'leaf', tone: 'calm', label: 'Mobility' },
  rest: { icon: 'moon', tone: 'neutral', label: 'Rest' },
}

export function kindOf(t: SessionType | 'custom' | 'quick' | 'generated' | 'manual' | 'free') {
  if (t === 'custom' || t === 'quick' || t === 'generated') return 'strength' as const
  if (t === 'manual' || t === 'free') return 'run' as const
  return SESSION_INFO[t].kind
}

export function SessionIcon({ type, size = 40 }: { type: SessionType | 'custom' | 'quick' | 'generated' | 'manual' | 'free'; size?: number }) {
  const m = KIND_META[kindOf(type)]
  const bg = { accent: 'bg-accent text-accent-ink', run: 'bg-run-soft text-run', warn: 'bg-warn-soft text-warn', calm: 'bg-calm-soft text-calm', neutral: 'bg-raised text-muted', danger: 'bg-danger-soft text-danger' }[m.tone]
  return (
    <span className={cx('rounded-[12px] grid place-items-center shrink-0', bg)} style={{ width: size, height: size }}>
      <Icon name={m.icon} size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  )
}

const STATUS_STYLE: Record<DayStatus, string> = {
  done: 'bg-accent text-accent-ink border-transparent',
  today: 'bg-surface border-accent-fg text-ink',
  planned: 'bg-surface border-line-strong text-ink',
  missed: 'bg-surface border-dashed border-danger/60 text-muted',
  skipped: 'bg-surface border-dashed border-line-strong text-faint',
  rest: 'bg-transparent border-line text-faint',
}

export function WeekStrip({ date = dayKey(), onSelect }: { date?: string; onSelect?: (d: DayPlan) => void }) {
  const programme = useStore((s) => s.programme)
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs)
  if (!programme) return null
  const today = dayKey()
  const week = weekPlan(programme, date)
  return (
    <div className="grid grid-cols-7 gap-1.5" role="list" aria-label="This week">
      {week.map((d, i) => {
        const st = dayStatus(d, workouts, runs, today)
        const m = KIND_META[SESSION_INFO[d.type].kind]
        return (
          <button
            key={d.date}
            type="button"
            role="listitem"
            onClick={() => (onSelect ? onSelect(d) : navigate('/plan'))}
            aria-label={`${parseDay(d.date).toLocaleDateString(undefined, { weekday: 'long' })}: ${SESSION_INFO[d.type].label}, ${st}`}
            className="press flex flex-col items-center gap-1.5"
          >
            <span className={cx('text-[11.5px] font-semibold', d.date === today ? 'text-ink' : 'text-faint')}>{WEEKDAY_LETTER[i]}</span>
            <span className={cx('w-full aspect-square max-w-[44px] rounded-[13px] border-[1.5px] grid place-items-center', STATUS_STYLE[st])}>
              {st === 'done' ? <Icon name="check" size={18} strokeWidth={2.6} /> : d.type === 'rest' ? <span className="w-1 h-1 rounded-full bg-faint" /> : <Icon name={m.icon} size={17} />}
            </span>
            <span className="num text-[11px] text-faint">{parseDay(d.date).getDate()}</span>
          </button>
        )
      })}
    </div>
  )
}

const FACES = ['😫', '😕', '😐', '🙂', '😄']

export function CheckInCard() {
  const today = dayKey()
  const existing = useStore((s) => s.checkIns.find((c) => c.date === today))
  const plan = useStore((s) => (s.programme ? weekPlan(s.programme, today).find((d) => d.date === today) : undefined))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Omit<CheckIn, 'id' | 'createdAt'>>({ date: today, energy: 3, soreness: 2, stress: 3, sleepHours: undefined, pain: false })
  const r = readinessOf(existing)

  if (existing && !editing && r) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className={cx('w-10 h-10 rounded-[12px] grid place-items-center text-[20px]', r.level === 'good' ? 'bg-accent-soft' : r.level === 'ok' ? 'bg-raised' : 'bg-warn-soft')}>{FACES[existing.energy - 1]}</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Readiness: {r.level === 'good' ? 'good' : r.level === 'ok' ? 'normal' : 'low'}</div>
            <div className="text-[13.5px] text-muted leading-snug">{r.advice}</div>
          </div>
          <button type="button" className="press text-[14px] font-semibold text-accent-fg" onClick={() => (setDraft(existing), setEditing(true))}>
            Edit
          </button>
        </div>
        {r.suggestLighter && plan && plan.type !== 'rest' && !plan.lighten && (
          <Button variant="secondary" block className="mt-3" icon="leaf" onClick={() => (setOverride(today, { lighten: true }), toast('Today’s session is now a lighter version', 'accent'))}>
            Use a lighter session today
          </Button>
        )}
        {plan?.lighten && <p className="text-[13.5px] text-accent-fg mt-3 font-medium">Today’s session has been lightened.</p>}
      </Card>
    )
  }

  if (!existing && !editing) {
    return (
      <Card className="p-4 flex items-center gap-3" onClick={() => setEditing(true)} aria-label="Daily check-in">
        <span className="w-10 h-10 rounded-[12px] bg-raised grid place-items-center">
          <Icon name="heart" size={20} />
        </span>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">How are you feeling?</div>
          <div className="text-[13.5px] text-muted">A 10-second check-in tunes today’s session.</div>
        </div>
        <Icon name="chevronRight" size={18} className="text-faint" />
      </Card>
    )
  }

  const Row = ({ label, k, low, high }: { label: string; k: 'energy' | 'soreness' | 'stress'; low: string; high: string }) => (
    <div>
      <div className="flex justify-between text-[13.5px] mb-1.5">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">
          {low} → {high}
        </span>
      </div>
      <Segmented value={draft[k] ?? 3} options={[1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))} onChange={(v) => setDraft({ ...draft, [k]: v as 1 })} />
    </div>
  )
  return (
    <Card className="p-4 space-y-4 animate-rise">
      <div className="text-[16px] font-semibold">Daily check-in</div>
      <Row label="Energy" k="energy" low="drained" high="great" />
      <Row label="Muscle soreness" k="soreness" low="none" high="very sore" />
      <Row label="Stress" k="stress" low="calm" high="high" />
      <div>
        <div className="text-[13.5px] font-semibold mb-1.5">Sleep last night</div>
        <Segmented
          value={draft.sleepHours ?? 0}
          options={[
            { value: 0, label: 'Skip' },
            { value: 5, label: '<6h' },
            { value: 6.5, label: '6–7h' },
            { value: 7.5, label: '7–8h' },
            { value: 9, label: '8h+' },
          ]}
          onChange={(v) => setDraft({ ...draft, sleepHours: v || undefined })}
        />
      </div>
      <label className="flex items-center gap-3 text-[14.5px]">
        <input type="checkbox" className="w-5 h-5 accent-[var(--accent)]" checked={!!draft.pain} onChange={(e) => setDraft({ ...draft, pain: e.target.checked })} />
        Something hurts (not just normal soreness)
      </label>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button block onClick={() => (saveCheckIn({ ...draft, date: today }), setEditing(false))}>
          Save check-in
        </Button>
      </div>
    </Card>
  )
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const from = getExercise(rec.fromExerciseId)
  const to = getExercise(rec.toExerciseId)
  const up = rec.kind === 'harder-variation' || rec.kind === 'add-set'
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className={cx('w-10 h-10 rounded-[12px] grid place-items-center shrink-0', up ? 'bg-accent text-accent-ink' : 'bg-calm-soft text-calm')}>
          <Icon name={up ? 'chevronUp' : 'chevronDown'} size={22} strokeWidth={2.4} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={up ? 'accent' : 'calm'}>{up ? 'Ready to progress' : 'Suggested adjustment'}</Badge>
          </div>
          <div className="text-[16px] font-semibold mt-1.5 leading-snug">
            {rec.kind === 'add-set' ? `${from?.name}: add a set` : `${from?.name} → ${to?.name}`}
          </div>
          <p className="text-[14px] text-muted mt-1 leading-relaxed">{rec.reason}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="ghost" size="md" onClick={() => dismissRecommendation(rec.id)}>
          Not yet
        </Button>
        <Button size="md" block onClick={() => (acceptRecommendation(rec.id), toast('Programme updated', 'accent'))}>
          {up ? 'Accept' : 'Switch'}
        </Button>
        {to && (
          <Button variant="secondary" size="md" onClick={() => navigate(`/library/${to.id}`)} aria-label={`View ${to.name}`}>
            View
          </Button>
        )}
      </div>
    </Card>
  )
}

export function IntensityBadge({ intensity }: { intensity: 'easy' | 'moderate' | 'hard' }) {
  return <Badge tone={intensity === 'hard' ? 'warn' : intensity === 'moderate' ? 'neutral' : 'calm'}>{intensity === 'hard' ? 'Hard' : intensity === 'moderate' ? 'Moderate' : 'Easy'}</Badge>
}

export function sessionIntensity(t: SessionType, lighten: boolean, deload: boolean): 'easy' | 'moderate' | 'hard' {
  if (t === 'rest' || t === 'mobility' || t === 'run-easy') return 'easy'
  if (t === 'run-long' || t === 'conditioning') return 'moderate'
  return lighten || deload ? 'moderate' : 'hard'
}
