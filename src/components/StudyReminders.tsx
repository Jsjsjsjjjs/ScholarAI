import { useState, useEffect } from "react";
import { 
  Bell, 
  Plus, 
  Trash2, 
  Clock, 
  Calendar, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { dbMirror } from "../lib/supabase";

interface Reminder {
  id: string;
  topic: string;
  subject: string;
  time: string;
  date: string;
  createdAt: any;
  status: "pending" | "completed";
}

export default function StudyReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeUid, setActiveUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      const scholarSessionId = localStorage.getItem("scholar_session_id");
      setActiveUid(scholarSessionId || user?.uid || null);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!activeUid) return;

    const q = query(
      collection(db, "users", activeUid, "reminders"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];
      setReminders(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "reminders");
    });

    return () => unsubscribe();
  }, [activeUid]);

  const addReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !subject || !time || !date || !activeUid) return;

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "users", activeUid, "reminders"), {
        topic,
        subject,
        time,
        date,
        status: "pending",
        createdAt: serverTimestamp()
      });

      // Mirror addition to Supabase
      dbMirror.mirrorReminderSave(activeUid, docRef.id, {
        topic,
        subject,
        reminderTime: time,
        reminderDate: date,
        status: "pending"
      }).catch(console.error);

      setTopic("");
      setSubject("");
      setTime("");
      setDate("");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "reminders");
    } finally {
      setLoading(false);
    }
  };

  const deleteReminder = async (id: string) => {
    if (!activeUid) return;
    try {
      await deleteDoc(doc(db, "users", activeUid, "reminders", id));
      
      // Mirror deletion to Supabase
      dbMirror.mirrorReminderDelete(activeUid, id).catch(console.error);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "reminders");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
          <Bell className="text-orange-500" />
          Study Pulse
        </h2>
        <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Tactical Reminder System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Form */}
        <div className="md:col-span-1">
          <form onSubmit={addReminder} className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl space-y-4 sticky top-8">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4">Set Reminder</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5 block">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics"
                  className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5 block">Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Thermodynamics"
                  className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5 block">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all [color-scheme:dark]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1.5 block">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all [color-scheme:dark]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-orange-600 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Plus className="animate-spin" /> : <Plus size={20} />}
                Add Reminder
              </button>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-black uppercase tracking-widest">Active Reminders</h3>
             <span className="bg-neutral-800 text-neutral-400 text-[10px] font-black px-3 py-1 rounded-full">{reminders.length} Scheduled</span>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {reminders.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-neutral-900/30 rounded-3xl border border-dashed border-neutral-800"
                >
                  <AlertCircle size={40} className="text-neutral-700 mx-auto mb-4" />
                  <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">No active reminders</p>
                  <p className="text-neutral-600 text-[8px] uppercase mt-2">Add a study session to begin</p>
                </motion.div>
              ) : (
                reminders.map((reminder) => (
                  <motion.div
                    key={reminder.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={cn(
                      "p-5 bg-neutral-900 border transition-all rounded-3xl flex items-center justify-between group",
                      reminder.status === "completed" 
                        ? "border-green-500/20 opacity-60" 
                        : "border-neutral-800 hover:border-orange-500/30"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                        reminder.status === "completed" 
                          ? "bg-green-500/10 text-green-500" 
                          : "bg-neutral-800 text-neutral-400 group-hover:bg-orange-500 group-hover:text-white"
                      )}>
                        {reminder.status === "completed" ? <CheckCircle2 size={20} /> : <BookOpen size={20} />}
                      </div>
                      <div>
                        <h4 className={cn(
                          "font-bold transition-colors",
                          reminder.status === "completed" ? "text-neutral-400 line-through" : "text-white group-hover:text-orange-500"
                        )}>
                          {reminder.topic}
                        </h4>
                        <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest mt-1">
                          Subject: {reminder.subject} 
                          {reminder.status === "completed" && " • FIRED"}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] font-black uppercase">
                            <Calendar size={12} className={reminder.status === "completed" ? "text-green-500/40" : "text-orange-500"} />
                            {reminder.date}
                          </div>
                          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] font-black uppercase">
                            <Clock size={12} className={reminder.status === "completed" ? "text-green-500/40" : "text-orange-500"} />
                            {reminder.time}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="p-3 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
