import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BrainCircuit, GraduationCap, ArrowRight, UserCircle } from "lucide-react";
import { auth, signInAnonymously, db, serverTimestamp } from "../lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<"google" | "scholar">("google");
  const [scholarId, setScholarId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScholarLogin = async () => {
    if (scholarId.length < 4) {
      setError("Scholar ID must be at least 4 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Dynamic Database Verification: Query the users collection first to verify if that specific ID exists
      const userDocRef = doc(db, "users", scholarId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        setError("Invalid Scholar ID. Please check your credentials.");
        setLoading(false);
        return;
      }
      
      // 2. Accurate Profile Hydration: Set the active session ID, then sign in anonymously (to authorize Firebase rules)
      localStorage.setItem("scholar_session_id", scholarId);
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/admin-restricted-operation") {
        setError("Anonymous sign-in is disabled. Open Firebase Console > Auth > Sign-in method and enable 'Anonymous'.");
      } else {
        setError("Login failed: " + (err.message || "Please try again later."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-neutral-950 text-white p-4 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 text-center w-full max-w-lg"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-orange-500 rounded-2xl shadow-2xl shadow-orange-500/40">
            <GraduationCap size={48} className="text-white" />
          </div>
        </div>
        
        <h1 className="text-5xl font-black mb-4 tracking-tight">
          Master Class 10th with <span className="text-orange-500">ScholarAI</span>
        </h1>
        <p className="text-neutral-400 text-lg mb-8">
          The ultimate professional study companion. Personalized notes and AI-quizzes.
        </p>

        <div className="bg-neutral-900/50 border border-white/5 p-8 rounded-3xl backdrop-blur-xl">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold animate-shake space-y-2">
              <p>{error}</p>
              {error.includes("Anonymous sign-in is disabled") && (
                <a 
                  href="https://console.firebase.google.com/project/netflix-fix/authentication/providers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block mt-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-center transition border border-red-500/30"
                >
                  Open Firebase Console to Enable
                </a>
              )}
            </div>
          )}
          <div className="flex p-1 bg-black/40 rounded-xl mb-8">
            <button 
              onClick={() => setMode("google")}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${mode === "google" ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}
            >
              Google Login
            </button>
            <button 
              onClick={() => setMode("scholar")}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${mode === "scholar" ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}
            >
              Scholar ID
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === "google" ? (
              <motion.div
                key="google"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <button
                  onClick={onLogin}
                  className="group relative w-full flex items-center justify-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-2xl transition hover:bg-neutral-200 overflow-hidden"
                >
                  <img src="https://www.google.com/favicon.ico" alt="google" className="w-5 h-5" />
                  <span>Continue with Google</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="scholar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="relative">
                  <input 
                    type="text"
                    value={scholarId}
                    onChange={(e) => setScholarId(e.target.value)}
                    placeholder="Enter Private Scholar ID..."
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-4 outline-none focus:ring-2 focus:ring-orange-500 font-mono text-center tracking-widest"
                  />
                </div>
                <button
                  onClick={handleScholarLogin}
                  disabled={scholarId.length < 4 || loading}
                  className="w-full py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <BrainCircuit className="animate-spin" /> : <span>Login as Scholar</span>}
                  <ArrowRight size={20} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="mt-12 grid grid-cols-3 gap-6 text-sm text-neutral-500">
          <div className="p-4 border border-white/5 rounded-xl bg-white/5">
            <div className="font-bold text-white mb-1">Precision</div>
            AI-tuned notes
          </div>
          <div className="p-4 border border-white/5 rounded-xl bg-white/5">
            <div className="font-bold text-white mb-1">Board Prep</div>
            PYQs & Imp Qs
          </div>
          <div className="p-4 border border-white/5 rounded-xl bg-white/5">
            <div className="font-bold text-white mb-1">24/7 Solve</div>
            Instant AI doubt bot
          </div>
        </div>
      </motion.div>
      
      <footer className="absolute bottom-8 text-neutral-600 text-sm">
        Professional Study Suite for CBSE/State Board Class 10th
      </footer>
    </div>
  );
}
