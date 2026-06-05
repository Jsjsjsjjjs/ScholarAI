import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { 
  Ticket as TicketIcon, 
  Send, 
  ShieldCheck, 
  MailX, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  X, 
  Trash2,
  Users,
  Star,
  Activity,
  UserCheck,
  Search,
  MessageSquare,
  Lock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

export default function AdminTicketPanel({ userData, onClose }: { userData?: any; onClose: () => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [filter, setFilter] = useState('all'); // all, open, hold, solved
  const [reply, setReply] = useState('');
  const [replyType, setReplyType] = useState<'reply' | 'note'>('reply'); // reply vs internal note
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Realtime connection to tickets
    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const t = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      setTickets(t);
      setSelectedTicket((prev: any) => {
        if (!prev) return prev;
        const updated = t.find((tic: any) => tic.id === prev.id);
        return updated || null;
      });
    }, (error) => {
      console.error('Admin tickets listener error:', error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !selectedTicket) return;
    
    const adminDisplayName = userData?.discordName || userData?.nickname || auth.currentUser?.displayName || auth.currentUser?.email || 'System Specialist';
    
    const newMsg = {
      sender: replyType === 'note' ? 'internal' : 'admin',
      text: reply.trim(),
      senderName: adminDisplayName,
      timestamp: new Date().toISOString()
    };
    
    const updatedMessages = [...(selectedTicket.messages || []), newMsg];
    
    setReply('');
    try {
      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        messages: updatedMessages,
        updatedAt: serverTimestamp(),
        status: selectedTicket.status === 'solved' ? 'open' : selectedTicket.status
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedTicket) return;
    try {
      await updateDoc(doc(db, 'tickets', selectedTicket.id), { status, updatedAt: serverTimestamp() });
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!selectedTicket || !confirm('Permanently delete this support ticket from the databases? This action cannot be revoked.')) return;
    try {
      await deleteDoc(doc(db, 'tickets', selectedTicket.id));
      setSelectedTicket(null);
    } catch (err) { console.error(err); }
  };

  // Stats calculation
  const openCount = tickets.filter(t => t.status === 'open').length;
  const holdCount = tickets.filter(t => t.status === 'hold').length;
  const resolvedCount = tickets.filter(t => t.status === 'solved').length;
  const totalCount = tickets.length;

  const filteredTickets = tickets.filter(t => {
    const matchesFilter = filter === 'all' || t.status === filter;
    const matchesSearch = searchQuery.trim() === '' || 
      (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.submitterName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">Open</span>;
      case 'hold':
        return <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">Awaiting User</span>;
      case 'solved':
        return <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-black uppercase tracking-wider">Resolved</span>;
      default:
        return <span className="flex items-center gap-1 text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded uppercase">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || 'medium').toLowerCase();
    switch (p) {
      case 'urgent':
        return <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-black rounded uppercase tracking-wider">Urgent</span>;
      case 'high':
        return <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] font-black rounded uppercase tracking-wider">High</span>;
      case 'medium':
        return <span className="px-1.5 py-0.5 bg-blue-500/20 text-[#b0c6ff] border border-blue-500/30 text-[9px] font-black rounded uppercase tracking-wider">Med</span>;
      default:
        return <span className="px-1.5 py-0.5 bg-neutral-800 text-neutral-400 border border-neutral-700 text-[9px] font-black rounded uppercase tracking-wider">Low</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#051424] text-[#d4e4fa] flex flex-col p-4 sm:p-6 isolate overflow-hidden">
      
      {/* Top Console toolbar bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#273647]/30 pb-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-white">
            <ShieldCheck className="text-[#b0c6ff] animate-pulse" size={26} /> 
            SupportFlow Admin Console
          </h1>
          <p className="text-xs text-neutral-400 mt-1">SLA parameters and user query pipelines</p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          {/* Quick search input */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter ticket ID, subject or name..."
              className="bg-[#010f1f] border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-[#d4e4fa] focus:ring-1 focus:ring-[#b0c6ff] focus:outline-none w-full sm:w-64 placeholder-neutral-600"
            />
          </div>
          <button 
            onClick={onClose} 
            className="p-2 border border-white/5 bg-[#122131] hover:bg-[#1c2b3c] active:scale-95 transition-all rounded-xl text-white font-bold"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Stats row widget (Bento layout dashboard) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="p-4 bg-[#122131]/60 border border-white/5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Awaiting Reply</p>
            <h3 className="text-2xl font-black text-white">{String(openCount).padStart(2, '0')}</h3>
          </div>
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Clock size={16} />
          </div>
        </div>

        <div className="p-4 bg-[#122131]/60 border border-white/5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Awaiting User</p>
            <h3 className="text-2xl font-black text-white">{String(holdCount).padStart(2, '0')}</h3>
          </div>
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <AlertCircle size={16} />
          </div>
        </div>

        <div className="p-4 bg-[#122131]/60 border border-white/5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Resolved Tickets</p>
            <h3 className="text-2xl font-black text-white">{String(resolvedCount).padStart(2, '0')}</h3>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <CheckCircle size={16} />
          </div>
        </div>

        <div className="p-4 bg-[#122131]/60 border border-white/5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Avg CSAT Rating</p>
            <h3 className="text-2xl font-black text-white">4.9 / 5.0</h3>
          </div>
          <div className="p-2.5 bg-[#b0c6ff]/10 text-[#b0c6ff] rounded-lg border border-[#b0c6ff]/20">
            <Star size={16} className="fill-[#b0c6ff]" />
          </div>
        </div>
      </div>

      {/* Main console content split layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 overflow-hidden max-w-[1500px] w-full mx-auto animate-fadeIn">
        
        {/* Left col list (1 col) */}
        <div className={cn(
          "lg:col-span-1 border border-white/5 bg-[#0d1c2d]/70 rounded-2xl flex flex-col overflow-hidden backdrop-blur-sm",
          selectedTicket ? "hidden lg:flex" : "flex"
        )}>
          {/* Top category selectors */}
          <div className="p-2 border-b border-[#273647]/30 flex gap-0.5 bg-[#122131]/50 grow-0">
            {['all', 'open', 'hold', 'solved'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 py-1 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors text-center",
                  filter === f 
                    ? "bg-[#0f52ba] text-white" 
                    : "text-neutral-400 hover:bg-[#122131] hover:text-white"
                )}
              >
                {f.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Roster entries */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
            {filteredTickets.map(t => (
              <div 
                key={t.id}
                onClick={() => setSelectedTicket(t)}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all duration-200",
                  selectedTicket?.id === t.id 
                    ? "bg-[#1c2b3c] border-[#b0c6ff]/40 shadow-sm" 
                    : "bg-[#010f1f]/50 border-transparent hover:bg-[#122131]/40"
                )}
              >
                <div className="flex justify-between items-start gap-1 pb-1">
                  <h4 className="font-bold text-xs truncate text-[#d4e4fa] max-w-[75%] hover:text-[#b0c6ff] transition-colors">{t.subject}</h4>
                  {getPriorityBadge(t.priority)}
                </div>
                <div className="flex justify-between items-center text-[10px] text-neutral-500 pt-1 border-t border-[#273647]/10">
                  <span className="truncate pr-2 font-mono">By: {t.submitterName}</span>
                  <span className="font-mono bg-[#122131] px-1.5 py-0.2 rounded border border-white/5 text-[9px] text-[#b0c6ff]">#{t.id.slice(0, 5)}</span>
                </div>
              </div>
            ))}

            {filteredTickets.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500 text-xs">
                <MailX size={26} className="text-neutral-600 mb-2" />
                No matching incidents indexing.
              </div>
            )}
          </div>
        </div>

        {/* Right view panel detail chat (3 cols) */}
        <div className={cn(
          "lg:col-span-3 border border-white/5 bg-[#0d1c2d]/70 rounded-2xl flex flex-col overflow-hidden backdrop-blur-sm animate-fadeIn",
          !selectedTicket ? "hidden lg:flex" : "flex"
        )}>
          {selectedTicket ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Toolbar */}
              <div className="p-3.5 sm:p-4 border-b border-[#273647]/30 bg-[#122131]/50 flex flex-wrap items-center justify-between gap-3 sm:gap-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <button 
                    onClick={() => setSelectedTicket(null)}
                    className="lg:hidden flex items-center justify-center p-2.5 bg-neutral-950/40 hover:bg-[#122131] border border-white/5 rounded-xl text-[#b0c6ff] transition-all hover:text-white"
                    title="Back to list"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="space-y-1">
                    <h2 className="font-bold text-sm sm:text-base text-white leading-tight">{selectedTicket.subject}</h2>
                    <div className="text-[10px] text-neutral-400 font-mono flex flex-wrap gap-x-2 sm:gap-x-4 items-center leading-none">
                      <span className="bg-neutral-950 px-1.5 py-0.5 rounded border border-white/5 text-neutral-400">ID: {selectedTicket.id.slice(0, 8)}</span>
                      <span className="hidden sm:inline">Creator: <strong className="text-white">{selectedTicket.submitterName}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select 
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="bg-[#051424] border border-[#273647]/40 text-xs font-bold text-[#b0c6ff] uppercase rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-[#b0c6ff] focus:outline-none cursor-pointer h-8"
                  >
                    <option value="open">Status: Open</option>
                    <option value="hold">Status: Hold</option>
                    <option value="solved">Status: Solved</option>
                  </select>
                  
                  <button 
                    onClick={handleDelete}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 rounded-xl transition-all h-8 w-8 flex items-center justify-center active:scale-95"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#010f1f]/30">
                {/* Initial submit message */}
                <div className="flex gap-3.5 max-w-[85%]">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-black">
                    {selectedTicket.submitterName?.[0] || 'U'}
                  </div>
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white pb-0.5">{selectedTicket.submitterName}</span>
                      <span className="text-[9px] bg-orange-500/15 text-orange-400 font-medium px-1.5 rounded tracking-wide border border-orange-500/10">Creator</span>
                      <span className="text-[10px] text-neutral-500">Initial Request</span>
                    </div>
                    <div className="bg-[#122131]/60 border border-white/5 rounded-2xl rounded-tl-none p-4 text-xs leading-normal">
                      <div className="prose prose-invert prose-p:leading-normal max-w-none break-words">
                        {selectedTicket.messages?.[0]?.text || 'No description body.'}
                      </div>
                      {selectedTicket.messages?.[0]?.imageUrl && (
                        <div className="mt-3 overflow-hidden rounded-xl border border-white/5 bg-neutral-900 max-w-sm">
                          <img src={selectedTicket.messages[0].imageUrl} alt="attachment" className="max-h-48 object-contain" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Looped stream replies */}
                {(selectedTicket.messages || []).slice(1).map((m: any, i: number) => {
                  const isNote = m.sender === 'internal';
                  const isSupport = m.sender === 'admin';
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "flex gap-3.5 max-w-[85%] animate-fadeIn", 
                        isSupport || isNote ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border",
                        isNote ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        isSupport ? "bg-[#0f52ba]/20 text-[#b0c6ff] border-[#0f52ba]/30" :
                        "bg-[#273647]/30 text-[#c3c6d5] border-transparent"
                      )}>
                        {isNote ? 'LN' : isSupport ? 'SR' : (selectedTicket.submitterName?.[0] || 'U')}
                      </div>

                      <div className={cn("space-y-1 flex flex-col text-left", isSupport || isNote ? "items-end" : "items-start")}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white pb-0.5">
                            {isNote ? 'Private Note' : isSupport ? (m.senderName || 'Alex K. (SupportFlow Agent)') : selectedTicket.submitterName}
                          </span>
                          <span className={cn(
                            "text-[8px] uppercase font-black px-1.5 rounded tracking-widest leading-normal",
                            isNote ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" :
                            isSupport ? "bg-[#0f52ba]/30 text-[#b0c6ff] border border-[#0f52ba]/20" :
                            "bg-[#273647] text-[#c3c6d5]"
                          )}>
                            {isNote ? 'INTERNAL NOTE' : isSupport ? 'REP' : 'USER'}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <div className={cn(
                          "p-4 rounded-2xl border text-xs leading-normal max-w-sm",
                          isNote ? "bg-amber-500/5 text-amber-300 border-amber-500/20 rounded-tr-none" :
                          isSupport ? "bg-[#1c2b3c] text-white border-white/5 rounded-tr-none" :
                          "bg-[#122131]/60 text-neutral-200 border-transparent rounded-tl-none"
                        )}>
                          <div className="prose prose-invert prose-p:leading-normal max-w-none break-words">
                            <ReactMarkdown>{m.text}</ReactMarkdown>
                          </div>
                          {m.imageUrl && (
                            <div className="mt-3 overflow-hidden rounded-xl border border-white/5 bg-neutral-900 max-w-xs">
                              <img src={m.imageUrl} alt="attachment" className="max-h-40 object-contain" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply controls */}
              <div className="p-4 border-t border-[#273647]/30 bg-[#0d1c2d]">
                <form onSubmit={handleReply} className="space-y-2.5">
                  <div className="flex gap-2 text-[10px] font-bold uppercase tracking-wider pb-1 border-b border-[#273647]/20 select-none">
                    <button 
                      type="button"
                      onClick={() => setReplyType('reply')}
                      className={cn("px-2.5 py-1.5 rounded-lg transition-colors border", replyType === 'reply' ? "bg-[#0f52ba]/20 text-[#b0c6ff] border-[#0f52ba]" : "text-neutral-500 border-transparent hover:text-neutral-300")}
                    >
                      Public Reply
                    </button>
                    <button 
                      type="button"
                      onClick={() => setReplyType('note')}
                      className={cn("px-2.5 py-1.5 rounded-lg transition-colors border flex items-center gap-1", replyType === 'note' ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "text-neutral-500 border-transparent hover:text-neutral-300")}
                    >
                      <Lock size={10} /> Private Note
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      required
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder={replyType === 'note' ? "Type a private internal note (visible only to admins)..." : "Post public reply to user thread..."}
                      className="flex-1 bg-[#010f1f] border border-white/5 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-[#b0c6ff] focus:outline-none placeholder-neutral-600 font-medium"
                    />
                    <button 
                      type="submit"
                      disabled={!reply.trim()}
                      className={cn(
                        "px-4 font-bold rounded-xl text-xs flex items-center justify-center shrink-0 active:scale-95 transition-all text-white max-h-10 disabled:opacity-40",
                        replyType === 'note' ? "bg-amber-600 hover:opacity-95" : "bg-[#0f52ba] hover:opacity-95"
                      )}
                    >
                      <Send size={14} className="mr-1" /> Send
                    </button>
                  </div>
                </form>
              </div>

            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center opacity-40 p-12 text-center h-full">
              <div className="w-16 h-16 bg-[#122131] border border-white/5 rounded-full flex items-center justify-center mb-4 shadow-inner text-neutral-500">
                <MailX size={24} />
              </div>
              <h3 className="font-bold text-sm text-white">Console Idle</h3>
              <p className="text-xs text-neutral-400 max-w-xs mt-1">Select an active ticket from the roster sidebar list to inspect thread logs and reply.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
