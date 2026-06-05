/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, signInWithPopup, googleProvider, signOut, db, serverTimestamp, handleFirestoreError, OperationType } from "./lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, collection, query, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, 
  BrainCircuit, 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  MessageSquare, 
  LogOut, 
  Sun, 
  Moon,
  Search,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Loader2,
  Gamepad2,
  Bell,
  Terminal,
  LifeBuoy
} from "lucide-react";

import { cn } from "./lib/utils";
import Auth from "./components/Auth";
import { saveNotesToCache, saveQuizToCache, saveFlashcardsToCache, saveImpsToCache } from "./lib/offlineCache";
import { dbService, getActiveDB, setActiveDB } from "./lib/dbService";
import { getSupabase } from "./lib/supabase";

// Helper function to resolve infinite loading state during database switch
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    )
  ]);
}

// Lazy load components for performance optimization
import Dashboard from "./components/Dashboard";
const StudyGuide = lazy(() => import("./components/StudyGuide"));
const QuizSection = lazy(() => import("./components/QuizSection"));
const ImportantQuestions = lazy(() => import("./components/ImportantQuestions"));
const Settings = lazy(() => import("./components/Settings"));
const DoubtSolver = lazy(() => import("./components/DoubtSolver"));
const TicTacToe = lazy(() => import("./components/TicTacToe"));
const StudyReminders = lazy(() => import("./components/StudyReminders"));
const DeveloperPage = lazy(() => import("./components/DeveloperPage"));
const TicketSystem = lazy(() => import("./components/TicketSystem"));

