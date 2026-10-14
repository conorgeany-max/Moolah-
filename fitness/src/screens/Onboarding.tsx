import { useMemo, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Button, Chip, cx, Field, IconButton, inputCls, Notice, NumberInput, ProgressBar, Segmented } from '../components/ui'
import { AVOID_LABEL } from '../engine/library'
import { createProgramme } from '../engine/programme'
import { SESSION_INFO } from '../engine/schedule'
import { completeOnboarding, regenerateProgramme, saveProfile } from '../lib/actions'
import { WEEKDAY_SHORT } from '../lib/date'
import { navigate, useRoute } from '../lib/router'
import { getState, useStore } from '../lib/store'
import type { AvoidTag, CoachingStyle, Environment, Experience, Goal, IntensityPref, Profile, RunLevel, Weekday } from '../lib/types'
import { CM_PER_IN, DEFAULT_UNITS, LB_PER_KG } from '../lib/units'

const blankProfile = (): Profile => ({
  id: 'me',
  createdAt: '',
  updatedAt: '',
  units: DEFAULT_UNITS,
  experience: 'new',
  runLevel: 'none',
  goals: ['fitness'],
  trainingDays: [0, 2, 4, 5],
  sessionMinutes: 40,
  environments: ['backyard', 'park'],
  capabilities: {},
  avoid: [],
  injuryNotes: '',
  coaching: 'calm',
  intensity: 'moderate',
})

function Choice({ selected, onClick, title, body, icon }: { selected: boolean; onClick: () => void; title: string; body?: string; icon?: IconName }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx('press w-full text-left flex items-start gap-3 p-4 rounded-[18px] border transition-colors', selected ? 'bg-accent-soft border-accent-fg' : 'bg-surface border-line')}
    >
      {icon && (
        <span className={cx('w-10 h-10 rounded-[12px] grid place-items-center shrink-0', selected ? 'bg-accent text-accent-ink' : 'bg-raised text-ink')}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="flex-1">
        <span className="block font-semibold text-[16px]">{title}</span>
        {body && <span className="block text-[14px] text-muted mt-0.5 leading-snug">{body}</span>}
      </span>
      <span className={cx('w-6 h-6 rounded-full border-2 grid place-items-center shrink-0 mt-2', selected ? 'border-accent-fg bg-accent-fg text-canvas' : 'border-line-strong')}>
        {selected && <Icon name="check" size={14} strokeWidth={3} />}
      </span>
    </button>
  )
}

function StepShell({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="animate-rise">
      <h1 className="text-[28px] leading-[1.12] font-bold tracking-[-0.02em]">{title}</h1>
      {lead && <p className="text-[15.5px] text-muted mt-2 leading-relaxed">{lead}</p>}
      <div className="mt-6 space-y-3">{children}</div>
    </div>
  )
}

const GOALS: { id: Goal; label: string; icon: IconName }[] = [
  { id: 'muscle', label: 'Build muscle', icon: 'layers' },
  { id: 'strength', label: 'Relative strength', icon: 'bolt' },
  { id: 'fitness', label: 'General fitness', icon: 'heart' },
  { id: 'endurance', label: 'Running endurance', icon: 'run' },
  { id: 'fatloss', label: 'Lose body fat', icon: 'flame' },
  { id: 'mobility', label: 'Mobility', icon: 'leaf' },
]

const ENVS: { id: Environment; label: string; icon: IconName }[] = [
  { id: 'backyard', label: 'Backyard / garden', icon: 'home' },
  { id: 'street', label: 'Street & pavements', icon: 'pin' },
  { id: 'park', label: 'Park', icon: 'leaf' },
  { id: 'paths', label: 'Running paths', icon: 'run' },
  { id: 'hills', label: 'Hills', icon: 'wave' },
  { id: 'stairs', label: 'Public stairs', icon: 'stairs' },
  { id: 'wall', label: 'A solid wall', icon: 'layers' },
  { id: 'bar', label: 'Secure outdoor bar', icon: 'target' },
]

const STEP_KEYS = ['welcome', 'about', 'experience', 'capabilities', 'running', 'goals', 'schedule', 'environment', 'health', 'coaching', 'review']

