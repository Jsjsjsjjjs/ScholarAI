import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import {
  getFirestore as getClientFirestore,
  doc as fsDoc,
  getDoc as fsGetDoc,
  setDoc as fsSetDoc,
  deleteDoc as fsDeleteDoc,
  collection as fsCollection,
  getDocs as fsGetDocs,
  query as fsQuery,
  where as fsWhere,
  orderBy as fsOrderBy,
  limit as fsLimit,
  DocumentSnapshot,
  QuerySnapshot
} from 'firebase/firestore';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

let adapterInstance: any = null;

export class ClientDocumentReference {
  constructor(public colPath: string, public docId: string, public db: any) {}

  async get() {
    const dRef = fsDoc(this.db, this.colPath, this.docId);
    const snap = await fsGetDoc(dRef);
    return new ClientDocumentSnapshot(snap);
  }

  async set(data: any, options?: { merge?: boolean }) {
    const dRef = fsDoc(this.db, this.colPath, this.docId);
    await fsSetDoc(dRef, data, options || {});
  }

  async update(data: any) {
    const dRef = fsDoc(this.db, this.colPath, this.docId);
    await fsSetDoc(dRef, data, { merge: true });
  }

  async delete() {
    const dRef = fsDoc(this.db, this.colPath, this.docId);
    await fsDeleteDoc(dRef);
  }

  collection(subColPath: string) {
    return new ClientCollectionReference(`${this.colPath}/${this.docId}/${subColPath}`, this.db);
  }
}

export class ClientDocumentSnapshot {
  public exists: boolean;
  public id: string;
  public ref: ClientDocumentReference;
  private _data: any;

  constructor(snap: DocumentSnapshot) {
    this.exists = snap.exists();
    this.id = snap.id;
    this._data = snap.data();
    const parts = snap.ref.path.split('/');
    const docId = parts.pop() || '';
    const colPath = parts.join('/');
    this.ref = new ClientDocumentReference(colPath, docId, snap.ref.firestore);
  }

  data() {
    return this._data;
  }
}

export class ClientQuerySnapshot {
  public docs: ClientDocumentSnapshot[];
  public size: number;
  public empty: boolean;

  constructor(snaps: QuerySnapshot) {
    this.docs = snaps.docs.map(s => new ClientDocumentSnapshot(s));
    this.size = snaps.size;
    this.empty = snaps.empty;
  }

