import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, orderBy, limit, addDoc, deleteDoc, serverTimestamp, getFirestore } from "firebase/firestore";
import { db } from "./firebase";
import { getSupabase } from "./supabase";

export type DBType = "firestore" | "supabase";

let globalActiveDb: DBType = (localStorage.getItem("scholar_active_db") as DBType) || "firestore";

/**
 * Checks which database is currently designated as active.
 * Defaults to 'firestore'.
 */
export function getActiveDB(): DBType {
  return globalActiveDb;
}

/**
 * Changes active database setting and triggers callbacks/reload if requested.
 */
export function setActiveDB(type: DBType) {
  globalActiveDb = type;
  localStorage.setItem("scholar_active_db", type);
}

export const dbService = {
  // === SYSTEM / PLATFORM CONFIG CONFIGURATION ===
  async getSystemConfig() {
    try {
      if (getActiveDB() === "supabase") {
        const supabase = getSupabase();
        if (supabase) {
          const { data, error } = await supabase
            .from("system")
            .select("*")
            .eq("doc_id", "config")
            .maybeSingle();
          if (!error && data) {
            return {
              maintenanceMode: data.maintenance_mode ?? false,
              logoUrl: data.logo_url ?? "",
              activeModel: data.active_model ?? "gemini-3.5-flash",
              requestCapLimit: data.request_cap_limit ?? 100
            };
          }
        }
      }
    } catch (e) {
      console.warn("Supabase Config error, falling back to Firestore:", e);
    }

    // Default Firestore loading
    try {
      const snap = await getDoc(doc(db, "system", "config"));
      if (snap.exists()) {
        const data = snap.data();
        return {
          maintenanceMode: data.maintenanceMode ?? false,
          logoUrl: data.logoUrl ?? "",
          activeModel: data.activeModel ?? "gemini-3.5-flash",
          requestCapLimit: data.requestCapLimit ?? 100
        };
      }
    } catch (err) {
      console.error("Firestore loading config failed:", err);
    }

    return {
      maintenanceMode: false,
      logoUrl: "",
      activeModel: "gemini-3.5-flash",
      requestCapLimit: 100
    };
  },

  async updateSystemConfig(updates: any) {
    // Write to active db, mirror to the other
    const isSupabase = getActiveDB() === "supabase";
    
    // 1. Write Firestore Config
    try {
      const configRef = doc(db, "system", "config");
      await setDoc(configRef, {
        maintenanceMode: updates.maintenanceMode,
        logoUrl: updates.logoUrl,
        activeModel: updates.activeModel,
        requestCapLimit: updates.requestCapLimit,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed writing Firestore system-config:", err);
    }

    // 2. Write Supabase Config (if table public.system exists)
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("system").upsert({
          doc_id: "config",
          maintenance_mode: updates.maintenanceMode,
          logo_url: updates.logoUrl,
          active_model: updates.activeModel,
          request_cap_limit: updates.requestCapLimit,
          updated_at: new Date()
        });
      } catch (err) {
        console.warn("Table system may not exist yet in Supabase:", err);
      }
    }
  },

  // === USER CREDENTIALS & LIMITS MANAGEMENT ===
  async getUser(uid: string) {
    if (getActiveDB() === "supabase") {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("uid", uid)
            .maybeSingle();

          if (!error && data) {
            return {
              uid: data.uid,
              nickname: data.nickname || "Scholar Player",
              email: data.email || "",
              role: data.user_role || "user",
              plan: data.plan || "free",
              aiRequests: data.ai_requests ?? 0,
              limit: data.limit !== undefined ? data.limit : 20,
              totalTokens: data.total_tokens ?? 0,
              quotaExhausted: data.quota_exhausted ?? false,
              colorMode: data.color_mode || "dark",
              joinedAt: data.joined_at
            };
          }
        } catch (e) {
          console.error("Supabase user read failed:", e);
        }
      }
    }

    // Firestore fallback
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      return { uid, ...snap.data() };
    }
    return null;
  },

  async saveUser(uid: string, data: any) {
    // 1. Save Firestore
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, data, { merge: true });

    // 2. Sync / Upsert to Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        const payload: any = { uid };
        if (data.nickname !== undefined) payload.nickname = data.nickname;
        if (data.email !== undefined) payload.email = data.email;
        if (data.role !== undefined) payload.user_role = data.role;
        if (data.plan !== undefined) payload.plan = data.plan;
        if (data.aiRequests !== undefined) payload.ai_requests = data.aiRequests;
        if (data.totalTokens !== undefined) payload.total_tokens = data.totalTokens;
        if (data.quotaExhausted !== undefined) payload.quota_exhausted = data.quotaExhausted;
        if (data.colorMode !== undefined) payload.color_mode = data.colorMode;
        if (data.joinedAt !== undefined) payload.joined_at = new Date();

        await supabase.from("users").upsert(payload);
      } catch (e) {
        console.warn("Supabase auto-sync user update warning:", e);
      }
    }
  },

  // === SCORE CARD / ACADEMIC STATISTICS ===
  async getStats(uid: string) {
    if (getActiveDB() === "supabase") {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("stats")
            .select("*")
            .eq("user_id", uid)
            .maybeSingle();

          if (!error && data) {
            return {
              userId: data.user_id,
              nickname: data.nickname,
              quizCorrect: data.quiz_correct ?? 0,
              totalAttempted: data.total_attempted ?? 0,
              accuracy: Number(data.accuracy) || 0,
              timeSpent: data.time_spent ?? 0,
              lastUpdated: data.last_updated
            };
          }
        } catch (e) {
          console.error("Supabase stats read failure:", e);
        }
      }
    }

    // Firestore
    const snap = await getDoc(doc(db, "stats", uid));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  },

  async saveStats(uid: string, data: any) {
    // 1. Firestore
    await setDoc(doc(db, "stats", uid), data, { merge: true });

    // 2. Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        const payload: any = {
          user_id: uid,
        };
        if (data.nickname !== undefined) payload.nickname = data.nickname;
        if (data.quizCorrect !== undefined) payload.quiz_correct = data.quizCorrect;
        if (data.totalAttempted !== undefined) payload.total_attempted = data.totalAttempted;
        if (data.accuracy !== undefined) payload.accuracy = data.accuracy;
        if (data.timeSpent !== undefined) payload.time_spent = data.timeSpent;
        payload.last_updated = new Date();

        await supabase.from("stats").upsert(payload);
      } catch (e) {
        console.warn("Supabase auto-sync stats warning:", e);
      }
    }
  },

  // === COURSE PROGRESS ===
  async getProgress(uid: string) {
    if (getActiveDB() === "supabase") {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("progress")
            .select("*")
            .eq("user_id", uid);
          
          if (!error && data) {
            return data.map(item => ({
              id: item.topic_id,
              topicId: item.topic_id,
              topic: item.topic,
              subject: item.subject,
              notesRead: item.notes_read ?? false,
              quizTaken: item.quiz_taken ?? false,
              pyqsViewed: item.pyqs_viewed ?? false,
              lastActivity: item.last_activity
            }));
          }
        } catch (e) {
          console.error("Supabase progress read failure:", e);
        }
      }
    }

    // Firestore fallback fetch
    try {
      const snap = await getDocs(collection(db, "users", uid, "progress"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("Firestore load progress failure:", err);
      return [];
    }
  },

  async saveProgress(uid: string, topicId: string, data: any) {
    // 1. Firestore
    const progressRef = doc(db, "users", uid, "progress", topicId);
    await setDoc(progressRef, data, { merge: true });

    // 2. Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("progress").upsert({
          user_id: uid,
          topic_id: topicId,
          topic: data.topic || "",
          subject: data.subject || "SCIENCE",
          notes_read: data.notesRead ?? false,
          quiz_taken: data.quizTaken ?? false,
          pyqs_viewed: data.pyqsViewed ?? false,
          last_activity: new Date()
        }, { onConflict: "user_id,topic_id" });
      } catch (e) {
        console.warn("Supabase sync progress warning:", e);
      }
    }
  },

  // === DOUBTS / GENERATIONS ===
  async getDoubts(uid: string) {
    if (getActiveDB() === "supabase") {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("doubts")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", { ascending: false });
          if (!error && data) {
            return data.map(item => ({
              id: item.doubt_id,
              question: item.question,
              answer: item.answer,
              createdAt: item.created_at
            }));
          }
        } catch (e) {
          console.error("Supabase doubt collection read failure:", e);
        }
      }
    }

    // Firestore fallback
    try {
      const snap = await getDocs(collection(db, "users", uid, "doubts"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("Firestore load doubts failure:", err);
      return [];
    }
  },

  async addDoubt(uid: string, question: string, answer: string) {
    const doubtId = `doubt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // 1. Firestore
    try {
      await setDoc(doc(db, "users", uid, "doubts", doubtId), {
        question,
        answer,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Firestore doubt save error:", e);
    }

    // 2. Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("doubts").upsert({
          doubt_id: doubtId,
          user_id: uid,
          question,
          answer,
          created_at: new Date()
        });
      } catch (e) {
        console.warn("Supabase sync doubt error:", e);
      }
    }
    return doubtId;
  },

  // === STUDY REMINDERS ===
  async getReminders(uid: string) {
    if (getActiveDB() === "supabase") {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("reminders")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", { ascending: false });
          if (!error && data) {
            return data.map(item => ({
              id: item.reminder_id,
              subject: item.subject,
              topic: item.topic,
              date: item.reminder_date,
              time: item.reminder_time,
              status: item.status || "pending",
              createdAt: item.created_at
            }));
          }
        } catch (e) {
          console.error("Supabase reminders read failure:", e);
        }
      }
    }

    // Firestore
    try {
      const snap = await getDocs(collection(db, "users", uid, "reminders"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("Firestore load reminders error:", err);
      return [];
    }
  },

  async addReminder(uid: string, reminderData: any) {
    const reminderId = `reminder_${Date.now()}`;
    
    // 1. Firestore
    try {
      await setDoc(doc(db, "users", uid, "reminders", reminderId), {
        subject: reminderData.subject,
        topic: reminderData.topic,
        date: reminderData.date,
        time: reminderData.time,
        status: reminderData.status || "pending",
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Firestore reminder creation failed:", e);
    }

    // 2. Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("reminders").upsert({
          reminder_id: reminderId,
          user_id: uid,
          subject: reminderData.subject,
          topic: reminderData.topic,
          reminder_date: reminderData.date,
          reminder_time: reminderData.time,
          status: reminderData.status || "pending",
          created_at: new Date()
        });
      } catch (e) {
        console.warn("Supabase reminder upsert issue:", e);
      }
    }

    return reminderId;
  },

  async deleteReminder(uid: string, id: string) {
    // 1. Firestore delete
    try {
      await deleteDoc(doc(db, "users", uid, "reminders", id));
    } catch (e) {
      console.error("Firestore reminder delete failure:", e);
    }

    // 2. Supabase delete
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("reminders").delete().eq("reminder_id", id);
      } catch (e) {
        console.warn("Supabase reminder delete issue:", e);
      }
    }
  },

  // === LEADERBOARDS & STATS ROSTER ===
  async getLeaderboard() {
    if (getActiveDB() === "supabase") {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("stats")
            .select("*")
            .order("quiz_correct", { ascending: false })
            .limit(10);
          if (!error && data) {
            return data.map(item => ({
              id: item.user_id,
              userId: item.user_id,
              nickname: item.nickname,
              quizCorrect: item.quiz_correct ?? 0,
              totalAttempted: item.total_attempted ?? 0,
              accuracy: Number(item.accuracy) || 0.0,
              timeSpent: item.time_spent ?? 0
            }));
          }
        } catch (e) {
          console.error("Supabase leaderboard retrieval failure:", e);
        }
      }
    }

    // Firestore fallback
    try {
      const q = query(collection(db, "stats"), orderBy("quizCorrect", "desc"), limit(10));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, userId: d.id, ...d.data() }));
    } catch (err) {
      console.error("Firestore leaderboard retrieval collapsed:", err);
      return [];
    }
  },

  // === SUPPORT SYSTEM LOGS / DIAGNOSTIC EVENTS ===
  async getLogs() {
    if (getActiveDB() === "supabase") {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("system-logs")
            .select("*")
            .order("timestamp", { ascending: false })
            .limit(30);
          if (!error && data) {
            return data.map(item => ({
              id: item.id,
              message: item.message,
              type: item.type || "system",
              timestamp: item.timestamp
            }));
          }
        } catch (e) {
          console.error("Supabase logs fetch error:", e);
        }
      }
    }

    // Firestore backup load
    try {
      const q = query(collection(db, "system-logs"), orderBy("timestamp", "desc"), limit(30));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        message: d.data().message,
        type: d.data().type || "system",
        timestamp: d.data().timestamp?.toDate?.() || new Date()
      }));
    } catch (err) {
      console.error("Firestore logs retrieval issue:", err);
      return [];
    }
  },

  // === HELP TICKETS ===
  async getTickets(uid: string) {
    if (getActiveDB() === "supabase") {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("tickets")
            .select("*")
            .eq("submitter_uid", uid)
            .order("created_at", { ascending: false });
          if (!error && data) {
            return data.map(item => ({
              id: item.ticket_id,
              submitterUid: item.submitter_uid,
              submitterName: item.submitter_name,
              title: item.title,
              description: item.description,
              status: item.status || "open",
              messages: typeof item.messages === "string" ? JSON.parse(item.messages) : (item.messages || []),
              createdAt: item.created_at
            }));
          }
        } catch (e) {
          console.error("Supabase load user tickets issue:", e);
        }
      }
    }

    // Firestore
    try {
      const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return list.filter((t: any) => t.submitterUid === uid);
    } catch (err) {
      console.error("Firestore tickets fetch collapsed:", err);
      return [];
    }
  },

  async getAllTicketsAdmin() {
    if (getActiveDB() === "supabase") {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("tickets")
            .select("*")
            .order("created_at", { ascending: false });
          if (!error && data) {
            return data.map(item => ({
              id: item.ticket_id,
              submitterUid: item.submitter_uid,
              submitterName: item.submitter_name,
              title: item.title,
              description: item.description,
              status: item.status || "open",
              messages: typeof item.messages === "string" ? JSON.parse(item.messages) : (item.messages || []),
              createdAt: item.created_at
            }));
          }
        } catch (e) {
          console.error("Supabase load admin tickets issue:", e);
        }
      }
    }

    // Firestore
    try {
      const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("Firestore load all admin tickets failed:", err);
      return [];
    }
  },

  async addTicket(uid: string, submitterName: string, title: string, description: string) {
    const ticketId = `ticket_${Date.now()}`;
    const initialMessages = [{
      sender: "system",
      text: "Thanks for submitting a ticket. The support staff has been alerted.",
      timestamp: new Date().toISOString()
    }];

    // 1. Firestore
    try {
      await setDoc(doc(db, "tickets", ticketId), {
        submitterUid: uid,
        submitterName,
        title,
        description,
        status: "open",
        messages: initialMessages,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Firestore add ticket issue:", e);
    }

    // 2. Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from("tickets").upsert({
          ticket_id: ticketId,
          submitter_uid: uid,
          submitter_name: submitterName,
          title,
          description,
          status: "open",
          messages: JSON.stringify(initialMessages),
          created_at: new Date()
        });
      } catch (e) {
        console.warn("Supabase ticket write error:", e);
      }
    }

    return ticketId;
  },

  async updateTicket(ticketId: string, updates: any) {
    // 1. Firestore
    try {
      await updateDoc(doc(db, "tickets", ticketId), updates);
    } catch (e) {
      console.error("Firestore update ticket issue:", e);
    }

    // 2. Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        const payload: any = {};
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.messages !== undefined) {
          payload.messages = JSON.stringify(updates.messages);
        }
        await supabase.from("tickets").update(payload).eq("ticket_id", ticketId);
      } catch (e) {
        console.warn("Supabase ticket updates skipped:", e);
      }
    }
  }
};
