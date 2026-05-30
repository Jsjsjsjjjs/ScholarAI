import { useState, useEffect, useCallback, useRef } from "react";
import { auth } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck, Terminal, Wrench, Users, Activity, Save,
  UserMinus, Coins, RefreshCw, Image as ImageIcon, AlertTriangle,
  CheckCircle, Code, Search, X, Loader2, Server,
  Zap, Eye, Database, Cpu, ToggleLeft, ToggleRight,
  ChevronRight, AlertCircle, Radio
} from "lucide-react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeveloperPageProps {
  userData: any;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

interface SystemConfig {
  maintenanceMode: boolean;
  logoUrl: string;
  activeModel: string;
  requestCapLimit: number;
}

interface PlatformStats {
  totalUsers: number;
  totalRequests: number;
  totalTokens: number;
}

interface UserRecord {
  uid: string;
  nickname: string;
  email: string;
  role: string;
  plan: string;
  aiRequests: number;
  totalTokens: number;
  joinedAt?: any;
  stats?: any;
}

interface LogEntry {
  id: string;
  message: string;
  type: string;
  timestamp: any;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODELS = [
  { value: "gemini-2.5-flash-preview-05-20", label: "gemini-2.5-flash-preview (Latest, Recommended)" },
  { value: "gemini-2.0-flash", label: "gemini-2.0-flash (Stable, Fast)" },
  { value: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite (Cost-efficient, Low Latency)" },
  { value: "gemini-1.5-pro", label: "gemini-1.5-pro (Advanced Cognitive Reasoner)" },
  { value: "gemini-1.5-flash", label: "gemini-1.5-flash (Balanced Performance)" },
];

const DEFAULT_CONFIG: SystemConfig = {
  maintenanceMode: false,
  logoUrl: "",
  activeModel: "gemini-2.0-flash",
  requestCapLimit: 100,
};

const DEFAULT_STATS: PlatformStats = {
  totalUsers: 0,
  totalRequests: 0,
  totalTokens: 0,
};

// ─── Safe fetch wrapper ───────────────────────────────────────────────────────

async function safeFetch(
  url: string,
  options: RequestInit,
  signal?: AbortSignal
): Promise<any> {
  const res = await fetch(url, { ...options, signal });
  const text = await res.text();

  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* raw text response */
  }

  if (!res.ok) {
    // Extract the most useful error message from JSON or raw text
    const detail =
      parsed?.details || parsed?.error || text || `HTTP ${res.status}`;
    throw new Error(detail);
  }

  return parsed ?? text;
}

// ─── Toast Component ──────────────────────────────────────────────────────────

function ToastBar({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-semibold shadow-xl pointer-events-auto max-w-sm",
              t.type === "success"
                ? "bg-emerald-950/90 border-emerald-700/40 text-emerald-300"
                : "bg-red-950/90 border-red-700/40 text-red-300"
            )}
          >
            {t.type === "success" ? (
              <CheckCircle size={16} className="shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle size={16} className="shrink-0 text-red-400" />
            )}
            <span className="flex-1 text-xs leading-relaxed">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Inline Confirm Dialog ────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="p-4 bg-red-950/60 border border-red-700/40 rounded-2xl flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3 text-sm text-red-300">
        <AlertCircle size={16} className="shrink-0 text-red-400" />
        <span className="font-semibold">{message}</span>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-xl border border-neutral-700 text-xs font-bold text-neutral-300 hover:bg-neutral-800 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-60"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={12} />}
          Confirm Purge
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DeveloperPage({ userData }: DeveloperPageProps) {
  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"config" | "users" | "logs" | "architecture">("config");

  // ── Loading states (per section, not global) ─────────────────────────────
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [purgingUid, setPurgingUid] = useState<string | null>(null);

  // ── Toast system ─────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── System config state ──────────────────────────────────────────────────
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<PlatformStats>(DEFAULT_STATS);

  // ── Users state ──────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [editPlan, setEditPlan] = useState("free");
  const [editRole, setEditRole] = useState("user");
  const [editLimit, setEditLimit] = useState(100);
  const [editTokens, setEditTokens] = useState(0);
  const [confirmPurgeUid, setConfirmPurgeUid] = useState<string | null>(null);

  // ── Logs state ───────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>("all");

  // ── Abort controller ref ─────────────────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);

  // ─── Auth header helper ────────────────────────────────────────────────────

  const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Session expired. Please reload and sign in again.");
    const token = await user.getIdToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  // ─── Data loaders ──────────────────────────────────────────────────────────

  const loadConfig = useCallback(async (signal?: AbortSignal) => {
    setLoadingConfig(true);
    try {
      const headers = await getAuthHeader();
      const data = await safeFetch("/api/admin/settings", { headers }, signal);
      if (data?.config) {
        setConfig({
          maintenanceMode: data.config.maintenanceMode ?? false,
          logoUrl: data.config.logoUrl ?? "",
          activeModel: data.config.activeModel ?? DEFAULT_CONFIG.activeModel,
          requestCapLimit: data.config.requestCapLimit ?? 100,
        });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("[Admin] Config load failed:", err.message);
        // Fail silently on initial load — don't spam toast on startup
      }
    } finally {
      setLoadingConfig(false);
    }
  }, [getAuthHeader]);

  const loadStats = useCallback(async (signal?: AbortSignal) => {
    setLoadingStats(true);
    try {
      const headers = await getAuthHeader();
      const data = await safeFetch("/api/admin/stats", { headers }, signal);
      if (data?.stats) {
        setStats({
          totalUsers: data.stats.totalUsers ?? 0,
          totalRequests: data.stats.totalRequests ?? 0,
          totalTokens: data.stats.totalTokens ?? 0,
        });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("[Admin] Stats load failed:", err.message);
    } finally {
      setLoadingStats(false);
    }
  }, [getAuthHeader]);

  const loadUsers = useCallback(async (signal?: AbortSignal) => {
    setLoadingUsers(true);
    try {
      const headers = await getAuthHeader();
      const data = await safeFetch("/api/admin/users", { headers }, signal);
      if (data?.users) setUsers(data.users as UserRecord[]);
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("[Admin] Users load failed:", err.message);
    } finally {
      setLoadingUsers(false);
    }
  }, [getAuthHeader]);

  const loadLogs = useCallback(async (signal?: AbortSignal) => {
    setLoadingLogs(true);
    try {
      const headers = await getAuthHeader();
      const data = await safeFetch("/api/admin/logs", { headers }, signal);
      if (data?.logs) setLogs(data.logs as LogEntry[]);
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("[Admin] Logs load failed:", err.message);
    } finally {
      setLoadingLogs(false);
    }
  }, [getAuthHeader]);

  const syncAll = useCallback(async () => {
    // Cancel any previous in-flight requests
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    await Promise.allSettled([
      loadConfig(signal),
      loadStats(signal),
      loadUsers(signal),
      loadLogs(signal),
    ]);
  }, [loadConfig, loadStats, loadUsers, loadLogs]);

  // Initial sync on mount
  useEffect(() => {
    syncAll();
    return () => abortRef.current?.abort();
  }, []);

  // ─── Save handlers ─────────────────────────────────────────────────────────

  const saveConfig = async () => {
    if (savingConfig) return;
    setSavingConfig(true);
    try {
      const headers = await getAuthHeader();
      await safeFetch("/api/admin/settings/update", {
        method: "POST",
        headers,
        body: JSON.stringify({
          maintenanceMode: config.maintenanceMode,
          logoUrl: config.logoUrl,
          activeModel: config.activeModel,
          requestCapLimit: config.requestCapLimit,
        }),
      });
      pushToast("success", "Configuration committed to Firestore successfully.");
      loadStats();
    } catch (err: any) {
      pushToast("error", `Config save failed: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const openEditUser = (u: UserRecord) => {
    setSelectedUser(u);
    setEditPlan(u.plan || "free");
    setEditRole(u.role || "user");
    setEditLimit(u.aiRequests ?? 100);
    setEditTokens(u.totalTokens ?? 0);
  };

  const saveUserEdit = async () => {
    if (!selectedUser || savingUser) return;
    setSavingUser(true);
    try {
      const headers = await getAuthHeader();
      await safeFetch("/api/admin/users/update", {
        method: "POST",
        headers,
        body: JSON.stringify({
          targetUid: selectedUser.uid,
          plan: editPlan,
          role: editRole,
          aiRequests: Number.isNaN(editLimit) ? 100 : editLimit,
          totalTokens: Number.isNaN(editTokens) ? 0 : editTokens,
        }),
      });
      pushToast("success", `Credentials updated for ${selectedUser.nickname}.`);
      setSelectedUser(null);
      loadUsers();
    } catch (err: any) {
      pushToast("error", `User update failed: ${err.message}`);
    } finally {
      setSavingUser(false);
    }
  };

  const executePurge = async (targetUid: string) => {
    if (purgingUid) return;
    setPurgingUid(targetUid);
    try {
      const headers = await getAuthHeader();
      await safeFetch("/api/admin/users/kick", {
        method: "POST",
        headers,
        body: JSON.stringify({ targetUid }),
      });
      const nickname = users.find((u) => u.uid === targetUid)?.nickname ?? targetUid;
      pushToast("success", `${nickname} has been kicked and all records purged.`);
      setConfirmPurgeUid(null);
      loadUsers();
      loadStats();
    } catch (err: any) {
      pushToast("error", `Purge failed: ${err.message}`);
    } finally {
      setPurgingUid(null);
    }
  };

  // ─── Computed values ───────────────────────────────────────────────────────

  const filteredUsers = users.filter(
    (u) =>
      u.nickname?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.uid?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredLogs =
    logFilter === "all" ? logs : logs.filter((l) => l.type === logFilter);

  const anyLoading = loadingConfig || loadingStats || loadingUsers || loadingLogs;

  const formatTimestamp = (ts: any): string => {
    if (!ts) return "—";
    try {
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleTimeString();
    } catch {
      return "—";
    }
  };

  const roleBadgeClass = (role: string) => {
    switch (role) {
      case "owner": return "bg-red-500/10 text-red-400 border border-red-500/20";
      case "admin": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "developer": return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      default: return "bg-neutral-800/80 text-neutral-400 border border-neutral-700";
    }
  };

  const planBadgeClass = (plan: string) => {
    switch (plan) {
      case "elite": return "text-indigo-400";
      case "admin": return "text-amber-400";
      default: return "text-neutral-500";
    }
  };

  // ─── Tab data ──────────────────────────────────────────────────────────────

  const TABS = [
    { id: "config", label: "Dynamic Settings", icon: Wrench },
    { id: "users", label: "User Management", icon: Users },
    { id: "logs", label: "Activity Logs", icon: Terminal },
    { id: "architecture", label: "Security Blueprint", icon: Code },
  ] as const;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <ToastBar toasts={toasts} dismiss={dismissToast} />

      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-neutral-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-orange-500 font-mono text-[10px] uppercase tracking-widest mb-2">
              <ShieldCheck size={13} />
              SECURITY CLEARANCE · LEVEL 5 · ROOT ADMIN
              {config.maintenanceMode && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 text-[9px] animate-pulse font-bold">
                  ⚠ MAINTENANCE ACTIVE
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black tracking-tight text-neutral-100">
              Super-Admin Console
            </h2>
            <p className="text-xs text-neutral-500 mt-1 font-semibold">
              ScholarAI Platform · Signed in as{" "}
              <span className="text-orange-400">{userData?.nickname ?? "Owner"}</span>
            </p>
          </div>

          <button
            onClick={syncAll}
            disabled={anyLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-sm hover:bg-neutral-800 active:scale-95 transition-all text-neutral-300 font-bold disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={13} className={anyLoading ? "animate-spin" : ""} />
            Sync Database
          </button>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Registered Scholars",
              value: loadingStats ? "…" : stats.totalUsers.toLocaleString(),
              icon: Users,
              color: "text-orange-400",
              bg: "bg-orange-500/10 text-orange-500",
            },
            {
              label: "Total AI Requests",
              value: loadingStats ? "…" : stats.totalRequests.toLocaleString(),
              icon: Activity,
              color: "text-amber-400",
              bg: "bg-amber-500/10 text-amber-500",
            },
            {
              label: "Tokens Propagated",
              value: loadingStats ? "…" : stats.totalTokens.toLocaleString(),
              icon: Coins,
              color: "text-indigo-400",
              bg: "bg-indigo-500/10 text-indigo-500",
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="p-5 bg-neutral-900/40 border border-neutral-800/60 rounded-2xl flex items-center justify-between"
            >
              <div>
                <p className="text-[10px] font-black tracking-widest text-neutral-500 uppercase">
                  {card.label}
                </p>
                <h3 className={cn("text-3xl font-black mt-2 tracking-tight", card.color)}>
                  {card.value}
                </h3>
              </div>
              <div className={cn("p-3 rounded-xl", card.bg)}>
                <card.icon size={22} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-neutral-800 overflow-x-auto gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-1.5 h-11 px-3 border-b-2 font-bold text-xs whitespace-nowrap transition-all shrink-0",
                activeTab === id
                  ? "border-orange-500 text-neutral-100"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >

            {/* ═══ CONFIG TAB ═══ */}
            {activeTab === "config" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left: settings form */}
                <div className="md:col-span-2 p-6 bg-neutral-900/20 border border-neutral-800 rounded-3xl space-y-5">
                  <div>
                    <h3 className="text-base font-black tracking-tight">On-The-Fly Platform Controls</h3>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Changes are written instantly to Firestore — no rebuild or deployment required.
                    </p>
                  </div>

                  {/* Maintenance Mode toggle */}
                  <div className="flex items-center justify-between p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                    <div>
                      <h4 className="font-bold text-sm">Maintenance Mode</h4>
                      <p className="text-xs text-neutral-500 mt-0.5 max-w-xs leading-relaxed">
                        Locks non-developer users out and shows a maintenance screen platform-wide.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfig((c) => ({ ...c, maintenanceMode: !c.maintenanceMode }))}
                      className="shrink-0 ml-4 transition-colors"
                      aria-label="Toggle maintenance mode"
                    >
                      {config.maintenanceMode ? (
                        <ToggleRight size={36} className="text-red-500" />
                      ) : (
                        <ToggleLeft size={36} className="text-neutral-600" />
                      )}
                    </button>
                  </div>

                  {/* Logo URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 block">Dynamic Brand Logo URL</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={config.logoUrl}
                        onChange={(e) => setConfig((c) => ({ ...c, logoUrl: e.target.value }))}
                        placeholder="https://your-logo-url.com/logo.png"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-mono text-neutral-300 placeholder:text-neutral-600"
                      />
                      <div className="w-10 h-10 border border-neutral-800 rounded-xl bg-neutral-950 flex items-center justify-center overflow-hidden shrink-0">
                        {config.logoUrl ? (
                          <img
                            src={config.logoUrl}
                            alt="Logo preview"
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <ImageIcon size={16} className="text-neutral-600" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active AI Model */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 block">Active AI Orchestration Model</label>
                    <select
                      value={config.activeModel}
                      onChange={(e) => setConfig((c) => ({ ...c, activeModel: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none text-neutral-300 font-mono"
                    >
                      {GEMINI_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Request cap */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 block">
                      Default Daily Request Cap{" "}
                      <span className="text-neutral-600 font-normal">(per user)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={config.requestCapLimit}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setConfig((c) => ({ ...c, requestCapLimit: Number.isNaN(v) ? 100 : Math.max(1, v) }));
                      }}
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-mono text-neutral-300"
                    />
                  </div>

                  {/* Save button */}
                  <div className="pt-4 border-t border-neutral-800 flex justify-end">
                    <button
                      onClick={saveConfig}
                      disabled={savingConfig}
                      className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 font-black text-white text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-orange-500/10 active:scale-95 transition-all"
                    >
                      {savingConfig ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Save size={13} />
                      )}
                      {savingConfig ? "Committing…" : "Commit Changes"}
                    </button>
                  </div>
                </div>

                {/* Right: system status sidebar */}
                <div className="p-5 bg-neutral-900/10 border border-neutral-800 rounded-3xl space-y-4">
                  <h4 className="font-black text-sm flex items-center gap-1.5 text-orange-400">
                    <Server size={15} /> System Status
                  </h4>

                  <div className="space-y-0 text-xs font-mono divide-y divide-neutral-800/60">
                    {[
                      { label: "Firebase Project", value: "netflix-fix", color: "text-emerald-400" },
                      { label: "Database", value: "Cloud Firestore", color: "text-neutral-200" },
                      { label: "Server Port", value: "3000", color: "text-emerald-400" },
                      { label: "Maintenance", value: config.maintenanceMode ? "ACTIVE" : "OFF", color: config.maintenanceMode ? "text-red-400 animate-pulse" : "text-emerald-400" },
                      { label: "Active Model", value: config.activeModel.split("-").slice(0, 3).join("-"), color: "text-amber-400" },
                      { label: "Request Cap", value: `${config.requestCapLimit} / day`, color: "text-neutral-200" },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center py-2.5">
                        <span className="text-neutral-500">{row.label}</span>
                        <span className={cn("font-bold", row.color)}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/10 text-[10px] leading-relaxed text-neutral-400">
                    <span className="font-bold text-orange-500 block mb-1">Live Propagation</span>
                    Config changes are written to <code className="text-neutral-300">system/config</code> in Firestore and picked up by the frontend in real-time via <code className="text-neutral-300">onSnapshot</code>.
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                    <Radio size={10} className="animate-pulse" />
                    <span>All systems nominal</span>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ USERS TAB ═══ */}
            {activeTab === "users" && (
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row gap-3 p-4 bg-neutral-900/20 border border-neutral-800 rounded-2xl">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search by nickname, email, or UID…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none text-neutral-300 placeholder:text-neutral-600"
                    />
                  </div>
                  <div className="text-xs font-semibold text-neutral-500 self-center shrink-0">
                    <span className="text-orange-400 font-black">{filteredUsers.length}</span> / {users.length} scholars
                    {loadingUsers && <Loader2 size={12} className="inline ml-2 animate-spin text-neutral-500" />}
                  </div>
                </div>

                {/* User table */}
                <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-950/30">
                  <table className="w-full text-left border-collapse text-xs min-w-[640px]">
                    <thead>
                      <tr className="bg-neutral-900/70 text-neutral-500 font-black uppercase tracking-widest text-[9px] border-b border-neutral-800">
                        <th className="px-5 h-11">Scholar</th>
                        <th className="px-4 h-11">Role</th>
                        <th className="px-4 h-11">Plan</th>
                        <th className="px-4 h-11">Usage</th>
                        <th className="px-5 h-11 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-neutral-600 text-xs font-semibold">
                            {loadingUsers ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin" /> Loading users…
                              </span>
                            ) : userSearch ? (
                              "No users match your search."
                            ) : (
                              "No scholars registered yet."
                            )}
                          </td>
                        </tr>
                      )}
                      {filteredUsers.map((u) => (
                        <tr key={u.uid} className="hover:bg-neutral-900/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-neutral-100">{u.nickname || "Anonymous"}</div>
                            <div className="text-neutral-500 text-[10px] font-mono mt-0.5">{u.email || "—"}</div>
                            <div className="text-[9px] text-neutral-700 font-mono mt-0.5 select-all">{u.uid?.substring(0, 20)}…</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black", roleBadgeClass(u.role))}>
                              {u.role || "user"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn("font-black uppercase tracking-wider text-[10px]", planBadgeClass(u.plan))}>
                              {u.plan || "free"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-neutral-200">{(u.aiRequests ?? 0).toLocaleString()} req</div>
                            <div className="text-neutral-500 font-mono text-[10px]">
                              {(u.totalTokens ?? 0).toLocaleString()} tokens
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditUser(u)}
                                className="px-3 py-1.5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 font-bold text-neutral-300 transition-all text-[10px] tracking-wide"
                              >
                                Modify
                              </button>
                              <button
                                onClick={() => setConfirmPurgeUid(u.uid)}
                                className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 active:scale-95 transition-all"
                                title="Purge user from database"
                              >
                                <UserMinus size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Inline confirm dialog */}
                <AnimatePresence>
                  {confirmPurgeUid && (
                    <ConfirmDialog
                      message={`Permanently purge ${users.find((u) => u.uid === confirmPurgeUid)?.nickname ?? "this user"} and all their data? This is irreversible.`}
                      onConfirm={() => executePurge(confirmPurgeUid)}
                      onCancel={() => setConfirmPurgeUid(null)}
                      loading={!!purgingUid}
                    />
                  )}
                </AnimatePresence>

                {/* Edit panel */}
                <AnimatePresence>
                  {selectedUser && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="p-6 bg-neutral-900/30 border border-neutral-800 rounded-3xl space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                        <h4 className="font-black text-sm">
                          Editing —{" "}
                          <span className="text-orange-400">{selectedUser.nickname}</span>
                          <span className="text-neutral-500 font-normal text-xs ml-2">{selectedUser.email}</span>
                        </h4>
                        <button
                          onClick={() => setSelectedUser(null)}
                          className="text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Plan */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Subscription Tier</label>
                          <select
                            value={editPlan}
                            onChange={(e) => setEditPlan(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none text-neutral-300"
                          >
                            <option value="free">Free Starter</option>
                            <option value="elite">Elite VIP Scholar</option>
                            <option value="admin">Admin / Developer</option>
                          </select>
                        </div>

                        {/* Role */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Permission Role</label>
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none text-neutral-300"
                          >
                            <option value="user">User (Student)</option>
                            <option value="developer">Developer (Panel Access)</option>
                            <option value="admin">Admin (Full Control)</option>
                            <option value="owner">Owner (Super User)</option>
                          </select>
                        </div>

                        {/* Request limit */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">AI Request Limit</label>
                          <input
                            type="number"
                            min={0}
                            value={editLimit}
                            onChange={(e) => setEditLimit(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-mono text-neutral-300"
                          />
                        </div>

                        {/* Token balance */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Token Balance</label>
                          <input
                            type="number"
                            min={0}
                            value={editTokens}
                            onChange={(e) => setEditTokens(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-mono text-neutral-300"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-neutral-800">
                        <button
                          onClick={saveUserEdit}
                          disabled={savingUser}
                          className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-black text-xs flex items-center gap-2 active:scale-95 transition-all"
                        >
                          {savingUser ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          {savingUser ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ═══ LOGS TAB ═══ */}
            {activeTab === "logs" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-neutral-900/10 border border-neutral-800 rounded-2xl">
                  <p className="text-xs text-neutral-500 font-semibold">
                    Live Node.js backend event log stream. Entries sorted by most recent first.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(["all", "system", "discord", "ai", "error"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setLogFilter(f)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                          logFilter === f
                            ? "bg-orange-500 text-white"
                            : "bg-neutral-900 text-neutral-500 border border-neutral-800 hover:text-neutral-300"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                    <button
                      onClick={loadLogs}
                      disabled={loadingLogs}
                      className="px-3 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] font-bold flex items-center gap-1.5 hover:text-neutral-200 transition-all"
                    >
                      <RefreshCw size={10} className={loadingLogs ? "animate-spin" : ""} />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-neutral-950 border border-neutral-800 font-mono text-[11px] leading-relaxed min-h-64 max-h-96 overflow-y-auto">
                  <div className="text-neutral-600 border-b border-neutral-900 pb-2 mb-3 flex justify-between text-[10px]">
                    <span>── SYSTEM EVENT LOG CONSOLE ──</span>
                    <span className="text-neutral-700">{new Date().toISOString()}</span>
                  </div>

                  {loadingLogs && (
                    <div className="flex items-center gap-2 text-neutral-600 py-4">
                      <Loader2 size={13} className="animate-spin" />
                      <span>Fetching logs from Firestore…</span>
                    </div>
                  )}

                  {!loadingLogs && filteredLogs.length === 0 && (
                    <p className="text-neutral-700 py-4">No log entries found{logFilter !== "all" ? ` for type "${logFilter}"` : ""}.</p>
                  )}

                  <div className="space-y-1.5">
                    {filteredLogs.map((lg) => (
                      <div key={lg.id} className="flex flex-col sm:flex-row sm:gap-3 py-1.5 border-b border-neutral-900/40 last:border-none">
                        <span className="text-neutral-700 shrink-0 text-[10px]">[{formatTimestamp(lg.timestamp)}]</span>
                        <span className={cn(
                          "font-black shrink-0 uppercase text-[8px] px-1.5 py-0.5 rounded self-start",
                          lg.type === "system" ? "bg-emerald-500/10 text-emerald-400" :
                          lg.type === "discord" ? "bg-indigo-500/10 text-indigo-400" :
                          lg.type === "ai" ? "bg-orange-500/10 text-orange-400" :
                          lg.type === "error" ? "bg-red-500/10 text-red-400" :
                          "bg-neutral-800 text-neutral-400"
                        )}>
                          {lg.type || "info"}
                        </span>
                        <span className="text-neutral-300 break-all">{lg.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ ARCHITECTURE TAB ═══ */}
            {activeTab === "architecture" && (
              <div className="p-6 bg-neutral-900/20 border border-neutral-800 rounded-3xl space-y-5">
                <div className="flex items-center gap-2 border-b border-neutral-800 pb-4">
                  <ShieldCheck size={20} className="text-orange-500" />
                  <h3 className="font-black text-lg">Security Architecture · RBAC Zero-Trust Model</h3>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  The platform is architected on a complete <strong className="text-neutral-200">Zero-Trust security paradigm</strong>. Every admin API endpoint requires a verified Firebase Auth ID token and a server-side role check — preventing any client-side spoofing, session replay, or privilege escalation.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      icon: ShieldCheck,
                      title: "Server-Side Token Verification",
                      color: "text-orange-400",
                      content: `Every request to /api/admin/* passes through secureAdminMiddleware. The server decodes the Firebase ID token from the Authorization header, then queries Firestore directly for the user's role. The client cannot inject or fake this role — the database is the single source of truth.`,
                      code: `1. Header: Authorization: Bearer <id_token>\n2. Decode: JWT payload → uid + email\n3. Query:  db.collection("users").doc(uid)\n4. Check:  role === "owner" || "admin" || "developer"`,
                    },
                    {
                      icon: Database,
                      title: "Firestore Security Rules",
                      color: "text-indigo-400",
                      content: `All client-side Firestore access is governed by firestore.rules. The default catch-all rule denies everything. Individual collections explicitly open only the paths they need, scoped to request.auth.uid. Admin operations bypass rules via the server-side Express API.`,
                      code: `match /{document=**} {\n  allow read, write: if false; // deny-all\n}\nmatch /users/{userId} {\n  allow read, write: if true; // admin bypass\n}`,
                    },
                    {
                      icon: Cpu,
                      title: "Credential Isolation",
                      color: "text-emerald-400",
                      content: `server.ts sets GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_CLOUD_PROJECT on startup, forcing the Node.js Firebase SDK's gRPC transport to use the netflix-fix service account instead of the AI Studio hosting project's ADC. This is what prevents the PERMISSION_DENIED errors in admin writes.`,
                      code: `process.env.GOOGLE_CLOUD_PROJECT = "netflix-fix"\nprocess.env.GOOGLE_APPLICATION_CREDENTIALS\n  = "./service-account.json"`,
                    },
                    {
                      icon: Zap,
                      title: "No Client-Side Admin Writes",
                      color: "text-amber-400",
                      content: `The DeveloperPage component never writes to Firestore directly. All mutations (config updates, user edits, purges) go through the secure Express endpoints. The frontend only reads via the admin API and reacts to onSnapshot for live config updates in App.tsx.`,
                      code: `POST /api/admin/settings/update\nPOST /api/admin/users/update\nPOST /api/admin/users/kick\nGET  /api/admin/stats | users | logs`,
                    },
                  ].map((card) => (
                    <div key={card.title} className="p-4 bg-neutral-950/50 rounded-2xl border border-neutral-800 space-y-3">
                      <h4 className="font-black text-xs text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                        <card.icon size={14} className={card.color} />
                        {card.title}
                      </h4>
                      <p className="text-xs text-neutral-400 leading-relaxed">{card.content}</p>
                      <pre className="text-[10px] text-neutral-400 bg-neutral-950 p-3 rounded-xl border border-neutral-900 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                        {card.code}
                      </pre>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-3 p-4 bg-orange-500/5 border border-orange-500/15 rounded-2xl">
                  <AlertTriangle size={15} className="text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    <strong className="text-orange-400">Service account required.</strong> Fill <code className="text-neutral-300 bg-neutral-900 px-1 rounded">service-account.json</code> with a real key downloaded from{" "}
                    <span className="text-neutral-300">Firebase Console → netflix-fix → Project Settings → Service Accounts → Generate new private key</span>.
                    Without it, the GCP credential override in <code className="text-neutral-300 bg-neutral-900 px-1 rounded">server.ts</code> has no effect and Firestore admin writes will fail.
                  </p>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
