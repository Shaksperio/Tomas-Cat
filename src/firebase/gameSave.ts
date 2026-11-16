import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { SavedGameState } from '../types/game';
import { firestore } from './client';

const pending = new Map<string, { payload: SavedGameState; timer: number; onError?: (error: unknown) => void; onSaved?: () => void }>();

function saveDocument(uid: string) {
  if (!firestore) throw new Error('Firebase Firestore não está configurado.');
  return doc(firestore, 'users', uid, 'gameSaves', 'main');
}

export async function loadAccountGameSave(uid: string): Promise<SavedGameState | null> {
  const snapshot = await getDoc(saveDocument(uid));
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

export function queueAccountGameSave(
  uid: string,
  payload: SavedGameState,
  onSaved?: () => void,
  onError?: (error: unknown) => void,
): void {
  const previous = pending.get(uid);
  if (previous) {
    // Keep only the latest snapshot, but retain the first timer to throttle
    // the engine's six-second autosave cadence into a cloud write every ~15s.
    previous.payload = payload;
    previous.onSaved = onSaved;
    previous.onError = onError;
    return;
  }
  const timer = window.setTimeout(() => {
    void flushAccountGameSave(uid).catch(onError);
  }, 15_000);
  pending.set(uid, { payload, timer, onSaved, onError });
}

export async function flushAccountGameSave(uid: string): Promise<void> {
  const queued = pending.get(uid);
  if (!queued) return;
  window.clearTimeout(queued.timer);
  pending.delete(uid);
  await saveAccountGameSave(uid, queued.payload);
  queued.onSaved?.();
}
