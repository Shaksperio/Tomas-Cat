import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { SavedGameState } from '../types/game';
import { deletePendingGameSave, getPendingGameSave, putPendingGameSave, type PendingGameSave } from '../game/offline/offlineOutbox';
import { firestore } from './client';

interface QueuedSave extends PendingGameSave {
  timer: number;
  persistPromise: Promise<void>;
  onError?: (error: unknown) => void;
  onSaved?: () => void;
}

const pending = new Map<string, QueuedSave>();
const remoteFingerprints = new Map<string, string | null>();
const REMOTE_VERSION_PREFIX = 'tomas-remote-version:';
let revisionCounter = 0;

export class SaveConflictError extends Error {
  constructor() {
    super('O salvamento remoto mudou desde a última sincronização. A cópia offline foi preservada para evitar sobrescrever progresso de outro dispositivo.');
    this.name = 'SaveConflictError';
  }
}

async function fingerprint(payload: SavedGameState): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function cachedRemoteFingerprint(uid: string): string | null | undefined {
  if (remoteFingerprints.has(uid)) return remoteFingerprints.get(uid);
  try {
    const raw = localStorage.getItem(REMOTE_VERSION_PREFIX + encodeURIComponent(uid));
    if (raw === null) return undefined;
    const value = raw === '__none__' ? null : raw;
    remoteFingerprints.set(uid, value);
    return value;
  } catch {
    return undefined;
  }
}

function rememberRemoteFingerprint(uid: string, value: string | null): void {
  remoteFingerprints.set(uid, value);
  try {
    localStorage.setItem(REMOTE_VERSION_PREFIX + encodeURIComponent(uid), value ?? '__none__');
  } catch {
    // The IndexedDB outbox remains available even if this cache cannot be written.
  }
}

function saveDocument(uid: string) {
  if (!firestore) throw new Error('Firebase Firestore não está configurado.');
  return doc(firestore, 'users', uid, 'gameSaves', 'main');
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

export async function loadAccountGameSave(uid: string): Promise<SavedGameState | null> {
  const snapshot = await withTimeout(
    getDoc(saveDocument(uid)),
    12_000,
    'Tempo esgotado ao consultar o Firestore (banco não criado, regras não publicadas ou sem conexão).',
  );
  if (!snapshot.exists()) {
    await rememberRemoteFingerprint(uid, null);
    return null;
  }
  const data = snapshot.data();
  if (data.ownerUid !== uid || !data.payload || typeof data.payload !== 'object') {
    throw new Error('O salvamento remoto não pertence a esta conta ou está inválido.');
  }
  const payload = data.payload as SavedGameState;
  await rememberRemoteFingerprint(uid, await fingerprint(payload));
  return payload;
}

export async function saveAccountGameSave(
  uid: string,
  payload: SavedGameState,
  expectedFingerprint: string | null,
): Promise<void> {
  const serialized = JSON.stringify(payload);
  if (serialized.length > 850_000) throw new Error('O salvamento excede o limite seguro de tamanho.');
  const reference = saveDocument(uid);
  if (!firestore) throw new Error('Firebase Firestore não está configurado.');
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    let currentFingerprint: string | null = null;
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.ownerUid !== uid || !data.payload || typeof data.payload !== 'object') {
        throw new Error('O salvamento remoto não pertence a esta conta ou está inválido.');
      }
      currentFingerprint = await fingerprint(data.payload as SavedGameState);
    }
    if (currentFingerprint !== expectedFingerprint) throw new SaveConflictError();
    transaction.set(reference, {
      ownerUid: uid,
      schemaVersion: 1,
      payload,
      updatedAt: serverTimestamp(),
    });
  });
  rememberRemoteFingerprint(uid, await fingerprint(payload));
}

function createRevision(): string {
  revisionCounter += 1;
  return Date.now().toString(36) + '-' + revisionCounter.toString(36);
}

export function queueAccountGameSave(
  uid: string,
  payload: SavedGameState,
  onSaved?: () => void,
  onError?: (error: unknown) => void,
): void {
  const previous = pending.get(uid);
  const revision = createRevision();
  const record: PendingGameSave = {
    uid,
    revision,
    queuedAt: Date.now(),
    payload,
    baseFingerprint: cachedRemoteFingerprint(uid),
  };
  const persistPromise = putPendingGameSave(record);
  void persistPromise.catch((error) => onError?.(error));
  const timer = previous?.timer ?? window.setTimeout(() => {
    void flushAccountGameSave(uid).catch(() => undefined);
  }, 15_000);
  pending.set(uid, { ...record, timer, persistPromise, onSaved, onError });
}

export async function flushAccountGameSave(uid: string): Promise<void> {
  const queued = pending.get(uid);
  await queued?.persistPromise;
  const durable = await getPendingGameSave(uid);
  const candidate = durable ?? queued;
  if (!candidate) return;
  // Se uma versão mais nova chegou enquanto a versão anterior era preparada,
  // não envie a antiga: o próximo flush usará o snapshot mais recente.
  let latest = pending.get(uid);
  if (latest && latest.revision !== candidate.revision) {
    if (latest.queuedAt > candidate.queuedAt) return;
    window.clearTimeout(latest.timer);
    const timer = window.setTimeout(() => {
      void flushAccountGameSave(uid).catch(() => undefined);
    }, 0);
    latest = { ...candidate, timer, persistPromise: Promise.resolve(), onError: latest.onError, onSaved: latest.onSaved };
    pending.set(uid, latest);
  }

  try {
    const baseFingerprint = candidate.baseFingerprint;
    if (baseFingerprint === undefined) throw new SaveConflictError();
    await saveAccountGameSave(uid, candidate.payload, baseFingerprint);
    // Compare-and-delete: nunca apague um snapshot mais novo que chegou durante
    // a escrita remota.
    await deletePendingGameSave(uid, candidate.revision);
    const isCurrentRevision = pending.get(uid)?.revision === candidate.revision;
    if (isCurrentRevision) {
      window.clearTimeout(pending.get(uid)!.timer);
      pending.delete(uid);
      latest?.onSaved?.();
    }
  } catch (error) {
    const current = pending.get(uid);
    if (current?.revision === candidate.revision) {
      window.clearTimeout(current.timer);
      if (error instanceof SaveConflictError) {
        pending.set(uid, current);
      } else {
        const retryTimer = window.setTimeout(() => {
          void flushAccountGameSave(uid).catch(() => undefined);
        }, 15_000);
        pending.set(uid, { ...current, timer: retryTimer });
      }
      current.onError?.(error);
    } else {
      queued?.onError?.(error);
    }
    throw error;
  }
}

/** Reenvia o último snapshot durável da conta após a autenticação/reconexão. */
export async function flushPendingAccountGameSave(uid: string): Promise<void> {
  const current = pending.get(uid);
  if (current) {
    await flushAccountGameSave(uid);
    return;
  }
  const durable = await getPendingGameSave(uid);
  if (!durable) return;
  const timer = window.setTimeout(() => {
    void flushAccountGameSave(uid).catch(() => undefined);
  }, 0);
  pending.set(uid, { ...durable, timer, persistPromise: Promise.resolve() });
  await flushAccountGameSave(uid);
}
