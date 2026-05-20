import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Sparkles, 
  Code, 
  Image as ImageIcon, 
  FileText, 
  Loader2, 
  Bot, 
  User, 
  Copy, 
  Check,
  Zap,
  Layout,
  Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "../lib/utils";
import { trackAIUsage } from "../lib/firebase";
import { chatGemini, generateImageDescription } from "../lib/gemini";

interface Message {
  role: "user" | "model";
  content: string;
  type?: "text" | "image" | "code";
  imageUrl?: string;
}

export default function GeminiAI() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: "model", 
      content: "Hello! I am your Gemini All-Rounder AI. I can generate production-ready code, design complex applications, create detailed study reports (PDF-style), and even conceptualize visual assets. How can I assist your scholarship today?" 
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"standard" | "image" | "code">("standard");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      if (mode === "image") {
        const data = await generateImageDescription(input);
        
        await trackAIUsage(250); // Default for image desc

        setMessages(prev => [...prev, { 
          role: "model", 
          content: data.description, 
          type: "image", 
          imageUrl: data.placeholderUrl 
        }]);
      } else {
        const systemInstruction = mode === "code" 
          ? "You are a senior software engineer. Provide high-quality, production-ready code blocks and architectural advice."
          : "You are an all-rounder AI assistant. You are capable of handling complex multivariable tasks including code, PDFs (via markdown), and deep analysis.";

        const payload = messages.concat(userMessage).map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

        const answer = await chatGemini(payload, systemInstruction);

        await trackAIUsage(answer.length * 4);

        setMessages(prev => [...prev, { role: "model", content: answer }]);
      }
    } catch (err: any) {
      console.error(err);
      if (err.status === 429 || err.message?.includes("429")) {
        setMessages(prev => [...prev, { 
          role: "model", 
          content: "⚠️ **QUOTA EXCEEDED**: You've reached the free tier limit. Please wait a moment before trying again." 
        }]);
      } else {
        setMessages(prev => [...prev, { role: "model", content: `I encountered an error connecting to the central intelligence hub. Details: ${err.message || String(err)}` }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-neutral-900/30 rounded-3xl border border-neutral-800 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">Gemini All-Rounder</h2>
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-neutral-500 tracking-widest">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Connected to Pro-Model Core
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
          {[
            { id: "standard", icon: Bot, label: "Chat" },
            { id: "code", icon: Code, label: "Code" },
            { id: "image", icon: ImageIcon, label: "Image" }
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                mode === m.id ? "bg-orange-500 text-white shadow-lg" : "text-neutral-500 hover:text-white"
              )}
            >
              <m.icon size={14} />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2 custom-scrollbar"
      >
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-4 max-w-[85%]",
              msg.role === "user" ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
              msg.role === "user" ? "bg-neutral-800 border-neutral-700" : "bg-orange-500 border-orange-400"
            )}>
              {msg.role === "user" ? <User size={16} /> : <Bot size={16} className="text-white" />}
            </div>
            
            <div className="space-y-2">
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed",
                msg.role === "user" 
                  ? "bg-orange-500 text-white rounded-tr-none shadow-lg shadow-orange-500/10" 
                  : "bg-neutral-800 text-neutral-200 rounded-tl-none border border-neutral-700/50"
              )}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {msg.content}
                  </Markdown>
                </div>

                {msg.type === "image" && msg.imageUrl && (
                  <div className="mt-4 rounded-xl overflow-hidden border border-white/10 group relative">
                    <img src={msg.imageUrl} alt="AI Generated" className="w-full aspect-video object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <span className="text-xs font-black uppercase tracking-widest bg-white text-black px-4 py-2 rounded-full">HQ Concept Visual</span>
                    </div>
                  </div>
                )}
              </div>
              <div className={cn("text-[10px] text-neutral-500 font-medium", msg.role === "user" ? "text-right" : "")}>
                {msg.role === "user" ? "Sent" : "Gemini Engine"}
              </div>
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-4 max-w-[85%]">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 animate-pulse">
              <Bot size={16} className="text-white" />
            </div>
            <div className="p-4 bg-neutral-800 rounded-2xl rounded-tl-none flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-orange-500" />
              <span className="text-xs font-medium text-neutral-400 font-mono">Synthesizing intelligence...</span>
            </div>
          </div>
        )}
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
        <div className="relative flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-2xl p-2 pl-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              mode === "image" ? "Describe the image you want to generate..." :
              mode === "code" ? "Describe the feature or problem to solve..." :
              "Ask the all-rounder AI anything..."
            }
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center transition hover:bg-orange-600 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
