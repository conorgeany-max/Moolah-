import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart } from '../components/Charts'
import { Screen } from '../components/Layout'
import { Button, Card, Chip, ConfirmSheet, Field, IconButton, inputCls, ListGroup, ListRow, Notice, NumberInput, SectionHeader, Segmented, Sheet, toast } from '../components/ui'
import { addMeasurement, deleteMeasurement } from '../lib/actions'
import { deletePhoto, listPhotos, photosSupported, putPhoto, type PhotoRecord } from '../lib/db'
import { dayKey, formatDay } from '../lib/date'
import { uid } from '../lib/id'
import { useStore } from '../lib/store'
import type { Measurement, Units } from '../lib/types'
import { lengthToCm, lengthValue, weightToKg, weightValue } from '../lib/units'

type Kind = Measurement['kind']
const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'waist', label: 'Waist' },
  { kind: 'chest', label: 'Chest' },
  { kind: 'hips', label: 'Hips' },
  { kind: 'arm', label: 'Upper arm' },
  { kind: 'thigh', label: 'Thigh' },
  { kind: 'weight', label: 'Body weight' },
  { kind: 'restingHr', label: 'Resting heart rate' },
]

function unitOf(kind: Kind, u: Units) {
  return kind === 'weight' ? u.weight : kind === 'restingHr' ? 'bpm' : u.length === 'in' ? 'in' : 'cm'
}
function display(kind: Kind, v: number, u: Units) {
  const n = kind === 'weight' ? weightValue(v, u) : kind === 'restingHr' ? v : lengthValue(v, u)
  return Math.round(n * 10) / 10
}
function store(kind: Kind, v: number, u: Units) {
  return kind === 'weight' ? weightToKg(v, u) : kind === 'restingHr' ? v : lengthToCm(v, u)
}

export function BodyScreen() {
  const [tab, setTab] = useState<'measurements' | 'photos'>('measurements')
  return (
    <Screen title="Body" back="/profile">
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-5"
        options={[
          { value: 'measurements', label: 'Measurements' },
          { value: 'photos', label: 'Photos' },
        ]}
      />
      {tab === 'measurements' ? <Measurements /> : <Photos />}
    </Screen>
  )
}

