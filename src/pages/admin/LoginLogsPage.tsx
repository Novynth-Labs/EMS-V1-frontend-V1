import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Shield, ShieldAlert, ShieldCheck, Search, RefreshCw, 
  Download, Filter, Calendar, Clock, Monitor, Smartphone, 
  Globe, Laptop, UserCheck, AlertTriangle, CheckCircle2, 
  XCircle, Copy, Check, Eye, Lock, Unlock, ChevronLeft, 
  ChevronRight, ArrowUpDown, Info, KeyRound, Radio
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { getLoginLogs, getLoginLogsStats, unlockUser, LoginLogItem, LoginLogsStats } from '../../api/admin.api';
import { toast } from '../../utils/toast';
import { getInitials } from '../../utils/initials';
import { Link } from 'react-router-dom';

// Parse User-Agent string to get human-friendly Browser, OS, and Device info
function parseUserAgent(uaString: string | null | undefined) {
  if (!uaString || uaString === 'Unknown' || uaString === 'Unknown Device') {
    return { browser: 'Unknown Browser', os: 'Unknown OS', isMobile: false, isDesktopApp: false };
  }

  let browser = 'Web Browser';
  let os = 'Unknown OS';
  const isMobile = /mobile|iphone|ipad|android/i.test(uaString);
  const isDesktopApp = /electron|novynth/i.test(uaString);

  // OS detection
  if (/windows/i.test(uaString)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(uaString)) os = 'macOS';
  else if (/linux/i.test(uaString)) os = 'Linux';
  else if (/android/i.test(uaString)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(uaString)) os = 'iOS';

  // Browser detection
  if (isDesktopApp) {
    browser = 'Novynth Desktop App';
  } else if (/edg\//i.test(uaString)) {
    browser = 'Microsoft Edge';
  } else if (/chrome|crios/i.test(uaString) && !/opr|opera/i.test(uaString)) {
    browser = 'Google Chrome';
  } else if (/firefox|fxios/i.test(uaString)) {
    browser = 'Mozilla Firefox';
  } else if (/safari/i.test(uaString) && !/chrome/i.test(uaString)) {
    browser = 'Apple Safari';
  } else if (/opr|opera/i.test(uaString)) {
    browser = 'Opera';
  }

  return { browser, os, isMobile, isDesktopApp };
}

