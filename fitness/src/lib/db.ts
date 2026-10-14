/**
 * Local-first persistence. IndexedDB is the primary store; if it is unavailable
 * (some private-browsing modes), a localStorage snapshot is used instead.
 * Nothing in here talks to a network.
 */

export const COLLECTIONS = ['workouts', 'runs', 'checkIns', 'measurements', 'recommendations', 'milestones', 'customExercises', 'benchmarks'] as const
export type Collection = (typeof COLLECTIONS)[number]
const STORES = [...COLLECTIONS, 'kv', 'photos'] as const
type Store = (typeof STORES)[number]

const DB_NAME = 'forge'
const DB_VERSION = 2 // v2: benchmarks store
const LS_KEY = 'forge:fallback-v1'

let dbPromise: Promise<IDBDatabase> | null = null
let mode: 'idb' | 'local' | 'memory' = 'idb'

export function storageMode() {
  return mode
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, s === 'kv' ? undefined : { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open database'))
    req.onblocked = () => reject(new Error('Database blocked by another tab'))
  })
  return dbPromise
}

function tx<T>(store: Store, txMode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, txMode)
        const s = t.objectStore(store)
        const req = fn(s)
        t.oncomplete = () => resolve(req ? req.result : (undefined as T))
        t.onerror = () => reject(t.error ?? new Error('Transaction failed'))
        t.onabort = () => reject(t.error ?? new Error('Transaction aborted'))
      }),
  )
}

// ───────────── localStorage fallback ─────────────
type Snapshot = { kv: Record<string, unknown> } & Record<Collection, Record<string, unknown>>

function readSnapshot(): Snapshot {
  const empty = { kv: {} } as Snapshot
  for (const c of COLLECTIONS) empty[c] = {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return empty
    return { ...empty, ...JSON.parse(raw) }
  } catch {
    return empty
  }
}
let memorySnapshot: Snapshot | null = null
function writeSnapshot(s: Snapshot) {
  memorySnapshot = s
  if (mode === 'memory') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    mode = 'memory'
  }
}
function snapshot(): Snapshot {
  return memorySnapshot ?? (memorySnapshot = readSnapshot())
}

// ───────────── public API ─────────────
export interface LoadedData {
  kv: Record<string, unknown>
  collections: Record<Collection, unknown[]>
}

export async function loadEverything(): Promise<LoadedData> {
  try {
    await openDb()
    const kvKeys = await tx<IDBValidKey[]>('kv', 'readonly', (s) => s.getAllKeys())
    const kvVals = await tx<unknown[]>('kv', 'readonly', (s) => s.getAll())
    const kv: Record<string, unknown> = {}
    kvKeys.forEach((k, i) => (kv[String(k)] = kvVals[i]))
    const collections = {} as Record<Collection, unknown[]>
    for (const c of COLLECTIONS) collections[c] = await tx<unknown[]>(c, 'readonly', (s) => s.getAll())
    mode = 'idb'
    return { kv, collections }
  } catch {
    mode = 'local'
    const snap = snapshot()
    const collections = {} as Record<Collection, unknown[]>
    for (const c of COLLECTIONS) collections[c] = Object.values(snap[c] ?? {})
    return { kv: snap.kv, collections }
  }
}

export async function putKV(key: string, value: unknown) {
  if (mode !== 'idb') {
    const s = snapshot()
    s.kv[key] = value
    return writeSnapshot(s)
  }
  await tx('kv', 'readwrite', (s) => s.put(value, key))
}

export async function deleteKV(key: string) {
  if (mode !== 'idb') {
    const s = snapshot()
    delete s.kv[key]
    return writeSnapshot(s)
  }
  await tx('kv', 'readwrite', (s) => s.delete(key))
}

export async function putRecord(c: Collection, value: { id: string }) {
  if (mode !== 'idb') {
    const s = snapshot()
    s[c][value.id] = value
    return writeSnapshot(s)
  }
  await tx(c, 'readwrite', (s) => s.put(value))
}

export async function putRecords(c: Collection, values: { id: string }[]) {
  if (mode !== 'idb') {
    const s = snapshot()
    for (const v of values) s[c][v.id] = v
    return writeSnapshot(s)
  }
  await tx(c, 'readwrite', (s) => {
    for (const v of values) s.put(v)
  })
}

export async function deleteRecord(c: Collection, id: string) {
  if (mode !== 'idb') {
    const s = snapshot()
    delete s[c][id]
    return writeSnapshot(s)
  }
  await tx(c, 'readwrite', (s) => s.delete(id))
}

export async function clearEverything() {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
  memorySnapshot = null
  if (mode !== 'idb') return
  for (const s of STORES) await tx(s, 'readwrite', (st) => st.clear())
}

// ───────────── photos (IndexedDB only) ─────────────
export interface PhotoRecord {
  id: string
  date: string
  createdAt: string
  blob: Blob
  note?: string
}

export function photosSupported() {
  return mode === 'idb'
}

export async function listPhotos(): Promise<PhotoRecord[]> {
  if (mode !== 'idb') return []
  const all = await tx<PhotoRecord[]>('photos', 'readonly', (s) => s.getAll())
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function putPhoto(p: PhotoRecord) {
  if (mode !== 'idb') throw new Error('Photo storage needs IndexedDB, which is unavailable in this browser mode.')
  await tx('photos', 'readwrite', (s) => s.put(p))
}

export async function deletePhoto(id: string) {
  if (mode !== 'idb') return
  await tx('photos', 'readwrite', (s) => s.delete(id))
}

/** Ask the browser to keep our data even under storage pressure (best effort). */
export async function requestPersistence(): Promise<boolean | undefined> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return await navigator.storage?.persist?.()
  } catch {
    return undefined
  }
}
