import { useState, useRef, useEffect } from "react";
import { Search, Book, FileText, Loader2, Sparkles, ChevronRight, Download, PenTool, Image as ImageIcon, FileOutput, WifiOff } from "lucide-react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "../lib/utils";
import { updateProgress, trackAIUsage } from "../lib/firebase";
import { generateNotes as clientGenerateNotes } from "../lib/gemini";
import { useOnlineStatus, saveNotesToCache, getNotesFromCache, getAllCachedNotes, CachedNotes } from "../lib/offlineCache";
import { motion, AnimatePresence } from "motion/react";

export default function StudyGuide() {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("Science");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"one-page" | "full">("one-page");
  const [isHandwritten, setIsHandwritten] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [cachedNotesList, setCachedNotesList] = useState<CachedNotes[]>([]);
  const notesRef = useRef<HTMLDivElement>(null);
  const pdfRenderRef = useRef<HTMLDivElement>(null);
  const [exportingState, setExportingState] = useState<"idle" | "preparing_pdf" | "rendering_pdf" | "preparing_md" | "success" | "error">("idle");
  const isOnline = useOnlineStatus();

  useEffect(() => {
    setCachedNotesList(getAllCachedNotes());
  }, [notes]);

  const generateNotes = async (type: "one-page" | "full") => {
    if (!topic) return;
    setLoading(true);
    setActiveType(type);
    setExportError(null);
    try {
      if (!isOnline) {
        const cached = getNotesFromCache(subject, topic, type);
        if (cached) {
          setNotes(cached);
          updateProgress(subject, topic, "notesRead");
          setLoading(false);
          return;
        } else {
          setNotes(`# ⚠️ Topic Not Cached Offline\n\nYou are currently offline, and notes for **${topic}** (${subject} - ${type === 'one-page' ? 'One Page' : 'Full Notes'}) are not available. Please connect to the internet to generate this guide.`);
          setLoading(false);
          return;
        }
      }

      const noteContent = await clientGenerateNotes(subject, topic, type);
      
      // Track usage
      await trackAIUsage(noteContent.length * 4);

      setNotes(noteContent);
      saveNotesToCache(subject, topic, type, noteContent);
      
      // Track progress
      updateProgress(subject, topic, "notesRead");
    } catch (err: any) {
      console.error(err);
      if (err.status === 429 || err.message?.includes("429")) {
        setNotes("# ⚠️ AI Quota Reached\n\nYou've exhausted the free generation limit. Please wait an active minute before generating more notes.");
        await trackAIUsage(0, true);
      } else {
        setNotes(`# ⚠️ Generation Failed\n\nFailed to assemble the guide. Details: ${err.message || String(err)}. Check your model config or try another topic.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadNotes = async () => {
    if (!notes || exportingState !== 'idle') return;
    setExportingState('preparing_md');
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const blob = new Blob([notes], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = topic.replace(/\s+/g, '-').toLowerCase() + '_notes.md';
      a.click();
      URL.revokeObjectURL(url);
      setExportingState('success');
      setTimeout(() => setExportingState('idle'), 3000);
    } catch (err: any) {
      console.error('Markdown export failed:', err);
      setExportError('⚠️ Failed to export Markdown: ' + (err.message || String(err)));
      setExportingState('error');
      setTimeout(() => setExportingState('idle'), 4000);
    }
  };

  const exportAsPDF = async () => {
    setExportingState('preparing_pdf');
    
    // Add pre-print cleanup and post-print restoration
    window.onbeforeprint = () => {
      const popups = document.querySelectorAll('.exporter-system-popup, [role="status"]');
      popups.forEach(p => {
        (p as HTMLElement).style.display = 'none';
      });
    };

    window.onafterprint = () => {
      const popups = document.querySelectorAll('.exporter-system-popup, [role="status"]');
      popups.forEach(p => {
        // Restore elements default display value
        (p as HTMLElement).style.display = '';
      });
    };

    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      window.print();
      setExportingState('success');
      setTimeout(() => setExportingState('idle'), 1500);
    } catch (err: any) {
      console.error('PDF Export failed:', err);
      setExportError('⚠️ Failed to export as PDF: ' + (err.message || String(err)));
      setExportingState('error');
      setTimeout(() => setExportingState('idle'), 4000);
    } finally {
      // Clean up the listeners to avoid any side effects
      window.onbeforeprint = null;
      window.onafterprint = null;
    }
  };

  const subjects = ["Maths", "Science", "Social Science", "English", "Hindi"];

  return (
    <div className="space-y-8 animate-fade-in">
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl p-4 flex items-center gap-3 font-semibold text-xs animate-in slide-in-from-top-4 duration-300 print:hidden">
          <WifiOff size={16} className="shrink-0" />
          <span>Offline Mode: Showing cached guides. Connect to the internet to generate new topics.</span>
        </div>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-xl print:hidden">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Book className="text-orange-500" />
          Smart Study Guide
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-4">
            <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Select Subject</label>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={cn(
                    "px-4 py-2 rounded-xl border transition-all font-medium",
                    subject === s 
                      ? "bg-orange-500 border-orange-500 text-white" 
                      : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Enter Chapter or Topic</label>
            <div className="relative">
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Life Processes, Trigonometry..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 pl-12 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => generateNotes("one-page")}
            disabled={loading || !topic}
            className="flex-1 py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition disabled:opacity-50"
          >
            {loading && activeType === "one-page" ? <Loader2 className="animate-spin" /> : <FileText size={20} />}
            Generate One-Page Notes
          </button>
          <button
            onClick={() => generateNotes("full")}
            disabled={loading || !topic}
            className="flex-1 py-4 bg-orange-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-orange-600 transition disabled:opacity-50 shadow-lg shadow-orange-500/20"
          >
            {loading && activeType === "full" ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
            Generate Full Notes
          </button>
        </div>

        {cachedNotesList.length > 0 && (
          <div className="mt-8 pt-6 border-t border-neutral-800">
            <h3 className="text-xs font-black uppercase text-neutral-500 tracking-wider mb-3">Recently Saved Offline Guides</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {cachedNotesList.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSubject(item.subject);
                    setTopic(item.topic);
                    setActiveType(item.type);
                    setNotes(item.content);
                  }}
                  className="p-3 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 hover:border-orange-500/30 rounded-xl text-left transition text-xs"
                >
                  <p className="font-bold text-neutral-300 truncate">{item.topic}</p>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-500 uppercase">
                    <span>{item.subject}</span>
                    <span className="font-bold text-orange-400">{item.type === 'one-page' ? 'Summary' : 'In-depth'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {notes && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 justify-end print:hidden">
            <button 
              onClick={() => setIsHandwritten(!isHandwritten)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
                isHandwritten ? "bg-orange-500 text-white" : "bg-neutral-800 text-neutral-400"
              )}
            >
              <PenTool size={14} />
              {isHandwritten ? "Text Mode" : "Handwritten Mode"}
            </button>
            <button 
              onClick={downloadNotes}
              disabled={exportingState !== "idle"}
              className="px-4 py-2 bg-neutral-800 text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              Markdown
            </button>
            <button 
              onClick={exportAsPDF}
              disabled={exportingState !== "idle"}
              className="px-4 py-2 bg-neutral-800 text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileOutput size={14} />
              PDF
            </button>
          </div>

          {exportError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-medium flex items-center justify-between print:hidden">
              <span>{exportError}</span>
              <button onClick={() => setExportError(null)} className="hover:text-red-400 font-bold ml-2">Dismiss</button>
            </div>
          )}

          <div 
            ref={notesRef}
            className={cn(
              "rounded-3xl p-6 md:p-12 shadow-2xl transition-all duration-500 print:hidden",
              isHandwritten 
                ? "bg-[#fff9e6] text-[#2c1810] font-handwritten text-xl leading-relaxed border-2 border-[#e6dcc0]" 
                : "bg-neutral-900 border border-neutral-800 text-neutral-200"
            )}
          >
            <div className={cn(
              "flex items-center justify-between mb-8 pb-4 border-b",
              isHandwritten ? "border-[#e6dcc0]" : "border-neutral-800"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  isHandwritten ? "bg-[#e6dcc0]" : "bg-orange-500/10"
                )}>
                   <Book className={isHandwritten ? "text-[#5d4037]" : "text-orange-500"} size={20} />
                </div>
                <h3 className={cn("text-xl font-bold m-0", isHandwritten && "text-[#5d4037]")}>
                  {topic} - {activeType === 'one-page' ? 'Summary' : 'In-depth'}
                </h3>
              </div>
              <span className={cn(
                "text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest",
                isHandwritten ? "bg-[#f0e6c0] text-[#8d6e63]" : "bg-white/5 text-neutral-500"
              )}>
                Study Notes
              </span>
            </div>
            <div className={cn(
              "prose max-w-none prose-lg",
              isHandwritten ? "prose-stone prose-xl font-handwritten" : "prose-invert prose-orange"
            )}>
              <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{notes}</Markdown>
            </div>
            
            {isHandwritten && (
              <div className="mt-12 pt-8 border-t border-[#e6dcc0] flex justify-between text-xs text-[#8d6e63] font-bold uppercase">
                <span>ScholarAI Handwriting Module</span>
                <span>Page 01</span>
              </div>
            )}
          </div>

          {/* Hidden container on screen, perfectly positioned as printable-area for window.print() */}
          <div className="printable-area absolute -left-[9999px] top-0 pointer-events-none" style={{ width: "800px" }}>
            <div 
              ref={pdfRenderRef}
              className="bg-white text-black p-6 md:p-12 rounded-[24px] relative text-left font-sans"
              style={{ width: "800px" }}
            >
              <div className="mb-10 border-b-2 border-black pb-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-[#737373] mb-1 font-sans">ScholarAI Board Prep Series</h4>
                <h1 className="text-3xl font-black text-black font-sans">Expert Notes: {topic}</h1>
              </div>
              
              <div className="prose prose-neutral max-w-none text-black font-sans prose-headings:text-black prose-p:text-black prose-p:leading-relaxed prose-strong:text-black prose-code:text-black prose-li:text-black">
                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{notes}</Markdown>
              </div>
              
              <div className="mt-12 pt-8 border-t border-neutral-200 text-center text-xs text-[#a3a3a3] font-medium font-sans">
                 &copy; 2026 ScholarAI Expert Systems • Expert Study Guide Set
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {exportingState !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className={`exporter-system-popup fixed bottom-8 right-8 z-50 p-5 rounded-2xl border flex items-center gap-3.5 shadow-2xl backdrop-blur-md max-w-sm ${exportingState === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : exportingState === "error" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-neutral-900 border-neutral-800 text-white"}`}
          >
            <div className="flex items-center gap-3">
              {(exportingState.startsWith("preparing") || exportingState.startsWith("rendering")) ? (
                <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin flex items-center justify-center shrink-0" />
              ) : exportingState === "success" ? (
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
                <p className="text-[10px] uppercase font-black tracking-widest text-neutral-400 leading-none mb-1">Exporter System</p>
                <p className="text-xs font-bold leading-tight">
                  {exportingState === "preparing_md" && "Assembling Markdown..."}
                  {exportingState === "preparing_pdf" && "Formatting document structures..."}
                  {exportingState === "rendering_pdf" && "Rendering high-resolution PDF document..."}
                  {exportingState === "success" && "Download initiated successfully!"}
                  {exportingState === "error" && "Export processing failed."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );                     
}
