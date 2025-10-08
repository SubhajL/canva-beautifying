// Simple in-memory R2 local storage shim for tests
import { getR2Key, R2_FOLDERS } from './client'

type StoredItem = {
  key: string
  buffer: Buffer
  contentType?: string
  metadata?: Record<string, string>
}

const store = new Map<string, StoredItem>()

export async function uploadFileLocal({
  file,
  userId,
  filename,
  folder,
  contentType,
  metadata = {},
}: {
  file: File | Buffer
  userId: string
  filename: string
  folder: keyof typeof R2_FOLDERS
  contentType?: string
  metadata?: Record<string, string>
}): Promise<{ key: string; url: string }> {
  const key = getR2Key(folder, userId, filename)
  const buffer = file instanceof Buffer ? file : Buffer.from(await file.arrayBuffer())

  store.set(key, { key, buffer, contentType, metadata })
  const url = `http://local-r2/${key}`
  return { key, url }
}

export async function deleteFileLocal(key: string): Promise<void> {
  store.delete(key)
}

export async function deleteFilesLocal(keys: string[]): Promise<void> {
  keys.forEach(k => store.delete(k))
}

// Useful for tests wanting to introspect
export function __getLocalR2Store() {
  return store
}

