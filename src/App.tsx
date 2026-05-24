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
  Terminal
} from "lucide-react";

import { cn } from "./lib/utils";
import Auth from "./components/Auth";

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

  const handleSignOut = async () => {
    localStorage.removeItem("scholar_session_id");
    await signOut(auth);
  };

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

    async function initUser() {
      if (!user) return;
      setLoading(true);
      setError(null);

      const scholarSessionId = localStorage.getItem("scholar_session_id");
      const effectiveUid = scholarSessionId || user.uid;

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
            joinedAt: serverTimestamp(),
            colorMode: "dark"
          };

          if (user.email === "arunwarrior98789@gmail.com") {
            newData.role = "owner";
          }

          try {
            await setDoc(userDocRef, newData);
            
            await setDoc(doc(db, "stats", user.uid), {
              userId: user.uid,
              nickname: newData.nickname,
              quizCorrect: 12,
              totalAttempted: 15,
              accuracy: 80.0,
              timeSpent: 45,
              lastUpdated: serverTimestamp()
            });

            // Seed Topic Progress Points
            const progressCollection = collection(db, "users", user.uid, "progress");
            await setDoc(doc(progressCollection, "chemical-reactions-and-equations"), {
              subject: "Science",
              topic: "Chemical Reactions and Equations",
              notesRead: true,
              quizTaken: true,
              pyqsViewed: true,
              lastActivity: serverTimestamp()
            });
            await setDoc(doc(progressCollection, "quadratic-equations"), {
              subject: "Maths",
              topic: "Quadratic Equations",
              notesRead: true,
              quizTaken: false,
              pyqsViewed: true,
              lastActivity: serverTimestamp()
            });
            await setDoc(doc(progressCollection, "nationalism-in-india"), {
              subject: "Social Science",
              topic: "Nationalism in India",
              notesRead: true,
              quizTaken: true,
              pyqsViewed: false,
              lastActivity: serverTimestamp()
            });

            // Seed AI Doubt Messages
            const doubtsCollection = collection(db, "users", user.uid, "doubts");
            await setDoc(doc(doubtsCollection, "welcome-doubt-1"), {
              role: "user",
              content: "How and where can I find the most important concepts for Class 10 Science Board Prep?",
              timestamp: serverTimestamp()
            });
            await setDoc(doc(doubtsCollection, "welcome-doubt-2"), {
              role: "ai",
              content: "Hi Scholar! You can find fully comprehensive notes under the Study Guide, generate customized quizzes in the Quiz tab, and view Important Questions complete with PYQs. Focus especially on high-yield topics like $Carbon\\ and\\ its\\ Compounds$ and $Chemical\\ Reactions$ using LaTeX for equations!",
              timestamp: serverTimestamp()
            });

            // Seed Study Reminder
            const remindersCollection = collection(db, "users", user.uid, "reminders");
            await setDoc(doc(remindersCollection, "study-quadratic-equations"), {
              topic: "Quadratic Equations practice",
              subject: "Maths",
              time: "17:30",
              date: "2026-05-25",
              status: "pending",
              createdAt: serverTimestamp()
            });
          } catch (createErr) {
            handleFirestoreError(createErr, OperationType.WRITE, "initial user/stats/seed creation");
          }
        } else {
          // Check if existing user needs promotion
          const data = userDoc.data();
          if (user.email === "arunwarrior98789@gmail.com" && data?.role !== "owner") {
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
              if (!hasChanges) return current;
              return { ...current, ...newData };
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
            setUserData((prev: any) => {
              const current = prev || {};
              let hasChanges = false;
              for (const key in newData) {
                if (JSON.stringify(current[key]) !== JSON.stringify(newData[key])) {
                  hasChanges = true;
                  break;
                }
              }
              if (!hasChanges) return current;
              return { ...current, ...newData };
            });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `stats/${effectiveUid}`);
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
    };
  }, [user?.uid]);

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
        await signInWithPopup(auth, googleProvider);
      } catch (err: any) {
        console.error("Google Login Error:", err);
        setError("Google Login failed. " + (err.message || ""));
      } finally {
        setLoading(false);
      }
    }} />;
  }

  const isDevUser = userData?.role === "owner" || userData?.role === "admin" || userData?.role === "developer" || userData?.email === "arunwarrior98789@gmail.com" || auth.currentUser?.email === "arunwarrior98789@gmail.com";

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "guide", label: "Study Guide", icon: BookOpen },
    { id: "quiz", label: "AI Quizzes", icon: BrainCircuit },
    { id: "pyq", label: "Board Prep", icon: Star },
    { id: "duel", label: "AI Duel", icon: Gamepad2 },
    { id: "reminders", label: "Focus Pulse", icon: Bell },
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
          <BrainCircuit className="text-orange-500 shrink-0" size={32} />
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

