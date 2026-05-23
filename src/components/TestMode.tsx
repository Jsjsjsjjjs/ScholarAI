import { useState, useEffect } from "react";
import { Loader2, Sparkles, HelpCircle, Check, X, Award, FileText, ChevronRight, ChevronLeft, Eye, EyeOff, RefreshCw } from "lucide-react";
import { generatePracticeTest } from "../lib/gemini";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { motion, AnimatePresence } from "motion/react";
import { useOnlineStatus } from "../lib/offlineCache";

export interface TestQuestion {
  id: number;
  type: string; // "mcq" | "assertion-reason" | "short-answer" | "long-answer"
  questionText: string;
  options: string[] | null;
  correctOption: string;
  detailedSolution: string;
}

interface TestModeProps {
  subject: string;
  topic: string;
  notesContent: string;
  onBackToNotes?: () => void;
  onTestLoaded?: (questions: TestQuestion[], answers: Record<number, string>, isSubmitted: boolean, score: number) => void;
}

export default function TestMode({ subject, topic, notesContent, onBackToNotes, onTestLoaded }: TestModeProps) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [revealedSolutions, setRevealedSolutions] = useState<Record<number, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadTest();
    // Reset states
    setCurrentIdx(0);
    setAnswers({});
    setIsSubmitted(false);
    setRevealedSolutions({});
  }, [subject, topic]);

  // Coordinate with parent state
  useEffect(() => {
    if (questions.length > 0) {
      const score = calculateScore();
      onTestLoaded?.(questions, answers, isSubmitted, score);
    }
  }, [questions, answers, isSubmitted]);

  const loadTest = async () => {
    setLoading(true);
    setErrorMsg(null);
    const cacheKey = `scholar_test_${subject.replace(/\s+/g, "_")}_${topic.replace(/\s+/g, "_")}`;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as TestQuestion[];
        if (parsed && parsed.length > 0) {
          setQuestions(parsed);
          setLoading(false);
          return;
        }
      }

      if (!isOnline) {
        const fallback = generateOfflineTest();
        setQuestions(fallback);
        setLoading(false);
        return;
      }

      const generated = await generatePracticeTest(subject, topic, notesContent);
      if (generated && generated.length > 0) {
        const validated: TestQuestion[] = generated.map((q: any) => ({
          id: q.id || 1,
          type: q.type || "mcq",
          questionText: q.questionText || "Which of the following is correct?",
          options: q.options || null,
          correctOption: q.correctOption || "Option A",
          detailedSolution: q.detailedSolution || "Refer to board text for marking scheme explanation."
        }));
        setQuestions(validated);
        localStorage.setItem(cacheKey, JSON.stringify(validated));
      } else {
        throw new Error("Empty array returned from server.");
      }
    } catch (e: any) {
      console.error("Test generation failed:", e);
      const fallback = generateOfflineTest();
      setQuestions(fallback);
      setErrorMsg("⚠️ Offline Mode: Showing offline CBSE diagnostic board questions.");
    } finally {
      setLoading(false);
    }
  };

  const generateOfflineTest = (): TestQuestion[] => {
    return [
      {
        id: 1,
        type: "mcq",
        questionText: `Which of the following describes the core theme inside ${topic}?`,
        options: [
          "Primary reaction/mechanism sequence representing steady state actions",
          "Secondary thermodynamic degradation processes in solid solutions",
          "Introductory variables layout without specific physical structures",
          "None of the options listed are CBSE Board approved"
        ],
        correctOption: "Primary reaction/mechanism sequence representing steady state actions",
        detailedSolution: "The introduction guides represent the steady-state pathways as core markers under class 10 standard benchmarks."
      },
      {
        id: 2,
        type: "assertion-reason",
        questionText: `**Assertion (A):** Practical practice and active recall are essential for high exam scoring in ${topic}.\n\n**Reason (R):** Structured revision sheets minimize memory recall latencies during examination.`,
        options: [
          "Both A and R are true and R is the correct explanation of A",
          "Both A and R are true but R is NOT the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        correctOption: "Both A and R are true and R is the correct explanation of A",
        detailedSolution: "Active recall forces dual coding and memory consolidation, ensuring optimal board examination output."
      },
      {
        id: 3,
        type: "short-answer",
        questionText: `Write the basic core definitions of ${topic} and mention any key formulas/equations relevant to this curriculum segment.`,
        options: null,
        correctOption: "Write definitions clearly inside bullet points with correct chemical/mathematical equations.",
        detailedSolution: "CBSE subjective grading awards marks separately for defining properties (1.5 marks) and balanced equation/unit notation (1.5 marks)."
      },
      {
        id: 4,
        type: "long-answer",
        questionText: `Provide a comprehensive structured breakdown of ${topic}. Discuss experimental preparations, precautions, and high-prioritized numerical formulas.`,
        options: null,
        correctOption: "Include neat diagram references, direct formulas breakdown, and error analysis parameters.",
        detailedSolution: "Ensure 5-mark answers contain: 1. Neat Labeled Pencil Diagram layout, 2. Core reactions, 3. Balanced state declarations, 4. Precautions checklist (e.g. airtight seal values)."
      }
    ];
  };

  const handleSelectAnswer = (opt: string) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({
      ...prev,
      [questions[currentIdx].id]: opt
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q) => {
      if (q.type === "mcq" || q.type === "assertion-reason") {
        if (answers[q.id] === q.correctOption) {
          correct++;
        }
      }
    });
    return correct;
  };

  const getObjectiveQuestionsCount = () => {
    return questions.filter((q) => q.type === "mcq" || q.type === "assertion-reason").length;
  };

  const toggleSolution = (id: number) => {
    setRevealedSolutions((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const currentQ = questions[currentIdx];

  if (loading) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-16 flex flex-col items-center justify-center text-center space-y-4">
        <Loader2 className="animate-spin text-orange-500" size={40} />
        <div className="space-y-1">
          <p className="font-bold text-neutral-200">Generating Class X Board Mock Exam...</p>
          <p className="text-xs text-neutral-500 font-medium">Assembled CBSE Syllabus diagnostic MCQs, Assertion-Reason pairings, and High-Yield numericals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {questions.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-12 text-center text-neutral-500">
          No diagnostic items found.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Diagnostic Sidebar (Questions Index) */}
          <div className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4 h-fit">
            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider block">
              BOARD EVAL PANEL
            </span>
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const isSelected = idx === currentIdx;
                const isAnswered = answers[q.id] !== undefined;
                let btnClass = "bg-neutral-850 hover:bg-neutral-805 text-neutral-400 border border-neutral-800";
                
                if (isSelected) {
                  btnClass = "bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/15";
                } else if (isSubmitted) {
                  if (q.type === "mcq" || q.type === "assertion-reason") {
                    const corr = answers[q.id] === q.correctOption;
                    btnClass = corr 
                      ? "bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                      : "bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/25";
                  } else {
                    btnClass = "bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700";
                  }
                } else if (isAnswered) {
                  btnClass = "bg-neutral-800 text-orange-400 border border-neutral-700";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-11 rounded-xl text-sm font-black transition-all flex items-center justify-center ${btnClass}`}
                  >
                    0{idx + 1}
                  </button>
                );
              })}
            </div>

            {/* MCQ Score indicator if submitted */}
            {isSubmitted ? (
              <div className="pt-4 border-t border-neutral-800 text-center space-y-2">
                <div className="inline-flex p-3 bg-orange-500/10 rounded-2xl text-orange-500">
                  <Award size={24} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-black uppercase text-neutral-500">CBT Objective Yield</p>
                  <p className="text-xl font-black text-white">
                    {calculateScore()} / {getObjectiveQuestionsCount()} Marks
                  </p>
                </div>
                <button
                  onClick={loadTest}
                  className="w-full mt-2 py-2 bg-neutral-850 border border-neutral-800 text-[10px] font-black uppercase text-neutral-400 hover:text-white rounded-xl transition flex items-center justify-center gap-1"
                >
                  <RefreshCw size={11} />
                  Reset Assessment
                </button>
              </div>
            ) : (
              <div className="pt-4 border-t border-neutral-800">
                <button
                  onClick={() => setIsSubmitted(true)}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition shadow-xl shadow-orange-500/15"
                >
                  Submit CBSE Answers
                </button>
              </div>
            )}
          </div>

          {/* Active Question Stage */}
          <div className="lg:col-span-3 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <span className="text-xs font-bold px-3 py-1 bg-white/5 border border-white/10 text-neutral-400 uppercase rounded-full tracking-wider">
                  Question Type: {currentQ.type.replace("-", " ")}
                </span>
                <span className="text-xs font-mono font-bold text-neutral-500">
                  Section Marks: {currentQ.type.includes("long") ? "5" : currentQ.type.includes("short") ? "3" : "1"}
                </span>
              </div>

              {/* Question Text with LaTeX support */}
              <div className="text-neutral-200 text-sm sm:text-base leading-relaxed font-semibold">
                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{currentQ.questionText}</Markdown>
              </div>

              {/* Options layout for MCQs/Assertion-Reason */}
              {currentQ.options ? (
                <div className="grid grid-cols-1 gap-3 pt-2">
                  {currentQ.options.map((opt, oIdx) => {
                    const isSelected = answers[currentQ.id] === opt;
                    const isCorrect = opt === currentQ.correctOption;
                    const showFeedback = isSubmitted;
                    
                    let bgBorderClass = "bg-neutral-850 border-neutral-800 hover:border-neutral-700 text-neutral-300";
                    if (isSelected && !showFeedback) {
                      bgBorderClass = "bg-orange-500/10 border-orange-500 text-orange-400";
                    } else if (showFeedback) {
                      if (isCorrect) {
                        bgBorderClass = "bg-emerald-500/10 border-emerald-500 text-emerald-400";
                      } else if (isSelected) {
                        bgBorderClass = "bg-red-500/10 border-red-500 text-red-500";
                      }
                    }

                    return (
                      <button
                        key={oIdx}
                        disabled={isSubmitted}
                        onClick={() => handleSelectAnswer(opt)}
                        className={`p-4 border rounded-2xl text-left text-xs font-bold tracking-tight transition-all flex items-center justify-between gap-3 ${bgBorderClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-[10px] text-neutral-500 shrink-0 uppercase font-black">
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span>
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</Markdown>
                          </span>
                        </div>
                        {showFeedback && (
                          <div className="shrink-0 ml-2">
                            {isCorrect ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                <Check size={11} className="stroke-[3]" />
                              </div>
                            ) : isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white">
                                <X size={11} className="stroke-[3]" />
                              </div>
                            ) : null}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Subjective Note Input Area for CBSE Topper Self Check */
                <div className="bg-[#14151a] border border-white/5 rounded-2xl p-5 space-y-3.5 shadow-inner">
                  <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider block">
                    CBT Subjective Drafting Console
                  </span>
                  <textarea
                    placeholder="Draft your key diagnostic points here for self-check..."
                    disabled={isSubmitted}
                    value={answers[currentQ.id] || ""}
                    onChange={(e) => {
                      setAnswers((prev) => ({
                        ...prev,
                        [currentQ.id]: e.target.value
                      }));
                    }}
                    className="w-full h-24 bg-[#0a0a0c] border border-white/5 rounded-xl p-3.5 text-xs text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-orange-500 outline-none transition resize-none font-medium"
                  />
                  <p className="text-[10px] text-neutral-500 leading-relaxed font-medium">
                    ✏️ CBSE Evaluators check for exact terms in lists. Use precise labels before comparing with toppers marking scheme.
                  </p>
                </div>
              )}
            </div>

            {/* Answer solution toggle (Toppers scoring guidelines) */}
            {isSubmitted && (
              <div className="pt-4 border-t border-neutral-800">
                <button
                  onClick={() => toggleSolution(currentQ.id)}
                  className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition border border-neutral-700"
                >
                  {revealedSolutions[currentQ.id] ? (
                    <>
                      <EyeOff size={13} />
                      Hide marking guidelines
                    </>
                  ) : (
                    <>
                      <Eye size={13} />
                      Reveal Model Marking Answers
                    </>
                  )}
                </button>

                <AnimatePresence>
                  {revealedSolutions[currentQ.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-3"
                    >
                      <div className="bg-[#131418] border border-neutral-800 rounded-2xl p-5 text-xs text-neutral-300 space-y-2.5 font-medium leading-relaxed">
                        <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest block">
                          CBSE Evaluation marking scheme
                        </span>
                        <div className="prose prose-invert prose-xs max-w-none">
                          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{currentQ.detailedSolution}</Markdown>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Next / Previous Controls */}
            <div className="flex justify-between items-center pt-4 border-t border-neutral-850">
              <button
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((p) => p - 1)}
                className="py-2.5 px-4 bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-30"
              >
                <ChevronLeft size={13} />
                Prev Question
              </button>
              
              <button
                disabled={currentIdx === questions.length - 1}
                onClick={() => setCurrentIdx((p) => p + 1)}
                className="py-2.5 px-4 bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-30"
              >
                Next Question
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
