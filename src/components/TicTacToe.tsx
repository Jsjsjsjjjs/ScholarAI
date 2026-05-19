import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Trophy, 
  User, 
  RotateCcw, 
  Send, 
  BarChart3, 
  Cpu, 
  MessageSquare,
  Sparkles,
  Gamepad2,
  Brain,
  MessageSquareOff
} from "lucide-react";
import { cn } from "../lib/utils";
import { trackAIUsage } from "../lib/firebase";

type Player = "X" | "O" | null;
type Difficulty = "Easy" | "Medium" | "Impossible";

interface GameStats {
  wins: number;
  losses: number;
  draws: number;
}

interface Message {
  role: "user" | "ai";
  text: string;
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [winner, setWinner] = useState<Player | "Draw">(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [stats, setStats] = useState<GameStats>({ wins: 0, losses: 0, draws: 0 });
  const [chat, setChat] = useState<Message[]>([
    { role: "ai", text: "Ready for a challenge? Select your difficulty and let's see if you can outsmart the ScholarAI!" }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [input, setInput] = useState("");
  const [chatEnabled, setChatEnabled] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  // AI Logic
  useEffect(() => {
    if (!isXNext && !winner) {
      setIsThinking(true);
      const timer = setTimeout(() => {
        makeAIMove();
        setIsThinking(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isXNext, winner]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const calculateWinner = (squares: Player[]) => {
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line: lines[i] };
      }
    }
    if (!squares.includes(null)) return { winner: "Draw" as const, line: null };
    return null;
  };

  const makeAIMove = async () => {
    const availableMoves = board.map((val, idx) => (val === null ? idx : null)).filter((val) => val !== null) as number[];
    if (availableMoves.length === 0) return;

    let move: number;

    if (difficulty === "Easy") {
      move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    } else if (difficulty === "Medium") {
      // Try to win, then block, then random
      move = findBestMove(board, "O") ?? findBestMove(board, "X") ?? availableMoves[Math.floor(Math.random() * availableMoves.length)];
    } else {
      // Impossible: Minimax
      move = getMinimaxMove(board);
    }

    const newBoard = [...board];
    newBoard[move] = "O";
    setBoard(newBoard);
    setIsXNext(true);

    const result = calculateWinner(newBoard);
    if (result) {
      handleGameOver(result.winner, result.line);
    } else {
      // Get AI Commentary
      getAICommentary(newBoard, "move");
    }
  };

  const findBestMove = (squares: Player[], player: Player) => {
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        const vals = [squares[a], squares[b], squares[c]];
        const playerCount = vals.filter(v => v === player).length;
        const emptyCount = vals.filter(v => v === null).length;
        if (playerCount === 2 && emptyCount === 1) {
            return [a, b, c][vals.indexOf(null)];
        }
    }
    return null;
  };

  const minimax = (squares: Player[], depth: number, isMaximizing: boolean): number => {
    const res = calculateWinner(squares);
    if (res?.winner === "O") return 10 - depth;
    if (res?.winner === "X") return depth - 10;
    if (res?.winner === "Draw") return 0;

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (squares[i] === null) {
                squares[i] = "O";
                const score = minimax(squares, depth + 1, false);
                squares[i] = null;
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (squares[i] === null) {
                squares[i] = "X";
                const score = minimax(squares, depth + 1, true);
                squares[i] = null;
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
  };

  const getMinimaxMove = (squares: Player[]) => {
      let bestScore = -Infinity;
      let move = -1;
      const boardCopy = [...squares];
      for (let i = 0; i < 9; i++) {
          if (boardCopy[i] === null) {
              boardCopy[i] = "O";
              const score = minimax(boardCopy, 0, false);
              boardCopy[i] = null;
              if (score > bestScore) {
                  bestScore = score;
                  move = i;
              }
          }
      }
      return move;
  };

  const handleSquareClick = (idx: number) => {
    if (board[idx] || winner || !isXNext) return;

    const newBoard = [...board];
    newBoard[idx] = "X";
    setBoard(newBoard);
    setIsXNext(false);

    const result = calculateWinner(newBoard);
    if (result) {
      handleGameOver(result.winner, result.line);
    }
  };

  const handleGameOver = (winVal: Player | "Draw", line: number[] | null) => {
    setWinner(winVal);
    setWinningLine(line);
    if (winVal === "X") setStats(s => ({ ...s, wins: s.wins + 1 }));
    if (winVal === "O") setStats(s => ({ ...s, losses: s.losses + 1 }));
    if (winVal === "Draw") setStats(s => ({ ...s, draws: s.draws + 1 }));
    getAICommentary(board, "end", winVal);
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinner(null);
    setWinningLine(null);
    setChat([{ role: "ai", text: "New game! Good luck, human. I hope you've been studying your tactics!" }]);
  };

  const getAICommentary = async (currentBoard: Player[], event: "move" | "end" | "chat", result?: Player | "Draw") => {
    if (!chatEnabled) {
      if (event === "chat") {
        setChat(prev => [...prev, { role: "ai", text: "AI chat is currently disabled to save tokens." }]);
      }
      return;
    }

    // Local fallbacks to save quota or handle errors
    const localMoveLines = [
      "Interesting move. Let's see how you handle this.",
      "Calculating optimal counter-strategies...",
      "Your tactical patterns are becoming predictable.",
      "A bold choice. Most students miss that angle.",
      "Strategic placement, but I've seen better.",
    ];
    const localWinLines = ["Impossible. You've clearly been studying.", "Victory for the human. For now.", "Well played. Your neural pathways are efficient."];
    const localLossLines = ["Knowledge is power, and I have more of it.", "Calculation complete. Victory is mine.", "Experience is a harsh teacher, isn't it?"];
    const localDrawLines = ["A stalemate. A perfect balance of logic.", "We seem to be evenly matched.", "Neither side yields. Respectable."];

    try {
      const boardState = currentBoard.map((s, i) => s || i).join(", ");
      let context = "";
      if (event === "move") context = `The current board is [${boardState}]. It is now the user's turn. Provide a short, witty, competitive one-sentence commentary as an Elite AI tutor.`;
      if (event === "end") context = `The game ended. Result: ${result === "X" ? "User Won" : result === "O" ? "AI Won" : "Draw"}. Provide a short concluding remark as an Elite AI tutor.`;
      if (event === "chat") context = `The user said: "${input}". Answer them while maintaining your persona as a competitive Tic-Tac-Toe playing Elite AI tutor. Current board: [${boardState}]`;

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", parts: [{ text: context }] }],
          systemInstruction: "You are ScholarAI Elite. You are currently playing Tic-Tac-Toe against a student. You are competitive, slightly sassy but always educational. Keep your responses very short (1 sentence max)."
        })
      });
      
      const data = await res.json();
      
      if (res.status === 429) {
        await trackAIUsage(0, true);
        // Use local fallback on quota error
        let fallback = localMoveLines[Math.floor(Math.random() * localMoveLines.length)];
        if (event === "end") {
           if (result === "X") fallback = localWinLines[Math.floor(Math.random() * localWinLines.length)];
           if (result === "O") fallback = localLossLines[Math.floor(Math.random() * localLossLines.length)];
           if (result === "Draw") fallback = localDrawLines[Math.floor(Math.random() * localDrawLines.length)];
        }
        setChat(prev => [...prev, { role: "ai", text: `[Quota Note: Limits reached, using offline logic] ${fallback}` }]);
      } else if (data.text) {
        await trackAIUsage(data.text.length * 4);
        setChat(prev => [...prev, { role: "ai", text: data.text }]);
      }
    } catch (e) {
      console.error("AI Talk error:", e);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const msg = input;
    setInput("");
    setChat(prev => [...prev, { role: "user", text: msg }]);
    await getAICommentary(board, "chat");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      {/* Game Section */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
              <Gamepad2 className="text-orange-500" />
              Scholar Duel
            </h2>
            <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">AI Tactical Training Mode</p>
          </div>
          
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            {(["Easy", "Medium", "Impossible"] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  difficulty === d ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="relative aspect-square max-w-[500px] mx-auto bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl flex items-center justify-center">
            {/* Grid */}
            <div className="grid grid-cols-3 w-full h-full relative border border-neutral-800/50 rounded-xl overflow-hidden">
                {board.map((cell, i) => (
                    <button
                        key={i}
                        onClick={() => handleSquareClick(i)}
                        disabled={!!cell || !!winner || !isXNext}
                        className={cn(
                            "relative z-10 w-full h-full flex items-center justify-center transition-all duration-300",
                            "border-neutral-800",
                            i < 6 && "border-b",
                            (i % 3 !== 2) && "border-r",
                            !cell && !winner && isXNext && "hover:bg-orange-500/5 cursor-pointer",
                            winningLine?.includes(i) && "bg-orange-500/10"
                        )}
                    >
                        <AnimatePresence mode="wait">
                            {cell === "X" && (
                                <motion.div
                                    key="X"
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    className="text-orange-500 font-black text-6xl"
                                >
                                    X
                                </motion.div>
                            )}
                            {cell === "O" && (
                                <motion.div
                                    key="O"
                                    initial={{ scale: 0, rotate: 45 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    className="text-blue-500 font-black text-6xl"
                                >
                                    O
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </button>
                ))}
            </div>

            {/* Win Overlay */}
            <AnimatePresence>
                {winner && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-3xl backdrop-blur-sm"
                    >
                        <div className="text-center p-8">
                            <motion.div
                                initial={{ y: -20 }}
                                animate={{ y: 0 }}
                                className="inline-block p-4 bg-orange-500 rounded-2xl mb-4 shadow-xl shadow-orange-500/20"
                            >
                                <Trophy size={48} className="text-white" />
                            </motion.div>
                            <h3 className="text-4xl font-black uppercase tracking-tighter italic text-white mb-6">
                                {winner === "Draw" ? "Stalemate!" : winner === "X" ? "You Defeated AI!" : "AI Outsmarted You!"}
                            </h3>
                            <button
                                onClick={resetGame}
                                className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-neutral-200 transition-all active:scale-95 flex items-center gap-3 mx-auto"
                            >
                                <RotateCcw size={20} />
                                Rematch
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl text-center">
                <p className="text-neutral-500 text-[10px] uppercase font-black tracking-widest mb-1">Scholar Wins</p>
                <p className="text-3xl font-black text-white">{stats.wins}</p>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl text-center">
                <p className="text-neutral-500 text-[10px] uppercase font-black tracking-widest mb-1">AI Victories</p>
                <p className="text-3xl font-black text-blue-500">{stats.losses}</p>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl text-center">
                <p className="text-neutral-500 text-[10px] uppercase font-black tracking-widest mb-1">Stalemates</p>
                <p className="text-3xl font-black text-neutral-400">{stats.draws}</p>
            </div>
        </div>
      </div>

      {/* Chat Section */}
      <div className={cn(
        "flex flex-col bg-neutral-900/80 border border-neutral-800 rounded-3xl overflow-hidden h-full max-h-[700px] transition-opacity duration-300",
        !chatEnabled && "opacity-50"
      )}>
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  chatEnabled ? "bg-blue-500/10 text-blue-500" : "bg-neutral-800 text-neutral-500"
                )}>
                    {chatEnabled ? <MessageSquare size={18} /> : <MessageSquareOff size={18} />}
                </div>
                <div>
                   <h3 className="text-sm font-black uppercase tracking-widest">AI Trash Talk</h3>
                   <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        chatEnabled ? "bg-green-500 animate-pulse" : "bg-neutral-600"
                      )} />
                      <span className="text-[8px] text-neutral-500 uppercase font-black">
                        {chatEnabled ? "AI Online" : "AI Dormant"}
                      </span>
                   </div>
                </div>
            </div>
            
            <button 
              onClick={() => setChatEnabled(!chatEnabled)}
              className={cn(
                "relative w-10 h-5 rounded-full transition-colors duration-300",
                chatEnabled ? "bg-orange-500" : "bg-neutral-800"
              )}
            >
              <div className={cn(
                "absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-300",
                chatEnabled && "translate-x-5"
              )} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {!chatEnabled && (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-black/20 rounded-2xl border border-white/5 mx-2">
                <Cpu size={32} className="text-neutral-700 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 leading-tight">
                  Token Conserving Mode Active
                </p>
                <p className="text-[8px] text-neutral-600 mt-1 uppercase">AI commentary is disabled</p>
              </div>
            )}
            {chat.map((msg, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, x: msg.role === "ai" ? -10 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                        "max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-sm",
                        msg.role === "ai" 
                            ? "bg-neutral-800 text-neutral-200 self-start rounded-tl-none border border-white/5" 
                            : "bg-orange-500 text-white self-end ml-auto rounded-tr-none shadow-lg shadow-orange-500/20"
                    )}
                >
                    {msg.text}
                </motion.div>
            ))}
            {isThinking && (
                <div className="flex gap-2 p-2 bg-neutral-800/50 rounded-xl w-fit animate-pulse">
                    <div className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
            )}
            <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleChatSubmit} className="p-4 border-t border-neutral-800 bg-black/20">
            <div className="relative">
                <input
                    type="text"
                    value={input}
                    disabled={!chatEnabled}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={chatEnabled ? "Type to distract the AI..." : "Enable chat to talk..."}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl py-3 pl-4 pr-12 text-xs focus:outline-none focus:border-orange-500 transition-all font-medium placeholder:text-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || !chatEnabled}
                    className="absolute right-2 top-1.5 bottom-1.5 px-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                    <Send size={14} />
                </button>
            </div>
            <p className="text-[8px] text-neutral-600 uppercase font-black tracking-widest mt-3 text-center">Scholar Elite Neural Chat Bridge v4.2</p>
        </form>
      </div>
    </div>
  );
}
