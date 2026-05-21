import { useRef, memo, useState } from "react";
import { Download, Share2, Award, Target, Clock, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const ScholarStatsCard = memo(({ userData }: { userData: any }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exportState, setExportState] = useState<"idle" | "preparing" | "rendering" | "success" | "error">("idle");

  const printStats = async () => {
    setExportState("preparing");
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      window.print();
      setExportState("success");
      setTimeout(() => setExportState("idle"), 3000);
    } catch (err) {
      console.error("Stats print failed:", err);
      setExportState("error");
      setTimeout(() => setExportState("idle"), 4000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-neutral-900/80 p-4 rounded-2xl border border-white/5 print:hidden">
        <div>
           <h3 className="text-lg font-black tracking-tight text-white">Elite Scholar Pass</h3>
           <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Share your academic milestones</p>
        </div>
        <button 
          onClick={printStats}
          disabled={exportState !== "idle"}
          className="px-5 py-2.5 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-orange-500 hover:text-white transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          {exportState !== "idle" ? "Processing..." : "Export"}
        </button>
      </div>

      <div className="overflow-hidden rounded-[40px] shadow-2xl shadow-orange-500/10 border border-white/5">
        <div 
          ref={cardRef}
          className="w-full max-w-[340px] aspect-[1/1.414] mx-auto bg-[#0a0a0a] p-10 relative flex flex-col items-center justify-between overflow-hidden"
        >
          {/* Professional Design Elements */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 via-yellow-500 to-red-500" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500 opacity-10 blur-[100px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500 opacity-10 blur-[100px] rounded-full" />
          
          {/* Premium CSS-based Grid Tech Pattern */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px]" />

          <div className="z-10 text-center w-full">
            <div className="flex justify-center mb-8">
               <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-red-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl rotate-3 transform transition hover:rotate-0 overflow-hidden group">
                  {userData?.discordAvatar ? (
                    <img 
                      src={userData.discordAvatar} 
                      alt="Discord Profile" 
                      loading="lazy"
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <GraduationCap size={48} className="text-white drop-shadow-lg" />
                  )}
               </div>
            </div>
            
            <div className="space-y-1 mb-10">
              <h2 className="text-4xl font-black text-white tracking-tighter leading-none italic uppercase">
                {userData?.discordUsername ? userData.discordUsername : (userData?.nickname || "Scholar Elite")}
              </h2>
              <div className="h-1 w-12 bg-orange-500 mx-auto rounded-full" />
              <p className="text-neutral-500 font-black text-[9px] uppercase tracking-[0.4em] pt-2">
                {userData?.discordName ? `Elite Member • ${userData.discordName}` : "Class of 2026 • Verified"}
              </p>
            </div>
            
            <div className="space-y-4 w-full">
              <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-md">
                 <div className="text-neutral-500 text-[9px] font-black uppercase tracking-[0.2em] mb-2 opacity-50">Authorized Identity</div>
                 <div className="text-2xl font-black text-white tracking-tight leading-none truncate">
                    {userData?.nickname || "Academic Elite"}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="group bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-md hover:border-orange-500/50 transition-colors">
                   <Target size={24} className="text-orange-500 mx-auto mb-3" />
                   <div className="text-3xl font-black text-white leading-none mb-1">{userData?.quizCorrect || 0}</div>
                   <div className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">Scholar Pts</div>
                </div>
                <div className="group bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-md hover:border-blue-500/50 transition-colors">
                   <Award size={24} className="text-blue-500 mx-auto mb-3" />
                   <div className="text-3xl font-black text-white leading-none mb-1">{(userData?.accuracy || 0).toFixed(0)}<span className="text-sm">%</span></div>
                   <div className="text-[9px] text-neutral-500 font-black uppercase tracking-wider">Expertise</div>
                </div>
              </div>
            </div>
          </div>

          <div className="z-10 w-full space-y-4">
             <div className="flex items-center justify-between px-2 pt-6 border-t border-white/5">
                <div className="flex flex-col items-start">
                   <div className="text-[8px] text-neutral-600 font-black uppercase tracking-widest leading-none mb-1">Issue Date</div>
                   <div className="text-[10px] text-neutral-400 font-mono">{new Date().toLocaleDateString('en-GB')}</div>
                </div>
                <div className="flex flex-col items-end">
                   <div className="text-[8px] text-neutral-600 font-black uppercase tracking-widest leading-none mb-1">Auth Code</div>
                   <div className="text-[10px] text-neutral-400 font-mono">SAI-{Math.floor(1000 + Math.random() * 9000).toString().padStart(4, '0')}</div>
                </div>
             </div>
             <div className="text-center">
                <div className="text-white font-black text-2xl tracking-[0.2em] opacity-10 italic select-none">SCHOLAR AI</div>
             </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {exportState !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className={`fixed bottom-8 right-8 z-50 p-5 rounded-2xl border flex items-center gap-3.5 shadow-2xl backdrop-blur-md max-w-sm ${
              exportState === "success" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : exportState === "error"
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-neutral-900 border-neutral-800 text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              {(exportState === "preparing" || exportState === "rendering") ? (
                <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin flex items-center justify-center shrink-0" />
              ) : exportState === "success" ? (
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <span className="font-extrabold text-sm">!</span>
                </div>
              )}
              
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-neutral-400 leading-none mb-1">Scholar Card System</p>
                <p className="text-xs font-bold leading-tight">
                  {exportState === "preparing" && "Preparing graphics pass..."}
                  {exportState === "rendering" && "Pixelating high-fidelity PNG card..."}
                  {exportState === "success" && "Elite Card saved successfully!"}
                  {exportState === "error" && "Export processing halted with errors."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default ScholarStatsCard;
