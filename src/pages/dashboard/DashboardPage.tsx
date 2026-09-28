import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getRolePermissions, hasPermission, Permission } from '../../config/dashboardConfig';
import { getDashboardData } from '../../api/admin.api';
import { getMyTasks } from '../../api/projects.api';
import { getMyRequests, getApprovalQueue } from '../../api/requests.api';
import { 
  getOpsDashboardData, getGrowthDashboardData, getProductDashboardData, 
  getDesignDashboardData, getEngLeadDashboardData, getAILeadDashboardData, 
  getSecurityDashboardData, getFinanceDashboardData, createSOP, logRisk, 
  logIncident, logInternHours 
} from '../../api/dashboard.api';
import { getTodayStandupStatus, type TodayStandupStatusResponse } from '../../api/standups.api';
import { 
  Users, FolderKanban, Clock, Activity, ArrowRight, UserPlus, 
  FileText, CheckCircle, TrendingUp, BarChart3, Briefcase, Calendar, 
  Shield, Zap, Sparkles, Plus, Target, Cpu, Layers, Lock, 
  DollarSign, BookOpen, AlertTriangle, CheckCircle2, XCircle, Send, HelpCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { OnboardingDashboard } from './OnboardingDashboard';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { toast } from '../../utils/toast';

export const DashboardPage: React.FC = () => {
  const { user, role } = useAuthStore();
  const navigate = useNavigate();

  // Active permissions derived from RBAC configuration
  const userPermissions: Permission[] = getRolePermissions(role);

  // Consolidated Data State
  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState<any>(null);
  const [standupData, setStandupData] = useState<TodayStandupStatusResponse | null>(null);
  const [employeeData, setEmployeeData] = useState<{ tasks: any[]; requests: any[]; approvals: any[] }>({
    tasks: [],
    requests: [],
    approvals: []
  });

  // Domain-specific module states
  const [opsData, setOpsData] = useState<any>(null);
  const [growthData, setGrowthData] = useState<any>(null);
  const [productData, setProductData] = useState<any>(null);
  const [designData, setDesignData] = useState<any>(null);
  const [engData, setEngData] = useState<any>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [securityData, setSecurityData] = useState<any>(null);
  const [financeData, setFinanceData] = useState<any>(null);

  // Form states for domain actions
  const [sopTitle, setSopTitle] = useState('');
  const [riskTitle, setRiskTitle] = useState('');
  const [internHours, setInternHours] = useState(2);
  const [internDesc, setInternDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchUnifiedDashboardData = async () => {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [];

        // 1. Personal Employee Tasks & Requests & Daily Standup Status
        const personalTasksPromise = getMyTasks().catch(() => []);
        const personalRequestsPromise = getMyRequests().catch(() => []);
        const standupPromise = getTodayStandupStatus().catch(() => null);
        const approvalQueuePromise = hasPermission(userPermissions, 'view_team_queue')
          ? getApprovalQueue(role!).catch(() => [])
          : Promise.resolve([]);

        // 2. Admin & System Overview Metrics
        const adminPromise = hasPermission(userPermissions, ['view_system_overview', 'view_admin_metrics', 'view_hr_module'])
          ? getDashboardData().then(res => res.data).catch(() => null)
          : Promise.resolve(null);

        // 3. Domain Modules Data
        const opsPromise = hasPermission(userPermissions, 'view_ops_module') ? getOpsDashboardData().catch(() => null) : Promise.resolve(null);
        const growthPromise = hasPermission(userPermissions, 'view_growth_module') ? getGrowthDashboardData().catch(() => null) : Promise.resolve(null);
        const productPromise = hasPermission(userPermissions, 'view_product_module') ? getProductDashboardData().catch(() => null) : Promise.resolve(null);
        const designPromise = hasPermission(userPermissions, 'view_design_module') ? getDesignDashboardData().catch(() => null) : Promise.resolve(null);
        const engPromise = hasPermission(userPermissions, 'view_engineering_module') ? getEngLeadDashboardData().catch(() => null) : Promise.resolve(null);
        const aiPromise = hasPermission(userPermissions, 'view_ai_module') ? getAILeadDashboardData().catch(() => null) : Promise.resolve(null);
        const securityPromise = hasPermission(userPermissions, 'view_security_module') ? getSecurityDashboardData().catch(() => null) : Promise.resolve(null);
        const financePromise = hasPermission(userPermissions, 'view_finance_module') ? getFinanceDashboardData().catch(() => null) : Promise.resolve(null);

        const [
          tasks, requests, sStatus, approvals, 
          aData, oData, gData, pData, dData, eData, aiRes, sData, fData
        ] = await Promise.all([
          personalTasksPromise, personalRequestsPromise, standupPromise, approvalQueuePromise,
          adminPromise, opsPromise, growthPromise, productPromise, designPromise, 
          engPromise, aiPromise, securityPromise, financePromise
        ]);

        setEmployeeData({ tasks: tasks || [], requests: requests || [], approvals: approvals || [] });
        setStandupData(sStatus);
        setAdminData(aData);
        setOpsData(oData);
        setGrowthData(gData);
        setProductData(pData);
        setDesignData(dData);
        setEngData(eData);
        setAiData(aiRes);
        setSecurityData(sData);
        setFinanceData(fData);
      } catch (err) {
        console.error('Error fetching unified dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUnifiedDashboardData();
  }, [role]);

  // Handler for creating an SOP directly from Operations Widget
  const handleCreateSOP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sopTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const newSop = await createSOP({ title: sopTitle.trim(), category: 'Operations' });
      setOpsData((prev: any) => ({ ...prev, sops: [newSop, ...(prev?.sops || [])] }));
      setSopTitle('');
      toast.success('SOP created successfully!');
    } catch (e) {
      toast.error('Failed to create SOP');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for logging intern hours directly from Intern Widget
  const handleLogInternHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await logInternHours({ track_type: 'Project', duration_hours: internHours, description: internDesc });
      toast.success(`Logged ${internHours} hours successfully!`);
      setInternDesc('');
    } catch (e) {
      toast.error('Failed to log intern hours');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[65vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 animate-pulse flex items-center justify-center">
            <Sparkles className="text-white animate-spin" size={24} />
          </div>
          <span className="text-sm font-semibold text-slate-600">Loading unified dashboard...</span>
        </div>
      </div>
    );
  }

  // Pre-calculated personal metrics
  const activeTasks = employeeData.tasks.filter(t => t.status !== 'DONE').length;
  const pendingRequests = employeeData.requests.filter(r => r.status === 'Pending' || r.status === 'Active').length;
  const pendingApprovals = employeeData.approvals.length;

  // PieChart Task Status Workload Data
  const tasksList = employeeData.tasks || [];
  const statusCounts = tasksList.reduce((acc: Record<string, number>, t: any) => {
    const status = t.status || 'TODO';
    const key = status === 'TODO' || status === 'To Do' ? 'To Do' :
                status === 'IN_PROGRESS' || status === 'In Progress' ? 'In Progress' :
                status === 'IN_REVIEW' || status === 'Review' ? 'Review' : 'Done';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const taskChartData = [
    { name: 'To Do', value: statusCounts['To Do'] || 0, color: '#64748B' },
    { name: 'In Progress', value: statusCounts['In Progress'] || 0, color: '#4F46E5' },
    { name: 'Review', value: statusCounts['Review'] || 0, color: '#F59E0B' },
    { name: 'Done', value: statusCounts['Done'] || 0, color: '#10B981' },
  ].filter(item => item.value > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-16">
      
      {/* Onboarding Checklist (for new joiners) */}
      <OnboardingDashboard />

      {/* ── 1. UNIFIED HERO HEADER ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-indigo-300 border border-white/15 backdrop-blur-md uppercase tracking-wider">
                {role || 'Employee'}
              </span>
              {user?.department && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-slate-300 border border-white/10">
                  {user.department}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-slate-300/80 mt-1.5 text-sm font-medium">
              Here is your real-time unified dashboard & agenda.
            </p>
          </div>

          {/* Quick Stat Bubbles in Hero */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/15 text-center min-w-[95px]">
              <p className="text-2xl font-black text-white">{activeTasks}</p>
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mt-0.5">My Tasks</p>
            </div>

            {/* Standup Status Bubble */}
            <Link
              to="/attendance/standups"
              className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/15 text-center min-w-[95px] hover:bg-white/20 transition-all block cursor-pointer"
            >
              <p className={`text-base font-black ${
                standupData?.submission?.status === 'SUBMITTED' ? 'text-emerald-300' :
                standupData?.submission?.status === 'LATE' ? 'text-amber-300' :
                standupData?.isLocked ? 'text-rose-400' :
                standupData?.missedCount && standupData.missedCount > 0 ? 'text-rose-300' : 'text-sky-300'
              }`}>
                {standupData?.submission?.status === 'SUBMITTED' ? '✓ Submitted' :
                 standupData?.submission?.status === 'LATE' ? '⏳ Late' :
                 standupData?.isLocked ? '🔒 Locked' :
                 standupData?.missedCount && standupData.missedCount > 0 ? `${standupData.missedCount} Missed` : '⏰ Pending'}
              </p>
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider mt-0.5">Standup</p>
            </Link>

            {hasPermission(userPermissions, 'view_team_queue') && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/15 text-center min-w-[95px]">
                <p className="text-2xl font-black text-amber-300">{pendingApprovals}</p>
                <p className="text-[10px] font-bold text-amber-200 uppercase tracking-wider mt-0.5">Approvals</p>
              </div>
            )}

            {adminData?.totalUsers !== undefined && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/15 text-center min-w-[95px]">
                <p className="text-2xl font-black text-emerald-300">{adminData.totalUsers}</p>
                <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider mt-0.5">Headcount</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. QUICK ACTIONS TOOLBAR ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {hasPermission(userPermissions, 'view_employee_workspace') && (
          <Link to="/attendance/standups" className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${
                standupData?.submission ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <Users size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">Daily Standup</h4>
                <p className="text-[11px] text-slate-400 truncate">
                  {standupData?.submission ? '✓ Logged for today' : 'Due by 10:30 AM'}
                </p>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        )}

        {hasPermission(userPermissions, 'view_employee_workspace') && (
          <Link to="/attendance/check-in" className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <CheckCircle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-emerald-600 transition-colors">Daily Check-In</h4>
                <p className="text-[11px] text-slate-400">Record attendance</p>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        )}

        {hasPermission(userPermissions, 'view_employee_workspace') && (
          <Link to="/tasks" className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <FolderKanban size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">Tasks Board</h4>
                <p className="text-[11px] text-slate-400">View active sprint</p>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        )}

        {hasPermission(userPermissions, 'view_team_queue') && (
          <Link to="/requests/queue" className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <CheckCircle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-amber-600 transition-colors">Approval Queue</h4>
                <p className="text-[11px] text-slate-400">{pendingApprovals} requests pending</p>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        )}

        {hasPermission(userPermissions, ['view_hr_module', 'manage_users']) && (
          <Link to="/users" className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <UserPlus size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-sky-600 transition-colors">User Directory</h4>
                <p className="text-[11px] text-slate-400">Manage employees</p>
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        )}
      </div>

      {/* ── STANDUP PROTOCOL & TODAY'S STATUS WIDGET ─────────────────────── */}
      <div className="p-6 rounded-3xl border border-indigo-900/40 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Standup Protocol
              </span>
              {standupData?.isLocked ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <Lock size={12} /> Account Locked
                </span>
              ) : standupData?.submission ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {standupData.submission.status === 'LATE' ? 'Submitted (Late)' : 'Submitted On-Time'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                  <Clock size={12} /> Action Required
                </span>
              )}
            </div>

            <h3 className="text-lg md:text-xl font-extrabold text-white flex items-center gap-2">
              <Users className="text-indigo-400" size={22} />
              Daily Standup Status
            </h3>

            {standupData?.submission ? (
              <div className="text-xs text-slate-300 space-y-1 max-w-2xl">
                <p className="line-clamp-2">
                  <strong className="text-white">Logged Work:</strong> {standupData.submission.workToday || 'Work summary recorded'}
                </p>
                {standupData.submission.hasBlockers && (
                  <p className="text-amber-300 font-semibold flex items-center gap-1">
                    <AlertTriangle size={13} /> Blocker reported: {standupData.submission.blockers}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                Daily standups keep leadership aligned. Today's deadline is{' '}
                <strong className="text-amber-300">{standupData?.policy.submissionDeadline || '10:30 AM'}</strong> (+{standupData?.policy.gracePeriodMins || 30}m grace period).
              </p>
            )}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="primary"
              onClick={() => navigate('/attendance/standups')}
              className="px-5 py-2.5 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 flex items-center gap-2 cursor-pointer"
            >
              {standupData?.submission ? (
                <>
                  <Eye size={15} /> Open Standups Hub
                </>
              ) : (
                <>
                  <Send size={15} /> Submit Standup Now
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 3. DYNAMIC KPI CARDS GRID ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI: Active Tasks */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <FolderKanban size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-400">Personal</span>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">My Active Tasks</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{activeTasks}</h3>
        </div>

        {/* KPI: Pending Requests */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock size={20} />
            </div>
            <span className="text-xs font-semibold text-slate-400">Status</span>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Leaves / Requests</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{pendingRequests}</h3>
        </div>

        {/* KPI: System Users (Admin/HR/Execs) */}
        {adminData?.totalUsers !== undefined && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Users size={20} />
              </div>
              <TrendingUp size={16} className="text-emerald-500" />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Headcount</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{adminData.totalUsers}</h3>
          </div>
        )}

        {/* KPI: Active Projects */}
        {adminData?.activeProjects !== undefined && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Activity size={20} />
              </div>
              <span className="text-xs font-semibold text-emerald-600">Active</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Projects</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{adminData.activeProjects}</h3>
          </div>
        )}

        {/* KPI: System Health */}
        {adminData?.systemHealth !== undefined && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
                <Zap size={20} />
              </div>
              <span className="text-xs font-bold text-emerald-600">Optimal</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Health</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{adminData.systemHealth}</h3>
          </div>
        )}

        {/* KPI: Growth Leads (Growth Lead / CEO / Sales) */}
        {growthData && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <Target size={20} />
              </div>
              <span className="text-xs font-semibold text-rose-600">CRM</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Leads</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{growthData.leads?.length || 0}</h3>
          </div>
        )}

        {/* KPI: Finance Quotations */}
        {financeData && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <DollarSign size={20} />
              </div>
              <span className="text-xs font-semibold text-emerald-600">Quotations</span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Quotations</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{financeData.quotations?.length || 0}</h3>
          </div>
        )}
      </div>

      {/* ── 4. DYNAMIC ANALYTICS & CONTENT GRID ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* COLUMN 1: CHARTS & WORKLOAD */}
        <div className="space-y-6">

          {/* Admin / HR Attendance Trend Chart */}
          {adminData?.attendanceTrend && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Daily Attendance Trend</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Active employee check-ins over the last 7 days</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full text-xs font-semibold text-emerald-700 border border-emerald-100">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Real-time
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={adminData.attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#FFF', borderRadius: '12px', borderColor: '#E2E8F0' }} />
                    <Area type="monotone" dataKey="count" name="Checked In" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAttendance)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Department Distribution (Admin / HR) */}
          {adminData?.departmentData && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-5">Department Headcount Distribution</h3>
              <div className="space-y-4">
                {adminData.departmentData.map((dept: any) => (
                  <div key={dept.name}>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-700">{dept.name}</span>
                      <span className="text-slate-500">{dept.employees} members</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${adminData.totalUsers ? (dept.employees / adminData.totalUsers) * 100 : 0}%`, 
                          backgroundColor: dept.color || '#6366F1' 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Task Workload PieChart */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-6">
              <BarChart3 className="text-indigo-500" size={18} /> My Workload Status
            </h3>
            {tasksList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium">
                No active tasks assigned to you right now.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                <div className="w-[170px] h-[170px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={taskChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                        {taskChartData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} tasks`, 'Count']} contentStyle={{ borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1 max-w-[200px] w-full">
                  {taskChartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="text-slate-900 font-bold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upcoming Tasks List */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FolderKanban className="text-indigo-500" size={18} /> Upcoming Tasks
              </h3>
              <Link to="/tasks" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View All</Link>
            </div>
            
            {employeeData.tasks.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">No pending tasks.</div>
            ) : (
              <div className="space-y-2.5">
                {employeeData.tasks.filter(t => t.status !== 'DONE').slice(0, 4).map((task) => (
                  <div key={task.id} className="p-3.5 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all cursor-pointer" onClick={() => navigate('/tasks')}>
                    <h4 className="font-bold text-sm text-slate-800 truncate">{task.title}</h4>
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{task.status.replace('_', ' ')}</span>
                      <span className={`px-2 py-0.5 rounded-md ${task.priority === 'HIGH' || task.priority === 'URGENT' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* COLUMN 2: DOMAIN MODULES & QUEUES */}
        <div className="space-y-6">

          {/* Approval Queue Widget for Managers / HR / Admin */}
          {hasPermission(userPermissions, 'view_team_queue') && (
            <div className="bg-gradient-to-br from-indigo-50/60 to-white rounded-3xl border border-indigo-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle className="text-emerald-500" size={18} /> Team Approval Queue
                </h3>
                <Link to="/requests/queue" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Review Queue</Link>
              </div>

              {pendingApprovals === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs font-medium">Your team approval queue is clear!</div>
              ) : (
                <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-black text-indigo-700">{pendingApprovals}</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Requests</p>
                  </div>
                  <Button variant="primary" onClick={() => navigate('/requests/queue')}>Review Now</Button>
                </div>
              )}
            </div>
          )}

          {/* Operations Lead Module */}
          {hasPermission(userPermissions, 'view_ops_module') && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="text-indigo-500" size={18} /> Operations & SOPs Hub
                </h3>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">Ops Lead</span>
              </div>

              <form onSubmit={handleCreateSOP} className="flex gap-2">
                <input 
                  type="text" 
                  className="novynth-input flex-1 text-xs"
                  placeholder="New Standard Operating Procedure (SOP) title..."
                  value={sopTitle}
                  onChange={e => setSopTitle(e.target.value)}
                />
                <Button type="submit" disabled={isSubmitting || !sopTitle.trim()} className="text-xs px-3 py-1.5">
                  <Plus size={14} /> SOP
                </Button>
              </form>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent SOPs</p>
                {(opsData?.sops || []).slice(0, 3).map((sop: any) => (
                  <div key={sop.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 truncate">{sop.title}</span>
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-white px-2 py-0.5 rounded border">{sop.ref_number || 'SOP-01'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Growth Lead Module */}
          {hasPermission(userPermissions, 'view_growth_module') && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Target className="text-rose-500" size={18} /> Growth & Lead Pipeline
                </h3>
                <Link to="/crm" className="text-xs font-bold text-indigo-600">Open CRM</Link>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                  <p className="text-lg font-black text-rose-700">{growthData?.stageCounts?.New || 0}</p>
                  <p className="text-[10px] font-bold text-rose-600 uppercase">New Leads</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-lg font-black text-amber-700">{growthData?.stageCounts?.['Meeting Scheduled'] || 0}</p>
                  <p className="text-[10px] font-bold text-amber-600 uppercase">Meetings</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-lg font-black text-emerald-700">{growthData?.stageCounts?.Won || 0}</p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Closed Won</p>
                </div>
              </div>
            </div>
          )}

          {/* Product Lead Module */}
          {hasPermission(userPermissions, 'view_product_module') && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="text-violet-500" size={18} /> Product Roadmap Status
              </h3>
              {(productData?.roadmap || []).slice(0, 3).map((item: any) => (
                <div key={item.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{item.title}</p>
                    <p className="text-[10px] text-slate-400">{item.quarter}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-bold text-[10px]">{item.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Security Lead Module */}
          {hasPermission(userPermissions, 'view_security_module') && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="text-emerald-500" size={18} /> Security & Audit Feed
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Compliant</span>
              </div>
              {(securityData?.vulnerabilities || []).map((vuln: any) => (
                <div key={vuln.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{vuln.title}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[10px]">{vuln.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Intern Module */}
          {hasPermission(userPermissions, 'view_intern_module') && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="text-sky-500" size={18} /> Intern Learning & Hours Tracker
              </h3>
              <form onSubmit={handleLogInternHours} className="space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    min="1" 
                    max="12" 
                    className="novynth-input w-24 text-xs"
                    value={internHours}
                    onChange={e => setInternHours(Number(e.target.value))}
                  />
                  <input 
                    type="text" 
                    placeholder="Description of work / lecture..." 
                    className="novynth-input flex-1 text-xs"
                    value={internDesc}
                    onChange={e => setInternDesc(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full text-xs py-2">
                  Log Training Hours
                </Button>
              </form>
            </div>
          )}

          {/* Recent Activity Feed */}
          {adminData?.recentActivity && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4">Recent System Activity</h3>
              <div className="space-y-3">
                {adminData.recentActivity.slice(0, 4).map((act: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center border text-slate-400 shrink-0">
                      <FileText size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{act.action}</p>
                      <p className="text-[10px] text-slate-400">{act.user} · {act.time || 'Recently'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Birthdays */}
          {adminData?.upcomingBirthdays && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-pink-500" /> Birthdays This Month
              </h3>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {adminData.upcomingBirthdays.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No employee birthdays this month.</p>
                ) : (
                  adminData.upcomingBirthdays.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-pink-50 text-pink-600 font-bold text-xs flex items-center justify-center border border-pink-100 shrink-0">
                          {b.name ? b.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{b.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{b.department}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full shrink-0">
                        {b.daysRemaining === 0 ? 'Today! 🎂' : b.daysRemaining > 0 ? `${b.daysRemaining}d left` : b.dateFormatted || 'This Month'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
