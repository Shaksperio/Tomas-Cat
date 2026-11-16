import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, browserPopupRedirectResolver, browserSessionPersistence, getAuth, indexedDBLocalPersistence, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

export const firebaseApp = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

function createAuth() {
  if (!firebaseApp) return null;
  try {
    // Cascata de persistência: evita sessão perdida em navegadores móveis/iframes
    // onde IndexedDB ou localStorage podem estar bloqueados.
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Auth já inicializado (hot reload): reutiliza a instância existente.
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = createAuth();
const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID as string | undefined;
export const firestore = firebaseApp
  ? (databaseId ? getFirestore(firebaseApp, databaseId) : getFirestore(firebaseApp))
  : null;
