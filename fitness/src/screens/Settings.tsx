import { Screen } from '../components/Layout'
import { Button, Card, Field, inputCls, ListGroup, ListRow, Notice, SectionHeader, Segmented, toast, Toggle } from '../components/ui'
import { saveProfile, updateSettings } from '../lib/actions'
import { WEEKDAY_SHORT } from '../lib/date'
import { beep, unlockAudio } from '../lib/feedback'
import { remindersIcs } from '../lib/ics'
import { download } from '../lib/portability'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import type { Settings, Units } from '../lib/types'

export function SettingsScreen() {
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)
  const programme = useStore((s) => s.programme)
  const set = (patch: Partial<Settings>) => updateSettings(patch)
  const setUnits = (patch: Partial<Units>) => profile && saveProfile({ ...profile, units: { ...profile.units, ...patch } })
  const time = settings.reminderTime ?? '07:00'
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  const exportReminders = () => {
    if (!profile) return
    const ics = remindersIcs(profile.trainingDays, time, profile.sessionMinutes, programme?.weeks ?? 12)
    download('forge-reminders.ics', ics, 'text/calendar')
    toast('Reminder file created. Open it to add to Calendar.', 'accent')
  }

  return (
    <Screen title="Settings" back="/profile">
      <div className="space-y-6">
        {profile && (
          <section>
            <SectionHeader title="Units" />
            <Card className="p-4 space-y-4">
              <UnitRow label="Distance" value={profile.units.distance} options={[['km', 'Kilometres'], ['mi', 'Miles']]} onChange={(v) => setUnits({ distance: v })} />
              <UnitRow label="Body weight" value={profile.units.weight} options={[['kg', 'kg'], ['lb', 'lb']]} onChange={(v) => setUnits({ weight: v })} />
              <UnitRow label="Height" value={profile.units.height} options={[['cm', 'cm'], ['ftin', 'ft & in']]} onChange={(v) => setUnits({ height: v })} />
              <UnitRow label="Measurements" value={profile.units.length} options={[['cm', 'cm'], ['in', 'inches']]} onChange={(v) => setUnits({ length: v })} />
            </Card>
          </section>
        )}

        <section>
          <SectionHeader title="Appearance" />
          <Card className="p-4 space-y-2">
            <Segmented
              value={settings.theme}
              onChange={(theme) => set({ theme })}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'Automatic' },
              ]}
            />
          </Card>
          <Card className="px-4 py-1 mt-2 divide-y divide-line">
            <Toggle checked={settings.largeText} onChange={(largeText) => set({ largeText })} label="Larger text" description="Increase text size across the app." />
            <Toggle checked={settings.reducedMotion} onChange={(reducedMotion) => set({ reducedMotion })} label="Reduce motion" description="Stop animated diagrams and screen transitions." />
            <Toggle checked={settings.outdoorMode} onChange={(outdoorMode) => set({ outdoorMode })} label="Outdoor mode" description="High-contrast player with extra-large controls, and floor-only exercises (no wall, step or bar)." />
          </Card>
        </section>

        <section>
          <SectionHeader title="During workouts" />
          <Card className="px-4 py-1 divide-y divide-line">
            <Toggle checked={settings.autoStartRest} onChange={(autoStartRest) => set({ autoStartRest })} label="Start rest timer automatically" description="Begins the rest countdown when you log a set." />
            <Toggle checked={settings.keepAwake} onChange={(keepAwake) => set({ keepAwake })} label="Keep screen awake" description="Uses the Screen Wake Lock where your browser supports it (iOS 16.4+ Safari)." />
            <Toggle
              checked={settings.sound}
              onChange={(sound) => {
                set({ sound })
                if (sound) {
                  unlockAudio()
                  beep('go')
                }
              }}
              label="Timer sounds"
              description="Short beeps for the last seconds of rest and hold timers. iOS mutes them when the ring/silent switch is on."
            />
            {canSpeak && <Toggle checked={settings.voice} onChange={(voice) => set({ voice })} label="Voice cues" description="Announces the next exercise and run segments." />}
            <Toggle
              checked={settings.haptics}
              onChange={(haptics) => set({ haptics })}
              label="Vibration"
              description={canVibrate ? 'Vibrates when timers finish.' : 'Your browser does not allow web apps to vibrate (Safari on iPhone does not). Sounds and the on-screen timer are used instead.'}
            />
          </Card>
        </section>

        <section>
          <SectionHeader title="Reminders" />
          <Card className="p-4 space-y-3">
            <p className="text-[14.5px] text-muted leading-relaxed">
              Web apps can only send notifications through a push server, and Forge has no server by design. Instead, add your training days to the Calendar app as repeating events with an alert.
            </p>
            <Field label="Reminder time">
              <input type="time" value={time} onChange={(e) => set({ reminderTime: e.target.value || '07:00' })} className={inputCls} />
            </Field>
            {profile && <p className="text-[13.5px] text-muted">Days: {profile.trainingDays.map((d) => WEEKDAY_SHORT[d]).join(', ')}. Change them in your schedule.</p>}
            <Button block variant="secondary" icon="calendar" onClick={exportReminders} disabled={!profile}>
              Add reminders to Calendar
            </Button>
          </Card>
        </section>

        <section>
          <SectionHeader title="Training" />
          <ListGroup>
            <ListRow icon="calendar" title="Availability & schedule" subtitle="Training days and session length" onClick={() => navigate('/onboarding?step=schedule')} />
            <ListRow icon="shield" title="Injuries & movements to avoid" onClick={() => navigate('/onboarding?step=health')} />
            <ListRow icon="layers" title="Programme" subtitle="Rebuild, restart or adjust levels" onClick={() => navigate('/plan')} />
          </ListGroup>
        </section>

        <section>
          <SectionHeader title="Privacy & data" />
          <ListGroup>
            <ListRow icon="download" title="Export, import & delete" onClick={() => navigate('/data')} />
            <ListRow icon="lock" title="Privacy" subtitle="No account, analytics, ads or third-party services. Nothing leaves this device unless you export it." />
          </ListGroup>
        </section>
        <Notice icon="info">Settings are saved on this device as you change them.</Notice>
      </div>
    </Screen>
  )
}

function UnitRow<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px] font-medium">{label}</span>
      <Segmented className="w-[190px]" value={value} onChange={onChange} options={options.map(([v, l]) => ({ value: v, label: l }))} />
    </div>
  )
}
