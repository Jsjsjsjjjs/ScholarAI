import { useState } from "react";
import { Star, Search, Loader2, Sparkles, Download, Printer } from "lucide-react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { updateProgress, trackAIUsage } from "../lib/firebase";
import { generateImportantQuestions } from "../lib/gemini";
import { cn } from "../lib/utils";

export default function ImportantQuestions() {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("Science");
  const [numQuestions, setNumQuestions] = useState(10);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);

  const subjects = ["Hindi", "English", "Science", "Math", "SST"];

  const generatePyqs = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const notesContent = await generateImportantQuestions(subject, topic, numQuestions);

      // Track usage
      await trackAIUsage(notesContent.length * 4);

      setContent(notesContent);
      updateProgress(subject, topic, "pyqsViewed");
    } catch (err: any) {
      console.error(err);
      if (err.status === 429 || err.message?.includes("429")) {
        setContent("# ⚠️ AI Quota Reached\n\nGeneration limit reached. Please wait a minute and try again. You can check your remaining tokens in Settings.");
        await trackAIUsage(0, true);
      } else {
        setContent(`# ⚠️ Generation Failed\n\nFailed to compile questions. Details: ${err.message || String(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 relative overflow-hidden">
        <div className="z-10 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 text-orange-500 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
            <Star size={14} />
            Board Exam Specialized
          </div>
          <h2 className="text-3xl font-black mb-6">Important Question Generator</h2>
          
          <div className="flex flex-col gap-6 mb-8">
            <div className="space-y-3">
              <label className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Select Subject</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={cn(
                      "px-4 py-2 rounded-xl border text-sm font-bold transition-all",
                      subject === s ? "bg-orange-500 border-orange-500 text-white" : "bg-neutral-800 border-neutral-700 text-neutral-400"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-[2] relative">
                <input 
                  type="text" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter topic for PYQs (e.g. Life Processes)..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium"
                />
              </div>
              <div className="flex-1 bg-neutral-800 border border-neutral-700 rounded-2xl px-6 py-4 flex items-center gap-4">
                <span className="text-sm font-bold text-neutral-400 whitespace-nowrap">Count: {numQuestions}</span>
                <input 
                  type="range" 
                  min="5" 
                  max="20" 
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={generatePyqs}
            disabled={loading || !topic}
            className="w-full py-4 bg-orange-500 text-white font-black text-lg rounded-2xl flex items-center justify-center gap-3 hover:bg-orange-600 transition shadow-xl shadow-orange-500/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            GENERATE BOARD-ESSENTIAL QUESTIONS
          </button>
        </div>
        <Star className="absolute -top-10 -right-10 text-orange-500/5 rotate-12" size={300} />
      </div>

      {content && (
        <div className="bg-white text-black p-6 md:p-12 rounded-3xl shadow-2xl relative">
           <div className="absolute top-8 right-8 flex gap-2">
             <button onClick={() => {
               document.body.classList.add('handwritten-container');
               setTimeout(() => {
                 window.print();
                 document.body.classList.remove('handwritten-container');
               }, 50);
             }} className="p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition print-button-container">
               <Printer size={20} />
             </button>
          </div>
          
          <div className="mb-10 border-b-2 border-black pb-4">
            <h4 className="text-sm font-black uppercase tracking-widest text-neutral-500 mb-1">ScholarAI Board Prep Series</h4>
            <h1 className="text-3xl font-black">Expert Questions: {topic}</h1>
          </div>
          
          <div className="prose prose-neutral max-w-none prose-h2:mb-4 prose-p:leading-relaxed">
            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</Markdown>
          </div>
          
          <div className="mt-12 pt-8 border-t border-neutral-200 text-center text-xs text-neutral-400 font-medium">
             &copy; 2026 ScholarAI Expert Systems • High Probability Question Set
          </div>
        </div>
      )}
    </div>
  );
}
