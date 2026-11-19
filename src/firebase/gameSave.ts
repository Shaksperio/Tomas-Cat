import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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
let revisionCounter = 0;

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
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (data.ownerUid !== uid || !data.payload || typeof data.payload !== 'object') {
    throw new Error('O salvamento remoto não pertence a esta conta ou está inválido.');
  }
  return data.payload as SavedGameState;
}

export async function saveAccountGameSave(uid: string, payload: SavedGameState): Promise<void> {
  const serialized = JSON.stringify(payload);
  if (serialized.length > 850_000) throw new Error('O salvamento excede o limite seguro de tamanho.');
  await setDoc(saveDocument(uid), {
    ownerUid: uid,
    schemaVersion: 1,
    payload,
    updatedAt: serverTimestamp(),
  });
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
  const record: PendingGameSave = { uid, revision, queuedAt: Date.now(), payload };
  const persistPromise = putPendingGameSave(record);
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
  const latest = pending.get(uid);
  if (latest && latest.revision !== candidate.revision) return;

  try {
    await saveAccountGameSave(uid, candidate.payload);
    // Compare-and-delete: nunca apague um snapshot mais novo que chegou durante
    // a escrita remota.
    await deletePendingGameSave(uid, candidate.revision);
    if (pending.get(uid)?.revision === candidate.revision) {
      window.clearTimeout(pending.get(uid)!.timer);
      pending.delete(uid);
    }
    latest?.onSaved?.();
  } catch (error) {
    const current = pending.get(uid);
    if (current?.revision === candidate.revision) {
      window.clearTimeout(current.timer);
      const retryTimer = window.setTimeout(() => {
        void flushAccountGameSave(uid).catch(() => undefined);
      }, 15_000);
      pending.set(uid, { ...current, timer: retryTimer });
      current.onError?.(error);
    } else {
      queued?.onError?.(error);
    }
    throw error;
  }
}

/** Reenvia o último snapshot durável da conta após a autenticação/reconexão. */
export async function flushPendingAccountGameSave(uid: string): Promise<void> {
  const durable = await getPendingGameSave(uid);
  if (!durable) return;
  const current = pending.get(uid);
  if (!current || current.revision !== durable.revision) {
    const timer = current?.timer ?? window.setTimeout(() => {
      void flushAccountGameSave(uid).catch(() => undefined);
    }, 0);
    pending.set(uid, {
      ...durable,
      timer,
      persistPromise: Promise.resolve(),
    });
  }
  await flushAccountGameSave(uid);
}
