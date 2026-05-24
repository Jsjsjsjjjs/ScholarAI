import { useState, useRef, useEffect } from "react";
import { Search, Book, FileText, Loader2, Sparkles, ChevronRight, Download, PenTool, Image as ImageIcon, FileOutput, WifiOff, MessageSquare, Layers, Presentation, ClipboardCheck } from "lucide-react";
import { elementToPdfBlob, elementToImageBlob, sendToDiscordWebhook } from "../lib/discord";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "../lib/utils";
import { updateProgress, trackAIUsage } from "../lib/firebase";
import { generateNotes as clientGenerateNotes } from "../lib/gemini";
import { useOnlineStatus, saveNotesToCache, getNotesFromCache, getAllCachedNotes, CachedNotes } from "../lib/offlineCache";
import { motion, AnimatePresence } from "motion/react";
import FlashcardMode from "./FlashcardMode";
import PPTMode, { PPTSlide } from "./PPTMode";
import TestMode, { TestQuestion } from "./TestMode";

export default function StudyGuide({ userData }: { userData?: any }) {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("Science");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"one-page" | "full">("one-page");
  const [studyMode, setStudyMode] = useState<"text" | "handwritten" | "flashcard" | "ppt" | "test">("text");
  const [exportError, setExportError] = useState<string | null>(null);
  const [cachedNotesList, setCachedNotesList] = useState<CachedNotes[]>([]);
  const notesRef = useRef<HTMLDivElement>(null);
  const pdfRenderRef = useRef<HTMLDivElement>(null);
  const flashcardPdfRenderRef = useRef<HTMLDivElement>(null);
  const flashcardImageRenderRef = useRef<HTMLDivElement>(null);
  const pptPdfRenderRef = useRef<HTMLDivElement>(null);
  const pptImageRenderRef = useRef<HTMLDivElement>(null);
  const testPdfRenderRef = useRef<HTMLDivElement>(null);
  const testImageRenderRef = useRef<HTMLDivElement>(null);
  const [activeFlashcards, setActiveFlashcards] = useState<any[]>([]);
  const [activePPTSlides, setActivePPTSlides] = useState<PPTSlide[]>([]);
  const [activeTestQuestions, setActiveTestQuestions] = useState<TestQuestion[]>([]);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    setCachedNotesList(getAllCachedNotes());
  }, [notes]);

  const generateNotes = async (type: "one-page" | "full") => {
    if (!topic) return;
    setLoading(true);
    setActiveType(type);
    setStudyMode("text");
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
    if (!notes || exporting) return;
    setExporting(true);
    try {
      const blob = new Blob([notes], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = topic.replace(/\s+/g, '-').toLowerCase() + '_notes.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Markdown export failed:', err);
      setExportError('⚠️ Failed to export Markdown: ' + (err.message || String(err)));
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      window.print();
    } catch (err: any) {
      console.error('PDF Export failed:', err);
      setExportError('⚠️ Failed to export as PDF: ' + (err.message || String(err)));
    } finally {
      setExporting(false);
    }
  };

  const shareToDiscord = async () => {
    if (!notes || !userData?.discordWebhookUrl || sharing) return;
    setSharing(true);
    setExportError(null);
    try {
      if (studyMode === "flashcard") {
        const pdfElement = flashcardPdfRenderRef.current;
        const imgElement = flashcardImageRenderRef.current;
        if (!pdfElement || !imgElement) {
          setExportError("⚠️ Flashcard elements are still preparing. Please wait a second.");
          setSharing(false);
          return;
        }

        const pdfBlob = await elementToPdfBlob(pdfElement);
        const imgBlob = await elementToImageBlob(imgElement);

        if (!pdfBlob || !imgBlob) {
          throw new Error("Failed to capture flashcard files.");
        }

        const payload = {
          embeds: [
            {
              title: "🔥 ScholarAI Active Recall Flashcard Deck Shared!",
              description: `A dynamic set of interactive flashcards on **${topic}** has been studied and shared. View the deck snapshot and full printable recall sheet attached below!`,
              color: 0xf97316,
              fields: [
                { name: "Subject", value: subject, inline: true },
                { name: "Topic", value: topic, inline: true },
                { name: "Cards in Deck", value: `${activeFlashcards.length} Interactive Cards`, inline: true }
              ],
              footer: {
                text: `Crafted by ${userData?.nickname || "Academic Elite"}`
              },
              timestamp: new Date().toISOString()
            }
          ]
        };

        await sendToDiscordWebhook({
          webhookUrl: userData.discordWebhookUrl,
          payload,
          fileBlob: pdfBlob,
          filename: `flashcards_${topic.replace(/\s+/g, '-').toLowerCase()}.pdf`,
          fileBlob2: imgBlob,
          filename2: `flashcard_snapshot_${topic.replace(/\s+/g, '-').toLowerCase()}.png`
        });
      } else if (studyMode === "ppt") {
        const pdfElement = pptPdfRenderRef.current;
        const imgElement = pptImageRenderRef.current;
        if (!pdfElement || !imgElement) {
          setExportError("⚠️ Presentation elements are still preparing. Please wait a second.");
          setSharing(false);
          return;
        }

        const pdfBlob = await elementToPdfBlob(pdfElement);
        const imgBlob = await elementToImageBlob(imgElement);

        if (!pdfBlob || !imgBlob) {
          throw new Error("Failed to capture presentation files.");
        }

        const payload = {
          embeds: [
            {
              title: "🎓 ScholarAI Lecture Presentation Slides Shared!",
              description: `A custom CBSE-standard classroom slideshow on **${topic}** has been processed. View the complete slide list as well as the snapshot preview attached below!`,
              color: 0xe07a5f,
              fields: [
                { name: "Subject", value: subject, inline: true },
                { name: "Topic", value: topic, inline: true },
                { name: "Slides", value: `${activePPTSlides.length} Slides`, inline: true }
              ],
              footer: {
                text: `Prepared by ${userData?.nickname || "Academic Elite"}`
              },
              timestamp: new Date().toISOString()
            }
          ]
        };

        await sendToDiscordWebhook({
          webhookUrl: userData.discordWebhookUrl,
          payload,
          fileBlob: pdfBlob,
          filename: `presentation_${topic.replace(/\s+/g, '-').toLowerCase()}.pdf`,
          fileBlob2: imgBlob,
          filename2: `presentation_snapshot_${topic.replace(/\s+/g, '-').toLowerCase()}.png`
        });
      } else if (studyMode === "test") {
        const pdfElement = testPdfRenderRef.current;
        const imgElement = testImageRenderRef.current;
        if (!pdfElement || !imgElement) {
          setExportError("⚠️ Practice Test elements are still preparing. Please wait a second.");
          setSharing(false);
          return;
        }

        const pdfBlob = await elementToPdfBlob(pdfElement);
        const imgBlob = await elementToImageBlob(imgElement);

        if (!pdfBlob || !imgBlob) {
          throw new Error("Failed to capture practice test files.");
        }

        const payload = {
          embeds: [
            {
              title: "📝 ScholarAI Board Practice Chapter Test Shared!",
              description: `A professional CBSE chapter assessment on **${topic}** has been generated and practiced. Check out the printable exam questionnaire and diagnostic topper report!`,
              color: 0x3d5a80,
              fields: [
                { name: "Subject", value: subject, inline: true },
                { name: "Topic", value: topic, inline: true },
                { name: "Total Questions", value: `${activeTestQuestions.length} Items`, inline: true }
              ],
              footer: {
                text: `Generated for ${userData?.nickname || "Academic Elite"}`
              },
              timestamp: new Date().toISOString()
            }
          ]
        };

        await sendToDiscordWebhook({
          webhookUrl: userData.discordWebhookUrl,
          payload,
          fileBlob: pdfBlob,
          filename: `practice_test_${topic.replace(/\s+/g, '-').toLowerCase()}.pdf`,
          fileBlob2: imgBlob,
          filename2: `practice_test_snapshot_${topic.replace(/\s+/g, '-').toLowerCase()}.png`
        });
      } else {
        const element = pdfRenderRef.current;
        if (!element) return;
        const pdfBlob = await elementToPdfBlob(element);
        
        const payload = {
          embeds: [
            {
              title: "📚 ScholarAI Study Notes Shared!",
              description: `A comprehensive set of study notes on **${topic}** has been automatically processed and archived.`,
              color: 0x5865F2,
              fields: [
                { name: "Subject", value: subject, inline: true },
                { name: "Topic", value: topic, inline: true },
                { name: "Resource Type", value: activeType === 'one-page' ? "One Page Summary" : "Full Comprehensive Guide", inline: true }
              ],
              footer: {
                text: `Archived by ${userData?.nickname || "Academic Elite"}`
              },
              timestamp: new Date().toISOString()
            }
          ]
        };

        await sendToDiscordWebhook({
          webhookUrl: userData.discordWebhookUrl,
          payload,
          fileBlob: pdfBlob,
          filename: `study_notes_${topic.replace(/\s+/g, '-').toLowerCase()}.pdf`
        });
      }
    } catch (err: any) {
      console.error("Shared to Discord error:", err);
      setExportError("⚠️ Discord export failed: " + (err.message || String(err)));
    } finally {
      setSharing(false);
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
                    setStudyMode("text");
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
          <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5 print:hidden">
            {/* Visual Study Formats Segmented Controller */}
            <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800/80 gap-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setStudyMode("text")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                  studyMode === "text" 
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/10" 
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <FileText size={13} />
                <span>Text Notes</span>
              </button>
              <button
                onClick={() => setStudyMode("handwritten")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                  studyMode === "handwritten" 
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/10" 
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <PenTool size={13} />
                <span>Handwritten</span>
              </button>
              <button
                onClick={() => setStudyMode("flashcard")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                  studyMode === "flashcard" 
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/10" 
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Layers size={13} />
                <span>Flashcards</span>
              </button>
              <button
                onClick={() => setStudyMode("ppt")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                  studyMode === "ppt" 
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/10" 
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Presentation size={13} />
                <span>Slideshow (PPT)</span>
              </button>
              <button
                onClick={() => setStudyMode("test")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap",
                  studyMode === "test" 
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/10" 
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <ClipboardCheck size={13} />
                <span>Practice Test</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button 
                onClick={downloadNotes}
                disabled={exporting}
                className="px-3.5 py-1.5 bg-neutral-800 text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700/50"
              >
                <Download size={13} />
                Markdown
              </button>
              <button 
                onClick={exportAsPDF}
                disabled={exporting}
                className="px-3.5 py-1.5 bg-neutral-800 text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-700/50"
              >
                <FileOutput size={13} />
                PDF
              </button>
              {userData?.discordWebhookUrl && (
                <button 
                  onClick={shareToDiscord}
                  disabled={sharing || !notes}
                  className="px-3.5 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sharing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    <>
                      <MessageSquare size={13} />
                      Share to Discord
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {exportError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-medium flex items-center justify-between print:hidden">
              <span>{exportError}</span>
              <button onClick={() => setExportError(null)} className="hover:text-red-400 font-bold ml-2">Dismiss</button>
            </div>
          )}

          {studyMode === "flashcard" ? (
            <div className="animate-fade-in print:hidden">
              <FlashcardMode 
                subject={subject} 
                topic={topic} 
                notesContent={notes} 
                onBackToNotes={() => setStudyMode("text")} 
                onFlashcardsLoaded={setActiveFlashcards}
              />
            </div>
          ) : studyMode === "ppt" ? (
            <div className="animate-fade-in print:hidden">
              <PPTMode 
                subject={subject} 
                topic={topic} 
                notesContent={notes || ""} 
                onBackToNotes={() => setStudyMode("text")} 
                onSlidesLoaded={setActivePPTSlides}
              />
            </div>
          ) : studyMode === "test" ? (
            <div className="animate-fade-in print:hidden text-left bg-neutral-900 border border-neutral-850 p-6 md:p-8 rounded-3xl">
              <TestMode 
                subject={subject} 
                topic={topic} 
                notesContent={notes || ""} 
                onBackToNotes={() => setStudyMode("text")} 
                onTestLoaded={setActiveTestQuestions}
              />
            </div>
          ) : (
            <div 
              ref={notesRef}
              className={cn(
                "rounded-3xl p-6 md:p-12 shadow-2xl transition-all duration-500 print:hidden",
                studyMode === "handwritten" 
                  ? "bg-[#fff9e6] text-[#2c1810] font-handwritten text-xl leading-relaxed border-2 border-[#e6dcc0]" 
                  : "bg-neutral-900 border border-neutral-800 text-neutral-200"
              )}
            >
              <div className={cn(
                "flex items-center justify-between mb-8 pb-4 border-b",
                studyMode === "handwritten" ? "border-[#e6dcc0]" : "border-neutral-800"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    studyMode === "handwritten" ? "bg-[#e6dcc0]" : "bg-orange-500/10"
                  )}>
                     <Book className={studyMode === "handwritten" ? "text-[#5d4037]" : "text-orange-500"} size={20} />
                  </div>
                  <h3 className={cn("text-xl font-bold m-0", studyMode === "handwritten" && "text-[#5d4037]")}>
                    {topic} - {activeType === 'one-page' ? 'Summary' : 'In-depth'}
                  </h3>
                </div>
                <span className={cn(
                  "text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest",
                  studyMode === "handwritten" ? "bg-[#f0e6c0] text-[#8d6e63]" : "bg-white/5 text-neutral-500"
                )}>
                  Study Notes
                </span>
              </div>
              <div className={cn(
                "prose max-w-none prose-lg",
                studyMode === "handwritten" ? "prose-stone prose-xl font-handwritten" : "prose-invert prose-orange"
              )}>
                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{notes}</Markdown>
              </div>
              
              {studyMode === "handwritten" && (
                <div className="mt-12 pt-8 border-t border-[#e6dcc0] flex justify-between text-xs text-[#8d6e63] font-bold uppercase">
                  <span>ScholarAI Handwriting Module</span>
                  <span>Page 01</span>
                </div>
              )}
            </div>
          )}

          {/* Hidden container on screen, perfectly positioned as printable-area for window.print() */}
          <div className="printable-area absolute -left-[9999px] top-0 pointer-events-none" style={{ width: "800px" }}>
            {/* Standard Study Notes Printable Wrapper */}
            <div 
              ref={pdfRenderRef}
              className="bg-white text-black p-6 md:p-12 rounded-[24px] relative text-left font-sans mb-8"
              style={{ width: "800px" }}
            >
              <div className="mb-10 border-b-2 border-black pb-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-[#737373] mb-1 font-sans">ScholarAI Board Prep Series</h4>
                <h1 className="text-3xl font-black text-black font-sans">Expert Notes: {topic}</h1>
              </div>
              
              <div className="prose prose-neutral max-w-none text-black font-sans prose-headings:text-black prose-p:text-black prose-p:leading-relaxed prose-strong:text-black prose-code:text-black prose-li:text-black font-medium">
                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{notes}</Markdown>
              </div>
              
              <div className="mt-12 pt-8 border-t border-neutral-200 text-center text-xs text-[#a3a3a3] font-medium font-sans">
                 &copy; 2026 ScholarAI Expert Systems • Expert Study Guide Set
              </div>
            </div>

            {/* Flashcard Printable Recall Layout */}
            <div 
              ref={flashcardPdfRenderRef}
              className="bg-white text-black p-8 md:p-12 rounded-[24px] relative text-left font-sans mb-8"
              style={{ width: "800px" }}
            >
              <div className="border-b-2 border-black pb-4 mb-6">
                <span className="text-xs font-black uppercase tracking-widest text-[#737373] font-sans">ScholarAI Active Recall System • Series 10</span>
                <h1 className="text-3xl font-black text-black font-sans mt-0.5">Flashcard Recall Sheet: {topic}</h1>
                <div className="flex gap-4 mt-2 text-xs font-semibold text-[#525252]">
                  <span>Subject: {subject}</span>
                  <span>•</span>
                  <span>Total Cards: {activeFlashcards.length}</span>
                </div>
              </div>

              {activeFlashcards.length === 0 ? (
                <p className="text-[#a3a3a3] italic">No active cards found in deck.</p>
              ) : (
                <div className="space-y-6">
                  {activeFlashcards.map((card, idx) => (
                    <div key={idx} className="p-5 border border-neutral-300 rounded-xl space-y-2 font-sans bg-[#fbfbfb]">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase text-orange-600 tracking-wider">
                        <span>Card {idx + 1} ({card.category || "General"})</span>
                        <span className="text-[#737373]">Recall Prep</span>
                      </div>
                      <div className="text-sm font-bold text-black border-b border-dashed border-neutral-200 pb-2">
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{card.front}</Markdown>
                      </div>
                      <div className="text-xs text-neutral-600 pt-1 leading-relaxed">
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{card.back}</Markdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-center text-[10px] text-neutral-400 font-medium pt-8 border-t border-neutral-200 mt-8">
                Printed via ScholarAI Elite Studio. Maintain consistent practices to maximize Board Exam scoring.
              </p>
            </div>

            {/* Flashcard Dashboard Graphic for Discord Capture */}
            <div 
              ref={flashcardImageRenderRef}
              className="bg-[#0c0c0e] text-neutral-200 p-8 rounded-[32px] border-4 border-neutral-800 relative text-left"
              style={{ width: "750px" }}
            >
              {/* Glowing header badge */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">
                    S
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-orange-400 tracking-widest block">ScholarAI Deck Snapshot</span>
                    <span className="text-xs font-medium text-neutral-400">Class 10 CBSE Board Prep Series</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-neutral-500">2026 Academic Season</span>
              </div>

              {/* Title & Topic info */}
              <div className="space-y-1 mb-6">
                <span className="text-xs font-black uppercase text-neutral-400 tracking-wider bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-md">
                  {subject}
                </span>
                <h1 className="text-2xl font-black text-white tracking-tight mt-2">{topic} Deck</h1>
              </div>

              {/* Stats Collage Row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#131316] border border-neutral-800 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-neutral-500 uppercase block">Total Cards</span>
                  <span className="text-2xl font-black text-orange-500 mt-1 block">{activeFlashcards.length}</span>
                </div>
                <div className="bg-[#131316] border border-neutral-800 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-neutral-500 uppercase block">Format</span>
                  <span className="text-sm font-black text-neutral-300 mt-2 block">ACTIVE RECALL</span>
                </div>
                <div className="bg-[#131316] border border-neutral-800 rounded-2xl p-4 text-center flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase block">Expert Verification</span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full mt-1.5 uppercase tracking-widest block">
                    ACTIVE
                  </span>
                </div>
              </div>

              {/* Key Cards Stack Preview */}
              <div className="space-y-3.5 pt-2 mb-6">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">Previewing core flashcards</span>
                
                {activeFlashcards.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">Pre-assembling flashcards...</p>
                ) : (
                  <div className="space-y-2.5">
                    {activeFlashcards.slice(0, 3).map((card, ri) => (
                      <div key={ri} className="bg-neutral-900/60 border border-neutral-800/85 rounded-2xl p-4 flex gap-4 items-center justify-between">
                        <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-[10px] font-mono font-bold text-orange-400 shrink-0">
                          0{ri + 1}
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block mb-0.5">{card.category || "Formula"}</span>
                          <p className="text-xs font-bold text-neutral-200 truncate">{card.front.replace(/^#+\s*/, '')}</p>
                        </div>
                        <span className="text-[10px] text-neutral-600 bg-neutral-950 border border-neutral-800 px-2 py-1 rounded uppercase tracking-wider font-bold shrink-0">
                          Flipped
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer attribution */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-900 text-[10px] text-neutral-600 font-bold">
                <span>VERIFIED BY SCHOLARAI GLOBAL API</span>
                <span>SECURED CORE ENGINE</span>
              </div>
            </div>

            {/* PPT Slides Printable Layout */}
            <div 
              ref={pptPdfRenderRef}
              className="bg-white text-black p-8 md:p-12 rounded-[24px] relative text-left font-sans mb-8"
              style={{ width: "800px" }}
            >
              <div className="border-b-2 border-black pb-4 mb-6">
                <span className="text-xs font-black uppercase tracking-widest text-[#737373] font-sans">ScholarAI Slideshow Deck Class 10 Series</span>
                <h1 className="text-3xl font-black text-black font-sans mt-0.5 animate-pulse">Presentation Slide Deck: {topic}</h1>
                <div className="flex gap-4 mt-2 text-xs font-semibold text-[#525252]">
                  <span>Subject: {subject}</span>
                  <span>•</span>
                  <span>Total Slides: {activePPTSlides.length}</span>
                </div>
              </div>

              {activePPTSlides.length === 0 ? (
                <p className="text-[#a3a3a3] italic font-sans text-sm">No slides loaded in deck.</p>
              ) : (
                <div className="space-y-8 font-sans">
                  {activePPTSlides.map((slide, sIdx) => (
                    <div key={sIdx} className="p-6 border border-neutral-300 rounded-xl space-y-4 bg-white">
                      <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
                        <h4 className="text-lg font-black text-black">Slide {sIdx + 1}: {slide.title}</h4>
                        <span className="text-xs font-mono font-bold text-neutral-500">Page {sIdx + 1}</span>
                      </div>
                      <ul className="list-disc list-inside space-y-2 text-sm text-neutral-850 font-medium font-sans">
                        {slide.bullets.map((b, bI) => (
                          <li key={bI}>
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{b}</Markdown>
                          </li>
                        ))}
                      </ul>
                      <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-1 mt-2">
                        <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider font-sans">Associated CBSE Exam Question</span>
                        <p className="text-xs font-bold text-black"><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{slide.importantQuestion}</Markdown></p>
                        <hr className="border-neutral-200 border-dashed my-2" />
                        <span className="text-[10px] font-black uppercase text-[#606060] tracking-wider font-sans">Topper Solution</span>
                        <div className="text-xs font-medium text-neutral-700 leading-relaxed font-sans prose prose-neutral max-w-none">
                          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{slide.solution}</Markdown>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PPT Slide Deck Dashboard Graphic for Discord Capture */}
            <div 
              ref={pptImageRenderRef}
              className="bg-[#0b0c10] text-neutral-200 p-8 rounded-[32px] border-4 border-neutral-800 relative text-left font-sans mb-8"
              style={{ width: "750px" }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">
                    P
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-orange-400 tracking-widest block">ScholarAI PPT Deck Snapshot</span>
                    <span className="text-xs font-medium text-neutral-400">Class 10 CBSE Board Lecture Series</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-neutral-500">2026 Academic Season</span>
              </div>

              <div className="space-y-1 mb-6">
                <span className="text-xs font-black uppercase text-neutral-400 tracking-wider bg-neutral-900 border border-neutral-850 px-3 py-1 rounded-md">
                  {subject}
                </span>
                <h1 className="text-2xl font-black text-white tracking-tight mt-2">{topic} Lecture Deck</h1>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#121316] border border-neutral-800 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-neutral-500 uppercase block font-sans">Slides Prepared</span>
                  <span className="text-2xl font-black text-orange-500 mt-1 block font-sans">{activePPTSlides.length}</span>
                </div>
                <div className="bg-[#121316] border border-neutral-800 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-neutral-500 uppercase block font-sans">CBSE Standard Syllabus</span>
                  <span className="text-sm font-black text-neutral-300 mt-2 block font-sans">FULLY COMPLIANT</span>
                </div>
              </div>

              <div className="space-y-3.5 pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block font-sans font-black">Slides overview</span>
                {activePPTSlides.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic font-sans text-sm">Preparing classroom slideshow slides...</p>
                ) : (
                  <div className="space-y-2">
                    {activePPTSlides.slice(0, 3).map((slide, sIdx) => (
                      <div key={sIdx} className="bg-neutral-900/60 border border-neutral-800/85 rounded-2xl p-3 flex gap-3 items-center justify-between">
                        <div className="w-8 h-8 rounded-full bg-orange-300/10 flex items-center justify-center text-[10px] font-mono font-bold text-orange-400 shrink-0">
                          {sIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-xs font-bold text-neutral-200 truncate">{slide.title}</p>
                          <span className="text-[9px] text-neutral-500 block truncate">{slide.bullets[0].replace(/^#+\s*/, '')}</span>
                        </div>
                        <span className="text-[8px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded uppercase tracking-wider font-bold">
                          Lecture Slide
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Practice Test Printable Layout */}
            <div 
              ref={testPdfRenderRef}
              className="bg-white text-black p-8 md:p-12 rounded-[24px] relative text-left font-sans mb-8"
              style={{ width: "800px" }}
            >
              <div className="border-b-2 border-black pb-4 mb-6">
                <span className="text-xs font-black uppercase tracking-widest text-[#737373] font-sans">ScholarAI Elite Practise Assessment Series</span>
                <h1 className="text-3xl font-black text-black font-sans mt-0.5">Chapter Mock Test Paper: {topic}</h1>
                <div className="flex gap-4 mt-2 text-xs font-semibold text-[#525252]">
                  <span>Subject: {subject}</span>
                  <span>•</span>
                  <span>Allowed Duration: 15 Minutes</span>
                </div>
              </div>

              {activeTestQuestions.length === 0 ? (
                <p className="text-[#a3a3a3] italic font-sans text-sm">No practice test generated.</p>
              ) : (
                <div className="space-y-6">
                  {activeTestQuestions.map((question, idx) => (
                    <div key={idx} className="p-5 border border-neutral-300 rounded-xl space-y-3 bg-white font-sans">
                      <div className="flex justify-between items-center text-xs font-black text-neutral-600 pb-1.5 border-b border-neutral-100">
                        <span>Question {idx + 1} ({question.type.toUpperCase()})</span>
                        <span className="text-orange-600">CBSE Spec</span>
                      </div>
                      <p className="text-sm font-bold text-black font-sans"><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{question.questionText}</Markdown></p>
                      {question.options && (
                        <div className="grid grid-cols-2 gap-2 text-xs text-neutral-700 pt-1">
                          {question.options.map((opt, oI) => (
                            <div key={oI} className="p-2 border border-neutral-200 rounded-lg bg-neutral-50">
                              <strong>Option {String.fromCharCode(65 + oI)}:</strong> <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</Markdown>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg text-xs leading-relaxed text-neutral-800 mt-2">
                        <strong className="text-emerald-700 block uppercase font-sans text-[10px] tracking-wider">Correct Option / Grader Guideline:</strong>
                        <p className="font-bold my-1"><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{question.correctOption}</Markdown></p>
                        <hr className="border-emerald-200/50 my-1.5" />
                        <strong className="text-neutral-500 block uppercase font-sans text-[9px] tracking-wider">Full Topper Marking Solution:</strong>
                        <div className="text-neutral-600 prose prose-neutral max-w-none prose-xs font-sans mt-1">
                          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{question.detailedSolution}</Markdown>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Practice Test Dashboard Graphic for Discord Capture */}
            <div 
              ref={testImageRenderRef}
              className="bg-[#0e0f14] text-neutral-200 p-8 rounded-[32px] border-4 border-neutral-800 relative text-left font-sans"
              style={{ width: "750px" }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-sm">
                    T
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-orange-400 tracking-widest block">ScholarAI Exam Snapshot</span>
                    <span className="text-xs font-medium text-neutral-400">Class 10 CBSE Chapter Practice Exam</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-neutral-500">2026 Academic Season</span>
              </div>

              <div className="space-y-1 mb-6">
                <span className="text-xs font-black uppercase text-neutral-400 tracking-wider bg-neutral-900 border border-neutral-850 px-3 py-1 rounded-md">
                  {subject}
                </span>
                <h1 className="text-2xl font-black text-white tracking-tight mt-2">{topic} Practice Test</h1>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#14151a] border border-neutral-800 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-neutral-500 uppercase block font-sans font-bold text-neutral-400">Questions</span>
                  <span className="text-xl font-black text-orange-500 mt-1 block font-sans">{activeTestQuestions.length}</span>
                </div>
                <div className="bg-[#14151a] border border-neutral-800 rounded-2xl p-4 text-center">
                  <span className="text-xs font-bold text-neutral-500 uppercase block font-sans font-bold text-neutral-400">Exam Mode</span>
                  <span className="text-sm font-black text-neutral-300 mt-2 block font-sans">CBSE BOARD</span>
                </div>
                <div className="bg-[#14151a] border border-neutral-800 rounded-2xl p-4 text-center flex flex-col items-center justify-center">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase block font-bold text-neutral-400">Grading</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded mt-1 text-center font-sans tracking-widest uppercase block">
                    TOPPER
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block font-sans font-black">Assembled Mock Exam Questions</span>
                {activeTestQuestions.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic font-sans text-sm">Compiling test items...</p>
                ) : (
                  <div className="space-y-2">
                    {activeTestQuestions.map((question, qIdx) => (
                      <div key={qIdx} className="bg-[#17181f]/75 border border-neutral-800 rounded-2xl p-3 flex gap-3 items-center justify-between">
                        <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-[10px] font-mono font-bold text-orange-400 shrink-0">
                          {qIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <span className="text-[8px] font-black uppercase text-neutral-500 tracking-wider block mb-0.5">{question.type}</span>
                          <p className="text-xs font-bold text-neutral-200 truncate">{question.questionText.replace(/^#+\s*/, '')}</p>
                        </div>
                        <span className="text-[9px] text-neutral-600 bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                          CBSE Core
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );                     
}
