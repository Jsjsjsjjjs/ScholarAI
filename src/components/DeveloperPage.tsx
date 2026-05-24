import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
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
  Code
} from "lucide-react";

interface DeveloperPageProps {
  userData: any;
}

export default function DeveloperPage({ userData }: DeveloperPageProps) {
  // Tabs: "config" | "users" | "logs" | "architecture"
  const [adminTab, setAdminTab] = useState("config");
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

  // Fetch token securely
  const getAuthHeader = async () => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No authenticated user active.");
    }
    const token = await user.getIdToken();
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
      setLogoUrl("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60");
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
    setEditLimit(u.aiRequests || 100);
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
          aiRequests: editLimit,
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
        <button 
          onClick={syncAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-sm hover:bg-neutral-850 active:scale-95 transition-all text-neutral-300 font-semibold"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Sync Live Database
        </button>
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
                  <option value="gemini-3.5-flash">gemini-3.5-flash (Standard & Recommended)</option>
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
                <span>Database Instance:</span> <span className="font-bold text-neutral-200">Enterprise</span>
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
