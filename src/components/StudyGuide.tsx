import { useState, useRef } from "react";
import { Search, Book, FileText, Loader2, Sparkles, ChevronRight, Download, PenTool, Image as ImageIcon, FileOutput } from "lucide-react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "../lib/utils";
import { updateProgress, trackAIUsage } from "../lib/firebase";
import { toPng } from 'html-to-image';
import jsPDF from "jspdf";

export default function StudyGuide() {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("Science");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"one-page" | "full">("one-page");
  const [isHandwritten, setIsHandwritten] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);

  const generateNotes = async (type: "one-page" | "full") => {
    if (!topic) return;
    setLoading(true);
    setActiveType(type);
    try {
      const res = await fetch("/api/generate-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, subject, type }),
      });

      if (res.status === 429) {
        setNotes("# ⚠️ AI Quota Reached\n\nYou've exhausted the free generation limit. Please wait 60 seconds before generating more notes. You can monitor your quota in the Settings tab.");
        await trackAIUsage(0, true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      
      // Track usage
      await trackAIUsage(data.content.length * 4);

      setNotes(data.content);
      // Track progress
      updateProgress(subject, topic, "notesRead");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadNotes = () => {
    if (!notes) return;
    const blob = new Blob([notes], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.replace(/\s+/g, '-').toLowerCase()}_notes.md`;
    a.click();
  };

  const exportAsImage = async () => {
    if (!notesRef.current) return;
    try {
      const dataUrl = await toPng(notesRef.current, {
        backgroundColor: isHandwritten ? "#fff9e6" : "#0d0d0d",
        quality: 1.0,
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${topic.replace(/\s+/g, '-').toLowerCase()}_notes.png`;
      a.click();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export as image.");
    }
  };

  const exportAsPDF = async () => {
    if (!notesRef.current) return;
    setLoading(true);
    try {
      const dataUrl = await toPng(notesRef.current, {
        backgroundColor: isHandwritten ? "#fff9e6" : "#0d0d0d",
        quality: 1.0,
        pixelRatio: 2,
      });
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${topic.replace(/\s+/g, '-').toLowerCase()}_notes.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
      alert("Failed to export as PDF.");
    } finally {
      setLoading(false);
    }
  };

  const subjects = ["Maths", "Science", "Social Science", "English", "Hindi"];

  return (
    <div className="space-y-8">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-xl">
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
      </div>

      {notes && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 justify-end">
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
              className="px-4 py-2 bg-neutral-800 text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:text-white transition"
            >
              <Download size={14} />
              Markdown
            </button>
            <button 
              onClick={exportAsImage}
              className="px-4 py-2 bg-neutral-800 text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:text-white transition"
            >
              <ImageIcon size={14} />
              PNG
            </button>
            <button 
              onClick={exportAsPDF}
              className="px-4 py-2 bg-neutral-800 text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:text-white transition"
            >
              <FileOutput size={14} />
              PDF
            </button>
          </div>

          <div 
            ref={notesRef}
            className={cn(
              "rounded-3xl p-12 shadow-2xl transition-all duration-500",
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
        </div>
      )}
    </div>
  );
}
