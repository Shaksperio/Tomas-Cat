import type { SavedGameState } from '../types/game';

const DATABASE_NAME = 'tomas-vagabundo-offline';
const DATABASE_VERSION = 1;
const STORE_NAME = 'pending-saves';
const FALLBACK_PREFIX = 'tomas-offline-outbox:';

export interface PendingGameSave {
  uid: string;
  revision: string;
  queuedAt: number;
  payload: SavedGameState;
  /** Fingerprint of the remote snapshot this offline edit was based on. */
  baseFingerprint?: string | null;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB indisponível neste navegador.'));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'uid' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir a fila offline.'));
    request.onblocked = () => reject(new Error('A atualização da fila offline está bloqueada por outra aba.'));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

function fallbackKey(uid: string): string {
  return FALLBACK_PREFIX + encodeURIComponent(uid);
}

function readFallback(uid: string): PendingGameSave | null {
  try {
    const raw = localStorage.getItem(fallbackKey(uid));
    return raw ? JSON.parse(raw) as PendingGameSave : null;
  } catch {
    return null;
  }
}

export async function putPendingGameSave(record: PendingGameSave): Promise<void> {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao persistir a fila offline.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Gravação da fila offline cancelada.'));
    });
  } catch (error) {
    try {
      localStorage.setItem(fallbackKey(record.uid), JSON.stringify(record));
    } catch {
      throw error;
    }
  }
}

export async function getPendingGameSave(uid: string): Promise<PendingGameSave | null> {
  try {
    const database = await openDatabase();
    const stored = await new Promise<PendingGameSave | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(uid);
      request.onsuccess = () => resolve((request.result as PendingGameSave | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Falha ao ler a fila offline.'));
    });
    const fallback = readFallback(uid);
    if (!stored) return fallback;
    return fallback && fallback.queuedAt > stored.queuedAt ? fallback : stored;
  } catch {
    return readFallback(uid);
  }
}

export async function deletePendingGameSave(uid: string, revision: string): Promise<void> {
  const fallback = readFallback(uid);
  if (fallback?.revision === revision) localStorage.removeItem(fallbackKey(uid));
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(uid);
      request.onsuccess = () => {
        const current = request.result as PendingGameSave | undefined;
        if (current?.revision === revision) store.delete(uid);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Falha ao limpar a fila offline.'));
    });
  } catch {
    // A cópia de fallback já foi limpa quando correspondia à revisão enviada.
  }
}