const ModuleLoader = () => (
  <div className="w-full py-20 flex flex-col items-center justify-center gap-4">
    <div className="relative">
      <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full animate-pulse"></div>
      <Loader2 size={40} className="text-orange-500 animate-spin relative z-10" />
    </div>
    <p className="text-neutral-500 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Optimizing Module...</p>
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [notification, setNotification] = useState<{ title: string; body: string } | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [dbTrigger, setDbTrigger] = useState(0);

  const handleSignOut = async () => {
    localStorage.removeItem("scholar_session_id");
    await signOut(auth);
  };

  useEffect(() => {
    // Sync live system config from database
    const unsubConfig = onSnapshot(doc(db, "system", "config"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMaintenanceMode(data.maintenanceMode || false);
        setLogoUrl(data.logoUrl || "");

        // Universal Routing Dynamic Switch & Switch Propagation
        const liveDb = data.activeDatabase || "firestore";
        const currentActiveDb = getActiveDB();
        if (liveDb !== currentActiveDb) {
          console.log(`[Universal Router] Propagating active DB switch from '${currentActiveDb}' to '${liveDb}' in real-time.`);
          setActiveDB(liveDb);

          setNotification({
            title: "Database Relocated ⚠️",
            body: `The active datastore was re-routed globally to ${
              liveDb === "firestore" ? "Cloud Firestore (NoSQL)" : "Supabase PostgreSQL (Relation)"
            }. Re-hydrating context.`
          });

          // Perform gentle teardown/reinitialization without freezing interface
          setUserData(null);
          setDbTrigger(prev => prev + 1);
        }
      }
    }, (err) => {
      // System config snapshot failed; using local fallback logic
    });
    return () => unsubConfig();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (!user) {
        setUserData(null);
        setError(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  }, [darkMode]);

  useEffect(() => {
    if (!user) return;

    let isCurrent = true;
    let unsubUserDoc: (() => void) | undefined;
    let unsubStatsDoc: (() => void) | undefined;
    let unsubOfflineSync: (() => void) | undefined;

    async function initUser() {
      if (!user) return;
      setLoading(true);
      setError(null);

      const scholarSessionId = localStorage.getItem("scholar_session_id");
      const effectiveUid = scholarSessionId || user.uid;

      if (getActiveDB() === "supabase") {
        try {
          // background auto-login to Supabase Auth to establish correct RLS security context
          const supabase = getSupabase();
          if (supabase) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                const email = user.email || `${effectiveUid}@scholarai.app`;
                const password = user.email ? `google_auth_${user.uid}` : `scholar_${effectiveUid}`;
                console.log("[Auth Engine - Router Sync] Autologging into Supabase Auth to establish security context.");
                
                let { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
                if (signInErr && signInErr.message.includes("Invalid login credentials")) {
                  // Attempt registration if not present in Auth.users
                  const { error: signUpErr } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                      data: {
                        nickname: user.displayName || `Scholar-${effectiveUid.slice(0, 4)}`,
                        role: (user.email && user.email.toLowerCase().trim() === "arunwarrior98789@gmail.com") ? "owner" : "user"
                      }
                    }
                  });
                  if (!signUpErr) {
                    await supabase.auth.signInWithPassword({ email, password });
                  }
                }
              }
            } catch (authSessionErr: any) {
              console.warn("[Auth Engine - Router Sync Warning] Supabase background authentication issue:", authSessionErr.message);
            }
          }

          // Wrapped in a 5-second connection/query timeout to prevent infinite UI loading states
          let sUser = await withTimeout(
            dbService.getUser(effectiveUid),
            5000,
            "Supabase connection/user query timed out."
          );

          let sStats = await withTimeout(
            dbService.getStats(effectiveUid),
            5000,
            "Supabase connection/stats query timed out."
          );

          if (!sUser) {
            // First time initialization in Supabase
            const sUserPayload = {
              uid: effectiveUid,
              nickname: user.displayName || `Scholar-${Math.floor(1000 + Math.random() * 9000)}`,
              email: user.email || "anonymous@scholarai.app",
              role: (user.email && user.email.toLowerCase().trim() === "arunwarrior98789@gmail.com") ? "owner" : "user",
              plan: "free",
              aiRequests: 0,
              limit: 20,
              totalTokens: 0,
              quotaExhausted: false,
              colorMode: "dark",
              joinedAt: new Date()
            };
            await withTimeout(
              dbService.saveUser(effectiveUid, sUserPayload),
              5000,
              "Supabase save user operation timed out."
            );
            sUser = { ...sUserPayload } as any;
          }

          // If current admin checks owner promotion
          if (user.email && user.email.toLowerCase().trim() === "arunwarrior98789@gmail.com" && sUser && sUser.role !== "owner") {
            sUser.role = "owner";
            await withTimeout(
              dbService.saveUser(effectiveUid, { role: "owner" }),
              5000,
              "Supabase update role operation timed out."
            );
          }

          if (!sStats) {
            const sStatsPayload = {
              userId: effectiveUid,
              nickname: sUser?.nickname || "Anonymous Scholar",
              quizCorrect: 0,
              totalAttempted: 0,
              accuracy: 0.0,
              timeSpent: 0
            };
            await withTimeout(
              dbService.saveStats(effectiveUid, sStatsPayload),
              5000,
              "Supabase save stats operation timed out."
            );
            sStats = { ...sStatsPayload };
          }

          if (!isCurrent) return;
          setUserData({
            ...sUser,
            ...sStats,
            uid: effectiveUid
          });
          setDarkMode(sUser.colorMode === "dark" || (sUser as any).color_mode === "dark");
          setLoading(false);
          return;
        } catch (supInitErr: any) {
          console.warn("Failed initializing user in Supabase mode, falling back to Firestore flow:", supInitErr);
          setNotification({
            title: "Database Failover ⚠️",
            body: `Supabase database timed out or failed to connect (${supInitErr.message || "Timeout"}). Reverting safely to Cloud Firestore flow.`
          });
          setActiveDB("firestore"); // Fallback to firestore as required by failover specs
        }
      }

      const userDocRef = doc(db, "users", effectiveUid);
      try {
        const userDoc = await getDoc(userDocRef);
        
        if (!isCurrent) return;

        if (!userDoc.exists()) {
          // If a scholarSessionId was set, but doesn't exist in DB (shouldn't happen because of verification, but as fallback):
          if (scholarSessionId) {
            localStorage.removeItem("scholar_session_id");
            window.location.reload();
            return;
          }

          const newData: any = {
            uid: user.uid,
            nickname: user.displayName || `Scholar-${Math.floor(1000 + Math.random() * 9000)}`,
            email: user.email || "anonymous@scholarai.app",
            limit: 20,
            joinedAt: serverTimestamp(),
            colorMode: "dark"
          };

          if (user.email && user.email.toLowerCase().trim() === "arunwarrior98789@gmail.com") {
            newData.role = "owner";
          }

          try {
            await setDoc(userDocRef, newData);
            
            await setDoc(doc(db, "stats", effectiveUid), {
              userId: effectiveUid,
              nickname: newData.nickname,
              quizCorrect: 0,
              totalAttempted: 0,
              accuracy: 0.0,
              timeSpent: 0,
              lastUpdated: serverTimestamp()
            });
          } catch (createErr) {
            handleFirestoreError(createErr, OperationType.WRITE, "initial user/stats creation");
          }
        } else {
          // Check if existing user needs promotion
          const data = userDoc.data();
          if (user.email && user.email.toLowerCase().trim() === "arunwarrior98789@gmail.com" && data?.role !== "owner") {
            try {
              await setDoc(userDocRef, { role: "owner" }, { merge: true });
            } catch (updateErr) {
              console.error("Failed to promote owner:", updateErr);
              handleFirestoreError(updateErr, OperationType.UPDATE, userDocRef.path);
            }
          }
        }

        if (!isCurrent) return;

        unsubUserDoc = onSnapshot(userDocRef, (docSnap) => {
          if (!isCurrent) return;
          if (docSnap.exists()) {
            const newData = docSnap.data();
            setUserData((prev: any) => {
              const current = prev || {};
              let hasChanges = false;
              for (const key in newData) {
                if (JSON.stringify(current[key]) !== JSON.stringify(newData[key])) {
                  hasChanges = true;
                  break;
                }
              }
              if (!hasChanges && current.uid === effectiveUid) return current;
              return { ...current, ...newData, uid: effectiveUid };
            });
            if (docSnap.data()?.colorMode) {
              setDarkMode(docSnap.data().colorMode === "dark");
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, userDocRef.path);
        });

        unsubStatsDoc = onSnapshot(doc(db, "stats", effectiveUid), (docSnap) => {
          if (!isCurrent) return;
          if (docSnap.exists()) {
            const newData = docSnap.data();

            // Auto-clean historical dummy numbers on sandbox load to ensure perfect "fresh clean" start
            if (newData.quizCorrect === 500 && newData.timeSpent === 9999) {
              const userRef = doc(db, "users", effectiveUid);
              const statsRef = doc(db, "stats", effectiveUid);
              const statsReset = {
                quizCorrect: 0,
                totalAttempted: 0,
                accuracy: 0.0,
                timeSpent: 0
              };
              const userReset = {
                aiRequests: 0,
                totalTokens: 0,
                quotaExhausted: false
              };
              setDoc(statsRef, statsReset, { merge: true }).catch(console.error);
              setDoc(userRef, userReset, { merge: true }).catch(console.error);
              return;
            }

            setUserData((prev: any) => {
              const current = prev || {};
              let hasChanges = false;
              for (const key in newData) {
                if (JSON.stringify(current[key]) !== JSON.stringify(newData[key])) {
                  hasChanges = true;
                  break;
                }
              }
              if (!hasChanges && current.uid === effectiveUid) return current;
              return { ...current, ...newData, uid: effectiveUid };
            });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `stats/${effectiveUid}`);
        });

        // 3. Realtime listening for elements generated by the Discord bot to sync to local web storage 
        const offlineSyncColRef = collection(db, "users", effectiveUid, "offline_sync");
        unsubOfflineSync = onSnapshot(offlineSyncColRef, (snapshot) => {
          if (!isCurrent) return;
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              const item = change.doc.data();
              const assetType = item.type || "";
              const subject = item.subject || "";
              const topic = item.topic || "";
              const content = item.content || "";
              
              if (!subject || !topic) return;

              let hasSynced = false;

              if (assetType === "notes") {
                saveNotesToCache(subject, topic, item.notesType || "one-page", content);
                hasSynced = true;
              } else if (assetType === "quiz") {
                const questions = item.questions || item.items || [];
                saveQuizToCache(subject, topic, item.difficulty || "Medium", questions.length || 3, questions);
                hasSynced = true;
              } else if (assetType === "flashcards") {
                const flashcards = item.flashcards || item.items || [];
                saveFlashcardsToCache(subject, topic, flashcards);
                hasSynced = true;
              } else if (assetType === "pyqs" || assetType === "imps") {
                saveImpsToCache(subject, topic, content);
                hasSynced = true;
              }

              if (hasSynced) {
                setNotification({
                  title: "Bot Sync Active! ⚡",
                  body: `Successfully synced "${topic}" (${assetType.toUpperCase()}) from Discord to your offline library.`
                });
              }
            }
          });
        }, (err) => {
          console.warn("Realtime offline sync snapshot subscription warning:", err);
        });
        
        setLoading(false);
      } catch (err: any) {
        if (!isCurrent) return;
        if (err?.message?.includes("Missing or insufficient permissions") || (err instanceof Error && err.name === "FirebaseError" && err.message.includes("permissions"))) {
          handleFirestoreError(err, OperationType.GET, userDocRef.path);
        } else {
          console.error("Initialization error:", err);
          setError("Session initialization failed. Please reload the app: " + (err.message || String(err)));
        }
        setLoading(false);
      }
    }

    initUser();

    return () => {
      isCurrent = false;
      if (unsubUserDoc) unsubUserDoc();
      if (unsubStatsDoc) unsubStatsDoc();
      if (unsubOfflineSync) unsubOfflineSync();
    };
  }, [user?.uid, dbTrigger]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#0a0a0a';
      document.body.style.backgroundColor = '#0a0a0a';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '#fafafa';
      document.body.style.backgroundColor = '#fafafa';
    }
  }, [darkMode]);

  // Request HTML5 browser notification permissions
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(err => console.error("Error requesting notification permission:", err));
      }
    }
  }, []);

  // Global Check for Reminders every 20 seconds
  useEffect(() => {
    if (!user) return;
    
    let activeReminders: any[] = [];
    const scholarSessionId = localStorage.getItem("scholar_session_id");
    const effectiveUid = scholarSessionId || user.uid;

    const q = query(collection(db, "users", effectiveUid, "reminders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      activeReminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, (err) => console.error("Snapshot error:", err));

    const firedIds = new Set<string>();

    const checkReminders = async () => {
      const now = new Date();
      const nowTime = now.getTime();

      for (const data of activeReminders) {
        if (data.status === "pending" && !firedIds.has(data.id) && data.date && data.time) {
          try {
            const [remYear, remMonth, remDay] = data.date.split("-").map(Number);
            const [remHour, remMin] = data.time.split(":").map(Number);
            const remDateObj = new Date(remYear, remMonth - 1, remDay, remHour, remMin);
            const remTime = remDateObj.getTime();

            // Fire if scheduled time is reached and not older than 1 day
            if (nowTime >= remTime && (nowTime - remTime) < 86400000) {
              firedIds.add(data.id);

              // 1. Trigger in-app toast notification layout
              setNotification({
                title: `Study Session: ${data.subject}`,
                body: `Time to study "${data.topic}" now!`
              });

              // 2. Trigger native device level tray Notification
              if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                try {
                  new Notification(`Study Session: ${data.subject}`, {
                    body: `Time to study "${data.topic}" now! (ScholarAI Pulse)`,
                    icon: "/favicon.ico"
                  });
                } catch (notiErr) {
                  console.error("Local Notification fail:", notiErr);
                }
              }

              // 3. Persist status change to Firestore immediately
              const reminderRef = doc(db, "users", effectiveUid, "reminders", data.id);
              await updateDoc(reminderRef, { status: "completed" });

              // Auto-clear toast overlay in 15s
              setTimeout(() => setNotification(null), 15000);
            }
          } catch (err) {
            console.error("Failed processing Study Pulse reminder item:", err);
          }
        }
      }
    };

    const timer = setInterval(checkReminders, 20000);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-900 text-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <BrainCircuit size={48} className="text-orange-500" />
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-neutral-950 text-white p-8">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl mb-6 max-w-md text-center">
          <p className="text-red-500 font-bold mb-2">Access Restriced</p>
          <p className="text-neutral-400 text-sm">{error}</p>
        </div>
        {!user ? (
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white text-black font-bold rounded-xl">Reload App</button>
        ) : (
          <button onClick={handleSignOut} className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl">Sign Out</button>
        )}
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={async () => {
      try {
        setLoading(true);
        localStorage.removeItem("scholar_session_id");
        const userCredential = await signInWithPopup(auth, googleProvider);
        const fUser = userCredential.user;

        // Unified Session Mirror Copy & Dynamic Auth Routing
        if (getActiveDB() === "supabase" && fUser && fUser.email) {
          const supabase = getSupabase();
          if (supabase) {
            const email = fUser.email;
            const password = `google_auth_${fUser.uid}`;
            console.log("[Auth Engine] Syncing Google credentials to Supabase Auth Engine");

            let { error: sError } = await supabase.auth.signInWithPassword({ email, password });
            if (sError && sError.message.includes("Invalid login credentials")) {
              const { error: signUpErr } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: {
                    nickname: fUser.displayName || "Google Scholar",
                    role: "user"
                  }
                }
              });
              if (!signUpErr) {
                await supabase.auth.signInWithPassword({ email, password });
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Google Login Error:", err);
        setError("Google Login failed. " + (err.message || ""));
      } finally {
        setLoading(false);
      }
    }} />;
  }

  const isDevUser = userData?.role === "owner" || userData?.role === "admin" || userData?.role === "developer" || userData?.email?.toLowerCase().trim() === "arunwarrior98789@gmail.com" || auth.currentUser?.email?.toLowerCase().trim() === "arunwarrior98789@gmail.com";

  if (maintenanceMode && !isDevUser) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-neutral-950 text-white p-6 relative overflow-hidden">
        {/* Background glow elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />
        
        <div className="text-center max-w-md relative z-10">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-4xl">🚨</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-3 uppercase">SYSTEM OPTIMIZATION IN PROGRESS</h1>
          <p className="text-neutral-400 text-sm leading-relaxed mb-6">
            The ScholarAI learning portal is undergoing critical system optimizations. Our educators are refreshing AI models and database indices for peak Board preparation.
          </p>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-xs font-mono text-red-400 mb-8 select-none">
            STATUS CODE: ACTIVE MAINTENANCE MODE
          </div>
          <p className="text-neutral-600 text-xs uppercase tracking-widest font-black animate-pulse">
            Please check back in a few minutes
          </p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "guide", label: "Study Guide", icon: BookOpen },
    { id: "quiz", label: "AI Quizzes", icon: BrainCircuit },
    { id: "pyq", label: "Board Prep", icon: Star },
    { id: "duel", label: "AI Duel", icon: Gamepad2 },
    { id: "reminders", label: "Focus Pulse", icon: Bell },
    { id: "tickets", label: "Support Tickets", icon: LifeBuoy },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    ...(isDevUser ? [{ id: "developer", label: "Developer", icon: Terminal }] : []),
  ];

  return (
    <div className={cn(
      "min-h-screen w-full overflow-x-hidden relative transition-colors duration-300",
      darkMode ? "bg-neutral-950 text-neutral-100" : "bg-neutral-50 text-neutral-900"
    )}>
      {/* Sidebar / Nav */}
      <aside className={cn(
        "fixed left-0 top-0 h-full border-r transition-all duration-300 z-20 ease-in-out print:hidden",
        sidebarCollapsed ? "w-20" : "w-64",
        darkMode ? "bg-neutral-900/50 border-neutral-800" : "bg-white border-neutral-200"
      )}>
        <div className={cn("p-6 flex items-center gap-3 border-bottom border-neutral-800 overflow-hidden", sidebarCollapsed && "justify-center")}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover shrink-0 border border-neutral-800" />
          ) : (
            <BrainCircuit className="text-orange-500 shrink-0" size={32} />
          )}
          {!sidebarCollapsed && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-xl tracking-tight whitespace-nowrap"
            >
              ScholarAI
            </motion.h1>
          )}
        </div>

        <nav className="mt-8 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={sidebarCollapsed ? item.label : ""}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 overflow-hidden",
                sidebarCollapsed ? "justify-center" : "justify-start",
                activeTab === item.id 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                  : darkMode 
                    ? "text-neutral-400 hover:bg-neutral-800" 
                    : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              <item.icon size={20} className="shrink-0" />
              {!sidebarCollapsed && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-6 w-full px-4 space-y-4">
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "w-full flex items-center gap-2 text-neutral-500 hover:text-white transition-colors px-4 py-2",
              sidebarCollapsed ? "justify-center" : "justify-start"
            )}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={20} /> : (
              <>
                <PanelLeftClose size={20} />
                <span className="font-medium">Collapse</span>
              </>
            )}
          </button>
          <button 
            onClick={handleSignOut}
            className={cn(
              "w-full flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors px-4 py-2",
              sidebarCollapsed ? "justify-center" : "justify-start"
            )}
          >
            <LogOut size={20} />
            {!sidebarCollapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "min-h-screen w-full overflow-x-hidden relative flex flex-col transition-all duration-300 print:pl-0",
        sidebarCollapsed ? "pl-20" : "pl-64"
      )}>
        <header className="h-20 px-4 sm:px-8 flex items-center justify-between border-b border-neutral-800/10 backdrop-blur-md sticky top-0 z-10 transition-colors print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white font-black shadow-lg shadow-orange-500/20 overflow-hidden">
              {userData?.discordAvatar ? (
                <img src={userData.discordAvatar} alt="Discord Avatar" className="w-full h-full object-cover" />
              ) : (
                userData?.nickname?.[0] || user.displayName?.[0] || "S"
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase font-black tracking-[0.2em] text-neutral-500 leading-none mb-1">
                {userData?.discordUsername ? `@${userData.discordUsername}` : "Authenticated Scholar"}
              </div>
              <div className="text-lg font-bold tracking-tight">
                {userData?.discordName || userData?.nickname || user.displayName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl hover:bg-neutral-800/10 transition-all active:scale-95 bg-neutral-900/5 items-center justify-center border border-neutral-800/10"
              title="Toggle Theme"
            >
              {darkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
            </button>
            <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-white overflow-hidden shadow-inner">
               {userData?.discordAvatar ? (
                 <img src={userData.discordAvatar} alt="pfp" className="w-full h-full object-cover" />
               ) : user.photoURL ? (
                 <img src={user.photoURL} alt="pfp" className="w-full h-full object-cover" />
               ) : (
                 <span className="opacity-50 tracking-tighter">{userData?.nickname?.[0] || "AI"}</span>
               )}
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full print:p-0 print:max-w-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<ModuleLoader />}>
                {activeTab === "dashboard" && <Dashboard userData={userData} user={user} />}
                {activeTab === "guide" && <StudyGuide userData={userData} />}
                {activeTab === "quiz" && <QuizSection userData={userData} />}
                {activeTab === "pyq" && <ImportantQuestions userData={userData} />}
                {activeTab === "duel" && <TicTacToe />}
                {activeTab === "reminders" && <StudyReminders />}
                {activeTab === "tickets" && <TicketSystem userData={userData} />}
                {activeTab === "settings" && <Settings userData={userData} />}
                {activeTab === "developer" && isDevUser && <DeveloperPage userData={userData} />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="fixed bottom-24 right-8 z-50 p-6 bg-orange-500 text-white rounded-3xl shadow-2xl shadow-orange-500/40 border border-white/20 max-w-sm flex items-start gap-4"
            >
              <div className="p-3 bg-white/20 rounded-2xl">
                <Bell className="animate-ring" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase font-black tracking-widest opacity-80 mb-1 leading-none">Scholar Reminder</p>
                <h4 className="font-bold text-lg mb-1">{notification.title}</h4>
                <p className="text-xs opacity-90 leading-relaxed font-medium">{notification.body}</p>
                <button 
                  onClick={() => setNotification(null)}
                  className="mt-4 px-4 py-2 bg-white text-orange-500 text-[10px] font-black uppercase tracking-widest rounded-xl"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Suspense fallback={null}>
        <DoubtSolver />
      </Suspense>
    </div>
  );
}

