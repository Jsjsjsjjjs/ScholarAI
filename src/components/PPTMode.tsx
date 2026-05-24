import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, Loader2, Sparkles, BookOpen, Presentation, RefreshCw, HelpCircle, Eye, EyeOff } from "lucide-react";
import { generatePPTSlides } from "../lib/gemini";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { motion, AnimatePresence } from "motion/react";
import { useOnlineStatus } from "../lib/offlineCache";

export interface PPTSlide {
  title: string;
  bullets: string[];
  importantQuestion?: string;
  solution?: string;
  visualPrompt?: string;
}

interface PPTModeProps {
  subject: string;
  topic: string;
  notesContent: string;
  onBackToNotes?: () => void;
  onSlidesLoaded?: (slides: PPTSlide[]) => void;
}

export default function PPTMode({ subject, topic, notesContent, onBackToNotes, onSlidesLoaded }: PPTModeProps) {
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<PPTSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  // Load slides on mount/topic change
  useEffect(() => {
    loadSlides();
    setCurrentIndex(0);
    setIsPlaying(false);
    setShowSolution(false);
  }, [subject, topic]);

  // Autoplay functionality
  useEffect(() => {
    let interval: any;
    if (isPlaying && slides.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= slides.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          setShowSolution(false);
          return prev + 1;
        });
      }, 7000); // 7s slide duration
    }
    return () => clearInterval(interval);
  }, [isPlaying, slides]);

  const loadSlides = async () => {
    setLoading(true);
    setErrorMsg(null);
    const cacheKey = `scholar_ppt_${subject.replace(/\s+/g, "_")}_${topic.replace(/\s+/g, "_")}`;
    
    try {
      // 1. Try local cache first
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PPTSlide[];
        if (parsed && parsed.length > 0) {
          setSlides(parsed);
          setLoading(false);
          onSlidesLoaded?.(parsed);
          return;
        }
      }

      // 2. Fallback offline generator if no connection
      if (!isOnline) {
        const fallback = generateOfflineSlides();
        setSlides(fallback);
        onSlidesLoaded?.(fallback);
        setLoading(false);
        return;
      }

      // 3. Generate via Gemini
      const generated = await generatePPTSlides(subject, topic, notesContent);
      if (generated && generated.length > 0) {
        const validated: PPTSlide[] = generated.map((s: any) => ({
          title: s.title || "Key Concept Breakdown",
          bullets: s.bullets || s.bulletPoints || ["Important learning parameters details"],
          importantQuestion: s.importantQuestion || s.highlight || "Practice Problem",
          solution: s.solution || "Refer to core notes for complete analytical solution layout.",
          visualPrompt: s.visualPrompt || s.visualDescription || "A clear bento diagram layout"
        }));
        setSlides(validated);
        localStorage.setItem(cacheKey, JSON.stringify(validated));
        onSlidesLoaded?.(validated);
      } else {
        throw new Error("Empty array returned from generator.");
      }
    } catch (error: any) {
      console.error("PPT Generation failure:", error);
      const fallback = generateOfflineSlides();
      setSlides(fallback);
      onSlidesLoaded?.(fallback);
      setErrorMsg("⚠️ Offline Mode: Structured slides parsed automatically from study text.");
    } finally {
      setLoading(false);
    }
  };

  const generateOfflineSlides = (): PPTSlide[] => {
    // Basic text extractor to populate slide slides offline
    const paragraphs = notesContent
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 20);

    const generated: PPTSlide[] = [
      {
        title: `Introduction: ${topic}`,
        bullets: [
          `Comprehensive board exam level analysis of ${topic} under ${subject}.`,
          "Reviewing fundamental axioms, core definitions, and primary textbook exercises.",
          "Perfecting answer structures for Class X terminal examinations."
        ],
        importantQuestion: `Define ${topic} and explain its basic importance in ${subject}.`,
        solution: "Refer to Chapter Introduction notes for a precise textual answer sequence.",
        visualPrompt: "Slide Title with modern corporate vector layouts."
      }
    ];

    // Grab a few bullets or points from notes
    const matches = notesContent.match(/-\s+(.*)/g);
    if (matches && matches.length > 0) {
      const bulletGroup1 = matches.slice(0, Math.min(4, matches.length)).map(m => m.replace(/^-\s+/, ''));
      const bulletGroup2 = matches.slice(4, Math.min(8, matches.length)).map(m => m.replace(/^-\s+/, ''));
      
      if (bulletGroup1.length > 0) {
        generated.push({
          title: "Core Mechanics & Concepts",
          bullets: bulletGroup1,
          importantQuestion: "Explain the main processes shown in board models.",
          solution: "Review standard CBSE marks allocations for bullet-point structures.",
          visualPrompt: "Symmetrical process chart showcasing pathways."
        });
      }
      if (bulletGroup2.length > 0) {
        generated.push({
          title: "Technical Breakdowns & Calculations",
          bullets: bulletGroup2,
          importantQuestion: "Solve high priority textbook numerical derivations.",
          solution: "Identify variables, establish equations, substitute values, state final units.",
          visualPrompt: "Side-by-side comparison layout with formula focus."
        });
      }
    } else {
      // Create simple slides from paragraphs
      const slideParas = paragraphs.slice(0, Math.min(3, paragraphs.length));
      slideParas.forEach((p, idx) => {
        generated.push({
          title: `Key Topic Takeaway 0${idx + 1}`,
          bullets: [p.slice(0, 150) + "...", "Prepare diagram references.", "Verify definitions in standard worksheets."],
          importantQuestion: "Why is this system standard in experimental set-ups?",
          solution: "Allows absolute tracking control without external variables.",
          visualPrompt: "Bold structural layout with highlighting accents."
        });
      });
    }

    generated.push({
      title: "Summary & Exam Hacks",
      bullets: [
        "Synthesize bullet points for 5-mark subjective answers.",
        "Always sketch neat labeled neat pencil diagrams.",
        "Ensure correct units and balanced reactions for maths/science scripts."
      ],
      importantQuestion: "Explain standard final preparation guidelines.",
      solution: "Review revision sheets daily, practice previous papers, cross check solutions.",
      visualPrompt: "Dark sleek concluding slide."
    });

    return generated;
  };

  const handlePrev = () => {
    setIsPlaying(false);
    setShowSolution(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setShowSolution(false);
    setCurrentIndex((prev) => Math.min(slides.length - 1, prev + 1));
  };

  if (loading) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-16 flex flex-col items-center justify-center text-center space-y-4">
        <Loader2 className="animate-spin text-orange-500" size={40} />
        <div className="space-y-1">
          <p className="font-bold text-neutral-200">Assembling Classroom Slideshow...</p>
          <p className="text-xs text-neutral-500">Formulating bento cards, extracting key questions and drawing whiteboard prompts.</p>
        </div>
      </div>
    );
  }

  const slide = slides[currentIndex];

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {slides.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-12 text-center text-neutral-500 font-medium">
          No slides prepared.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quick Stats bar */}
          <div className="flex items-center justify-between text-xs text-neutral-500 px-2 font-bold">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-orange-400">
              <Presentation size={13} />
              Slide Presentations Mode
            </span>
            <span>
              Slide {currentIndex + 1} of {slides.length}
            </span>
          </div>

          {/* Core Widescreen Slide Stage (16:9 Aspect) */}
          <div className="relative aspect-video w-full bg-[#0d0e11] border-2 border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-6 sm:p-8 md:p-10 select-none">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.06),transparent_50%)] pointer-events-none" />
            
            {/* Slide Header */}
            <div className="flex items-start justify-between z-10 border-b border-white/5 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#a3a3a3] block">
                  {subject} • Presentation Deck
                </span>
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black text-white tracking-tight leading-none">
                  {slide.title}
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 bg-white/5 border border-white/10 rounded text-neutral-400 shrink-0 uppercase tracking-widest font-black">
                Slide 0{currentIndex + 1}
              </span>
            </div>

            {/* Slide Core Content area (Flex layout split) */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8 items-center py-4 z-10 flex-1 overflow-y-auto scrollbar-thin">
              {/* Takeaways List */}
              <div className="md:col-span-3 space-y-3.5 pr-4">
                {slide.bullets.map((point, pi) => (
                  <div key={pi} className="flex gap-2.5 items-start">
                    <span className="w-5 h-5 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold text-orange-400 shrink-0 mt-0.5">
                      {pi + 1}
                    </span>
                    <p className="text-xs sm:text-sm md:text-[15px] font-medium text-neutral-300 leading-relaxed">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{point}</Markdown>
                    </p>
                  </div>
                ))}
              </div>

              {/* High Yield Highlight / Question Interactive Deck Breakout */}
              <div className="md:col-span-2 bg-[#14151a] border border-white/5 rounded-2xl p-5 space-y-4 shadow-inner">
                <div className="flex items-center gap-1.5 border-b border-white/5 pb-2.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider flex items-center gap-1">
                    <HelpCircle size={11} />
                    Exam Practice Problem
                  </span>
                </div>
                
                <div className="text-xs sm:text-sm font-bold text-white max-h-[100px] overflow-y-auto leading-relaxed">
                  <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{slide.importantQuestion || "Define active recall and discuss its benefits."}</Markdown>
                </div>

                {slide.solution && (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowSolution(!showSolution)}
                      className="w-full py-2 bg-neutral-800 hover:bg-neutral-700/80 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-wider text-neutral-300 transition flex items-center justify-center gap-1 px-4"
                    >
                      {showSolution ? (
                        <>
                          <EyeOff size={11} />
                          Hide Solution
                        </>
                      ) : (
                        <>
                          <Eye size={11} />
                          Reveal CBSE Answer Scheme
                        </>
                      )}
                    </button>
                    
                    <AnimatePresence>
                      {showSolution && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="text-[11px] text-[#a3a3a3] font-medium leading-relaxed bg-[#0a0a0c] p-3 rounded-lg border border-white/5 max-h-[140px] overflow-y-auto">
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{slide.solution}</Markdown>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* Slide Footer */}
            <div className="flex items-center justify-between z-10 border-t border-white/5 pt-3 text-[9px] font-bold tracking-widest text-[#525252] uppercase shrink-0">
              <span className="flex items-center gap-1">
                <BookOpen size={10} />
                Visual Blueprint Plan: {slide.visualPrompt || "Centralized high-contrast visual display"}
              </span>
              <span>
                ScholarAI presentation systems
              </span>
            </div>
          </div>

          {/* Slideshow Control Panel */}
          <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-2xl p-4 gap-4 print:hidden">
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-xl text-neutral-300 transition"
              >
                <ChevronLeft size={18} />
              </button>
              
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 transition text-xs uppercase tracking-wider"
              >
                {isPlaying ? (
                  <>
                    <Pause size={14} className="fill-white" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-white" />
                    Autoplay
                  </>
                )}
              </button>

              <button
                onClick={handleNext}
                disabled={currentIndex === slides.length - 1}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-xl text-neutral-300 transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Progress dots bar */}
            <div className="flex gap-1.5 max-w-[200px] overflow-x-auto py-1 scrollbar-hide">
              {slides.map((_, sidx) => (
                <button
                  key={sidx}
                  onClick={() => {
                    setCurrentIndex(sidx);
                    setIsPlaying(false);
                    setShowSolution(false);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    sidx === currentIndex ? "bg-orange-500 w-6" : "bg-neutral-800 hover:bg-neutral-600"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={loadSlides}
              className="text-neutral-400 hover:text-white p-2.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition text-xs font-bold flex items-center gap-1 uppercase"
            >
              <RefreshCw size={13} />
              Regen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
