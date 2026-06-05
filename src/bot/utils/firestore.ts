import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

let adapterInstance: admin.firestore.Firestore | null = null;

export function getDb(): admin.firestore.Firestore {
  if (adapterInstance) {
    return adapterInstance;
  }

  try {
    if (admin.apps.length === 0) {
      const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        
        if (serviceAccount.private_key && serviceAccount.private_key.includes("YOUR_PRIVATE_KEY_HERE")) {
          console.warn('[Firestore] Detected placeholder dummy credentials in service-account.json. Using default authentication fallback.');
          admin.initializeApp({ projectId: 'netflix-fix' });
        } else {
          try {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: 'netflix-fix'
            });
            console.log('[Firestore] Initialized firebase-admin with service-account.json');
          } catch (certError: any) {
            console.warn('[Firestore] Ignored invalid certificate formatting, falling back to defaults:', certError.message);
            try { admin.initializeApp({ projectId: 'netflix-fix' }); } catch (e) {}
          }
        }
      } else {
        admin.initializeApp({ projectId: 'netflix-fix' });
        console.log('[Firestore] Initialized firebase-admin with default credentials');
      }
    }

    const configFile = path.resolve(process.cwd(), 'firebase-applet-config.json');
    let dbId = '(default)';
    if (fs.existsSync(configFile)) {
      try {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        if (config.firestoreDatabaseId) dbId = config.firestoreDatabaseId;
      } catch(e) {}
    }

    adapterInstance = getFirestore(admin.app(), dbId);
    return adapterInstance;
  } catch (error) {
    console.error('[Firestore] Failed to initialize firebase-admin connection:', error);
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

    const docRef = db.collection(collectionPath).doc(docId);
    const snap = (await withTimeout(docRef.get(), timeoutMs, `Firestore GET ${collectionPath}/${docId}`)) as any;
    
    if (snap.exists) {
      return { data: snap.data(), exists: true, error: null };
    }

    // Special fallback resolving for Discord Bot logins and permissions checking
    if (collectionPath === "users") {
      // Legacy bypass removed, handled above
      const usersSnap = (await withTimeout(
        db.collection("users").get(),
        timeoutMs,
        "Firestore LIST users fallback"
      )) as any;

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

/**
 * Resolves a user's Scholar ID (document ID in the users collection) from a Discord interaction's user info,
 * or from an explicitly passed scholar_id string parameter.
 */
export async function resolveScholarId(discordUser: any, inputScholarId?: string | null): Promise<{ scholarId: string | null; userData: any | null }> {
  try {
    const db = getDb();
    
    // 1. If an explicit Scholar ID was entered, we look up that exact document id in the users collection.
    if (inputScholarId && inputScholarId.trim().length > 0) {
      const cleanId = inputScholarId.trim();
      
      const snap = await db.collection("users").doc(cleanId).get();
      if (snap.exists) {
        return { scholarId: cleanId, userData: { ...snap.data(), uid: cleanId } };
      }
      // Attempt to search users if inputScholarId matches discord username field
      const usersSnap = await db.collection("users").get();
      let foundId: string | null = null;
      let foundData: any = null;
      usersSnap.forEach((doc: any) => {
        const data = doc.data();
        const discUser = data.discordUsername || "";
        if (discUser.toLowerCase().replace(/^@/, '') === cleanId.toLowerCase().replace(/^@/, '')) {
          foundId = doc.id;
          foundData = { ...data, uid: doc.id };
        }
      });

      if (foundId) {
        return { scholarId: foundId, userData: foundData };
      }

      // Default return input if it couldn't be matched
      return { scholarId: cleanId, userData: null };
    }

    // 2. Look up by Discord User ID or Username
    const docId = discordUser.id;
    const username = discordUser.username || "";
    const tag = discordUser.tag || "";

    // Check direct docId first
    const directSnap = await db.collection("users").doc(docId).get();
    if (directSnap.exists) {
      return { scholarId: docId, userData: { ...directSnap.data(), uid: docId } };
    }

    // Query and scan fallback
    const usersSnap = await db.collection("users").get();
    let foundId: string | null = null;
    let foundData: any = null;

    usersSnap.forEach((userDoc: any) => {
      const uData = userDoc.data();
      let isMatch = false;

      if (userDoc.id === docId) {
        isMatch = true;
      }

      const discordUserStr = uData.discordUsername || "";
      if (discordUserStr.toLowerCase().replace(/^@/, '') === username.toLowerCase() || 
          discordUserStr.toLowerCase().replace(/^@/, '') === tag.toLowerCase()) {
        isMatch = true;
      }

      if (uData.discordName && uData.discordName.toLowerCase() === tag.toLowerCase()) {
        isMatch = true;
      }

      if (docId.match(/^\d+$/)) {
        if (uData.discordAvatar && uData.discordAvatar.includes(docId)) {
          isMatch = true;
        }
        if (uData.discordWebhookUrl && uData.discordWebhookUrl.includes(docId)) {
          isMatch = true;
        }
      }

      if (isMatch) {
        if (!foundId) {
          foundId = userDoc.id;
          foundData = { ...uData, uid: userDoc.id };
        } else {
          // Prioritize roles
          const oldRole = foundData.role || "user";
          const newRole = uData.role || "user";
          const priority: Record<string, number> = { "user": 0, "developer": 1, "admin": 2, "owner": 3 };
          if ((priority[newRole] ?? 0) > (priority[oldRole] ?? 0)) {
            foundId = userDoc.id;
            foundData = { ...uData, uid: userDoc.id };
          }
        }
      }
    });

    return { scholarId: foundId, userData: foundData };
  } catch (err) {
    console.error("[resolveScholarId Error]", err);
    return { scholarId: null, userData: null };
  }
}
