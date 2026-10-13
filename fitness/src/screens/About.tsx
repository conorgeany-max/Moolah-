import type { ReactNode } from 'react'
import { Screen } from '../components/Layout'
import { Card, Notice, SectionHeader } from '../components/ui'
import { EFFORT_GUIDE } from '../data/running'
import { isOfflineReady } from '../lib/sw'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionHeader title={title} />
      <Card className="p-4 text-[15px] leading-relaxed space-y-2.5">{children}</Card>
    </section>
  )
}

export function AboutScreen() {
  return (
    <Screen title="Safety & about" back="/profile">
      <div className="space-y-6">
        <Notice tone="warn" icon="shield" title="General information, not medical advice">
          Forge provides general fitness information. It is not a substitute for advice from a doctor or physiotherapist. If you have a medical condition, an injury, are pregnant, or haven’t exercised in a long time, check with a health professional before starting.
        </Notice>

        <Block title="Effort versus pain">
          <p>
            <strong>Effort</strong> is breathing hard, muscles burning or shaking, and fatigue that fades within minutes of stopping. That is normal training.
          </p>
          <p>
            <strong>Pain</strong> is sharp, stabbing, pinching or joint pain, pain that gets worse as you continue, pain that changes how you move, or anything that lingers or worsens the next day. Stop the exercise, use the “It hurts” option in the player to swap to something gentler, and rest that area.
          </p>
          <p className="text-danger font-medium">Stop immediately and seek medical help for chest pain or pressure, unusual shortness of breath, dizziness, fainting or a racing irregular heartbeat.</p>
        </Block>

        <Block title="How effort is measured">
          <ul className="space-y-2">
            {(
              [
                ['Easy runs', EFFORT_GUIDE.easy],
                ['Tempo', EFFORT_GUIDE.tempo],
                ['Intervals', EFFORT_GUIDE.brisk],
                ['Hills', EFFORT_GUIDE.hills],
              ] as const
            ).map(([label, text]) => (
              <li key={label}>
                <strong>{label}</strong>: {text}
              </li>
            ))}
          </ul>
          <p className="text-muted text-[14px]">For strength sets, “reps in reserve” means how many more good reps you could have done. Most working sets should finish with 1–3 left.</p>
        </Block>

        <Block title="How your programme adapts">
          <p>Forge uses transparent rules, not AI. Each exercise has a rep or time range. When you hit the top of the range on every set and report that it felt manageable, the target rises; after enough solid sessions it suggests a harder variation, which you can accept or decline.</p>
          <p>Running builds gradually: volume and intensity are never increased in the same week. Run/walk stages only advance after two sessions that didn’t feel too hard, and step back if two in a row did.</p>
          <p>Deload weeks reduce volume so your body can absorb the training. Missed sessions don’t pile up; you can catch one up later in the week if it doesn’t create back-to-back hard days.</p>
        </Block>

        <Block title="Honest limitations">
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>GPS on iPhone:</strong> web apps only receive location while Forge is on screen. If you lock your phone or switch apps, tracking pauses and the gap is not counted. Keep the screen on during a run, or log the run manually afterwards from a watch or another app.
            </li>
            <li>
              <strong>Pulling strength:</strong> you can’t fully train pull-ups without a bar. Floor work strengthens the upper back, but a sturdy bar (a park rig or playground) is needed for real pulling. Forge never asks you to pull on doors or furniture.
            </li>
            <li>
              <strong>Calories:</strong> Forge doesn’t show calorie estimates. Without heart-rate and metabolic data they are too inaccurate to be useful.
            </li>
            <li>
              <strong>Reminders:</strong> web apps can’t schedule notifications without a server, so reminders are exported to your Calendar app instead.
            </li>
            <li>
              <strong>Vibration:</strong> Safari doesn’t let web apps vibrate, so timers use sound and on-screen cues.
            </li>
            <li>
              <strong>Storage:</strong> data lives in this browser only. Clearing Safari website data deletes it. Export backups regularly.
            </li>
          </ul>
        </Block>

        <Block title="Privacy">
          <p>No account, no analytics, no ads and no third-party services. Forge makes no network requests except loading its own files. Location is used only during a run you start, and stays on the device.</p>
        </Block>

        <Block title="Export format">
          <p>
            A full backup is one JSON file with <code>format: "forge-export"</code> and <code>version: 1</code>, containing your profile, settings, programme, workouts (with every set), runs (with GPS points), check-ins, measurements and recommendations. Units inside the file are always metric: kilograms, centimetres, metres and milliseconds. Progress photos are never exported.
          </p>
          <p>CSV exports give one row per logged set (workouts) or per run, ready for a spreadsheet.</p>
        </Block>

        <p className="text-center text-[12.5px] text-faint pb-2">Forge · {isOfflineReady() ? 'Available offline' : 'Offline support activates after the first full load of the installed app'}</p>
      </div>
    </Screen>
  )
}
