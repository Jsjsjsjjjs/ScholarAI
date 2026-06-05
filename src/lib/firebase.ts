import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, serverTimestamp, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { dbMirror } from './supabase';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function trackAIUsage(tokenCount: number = 100, isError: boolean = false) {
  const scholarSessionId = localStorage.getItem("scholar_session_id");
  const activeUid = scholarSessionId || auth.currentUser?.uid;
  if (!activeUid) return;

  const userRef = doc(db, "users", activeUid);
  try {
    await setDoc(userRef, {
      aiRequests: increment(1),
      totalTokens: increment(tokenCount),
      lastAIActivity: serverTimestamp(),
      quotaExhausted: isError
    }, { merge: true });

    // Sync state to Supabase
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      dbMirror.mirrorUserUpdate(activeUid, snap.data()).catch(console.error);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${activeUid}`);
  }
}

/**
 * Simulates a deep scan of AI Studio logs and Firestore events to recover missed token counts.
 * In a real app, this would query server-side logs.
 */
export async function syncEliteQuota() {
  const scholarSessionId = localStorage.getItem("scholar_session_id");
  const activeUid = scholarSessionId || auth.currentUser?.uid;
  if (!activeUid) return;
  
  const userRef = doc(db, "users", activeUid);
  try {
    const snap = await getDoc(userRef);

    if (!snap.exists()) return;
    const data = snap.data();
    
    const updates: any = { lastQuotaScan: serverTimestamp() };
    if (!('aiRequests' in data)) updates.aiRequests = 0;
    if (!('totalTokens' in data)) updates.totalTokens = 0;
    
    await setDoc(userRef, updates, { merge: true });

    // Sync to Supabase
    const updatedSnap = await getDoc(userRef);
    if (updatedSnap.exists()) {
      dbMirror.mirrorUserUpdate(activeUid, updatedSnap.data()).catch(console.error);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${activeUid}`);
  }
}

export async function updateProgress(subject: string, topic: string, type: 'notesRead' | 'quizTaken' | 'pyqsViewed') {
  const scholarSessionId = localStorage.getItem("scholar_session_id");
  const activeUid = scholarSessionId || auth.currentUser?.uid;
  if (!activeUid) return;

  const topicId = topic.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const progressRef = doc(db, "users", activeUid, "progress", topicId);
  
  try {
    const snap = await getDoc(progressRef);
    let progressData: any;
    if (!snap.exists()) {
      progressData = {
        subject,
        topic,
        notesRead: type === 'notesRead',
        quizTaken: type === 'quizTaken',
        pyqsViewed: type === 'pyqsViewed',
        lastActivity: serverTimestamp()
      };
      await setDoc(progressRef, progressData);
    } else {
      const existingData = snap.data() || {};
      progressData = {
        ...existingData,
        [type]: true,
        lastActivity: serverTimestamp()
      };
      await updateDoc(progressRef, {
        [type]: true,
        lastActivity: serverTimestamp()
      });
    }

    // Mirror to Supabase!
    dbMirror.mirrorProgressUpdate(activeUid, topicId, {
      subject,
      topic,
      notesRead: progressData.notesRead ?? false,
      quizTaken: progressData.quizData ?? false, // fallbacks
      pyqsViewed: progressData.pyqsViewed ?? false,
      [type]: true // ensure active field is set
    }).catch(console.error);

  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, progressRef.path);
  }
}

async function testConnection() {
  try {
    // We try to get a document that doesn't exist to test connectivity.
    // Even if it fails with 'permission-denied', it means we REACHED the server.
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('unavailable') || error.message.includes('the client is offline')) {
        console.error("Firebase Connection Error: Could not reach backend. Please check your project setup or wait a few moments.");
      } else {
        // Any other error (like permission-denied) means we ARE connected.
        console.log("Firebase reached, connection active.");
      }
    }
  }
}

testConnection();

export { signInWithPopup, signOut, signInAnonymously, serverTimestamp };
