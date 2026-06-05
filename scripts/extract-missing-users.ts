import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * Supabase GoTrue Auth Bulk User Import representation.
 * Supports firebase_scrypt password hashing migration.
 */
interface SupabaseImportPayload {
  algorithm: string;
  hash_config: {
    signer_key: string;       // Placed here as placeholder to populate from Firebase console
    salt_separator: string;   // Placed here as placeholder to populate from Firebase console
    rounds: number;
    mem_cost: number;
  };
  users: Array<{
    id: string; // Will hold standard UID. If Firebase UIDs are Uuids, or deterministic UUIDv5
    email: string;
    email_confirmed_at: string;
    created_at: string;
    password_hash?: string;
    salt?: string;
    user_metadata: any;
    app_metadata: any;
  }>;
}

async function runExporter() {
  console.log("📥 Starting ScholarAI User & Password Hash Structural Extractor...");

  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ Error: service-account.json is missing in the workspace root.");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  if (serviceAccount.private_key && serviceAccount.private_key.includes("YOUR_PRIVATE_KEY_HERE")) {
    console.warn("⚠️ Warning: service-account.json detected placeholder credentials.");
    console.warn("Please make sure to supply real credentials downloaded from Project Settings > Service Accounts.");
  }

  // Retrieve client database config
  const configFile = path.resolve(process.cwd(), 'firebase-applet-config.json');
  let dbId = '(default)';
  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (config.firestoreDatabaseId) dbId = config.firestoreDatabaseId;
    } catch (e) {
      // safe fallback
    }
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'netflix-fix'
    });
    console.log("✅ firebase-admin initialized with certificate credentials.");
  } catch (err: any) {
    console.error("❌ Failed to initialize firebase-admin:", err.message);
    process.exit(1);
  }

  const db = getFirestore(admin.app(), dbId);
  const auth = admin.auth();

  const exportPayload: SupabaseImportPayload = {
    algorithm: "firebase_scrypt",
    hash_config: {
      signer_key: "PASTE_YOUR_FIREBASE_BASE64_SIGNER_KEY_HERE",
      salt_separator: "PASTE_YOUR_FIREBASE_BASE64_SALT_SEPARATOR_HERE",
      rounds: 8,
      mem_cost: 14
    },
    users: []
  };

  try {
    console.log("📥 Loading accounts from Firebase Authentication...");
    const authUsers: admin.auth.UserRecord[] = [];
    let nextPageToken: string | undefined = undefined;

    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      authUsers.push(...listUsersResult.users);
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`📊 Found ${authUsers.length} user record(s) in Firebase Authentication.`);

    console.log("📥 Mapping corresponding User Profile documents from Cloud Firestore...");
    const firestoreUsersMap = new Map<string, any>();
    
    try {
      const fUsersSnap = await db.collection("users").get();
      fUsersSnap.forEach(doc => {
        firestoreUsersMap.set(doc.id, doc.data());
      });
      console.log(`📊 Loaded ${firestoreUsersMap.size} user profile(s) from Firestore.`);
    } catch (fsErr: any) {
      console.warn("⚠️ Warning: Could not download Firestore profiles (Permission Denied). Proceeding with Auth records only.", fsErr.message);
    }

    for (const authUser of authUsers) {
      const uid = authUser.uid;
      const fProfile = firestoreUsersMap.get(uid) || {};

      // Structure metadata blocks
      const nickname = fProfile.nickname || authUser.displayName || `Scholar-${uid.slice(0, 4)}`;
      const plan = fProfile.plan || "free";
      const role = fProfile.role || "user";

      // Keep user_metadata synchronized for Supabase identity handling
      const userMetadataObj = {
        nickname,
        role,
        plan,
        avatar_url: authUser.photoURL || fProfile.discordAvatar || null,
        discord_username: fProfile.discordUsername || null
      };

      const appMetadataObj = {
        provider: authUser.providerData[0]?.providerId || "email",
        providers: authUser.providerData.map(p => p.providerId)
      };

      // Construct compliant auth.users payload item
      exportPayload.users.push({
        id: uid, // GoTrue uses standard UUIDs. If Firebase UID matches standard string formats, map directly or deterministic mapping 
        email: authUser.email || `${uid}@scholarai.app`,
        email_confirmed_at: authUser.emailVerified ? new Date().toISOString() : new Date(authUser.metadata.creationTime).toISOString(),
        created_at: new Date(authUser.metadata.creationTime).toISOString(),
        password_hash: authUser.passwordHash || undefined,
        salt: authUser.passwordSalt || undefined,
        user_metadata: userMetadataObj,
        app_metadata: appMetadataObj
      });
    }

    const outputPath = path.resolve(process.cwd(), 'supabase-auth-import.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportPayload, null, 2), 'utf8');

    console.log("\n🎉 Step 1 Complete! Extraction finished successfully.");
    console.log(`📥 Extracted items saved to path: ${outputPath}`);
    console.log(`⚠️  Next Action: To complete migration to Supabase Auth:`);
    console.log("   1. Obtain your Hash Signer Key and Salt Separator from Firebase Console > Authentication > Users > Export Users.");
    console.log("   2. Update 'hash_config' in 'supabase-auth-import.json' with those values.");
    console.log("   3. Import into Supabase using Supabase CLI or GoTrue Import tools.");

  } catch (err: any) {
    console.error("❌ Critical Failure during extraction runner:", err);
  }
}

runExporter();
