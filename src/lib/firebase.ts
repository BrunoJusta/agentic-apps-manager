import { initializeApp } from 'firebase/app'
import { getAuth, OAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const env = import.meta.env

// A configuração web do Firebase é pública por desenho. A proteção está nas firestore.rules.
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCRT_YgVXRuHg6yPOeY0hb8PpV5lQCLUnU',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'sogrape-ai-studio.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'sogrape-ai-studio',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'sogrape-ai-studio.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '782851902471',
  appId: env.VITE_FIREBASE_APP_ID || '1:782851902471:web:fc67b34677db0b38f52ea2',
}

export const DATABASE_ID = env.VITE_FIRESTORE_DATABASE_ID || 'agentic-apps-prod'

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
// Base de dados com nome (não é a "(default)"), por isso o ID é passado explicitamente.
export const db = getFirestore(firebaseApp, DATABASE_ID)

export function microsoftProvider() {
  const p = new OAuthProvider('microsoft.com')
  const tenant = env.VITE_MS_TENANT_ID
  p.setCustomParameters({
    prompt: 'select_account',
    ...(tenant ? { tenant } : {}),
    domain_hint: 'sogrape.pt',
  })
  p.addScope('email')
  p.addScope('profile')
  return p
}