export function Onboarding({ editing = false }: { editing?: boolean }) {
  const existing = useStore((s) => s.profile)
  const { query } = useRoute()
  const [p, setP] = useState<Profile>(() => (editing && existing ? existing : existing ?? blankProfile()))
  const [step, setStep] = useState(() => (editing ? Math.max(1, STEP_KEYS.indexOf(query.get('step') ?? 'about')) : 0))
  const [accepted, setAccepted] = useState(!!existing?.disclaimerAcceptedAt)
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }))
  const cap = (patch: Partial<Profile['capabilities']>) => setP((x) => ({ ...x, capabilities: { ...x.capabilities, ...patch } }))
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const preview = useMemo(() => (step === 10 ? createProgramme(p) : null), [step, p])

  const steps: { key: string; optional?: boolean; valid?: boolean; body: ReactNode }[] = [
    {
      key: 'welcome',
      body: (
        <div className="animate-rise pt-6">
          <div className="w-16 h-16 rounded-[20px] bg-accent text-accent-ink grid place-items-center">
            <svg viewBox="0 0 512 512" width="36" height="36" aria-hidden="true">
              <path d="M186 372 V148 H326 M186 262 H296" fill="none" stroke="currentColor" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[38px] leading-[1.04] font-bold tracking-[-0.03em] mt-8">
            Strong, fit and athletic.
            <br />
            <span className="text-muted">No gym required.</span>
          </h1>
          <p className="text-[16px] text-muted mt-4 leading-relaxed">
            Forge builds a calisthenics, running and conditioning programme around you, then adjusts it to what you actually log. Everything stays on this device.
          </p>
          <ul className="mt-8 space-y-3">
            {(
              [
                ['bolt', 'Progressions that move when you’re ready, not when the calendar says'],
                ['run', 'Run/walk to tempo runs, built gradually'],
                ['lock', 'Private by default: no account, no tracking'],
              ] as [IconName, string][]
            ).map(([icon, text]) => (
              <li key={text} className="flex gap-3 items-start text-[15px]">
                <span className="w-8 h-8 rounded-[10px] bg-raised grid place-items-center shrink-0">
                  <Icon name={icon} size={17} />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      key: 'about',
      optional: true,
      body: (
        <StepShell title="A little about you" lead="All optional. Used only for sensible defaults and your own records.">
          <Field label="Name (optional)">
            <input className={inputCls} value={p.name ?? ''} onChange={(e) => set({ name: e.target.value || undefined })} placeholder="What should we call you?" autoComplete="given-name" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <NumberInput value={p.age} onChange={(v) => set({ age: v ? Math.round(v) : undefined })} min={0} max={100} inputMode="numeric" suffix="yrs" />
            </Field>
            <Field label="Units">
              <Segmented
                value={p.units.weight}
                options={[
                  { value: 'kg', label: 'Metric' },
                  { value: 'lb', label: 'Imperial' },
                ]}
                onChange={(v) => set({ units: v === 'kg' ? DEFAULT_UNITS : { weight: 'lb', distance: 'mi', height: 'ftin', length: 'in' } })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Height">
              <NumberInput
                value={p.heightCm === undefined ? undefined : p.units.height === 'cm' ? Math.round(p.heightCm) : Math.round(p.heightCm / CM_PER_IN)}
                onChange={(v) => set({ heightCm: v === undefined ? undefined : p.units.height === 'cm' ? v : v * CM_PER_IN })}
                suffix={p.units.height === 'cm' ? 'cm' : 'in'}
              />
            </Field>
            <Field label="Weight">
              <NumberInput
                value={p.weightKg === undefined ? undefined : p.units.weight === 'kg' ? Math.round(p.weightKg * 10) / 10 : Math.round(p.weightKg * LB_PER_KG)}
                onChange={(v) => set({ weightKg: v === undefined ? undefined : p.units.weight === 'kg' ? v : v / LB_PER_KG })}
                suffix={p.units.weight}
              />
            </Field>
          </div>
        </StepShell>
      ),
    },
    {
      key: 'experience',
      body: (
        <StepShell title="Bodyweight training experience" lead="Be honest. Starting a little easier is the fastest way to progress.">
          <div role="radiogroup" className="space-y-3">
            {(
              [
                ['new', 'New to it', 'Little or no structured exercise recently'],
                ['some', 'Some experience', 'Occasional workouts, comfortable with basic movements'],
                ['regular', 'Train regularly', 'Consistent training for 6+ months'],
                ['advanced', 'Advanced', 'Years of training, solid push-ups, squats and core'],
              ] as [Experience, string, string][]
            ).map(([id, title, body]) => (
              <Choice key={id} selected={p.experience === id} onClick={() => set({ experience: id })} title={title} body={body} />
            ))}
          </div>
        </StepShell>
      ),
    },
    {
      key: 'capabilities',
      optional: true,
      body: (
        <StepShell title="What can you do today?" lead="Your best set with good form, not a guess at your limit. Leave blank if unsure: we’ll start conservatively.">
          <CapRow label="Push-ups (full, from toes)" value={p.capabilities.pushups} onChange={(v) => cap({ pushups: v })} unit="reps" />
          {p.capabilities.pushups === 0 && <CapRow label="Knee push-ups" value={p.capabilities.kneePushups} onChange={(v) => cap({ kneePushups: v })} unit="reps" />}
          <CapRow label="Bodyweight squats" value={p.capabilities.squats} onChange={(v) => cap({ squats: v })} unit="reps" />
          <CapRow label="Forearm plank" value={p.capabilities.plankSec} onChange={(v) => cap({ plankSec: v })} unit="sec" />
        </StepShell>
      ),
    },
    {
      key: 'running',
      body: (
        <StepShell title="Your running right now" lead="We’ll start gentle. Tendons and bones adapt more slowly than fitness.">
          <div role="radiogroup" className="space-y-3">
            {(
              [
                ['none', 'Not running yet', 'Start with run/walk intervals'],
                ['runwalk', 'Run/walk', 'I can jog a few minutes at a time'],
                ['continuous20', 'About 20 minutes', 'I can run 20 minutes without stopping'],
                ['fivek', 'Comfortable 5 km', 'I run regularly up to around 5 km'],
                ['tenk', '10 km or more', 'I run regularly and further'],
              ] as [RunLevel, string, string][]
            ).map(([id, title, body]) => (
              <Choice key={id} selected={p.runLevel === id} onClick={() => set({ runLevel: id })} title={title} body={body} />
            ))}
          </div>
          {p.runLevel !== 'none' && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Field label="Longest continuous run" hint="Optional">
                <NumberInput value={p.capabilities.runMinutes} onChange={(v) => cap({ runMinutes: v === undefined ? undefined : Math.round(v) })} suffix="min" inputMode="numeric" />
              </Field>
              <Field label={`Easy pace (min/${p.units.distance})`} hint="Optional, e.g. 6.30">
                <NumberInput
                  value={p.easyPaceSecPerKm === undefined ? undefined : paceToInput(p.easyPaceSecPerKm, p.units.distance)}
                  onChange={(v) => set({ easyPaceSecPerKm: v === undefined ? undefined : inputToPace(v, p.units.distance) })}
                />
              </Field>
            </div>
          )}
        </StepShell>
      ),
    },
    {
      key: 'goals',
      valid: p.goals.length > 0,
      body: (
        <StepShell title="What are you training for?" lead="Pick any that matter. Weight loss is never assumed.">
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <Chip key={g.id} selected={p.goals.includes(g.id)} onClick={() => set({ goals: toggle(p.goals, g.id) })} icon={g.icon}>
                {g.label}
              </Chip>
            ))}
          </div>
        </StepShell>
      ),
    },
    {
      key: 'schedule',
      valid: p.trainingDays.length > 0,
      body: (
        <StepShell title="When can you train?" lead="Choose days that are realistic most weeks. You can rearrange any week later.">
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Training days">
            {WEEKDAY_SHORT.map((d, i) => {
              const on = p.trainingDays.includes(i as Weekday)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ trainingDays: toggle(p.trainingDays, i as Weekday).sort() as Weekday[] })}
                  className={cx('press h-14 rounded-[14px] font-semibold text-[14px] border', on ? 'bg-accent text-accent-ink border-transparent' : 'bg-surface border-line-strong text-ink')}
                >
                  {d.slice(0, 2)}
                </button>
              )
            })}
          </div>
          <p className="text-[14px] text-muted px-1">
            {p.trainingDays.length} day{p.trainingDays.length === 1 ? '' : 's'} a week
            {p.trainingDays.length === 7 && ' · one day will still be kept for rest'}
          </p>
          <Field label="Typical session length">
            <Segmented
              value={p.sessionMinutes}
              options={[20, 30, 40, 60].map((m) => ({ value: m, label: `${m} min` }))}
              onChange={(v) => set({ sessionMinutes: v })}
              size="lg"
            />
          </Field>
        </StepShell>
      ),
    },
    {
      key: 'environment',
      body: (
        <StepShell title="Where do you train?" lead="Everything works with no equipment. These unlock extra options like hill sprints and step-ups.">
          <div className="flex flex-wrap gap-2">
            {ENVS.map((e) => (
              <Chip key={e.id} selected={p.environments.includes(e.id)} onClick={() => set({ environments: toggle(p.environments, e.id) })} icon={e.icon}>
                {e.label}
              </Chip>
            ))}
          </div>
          <Notice icon="info" title="About pulling strength">
            Pulling muscles are hard to train fully without something to pull against. Without a bar, Forge uses prone raises and pulldowns, which help but have limits. Only select “Secure outdoor bar” for purpose-built bars (park pull-up or monkey bars). Forge never prescribes pulling on doors, tables or furniture.
          </Notice>
        </StepShell>
      ),
    },
    {
      key: 'health',
      valid: accepted,
      body: (
        <StepShell title="Anything to work around?" lead="Exercises involving anything you select will be swapped for alternatives.">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(AVOID_LABEL) as AvoidTag[]).map((t) => (
              <Chip key={t} selected={p.avoid.includes(t)} onClick={() => set({ avoid: toggle(p.avoid, t) })}>
                {AVOID_LABEL[t]}
              </Chip>
            ))}
          </div>
          <Field label="Previous injuries or notes (optional)">
            <textarea className={cx(inputCls, 'h-24 py-3 resize-none')} value={p.injuryNotes} onChange={(e) => set({ injuryNotes: e.target.value })} placeholder="e.g. old ankle sprain, sore left knee on deep squats" />
          </Field>
          <Notice tone="warn" icon="shield" title="Important">
            Forge provides general exercise information. It doesn’t diagnose or treat injuries or medical conditions and isn’t a substitute for advice from a doctor or physiotherapist. If you have a health condition, are pregnant, or have pain, get qualified advice before starting. Stop if you feel sharp pain, chest pain, dizziness or unusual breathlessness.
          </Notice>
          <label className="flex items-start gap-3 p-4 rounded-[18px] bg-surface border border-line cursor-pointer">
            <input type="checkbox" className="mt-1 w-5 h-5 accent-[var(--accent)]" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span className="text-[15px]">I understand and will train within my limits.</span>
          </label>
        </StepShell>
      ),
    },
    {
      key: 'coaching',
      body: (
        <StepShell title="How should Forge coach you?">
          <Field label="Coaching style">
            <div role="radiogroup" className="space-y-2">
              {(
                [
                  ['calm', 'Calm & encouraging', 'Supportive, minimal pressure'],
                  ['direct', 'Direct & concise', 'Just the numbers and key cues'],
                  ['detailed', 'Detailed', 'More explanation of the why'],
                ] as [CoachingStyle, string, string][]
              ).map(([id, title, body]) => (
                <Choice key={id} selected={p.coaching === id} onClick={() => set({ coaching: id })} title={title} body={body} />
              ))}
            </div>
          </Field>
          <Field label="Training intensity">
            <Segmented
              value={p.intensity}
              options={(['gentle', 'moderate', 'ambitious'] as IntensityPref[]).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
              onChange={(v) => set({ intensity: v })}
              size="lg"
            />
          </Field>
          <p className="text-[14px] text-muted px-1 leading-relaxed">
            {p.intensity === 'gentle' && 'Fewer sets and lower starting targets. Great for returning to training.'}
            {p.intensity === 'moderate' && 'A balanced start that leaves room to progress.'}
            {p.intensity === 'ambitious' && 'Slightly higher starting targets. Progression still waits for evidence.'}
          </p>
        </StepShell>
      ),
    },
    {
      key: 'review',
      body: preview ? (
        <StepShell title={editing ? 'Your updated plan' : 'Your programme'} lead={`${preview.weeks} weeks, built from your answers. Every part can be changed later.`}>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => {
              const t = preview.template[i as Weekday]
              const kind = t ? SESSION_INFO[t].kind : 'rest'
              return (
                <div key={d} className="text-center">
                  <div className="text-[12px] text-muted font-semibold mb-1.5">{d.slice(0, 1)}</div>
                  <div
                    className={cx(
                      'h-16 rounded-[12px] grid place-items-center text-[10.5px] font-semibold leading-tight px-0.5 border',
                      kind === 'strength' && 'bg-accent text-accent-ink border-transparent',
                      kind === 'run' && 'bg-run-soft text-run border-transparent',
                      (kind === 'mobility' || kind === 'conditioning') && 'bg-calm-soft text-calm border-transparent',
                      kind === 'rest' && 'bg-surface text-faint border-line',
                    )}
                  >
                    {t ? SESSION_INFO[t].short.replace(' run', '').replace('Strength ', 'Str ') : 'Rest'}
                  </div>
                </div>
              )
            })}
          </div>
          <ul className="space-y-2.5 pt-2">
            {preview.rationale.map((r) => (
              <li key={r} className="flex gap-2.5 text-[14.5px] leading-relaxed">
                <Icon name="check" size={18} className="text-accent-fg shrink-0 mt-0.5" strokeWidth={2.4} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </StepShell>
      ) : null,
    },
  ]

  const s = steps[step]
  const last = step === steps.length - 1
  const finish = () => {
    const stamped = { ...p, disclaimerAcceptedAt: p.disclaimerAcceptedAt ?? new Date().toISOString() }
    if (editing && getState().programme) {
      saveProfile(stamped)
      regenerateProgramme({ keepLevels: true })
      navigate('/profile', { replace: true })
    } else {
      completeOnboarding(stamped)
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-dvh flex flex-col pt-safe max-w-[560px] mx-auto">
      <div className="flex items-center gap-3 px-4 h-14">
        {step > 0 ? (
          <IconButton icon="chevronLeft" label="Back" variant="ghost" size={40} className="-ml-2" onClick={() => setStep(step - 1)} />
        ) : (
          <span className="w-10" />
        )}
        {step > 0 && <ProgressBar value={step / (steps.length - 1)} className="flex-1" label="Onboarding progress" />}
        {editing && (
          <IconButton icon="x" label="Cancel" variant="ghost" size={40} onClick={() => navigate('/profile', { replace: true })} />
        )}
        {s.optional && !editing && (
          <button type="button" className="press text-[15px] font-semibold text-muted px-2 h-10" onClick={() => setStep(step + 1)}>
            Skip
          </button>
        )}
      </div>
      <div className="flex-1 px-5 pb-6" key={s.key}>
        {s.body}
      </div>
      <div className="sticky bottom-0 px-5 pt-3 pb-safe bg-gradient-to-t from-canvas via-canvas to-transparent">
        <Button size="xl" block disabled={s.valid === false} onClick={() => (last ? finish() : setStep(step + 1))} iconRight={last ? undefined : 'chevronRight'}>
          {step === 0 ? 'Get started' : last ? (editing ? 'Save changes' : 'Start training') : 'Continue'}
        </Button>
        {editing && !last && (
          <Button size="lg" variant="ghost" block className="mt-1" disabled={s.valid === false} onClick={finish}>
            Save changes now
          </Button>
        )}
        {s.key === 'health' && !accepted && <p className="text-center text-[13px] text-muted mt-2">Tick the box above to continue.</p>}
      </div>
    </div>
  )
}

function CapRow({ label, value, onChange, unit }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; unit: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-[18px] bg-surface border border-line">
      <span className="flex-1 text-[15.5px] font-medium">{label}</span>
      <div className="w-[120px]">
        <NumberInput value={value} onChange={(v) => onChange(v === undefined ? undefined : Math.round(v))} suffix={unit} inputMode="numeric" placeholder="—" ariaLabel={label} />
      </div>
    </div>
  )
}

function paceToInput(secPerKm: number, unit: 'km' | 'mi') {
  const s = unit === 'km' ? secPerKm : secPerKm * 1.609344
  const m = Math.floor(s / 60)
  return Number(`${m}.${String(Math.round(s % 60)).padStart(2, '0')}`)
}
function inputToPace(v: number, unit: 'km' | 'mi') {
  const m = Math.floor(v)
  const sec = Math.round((v - m) * 100)
  const s = m * 60 + Math.min(59, sec)
  return unit === 'km' ? s : s / 1.609344
}