  forEach(callback: (doc: ClientDocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

export class ClientQuery {
  protected constraints: any[] = [];

  constructor(public colPath: string, public db: any) {}

  where(field: string, op: any, val: any) {
    const q = new ClientQuery(this.colPath, this.db);
    q.constraints = [...this.constraints, fsWhere(field, op, val)];
    return q;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    const q = new ClientQuery(this.colPath, this.db);
    q.constraints = [...this.constraints, fsOrderBy(field, direction)];
    return q;
  }

  limit(num: number) {
    const q = new ClientQuery(this.colPath, this.db);
    q.constraints = [...this.constraints, fsLimit(num)];
    return q;
  }

  async get() {
    const cRef = fsCollection(this.db, this.colPath);
    const q = fsQuery(cRef, ...this.constraints);
    const snap = await fsGetDocs(q);
    return new ClientQuerySnapshot(snap);
  }
}

export class ClientCollectionReference extends ClientQuery {
  constructor(colPath: string, db: any) {
    super(colPath, db);
  }

  doc(docId?: string) {
    const id = docId || fsDoc(fsCollection(this.db, this.colPath)).id;
    return new ClientDocumentReference(this.colPath, id, this.db);
  }
}

export class AdminFirestoreAdapter {
  constructor(public db: any) {}

  collection(colPath: string) {
    return new ClientCollectionReference(colPath, this.db);
  }
}

export function getDb(): any {
  if (adapterInstance) {
    return adapterInstance;
  }

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    let clientApp;
    if (getClientApps().length === 0) {
      clientApp = initClientApp(firebaseConfig);
    } else {
      clientApp = getClientApps()[0];
    }

    const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
    adapterInstance = new AdminFirestoreAdapter(clientDb);
    console.log('[Firestore] Successfully initialized client-side SDK Firebase adapter.');
    return adapterInstance;
  } catch (error) {
    console.error('[Firestore] Failed to initialize client-side Firestore connection adapter:', error);
    throw error;
  }
}

/**
 * Wraps a promise with a timeout. If the promise does not resolve within the timeout Ms,
 * it rejects with a timeout error.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string = 'Operation'): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`[Timeout] ${operationName} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

/**
 * Robustly fetches a Firestore document with a built-in timeout and try/catch logging.
 * Integrates direct check and robust Discord username / avatar scanning to correctly link Discord IDs.
 */
export async function fetchDocSafe(collectionPath: string, docId: string, timeoutMs: number = 5000) {
  try {
    const db = getDb();

    // Check discord_links mapping first
    let explicitUid = null;
    if (collectionPath === "users" && /^\d{17,20}$/.test(docId)) {
      try {
        const linkSnap = await withTimeout(db.collection("discord_links").doc(docId).get(), timeoutMs, `Firestore GET discord_links/${docId}`) as any;
        if (linkSnap.exists) {
          explicitUid = linkSnap.data().scholarId;
        }
      } catch (e) {
        console.warn(`[fetchDocSafe] Could not fetch discord link for ${docId}:`, e);
      }
    }

    const finalUID = explicitUid || docId;
    const docRef = db.collection(collectionPath).doc(finalUID);
    const snap = (await withTimeout(docRef.get(), timeoutMs, `Firestore GET ${collectionPath}/${finalUID}`)) as any;
    
    if (snap.exists) {
      const data = snap.data();
      if (collectionPath === "users" && docId === "1231538210140721183") {
        data.role = "owner";
      }
      return { data: { ...data, uid: snap.id }, exists: true, error: null };
    }

    // Special fallback resolving for Discord Bot logins and permissions checking
    if (collectionPath === "users") {
      let mainProfileId = "8urQsWaHwmNJAyGrG6SCAo1CDmF2"; // default old UID
      const usersSnap = (await withTimeout(
        db.collection("users").get(),
        timeoutMs,
        "Firestore LIST users fallback"
      )) as any;

      if (usersSnap && usersSnap.docs) {
         for (const d of usersSnap.docs) {
             if (d.data().email === "arunwarrior98789@gmail.com") {
                 mainProfileId = d.id;
                 break;
             }
         }
      }

      // Hardcoded Owner/Lead Developer bypass check first so it can't be hijacked by duplicate usernames/IDs
      if (docId === "pacifictheog" || docId === "1231538210140721183" || docId === mainProfileId) {
        const ownerSnap = await db.collection("users").doc(mainProfileId).get();
        if (ownerSnap.exists) {
          console.log(`[Firestore Match Builder] Bypassed matching; explicitly resolved lead developer:`, ownerSnap.id);
          const ownerData = ownerSnap.data();
          if (docId === "1231538210140721183") ownerData.role = "owner";
          return { data: { ...ownerData, uid: ownerSnap.id }, exists: true, error: null };
        }
      }

      // If they passed a valid discord numeric ID but no link was found, default to main profile
      if (/^\d{17,20}$/.test(docId)) {
        const ownerSnap = await db.collection("users").doc(mainProfileId).get();
        if (ownerSnap.exists) {
           console.log(`[Firestore Match Builder] Defaulting to main profile for unlinked Discord ID: ${docId}`);
           const data = ownerSnap.data();
           if (docId === "1231538210140721183") data.role = "owner";
           return { data: { ...data, uid: ownerSnap.id }, exists: true, error: null };
        }
      }

      let matchedUserDoc: any = null;

      usersSnap.forEach((userDoc: any) => {
        const uData = userDoc.data();
        let isMatch = false;
        
        // Match condition 1: Does the document ID match?
        if (userDoc.id === docId) {
          isMatch = true;
        }

        // Match condition 2: Does discordUsername match?
        const discordUser = uData.discordUsername || "";
        if (discordUser.toLowerCase().replace(/^@/, '') === docId.toLowerCase().replace(/^@/, '')) {
          isMatch = true;
        }

        // Match condition 3: Does discordAvatar or discordWebhookUrl contain the Discord user ID?
        if (docId.match(/^\d+$/)) {
          if (uData.discordAvatar && uData.discordAvatar.includes(docId)) {
            isMatch = true;
          }
          if (uData.discordWebhookUrl && uData.discordWebhookUrl.includes(docId)) {
            isMatch = true;
          }
        }

        if (isMatch) {
          if (!matchedUserDoc) {
            matchedUserDoc = { ...uData, uid: userDoc.id };
          } else {
            // Prioritize higher tier roles (owner > admin > developer > user)
            const oldRole = matchedUserDoc.role || "user";
            const newRole = uData.role || "user";
            const priority: Record<string, number> = { "user": 0, "developer": 1, "admin": 2, "owner": 3 };
            if ((priority[newRole] ?? 0) > (priority[oldRole] ?? 0)) {
              matchedUserDoc = { ...uData, uid: userDoc.id };
            }
          }
        }
      });

      if (matchedUserDoc) {
        if (docId === "1231538210140721183") matchedUserDoc.role = "owner";
        console.log(`[Firestore Match Builder] Resolved Discord ID/Username ${docId} to database record:`, matchedUserDoc.email || matchedUserDoc.uid, `(Role: ${matchedUserDoc.role || "user"})`);
        return { data: matchedUserDoc, exists: true, error: null };
      }
    }

    return { data: null, exists: false, error: null };
  } catch (error: any) {
    console.error(`[Firestore Safe Fetch Error] Failed fetching ${collectionPath}/${docId}:`, error.message);
    return { data: null, exists: false, error: error.message };
  }
}
