import { useRef, memo } from "react";
import { Download, Share2, Award, Target, Clock, GraduationCap } from "lucide-react";
import { toPng } from 'html-to-image';
import { motion } from "motion/react";

const ScholarStatsCard = memo(({ userData }: { userData: any }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadStats = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#050505",
        quality: 1.0,
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${userData?.nickname || 'scholar'}_elite_stats.png`;
      a.click();
    } catch (err) {
      console.error("Stats export failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-neutral-900/80 p-4 rounded-2xl border border-white/5">
        <div>
           <h3 className="text-lg font-black tracking-tight text-white">Elite Scholar Pass</h3>
           <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Share your academic milestones</p>
        </div>
        <button 
          onClick={downloadStats}
          className="px-5 py-2.5 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-orange-500 hover:text-white transition-all shadow-xl active:scale-95"
        >
          <Download size={16} />
          Export
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
          
          {/* Grainy Texture Overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

          <div className="z-10 text-center w-full">
            <div className="flex justify-center mb-8">
               <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-red-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl rotate-3 transform transition hover:rotate-0 overflow-hidden group">
                  {userData?.discordAvatar ? (
                    <img 
                      src={userData.discordAvatar} 
                      alt="Discord Profile" 
                      loading="lazy"
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
                {userData?.discordUsername ? userData.discordUsername : "Scholar Elite"}
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

    </div>
  );
});

export default ScholarStatsCard;