// Relative time formatter
function formatRelativeTime(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${Math.max(1, diffSecs)}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

export const LoginLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LoginLogItem[]>([]);
  const [stats, setStats] = useState<LoginLogsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modals & Active item
  const [selectedLog, setSelectedLog] = useState<LoginLogItem | null>(null);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);

  // Compute start/end dates based on dateRange preset
  const dateParams = useMemo(() => {
    const now = new Date();
    if (dateRange === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      return { startDate: todayStr, endDate: todayStr };
    }
    if (dateRange === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: past.toISOString().split('T')[0] };
    }
    if (dateRange === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: past.toISOString().split('T')[0] };
    }
    return {};
  }, [dateRange]);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        getLoginLogs({
          page: currentPage,
          limit: pageSize,
          search: searchTerm,
          status: statusFilter,
          ...dateParams
        }),
        getLoginLogsStats()
      ]);

      if (logsRes && Array.isArray(logsRes.logs)) {
        setLogs(logsRes.logs);
        setTotalPages(logsRes.pagination?.totalPages || 1);
        setTotalRecords(logsRes.pagination?.total || 0);
      } else if (Array.isArray(logsRes)) {
        setLogs(logsRes);
        setTotalRecords(logsRes.length);
        setTotalPages(1);
      }

      if (statsRes) {
        setStats(statsRes);
      }
    } catch (err: any) {
      console.error('Failed to load login audit logs:', err);
      if (!isBackground) {
        toast.error(err.response?.data?.message || err.message || 'Failed to fetch login logs');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize, searchTerm, statusFilter, dateParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Periodic Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    toast.success(`Copied IP ${ip} to clipboard`);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const handleUnlock = async (userId: string, userName?: string | null) => {
    try {
      setUnlockingUserId(userId);
      const res = await unlockUser(userId);
      if (res.success) {
        toast.success(`Account unlocked: ${userName || userId}`);
        fetchData();
        if (selectedLog && selectedLog.userId === userId) {
          setSelectedLog(prev => prev ? { ...prev, isLocked: false } : null);
        }
      } else {
        toast.error(res.message || 'Failed to unlock account');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Unlock error');
    } finally {
      setUnlockingUserId(null);
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.info('No login logs to export.');
      return;
    }

    const headers = ['Log ID', 'Timestamp', 'User Name', 'Emp ID', 'Email', 'Role', 'Status', 'Failure Reason', 'Stage', 'IP Address', 'User Agent'];
    const rows = logs.map(l => [
      l.id,
      `"${new Date(l.createdAt).toISOString()}"`,
      `"${l.userName || 'N/A'}"`,
      `"${l.empId || 'N/A'}"`,
      `"${l.emailAttempted}"`,
      `"${l.role || 'N/A'}"`,
      l.success ? 'SUCCESS' : 'FAILED',
      `"${(l.failureReason || '').replace(/"/g, '""')}"`,
      `"${l.stage || 'LOGIN'}"`,
      `"${l.ipAddress}"`,
      `"${(l.userAgent || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `novynth_login_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Login logs CSV downloaded successfully');
  };

  const successRate = useMemo(() => {
    if (!stats || stats.totalAttempts === 0) return 100;
    return Math.round((stats.successfulLogins / stats.totalAttempts) * 100);
  }, [stats]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/80 via-indigo-950/40 to-slate-900/80 border border-white/10 p-6 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
            <Shield size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">Login Audit & Security Logs</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Monitoring
              </span>
            </div>
            <p className="text-xs text-white/60 mt-1">
              Real-time audit log of all system authentication attempts, multi-factor validations, and security events.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
              autoRefresh 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
            }`}
            title="Auto-refresh logs every 20 seconds"
          >
            <Radio size={14} className={autoRefresh ? 'text-emerald-400 animate-pulse' : ''} />
            <span>Auto-Refresh: {autoRefresh ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Logins */}
        <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Total Login Attempts</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <KeyRound size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tracking-tight">
              {stats ? stats.totalAttempts.toLocaleString() : '—'}
            </span>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              +{stats?.todayAttempts || 0} today
            </span>
          </div>
          <div className="mt-2 text-[11px] text-white/40 flex items-center gap-1.5">
            <Clock size={12} />
            <span>{stats?.uniqueUsersToday || 0} distinct users active today</span>
          </div>
        </div>

        {/* Successful Logins */}
        <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Successful Logins</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tracking-tight">
              {stats ? stats.successfulLogins.toLocaleString() : '—'}
            </span>
            <span className="text-xs font-bold text-emerald-400">
              {successRate}% rate
            </span>
          </div>
          <div className="mt-2 text-[11px] text-white/40 flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span>{stats?.todaySuccessful || 0} authenticated today</span>
          </div>
        </div>

        {/* Failed Attempts */}
        <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Failed Attempts</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tracking-tight">
              {stats ? stats.failedLogins.toLocaleString() : '—'}
            </span>
            {stats && stats.todayFailed > 0 && (
              <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                {stats.todayFailed} today
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-white/40 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-rose-400" />
            <span>Monitored for brute force & lockouts</span>
          </div>
        </div>

        {/* Locked Accounts */}
        <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">Locked Accounts</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Lock size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tracking-tight">
              {stats ? stats.lockedCount : '0'}
            </span>
            {stats && stats.lockedCount > 0 ? (
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                Action needed
              </span>
            ) : (
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                All clear
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-white/40 flex items-center gap-1.5">
            <Link to="/users" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Manage locked users in Directory →
            </Link>
          </div>
        </div>
      </div>

      {/* Activity Trends Chart (7-Day Breakdown) */}
      {stats?.trend && stats.trend.length > 0 && (
        <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">7-Day Authentication Activity Trend</h3>
              <p className="text-xs text-white/50">Successful logins vs failed access challenges</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-white/70">Success</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="text-white/70">Failed</span>
              </div>
            </div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="success" name="Successful" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSuccess)" />
                <Area type="monotone" dataKey="failed" name="Failed" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search by user, email, emp ID, or IP..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-indigo-500/60 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'all' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            All Logs
          </button>
          <button
            onClick={() => { setStatusFilter('success'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'success' 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-white/5'
            }`}
          >
            <CheckCircle2 size={12} />
            <span>Success</span>
          </button>
          <button
            onClick={() => { setStatusFilter('failed'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'failed' 
                ? 'bg-rose-600 text-white shadow-sm' 
                : 'text-rose-400/80 hover:text-rose-300 hover:bg-white/5'
            }`}
          >
            <XCircle size={12} />
            <span>Failed</span>
          </button>
        </div>

        {/* Date Range & Page Size */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value as any); setCurrentPage(1); }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/60"
          >
            <option value="all" className="bg-slate-900 text-white">All Time</option>
            <option value="today" className="bg-slate-900 text-white">Today</option>
            <option value="7days" className="bg-slate-900 text-white">Last 7 Days</option>
            <option value="30days" className="bg-slate-900 text-white">Last 30 Days</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/60"
          >
            <option value="15" className="bg-slate-900 text-white">15 per page</option>
            <option value="25" className="bg-slate-900 text-white">25 per page</option>
            <option value="50" className="bg-slate-900 text-white">50 per page</option>
            <option value="100" className="bg-slate-900 text-white">100 per page</option>
          </select>
        </div>
      </div>

      {/* Main Logs Table */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-white/50">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">User / Account</th>
                <th className="py-3.5 px-4">Status & Stage</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4">Device & Browser</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-white/80">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-white/40">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={24} className="animate-spin text-indigo-400" />
                      <span>Loading authentication logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-white/40">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Shield size={32} className="text-white/20" />
                      <p className="text-sm font-semibold text-white/70">No login logs found</p>
                      <p className="text-xs text-white/40 max-w-sm">
                        {searchTerm || statusFilter !== 'all' || dateRange !== 'all'
                          ? 'No records match your active filter criteria. Try resetting filters.'
                          : 'Login attempts will automatically appear here once users authenticate.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const ua = parseUserAgent(log.userAgent);
                  const isSuccess = log.success;

                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-white/[0.04] transition-colors group ${
                        !isSuccess ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white text-xs">
                            {formatRelativeTime(log.createdAt)}
                          </span>
                          <span className="text-[10px] text-white/40">
                            {new Date(log.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                        </div>
                      </td>

                      {/* User Account */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border ${
                            isSuccess 
                              ? 'bg-gradient-to-br from-indigo-500/30 to-purple-600/30 text-indigo-200 border-indigo-500/30' 
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}>
                            {log.avatarUrl ? (
                              <img src={log.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              getInitials(log.userName || log.emailAttempted)
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white truncate text-xs">
                                {log.userName || log.emailAttempted.split('@')[0]}
                              </span>
                              {log.empId && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white/60 font-mono">
                                  {log.empId}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-white/40 truncate">
                              {log.emailAttempted}
                            </span>
                            {log.role && (
                              <span className="text-[10px] text-indigo-400 font-medium">
                                {log.role} {log.department ? `• ${log.department}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status & Stage */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 size={11} />
                              Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <XCircle size={11} />
                              Failed
                            </span>
                          )}

                          {log.failureReason && (
                            <span className="text-[10px] text-rose-300 font-medium line-clamp-1 max-w-[220px]" title={log.failureReason}>
                              {log.failureReason}
                            </span>
                          )}

                          {log.stage && log.stage !== 'LOGIN' && (
                            <span className="text-[9px] text-white/40 uppercase tracking-wider font-mono">
                              stage: {log.stage}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-white/90 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                            {log.ipAddress || 'Unknown'}
                          </span>
                          {log.ipAddress && log.ipAddress !== 'Unknown' && (
                            <button
                              onClick={() => handleCopyIp(log.ipAddress)}
                              className="text-white/30 hover:text-white p-1 rounded transition-colors"
                              title="Copy IP Address"
                            >
                              {copiedIp === log.ipAddress ? (
                                <Check size={12} className="text-emerald-400" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Device & Browser */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="text-white/50 shrink-0">
                            {ua.isDesktopApp ? (
                              <Laptop size={15} className="text-indigo-400" />
                            ) : ua.isMobile ? (
                              <Smartphone size={15} className="text-amber-400" />
                            ) : (
                              <Monitor size={15} className="text-blue-400" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-white truncate">
                              {ua.browser}
                            </span>
                            <span className="text-[10px] text-white/40">
                              {ua.os} {ua.isDesktopApp ? '• Desktop App' : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {log.isLocked && log.userId && (
                            <button
                              onClick={() => handleUnlock(log.userId!, log.userName)}
                              disabled={unlockingUserId === log.userId}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-all cursor-pointer"
                              title="Unlock this locked account"
                            >
                              <Unlock size={11} />
                              <span>Unlock</span>
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                            title="Inspect Log Details"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="border-t border-white/10 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50 bg-white/[0.01]">
          <div>
            Showing <span className="text-white font-semibold">{logs.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="text-white font-semibold">{Math.min(currentPage * pageSize, totalRecords)}</span> of{' '}
            <span className="text-white font-semibold">{totalRecords.toLocaleString()}</span> entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="px-3 py-1 font-semibold text-white">
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  selectedLog.success 
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                    : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                }`}>
                  {selectedLog.success ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Login Attempt #{selectedLog.id}
                  </h3>
                  <p className="text-xs text-white/50">
                    Recorded at {new Date(selectedLog.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors text-lg"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                selectedLog.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {selectedLog.success ? (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {selectedLog.success ? 'Authentication Succeeded' : 'Authentication Failed'}
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">
                    {selectedLog.failureReason 
                      ? `Reason: ${selectedLog.failureReason}` 
                      : 'Credentials verified and session token issued successfully.'}
                  </p>
                  {selectedLog.stage && (
                    <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 uppercase">
                      Stage: {selectedLog.stage}
                    </span>
                  )}
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Email Attempted</span>
                  <p className="font-semibold text-white truncate text-xs">{selectedLog.emailAttempted}</p>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Matched Employee</span>
                  <p className="font-semibold text-white truncate text-xs">
                    {selectedLog.userName ? `${selectedLog.userName} (${selectedLog.empId || 'No Emp ID'})` : 'No matching active user'}
                  </p>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">IP Address</span>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-white text-xs">{selectedLog.ipAddress}</p>
                    <button
                      onClick={() => handleCopyIp(selectedLog.ipAddress)}
                      className="text-white/40 hover:text-white"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Device & Platform</span>
                  <p className="font-semibold text-white text-xs">
                    {parseUserAgent(selectedLog.userAgent).browser} on {parseUserAgent(selectedLog.userAgent).os}
                  </p>
                </div>
              </div>

              {/* Raw User Agent */}
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Raw User-Agent Header</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedLog.userAgent);
                      toast.success('Copied User-Agent');
                    }}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-white/70 bg-black/40 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap break-all border border-white/5">
                  {selectedLog.userAgent || 'No User-Agent reported'}
                </pre>
              </div>

              {/* Quick Actions if Account is locked or user has profile */}
              {selectedLog.userId && (
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <Link
                    to={`/employees/${selectedLog.userId}`}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 font-semibold"
                  >
                    <UserCheck size={14} />
                    <span>View Employee Profile</span>
                  </Link>

                  {selectedLog.isLocked && (
                    <button
                      onClick={() => handleUnlock(selectedLog.userId!, selectedLog.userName)}
                      disabled={unlockingUserId === selectedLog.userId}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg transition-all"
                    >
                      <Unlock size={14} />
                      <span>Unlock User Account</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
