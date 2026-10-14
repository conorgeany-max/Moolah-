import { useEffect, useRef, useState } from 'react'
import { Screen } from '../components/Layout'
import { Button, Card, ConfirmSheet, inputCls, ListGroup, ListRow, Notice, SectionHeader, Sheet, toast } from '../components/ui'
import { deleteAllData } from '../lib/actions'
import { requestPersistence, storageMode } from '../lib/db'
import { dayKey } from '../lib/date'
import { applyImport, buildExport, ImportError, parseImport, runsCsv, shareOrDownload, workoutsCsv } from '../lib/portability'
import { navigate } from '../lib/router'
import { getState, useStore } from '../lib/store'
import type { AppData } from '../lib/types'

export function DataScreen() {
  const workouts = useStore((s) => s.workouts)
  const runs = useStore((s) => s.runs.length)
  const measurements = useStore((s) => s.measurements.length)
  const [persisted, setPersisted] = useState<boolean | undefined>(undefined)
  const [usage, setUsage] = useState<string | null>(null)
  const [pending, setPending] = useState<{ data: AppData; name: string } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const mode = storageMode()

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => undefined)
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage !== undefined && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB`))
      .catch(() => undefined)
  }, [])

  const exportJson = async () => {
    const r = await shareOrDownload(`forge-backup-${dayKey()}.json`, JSON.stringify(buildExport(), null, 2), 'application/json')
    if (r !== 'cancelled') toast('Backup exported', 'accent')
  }
  const exportCsv = async (kind: 'workouts' | 'runs') => {
    const content = kind === 'workouts' ? workoutsCsv(getState().workouts) : runsCsv()
    const r = await shareOrDownload(`forge-${kind}-${dayKey()}.csv`, content, 'text/csv')
    if (r !== 'cancelled') toast(`${kind === 'workouts' ? 'Workouts' : 'Runs'} CSV exported`, 'accent')
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setImportError(null)
    try {
      const data = parseImport(await f.text())
      setPending({ data, name: f.name })
    } catch (e) {
      setImportError(e instanceof ImportError ? e.message : 'Could not read that file.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Screen title="Your data" back="/profile">
      <div className="space-y-6">
        <Notice icon="lock" tone="calm" title="Local-first and private">
          Your data lives only in this browser on this device. There is no account, no cloud copy and no analytics. If you delete Safari website data or remove the app, it is gone, so export a backup now and then.
        </Notice>

        <section>
          <SectionHeader title="Export" />
          <ListGroup>
            <ListRow icon="download" iconTone="accent" title="Full backup (JSON)" subtitle="Everything except photos. Can be imported again." onClick={exportJson} />
            <ListRow icon="download" title="Workouts (CSV)" subtitle={`${workouts.filter((w) => w.status !== 'active').length} workouts, one row per set`} onClick={() => exportCsv('workouts')} />
            <ListRow icon="download" title="Runs (CSV)" subtitle={`${runs} runs`} onClick={() => exportCsv('runs')} />
          </ListGroup>
          <p className="text-[12.5px] text-faint mt-2">On iPhone the share sheet opens: choose Save to Files, AirDrop or another app.</p>
        </section>

        <section>
          <SectionHeader title="Import" />
          <Card className="p-4 space-y-3">
            <p className="text-[14.5px] text-muted">Restore a Forge JSON backup. Importing replaces everything currently stored here, including progress photos.</p>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose backup file" />
            <Button block variant="secondary" icon="upload" onClick={() => fileRef.current?.click()}>
              Choose backup file
            </Button>
            {importError && (
              <p className="text-[14px] text-danger" role="alert">
                {importError}
              </p>
            )}
          </Card>
        </section>

        <section>
          <SectionHeader title="Storage" />
          <ListGroup>
            <ListRow
              icon="layers"
              title="Storage engine"
              subtitle={mode === 'idb' ? 'IndexedDB (recommended)' : mode === 'local' ? 'Fallback: localStorage. Photos are unavailable in this mode.' : 'Temporary memory only: data will be lost when you close the app. Private browsing may cause this.'}
            />
            <ListRow icon="shield" title="Protected from automatic clearing" subtitle={persisted === undefined ? 'Unknown in this browser' : persisted ? 'Yes' : 'Not yet. Adding Forge to your Home Screen helps.'} right={persisted === false ? <Button size="sm" variant="outline" onClick={() => requestPersistence().then((v) => (setPersisted(!!v), toast(v ? 'Storage protected' : 'The browser declined for now')))}>Request</Button> : undefined} />
            {usage && <ListRow icon="info" title="Space used" subtitle={`${usage} including the app itself · ${measurements} measurements`} />}
          </ListGroup>
        </section>

        <section>
          <SectionHeader title="Delete" />
          <Card className="p-4 space-y-3">
            <p className="text-[14.5px] text-muted">Permanently erase your profile, programme, history, runs, measurements and photos from this device. This cannot be undone.</p>
            <Button block variant="danger" icon="trash" onClick={() => (setDeleteText(''), setConfirmDelete(true))}>
              Delete all data
            </Button>
          </Card>
        </section>
      </div>

      <ConfirmSheet
        open={!!pending}
        onClose={() => setPending(null)}
        title="Replace your data?"
        body={
          pending ? (
            <>
              <strong>{pending.name}</strong> contains {pending.data.workouts.length} workouts, {pending.data.runs.length} runs and {pending.data.measurements.length} measurements
              {pending.data.profile ? '' : ' (no profile)'}. Everything currently on this device will be replaced.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Import and replace"
        danger
        onConfirm={async () => {
          if (!pending) return
          try {
            await applyImport(pending.data)
            toast('Backup imported', 'accent')
            navigate('/', { replace: true })
          } catch {
            toast('Import failed. Your previous data may be partly cleared; try the import again.', 'danger')
          }
        }}
      />

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete everything?">
        <div className="space-y-4">
          <p className="text-[15px] text-muted">Type <strong className="text-ink">DELETE</strong> to confirm. Consider exporting a backup first.</p>
          <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} className={inputCls} autoCapitalize="characters" aria-label="Type DELETE to confirm" />
          <Button
            block
            size="lg"
            variant="danger"
            disabled={deleteText.trim().toUpperCase() !== 'DELETE'}
            onClick={async () => {
              await deleteAllData()
              setConfirmDelete(false)
              navigate('/', { replace: true })
            }}
          >
            Delete permanently
          </Button>
        </div>
      </Sheet>
    </Screen>
  )
}
