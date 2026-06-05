import { getDb } from '../src/bot/utils/firestore';

async function main() {
  console.log("Starting DB clean-up for pacifictheog...");
  try {
    const db = getDb();
    const statsRef = db.collection('stats').doc('pacifictheog');
    const userRef = db.collection('users').doc('pacifictheog');

    const statsSnap = await statsRef.get();
    if (statsSnap.exists) {
      console.log("Current stats for pacifictheog:", statsSnap.data());
      await statsRef.set({
        userId: 'pacifictheog',
        nickname: 'pacifictheog',
        quizCorrect: 0,
        totalAttempted: 0,
        accuracy: 0.0,
        timeSpent: 0,
        lastUpdated: new Date()
      }, { merge: false });
      console.log("Successfully clean-reset stats in DB for pacifictheog.");
    } else {
      console.log("No stats document found for pacifictheog.");
    }

    const userSnap = await userRef.get();
    if (userSnap.exists) {
      console.log("Current user config for pacifictheog:", userSnap.data());
      await userRef.set({
        aiRequests: 0,
        totalTokens: 0,
        quotaExhausted: false,
        limit: 20
      }, { merge: true });
      console.log("Successfully clean-reset user document inside Firestore.");
    } else {
      console.log("No user document found for pacifictheog.");
    }

    console.log("Pruning and syncing progress collections is complete.");
  } catch (err) {
    console.error("Cleanup script error:", err);
  }
}

main();
