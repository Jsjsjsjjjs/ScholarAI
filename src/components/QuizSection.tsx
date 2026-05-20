import { useState } from "react";
import { BrainCircuit, Loader2, CheckCircle2, XCircle, Info, Trophy, RotateCcw } from "lucide-react";
import { db, auth, serverTimestamp, handleFirestoreError, OperationType, updateProgress, trackAIUsage } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "../lib/utils";

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export default function QuizSection() {
  const [subject, setSubject] = useState("Science");
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const subjects = ["Hindi", "English", "Science", "Math", "SST"];
  const difficulties = ["Easy", "Medium", "Hard", "Expert"];

  const startQuiz = async () => {
    if (!topic) return;
    setLoading(true);
    setQuestions([]);
    setCurrentIdx(0);
    setScore(0);
    setShowResult(false);
    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic, numQuestions, difficulty }),
      });

      if (res.status === 429) {
        setQuestions([{
          question: "# ⚠️ AI Quota Reached\n\nYou've exhausted the free daily generation limit. Please wait a moment or upgrade in Settings.",
          options: ["Try again in 60s", "Check Quota in Settings", "Upgrade to Premium"],
          correctAnswer: "Check Quota in Settings",
          explanation: "The Gemini-3-Flash model has a rate limit of 20 requests per minute on the free tier. This ensures the service remains available for everyone."
        }]);
        await trackAIUsage(0, true);
        setLoading(false);
        return;
      }

      const data = await res.json();
      
      // Track usage
      await trackAIUsage(numQuestions * 500);

      setQuestions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (option: string) => {
    if (selected) return;
    setSelected(option);
    setShowExplanation(true);
    const isCorrect = option === questions[currentIdx].correctAnswer;
    if (isCorrect) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    setSelected(null);
    setShowExplanation(false);
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setShowResult(true);
      updateStats();
      updateProgress(subject, topic, "quizTaken");
    }
  };

  const updateStats = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const statsRef = doc(db, "stats", user.uid);
    try {
      const snap = await getDoc(statsRef);
      const data = snap.exists() ? snap.data() : { quizCorrect: 0, totalAttempted: 0 };
      
      const newCorrect = (data.quizCorrect || 0) + score;
      const newAttempted = (data.totalAttempted || 0) + questions.length;
      const newAccuracy = (newCorrect / (newAttempted || 1)) * 100;

      const updates: any = {
        quizCorrect: newCorrect,
        totalAttempted: newAttempted,
        accuracy: newAccuracy || 0,
        lastUpdated: serverTimestamp(),
        lastActivity: serverTimestamp()
      };

      if (!snap.exists()) {
        updates.userId = user.uid;
        updates.nickname = user.displayName || `Scholar-${Math.floor(1000 + Math.random() * 9000)}`;
        updates.timeSpent = 0;
      }

      await setDoc(statsRef, updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stats/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <BrainCircuit size={64} className="text-orange-500 mb-6" />
        <h3 className="text-xl font-bold">Constructing AI Quiz...</h3>
        <p className="text-neutral-500">Retrieving specialized expert questions</p>
      </div>
    );
  }

  if (showResult) {
    return (
      <div className="text-center py-12 p-8 bg-neutral-900 rounded-3xl border border-neutral-800 shadow-2xl">
        <Trophy size={80} className="text-yellow-500 mx-auto mb-6" />
        <h2 className="text-4xl font-black mb-2">Quiz Complete!</h2>
        <p className="text-neutral-400 mb-8 text-lg">You scored <span className="text-white font-bold">{score}</span> out of <span className="text-white font-bold">{questions.length}</span></p>
        
        <div className="flex flex-col items-center gap-4">
           <div className="w-64 h-4 bg-neutral-800 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-orange-500 transition-all duration-1000" 
                 style={{ width: `${(score / questions.length) * 100}%` }} 
               />
           </div>
           <span className="font-bold text-orange-500">{(score / questions.length * 100).toFixed(0)}% Mastery</span>
        </div>

        <button
          onClick={() => { setQuestions([]); setShowResult(false); }}
          className="mt-12 px-8 py-4 bg-orange-500 text-white font-bold rounded-2xl flex items-center gap-3 mx-auto hover:bg-orange-600 transition"
        >
          <RotateCcw size={20} />
          Try Another Topic
        </button>
      </div>
    );
  }

  if (questions.length > 0) {
    const q = questions[currentIdx];
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
            Question {currentIdx + 1} of {questions.length}
          </div>
          <div className="px-3 py-1 bg-neutral-800 rounded-full text-xs font-bold text-orange-400">
            {difficulty} • {subject}
          </div>
        </div>

        <div className="p-8 bg-neutral-900 rounded-3xl border border-neutral-800 shadow-xl">
          <div className="text-2xl font-bold mb-8 leading-tight prose prose-invert prose-2xl max-w-none">
            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.question}</Markdown>
          </div>
          
          <div className="space-y-3">
            {q.options.map((opt, i) => {
              const isSelected = selected === opt;
              const isCorrect = opt === q.correctAnswer;
              
              let style = "bg-neutral-800 border-neutral-700 hover:border-neutral-500";
              if (selected) {
                if (isCorrect) style = "bg-green-500/20 border-green-500 text-green-400";
                else if (isSelected) style = "bg-red-500/20 border-red-500 text-red-400";
                else style = "opacity-50 border-neutral-700";
              }

              return (
                <button
                  key={i}
                  disabled={!!selected}
                  onClick={() => handleAnswer(opt)}
                  className={cn(
                    "w-full text-left p-5 rounded-2xl border transition-all flex items-center justify-between group",
                    style
                  )}
                >
                  <div className="font-medium prose prose-invert prose-sm">
                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</Markdown>
                  </div>
                  {selected && isCorrect && <CheckCircle2 size={20} className="text-green-500 shrink-0" />}
                  {selected && isSelected && !isCorrect && <XCircle size={20} className="text-red-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {showExplanation && (
          <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 text-blue-400 font-bold mb-3 uppercase tracking-widest text-xs">
              <Info size={16} />
              AI Solution & Explanation
            </div>
            <div className="text-neutral-300 text-sm leading-relaxed prose prose-invert prose-sm">
              <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.explanation}</Markdown>
            </div>
            <button
               onClick={nextQuestion}
               className="w-full mt-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition"
            >
              {currentIdx + 1 === questions.length ? "Finish Quiz" : "Next Question"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-neutral-900 rounded-3xl border border-neutral-800">
      <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
        <BrainCircuit className="text-orange-500" size={32} />
        ScholarAI Quiz Generator
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="space-y-4">
          <label className="text-sm font-bold text-neutral-500 uppercase">Subject</label>
          <div className="grid grid-cols-3 gap-2">
            {subjects.map(s => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={cn(
                  "py-2 rounded-xl border text-sm font-bold transition-all",
                  subject === s ? "bg-orange-500 border-orange-500 text-white" : "bg-neutral-800 border-neutral-700 text-neutral-400"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Topic or Chapter</label>
          <input 
            type="text" 
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Electric Current, Polynomials..."
            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>

        <div className="space-y-4">
          <label className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Questions ({numQuestions})</label>
          <input 
            type="range" 
            min="3" 
            max="15" 
            value={numQuestions}
            onChange={(e) => setNumQuestions(parseInt(e.target.value))}
            className="w-full accent-orange-500"
          />
        </div>

        <div className="space-y-4">
          <label className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Select Difficulty</label>
          <div className="flex gap-2">
            {difficulties.map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "flex-1 py-2 rounded-xl border text-xs font-bold transition-all",
                  difficulty === d ? "bg-orange-500 border-orange-500 text-white" : "bg-neutral-800 border-neutral-700 text-neutral-400"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={startQuiz}
        disabled={!topic}
        className="w-full py-5 bg-white text-black font-black text-lg rounded-2xl hover:bg-neutral-200 transition disabled:opacity-50 shadow-xl"
      >
        GENERATE CUSTOM QUIZ
      </button>
    </div>
  );
}
