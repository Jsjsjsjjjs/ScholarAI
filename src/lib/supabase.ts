import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

/**
 * Lazily initializes and returns the Supabase Client.
 * If credentials are not set in the environment variables, it fails gracefully with clear warnings 
 * rather than crashing the application startup sequence.
 */
export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  // Supports both Vite client prefix and Node/process.env depending on platform context
  const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    console.log("[Supabase] Connection client initialized successfully.");
    return supabaseInstance;
  } catch (err) {
    console.error("[Supabase] Failed to initialize client:", err);
    return null;
  }
}

/**
 * Relational model schemas to simplify mirroring or switching datastores.
 */
export interface SupabaseMirrorSync {
  /**
   * Automatically mirror write/merge operations to identical table structures in Supabase (if keys present).
   */
  mirrorUserUpdate(uid: string, data: any): Promise<void>;
  mirrorStatsUpdate(userId: string, data: any): Promise<void>;
  mirrorProgressUpdate(userId: string, topicId: string, data: any): Promise<void>;
  mirrorDoubtSave(userId: string, doubtId: string, question: string, answer: string): Promise<void>;
  mirrorReminderSave(userId: string, reminderId: string, data: any): Promise<void>;
  mirrorReminderDelete(userId: string, reminderId: string): Promise<void>;
}

export const dbMirror: SupabaseMirrorSync = {
  async mirrorUserUpdate(uid: string, data: any) {
    const supabase = getSupabase();
    if (!supabase) return;
    
    // Remap Firestore server timestamps or undefined properties to SQL-safe constructs
    const cleanData: any = {};
    const validFields = [
      'nickname', 'email', 'user_role', 'plan', 'ai_requests', 'total_tokens', 
      'quota_exhausted', 'color_mode', 'ttt_wins', 'ttt_losses', 'ttt_ties', 
      'ttt_elo', 'discord_username', 'discord_name', 'discord_avatar'
    ];

    for (const key in data) {
      if (data[key] !== undefined && data[key] !== null) {
        // Remap camelCase keys to snake_case for standard PostgreSQL syntax if they correlate
        let targetKey = key;
        if (key === 'role') targetKey = 'user_role';
        else if (key === 'aiRequests') targetKey = 'ai_requests';
        else if (key === 'totalTokens') targetKey = 'total_tokens';
        else if (key === 'quotaExhausted') targetKey = 'quota_exhausted';
        else if (key === 'colorMode') targetKey = 'color_mode';
        else if (key === 'tttWins') targetKey = 'ttt_wins';
        else if (key === 'tttLosses') targetKey = 'ttt_losses';
        else if (key === 'tttTies') targetKey = 'ttt_ties';
        else if (key === 'tttElo') targetKey = 'ttt_elo';
        else if (key === 'discordUsername') targetKey = 'discord_username';
        else if (key === 'discordName') targetKey = 'discord_name';
        else if (key === 'discordAvatar') targetKey = 'discord_avatar';

        if (validFields.includes(targetKey)) {
          cleanData[targetKey] = data[key];
        }
      }
    }

    try {
      const { error } = await supabase
        .from('users')
        .upsert({ uid, ...cleanData, joined_at: new Date() });
        
      if (error) console.warn("[Supabase Mirror Sync Warning - User]:", error.message);
    } catch (e) {
      console.error("[Supabase Error]:", e);
    }
  },

  async mirrorStatsUpdate(userId: string, data: any) {
    const supabase = getSupabase();
    if (!supabase) return;

    const cleanData: any = {};
    const validFields = ['nickname', 'quiz_correct', 'total_attempted', 'accuracy', 'time_spent'];

    for (const key in data) {
      if (data[key] !== undefined && data[key] !== null) {
        let targetKey = key;
        if (key === 'quizCorrect') targetKey = 'quiz_correct';
        else if (key === 'totalAttempted') targetKey = 'total_attempted';
        else if (key === 'timeSpent') targetKey = 'time_spent';

        if (validFields.includes(targetKey)) {
          cleanData[targetKey] = data[key];
        }
      }
    }

    try {
      const { error } = await supabase
        .from('stats')
        .upsert({ user_id: userId, ...cleanData, last_updated: new Date() });
        
      if (error) console.warn("[Supabase Mirror Sync Warning - Stats]:", error.message);
    } catch (e) {
      console.error("[Supabase Error]:", e);
    }
  },

  async mirrorProgressUpdate(userId: string, topicId: string, data: any) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('progress')
        .upsert({
          user_id: userId,
          topic_id: topicId,
          topic: data.topic,
          subject: data.subject,
          notes_read: data.notesRead ?? false,
          quiz_taken: data.quizTaken ?? false,
          pyqs_viewed: data.pyqsViewed ?? false,
          last_activity: new Date()
        }, { onConflict: 'user_id,topic_id' });

      if (error) console.warn("[Supabase Mirror Sync Warning - Progress]:", error.message);
    } catch (e) {
      console.error("[Supabase Error]:", e);
    }
  },

  async mirrorDoubtSave(userId: string, doubtId: string, question: string, answer: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('doubts')
        .upsert({
          doubt_id: doubtId,
          user_id: userId,
          question,
          answer,
          created_at: new Date()
        });

      if (error) console.warn("[Supabase Mirror Sync Warning - Doubt]:", error.message);
    } catch (e) {
      console.error("[Supabase Error]:", e);
    }
  },

  async mirrorReminderSave(userId: string, reminderId: string, data: any) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .upsert({
          reminder_id: reminderId,
          user_id: userId,
          subject: data.subject,
          topic: data.topic,
          reminder_date: data.reminderDate || data.date,
          reminder_time: data.reminderTime || data.time,
          status: data.status || 'pending',
          created_at: new Date()
        });

      if (error) console.warn("[Supabase Mirror Sync Warning - Reminder]:", error.message);
    } catch (e) {
      console.error("[Supabase Error]:", e);
    }
  },

  async mirrorReminderDelete(userId: string, reminderId: string) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('reminder_id', reminderId);

      if (error) console.warn("[Supabase Mirror Sync Warning - Reminder Delete]:", error.message);
    } catch (e) {
      console.error("[Supabase Error]:", e);
    }
  }
};
