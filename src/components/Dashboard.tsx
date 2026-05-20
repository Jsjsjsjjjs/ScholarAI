import { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { 
  Trophy, 
  Target, 
  Clock, 
  ChevronRight,
  TrendingUp,
  Award,
  BrainCircuit,
  BookOpen,
  CheckCircle2,
  Circle
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { cn } from "../lib/utils";

import ScholarStatsCard from "./ScholarStatsCard";

export default function Dashboard({ userData, user }: { userData: any, user: any }) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const isAdminUser = user?.email === "arunwarrior98789@gmail.com" || userData?.role === "owner" || userData?.role === "admin";

  const handleClearLeaderboard = async () => {
    setIsClearing(true);
    setClearStatus("Clearing...");
    try {
      const { getDocs, deleteDoc, doc } = await import("firebase/firestore");
      const querySnapshot = await getDocs(collection(db, "stats"));
      const deletePromises = querySnapshot.docs.map((docSnap) => 
        deleteDoc(doc(db, "stats", docSnap.id))
      );
      await Promise.all(deletePromises);
      setClearStatus("Cleared!");
      setConfirmClear(false);
      setTimeout(() => setClearStatus(null), 3000);
    } catch (err: any) {
      console.error("Failed to clear leaderboard", err);
      setClearStatus("Error: " + (err?.message || "Unknown error"));
      setTimeout(() => setClearStatus(null), 5000);
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, "stats"), orderBy("quizCorrect", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Strict real-user leaderboard sorting based on real features & work logged in Firestore
      const sorted = [...data].sort((a, b) => (b.quizCorrect || 0) - (a.quizCorrect || 0));
      setLeaderboard(sorted.slice(0, 5));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "stats collection leaderboard query");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const scholarSessionId = localStorage.getItem("scholar_session_id");
    const activeUid = scholarSessionId || user?.uid;
    if (!activeUid) return;
    const progressQ = query(
      collection(db, "users", activeUid, "progress"),
      orderBy("lastActivity", "desc"),
      limit(5)
    );
    const unsubscribe = onSnapshot(progressQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProgress(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/progress`);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const statsCards = [
    { label: "Correct Answers", valueStr: `${userData?.quizCorrect || 0}`, valueNum: userData?.quizCorrect || 0, icon: Target, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Completion Ratio", valueStr: `${progress.filter(p => p.quizTaken).length}/${progress.length || 0}`, valueNum: progress.length, icon: BrainCircuit, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Accuracy Rate", valueStr: `${(userData?.accuracy || 0).toFixed(1)}%`, valueNum: userData?.accuracy || 0, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Minutes Spent", valueStr: `${userData?.timeSpent || 0}`, valueNum: userData?.timeSpent || 0, icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, i) => (
          <div key={i} className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex items-center gap-4 transition-all hover:border-neutral-700">
            <div className={cn("p-4 rounded-xl shrink-0", stat.bg)}>
              <stat.icon size={24} className={stat.color} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-black text-neutral-500 tracking-widest mb-1 truncate">{stat.label}</div>
              <div className="text-2xl font-black tracking-tight">{stat.valueStr}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Progress Tracker */}
        <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <BookOpen size={20} className="text-orange-500" />
            Recent Topic Progress
          </h3>
          <div className="space-y-4">
            {progress.map((item) => (
              <div key={item.id} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold">{item.topic}</div>
                  <div className="text-xs font-bold text-neutral-500 uppercase">{item.subject}</div>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1 text-xs">
                    {item.notesRead ? <CheckCircle2 size={14} className="text-green-500" /> : <Circle size={14} className="text-neutral-600" />}
                    <span className={item.notesRead ? "text-neutral-300" : "text-neutral-600"}>Notes</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {item.quizTaken ? <CheckCircle2 size={14} className="text-green-500" /> : <Circle size={14} className="text-neutral-600" />}
                    <span className={item.quizTaken ? "text-neutral-300" : "text-neutral-600"}>Quiz</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {item.pyqsViewed ? <CheckCircle2 size={14} className="text-green-500" /> : <Circle size={14} className="text-neutral-600" />}
                    <span className={item.pyqsViewed ? "text-neutral-300" : "text-neutral-600"}>Board Prep</span>
                  </div>
                </div>
              </div>
            ))}
            {progress.length === 0 && (
              <div className="text-center py-10">
                <p className="text-neutral-500">No topics started yet. Go to Study Guide to begin!</p>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Trophy size={20} className="text-yellow-500" />
              Global Leaderboard
            </h3>
            <div className="flex items-center gap-3">
              {isAdminUser && (
                <div className="flex items-center gap-2">
                  {clearStatus && (
                    <span className="text-xs text-orange-500 font-bold bg-orange-500/10 px-2 py-0.5 rounded">
                      {clearStatus}
                    </span>
                  )}
                  {confirmClear ? (
                    <div className="flex items-center gap-1 bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-700">
                      <button
                        onClick={handleClearLeaderboard}
                        disabled={isClearing}
                        className="text-[10px] uppercase font-black bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        disabled={isClearing}
                        className="text-[10px] uppercase font-black bg-neutral-900 hover:bg-neutral-800 text-neutral-400 px-2 py-1 rounded transition-colors cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClear(true)}
                      className="text-[10px] uppercase font-black text-red-500 hover:text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              <Award className="text-neutral-500" />
            </div>
          </div>
          <div className="space-y-4">
            {leaderboard.map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "w-6 text-center font-bold",
                    i === 0 ? "text-yellow-500" : i === 1 ? "text-neutral-300" : i === 2 ? "text-orange-400" : "text-neutral-500"
                  )}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-bold">{entry.nickname}</div>
                    <div className="text-xs text-neutral-500">Master Scholar</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-orange-500">{entry.quizCorrect}</div>
                  <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Solved</div>
                </div>
              </div>
            ))}
            {leaderboard.length === 0 && <div className="text-neutral-500 text-center py-8">Begin your journey to appear on the leaderboard</div>}
          </div>
        </div>
        {/* Stats Card Generator */}
        <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800">
           <ScholarStatsCard userData={userData} />
        </div>
      </div>
      
      {/* Performance Visualization */}
      <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <TrendingUp size={20} className="text-orange-500" />
          Performance Insight
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statsCards}>
              <XAxis dataKey="label" stroke="#525252" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#f59e0b' }}
                cursor={{ fill: 'transparent' }}
              />
              <Bar dataKey="valueNum" radius={[4, 4, 0, 0]}>
                {statsCards.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? "#22c55e" : index === 1 ? "#3b82f6" : "#f59e0b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="p-12 rounded-3xl bg-gradient-to-br from-orange-500 to-red-600 relative overflow-hidden text-white shadow-2xl shadow-orange-500/20">
         <div className="z-10 relative">
            <h2 className="text-3xl font-black mb-4">Board Exams Approaching?</h2>
            <p className="max-w-md opacity-90 mb-8 font-medium">Use our Expert Chapter Notes and PYQ generator to stay ahead of the curve. All content is powered by high-precision AI.</p>
            <div className="flex gap-4">
               <div className="px-6 py-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30 font-bold">New: Hindi Support</div>
               <div className="px-6 py-3 bg-white/20 backdrop-blur-xl rounded-xl border border-white/30 font-bold">Math Formula Wiki</div>
            </div>
         </div>
         <BrainCircuit size={300} className="absolute -right-20 -bottom-20 opacity-10 rotate-12" />
      </div>
    </div>
  );
}
