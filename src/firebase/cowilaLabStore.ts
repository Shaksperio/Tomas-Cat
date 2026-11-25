import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './client';

export interface CowilaLabCloudRecord {
  schemaVersion: 1;
  ownerUid: string;
  messages: unknown[];
  instructions: string;
  updatedAt: number;
}

function sessionDocument(uid: string) {
  if (!firestore) throw new Error('Firebase Firestore não está configurado.');
  return doc(firestore, 'users', uid, 'cowilaLab', 'current');
}

export async function loadCowilaLabRecord(uid: string): Promise<CowilaLabCloudRecord | null> {
  const snapshot = await getDoc(sessionDocument(uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Partial<CowilaLabCloudRecord>;
  if (data.ownerUid !== uid || data.schemaVersion !== 1 || !Array.isArray(data.messages)
    || typeof data.instructions !== 'string' || typeof data.updatedAt !== 'number') {
    throw new Error('Registro remoto do Laboratório da Cowila inválido.');
  }
  return data as CowilaLabCloudRecord;
}

export async function saveCowilaLabRecord(
  uid: string,
  record: Omit<CowilaLabCloudRecord, 'ownerUid' | 'schemaVersion'>,
): Promise<void> {
  const payload: CowilaLabCloudRecord = {
    schemaVersion: 1,
    ownerUid: uid,
    ...record,
  };
  if (JSON.stringify(payload).length > 800_000) {
    throw new Error('O histórico do Laboratório excedeu o limite seguro. Exporte e inicie uma nova sessão.');
  }
  await setDoc(sessionDocument(uid), payload);
}
