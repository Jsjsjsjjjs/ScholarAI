import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, serverTimestamp, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
console.log("Firebase App Initialized with Project:", firebaseConfig.projectId, "DB:", firebaseConfig.firestoreDatabaseId);
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
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  try {
    await updateDoc(userRef, {
      aiRequests: increment(1),
      totalTokens: increment(tokenCount),
      lastAIActivity: serverTimestamp(),
      quotaExhausted: isError
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
  }
}

/**
 * Simulates a deep scan of AI Studio logs and Firestore events to recover missed token counts.
 * In a real app, this would query server-side logs.
 */
export async function syncEliteQuota() {
  const user = auth.currentUser;
  if (!user) return;
  
  const userRef = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(userRef);

    if (!snap.exists()) return;
    const data = snap.data();
    
    const updates: any = { lastQuotaScan: serverTimestamp() };
    if (!('aiRequests' in data)) updates.aiRequests = 0;
    if (!('totalTokens' in data)) updates.totalTokens = 0;
    
    await updateDoc(userRef, updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
  }
}

export async function updateProgress(subject: string, topic: string, type: 'notesRead' | 'quizTaken' | 'pyqsViewed') {
  const user = auth.currentUser;
  if (!user) return;

  const topicId = topic.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const progressRef = doc(db, "users", user.uid, "progress", topicId);
  
  try {
    const snap = await getDoc(progressRef);
    if (!snap.exists()) {
      await setDoc(progressRef, {
        subject,
        topic,
        notesRead: type === 'notesRead',
        quizTaken: type === 'quizTaken',
        pyqsViewed: type === 'pyqsViewed',
        lastActivity: serverTimestamp()
      });
    } else {
      await updateDoc(progressRef, {
        [type]: true,
        lastActivity: serverTimestamp()
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, progressRef.path);
  }
}

async function testConnection(retries = 3) {
  try {
    // We try to get a document that doesn't exist to test connectivity.
    // Even if it fails with 'permission-denied', it means we REACHED the server.
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('unavailable') || error.message.includes('the client is offline')) {
        if (retries > 0) {
          console.log(`Firebase connection retry ${4 - retries}...`);
          setTimeout(() => testConnection(retries - 1), 2000);
        } else {
          console.error("Firebase Connection Details:", {
            message: error.message,
            name: error.name,
            code: (error as any).code
          });
          console.error("Firebase Connection Error: Could not reach backend. Please check your project setup or wait a few moments.");
        }
      } else {
        // Any other error (like permission-denied) means we ARE connected.
        console.log("Firebase reached, connection active but returned error:", error.message);
      }
    }
  }
}

testConnection();

export { signInWithPopup, signOut, signInAnonymously, serverTimestamp };
