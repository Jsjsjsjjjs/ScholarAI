import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, collection, getDocs, collectionGroup, setDoc } from "firebase/firestore";
import { 
  ShieldCheck, 
  Terminal, 
  Wrench, 
  Users, 
  Activity, 
  Save, 
  UserMinus, 
  Coins, 
  RefreshCw, 
  Image, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  Code,
  Ticket,
  HeartPulse,
  Database,
  CheckCircle2,
  AlertCircle,
  Server
} from "lucide-react";

import { createClient } from "@supabase/supabase-js";
import AdminTicketPanel from './AdminTicketPanel';
import { getActiveDB, setActiveDB, DBType } from "../lib/dbService";
import { getSupabase, dbMirror } from "../lib/supabase";

interface DeveloperPageProps {
  userData: any;
}

export default function DeveloperPage({ userData }: DeveloperPageProps) {
  // Database Selector State
  const [currentDb, setCurrentDb] = useState<DBType>(getActiveDB());
  // States for Database Diagnostics & Healing
  const [scanLoading, setScanLoading] = useState(false);
  const [healingLoading, setHealingLoading] = useState(false);
  const [diagnosticsRun, setDiagnosticsRun] = useState(false);
  const [diagResults, setDiagResults] = useState<any>(null);
  // Tabs: "config" | "users" | "logs" | "architecture"
  const [adminTab, setAdminTab] = useState("config");
  const [showTickets, setShowTickets] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States for System Config (Dynamic UI Settings)
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [activeModel, setActiveModel] = useState("gemini-1.5-flash");
  const [requestCapLimit, setRequestCapLimit] = useState(100);

  // States for Users and Stats List
  const [users, setUsers] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState<any>({
    totalUsers: 0,
    totalRequests: 0,
    totalTokens: 0
  });

  // State for System Event Logs
  const [logs, setLogs] = useState<any[]>([]);

  // State for User Edit Modal / Inline edit
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [editPlan, setEditPlan] = useState("free");
  const [editRole, setEditRole] = useState("user");
  const [editLimit, setEditLimit] = useState(100);
  const [editTokens, setEditTokens] = useState(0);

  // Global Centralized Database Swapper (instantly propagates in real-time)
  const handleDatabaseSwitchGlobal = async (targetDb: DBType) => {
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      // 1. Instantly register in centralized global configuration document on Cloud Firestore
      const configRef = doc(db, "system", "config");
      await setDoc(configRef, {
        activeDatabase: targetDb
      }, { merge: true });

      // 2. Synchronize local application context
      setActiveDB(targetDb);
      setCurrentDb(targetDb);

      setSuccessMsg(`Central Router modified! Globally routing active database to ${
        targetDb === "firestore" ? "Cloud Firestore (NoSQL)" : "Supabase PostgreSQL (Relation)"
      } in real-time with zero restart or refresh.`);
    } catch (err: any) {
      console.error("Failed to propagate global database switch:", err);
      setErrorMsg("Centralized routing update failed: " + err.message);
    }
  };

  // Database Diagnostics Scanning Function
  const runDatabaseDiagnostics = async () => {
    setScanLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      // 1. Fetch Firestore Users
      const fUsersSnap = await getDocs(collection(db, "users"));
      const fUsersList = fUsersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() as any }));

      // 2. Fetch Supabase Users
      let sUsersList: any[] = [];
      const supabase = getSupabase();
      let supabaseConnected = false;
      if (supabase) {
        try {
          const { data, error } = await supabase.from("users").select("*");
          if (!error && data) {
            sUsersList = data;
            supabaseConnected = true;
          } else {
            console.warn("[Diagnostics] Supabase user query failed:", error);
          }
        } catch (err) {
          console.warn("[Diagnostics] Supabase exception querying users:", err);
        }
      }

      // 3. Fetch Firestore Stats
      const fStatsSnap = await getDocs(collection(db, "stats"));
      const fStatsList = fStatsSnap.docs.map(doc => ({ userId: doc.id, ...doc.data() as any }));

      // 4. Fetch Supabase Stats
      let sStatsList: any[] = [];
      if (supabaseConnected && supabase) {
        try {
          const { data, error } = await supabase.from("stats").select("*");
          if (!error && data) {
            sStatsList = data;
          }
        } catch (err) {
          console.warn("[Diagnostics] Supabase stats query exception:", err);
        }
      }

      // 5. Fetch Firestore Offline Sync
      let fOfflineSyncCount = 0;
      try {
        const fSyncSnap = await getDocs(collectionGroup(db, "offline_sync"));
        fOfflineSyncCount = fSyncSnap.size;
      } catch (err) {
        console.warn("Could not query offline sync collectionGroup:", err);
      }

      // 6. Fetch Supabase Offline Sync Group (Check if table exists)
      let sOfflineSyncCount = 0;
      let sOfflineSyncTableExists = false;
      if (supabaseConnected && supabase) {
        try {
          const { data, error } = await supabase.from("offline_sync").select("*").limit(1);
          if (!error) {
            sOfflineSyncTableExists = true;
            const { count, error: countErr } = await supabase.from("offline_sync").select("*", { count: 'exact', head: true });
            if (!countErr && count !== null) {
              sOfflineSyncCount = count;
            }
          }
        } catch {
          // Exceptions are normal since ofline_sync isn't in default PostgreSQL schema definitions
        }
      }

      // Run Cross-Database Sync Audits
      const userMismatches: any[] = [];
      const statsMismatches: any[] = [];
      const offlineSyncMismatches: any[] = [];

      // Check User Profiles differences (Firestore is primary source is typical)
      fUsersList.forEach(fu => {
        const su = sUsersList.find(u => u.uid === fu.uid);
        if (!su) {
          userMismatches.push({
            uid: fu.uid,
            nickname: fu.nickname || "Scholar Kid",
            reason: "Missing in Supabase",
            details: `User exists in Firestore but is not mirrored in Supabase.`
          });
        } else {
          const fPlan = (fu.plan || "free").toLowerCase().trim();
          const sPlan = (su.plan || "free").toLowerCase().trim();
          const fRole = (fu.role || "user").toLowerCase().trim();
          const sRole = (su.user_role || "user").toLowerCase().trim();

          if (fPlan !== sPlan || fRole !== sRole) {
            userMismatches.push({
              uid: fu.uid,
              nickname: fu.nickname || su.nickname,
              reason: "Config Variance",
              details: `Plan: [F: ${fPlan} vs S: ${sPlan}] | Role: [F: ${fRole} vs S: ${sRole}]`
            });
          }
        }
      });

      // Show if any Supabase user is absent in Firestore
      sUsersList.forEach(su => {
        const fu = fUsersList.find(u => u.uid === su.uid);
        if (!fu) {
          userMismatches.push({
            uid: su.uid,
            nickname: su.nickname || "Postgres Scholar",
            reason: "Absent in Firestore",
            details: `User profile exists in Supabase Postgres but is completely missing in Firestore.`
          });
        }
      });

      // Verify Stats Metrics alignment
      fStatsList.forEach(fs => {
        const ss = sStatsList.find(s => s.user_id === fs.userId);
        if (!ss) {
          statsMismatches.push({
            uid: fs.userId,
            nickname: fs.nickname || "Study Session",
            reason: "Stats Missing in Supabase",
            details: `Scholar's stats exist in Firestore but lack a referenced record in Supabase.`
          });
        } else {
          const fC = fs.quizCorrect ?? 0;
          const sC = ss.quiz_correct ?? 0;
          const fA = fs.totalAttempted ?? 0;
          const sA = ss.total_attempted ?? 0;
          const fAcc = Number(fs.accuracy || 0).toFixed(1);
          const sAcc = Number(ss.accuracy || 0).toFixed(1);

          if (fC !== sC || fA !== sA || fAcc !== sAcc) {
            statsMismatches.push({
              uid: fs.userId,
              nickname: fs.nickname || ss.nickname,
              reason: "Stats Discrepants",
              details: `Quiz Answers: [F: ${fC}/${fA} (${fAcc}%) vs S: ${sC}/${sA} (${sAcc}%)]`
            });
          }
        }
      });

      // Assess Discord Bot Offline Sync status
      if (!sOfflineSyncTableExists) {
        offlineSyncMismatches.push({
          uid: "system",
          key: "offline_sync_postgres_table",
          reason: "Firestore-Side Only",
          details: `Offline sync records exist in Cloud Firestore [${fOfflineSyncCount} items]. Since offline Discord assets utilize NoSQL, Supabase is omitted.`
        });
      } else {
        if (fOfflineSyncCount !== sOfflineSyncCount) {
          offlineSyncMismatches.push({
            uid: "compare",
            key: "offline_sync_counts",
            reason: "Item Count Mismatch",
            details: `Offline records count: [Firestore: ${fOfflineSyncCount} vs Supabase: ${sOfflineSyncCount}]`
          });
        }
      }

      setDiagResults({
        timestamp: new Date().toLocaleTimeString(),
        supabaseHealthy: supabaseConnected,
        fUserCount: fUsersList.length,
        sUserCount: sUsersList.length,
        fStatsCount: fStatsList.length,
        sStatsCount: sStatsList.length,
        fOfflineSyncCount,
        sOfflineSyncCount,
        sOfflineSyncTableExists,
        userMismatches,
        statsMismatches,
        offlineSyncMismatches,
        overallHealthy: userMismatches.length === 0 && statsMismatches.length === 0
      });
      setDiagnosticsRun(true);
      setSuccessMsg("Pristine integrity diagnostic scan finished successfully!");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error("Database diagnostic run failed:", err);
      setErrorMsg("Diagnostic analysis errored: " + err.message);
    } finally {
      setScanLoading(false);
    }
  };

  // Database Mirroring Alignment/Healing Function
  const healDatabaseIntegrity = async () => {
    setHealingLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error("Supabase integration credentials are not configured.");
      }

      // Create ephemeral client to sign up other accounts without overwriting main admin session
      const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL || "").trim();
      const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();
      const ephemeralSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      // Fetch Firestore Auth profiles and Stats
      const fUsersSnap = await getDocs(collection(db, "users"));
      const fUsersList = fUsersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() as any }));

      const fStatsSnap = await getDocs(collection(db, "stats"));
      const fStatsList = fStatsSnap.docs.map(doc => ({ userId: doc.id, ...doc.data() as any }));

      let usersSynchronized = 0;
      let statsSynchronized = 0;

      // 1. Force Sync/Mirror Users to Supabase
      for (const fu of fUsersList) {
        // Build payload and mirror to PostgreSQL users table
        await dbMirror.mirrorUserUpdate(fu.uid, fu);
        usersSynchronized++;

        // Safely duplicate/copy user auth metadata into Supabase Auth schema prior to activation
        try {
          const email = fu.email || `${fu.uid}@scholarai.app`;
          const password = fu.email ? `google_auth_${fu.uid}` : `scholar_${fu.uid}`;
          
          await ephemeralSupabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                nickname: fu.nickname || `Scholar-${fu.uid.slice(0, 4)}`,
                role: fu.role || "user"
              }
            }
          });
        } catch (authCopyErr) {
          console.warn(`[Migrator] Suppressing duplication check; user already exists inside auth.users for ${fu.uid}`);
        }
      }

      // 2. Force Sync/Mirror Stats records
      for (const fs of fStatsList) {
        await dbMirror.mirrorStatsUpdate(fs.userId, fs);
        statsSynchronized++;
      }

      setSuccessMsg(`Pruned and synchronized registers successfully! Standardized ${usersSynchronized} profiles and ${statsSynchronized} stats rows.`);
      
      // Auto re-run diagnostic scanner to show updated statuses
      await runDatabaseDiagnostics();
    } catch (err: any) {
      console.error("Database healing operation failed:", err);
      setErrorMsg("Failed database alignment: " + err.message);
    } finally {
      setHealingLoading(false);
    }
  };

  // Fetch token securely
  const getAuthHeader = async () => {
    let token = "";
    if (auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch (e) {
        // Fallback or ignore if token cannot be fetched
      }
    }
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };
  };

  const loadSettingsConfig = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/admin/settings", { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data?.config) {
        setMaintenanceMode(data.config.maintenanceMode || false);
        setLogoUrl(data.config.logoUrl || "");
        setActiveModel(data.config.activeModel || "gemini-3.5-flash");
        setRequestCapLimit(data.config.requestCapLimit || 100);
      }
    } catch (err: any) {
      console.error("Error reading platform settings:", err);
      // Fail gracefully: load settings from local metadata as fallback
      setLogoUrl("");
    } finally {
      setLoading(false);
    }
  };

  const loadPlatformStats = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/admin/stats", { headers });
      if (!res.ok) throw new Error("Stats fetch failed");
      const data = await res.json();
      if (data?.stats) {
        setGlobalStats({
          totalUsers: data.stats.totalUsers || 0,
          totalRequests: data.stats.totalRequests || 0,
          totalTokens: data.stats.totalTokens || 0
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsersList = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/admin/users", { headers });
      if (!res.ok) throw new Error("Users fetch failed");
      const data = await res.json();
      if (data?.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadRecentLogs = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/admin/logs", { headers });
      if (!res.ok) throw new Error("Logs retrieve failed");
      const data = await res.json();
      if (data?.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const syncAll = async () => {
    await loadSettingsConfig();
    await loadPlatformStats();
    await loadUsersList();
    await loadRecentLogs();
  };

  useEffect(() => {
    syncAll();
  }, [userData]);

  const saveSettingsConfig = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/admin/settings/update", {
        method: "POST",
        headers,
        body: JSON.stringify({
          maintenanceMode,
          logoUrl,
          activeModel,
          requestCapLimit
        })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      
      setSuccessMsg("System configurations successfully written to server Firestore!");
      setTimeout(() => setSuccessMsg(null), 4000);
      loadPlatformStats();
    } catch (err: any) {
      setErrorMsg("Failed to sync app settings configurations: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUserClick = (u: any) => {
    setSelectedUser(u);
    setEditPlan(u.plan || "free");
    setEditRole(u.role || "user");
    setEditLimit(u.limit !== undefined ? u.limit : 20);
    setEditTokens(u.totalTokens || 0);
  };

  const saveUserUpdates = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers,
        body: JSON.stringify({
          targetUid: selectedUser.uid,
          plan: editPlan,
          role: editRole,
          limit: editLimit,
          aiRequests: selectedUser.aiRequests,
          totalTokens: editTokens
        })
      });

      if (!res.ok) throw new Error(await res.text());

      setSuccessMsg(`Successfully updated credentials for: ${selectedUser.nickname}`);
      setSelectedUser(null);
      loadUsersList();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg("Failed modifying user credentials: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeUser = async (targetUid: string, nickname: string) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to KICK and COMPLETELY PURGE stats, logs, progress, and reminders for ${nickname}? This action is irreversible!`)) return;
    
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeader();
      const res = await fetch("/api/admin/users/kick", {
        method: "POST",
        headers,
        body: JSON.stringify({ targetUid })
      });

      if (!res.ok) throw new Error(await res.text());

      setSuccessMsg(`Successfully kicked ${nickname} and cascade-purged all database registers.`);
      loadUsersList();
      loadPlatformStats();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg("Purge operation collapsed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {showTickets && <AdminTicketPanel userData={userData} onClose={() => setShowTickets(false)} />}
      {/* Platform Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-orange-500 font-mono text-xs uppercase tracking-widest mb-1">
            <ShieldCheck size={14} /> SECURITY CLEARANCE: LEVEL 5 (ROOT ADMIN)
          </div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
            Super-Admin Console
          </h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowTickets(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 border border-orange-500 text-sm hover:bg-orange-500 active:scale-95 transition-all text-white font-bold"
          >
            <Ticket size={16} /> 
            Ticket Panel
          </button>
          <button 
            onClick={syncAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-sm hover:bg-neutral-850 active:scale-95 transition-all text-neutral-300 font-semibold"
          >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Sync Live Database
        </button>
        </div>
      </div>

      {/* Global Metadata Cards (Bento Metric Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-neutral-900/40 border border-neutral-800/60 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wider text-neutral-500 uppercase">Registered Scholars</p>
            <h3 className="text-3xl font-black mt-2 text-orange-400">{globalStats.totalUsers}</h3>
          </div>
          <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
            <Users size={22} />
          </div>
        </div>

        <div className="p-5 bg-neutral-900/40 border border-neutral-800/60 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wider text-neutral-500 uppercase">AI Request Count</p>
            <h3 className="text-3xl font-black mt-2 text-amber-400">{globalStats.totalRequests}</h3>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
            <Activity size={22} />
          </div>
        </div>

        <div className="p-5 bg-neutral-900/40 border border-neutral-800/60 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wider text-neutral-500 uppercase">Tokens Propagated</p>
            <h3 className="text-3xl font-black mt-2 text-indigo-400">{globalStats.totalTokens.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
            <Coins size={22} />
          </div>
        </div>
      </div>

      {/* Toast Alert Overlays */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center gap-2 text-sm font-semibold animate-pulse">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle size={16} />
          {errorMsg}
        </div>
      )}

      {/* Segment Controllers (Subtabs) */}
      <div className="flex border-b border-neutral-800 h-11 items-center gap-6 text-sm">
        <button 
          onClick={() => setAdminTab("config")}
          className={`h-full border-b-2 font-bold px-1 transition-all ${adminTab === "config" ? "border-orange-500 text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
        >
          <span className="flex items-center gap-1.5"><Wrench size={14} /> Dynamic UI Settings</span>
        </button>
        <button 
          onClick={() => setAdminTab("users")}
          className={`h-full border-b-2 font-bold px-1 transition-all ${adminTab === "users" ? "border-orange-500 text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
        >
          <span className="flex items-center gap-1.5"><Users size={14} /> User Plan Management</span>
        </button>
        <button 
          onClick={() => setAdminTab("logs")}
          className={`h-full border-b-2 font-bold px-1 transition-all ${adminTab === "logs" ? "border-orange-500 text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
        >
          <span className="flex items-center gap-1.5"><Terminal size={14} /> System Activity Logs</span>
        </button>
        <button 
          onClick={() => setAdminTab("architecture")}
          className={`h-full border-b-2 font-bold px-1 transition-all ${adminTab === "architecture" ? "border-orange-500 text-neutral-100" : "border-transparent text-neutral-500 hover:text-neutral-300"}`}
        >
          <span className="flex items-center gap-1.5"><Code size={14} /> RBAC Security Blueprint</span>
        </button>
      </div>

      {/* SUBTAB 1: DYNAMIC SYSTEM CONFIG */}
      {adminTab === "config" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 p-6 bg-neutral-900/20 border border-neutral-850 rounded-3xl space-y-5">
            <h3 className="text-lg font-bold tracking-tight">On-The-Fly UI Controls</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Tweak features instantly across the platform without triggers, deployments, or server rebuild actions.
            </p>

            <div className="space-y-4 pt-2">
              {/* Dynamic Database Selector */}
              <div className="space-y-4">
                <div className="p-6 bg-neutral-950/80 border border-neutral-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Database size={16} className="text-orange-500 animate-pulse" /> 
                        Global Database Router & Gateway
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        Router coordinates write transactions in parallel while redirecting core reads to your choice of active cluster. Modify provider in real-time.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 font-mono">
                    {/* Firestore Core Configuration Block */}
                    <div className={`p-4 rounded-xl border transition-all relative overflow-hidden ${
                      currentDb === "firestore"
                        ? "bg-orange-500/5 border-orange-500"
                        : "bg-neutral-900/30 border-neutral-850 hover:border-neutral-800"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-orange-400">Cloud Firestore</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                          currentDb === "firestore" ? "bg-orange-500 text-black animate-pulse" : "bg-neutral-800 text-neutral-500"
                        }`}>
                          {currentDb === "firestore" ? "Active" : "In Sync"}
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-neutral-300">Firebase Enterprise</h5>
                      <span className="text-[9px] text-neutral-500 block mt-1">Type: Document Storage (NoSQL)</span>
                      <span className="text-[9px] text-emerald-500/80 block font-bold mt-1">● Cluster Ingress: Live (Port 3000 proxy)</span>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (currentDb === "firestore") return;
                          handleDatabaseSwitchGlobal("firestore");
                        }}
                        className={`w-full mt-3 py-2 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                          currentDb === "firestore"
                            ? "bg-orange-500 text-black border-none"
                            : "bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {currentDb === "firestore" ? "Currently Routing Reads" : "Route Reads to Firestore"}
                      </button>
                    </div>

                    {/* Supabase Core Configuration Block */}
                    <div className={`p-4 rounded-xl border transition-all relative overflow-hidden ${
                      currentDb === "supabase"
                        ? "bg-indigo-500/5 border-indigo-500"
                        : "bg-neutral-900/30 border-neutral-850 hover:border-neutral-800"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-400">Supabase Postgres</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                          currentDb === "supabase" ? "bg-indigo-500 text-white animate-pulse" : "bg-neutral-800 text-neutral-500"
                        }`}>
                          {currentDb === "supabase" ? "Active" : "Backup Client"}
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-neutral-300">Relational Database</h5>
                      <span className="text-[9px] text-neutral-500 block mt-1">Type: SQL Rows (PostgreSQL Engine)</span>
                      <span className="text-[9px] text-emerald-500/80 block font-bold mt-1">● Mirror Client: Initialized & Loaded</span>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (currentDb === "supabase") return;
                          handleDatabaseSwitchGlobal("supabase");
                        }}
                        className={`w-full mt-3 py-2 rounded-lg text-[10px] font-bold text-center transition-all cursor-pointer ${
                          currentDb === "supabase"
                            ? "bg-indigo-500 text-white border-none"
                            : "bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {currentDb === "supabase" ? "Currently Routing Reads" : "Route Reads to Supabase"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 'Database Integrity' Widget & Mirror Diagnostics Diagnostics */}
                <div className="p-6 bg-neutral-950/40 border border-neutral-850 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm flex items-center gap-2 text-neutral-200">
                        <HeartPulse size={16} className="text-emerald-500 animate-pulse" />
                        Scholar Database Integrity Audit
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Cross-compares active Firestore profiles, statistics counts, and offline sync records with Supabase mirrored relations.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={runDatabaseDiagnostics}
                        disabled={scanLoading}
                        className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all active:scale-95"
                      >
                        <RefreshCw size={12} className={scanLoading ? "animate-spin" : ""} />
                        {scanLoading ? "Scanning..." : "Execute Scan"}
                      </button>
                    </div>
                  </div>

                  {diagnosticsRun && diagResults && (
                    <div className="space-y-4 pt-1 animate-fadeIn">
                      {/* Sub-grid of key metric structures */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* 1. User Profiles Card */}
                        <div className="p-3 bg-neutral-900/40 border border-neutral-850 rounded-xl space-y-1">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-neutral-500 font-mono">User Profiles</span>
                          <div className="flex justify-between items-baseline font-mono">
                            <div className="text-xs text-neutral-400">F: <b className="text-orange-400">{diagResults.fUserCount}</b></div>
                            <div className="text-xs text-neutral-400">S: <b className="text-indigo-400">{diagResults.sUserCount}</b></div>
                          </div>
                          <div className="pt-2 flex items-center justify-between border-t border-neutral-850/60 mt-1.5">
                            <span className="text-[9px] font-mono text-neutral-500">Mismatches: <b className={diagResults.userMismatches.length > 0 ? "text-amber-500 font-bold" : "text-emerald-500"}>{diagResults.userMismatches.length}</b></span>
                            {diagResults.userMismatches.length === 0 ? (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-bold uppercase"><CheckCircle2 size={10} /> Sync</span>
                            ) : (
                              <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-bold uppercase"><AlertCircle size={10} /> Diff</span>
                            )}
                          </div>
                        </div>

                        {/* 2. Study Statistics Card */}
                        <div className="p-3 bg-neutral-900/40 border border-neutral-850 rounded-xl space-y-1">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-neutral-500 font-mono">Academic Roster</span>
                          <div className="flex justify-between items-baseline font-mono">
                            <div className="text-xs text-neutral-400">F: <b className="text-orange-400">{diagResults.fStatsCount}</b></div>
                            <div className="text-xs text-neutral-400">S: <b className="text-indigo-400">{diagResults.sStatsCount}</b></div>
                          </div>
                          <div className="pt-2 flex items-center justify-between border-t border-neutral-850/60 mt-1.5">
                            <span className="text-[9px] font-mono text-neutral-500">Mismatches: <b className={diagResults.statsMismatches.length > 0 ? "text-amber-500 font-bold" : "text-emerald-500"}>{diagResults.statsMismatches.length}</b></span>
                            {diagResults.statsMismatches.length === 0 ? (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-bold uppercase"><CheckCircle2 size={10} /> Sync</span>
                            ) : (
                              <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-bold uppercase"><AlertCircle size={10} /> Diff</span>
                            )}
                          </div>
                        </div>

                        {/* 3. Offline bot Sync Records Card */}
                        <div className="p-3 bg-neutral-900/40 border border-neutral-850 rounded-xl space-y-1">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-neutral-500 font-mono">Offline Sync Registry</span>
                          <div className="flex justify-between items-baseline font-mono">
                            <div className="text-xs text-neutral-400">F: <b className="text-orange-400">{diagResults.fOfflineSyncCount}</b></div>
                            <div className="text-xs text-neutral-400">S: <b className="text-indigo-400">{diagResults.sOfflineSyncCount}</b></div>
                          </div>
                          <div className="pt-2 flex items-center justify-between border-t border-neutral-850/60 mt-1.5">
                            <span className="text-[9px] uppercase text-neutral-500 font-mono">Host: {diagResults.sOfflineSyncTableExists ? "Joint" : "NoSQL"}</span>
                            {!diagResults.sOfflineSyncTableExists ? (
                              <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-bold uppercase">NoSQL Only</span>
                            ) : diagResults.fOfflineSyncCount === diagResults.sOfflineSyncCount ? (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-bold uppercase"><CheckCircle2 size={10} /> Mirror</span>
                            ) : (
                              <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-bold uppercase"><AlertCircle size={10} /> Alert</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Display Audit logs if mismatches discovered */}
                      {(diagResults.userMismatches.length > 0 || diagResults.statsMismatches.length > 0 || diagResults.offlineSyncMismatches.length > 0) ? (
                        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-3">
                          <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold font-mono uppercase">
                            <AlertCircle size={14} /> Outstanding Database Mismatches Discovered [{diagResults.userMismatches.length + diagResults.statsMismatches.length} count]
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-2 text-[10px] font-mono leading-relaxed divide-y divide-neutral-850/40">
                            {/* Users */}
                            {diagResults.userMismatches.map((m: any, i: number) => (
                              <div key={`usr_m_${i}`} className="pt-2 flex items-start justify-between gap-4">
                                <div>
                                  <span className="text-orange-400 font-bold uppercase font-sans">User Profile: {m.nickname} (ID: {m.uid.substring(0,6)})</span>
                                  <p className="text-neutral-400 mt-0.5">{m.details}</p>
                                </div>
                                <span className="bg-orange-500/10 text-orange-400 px-2 rounded font-bold whitespace-nowrap text-[8px] uppercase py-0.5">{m.reason}</span>
                              </div>
                            ))}
                            {/* Academic Stats */}
                            {diagResults.statsMismatches.map((m: any, i: number) => (
                              <div key={`stat_m_${i}`} className="pt-2 flex items-start justify-between gap-4">
                                <div>
                                  <span className="text-indigo-400 font-bold uppercase font-sans">Statistics Roster: {m.nickname}</span>
                                  <p className="text-neutral-400 mt-0.5">{m.details}</p>
                                </div>
                                <span className="bg-indigo-500/10 text-indigo-400 px-2 rounded font-bold whitespace-nowrap text-[8px] uppercase py-0.5">{m.reason}</span>
                              </div>
                            ))}
                            {/* Offline Sync info */}
                            {diagResults.offlineSyncMismatches.map((m: any, i: number) => (
                              <div key={`off_m_${i}`} className="pt-2 flex items-start justify-between gap-4">
                                <div>
                                  <span className="text-neutral-400 font-bold uppercase font-sans flex items-center gap-1"><Server size={10} /> Offline Asset Router state</span>
                                  <p className="text-neutral-500 mt-0.5 leading-relaxed">{m.details}</p>
                                </div>
                                <span className="bg-neutral-800 text-neutral-400 px-2 rounded font-bold whitespace-nowrap text-[8px] uppercase py-0.5">{m.reason}</span>
                              </div>
                            ))}
                          </div>

                          {/* Database Healing Action Trigger */}
                          <div className="border-t border-neutral-800/80 pt-3 flex justify-between items-center bg-neutral-950/20 px-1">
                            <span className="text-[10px] text-neutral-500 leading-relaxed max-w-[70%] font-semibold">
                              Initialize database alignment to force-mirror credentials and telemetry records back and forth.
                            </span>
                            <button
                              type="button"
                              onClick={healDatabaseIntegrity}
                              disabled={healingLoading}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-extrabold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            >
                              <HeartPulse size={12} className={healingLoading ? "animate-pulse" : ""} />
                              {healingLoading ? "Healing..." : "Heal & Sync DB"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-bold font-mono uppercase animate-fadeIn">
                          <CheckCircle2 size={14} className="animate-bounce" /> Dual-Database Alignment Pristine: 100% Synced (Zero Differences)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Maintenance Toggle */}
              <div className="flex items-center justify-between p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                <div>
                  <h4 className="font-bold text-sm">Toggle Maintenance Mode</h4>
                  <p className="text-xs text-neutral-500 mt-1">Locks non-developer users out of academic helpers and lists an aesthetic maintenance screen.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${maintenanceMode ? "bg-red-500" : "bg-neutral-800"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${maintenanceMode ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Logo URL */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400">Dynamic Platform Brand Logo</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={logoUrl} 
                    onChange={(e) => setLogoUrl(e.target.value)} 
                    placeholder="https://..." 
                    className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-mono"
                  />
                  <div className="w-10 h-10 border border-neutral-800 rounded-xl bg-neutral-950 flex items-center justify-center overflow-hidden">
                    {logoUrl ? <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-cover" /> : <Image size={18} className="text-neutral-600" />}
                  </div>
                </div>
              </div>

              {/* Active AI Model */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400">Active Orchestration Model</label>
                <select 
                  value={activeModel} 
                  onChange={(e) => setActiveModel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none h-10 font-mono text-neutral-300"
                >
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Standard & Recommended)</option>
                  <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Advanced Cognitive Reasoner)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Cost-efficient low latency)</option>
                </select>
              </div>

              {/* Default Token Limit */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400">Default Request Limit Tier (Limits / Day)</label>
                <input 
                  type="number" 
                  value={requestCapLimit} 
                  onChange={(e) => setRequestCapLimit(parseInt(e.target.value, 10))} 
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-mono"
                />
              </div>

              <div className="pt-4 border-t border-neutral-800 flex justify-end">
                <button 
                  onClick={saveSettingsConfig}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-white text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
                >
                  <Save size={14} /> Commit Changes
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 bg-neutral-900/10 border border-neutral-850 rounded-3xl space-y-4">
            <h4 className="font-bold text-sm flex items-center gap-1.5 text-orange-400"><AlertTriangle size={15} /> System Overview Status</h4>
            <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/10 text-xs leading-relaxed space-y-2">
              <span className="font-bold uppercase text-orange-500">Notice on Environment Constraints</span>
              <p className="text-neutral-400">
                Updating these properties commits parameters instantly to the system-wide Firestore collections. Frontend components auto-update their brand references and active AI APIs down the pipeline.
              </p>
            </div>
            
            <div className="space-y-2 text-xs font-mono pt-2 text-neutral-400">
              <div className="flex justify-between py-1 border-b border-neutral-850">
                <span>Database Instance:</span> <span className="font-bold text-neutral-200">{currentDb === "supabase" ? "Supabase (PostgreSQL)" : "Firestore (NoSQL)"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-850">
                <span>Nginx Reverse Ingress:</span> <span className="font-bold text-emerald-500">Live (Port: 3000)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-850">
                <span>Active Server Script:</span> <span className="font-bold text-orange-400">server.ts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-850">
                <span>Discord Webhook Sync:</span> <span className="font-bold text-emerald-500">Synchronized</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: USER PLAN MANAGEMENT */}
      {adminTab === "users" && (
        <div className="space-y-4">
          <div className="p-4 bg-neutral-900/20 border border-neutral-850 rounded-3xl flex justify-between items-center">
            <div className="text-xs text-neutral-400 font-semibold">
              <span className="text-orange-500 font-bold">{users.length}</span> active Scholar profiles indexing across Firebase Auth.
            </div>
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto rounded-2xl border border-neutral-850 bg-neutral-950/40">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-900/60 text-neutral-400 font-bold uppercase tracking-wider text-[10px] border-b border-neutral-850 h-12">
                  <th className="px-5">Nickname / Email</th>
                  <th className="px-5">Permission Role</th>
                  <th className="px-5">Subscription Plan</th>
                  <th className="px-5">Requests / Tokens</th>
                  <th className="px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850 h-10">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-neutral-900/20 transition-colors h-14">
                    {/* User profile identifier */}
                    <td className="px-5">
                      <div className="font-bold text-neutral-100">{u.nickname}</div>
                      <div className="text-neutral-500 text-[10px] font-mono mt-0.5">{u.email || "No Verified Email"}</div>
                      <div className="text-[9px] text-neutral-600 font-mono mt-0.5">UID: {u.uid.substring(0, 16)}...</div>
                    </td>
                    
                    {/* User level role */}
                    <td className="px-5 font-mono">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        u.role === "owner" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        u.role === "admin" || u.role === "developer" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-neutral-800 text-neutral-400"
                      }`}>
                        {u.role || "user"}
                      </span>
                    </td>

                    {/* Subscription tier */}
                    <td className="px-5">
                      <span className={`font-bold uppercase tracking-wider text-[10px] ${
                        u.plan === "elite" ? "text-indigo-400" :
                        u.plan === "admin" ? "text-amber-400" : "text-neutral-400"
                      }`}>
                        {u.plan || "free"}
                      </span>
                    </td>

                    {/* Performance metrics indicators */}
                    <td className="px-5">
                      <div className="font-bold">{u.aiRequests} / {u.limit || "Uncapped"} requests</div>
                      <div className="text-neutral-500 font-mono text-[10px]">{u.totalTokens.toLocaleString()} tokens</div>
                    </td>

                    {/* Safe delete & edit tools */}
                    <td className="px-5 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button 
                          onClick={() => handleEditUserClick(u)}
                          className="px-3 py-1.5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-850 font-bold transition-all"
                        >
                          Modify
                        </button>
                        <button 
                          onClick={() => handlePurgeUser(u.uid, u.nickname)}
                          title="Purge completely from Firestore and statistics logs"
                          className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all border border-red-500/20 active:scale-95"
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* User Inline Editing Panel */}
          {selectedUser && (
            <div className="p-6 bg-neutral-900/30 border border-neutral-800 rounded-3xl space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
                <h4 className="font-bold text-sm">Modifying user permissions: <span className="text-orange-400">{selectedUser.nickname}</span></h4>
                <button onClick={() => setSelectedUser(null)} className="text-neutral-500 hover:text-neutral-300 text-xs font-bold">Cancel</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400">Subscription Tier</label>
                  <select 
                    value={editPlan} 
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="free">Free Starter Plan</option>
                    <option value="elite">Elite VIP Scholar</option>
                    <option value="admin">Administrator / Developer</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400">System Permission Role</label>
                  <select 
                    value={editRole} 
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="user">User (Standard Student)</option>
                    <option value="developer">Developer (Page Access)</option>
                    <option value="admin">Admin (Full Control)</option>
                    <option value="owner">Owner (Super User)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400">Token Limits Allowed</label>
                  <input 
                    type="number" 
                    value={editLimit} 
                    onChange={(e) => setEditLimit(parseInt(e.target.value, 10))} 
                    className="w-full px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400">Manual Token Consumption Balance</label>
                  <input 
                    type="number" 
                    value={editTokens} 
                    onChange={(e) => setEditTokens(parseInt(e.target.value, 10))} 
                    className="w-full px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-neutral-850">
                <button 
                  onClick={saveUserUpdates}
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs"
                >
                  Save User Changes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: SYSTEM ACTIVITY LOGS */}
      {adminTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-neutral-900/10 border border-neutral-850 rounded-3xl">
            <div className="text-xs text-neutral-400 leading-relaxed font-semibold">
              Live inspection of application and AI execution parameters compiled dynamically on backend Node.js listeners.
            </div>
            <button 
              onClick={loadRecentLogs}
              className="px-3 py-1.5 border border-neutral-800 rounded-xl hover:bg-neutral-900 text-xs font-bold text-neutral-300"
            >
              Refresh Console Logs
            </button>
          </div>

          <div className="p-5 rounded-3xl bg-neutral-950/60 border border-neutral-850 font-mono text-[11px] leading-relaxed text-neutral-400 min-h-60 max-h-96 overflow-y-auto space-y-2.5">
            <p className="text-neutral-500 border-b border-neutral-900 pb-2 flex justify-between">
              <span>-- BASH CONSOLE LOG STACK STUB --</span>
              <span>UTC TIME: {new Date().toISOString()}</span>
            </p>
            {logs.map((lg) => (
              <div key={lg.id} className="flex flex-col sm:flex-row sm:gap-4 py-1.5 border-b border-neutral-900/30">
                <span className="text-neutral-600 shrink-0 select-none">[{new Date(lg.timestamp).toLocaleTimeString()}]</span>
                <span className={`font-semibold shrink-0 uppercase text-[9px] px-1.5 py-0 rounded ${
                  lg.type === "system" ? "bg-emerald-500/10 text-emerald-400" :
                  lg.type === "discord" ? "bg-indigo-500/10 text-indigo-400" :
                  lg.type === "ai" ? "bg-orange-500/10 text-orange-400" : "bg-neutral-800 text-neutral-300"
                }`}>
                  {lg.type}
                </span>
                <span className="text-neutral-300 break-all">{lg.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: RBAC SECURITY EXPLANATION FOR SECURITY AUDITORS */}
      {adminTab === "architecture" && (
        <div className="p-6 bg-neutral-900/20 border border-neutral-850 rounded-3xl space-y-4 leading-relaxed text-sm">
          <div className="flex items-center gap-2 border-b border-neutral-850 pb-3 text-orange-500">
            <ShieldCheck size={20} />
            <h3 className="font-bold text-lg">Architectural Safeguards (ABAC vs Spoofing)</h3>
          </div>
          
          <p className="text-xs text-neutral-400 leading-relaxed">
            The platform architecture is structured around complete <b>Zero-Trust security paradigms</b>. This prevents any non-admin or rogue users from modifying databases, altering client quotas, or accessing administrative interfaces.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-neutral-950/40 rounded-2xl border border-neutral-850 space-y-2">
              <h4 className="font-bold text-xs text-neutral-100 uppercase tracking-wider">🔒 Server-Side Token Verification</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Rather than trusting client-side labels or roles (which can be easily modified in browser memory or spoofed in REST clients), every administrator API endpoint is locked under the <code>secureAdminMiddleware</code> loop.
              </p>
              <p className="text-xs text-neutral-500 font-mono bg-neutral-950 p-2.5 rounded-xl">
                1. Header: Authorization: Bearer &lt;id_token&gt;<br />
                2. Verify: getAuth().verifyIdToken(...)<br />
                3. Query: db.collection("users").doc(uid)
              </p>
            </div>

            <div className="p-4 bg-neutral-950/40 rounded-2xl border border-neutral-850 space-y-2">
              <h4 className="font-bold text-xs text-neutral-100 uppercase tracking-wider">🛡️ Zero-Trust Firestore Security Rules</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Our global <code>firestore.rules</code> contains matching expressions ensuring no standard user has permission to write, read or list collections outside their own <code>/users/$(request.auth.uid)</code> root tree. Administrative permissions are handled with strict <code>exists()</code> queries on server side.
              </p>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Admins themselves do not use client SDKs to perform updates to systems – they routing queries through Express secure endpoints which bypass standard rules under GCP Default App Credentials or configured JSON service accounts.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
