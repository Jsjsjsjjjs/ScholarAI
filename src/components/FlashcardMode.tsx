import { useState, useEffect } from "react";
import { 
  Shuffle, 
  RotateCw, 
  CheckCircle, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Loader2, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  Layers, 
  BookOpen,
  ArrowRightLeft
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { generateFlashcards } from "../lib/gemini";
import { saveFlashcardsToCache, getFlashcardsFromCache, useOnlineStatus } from "../lib/offlineCache";
import { cn } from "../lib/utils";

interface Flashcard {
  front: string;
  back: string;
  category: string;
  mastered?: boolean;
  needsReview?: boolean;
}

interface FlashcardModeProps {
  subject: string;
  topic: string;
  notesContent: string;
  onBackToNotes?: () => void;
  onFlashcardsLoaded?: (cards: Flashcard[]) => void;
}

export default function FlashcardMode({ subject, topic, notesContent, onBackToNotes, onFlashcardsLoaded }: FlashcardModeProps) {
  const [loading, setLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // self-assessment states
  const [masteredIds, setMasteredIds] = useState<Set<number>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<number>>(new Set());
  
  const isOnline = useOnlineStatus();

  // Load flashcards from cache or Gemini on mount/topic change
  useEffect(() => {
    // 1. Try local storage cache synchronously first to avoid setting loading state
    const cached = getFlashcardsFromCache(subject, topic);
    if (cached && cached.length > 0) {
      setFlashcards(cached);
      setLoading(false);
      onFlashcardsLoaded?.(cached);
    } else {
      loadFlashcards();
    }
    // Reset states on topic change
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredIds(new Set());
    setReviewIds(new Set());
  }, [topic, subject, notesContent]);

  // Robust offline scraper to extract flashcards directly from Markdown if offline/failure
  const parseLocalMarkdownNotes = (markdown: string): Flashcard[] => {
    const cards: Flashcard[] = [];
    try {
      // Split by heading levels or standard lists
      const sections = markdown.split(/(?=###\s+|##\s+)/g);
      
      for (const section of sections) {
        const lines = section.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) continue;
        
        let titleLine = lines[0];
        // Clean markdown headings
        titleLine = titleLine.replace(/^#+\s*/, '').replace(/\*+/g, '');
        
        if (lines.length > 1 && titleLine.length < 80) {
          // Join the rest as the answer/back
          const backContent = lines.slice(1).join('\n');
          // Skip if too short
          if (backContent.length < 10) continue;
          
          cards.push({
            front: titleLine,
            back: backContent,
            category: "Core Concept"
          });
        }
      }
      
      // Secondary backup: Match bold expressions like "**Concept**: details"
      if (cards.length < 3) {
        const bulletRegex = /\*\*(.*?)\*\*:\s*(.*)/g;
        let match;
        while ((match = bulletRegex.exec(markdown)) !== null) {
          if (match[1] && match[2] && match[1].length < 60) {
            cards.push({
              front: match[1],
              back: match[2],
              category: "Quick Term"
            });
          }
        }
      }
    } catch (e) {
      console.error("Local markdown parsing failed", e);
    }
    
    // Fallback card if nothing extracted
    if (cards.length === 0) {
      cards.push({
        front: `Key Revision: ${topic}`,
        back: `Review the Study Guide notes carefully. Note contains high-yield summaries for Class 10th preparation, equations, and practice guidelines.`,
        category: "Intro"
      });
    }
    
    return cards;
  };

  const loadFlashcards = async () => {
    setLoading(true);
    setErrorMsg(null);
    let finalFlashcards: Flashcard[] = [];
    try {
      // 1. Try local storage cache first
      const cached = getFlashcardsFromCache(subject, topic);
      if (cached && cached.length > 0) {
        finalFlashcards = cached;
        setFlashcards(cached);
        setLoading(false);
        onFlashcardsLoaded?.(cached);
        return;
      }

      // 2. Offline fallback
      if (!isOnline) {
        const parsed = parseLocalMarkdownNotes(notesContent);
        finalFlashcards = parsed;
        setFlashcards(parsed);
        saveFlashcardsToCache(subject, topic, parsed);
        setLoading(false);
        onFlashcardsLoaded?.(parsed);
        return;
      }

      // 3. API Fetch
      const generated = await generateFlashcards(subject, topic, notesContent);
      if (generated && generated.length > 0) {
        finalFlashcards = generated;
        setFlashcards(generated);
        saveFlashcardsToCache(subject, topic, generated);
      } else {
        // Fallback to offline parser if API returned empty
        const parsed = parseLocalMarkdownNotes(notesContent);
        finalFlashcards = parsed;
        setFlashcards(parsed);
      }
    } catch (error: any) {
      console.error("Failed to load flashcards:", error);
      const parsed = parseLocalMarkdownNotes(notesContent);
      finalFlashcards = parsed;
      setFlashcards(parsed);
      setErrorMsg("⚠️ Note: Flashcards generated using offline text processor.");
    } finally {
      setLoading(false);
      if (finalFlashcards.length > 0) {
        onFlashcardsLoaded?.(finalFlashcards);
        
        // Save to Firestore so the bots and user library have access to it
        const rawDataString = finalFlashcards.map((c, i) => `[Card ${i+1}] ${c.category}\nFront: ${c.front}\nBack: ${c.back}\n`).join('\n');
        import("../lib/firebase").then(({ saveGeneratedAsset }) => {
          saveGeneratedAsset(`${topic} - Flashcards`, 'flashcards', rawDataString).catch(console.error);
        }).catch(err => console.error(err));
      }
    }
  };

  const speakText = (text: string) => {
    if (isMuted) return;
    try {
      window.speechSynthesis.cancel();
      // Clean up markdown/latex before speaking
      const cleanText = text
        .replace(/\$[^$]+\$/g, '') 
        .replace(/\#+/g, '')
        .replace(/\*+/g, '')
        .replace(/`[^`]+`/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis rejected:", e);
    }
  };

  const toggleFlip = () => {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    
    // Announce the content
    if (nextFlipped && !isMuted && flashcards[currentIndex]) {
      speakText(flashcards[currentIndex].back);
    } else if (!nextFlipped && !isMuted && flashcards[currentIndex]) {
      speakText(flashcards[currentIndex].front);
    }
  };

  const handleNext = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  const handlePrev = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const handleShuffle = () => {
    if (flashcards.length <= 1) return;
    setIsFlipped(false);
    // Shuffle arrays
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentIndex(0);
    setMasteredIds(new Set());
    setReviewIds(new Set());
  };

  const markMastered = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card flip
    const nextMastered = new Set(masteredIds);
    const nextReview = new Set(reviewIds);
    
    if (nextMastered.has(idx)) {
      nextMastered.delete(idx);
    } else {
      nextMastered.add(idx);
      nextReview.delete(idx); // Mutually exclusive
    }
    
    setMasteredIds(nextMastered);
    setReviewIds(nextReview);
  };

  const markNeedsReview = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card flip
    const nextMastered = new Set(masteredIds);
    const nextReview = new Set(reviewIds);
    
    if (nextReview.has(idx)) {
      nextReview.delete(idx);
    } else {
      nextReview.add(idx);
      nextMastered.delete(idx); // Mutually exclusive
    }
    
    setMasteredIds(nextMastered);
    setReviewIds(nextReview);
  };

  const currentCard = flashcards[currentIndex];
  
  // High fidelity stats
  const totalCards = flashcards.length;
  const masteredCount = masteredIds.size;
  const reviewCount = reviewIds.size;
  const unreviewedCount = Math.max(0, totalCards - masteredCount - reviewCount);
  const completionRate = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-neutral-900 border border-neutral-800 rounded-3xl min-h-[400px]">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="text-neutral-400 font-bold text-sm uppercase tracking-widest animate-pulse">
          Crafting Elite Flashcard Deck...
        </p>
        <p className="text-neutral-500 text-xs mt-2">Classifying key processes, definitions, and equations</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upper Options Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Layers className="text-orange-500" size={18} />
          <div>
            <span className="text-xs font-black uppercase text-neutral-500 tracking-wider">Academics</span>
            <h4 className="text-sm font-bold text-neutral-200 truncate max-w-xs">{topic} - Active Deck</h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {errorMsg && (
            <span className="text-[11px] font-medium text-amber-500 mr-2 hidden sm:inline">
              {errorMsg}
            </span>
          )}
          
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "p-2.5 rounded-xl border transition-all text-neutral-400 hover:text-white",
              isMuted ? "bg-neutral-800 border-neutral-700" : "bg-orange-500/10 border-orange-500/30 text-orange-400"
            )}
            title={isMuted ? "Unmute TTS Audio" : "Mute TTS Audio"}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 border border-neutral-700 hover:border-neutral-500 text-neutral-300 text-xs font-bold rounded-xl transition"
            title="Shuffle active set"
          >
            <Shuffle size={14} />
            <span>Shuffle</span>
          </button>

          {onBackToNotes && (
            <button
              onClick={onBackToNotes}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition shadow-md shadow-orange-500/10"
            >
              <BookOpen size={14} />
              <span>Study Notes</span>
            </button>
          )}
        </div>
      </div>

      {flashcards.length === 0 ? (
        <div className="text-center p-12 bg-neutral-900 border border-neutral-800 rounded-3xl">
          <HelpCircle className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <p className="text-neutral-400 font-bold text-sm">No flashcards could be parsed.</p>
          <p className="text-neutral-500 text-xs mt-1">Try to regenerate study notes first or pick another topic.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Flashcard Column */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Elegant 3D Flip Card Container */}
            <div 
              id="active-study-flashcard"
              className="group cursor-pointer select-none perspective-[1000px] h-[340px] md:h-[380px] w-full relative"
              onClick={toggleFlip}
            >
              {/* Card Face Wrapper */}
              <div 
                className={cn(
                  "w-full h-full duration-700 preserve-3d relative rounded-3xl transition-transform ease-out-cubic",
                  isFlipped ? "rotate-y-180" : ""
                )}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* FRONT FACE */}
                <div 
                  className={cn(
                    "absolute inset-0 w-full h-full rounded-3xl p-8 md:p-12 flex flex-col justify-between backface-hidden border-2 shadow-2xl transition-all duration-300",
                    masteredIds.has(currentIndex) 
                      ? "bg-emerald-950/20 border-emerald-500/30" 
                      : reviewIds.has(currentIndex)
                      ? "bg-rose-950/20 border-rose-500/30"
                      : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                  )}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      {currentCard?.category || "Concept"}
                    </span>
                    <span className="text-xs font-mono text-neutral-500">
                      Card {currentIndex + 1} of {totalCards}
                    </span>
                  </div>

                  {/* Question Section */}
                  <div className="my-auto text-center space-y-4">
                    <div className="prose prose-invert prose-orange max-w-none text-xl sm:text-2xl font-bold tracking-tight leading-relaxed text-neutral-100">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {currentCard?.front}
                      </Markdown>
                    </div>
                  </div>

                  {/* Feedback Bar */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => markNeedsReview(currentIndex, e)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition",
                          reviewIds.has(currentIndex)
                            ? "bg-rose-500 text-white"
                            : "bg-neutral-800 text-neutral-400 hover:text-rose-400"
                        )}
                        title="Mark for active revision"
                      >
                        <XCircle size={14} />
                        <span className="hidden sm:inline">Review</span>
                      </button>

                      <button
                        onClick={(e) => markMastered(currentIndex, e)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition",
                          masteredIds.has(currentIndex)
                            ? "bg-emerald-500 text-white"
                            : "bg-neutral-800 text-neutral-400 hover:text-emerald-400"
                        )}
                        title="Mark as understood"
                      >
                        <CheckCircle size={14} />
                        <span className="hidden sm:inline">Mastered</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold animate-pulse">
                      <RotateCw size={12} />
                      <span>Click to reveal explanation</span>
                    </div>
                  </div>
                </div>

                {/* BACK FACE */}
                <div 
                  className={cn(
                    "absolute inset-0 w-full h-full rounded-3xl p-8 md:p-12 flex flex-col justify-between backface-hidden border-2 shadow-2xl rotate-y-180",
                    "bg-gradient-to-b from-neutral-900 to-neutral-950 border-orange-500/30"
                  )}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-orange-400 tracking-widest bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                      Answer / Explanation
                    </span>
                    <span className="text-xs font-mono text-neutral-500">
                      Card {currentIndex + 1} of {totalCards}
                    </span>
                  </div>

                  {/* Answer detail with full Markdown/LaTeX Support */}
                  <div className="my-auto overflow-y-auto max-h-[180px] pr-2 scrollbar-thin scrollbar-thumb-neutral-800">
                    <div className="prose prose-invert prose-orange max-w-none text-sm sm:text-base leading-relaxed text-neutral-300">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {currentCard?.back}
                      </Markdown>
                    </div>
                  </div>

                  {/* Back Face Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-800/60">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => markNeedsReview(currentIndex, e)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition",
                          reviewIds.has(currentIndex)
                            ? "bg-rose-500 text-white"
                            : "bg-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-rose-400"
                        )}
                      >
                        <XCircle size={14} />
                        <span className="hidden sm:inline">Review</span>
                      </button>

                      <button
                        onClick={(e) => markMastered(currentIndex, e)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition",
                          masteredIds.has(currentIndex)
                            ? "bg-emerald-500 text-white"
                            : "bg-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400"
                        )}
                      >
                        <CheckCircle size={14} />
                        <span className="hidden sm:inline">Mastered</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-orange-400 font-semibold">
                      <ArrowRightLeft size={12} />
                      <span>Flip back</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrev}
                className="flex items-center justify-center w-12 h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-neutral-300 hover:text-white rounded-full transition"
                title="Previous card"
              >
                <ChevronLeft size={22} />
              </button>

              <div className="flex gap-2.5">
                {flashcards.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentIndex(idx);
                    }}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-all duration-300",
                      currentIndex === idx 
                        ? "bg-orange-500 w-6" 
                        : masteredIds.has(idx)
                        ? "bg-emerald-500/80"
                        : reviewIds.has(idx)
                        ? "bg-rose-500/80"
                        : "bg-neutral-700 hover:bg-neutral-500"
                    )}
                    title={`Go to card ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="flex items-center justify-center w-12 h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-neutral-300 hover:text-white rounded-full transition"
                title="Next card"
              >
                <ChevronRight size={22} />
              </button>
            </div>

          </div>

          {/* Sidebar Analytics Dashboard Column */}
          <div className="space-y-6">
            
            {/* Stats Overview */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-5">
              <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-orange-500" />
                Deck Statistics
              </h4>

              <div className="space-y-3.5">
                {/* Mastered stat */}
                <div className="flex items-center justify-between p-3 bg-emerald-950/10 border border-emerald-500/20 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-emerald-500" size={16} />
                    <span className="text-xs font-bold text-neutral-300">Mastered</span>
                  </div>
                  <span className="text-sm font-black text-emerald-400">{masteredCount}</span>
                </div>

                {/* Revive stat */}
                <div className="flex items-center justify-between p-3 bg-rose-950/10 border border-rose-500/20 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <XCircle className="text-rose-500" size={16} />
                    <span className="text-xs font-bold text-neutral-300">Needs Review</span>
                  </div>
                  <span className="text-sm font-black text-rose-400">{reviewCount}</span>
                </div>

                {/* Unreviewed stats */}
                <div className="flex items-center justify-between p-3 bg-neutral-800/40 border border-neutral-800 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="text-neutral-500" size={16} />
                    <span className="text-xs font-bold text-neutral-400">Unreviewed</span>
                  </div>
                  <span className="text-sm font-black text-neutral-400">{unreviewedCount}</span>
                </div>
              </div>

              {/* Progress visual list */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-bold">Mastery Progress</span>
                  <span className="font-mono font-bold text-orange-400">{completionRate}%</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
                <p className="text-[10px] text-neutral-500 leading-normal text-center mt-1">
                  Keep flipping and testing yourself until you reach 100% mastery!
                </p>
              </div>
            </div>

            {/* List selector of card decks */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
              <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider mb-4 flex items-center gap-1.5">
                <Layers size={14} className="text-orange-500" />
                Select Term
              </h4>
              
              <div className="space-y-1.5 max-h-[185px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
                {flashcards.map((card, i) => {
                  const hasMastered = masteredIds.has(i);
                  const hasReview = reviewIds.has(i);
                  
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setIsFlipped(false);
                        setCurrentIndex(i);
                      }}
                      className={cn(
                        "w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between",
                        currentIndex === i
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-400 font-bold"
                          : hasMastered
                          ? "bg-emerald-950/5 border-emerald-900/20 text-emerald-400 hover:bg-emerald-950/10"
                          : hasReview
                          ? "bg-rose-950/5 border-rose-900/20 text-rose-400 hover:bg-rose-950/10"
                          : "bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-200"
                      )}
                    >
                      <span className="truncate pr-2">{i + 1}. {card.front.replace(/^#+\s*/, '')}</span>
                      {hasMastered ? (
                        <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                      ) : hasReview ? (
                        <XCircle size={12} className="text-rose-500 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-neutral-600 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded uppercase">
                          Deck
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
