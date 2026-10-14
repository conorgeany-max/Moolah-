import { useEffect, useState } from 'react'
import { Screen } from '../components/Layout'
import { Badge, Button, Card, NumberInput, Notice, toast } from '../components/ui'
import { benchmarkDeltas } from '../engine/benchmarks'
import { getExercise } from '../engine/library'
import { useNow } from '../hooks/useNow'
import { saveBenchmark } from '../lib/actions'
import { dayKey } from '../lib/date'
import { beep, unlockAudio } from '../lib/feedback'
import { formatDuration } from '../lib/format'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'

function Stopwatch({ onStop }: { onStop: (sec: number) => void }) {
  const [start, setStart] = useState<number | null>(null)
  const now = useNow(start !== null, 100)
  const sec = start ? Math.floor((now - start) / 1000) : 0
  return start === null ? (
    <Button variant="secondary" block icon="play" onClick={() => (unlockAudio(), beep('go'), setStart(Date.now()))}>
      Start stopwatch
    </Button>
  ) : (
    <Button
      block
      icon="stop"
      onClick={() => {
        beep('done')
        setStart(null)
        if (sec > 0) onStop(sec)
      }}
    >
      Stop at <span className="num ml-1">{formatDuration(sec * 1000)}</span>
    </Button>
  )
}

function Countdown({ seconds }: { seconds: number }) {
  const [start, setStart] = useState<number | null>(null)
  const now = useNow(start !== null, 200)
  const left = start ? Math.max(0, seconds - Math.floor((now - start) / 1000)) : seconds
  useEffect(() => {
    if (start && left === 0) {
      beep('done')
      setStart(null)
    }
  }, [start, left])
  return start === null ? (
    <Button variant="secondary" block icon="play" onClick={() => (unlockAudio(), beep('go'), setStart(Date.now()))}>
      Start {seconds} s timer
    </Button>
  ) : (
    <Button variant="secondary" block icon="stop" onClick={() => setStart(null)}>
      <span className="num">{left}</span>&nbsp;s left · stop
    </Button>
  )
}

export function RetestScreen() {
  const programme = useStore((s) => s.programme)
  const benchmarks = useStore((s) => s.benchmarks)
  const pushId = programme?.slots.push?.exerciseId ?? 'pushup'
  const pushEx = getExercise(pushId)
  const [pushups, setPushups] = useState<number | undefined>()
  const [plank, setPlank] = useState<number | undefined>()
  const [squats, setSquats] = useState<number | undefined>()
  const [kmMin, setKmMin] = useState<number | undefined>()
  const [kmSec, setKmSec] = useState<number | undefined>()
  const km = kmMin !== undefined || kmSec !== undefined ? (kmMin ?? 0) * 60 + (kmSec ?? 0) : undefined
  const any = pushups !== undefined || plank !== undefined || squats !== undefined || (km !== undefined && km > 0)
  const deltas = benchmarkDeltas(benchmarks)
  const prev = (key: (typeof deltas)[number]['key']) => deltas.find((d) => d.key === key)?.latest

  const save = () => {
    saveBenchmark({ date: dayKey(), pushups, pushupExerciseId: pushups !== undefined ? pushId : undefined, plankSec: plank, squats60: squats, kmSec: km && km > 0 ? km : undefined })
    toast(benchmarks.length ? 'Re-test saved. See how it compares in Progress.' : 'Baseline saved. Re-test in about four weeks.', 'accent')
    navigate('/progress', { replace: true })
  }

  return (
    <Screen title={benchmarks.length ? 'Re-test' : 'Baseline test'} eyebrow="About 10 minutes" back="/progress">
      <div className="space-y-4">
        <p className="text-[15px] text-muted leading-relaxed">
          Four short max-effort tests show progress your training log can’t. Warm up first, rest about three minutes between tests, and stop any test when your form breaks or something hurts. Skip any
          you don’t want to do.
        </p>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[16px]">1. Max {pushEx?.name.toLowerCase() ?? 'push-ups'}</h2>
            {prev('pushups') !== undefined && <Badge>Last: {prev('pushups')}</Badge>}
          </div>
          <p className="text-[14px] text-muted">Your current level. One set, full range, stop when a rep isn’t clean.</p>
          <NumberInput value={pushups} onChange={(v) => setPushups(v === undefined ? undefined : Math.round(v))} suffix="reps" inputMode="numeric" ariaLabel="Push-up reps" min={0} />
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[16px]">2. Longest plank</h2>
            {prev('plankSec') !== undefined && <Badge>Last: {prev('plankSec')} s</Badge>}
          </div>
          <p className="text-[14px] text-muted">On forearms or hands. Stop when your hips sag or lift.</p>
          <Stopwatch onStop={setPlank} />
          <NumberInput value={plank} onChange={(v) => setPlank(v === undefined ? undefined : Math.round(v))} suffix="s" inputMode="numeric" ariaLabel="Plank seconds" min={0} />
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[16px]">3. Squats in 60 seconds</h2>
            {prev('squats60') !== undefined && <Badge>Last: {prev('squats60')}</Badge>}
          </div>
          <p className="text-[14px] text-muted">Bodyweight squats to at least parallel, if your knees allow. Count only full reps.</p>
          <Countdown seconds={60} />
          <NumberInput value={squats} onChange={(v) => setSquats(v === undefined ? undefined : Math.round(v))} suffix="reps" inputMode="numeric" ariaLabel="Squats in 60 seconds" min={0} />
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[16px]">4. 1 km time (optional)</h2>
            {prev('kmSec') !== undefined && <Badge>Last: {formatDuration(prev('kmSec')! * 1000)}</Badge>}
          </div>
          <p className="text-[14px] text-muted">
            A hard but controlled effort on flat ground after an easy warm-up jog. Time it with a Free run or your watch. Skip this one while you’re still on run/walk.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput value={kmMin} onChange={setKmMin} suffix="min" inputMode="numeric" ariaLabel="1 km minutes" min={0} />
            <NumberInput value={kmSec} onChange={setKmSec} suffix="s" inputMode="numeric" ariaLabel="1 km seconds" min={0} max={59} />
          </div>
        </Card>

        <Notice icon="shield" tone="warn">
          Max tests are hard by design. Skip them if you’re ill, injured or very sore, and never test to the point of pain.
        </Notice>
        <Button size="xl" block disabled={!any} onClick={save}>
          Save results
        </Button>
      </div>
    </Screen>
  )
}
