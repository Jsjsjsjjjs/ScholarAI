import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Image as ImageIcon, Loader2, Bot, Mic } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "../lib/utils";
import { auth, db, serverTimestamp, handleFirestoreError, OperationType, trackAIUsage } from "../lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { solveDoubt as clientSolveDoubt } from "../lib/gemini";
import { dbMirror } from "../lib/supabase";

export default function DoubtSolver() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [history, setHistory] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeUid, setActiveUid] = useState<string | null>(() => {
    return localStorage.getItem("scholar_session_id") || auth.currentUser?.uid || null;
  });

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      const scholarSessionId = localStorage.getItem("scholar_session_id");
      setActiveUid(scholarSessionId || user?.uid || null);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!activeUid) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, "users", activeUid, "doubts"),
      orderBy("timestamp", "asc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data() as { role: 'user' | 'ai', content: string });
      setHistory(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${activeUid}/doubts`);
    });

    return () => unsubscribe();
  }, [activeUid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const solveDoubt = async () => {
    if (!inputText && !image) return;
    if (!activeUid) return;

    const currentQuery = inputText;
    const userMsg = currentQuery || "Attached an image for solving";
    
    setInputText("");
    setLoading(true);
    
    try {
      const doubtsRef = collection(db, "users", activeUid, "doubts");
      
      // Save user question
      try {
        await addDoc(doubtsRef, {
          role: 'user',
          content: userMsg,
          timestamp: serverTimestamp()
        });
      } catch (fErr) {
        handleFirestoreError(fErr, OperationType.WRITE, `users/${activeUid}/doubts`);
      }

      const answer = await clientSolveDoubt(
        currentQuery || "Please explain this image and solve any problems shown.",
        image
      );
      
      // Track usage
      await trackAIUsage(answer.length * 4);

      // Save AI response
      try {
        await addDoc(doubtsRef, {
          role: 'ai',
          content: answer,
          timestamp: serverTimestamp()
        });
      } catch (fErr) {
        handleFirestoreError(fErr, OperationType.WRITE, `users/${activeUid}/doubts`);
      }

      // Mirror complete resolved QA pair to Supabase
      const generatedDoubtId = `doubt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      dbMirror.mirrorDoubtSave(activeUid, generatedDoubtId, userMsg, answer).catch(console.error);

      setImage(null);
    } catch (err: any) {
      console.error("Solve doubt error:", err);
      if (err.status === 429 || err.message?.includes("429")) {
        setErrorMessage("⚠️ Quota Reached: Daily free limit exhausted. Please try again soon or check Settings.");
        await trackAIUsage(0, true);
      } else {
        setErrorMessage(`⚠️ Failed to solve doubt. Details: ${err.message || String(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image size must be less than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-96 h-[500px] bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-orange-500 text-white flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <Bot size={24} />
                <span className="font-bold">AI Doubt Solver</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-black/10 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat History */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {history.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                   <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4">
                      <MessageSquare className="text-orange-500" size={32} />
                   </div>
                   <h4 className="font-bold text-white mb-2">How can I help you?</h4>
                   <p className="text-neutral-500 text-sm">Ask any 10th Class doubt via text or image. I'm trained on standard board syllabus.</p>
                </div>
              )}
              {history.map((msg, i) => (
                <div key={i} className={cn(
                  "flex",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}>
                  <div className={cn(
                    "max-w-[85%] p-3 rounded-2xl text-sm",
                    msg.role === 'user' ? "bg-orange-500 text-white" : "bg-neutral-800 text-neutral-200"
                  )}>
                    <div className="prose prose-invert prose-sm">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                   <div className="bg-neutral-800 p-3 rounded-2xl flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-orange-500" />
                      <span className="text-xs font-medium text-neutral-400">Expert thinking...</span>
                   </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-neutral-800 space-y-3">
              {errorMessage && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center justify-between">
                  <span>{errorMessage}</span>
                  <button onClick={() => setErrorMessage(null)} className="hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              )}
              {image && (
                <div className="relative inline-block">
                  <img src={image} alt="preview" className="h-16 w-16 rounded-xl object-cover border-2 border-orange-500" />
                  <button 
                    onClick={() => setImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-neutral-800 text-neutral-400 transition"
                >
                  <ImageIcon size={20} />
                </button>
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && solveDoubt()}
                    placeholder="Type your doubt or upload a photo..."
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl py-2 px-4 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  />
                </div>
                <button 
                  onClick={solveDoubt}
                  disabled={loading || (!inputText && !image)}
                  className="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition disabled:opacity-50"
                  title="Photo solving enabled"
                >
                  <Send size={20} />
                </button>
              </div>
              <p className="text-[10px] text-neutral-600 text-center font-medium">Tip: Clear photos of handwritten math/science work the best!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300",
          isOpen ? "bg-red-500 rotate-90" : "bg-orange-500"
        )}
      >
        {isOpen ? <X size={32} className="text-white" /> : <MessageSquare size={32} className="text-white" />}
      </motion.button>
    </div>
  );
}