function Measurements() {
  const all = useStore((s) => s.measurements)
  const units = useStore((s) => s.profile?.units)
  const [kind, setKind] = useState<Kind>('waist')
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState<number | undefined>()
  const [date, setDate] = useState(dayKey())
  if (!units) return null
  const list = all.filter((m) => m.kind === kind).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const label = KINDS.find((k) => k.kind === kind)!.label
  const unit = unitOf(kind, units)
  const points = list.map((m) => ({ x: formatDay(m.date, { day: 'numeric', month: 'short' }), y: display(kind, m.value, units) }))
  const first = list[0]
  const last = list[list.length - 1]
  const change = first && last && first !== last ? display(kind, last.value, units) - display(kind, first.value, units) : null

  const save = () => {
    if (value === undefined || value <= 0) return
    addMeasurement({ date, kind, value: store(kind, value, units) })
    setAdding(false)
    setValue(undefined)
    toast(`${label} saved`, 'accent')
  }

  return (
    <div className="space-y-5">
      <p className="text-[14.5px] text-muted leading-relaxed">Entirely optional. Tape measurements and how you perform usually tell you more than the scale. Track only what is useful to you.</p>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
        {KINDS.map((k) => (
          <Chip key={k.kind} selected={kind === k.kind} onClick={() => setKind(k.kind)} className="shrink-0">
            {k.label}
          </Chip>
        ))}
      </div>
      <Card className="p-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[13px] text-muted">{label}</div>
            <div className="num text-[28px] font-bold leading-tight">
              {last ? display(kind, last.value, units) : '—'} <span className="text-[15px] text-muted font-medium">{unit}</span>
            </div>
          </div>
          {change !== null && (
            <div className="text-right text-[13px] text-muted">
              <span className="num font-semibold text-ink">
                {change > 0 ? '+' : ''}
                {Math.round(change * 10) / 10} {unit}
              </span>
              <div>since {formatDay(first.date, { day: 'numeric', month: 'short' })}</div>
            </div>
          )}
        </div>
        <LineChart points={points} format={(v) => String(Math.round(v * 10) / 10)} ariaLabel={`${label} over time`} empty={<span>Add two entries to see a trend.</span>} />
      </Card>
      <Button block size="lg" icon="plus" onClick={() => (setDate(dayKey()), setAdding(true))}>
        Add {label.toLowerCase()}
      </Button>
      {list.length > 0 && (
        <ListGroup>
          {[...list].reverse().map((m) => (
            <ListRow
              key={m.id}
              title={`${display(kind, m.value, units)} ${unit}`}
              subtitle={formatDay(m.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              right={<IconButton icon="trash" label="Delete entry" variant="ghost" size={40} onClick={() => deleteMeasurement(m.id)} />}
            />
          ))}
        </ListGroup>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title={`Add ${label.toLowerCase()}`}>
        <div className="space-y-4">
          <Field label={`Value (${unit})`}>
            <NumberInput value={value} onChange={setValue} suffix={unit} ariaLabel={label} min={0} />
          </Field>
          <Field label="Date">
            <input type="date" value={date} max={dayKey()} onChange={(e) => setDate(e.target.value || dayKey())} className={inputCls} />
          </Field>
          {kind === 'waist' && <p className="text-[13px] text-muted">Measure at the navel, relaxed, after breathing out.</p>}
          {kind === 'restingHr' && <p className="text-[13px] text-muted">Best measured lying down just after waking.</p>}
          <Button block size="lg" disabled={value === undefined || value <= 0} onClick={save}>
            Save
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

/** Downscale a photo before storing it, to keep storage use reasonable. */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file
  }
}

function Photos() {
  const [photos, setPhotos] = useState<PhotoRecord[] | null>(null)
  const [viewing, setViewing] = useState<PhotoRecord | null>(null)
  const [removing, setRemoving] = useState<PhotoRecord | null>(null)
  const [hidden, setHidden] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const supported = photosSupported()

  useEffect(() => {
    if (supported) listPhotos().then(setPhotos).catch(() => setPhotos([]))
  }, [supported])

  const urls = useMemo(() => new Map((photos ?? []).map((p) => [p.id, URL.createObjectURL(p.blob)])), [photos])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  const add = async (f: File | undefined) => {
    if (!f) return
    try {
      const blob = await compress(f)
      const rec: PhotoRecord = { id: uid('ph'), date: dayKey(), createdAt: new Date().toISOString(), blob }
      await putPhoto(rec)
      setPhotos((p) => [rec, ...(p ?? [])])
      setHidden(false)
      toast('Photo saved privately on this device', 'accent')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the photo', 'danger')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!supported) {
    return (
      <Notice tone="warn" icon="alert" title="Photos unavailable">
        This browser session can’t use IndexedDB (often because of private browsing), so photos can’t be stored safely.
      </Notice>
    )
  }

  return (
    <div className="space-y-5">
      <Notice icon="lock" tone="calm" title="Private by design">
        Photos are stored only inside Forge on this device. They are not added to your camera roll, not uploaded, and not included in exports. Deleting app data removes them.
      </Notice>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => add(e.target.files?.[0])} aria-label="Add progress photo" />
      <Button block size="lg" icon="camera" onClick={() => fileRef.current?.click()}>
        Add progress photo
      </Button>
      {photos && photos.length > 0 && (
        <section>
          <SectionHeader
            title={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}
            action={
              <button type="button" className="text-[14px] font-semibold text-accent-fg" onClick={() => setHidden((h) => !h)}>
                {hidden ? 'Show' : 'Hide'}
              </button>
            }
          />
          {hidden ? (
            <p className="text-[14px] text-muted">Thumbnails are hidden so they don’t appear when someone glances at your screen.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <button key={p.id} type="button" onClick={() => setViewing(p)} className="press relative aspect-[3/4] rounded-[12px] overflow-hidden bg-raised" aria-label={`Photo from ${formatDay(p.date)}`}>
                  <img src={urls.get(p.id)} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 text-[11px] px-1.5 py-0.5 rounded-md bg-black/60 text-white">{formatDay(p.date, { day: 'numeric', month: 'short' })}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {photos && photos.length === 0 && <p className="text-[14px] text-muted text-center">No photos yet. Same light, same pose and same time of day make comparisons fair.</p>}

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing ? formatDay(viewing.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''} tall>
        {viewing && (
          <div className="space-y-4">
            <img src={urls.get(viewing.id)} alt="Progress photo" className="w-full rounded-[16px]" />
            <Button block variant="danger" icon="trash" onClick={() => setRemoving(viewing)}>
              Delete photo
            </Button>
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Delete this photo?"
        body="It will be permanently removed from this device."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!removing) return
          await deletePhoto(removing.id)
          setPhotos((p) => (p ?? []).filter((x) => x.id !== removing.id))
          setViewing(null)
        }}
      />
    </div>
  )
}
