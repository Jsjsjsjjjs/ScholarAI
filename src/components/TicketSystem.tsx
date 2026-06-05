import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { 
  Ticket as TicketIcon, 
  Send, 
  Clock, 
  CheckCircle, 
  MessageSquare, 
  AlertCircle, 
  X, 
  Image as ImageIcon,
  Plus,
  ArrowRight,
  BookOpen,
  Video,
  Newspaper,
  MessagesSquare,
  Search,
  Bell,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  User,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

export default function UserTickets({ userData }: { userData: any }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Technical Issue');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [isFormViewState, setIsFormViewState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'solved'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'create' | 'reply') => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (PNG, JPG, JPEG).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image size must be less than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'create') {
          setAttachedImage(reader.result as string);
        } else {
          setReplyImage(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'tickets'),
      where('submitterUid', '==', auth.currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const t = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      // Sort in memory to avoid needing a Firestore composite index
      t.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      
      setTickets(t);
      setSelectedTicket((prev: any) => {
        if (!prev) return prev;
        const updated = t.find((tic: any) => tic.id === prev.id);
        return updated || prev;
      });
      setLoading(false);
    }, (error) => {
      console.error('Tickets listener error:', error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !auth.currentUser) return;
    setCreating(true);
    try {
      const ticketData = {
        submitterUid: auth.currentUser.uid,
        submitterName: userData?.nickname || auth.currentUser.displayName || 'Alexander',
        subject: subject.trim(),
        category,
        priority,
        status: 'open', // open, hold, solved
        messages: [{
          sender: 'user',
          text: description.trim(),
          imageUrl: attachedImage || null,
          timestamp: new Date().toISOString()
        }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'tickets'), ticketData);
      setSubject('');
      setDescription('');
      setCategory('Technical Issue');
      setPriority('medium');
      setAttachedImage(null);
      setIsFormViewState(false); // Back to Portal
    } catch (err) {
      console.error(err);
      alert('Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !replyImage) || !selectedTicket) return;
    
    const updatedMessages = [...(selectedTicket.messages || []), {
      sender: 'user',
      text: message.trim(),
      imageUrl: replyImage || null,
      timestamp: new Date().toISOString()
    }];
    
    setMessage('');
    setReplyImage(null);
    try {
      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        messages: updatedMessages,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    if (!confirm('Mark this support ticket as Resolved?')) return;
    try {
      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        status: 'solved',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    }
  };

  const activeTicketsCount = tickets.filter(t => t.status === 'open' || t.status === 'hold').length;
  const resolvedTicketsCount = tickets.filter(t => t.status === 'solved').length;

  const filteredTickets = tickets.filter(t => {
    if (filter === 'active') return t.status === 'open' || t.status === 'hold';
    if (filter === 'solved') return t.status === 'solved';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[10px] font-bold uppercase tracking-wider">Awaiting Agent</span>;
      case 'hold':
        return <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold uppercase tracking-wider">Awaiting User</span>;
      case 'solved':
        return <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold uppercase tracking-wider">Resolved</span>;
      default:
        return <span className="px-2.5 py-1 bg-neutral-500/10 text-neutral-400 border border-neutral-500/20 rounded text-[10px] font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  // Helper formatting dates in human-readable structure
  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return 'Just now';
    const date = new Date(isoString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + 'd ago';
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + 'h ago';
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + 'm ago';
    return 'Just now';
  };

  // Find name of acting admin for assigned expert property dynamically
  const getAssignedExpert = () => {
    if (!selectedTicket) return 'Sarah K. (Specialist)';
    const adminReplies = (selectedTicket.messages || []).filter((m: any) => m.sender === 'admin' && m.senderName);
    if (adminReplies.length > 0) {
      return `${adminReplies[adminReplies.length - 1].senderName} (Specialist)`;
    }
    return 'Sarah K. (Specialist)';
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-[#051424] text-[#d4e4fa]">
        <Clock className="mx-auto h-8 w-8 animate-spin text-[#b0c6ff] mb-4" />
        <p className="font-medium tracking-wide">Retrieving secure support records...</p>
      </div>
    );
  }

  // View state machine
  return (
    <div className="w-full text-[#d4e4fa] select-none text-sans">
      
      {/* State A: DETAIL VIEW */}
      {selectedTicket && !isFormViewState && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 bg-[#051424] rounded-2xl border border-white/5 overflow-hidden animate-fadeIn h-[68vh] sm:h-[78vh]">
          {/* Support Ticket main thread (3 cols) */}
          <section className="col-span-1 lg:col-span-3 flex flex-col h-full overflow-hidden lg:border-r border-[#273647]/40">
            {/* Header toolbar */}
            <div className="p-5 border-b border-[#273647]/30 bg-[#0d1c2d]/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <button 
                  onClick={() => setSelectedTicket(null)} 
                  className="flex items-center gap-1 text-xs text-[#b0c6ff] hover:underline font-bold tracking-wider mb-1"
                >
                  <ChevronLeft size={14} /> BACK TO LIST
                </button>
                <h2 className="font-bold text-lg text-white tracking-normal">{selectedTicket.subject}</h2>
                <div className="flex items-center gap-3 text-xs text-[#c3c6d5]">
                  <span className="font-mono bg-[#122131] px-2 py-0.5 rounded border border-white/5">#{selectedTicket.id.slice(0, 8)}</span>
                  <span>Category: <strong className="text-[#b0c6ff]">{selectedTicket.category || 'General'}</strong></span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {selectedTicket.status !== 'solved' && (
                  <button 
                    onClick={handleCloseTicket}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-all active:scale-95Fast"
                  >
                    Close Ticket
                  </button>
                )}
                <span className="flex items-center">{getStatusBadge(selectedTicket.status)}</span>
              </div>
            </div>

            {/* Conversation Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 bg-[#010f1f]/50">
              {/* Initial description message */}
              <div className="flex gap-3 sm:gap-4 max-w-[95%] sm:max-w-[85%]">
                <div className="w-10 h-10 rounded-full flex-shrink-0 bg-[#0f52ba]/20 flex items-center justify-center text-[#b0c6ff] border border-[#0f52ba]/30 font-display font-black text-xs uppercase">
                  {selectedTicket.submitterName?.[0] || 'A'}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{selectedTicket.submitterName}</span>
                    <span className="text-[10px] text-neutral-500 uppercase font-black font-mono tracking-widest bg-emerald-500/5 px-2 py-0.5 rounded text-emerald-400">Creator</span>
                  </div>
                  <div className="bg-[#122131]/80 border border-white/5 rounded-2xl rounded-tl-none p-3.5 sm:p-5 text-sm leading-relaxed text-[#d4e4fa] shadow-sm">
                    {/* Rendered initially */}
                    <div className="prose prose-invert prose-p:leading-normal max-w-none break-words">
                      {selectedTicket.messages?.[0]?.text || 'No description provided.'}
                    </div>
                    {selectedTicket.messages?.[0]?.imageUrl && (
                      <div className="mt-4 border border-white/5 rounded-xl overflow-hidden max-w-md bg-neutral-900">
                        <img 
                          src={selectedTicket.messages[0].imageUrl} 
                          alt="Attachment" 
                          className="max-h-64 h-auto w-auto object-contain object-left"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Loop rest of conversation */}
              {(selectedTicket.messages || []).slice(1).map((m: any, i: number) => {
                const isAdmin = m.sender === 'admin';
                return (
                  <div key={i} className={cn("flex gap-3 max-w-[95%] sm:max-w-[85%] animate-fadeIn", isAdmin ? "ml-auto flex-row-reverse" : "mr-auto")}>
                    <div className={cn(
                      "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0 flex items-center justify-center font-display font-black text-xs uppercase border shadow-sm",
                      isAdmin 
                        ? "bg-[#0f52ba]/20 border-[#0f52ba]/40 text-[#b0c6ff]"
                        : "bg-[#273647]/30 border-[#434653]/30 text-neutral-300"
                    )}>
                      {isAdmin ? 'SR' : (selectedTicket.submitterName?.[0] || 'A')}
                    </div>
                    <div className={cn("space-y-1 flex flex-col", isAdmin ? "items-end text-right" : "items-start")}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">
                          {isAdmin ? (m.senderName || 'Alex K. (SupportFlow Agent)') : selectedTicket.submitterName}
                        </span>
                        <span className={cn(
                          "text-[9px] uppercase font-black tracking-widest font-mono px-1.5 py-0.2 rounded",
                          isAdmin ? "bg-[#0f52ba]/30 text-[#b0c6ff]" : "bg-[#273647] text-[#c3c6d5]"
                        )}>
                          {isAdmin ? 'Agent' : 'User'}
                        </span>
                        <span className="text-[10px] text-neutral-500">{m.timestamp ? formatTimeAgo(m.timestamp) : ''}</span>
                      </div>
                      <div className={cn(
                        "p-3.5 sm:p-5 rounded-2xl border text-sm leading-relaxed text-[#d4e4fa] shadow-sm max-w-md text-left",
                        isAdmin 
                          ? "bg-[#1c2b3c] border-[#b0c6ff]/10 rounded-tr-none" 
                          : "bg-[#122131]/80 border-white/5 rounded-tl-none"
                      )}>
                        <div className="prose prose-invert prose-p:leading-normal max-w-none break-words">
                          <ReactMarkdown>{m.text}</ReactMarkdown>
                        </div>
                        {m.imageUrl && (
                          <div className="mt-3 border border-white/5 rounded-xl overflow-hidden max-w-sm bg-neutral-900">
                            <img 
                              src={m.imageUrl} 
                              alt="Attachment Upload" 
                              className="max-h-48 h-auto w-auto object-contain"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom reply widget input */}
            <div className="p-4 border-t border-[#273647]/30 bg-[#0d1c2d]">
              {selectedTicket.status === 'solved' ? (
                <div className="text-center py-3.5 bg-emerald-500/5 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                  <CheckCircle size={15} /> This support incident has been resolved. You can submit a new ticket for any new queries.
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="space-y-3">
                  {replyImage && (
                    <div className="relative inline-block self-start shadow-md bg-[#051424] p-1 border border-white/5 rounded-lg">
                      <img src={replyImage} alt="Preview Attachment" className="h-16 rounded object-cover" />
                      <button 
                        type="button" 
                        onClick={() => setReplyImage(null)} 
                        className="absolute -top-2 -right-2 bg-red-600 rounded-full p-0.5 hover:bg-red-700 text-white transition-all shadow"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <label className="bg-[#122131] border border-white/5 hover:bg-[#1c2b3c] cursor-pointer p-3 rounded-xl flex items-center justify-center transition-all shrink-0">
                      <ImageIcon size={18} className={replyImage ? "text-[#b0c6ff]" : "text-neutral-400"} />
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, 'reply')} 
                      />
                    </label>
                    <input 
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Post a response thread..."
                      className="flex-1 bg-[#010f1f] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-[#d4e4fa] focus:ring-1 focus:ring-[#b0c6ff] focus:outline-none placeholder-[#8d909e]/60 font-medium"
                    />
                    <button 
                      type="submit"
                      disabled={!message.trim() && !replyImage}
                      className="bg-[#0f52ba] hover:opacity-95 text-[#bcceff] px-5 font-bold rounded-xl transition-all flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-40"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* SLA & Details sidebar (1 col) */}
          <aside className="hidden lg:block lg:col-span-1 p-6 space-y-6 overflow-y-auto bg-[#0d1c2d]/50">
            {/* SLA countdown badge */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">SLA Timer</span>
                {selectedTicket.priority === 'urgent' || selectedTicket.priority === 'high' ? (
                  <span className="text-[9px] bg-red-500/10 text-red-400 font-black tracking-wider px-2 py-0.5 rounded border border-red-500/20">Urgent SLA</span>
                ) : (
                  <span className="text-[9px] bg-[#0f52ba]/20 text-[#b0c6ff] font-black tracking-wider px-2 py-0.5 rounded border border-[#0f52ba]/30">Standard SLA</span>
                )}
              </div>
              <div className="bg-[#122131] border border-white/5 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#c3c6d5]">SLA Limit target</span>
                  <strong className="text-white">Active</strong>
                </div>
                <div className="w-full bg-[#051424] h-1.5 rounded-full overflow-hidden">
                  <div className={cn("h-full", selectedTicket.status === 'solved' ? "bg-emerald-500 w-full" : "bg-[#b0c6ff] w-[65%]")}></div>
                </div>
                <p className="text-[10px] text-neutral-500 leading-none">
                  {selectedTicket.status === 'solved' ? 'Resolution fully completed.' : 'Next checkpoint response target: 12h'}
                </p>
              </div>
            </div>

            {/* Ticket Properties */}
            <div className="border-t border-[#273647]/30 pt-6 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#b0c6ff]">properties</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase font-black tracking-wider text-neutral-500">priority</p>
                  <span className={cn(
                    "inline-block text-[10px] font-bold uppercase tracking-wide mt-1 px-2.5 py-0.5 rounded",
                    selectedTicket.priority === 'urgent' ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                    selectedTicket.priority === 'high' ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
                    selectedTicket.priority === 'medium' ? "bg-[#0f52ba]/10 text-[#b0c6ff] border border-[#0f52ba]/20" :
                    "bg-neutral-800 text-neutral-400"
                  )}>
                    {selectedTicket.priority || 'Medium'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black tracking-wider text-neutral-500">Assigned Expert</p>
                  <p className="text-xs font-bold text-white mt-1">{getAssignedExpert()}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black tracking-wider text-neutral-500">Type</p>
                  <p className="text-xs font-medium text-white mt-0.5">Problem / Request</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black tracking-wider text-neutral-500">Platform Scope</p>
                  <p className="text-xs font-mono text-[#b0c6ff] mt-0.5">ScholarAI Client</p>
                </div>
              </div>
            </div>

            {/* Requester Details */}
            <div className="border-t border-[#273647]/30 pt-6 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#b0c6ff]">Requester context</h4>
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 bg-gradient-to-tr from-[#0f52ba] to-[#7bd0ff] rounded-xl flex items-center justify-center font-display font-black text-xs text-white">
                  {selectedTicket.submitterName?.[0] || 'A'}
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{selectedTicket.submitterName}</p>
                  <p className="text-[10px] text-neutral-500">Student Scholar</p>
                </div>
              </div>
              <p className="text-[11px] text-[#c3c6d5] leading-relaxed">
                Registered platform user under ID: <code className="font-mono bg-[#122131] px-1 py-0.5 rounded">#{auth.currentUser.uid.slice(0, 8)}</code>.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* State B: CREATE TICKET VIEW */}
      {isFormViewState && !selectedTicket && (
        <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
          {/* Back link */}
          <button 
            onClick={() => setIsFormViewState(false)}
            className="flex items-center gap-1.5 text-xs text-[#b0c6ff] hover:underline font-bold tracking-wider"
          >
            <ChevronLeft size={14} /> REVERT TO PORTAL LIST
          </button>

          <h2 className="text-2xl font-bold text-white tracking-tight">Create Support Incident Ticket</h2>
          <p className="text-xs text-[#c3c6d5] mt-1">Submit high priority tickets instantly to our operations engineers. Expect responses within hours.</p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            {/* Form Column */}
            <div className="lg:col-span-8 bg-[#0d1c2d] border border-white/5 rounded-2xl p-6 relative overflow-hidden space-y-6">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0f52ba]/5 to-transparent pointer-none"></div>
              
              <form onSubmit={handleCreate} className="space-y-4 relative z-10">
                {/* Prefilled email indicator */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#c3c6d5]" htmlFor="email">Customer / Submitter Email</label>
                  <div className="flex bg-[#010f1f]/80 border border-white/5 rounded-xl px-4 py-3 text-xs font-mono text-neutral-400 select-all cursor-pointer">
                    <User size={14} className="mr-2 text-neutral-500 self-center" />
                    {auth.currentUser?.email || 'anonymous@scholarai.app'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category Selection */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#c3c6d5]">Issue Category</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-[#122131] border border-white/5 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-[#b0c6ff] focus:outline-none uppercase font-bold text-[#b0c6ff] h-10 cursor-pointer"
                    >
                      <option value="Technical Issue">Technical / Coding Issue</option>
                      <option value="Billing & Invoices">Billing / AI Token Quota</option>
                      <option value="Feature Request">New Feature Ideas</option>
                      <option value="Account Access">Account Access / Discord Sync</option>
                      <option value="General Inquiry">General Query</option>
                    </select>
                  </div>

                  {/* Priority radios */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#c3c6d5]">Priority Specification</label>
                    <div className="flex gap-1 h-10 select-none">
                      {['low', 'medium', 'high', 'urgent'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={cn(
                            "flex-1 text-[9px] font-black uppercase tracking-wider rounded-lg border flex items-center justify-center transition-all",
                            priority === p 
                              ? p === 'urgent'
                                ? "bg-red-500/20 text-red-400 border-red-500"
                                : "bg-[#0f52ba]/20 text-[#b0c6ff] border-[#0f52ba]" 
                              : "bg-[#122131] text-[#c3c6d5] border-transparent hover:bg-[#1c2b3c]"
                          )}
                        >
                          {p.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Subject text input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#c3c6d5]">Brief Subject Overview</label>
                  <input 
                    type="text" 
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Summarize the core technical problem..."
                    className="w-full bg-[#010f1f] border border-white/5 rounded-xl px-4 py-2.5 text-xs text-[#d4e4fa] focus:ring-1 focus:ring-[#b0c6ff] focus:outline-none placeholder-neutral-600 font-medium h-10"
                  />
                </div>

                {/* Description textarea */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#c3c6d5]">Detailed Description & Environment Details</label>
                  <textarea 
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Include detailed steps to reproduce, or notes on what happened. Markdown supported."
                    rows={5}
                    className="w-full bg-[#010f1f] border border-white/5 rounded-xl p-4 text-xs text-[#d4e4fa] focus:ring-1 focus:ring-[#b0c6ff] focus:outline-none placeholder-neutral-600 font-medium resize-none leading-relaxed"
                  />
                </div>

                {/* File/Image Upload area */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#c3c6d5] block">Attached Screenshot (Optional)</label>
                  {attachedImage ? (
                    <div className="relative inline-block border border-[#273647] p-1 bg-neutral-900 rounded-xl max-w-xs shadow-md">
                      <img src={attachedImage} alt="Preview Uploaded Asset" className="max-h-32 object-contain rounded-lg" />
                      <button 
                        type="button" 
                        onClick={() => setAttachedImage(null)} 
                        className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1 border border-white/10 hover:bg-red-700 transition-all shadow"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="border border-dashed border-[#273647] hover:border-[#b0c6ff]/40 bg-[#010f1f]/50 p-6 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                      <ImageIcon className="text-[#b0c6ff] mb-2" size={24} />
                      <span className="text-xs font-bold mb-0.5 text-white">Click to Upload Diagnostic Screenshot</span>
                      <span className="text-[10px] text-neutral-500">PNG or JPG files (Max 5MB)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, 'create')} 
                      />
                    </label>
                  )}
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-[#273647]/30">
                  <button 
                    type="button" 
                    onClick={() => setIsFormViewState(false)}
                    className="px-5 py-2.5 rounded-xl border border-[#273647] font-bold text-[#c3c6d5] hover:bg-[#122131]/60 text-xs active:scale-95 transition-all"
                  >
                    Discard Changes
                  </button>
                  <button 
                    type="submit"
                    disabled={creating || !subject.trim() || !description.trim()}
                    className="px-6 py-2.5 bg-[#0f52ba] text-[#bcceff] rounded-xl font-bold text-xs tracking-wider uppercase active:scale-95 hover:opacity-95 disabled:opacity-40 shadow-lg shadow-[#0f52ba]/20 flex items-center justify-center gap-1.5 transition-all"
                  >
                    {creating ? 'Submitting...' : 'Send Ticket'} <Send size={12} />
                  </button>
                </div>
              </form>
            </div>

            {/* Sidebar Columns (Info) */}
            <div className="lg:col-span-4 space-y-6">
              {/* System status widget */}
              <div className="bg-[#122131] border border-white/5 rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="font-bold text-sm text-white tracking-wide">Infrastructure Status</h3>
                <div className="space-y-3 font-mono text-[11px] leading-none text-neutral-400">
                  <div className="flex justify-between items-center bg-[#0d1c2d] p-3 rounded-lg border border-white/5">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>Database Systems</span>
                    <strong className="text-emerald-400 uppercase">Operational</strong>
                  </div>
                  <div className="flex justify-between items-center bg-[#0d1c2d] p-3 rounded-lg border border-white/5">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span>OAuth Services</span>
                    <strong className="text-emerald-400 uppercase">Active</strong>
                  </div>
                </div>
              </div>

              {/* Expert Tips */}
              <div className="bg-gradient-to-br from-[#0f52ba]/10 to-[#122131] border border-white/5 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 blur-0">
                  <Sparkles size={40} className="text-[#7bd0ff]" />
                </div>
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5"><Sparkles size={16} className="text-[#7bd0ff]" /> Support Pro Tip</h3>
                <p className="text-xs text-[#c3c6d5] leading-relaxed">
                  Support tickets featuring environmental screenshots require <strong>35% fewer</strong> back-and-forth diagnostic replies. Always include error trace logs!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* State C: DEFAULT CUSTOMER PORTAL */}
      {!selectedTicket && !isFormViewState && (
        <div className="space-y-6 animate-fadeIn">
          {/* Welcome header with active actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                SupportFlow Portal
              </h1>
              <p className="text-sm text-[#c3c6d5]">
                Manage technical issues, system configurations, and AI developer queries under your scholar license.
              </p>
            </div>
            <button 
              onClick={() => setIsFormViewState(true)}
              className="px-5 py-3 rounded-xl bg-[#0f52ba] hover:opacity-95 text-[#bcceff] font-bold text-xs tracking-wider uppercase flex items-center gap-2 active:scale-95 shadow-lg shadow-[#0f52ba]/20 transition-all"
            >
              <Plus size={16} className="stroke-[3]" /> Open Support Ticket
            </button>
          </div>

          {/* Stats Summary Panel */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* Active stats counter (3 cols) */}
            <div className="md:col-span-3 bg-[#122131] border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:border-[#b0c6ff]/30 transition-all duration-300">
              <div className="flex justify-between items-start">
                <TicketIcon className="text-[#b0c6ff] h-8 w-8" />
                <span className="text-[9px] bg-[#0d1c2d] text-neutral-400 border border-white/5 rounded px-2 py-0.5 font-bold uppercase tracking-wider">ACTIVE</span>
              </div>
              <div className="mt-6">
                <h3 className="text-4xl font-black text-white leading-none">{String(activeTicketsCount).padStart(2, '0')}</h3>
                <p className="text-xs text-[#c3c6d5] mt-1 font-medium">Tickets in execution</p>
              </div>
            </div>

            {/* Resolved stats counter (3 cols) */}
            <div className="md:col-span-3 bg-[#122131] border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex justify-between items-start">
                <CheckCircle className="text-emerald-400 h-8 w-8" />
                <span className="text-[9px] bg-[#0d1c2d] text-neutral-400 border border-white/5 rounded px-2 py-0.5 font-bold uppercase tracking-wider">RESOLVED</span>
              </div>
              <div className="mt-6">
                <h3 className="text-4xl font-black text-white leading-none">{String(resolvedTicketsCount).padStart(2, '0')}</h3>
                <p className="text-xs text-[#c3c6d5] mt-1 font-medium">Addressed on platform</p>
              </div>
            </div>

            {/* Hero AI Promo Banner (6 cols) */}
            <div className="md:col-span-6 border border-white/5 rounded-2xl overflow-hidden relative flex min-h-[140px]">
              <div className="absolute inset-0 bg-neutral-950/80 saturate-[1.2] opacity-35"></div>
              {/* Complex background circuits block representation */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#122131] via-[#0d1c2d] to-transparent pointer-events-none"></div>
              
              <div className="relative z-10 p-5 flex flex-col justify-center space-y-2 max-w-sm">
                <span className="text-[9px] font-black uppercase tracking-widest bg-[#0f52ba]/30 border border-[#0f52ba]/40 text-[#b0c6ff] px-2 py-0.5 rounded w-fit">Featured integration</span>
                <h3 className="text-[#d4e4fa] font-bold text-base leading-tight">AI Diagnostic Assistant Logs</h3>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Support flows automatically isolate configuration mistakes or token exhaustion logs securely.
                </p>
              </div>
            </div>
          </div>

          {/* Ticket Listing Table-Card */}
          <section className="bg-[#0d1c2d] border border-white/5 rounded-2xl overflow-hidden">
            {/* Filter toolbar */}
            <div className="px-5 py-4 border-b border-[#273647]/30 bg-[#122131]/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="font-bold text-sm text-white tracking-normal uppercase">My Ticket History</h3>
              <div className="flex gap-1 bg-[#010f1f] p-1 border border-white/5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                <button 
                  onClick={() => setFilter('all')}
                  className={cn("px-2.5 py-1 rounded transition-colors", filter === 'all' ? "bg-[#122131] text-[#b0c6ff]" : "text-neutral-500 hover:text-neutral-300")}
                >
                  All
                </button>
                <button 
                  onClick={() => setFilter('active')}
                  className={cn("px-2.5 py-1 rounded transition-colors", filter === 'active' ? "bg-[#122131] text-[#b0c6ff]" : "text-neutral-500 hover:text-neutral-300")}
                >
                  Active
                </button>
                <button 
                  onClick={() => setFilter('solved')}
                  className={cn("px-2.5 py-1 rounded transition-colors", filter === 'solved' ? "bg-[#122131] text-[#b0c6ff]" : "text-neutral-500 hover:text-neutral-300")}
                >
                  Completed
                </button>
              </div>
            </div>

            {/* List entries */}
            <div className="divide-y divide-white/5">
              {filteredTickets.map(t => (
                <div 
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-[#122131]/30 transition-all duration-200"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0">
                      {t.status === 'solved' ? (
                        <CheckCircle className="text-emerald-400 h-5 w-5" />
                      ) : (
                        <MessageSquare className="text-[#b0c6ff] h-5 w-5 animate-pulse" />
                      )}
                    </div>
                    <div className="space-y-0.5 max-w-lg">
                      <h4 className="font-semibold text-sm text-white leading-snug hover:text-[#b0c6ff] transition-colors">{t.subject}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-500">
                        <span className="font-mono">ID: {t.id.slice(0, 8)}</span>
                        <span className="w-1 h-1 bg-neutral-600 rounded-full"></span>
                        <span className="capitalize">{t.status || 'open'}</span>
                        <span className="w-1 h-1 bg-neutral-600 rounded-full"></span>
                        <span className="text-neutral-400 font-mono">Category: {t.category || 'General'}</span>
                        <span className="w-1 h-1 bg-neutral-600 rounded-full"></span>
                        <span>Opened {t.createdAt?.seconds ? formatTimeAgo(new Date(t.createdAt.seconds * 1000).toISOString()) : 'Just now'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 py-1 self-end sm:self-center">
                    <span className="flex shrink-0">{getStatusBadge(t.status)}</span>
                    <ChevronRight size={16} className="text-neutral-500 hidden sm:block" />
                  </div>
                </div>
              ))}

              {filteredTickets.length === 0 && (
                <div className="p-12 text-center text-neutral-500 text-xs">
                  <MessagesSquare className="mx-auto h-8 w-8 opacity-30 mb-2" />
                  No tickets indexing the active directory list filters.
                </div>
              )}
            </div>
          </section>

          {/* Quick Help Resources */}
          <section className="space-y-3">
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">Quick Help Center</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <a 
                href="#guide" 
                className="bg-[#122131]/60 border border-white/5 rounded-xl p-4 flex gap-3 hover:bg-[#1c2b3c] transition-all duration-300"
              >
                <BookOpen className="text-[#b0c6ff] shrink-0" size={18} />
                <div>
                  <h4 className="font-bold text-xs text-white">Academic Library</h4>
                  <p className="text-[10px] text-[#c3c6d5] mt-1">Syllabus indices and concept maps.</p>
                </div>
              </a>
              <a 
                href="#quiz" 
                className="bg-[#122131]/60 border border-white/5 rounded-xl p-4 flex gap-3 hover:bg-[#1c2b3c] transition-all duration-300"
              >
                <Video className="text-[#b0c6ff] shrink-0" size={18} />
                <div>
                  <h4 className="font-bold text-xs text-white">Board Concept Quizzes</h4>
                  <p className="text-[10px] text-[#c3c6d5] mt-1">Evaluate learning with adaptive tests.</p>
                </div>
              </a>
              <a 
                href="#pyq" 
                className="bg-[#122131]/60 border border-white/5 rounded-xl p-4 flex gap-3 hover:bg-[#1c2b3c] transition-all duration-300"
              >
                <Newspaper className="text-[#b0c6ff] shrink-0" size={18} />
                <div>
                  <h4 className="font-bold text-xs text-white">Topper Papers</h4>
                  <p className="text-[10px] text-[#c3c6d5] mt-1">Review official CBSE solutions.</p>
                </div>
              </a>
              <a 
                href="#duel" 
                className="bg-[#122131]/60 border border-white/5 rounded-xl p-4 flex gap-3 hover:bg-[#1c2b3c] transition-all duration-300"
              >
                <MessagesSquare className="text-[#b0c6ff] shrink-0" size={18} />
                <div>
                  <h4 className="font-bold text-xs text-white">AI Game Center</h4>
                  <p className="text-[10px] text-[#c3c6d5] mt-1">Duel against models on concept grids.</p>
                </div>
              </a>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
