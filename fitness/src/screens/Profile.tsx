import { Screen } from '../components/Layout'
import { Badge, Card, ListGroup, ListRow } from '../components/ui'
import { AVOID_LABEL } from '../engine/library'
import { WEEKDAY_SHORT } from '../lib/date'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import type { Experience, Goal, RunLevel } from '../lib/types'
import { formatHeight, formatWeight } from '../lib/units'

export const GOAL_LABEL: Record<Goal, string> = {
  muscle: 'Build muscle',
  strength: 'Get stronger',
  fitness: 'General fitness',
  fatloss: 'Lose fat',
  endurance: 'Running endurance',
  mobility: 'Mobility',
}
const EXPERIENCE_LABEL: Record<Experience, string> = { new: 'New to training', some: 'Some experience', regular: 'Train regularly', advanced: 'Advanced' }
const RUN_LABEL: Record<RunLevel, string> = { none: 'Not running yet', runwalk: 'Run/walk', continuous20: 'Runs 20+ min', fivek: 'Comfortable at 5 km', tenk: '10 km and beyond' }

export function ProfileScreen() {
  const profile = useStore((s) => s.profile)
  const workouts = useStore((s) => s.workouts.filter((w) => w.status === 'completed').length)
  const runs = useStore((s) => s.runs.filter((r) => r.status === 'completed').length)
  if (!profile) return null
  const u = profile.units
  const facts = [
    profile.age ? `${profile.age} yrs` : null,
    profile.heightCm ? formatHeight(profile.heightCm, u) : null,
    profile.weightKg ? formatWeight(profile.weightKg, u) : null,
  ].filter(Boolean)

  return (
    <Screen title="Profile">
      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-full bg-accent text-accent-ink grid place-items-center text-[22px] font-bold" aria-hidden="true">
              {(profile.name?.trim()[0] ?? 'F').toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="text-[20px] font-bold truncate">{profile.name?.trim() || 'Athlete'}</div>
              <div className="text-[14px] text-muted">{[EXPERIENCE_LABEL[profile.experience], ...facts].join(' · ')}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 text-center">
            <div className="rounded-[14px] bg-raised py-3">
              <div className="num text-[22px] font-bold">{workouts}</div>
              <div className="text-[12.5px] text-muted">{workouts === 1 ? 'workout' : 'workouts'} logged</div>
            </div>
            <div className="rounded-[14px] bg-raised py-3">
              <div className="num text-[22px] font-bold">{runs}</div>
              <div className="text-[12.5px] text-muted">{runs === 1 ? 'run' : 'runs'} logged</div>
            </div>
          </div>
        </Card>

        <section>
          <ListGroup>
            <ListRow icon="target" iconTone="accent" title="Goals" subtitle={profile.goals.map((g) => GOAL_LABEL[g]).join(', ') || 'Not set'} onClick={() => navigate('/onboarding?step=goals')} />
            <ListRow
              icon="calendar"
              iconTone="accent"
              title="Schedule"
              subtitle={`${profile.trainingDays.map((d) => WEEKDAY_SHORT[d]).join(', ')} · ${profile.sessionMinutes} min`}
              onClick={() => navigate('/onboarding?step=schedule')}
            />
            <ListRow icon="run" iconTone="run" title="Running" subtitle={RUN_LABEL[profile.runLevel]} onClick={() => navigate('/onboarding?step=running')} />
            <ListRow
              icon="shield"
              iconTone="warn"
              title="Injuries & movements to avoid"
              subtitle={profile.avoid.length ? profile.avoid.map((a) => AVOID_LABEL[a]).join(', ') : 'None'}
              onClick={() => navigate('/onboarding?step=health')}
            />
            <ListRow icon="edit" title="Edit all answers" subtitle="Changes rebuild your plan and keep your current levels" onClick={() => navigate('/onboarding')} />
          </ListGroup>
        </section>

        <section>
          <ListGroup>
            <ListRow icon="layers" title="Programme" subtitle="Weeks, levels, deloads and rebuilding" onClick={() => navigate('/plan')} />
            <ListRow icon="heart" title="Body & photos" subtitle="Optional measurements and private progress photos" onClick={() => navigate('/body')} />
            <ListRow icon="clock" title="History" onClick={() => navigate('/history')} />
          </ListGroup>
        </section>

        <section>
          <ListGroup>
            <ListRow icon="settings" title="Settings" subtitle="Units, theme, sound, accessibility, reminders" onClick={() => navigate('/settings')} />
            <ListRow icon="download" title="Your data" subtitle="Export, import and delete" onClick={() => navigate('/data')} />
            <ListRow icon="info" title="Safety & about" subtitle="How Forge works and its limits" onClick={() => navigate('/about')} />
          </ListGroup>
        </section>
        <p className="text-center text-[12.5px] text-faint flex items-center justify-center gap-1.5">
          <Badge tone="calm">Private</Badge> Everything stays on this device. No account, no tracking.
        </p>
      </div>
    </Screen>
  )
}
