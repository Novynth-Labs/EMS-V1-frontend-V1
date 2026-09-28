import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore, normalizeRole } from '../../store/authStore';
import {
  getTodayStandupStatus,
  submitDailyStandup,
  getMyStandupsHistory,
  excuseStandup,
  getTeamStandups,
  getDepartmentStandups,
  getStandupAnalytics,
  getStandupPolicy,
  updateStandupPolicy,
  grantStandupExemption,
  unlockStandupUser,
  triggerStandupComplianceCheck,
  type TodayStandupStatusResponse,
  type MyStandupsResponse,
  type TeamStandupsResponse,
  type DepartmentStandupsResponse,
  type ExecutiveAnalyticsResponse,
  type StandupPolicy,
  type StandupHistoryRecord
} from '../../api/standups.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { exportToCSV } from '../../utils/export';
import { getInitials } from '../../utils/initials';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldAlert,
  Users,
  Building2,
  BarChart3,
  Sliders,
  Sparkles,
  Lock,
  Unlock,
  AlertCircle,
  Check,
  X,
  RefreshCw,
  Eye,
  Info,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  Download,
  Flame,
  Zap,
  Send,
  Copy,
  LayoutGrid,
  Table as TableIcon,
  ShieldCheck,
  FileText,
  UserCheck,
  TrendingUp,
  Award,
  ArrowRight
} from 'lucide-react';
import { toast } from '../../utils/toast';

const QUICK_TAGS = [
  '⚡ Bug Fixes',
  '🚀 Feature Rollout',
  '🤝 Client Sync',
  '🔍 Code Review',
  '📄 Documentation',
  '🧪 Testing & QA',
  '⚙️ DevOps / Infra'
];

const SUPPORT_TEMPLATES = [
  'Architecture & Design Signoff',
  'Credentials / Access Permissions',
  'Inter-team Dependency Coordination',
  'Code Review / PR Blocker',
  'Client Requirement Clarification'
];

export const StandupsTrackerPage: React.FC = () => {
  const { user, role } = useAuthStore();
  const canonicalRole = normalizeRole(role || user?.role || '');

  const isExecutive = ['SUPER_ADMIN', 'CEO', 'CTO', 'HR'].includes(canonicalRole);
  const isDeptHead = ['DEPT_HEAD', 'SUPER_ADMIN', 'CEO', 'CTO', 'HR'].includes(canonicalRole);
  const isTeamLeadOrHigher = ['TEAM_LEAD', 'DEPT_HEAD', 'SUPER_ADMIN', 'CEO', 'CTO', 'HR'].includes(canonicalRole);

  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'department' | 'executive'>('my');
  const [loading, setLoading] = useState(true);

  // Tab 1: My Standup State
  const [todayData, setTodayData] = useState<TodayStandupStatusResponse | null>(null);
  const [historyData, setHistoryData] = useState<MyStandupsResponse | null>(null);
  const [formValues, setFormValues] = useState({
    workToday: '',
    hasBlockers: false,
    blockers: '',
    nextPlan: '',
    needSupport: false,
    supportDetails: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [excuseModal, setExcuseModal] = useState({ open: false, date: '', reason: '' });
  const [detailModal, setDetailModal] = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [policyInfoModal, setPolicyInfoModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<string>('ALL');
  const [historyViewMode, setHistoryViewMode] = useState<'timeline' | 'table'>('timeline');

  // Tab 2: Team Standups State
  const [teamDate, setTeamDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [teamData, setTeamData] = useState<TeamStandupsResponse | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [teamSearch, setTeamSearch] = useState<string>('');
  const [teamViewMode, setTeamViewMode] = useState<'grid' | 'table'>('grid');
  const [teamLoading, setTeamLoading] = useState(false);
  const [exemptModal, setExemptModal] = useState<{ open: boolean; userId: string; name: string; date: string; reason: string }>({
    open: false,
    userId: '',
    name: '',
    date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  // Tab 3: Department Standups State
  const [deptDate, setDeptDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deptData, setDeptData] = useState<DepartmentStandupsResponse | null>(null);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const [deptSubTeamFilter, setDeptSubTeamFilter] = useState('ALL');

  // Tab 4: Executive Analytics & Policy State
  const [analyticsDate, setAnalyticsDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [analyticsData, setAnalyticsData] = useState<ExecutiveAnalyticsResponse | null>(null);
  const [policyData, setPolicyData] = useState<StandupPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [triggeringCheck, setTriggeringCheck] = useState(false);
  const [unlockModal, setUnlockModal] = useState<{ open: boolean; userId: string; name: string; reason: string }>({
    open: false,
    userId: '',
    name: '',
    reason: ''
  });

  // Local draft key
  const draftStorageKey = `ems_standup_draft_${user?.id || 'anon'}_${new Date().toISOString().split('T')[0]}`;

  // Load Saved Draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved && !todayData?.submission) {
        const parsed = JSON.parse(saved);
        setFormValues(prev => ({
          ...prev,
          workToday: parsed.workToday || prev.workToday,
          hasBlockers: parsed.hasBlockers ?? prev.hasBlockers,
          blockers: parsed.blockers || prev.blockers,
          nextPlan: parsed.nextPlan || prev.nextPlan,
          needSupport: parsed.needSupport ?? prev.needSupport,
          supportDetails: parsed.supportDetails || prev.supportDetails
        }));
      }
    } catch {
      // Ignore local storage parse error
    }
  }, [draftStorageKey, todayData?.submission]);

  // Auto-Save Draft
  const updateFormField = (field: string, value: any) => {
    setFormValues(prev => {
      const next = { ...prev, [field]: value };
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Fetch initial data
  const loadMyData = async () => {
    try {
      const [today, history] = await Promise.all([
        getTodayStandupStatus(),
        getMyStandupsHistory()
      ]);
      setTodayData(today);
      setHistoryData(history);
      if (today?.submission) {
        setFormValues({
          workToday: today.submission.workToday || '',
          hasBlockers: today.submission.hasBlockers || false,
          blockers: today.submission.blockers || '',
          nextPlan: today.submission.nextPlan || '',
          needSupport: today.submission.needSupport || false,
          supportDetails: today.submission.supportDetails || ''
        });
      }
    } catch (err: any) {
      console.error('Failed to load standup data:', err);
    }
  };

  const loadTeamData = async (dateStr?: string) => {
    setTeamLoading(true);
    try {
      const res = await getTeamStandups(dateStr || teamDate);
      setTeamData(res);
    } catch (err) {
      console.error('Failed to load team standups:', err);
    } finally {
      setTeamLoading(false);
    }
  };

  const loadDeptData = async (dateStr?: string) => {
    setDeptLoading(true);
    try {
      const res = await getDepartmentStandups(undefined, dateStr || deptDate);
      setDeptData(res);
    } catch (err) {
      console.error('Failed to load department standups:', err);
    } finally {
      setDeptLoading(false);
    }
  };

  const loadExecutiveData = async (dateStr?: string) => {
    setPolicyLoading(true);
    try {
      const [analytics, policy] = await Promise.all([
        getStandupAnalytics(dateStr || analyticsDate),
        getStandupPolicy()
      ]);
      setAnalyticsData(analytics);
      setPolicyData(policy);
    } catch (err) {
      console.error('Failed to load executive analytics:', err);
    } finally {
      setPolicyLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadMyData();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeTab === 'team' && isTeamLeadOrHigher) {
      loadTeamData(teamDate);
    } else if (activeTab === 'department' && isDeptHead) {
      loadDeptData(deptDate);
    } else if (activeTab === 'executive' && isExecutive) {
      loadExecutiveData(analyticsDate);
    }
  }, [activeTab]);

  // Handlers for My Standup
  const handleSubmitDailyStandup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formValues.workToday.trim()) {
      toast.error('Please describe what you worked on.');
      return;
    }
    if (!formValues.nextPlan.trim()) {
      toast.error('Please describe your next plan.');
      return;
    }
    if (formValues.hasBlockers && !formValues.blockers.trim()) {
      toast.error('Please describe your blockers or toggle "No blockers".');
      return;
    }
    if (formValues.needSupport && !formValues.supportDetails.trim()) {
      toast.error('Please specify what support you need from your team lead.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitDailyStandup({
        workToday: formValues.workToday,
        hasBlockers: formValues.hasBlockers,
        blockers: formValues.hasBlockers ? formValues.blockers : undefined,
        nextPlan: formValues.nextPlan,
        needSupport: formValues.needSupport,
        supportDetails: formValues.needSupport ? formValues.supportDetails : undefined
      });
      toast.success(res.message || 'Daily standup submitted successfully!');
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        // Ignore
      }
      await loadMyData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to submit daily standup');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcuseSubmit = async () => {
    if (!excuseModal.date || !excuseModal.reason.trim()) {
      toast.error('Please provide a valid date and reason.');
      return;
    }
    setSubmitting(true);
    try {
      await excuseStandup(excuseModal.date, excuseModal.reason);
      toast.success('Absence intimation recorded successfully!');
      setExcuseModal({ open: false, date: '', reason: '' });
      await loadMyData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to record absence intimation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrantExemption = async () => {
    if (!exemptModal.reason.trim()) {
      toast.error('Please provide a reason for exemption.');
      return;
    }
    try {
      await grantStandupExemption(exemptModal.userId, exemptModal.date, exemptModal.reason);
      toast.success(`Exemption granted to ${exemptModal.name}`);
      setExemptModal({ open: false, userId: '', name: '', date: '', reason: '' });
      loadTeamData(teamDate);
      if (activeTab === 'department') loadDeptData(deptDate);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to grant exemption');
    }
  };

  const handleSavePolicy = async () => {
    if (!policyData) return;
    setSavingPolicy(true);
    try {
      const updated = await updateStandupPolicy(policyData);
      setPolicyData(updated);
      toast.success('Standup policy settings saved successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleUnlockUser = async () => {
    try {
      await unlockStandupUser(unlockModal.userId, unlockModal.reason);
      toast.success(`Account unlocked for ${unlockModal.name}`);
      setUnlockModal({ open: false, userId: '', name: '', reason: '' });
      loadExecutiveData(analyticsDate);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to unlock user');
    }
  };

  const handleTriggerComplianceCheck = async () => {
    setTriggeringCheck(true);
    try {
      const res = await triggerStandupComplianceCheck();
      toast.success(res.message || 'Compliance check completed successfully');
      await loadExecutiveData(analyticsDate);
    } catch (err: any) {
      toast.error('Failed to trigger compliance check');
    } finally {
      setTriggeringCheck(false);
    }
  };

  // Quick Copy Yesterday's Next Plan
  const handleCopyYesterdayPlan = () => {
    if (!historyData?.history || historyData.history.length === 0) {
      toast.error('No previous standup record found to copy from.');
      return;
    }
    const previous = historyData.history.find(h => h.nextPlan && h.nextPlan.trim().length > 0);
    if (!previous || !previous.nextPlan) {
      toast.error('No previous next-plan found.');
      return;
    }
    updateFormField('workToday', previous.nextPlan);
    toast.success('Copied your previous plan into today\'s work update!');
  };

  // Export My Standup History to CSV
  const handleExportMyHistory = () => {
    if (!historyData?.history || historyData.history.length === 0) {
      toast.error('No standup history available to export.');
      return;
    }
    const rows = historyData.history.map(h => ({
      Date: h.date,
      Status: h.status,
      Work_Completed: h.workToday || '',
      Blockers: h.blockers || 'None',
      Next_Plan: h.nextPlan || '',
      Support_Requested: h.supportDetails || 'None',
      Submitted_At: h.submittedAt || ''
    }));
    exportToCSV(rows, `My_Standup_History_${new Date().toISOString().split('T')[0]}`);
    toast.success('Standup history exported successfully!');
  };

  // Export Team Standup Report
  const handleExportTeamReport = () => {
    if (!teamData?.members || teamData.members.length === 0) {
      toast.error('No team standup data to export.');
      return;
    }
    const rows = teamData.members.map(m => ({
      Date: teamDate,
      Employee_Name: m.name,
      Employee_ID: m.empId,
      Status: m.status,
      Work_Completed: m.submission?.workToday || '',
      Has_Blockers: m.submission?.hasBlockers ? 'Yes' : 'No',
      Blocker_Details: m.submission?.blockers || 'None',
      Next_Plan: m.submission?.nextPlan || '',
      Need_Support: m.submission?.needSupport ? 'Yes' : 'No',
      Support_Details: m.submission?.supportDetails || 'None',
      Account_Locked: m.isLocked ? 'Yes' : 'No'
    }));
    exportToCSV(rows, `Team_Standup_Report_${teamDate}`);
    toast.success('Team standup report exported successfully!');
  };

  // Status Badge UI
  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'SUBMITTED':
      case 'ATTENDED':
      case 'PRESENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
            <CheckCircle2 size={13} className="text-emerald-500" /> Submitted
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-xs">
            <Clock size={13} className="text-amber-500" /> Late
          </span>
        );
      case 'MISSED':
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shadow-xs">
            <XCircle size={13} className="text-rose-500" /> Missed
          </span>
        );
      case 'EXEMPTED':
      case 'EXCUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20 shadow-xs">
            <Info size={13} className="text-sky-500" /> Exempted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20 shadow-xs">
            <Clock size={13} className="text-slate-400" /> Pending
          </span>
        );
    }
  };

  // Date Shift Helpers
  const shiftDate = (current: string, days: number, setter: (d: string) => void, reloadFn?: (d: string) => void) => {
    const d = new Date(current);
    d.setDate(d.getDate() + days);
    const newStr = d.toISOString().split('T')[0];
    setter(newStr);
    if (reloadFn) reloadFn(newStr);
  };

  // Filtered History Records
  const filteredHistory = useMemo(() => {
    if (!historyData?.history) return [];
    return historyData.history.filter(h => {
      const matchFilter = historyFilter === 'ALL' || h.status === historyFilter;
      const q = historySearch.toLowerCase().trim();
      if (!q) return matchFilter;
      const inWork = (h.workToday || '').toLowerCase().includes(q);
      const inBlockers = (h.blockers || '').toLowerCase().includes(q);
      const inPlan = (h.nextPlan || '').toLowerCase().includes(q);
      const inDate = (h.date || '').includes(q);
      return matchFilter && (inWork || inBlockers || inPlan || inDate);
    });
  }, [historyData?.history, historyFilter, historySearch]);

  // Filtered Team Members
  const filteredTeamMembers = useMemo(() => {
    if (!teamData?.members) return [];
    return teamData.members.filter(m => {
      const matchStatus = teamFilter === 'ALL' || m.status === teamFilter;
      const q = teamSearch.toLowerCase().trim();
      if (!q) return matchStatus;
      const inName = m.name.toLowerCase().includes(q);
      const inEmpId = m.empId.toLowerCase().includes(q);
      const inSubTeam = (m.subTeam || '').toLowerCase().includes(q);
      return matchStatus && (inName || inEmpId || inSubTeam);
    });
  }, [teamData?.members, teamFilter, teamSearch]);

  // Filtered Dept Members
  const filteredDeptMembers = useMemo(() => {
    if (!deptData?.members) return [];
    return deptData.members.filter(m => {
      const matchSubTeam = deptSubTeamFilter === 'ALL' || (m.subTeam || 'General') === deptSubTeamFilter;
      const q = deptSearch.toLowerCase().trim();
      if (!q) return matchSubTeam;
      const inName = m.name.toLowerCase().includes(q);
      const inEmpId = m.empId.toLowerCase().includes(q);
      const inManager = (m.managerName || '').toLowerCase().includes(q);
      return matchSubTeam && (inName || inEmpId || inManager);
    });
  }, [deptData?.members, deptSubTeamFilter, deptSearch]);

  // Distinct Sub-Teams in Department
  const distinctSubTeams = useMemo(() => {
    if (!deptData?.members) return [];
    const set = new Set<string>();
    deptData.members.forEach(m => {
      if (m.subTeam) set.add(m.subTeam);
      else set.add('General');
    });
    return Array.from(set);
  }, [deptData?.members]);

  const isSubmittedToday = todayData?.submission && (todayData.submission.status === 'SUBMITTED' || todayData.submission.status === 'LATE');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 animate-spin flex items-center justify-center p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px]" />
          </div>
          <Zap className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={24} />
        </div>
        <div className="text-center">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Syncing Standup Protocol</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">Retrieving daily logs, compliance matrix, and blocker feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* ========================================================================= */}
      {/* 1. HERO HEADER WITH LIVE STATUS & PROTOCOL META                            */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-xl border border-indigo-900/40">
        {/* Glow ambient decoration */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-medium backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Standup Protocol Active • {todayData?.policy.timezone || 'Asia/Kolkata'}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Users className="text-indigo-400" size={30} />
              Daily Standups & Compliance Hub
            </h1>

            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Synchronize daily achievements, eliminate team impediments, track blocker escalations, and monitor compliance adherence in real-time.
            </p>
          </div>

          {/* Quick Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setPolicyInfoModal(true)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold backdrop-blur-md border border-white/10 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <ShieldCheck size={15} className="text-indigo-300" />
              Policy Rules
            </button>

            <button
              onClick={() => setExcuseModal({ open: true, date: todayData?.date || new Date().toISOString().split('T')[0], reason: '' })}
              className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-xs font-semibold backdrop-blur-md border border-indigo-400/30 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Calendar size={15} className="text-sky-300" />
              Intimate Absence
            </button>

            <button
              onClick={handleExportMyHistory}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold backdrop-blur-md border border-white/10 transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Download size={15} className="text-emerald-300" />
              Export
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="relative z-10 mt-8 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'my'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/40'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Zap size={16} />
            <span>My Daily Standup</span>
            {isSubmittedToday ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          {isTeamLeadOrHigher && (
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'team'
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/40'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Users size={16} />
              <span>Team Pulse</span>
              {teamData?.summary && teamData.summary.blockersCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                  {teamData.summary.blockersCount} Blockers
                </span>
              )}
            </button>
          )}

          {isDeptHead && (
            <button
              onClick={() => setActiveTab('department')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'department'
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/40'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Building2 size={16} />
              <span>Department Matrix</span>
            </button>
          )}

          {isExecutive && (
            <button
              onClick={() => setActiveTab('executive')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'executive'
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/40'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BarChart3 size={16} />
              <span>Executive & Policy</span>
              {analyticsData?.overview && analyticsData.overview.lockedAccountsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                  {analyticsData.overview.lockedAccountsCount} Locked
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY DAILY STANDUP                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {/* Account Locked or Warning Banner */}
          {todayData?.isLocked && (
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-start gap-4 shadow-sm animate-scale-in">
              <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-xl text-rose-600 shrink-0">
                <ShieldAlert size={26} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-rose-950 dark:text-rose-100">
                  Account Locked due to Standup Compliance Threshold
                </h4>
                <p className="text-xs md:text-sm text-rose-800 dark:text-rose-300 leading-relaxed">
                  You have exceeded the maximum limit of unexcused missed daily standups ({todayData.policy.maxMissedThreshold} missed updates). Under company policy, submission and regular privileges are temporarily suspended. Please connect with your Team Lead or HR Administrator to initiate an account review and unlock.
                </p>
              </div>
            </div>
          )}

          {todayData && todayData.missedCount > 0 && !todayData.isLocked && (
            <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-300/80 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
                    Compliance Warning: {todayData.missedCount} Missed Update{todayData.missedCount > 1 ? 's' : ''} on Record
                  </h4>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    Reaching {todayData.policy.maxMissedThreshold} missed updates will automatically lock your account.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100"
                onClick={() => setExcuseModal({ open: true, date: todayData.date, reason: '' })}
              >
                Intimate Absence
              </Button>
            </div>
          )}

          {/* Quick Timing, Progress & Stats Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 1. Date */}
            <div className="novynth-card p-4 flex items-center gap-3.5 border border-[var(--color-border)]">
              <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <Calendar size={22} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Session Date</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">
                  {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* 2. Deadline & Timing */}
            <div className="novynth-card p-4 flex items-center gap-3.5 border border-[var(--color-border)]">
              <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Daily Deadline</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">
                    {todayData?.policy.submissionDeadline || '10:30'}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    +{todayData?.policy.gracePeriodMins || 30}m Grace
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Today's Status */}
            <div className="novynth-card p-4 flex items-center gap-3.5 border border-[var(--color-border)]">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Today's Submission</p>
                <div className="mt-1">
                  {getStatusBadge(todayData?.submission?.status || (todayData?.isWorkingDay ? 'PENDING' : 'EXEMPTED'))}
                </div>
              </div>
            </div>

            {/* 4. Compliance Score */}
            <div className="novynth-card p-4 flex items-center gap-3.5 border border-[var(--color-border)] bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
              <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Flame size={22} className="text-indigo-500" />
              </div>
              <div className="w-full">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">Compliance Rate</p>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {historyData?.stats.complianceRate ?? 100}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${historyData?.stats.complianceRate ?? 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Standup Form / Submitted View Card */}
          <div className="novynth-card p-6 md:p-8 border border-[var(--color-border)] shadow-sm relative overflow-hidden">
            {/* Header */}
            <div className="border-b border-[var(--color-border)] pb-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                    Daily Standup Submission
                  </h3>
                  {isSubmittedToday && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60">
                      <Check size={12} /> Logged for Today
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Structured daily update shared directly with your Team Lead and Department Head.
                </p>
              </div>

              {!isSubmittedToday && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyYesterdayPlan}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    <Copy size={13} />
                    Copy Yesterday's Plan
                  </button>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitDailyStandup} className="space-y-6">
              {/* Question 1: Work Done */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[11px] flex items-center justify-center font-bold">1</span>
                    What did you work on today? <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    {formValues.workToday.length} characters
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Summarize key features coded, bugs investigated, PR reviews, client syncs, or operational deliverables.
                </p>

                {/* Quick Tag Pills */}
                {!isSubmittedToday && !todayData?.isLocked && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-[var(--color-text-secondary)] font-medium mr-1">Quick tags:</span>
                    {QUICK_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = formValues.workToday ? `${formValues.workToday}, ${tag}` : tag;
                          updateFormField('workToday', current);
                        }}
                        className="px-2 py-0.8 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  rows={3}
                  disabled={isSubmittedToday || todayData?.isLocked}
                  className="novynth-input w-full font-sans leading-relaxed"
                  placeholder="e.g., Completed API endpoint refactoring, fixed responsive layout for mobile client, tested auth tokens..."
                  value={formValues.workToday}
                  onChange={(e) => updateFormField('workToday', e.target.value)}
                />
              </div>

              {/* Question 2: Blockers / Issues */}
              <div className="space-y-3 p-4 rounded-xl border border-[var(--color-border)] bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-bold">2</span>
                    Any blockers or impediments? <span className="text-rose-500">*</span>
                  </label>

                  {/* Segmented Switch */}
                  <div className="inline-flex rounded-lg p-1 bg-slate-200 dark:bg-slate-700 text-xs font-semibold">
                    <button
                      type="button"
                      disabled={isSubmittedToday || todayData?.isLocked}
                      onClick={() => {
                        updateFormField('hasBlockers', false);
                        updateFormField('blockers', '');
                      }}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        !formValues.hasBlockers
                          ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      ✓ No Blockers
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittedToday || todayData?.isLocked}
                      onClick={() => updateFormField('hasBlockers', true)}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        formValues.hasBlockers
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      ⚠️ I have a blocker
                    </button>
                  </div>
                </div>

                {formValues.hasBlockers ? (
                  <div className="space-y-2 pt-2 animate-fade-in">
                    <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                      Detail what is delaying you (e.g., waiting on 3rd party API key, environment downtime, backend schema mismatch):
                    </p>
                    <textarea
                      rows={2}
                      disabled={isSubmittedToday || todayData?.isLocked}
                      className="novynth-input w-full border-amber-300 dark:border-amber-600 focus:border-amber-500 bg-white dark:bg-slate-900"
                      placeholder="Describe the exact blocker and who you are blocked by..."
                      value={formValues.blockers}
                      onChange={(e) => updateFormField('blockers', e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 border border-emerald-200 dark:border-emerald-800/40">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    <span>Clear runway — no active technical or organizational blockers reported.</span>
                  </div>
                )}
              </div>

              {/* Question 3: Next Plan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[11px] flex items-center justify-center font-bold">3</span>
                    What is your next plan? <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    {formValues.nextPlan.length} characters
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Outline the objectives, tasks, or milestones you will focus on next.
                </p>
                <textarea
                  rows={2}
                  disabled={isSubmittedToday || todayData?.isLocked}
                  className="novynth-input w-full font-sans leading-relaxed"
                  placeholder="e.g., Integrate WebSocket notifications, prepare staging build release, execute integration tests..."
                  value={formValues.nextPlan}
                  onChange={(e) => updateFormField('nextPlan', e.target.value)}
                />
              </div>

              {/* Question 4: Manager Support */}
              <div className="space-y-3 p-4 rounded-xl border border-[var(--color-border)] bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-[11px] flex items-center justify-center font-bold">4</span>
                    Do you require assistance from your Team Lead / Manager?
                  </label>

                  {/* Segmented Switch */}
                  <div className="inline-flex rounded-lg p-1 bg-slate-200 dark:bg-slate-700 text-xs font-semibold">
                    <button
                      type="button"
                      disabled={isSubmittedToday || todayData?.isLocked}
                      onClick={() => {
                        updateFormField('needSupport', false);
                        updateFormField('supportDetails', '');
                      }}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        !formValues.needSupport
                          ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      No Support Needed
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittedToday || todayData?.isLocked}
                      onClick={() => updateFormField('needSupport', true)}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        formValues.needSupport
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      🤝 Request Support
                    </button>
                  </div>
                </div>

                {formValues.needSupport && (
                  <div className="space-y-2 pt-2 animate-fade-in">
                    {/* Helper Templates */}
                    {!isSubmittedToday && !todayData?.isLocked && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">Templates:</span>
                        {SUPPORT_TEMPLATES.map(tmpl => (
                          <button
                            key={tmpl}
                            type="button"
                            onClick={() => updateFormField('supportDetails', tmpl)}
                            className="px-2 py-0.8 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-[11px] border border-purple-200 dark:border-purple-800 transition-all cursor-pointer"
                          >
                            {tmpl}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      rows={2}
                      disabled={isSubmittedToday || todayData?.isLocked}
                      className="novynth-input w-full bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-700"
                      placeholder="Specify what help or guidance you require from leadership..."
                      value={formValues.supportDetails}
                      onChange={(e) => updateFormField('supportDetails', e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Submit Action Bar */}
              {!isSubmittedToday && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-500" />
                    Updates are recorded instantly in the daily compliance audit log.
                  </p>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={submitting || todayData?.isLocked}
                    className="w-full sm:w-auto px-8 py-2.5 font-bold shadow-md shadow-indigo-500/20 text-sm flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Submitting Standup...
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Submit Daily Standup
                      </>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* Compliance Statistics & Standup History Explorer */}
          <div className="space-y-4">
            {/* Header & Metric Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <BarChart3 size={20} className="text-indigo-500" />
                  My Standup History & Compliance
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Chronological record of your previous submissions, blocker tracking, and attendance audit.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Mode Toggle */}
                <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-[var(--color-border)]">
                  <button
                    onClick={() => setHistoryViewMode('timeline')}
                    className={`p-1.5 rounded-md transition-all ${
                      historyViewMode === 'timeline' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-500'
                    }`}
                    title="Timeline View"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    onClick={() => setHistoryViewMode('table')}
                    className={`p-1.5 rounded-md transition-all ${
                      historyViewMode === 'table' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-500'
                    }`}
                    title="Table View"
                  >
                    <TableIcon size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Metric Chips */}
            {historyData && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="novynth-card p-3.5 text-center border border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">Total Updates</p>
                  <p className="text-xl font-extrabold text-[var(--color-text-primary)] mt-1">{historyData.stats.totalSubmissions}</p>
                </div>
                <div className="novynth-card p-3.5 text-center bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">On-Time</p>
                  <p className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">{historyData.stats.submitted}</p>
                </div>
                <div className="novynth-card p-3.5 text-center bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Late</p>
                  <p className="text-xl font-extrabold text-amber-800 dark:text-amber-300 mt-1">{historyData.stats.late}</p>
                </div>
                <div className="novynth-card p-3.5 text-center bg-rose-500/10 border border-rose-500/20">
                  <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">Missed</p>
                  <p className="text-xl font-extrabold text-rose-800 dark:text-rose-300 mt-1">{historyData.stats.missed}</p>
                </div>
                <div className="novynth-card p-3.5 text-center bg-sky-500/10 border border-sky-500/20">
                  <p className="text-xs text-sky-700 dark:text-sky-400 font-medium">Exempted</p>
                  <p className="text-xl font-extrabold text-sky-800 dark:text-sky-300 mt-1">{historyData.stats.exempted}</p>
                </div>
              </div>
            )}

            {/* Filter & Search Bar */}
            <div className="novynth-card p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 border border-[var(--color-border)]">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search work, blockers, date..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="novynth-input py-1.5 pl-9 pr-3 text-xs w-full"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {['ALL', 'SUBMITTED', 'LATE', 'MISSED', 'EXEMPTED'].map(st => (
                  <button
                    key={st}
                    onClick={() => setHistoryFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      historyFilter === st
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode 1: Timeline Card View */}
            {historyViewMode === 'timeline' ? (
              <div className="space-y-3">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map(record => (
                    <div
                      key={record.id}
                      className="novynth-card p-5 border border-[var(--color-border)] hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-xs group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                            <Calendar size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-[var(--color-text-primary)]">
                              {new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {record.submittedAt && (
                              <span className="text-[11px] text-[var(--color-text-secondary)] ml-2">
                                • Logged at {new Date(record.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(record.status)}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => setDetailModal({ open: true, record })}
                          >
                            <Eye size={13} className="mr-1" /> View Full
                          </Button>
                        </div>
                      </div>

                      {/* Content Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3.5 text-xs">
                        <div>
                          <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Work Done</p>
                          <p className="text-[var(--color-text-primary)] line-clamp-2 leading-relaxed">
                            {record.workToday || (record.status === 'EXEMPTED' ? record.exemptionReason || 'Authorized Exemption' : '-')}
                          </p>
                        </div>

                        <div>
                          <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Blockers</p>
                          {record.hasBlockers ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800 text-[11px] font-medium">
                              <AlertCircle size={13} className="text-amber-500 shrink-0" />
                              <span className="truncate">{record.blockers}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">None reported</span>
                          )}
                        </div>

                        <div>
                          <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Next Plan</p>
                          <p className="text-[var(--color-text-secondary)] line-clamp-2">
                            {record.nextPlan || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="novynth-card p-10 text-center border border-[var(--color-border)]">
                    <p className="text-sm text-[var(--color-text-secondary)]">No matching standup history found.</p>
                  </div>
                )}
              </div>
            ) : (
              /* View Mode 2: Table View */
              <div className="novynth-card overflow-hidden border border-[var(--color-border)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-xs">
                      <tr>
                        <th className="px-5 py-3.5">Date</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5">Work Completed</th>
                        <th className="px-5 py-3.5">Blockers</th>
                        <th className="px-5 py-3.5">Next Plan</th>
                        <th className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] text-xs">
                      {filteredHistory.length > 0 ? (
                        filteredHistory.map(record => (
                          <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-4 font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                              {new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              {getStatusBadge(record.status)}
                            </td>
                            <td className="px-5 py-4 max-w-xs truncate">
                              {record.workToday || (record.status === 'EXEMPTED' ? record.exemptionReason || 'Exempted' : '-')}
                            </td>
                            <td className="px-5 py-4 max-w-xs truncate">
                              {record.hasBlockers ? (
                                <span className="text-amber-700 dark:text-amber-400 font-semibold">{record.blockers}</span>
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </td>
                            <td className="px-5 py-4 max-w-xs truncate">
                              {record.nextPlan || '-'}
                            </td>
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetailModal({ open: true, record })}
                              >
                                <Eye size={13} className="mr-1" /> View
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                            No standup history found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM PULSE (Team Lead / Manager View)                              */}
      {/* ========================================================================= */}
      {activeTab === 'team' && isTeamLeadOrHigher && (
        <div className="space-y-6">
          {/* Controls & Date Navigator */}
          <div className="novynth-card p-4.5 border border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => shiftDate(teamDate, -1, setTeamDate, loadTeamData)}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>

              <input
                type="date"
                value={teamDate}
                onChange={(e) => {
                  setTeamDate(e.target.value);
                  loadTeamData(e.target.value);
                }}
                className="novynth-input py-1.5 px-3 text-xs w-auto font-semibold"
              />

              <button
                onClick={() => shiftDate(teamDate, 1, setTeamDate, loadTeamData)}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>

              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setTeamDate(today);
                  loadTeamData(today);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-200 text-[var(--color-text-primary)] cursor-pointer"
              >
                Today
              </button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadTeamData(teamDate)}
                disabled={teamLoading}
                className="ml-1"
              >
                <RefreshCw size={14} className={teamLoading ? 'animate-spin' : ''} />
              </Button>
            </div>

            {/* View Switch & Export */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportTeamReport}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} /> Export Team CSV
              </button>

              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-[var(--color-border)]">
                <button
                  onClick={() => setTeamViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${
                    teamViewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-500'
                  }`}
                  title="Grid Cards"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setTeamViewMode('table')}
                  className={`p-1.5 rounded-md transition-all ${
                    teamViewMode === 'table' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-500'
                  }`}
                  title="Data Table"
                >
                  <TableIcon size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Team Summary KPI Cards */}
          {teamData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              <div className="novynth-card p-3.5 text-center border border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Team Size</p>
                <p className="text-xl font-extrabold text-[var(--color-text-primary)] mt-0.5">{teamData.summary.total}</p>
              </div>
              <div className="novynth-card p-3.5 text-center bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Submitted</p>
                <p className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-0.5">{teamData.summary.submitted}</p>
              </div>
              <div className="novynth-card p-3.5 text-center bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Late</p>
                <p className="text-xl font-extrabold text-amber-800 dark:text-amber-300 mt-0.5">{teamData.summary.late}</p>
              </div>
              <div className="novynth-card p-3.5 text-center bg-rose-500/10 border border-rose-500/20">
                <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">Missed</p>
                <p className="text-xl font-extrabold text-rose-800 dark:text-rose-300 mt-0.5">{teamData.summary.missed}</p>
              </div>
              <div className="novynth-card p-3.5 text-center bg-slate-500/10 border border-slate-500/20">
                <p className="text-xs text-slate-700 dark:text-slate-400 font-medium">Pending</p>
                <p className="text-xl font-extrabold text-slate-800 dark:text-slate-300 mt-0.5">{teamData.summary.pending}</p>
              </div>
              <div className="novynth-card p-3.5 text-center bg-sky-500/10 border border-sky-500/20">
                <p className="text-xs text-sky-700 dark:text-sky-400 font-medium">Exempted</p>
                <p className="text-xl font-extrabold text-sky-800 dark:text-sky-300 mt-0.5">{teamData.summary.exempted}</p>
              </div>
              <div className="novynth-card p-3.5 text-center bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">Compliance</p>
                <p className="text-xl font-extrabold text-indigo-800 dark:text-indigo-300 mt-0.5">{teamData.summary.complianceRate}%</p>
              </div>
            </div>
          )}

          {/* Active Blockers Radar (Prominent Warning) */}
          {teamData && teamData.summary.blockersCount > 0 && (
            <div className="novynth-card p-5 border border-amber-300 dark:border-amber-700 bg-amber-500/5 space-y-3">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" />
                Active Team Impediments & Blockers ({teamData.summary.blockersCount})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {teamData.members
                  .filter(m => m.submission?.hasBlockers)
                  .map(member => (
                    <div
                      key={member.id}
                      className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 shadow-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[var(--color-text-primary)]">
                          {member.name} <span className="font-normal text-slate-500">({member.empId})</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          Blocker Flagged
                        </span>
                      </div>
                      <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                        {member.submission?.blockers}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Team Search & Filter Strip */}
          <div className="novynth-card p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 border border-[var(--color-border)]">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search member name or ID..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="novynth-input py-1.5 pl-9 pr-3 text-xs w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {['ALL', 'SUBMITTED', 'LATE', 'MISSED', 'PENDING', 'EXEMPTED'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setTeamFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    teamFilter === filter
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode 1: Grid Cards */}
          {teamViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeamMembers.length > 0 ? (
                filteredTeamMembers.map(member => (
                  <div
                    key={member.id}
                    className="novynth-card p-5 border border-[var(--color-border)] hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between space-y-4 shadow-xs"
                  >
                    <div>
                      {/* Member Info & Badge */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                            {getInitials(member.name)}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-[var(--color-text-primary)] flex items-center gap-1.5">
                              {member.name}
                              {member.isLocked && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  <Lock size={10} /> Locked
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {member.empId} {member.subTeam ? `• ${member.subTeam}` : ''}
                            </p>
                          </div>
                        </div>

                        {getStatusBadge(member.status)}
                      </div>

                      {/* Content Preview */}
                      <div className="pt-3 space-y-2.5 text-xs">
                        {member.submission?.workToday ? (
                          <div>
                            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-0.5">Today's Work</p>
                            <p className="text-[var(--color-text-primary)] line-clamp-3 leading-relaxed">
                              {member.submission.workToday}
                            </p>
                          </div>
                        ) : (
                          <p className="text-slate-400 italic py-2">No standup submitted for this date.</p>
                        )}

                        {member.submission?.hasBlockers && (
                          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                            <span className="font-bold block text-[11px] flex items-center gap-1">
                              <AlertCircle size={12} className="text-amber-500" /> Blocker:
                            </span>
                            <p className="text-[11px] mt-0.5 line-clamp-2">{member.submission.blockers}</p>
                          </div>
                        )}

                        {member.submission?.needSupport && (
                          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200">
                            <span className="font-bold block text-[11px] flex items-center gap-1">
                              <HelpCircle size={12} className="text-purple-500" /> Support Requested:
                            </span>
                            <p className="text-[11px] mt-0.5 line-clamp-2">{member.submission.supportDetails}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                      {member.submission && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setDetailModal({ open: true, record: { ...member.submission, date: teamDate, name: member.name } })}
                        >
                          <Eye size={13} className="mr-1" /> View Full
                        </Button>
                      )}
                      {member.status !== 'EXEMPTED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => setExemptModal({
                            open: true,
                            userId: member.id,
                            name: member.name,
                            date: teamDate,
                            reason: ''
                          })}
                        >
                          Exempt
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 novynth-card p-12 text-center border border-[var(--color-border)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">No team members match the selected filter.</p>
                </div>
              )}
            </div>
          ) : (
            /* View Mode 2: Table */
            <div className="novynth-card overflow-hidden border border-[var(--color-border)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-xs">
                    <tr>
                      <th className="px-5 py-3.5">Employee</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Work Update</th>
                      <th className="px-5 py-3.5">Blockers / Support</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] text-xs">
                    {filteredTeamMembers.length > 0 ? (
                      filteredTeamMembers.map(member => (
                        <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-bold text-[var(--color-text-primary)]">{member.name}</div>
                            <div className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1.5 mt-0.5">
                              <span>{member.empId}</span>
                              {member.isLocked && (
                                <span className="text-rose-600 font-bold">• Locked</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {getStatusBadge(member.status)}
                          </td>
                          <td className="px-5 py-4 max-w-sm truncate">
                            {member.submission?.workToday || <span className="text-slate-400 italic">No update</span>}
                          </td>
                          <td className="px-5 py-4 max-w-xs">
                            {member.submission?.hasBlockers ? (
                              <span className="text-amber-700 dark:text-amber-400 font-bold block truncate">⚠️ {member.submission.blockers}</span>
                            ) : null}
                            {member.submission?.needSupport ? (
                              <span className="text-purple-700 dark:text-purple-400 font-medium block truncate">🤝 {member.submission.supportDetails}</span>
                            ) : null}
                            {!member.submission?.hasBlockers && !member.submission?.needSupport && (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                            {member.submission && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetailModal({ open: true, record: { ...member.submission, date: teamDate, name: member.name } })}
                              >
                                View
                              </Button>
                            )}
                            {member.status !== 'EXEMPTED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExemptModal({
                                  open: true,
                                  userId: member.id,
                                  name: member.name,
                                  date: teamDate,
                                  reason: ''
                                })}
                              >
                                Exempt
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                          No team members found for this date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEPARTMENT OVERVIEW (Dept Head View)                                */}
      {/* ========================================================================= */}
      {activeTab === 'department' && isDeptHead && (
        <div className="space-y-6">
          {/* Header & Controls Bar */}
          <div className="novynth-card p-4.5 border border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl">
                <Building2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Department Compliance Overview
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Aggregated compliance metrics across all departmental sub-teams.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={deptDate}
                onChange={(e) => {
                  setDeptDate(e.target.value);
                  loadDeptData(e.target.value);
                }}
                className="novynth-input py-1.5 px-3 text-xs w-auto font-semibold"
              />
              <Button variant="ghost" size="sm" onClick={() => loadDeptData(deptDate)}>
                <RefreshCw size={14} className={deptLoading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>

          {/* Dept Stats */}
          {deptData && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="novynth-card p-4 text-center border border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Department Total</p>
                <p className="text-2xl font-extrabold text-[var(--color-text-primary)] mt-1">{deptData.summary.total}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Submitted</p>
                <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">{deptData.summary.submitted}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Late</p>
                <p className="text-2xl font-extrabold text-amber-800 dark:text-amber-300 mt-1">{deptData.summary.late}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-rose-500/10 border border-rose-500/20">
                <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">Missed</p>
                <p className="text-2xl font-extrabold text-rose-800 dark:text-rose-300 mt-1">{deptData.summary.missed}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-sky-500/10 border border-sky-500/20">
                <p className="text-xs text-sky-700 dark:text-sky-400 font-medium">Exempted</p>
                <p className="text-2xl font-extrabold text-sky-800 dark:text-sky-300 mt-1">{deptData.summary.exempted}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">Compliance Rate</p>
                <p className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-300 mt-1">{deptData.summary.complianceRate}%</p>
              </div>
            </div>
          )}

          {/* Department Blockers Radar */}
          {deptData && deptData.blockers.length > 0 && (
            <div className="novynth-card p-5 border border-amber-300 dark:border-amber-700 bg-amber-500/5">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-600" />
                Department Blockers Requiring Attention ({deptData.blockers.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {deptData.blockers.map((b, idx) => (
                  <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 text-xs shadow-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--color-text-primary)]">{b.name} ({b.empId})</span>
                      <span className="text-[var(--color-text-secondary)]">Lead: {b.managerName || 'None'}</span>
                    </div>
                    <p className="text-amber-900 dark:text-amber-200">{b.blockers}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Department Search & Sub-team Filter */}
          <div className="novynth-card p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 border border-[var(--color-border)]">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search department staff or ID..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="novynth-input py-1.5 pl-9 pr-3 text-xs w-full"
              />
            </div>

            {/* Sub-team pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[var(--color-text-secondary)] font-medium mr-1">Sub-team:</span>
              <button
                onClick={() => setDeptSubTeamFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  deptSubTeamFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                All
              </button>
              {distinctSubTeams.map(st => (
                <button
                  key={st}
                  onClick={() => setDeptSubTeamFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    deptSubTeamFilter === st ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Members Table */}
          <div className="novynth-card overflow-hidden border border-[var(--color-border)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-xs">
                  <tr>
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Sub-Team</th>
                    <th className="px-5 py-3.5">Team Lead</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Work Done</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {filteredDeptMembers.length > 0 ? (
                    filteredDeptMembers.map(member => (
                      <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-4">
                          <div className="font-bold text-[var(--color-text-primary)]">{member.name}</div>
                          <div className="text-[11px] text-[var(--color-text-secondary)]">{member.empId}</div>
                        </td>
                        <td className="px-5 py-4">{member.subTeam || 'General'}</td>
                        <td className="px-5 py-4">{member.managerName || '-'}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{getStatusBadge(member.status)}</td>
                        <td className="px-5 py-4 max-w-xs truncate">
                          {member.submission?.workToday || '-'}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExemptModal({
                              open: true,
                              userId: member.id,
                              name: member.name,
                              date: deptDate,
                              reason: ''
                            })}
                          >
                            Exempt
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                        No employees found in this department.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: EXECUTIVE ANALYTICS & POLICY CONFIGURATION                         */}
      {/* ========================================================================= */}
      {activeTab === 'executive' && isExecutive && (
        <div className="space-y-6">
          {/* Executive Overview Header */}
          <div className="novynth-card p-5 border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={22} />
                Organization-Wide Standup Intelligence
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Real-time compliance analytics, departmental matrix, automated compliance audit trigger, and account policy controls.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={analyticsDate}
                onChange={(e) => {
                  setAnalyticsDate(e.target.value);
                  loadExecutiveData(e.target.value);
                }}
                className="novynth-input py-1.5 px-3 text-xs font-semibold"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleTriggerComplianceCheck}
                disabled={triggeringCheck}
                className="shadow-sm font-semibold text-xs"
              >
                {triggeringCheck ? (
                  <>
                    <RefreshCw size={14} className="animate-spin mr-1" /> Auditing...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="mr-1" /> Run Compliance Check
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* High-Level Numbers */}
          {analyticsData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="novynth-card p-4 text-center border border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Total Employees</p>
                <p className="text-2xl font-extrabold text-[var(--color-text-primary)] mt-1">{analyticsData.overview.totalEmployees}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Submitted</p>
                <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">{analyticsData.overview.submitted}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Late</p>
                <p className="text-2xl font-extrabold text-amber-800 dark:text-amber-300 mt-1">{analyticsData.overview.late}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-rose-500/10 border border-rose-500/20">
                <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">Missed</p>
                <p className="text-2xl font-extrabold text-rose-800 dark:text-rose-300 mt-1">{analyticsData.overview.missed}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">Organization Compliance</p>
                <p className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-300 mt-1">{analyticsData.overview.complianceRate}%</p>
              </div>
              <div className="novynth-card p-4 text-center bg-rose-500/10 border border-rose-500/20">
                <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">Locked Accounts</p>
                <p className="text-2xl font-extrabold text-rose-800 dark:text-rose-300 mt-1">{analyticsData.overview.lockedAccountsCount}</p>
              </div>
            </div>
          )}

          {/* Department-wise Breakdown Matrix */}
          <div className="novynth-card p-5 border border-[var(--color-border)] space-y-4">
            <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <Building2 size={18} className="text-indigo-600" />
              Department-Wise Compliance Matrix
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-xs">
                  <tr>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Workforce</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Late</th>
                    <th className="px-4 py-3">Missed</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Exempted</th>
                    <th className="px-4 py-3">Active Blockers</th>
                    <th className="px-4 py-3">Compliance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {analyticsData?.departments && analyticsData.departments.length > 0 ? (
                    analyticsData.departments.map(dept => (
                      <tr key={dept.departmentId || dept.departmentName} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5 font-bold text-[var(--color-text-primary)]">{dept.departmentName}</td>
                        <td className="px-4 py-3.5">{dept.totalEmployees}</td>
                        <td className="px-4 py-3.5 text-emerald-700 dark:text-emerald-400 font-semibold">{dept.submitted}</td>
                        <td className="px-4 py-3.5 text-amber-700 dark:text-amber-400">{dept.late}</td>
                        <td className="px-4 py-3.5 text-rose-700 dark:text-rose-400 font-semibold">{dept.missed}</td>
                        <td className="px-4 py-3.5 text-slate-500">{dept.pending}</td>
                        <td className="px-4 py-3.5 text-sky-700 dark:text-sky-400">{dept.exempted}</td>
                        <td className="px-4 py-3.5">
                          {dept.blockersCount > 0 ? (
                            <span className="text-amber-800 font-bold bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded text-[11px]">
                              {dept.blockersCount} Blockers
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-indigo-600">{dept.complianceRate}%</span>
                            <div className="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full"
                                style={{ width: `${dept.complianceRate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                        No department analytics available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Violators & At-Risk Employees */}
          {analyticsData && analyticsData.violators && analyticsData.violators.length > 0 && (
            <div className="novynth-card p-5 border border-rose-300 dark:border-rose-800 bg-rose-500/5 space-y-4">
              <h4 className="text-sm font-bold text-rose-950 dark:text-rose-200 flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-600" />
                Compliance Violations & Locked Accounts ({analyticsData.violators.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                  <thead className="bg-rose-100/50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold border-b border-rose-200 text-xs">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Team Lead</th>
                      <th className="px-4 py-3">Missed Updates</th>
                      <th className="px-4 py-3">Account Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 text-xs">
                    {analyticsData.violators.map(v => (
                      <tr key={v.id} className="hover:bg-rose-50/40">
                        <td className="px-4 py-3 font-bold text-rose-950 dark:text-rose-100">
                          {v.name} <span className="text-[11px] font-normal text-rose-700">({v.empId})</span>
                        </td>
                        <td className="px-4 py-3">{v.department || '-'}</td>
                        <td className="px-4 py-3">{v.manager || '-'}</td>
                        <td className="px-4 py-3 font-bold text-rose-700">{v.missedCount} Missed</td>
                        <td className="px-4 py-3">
                          {v.isLocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900">
                              <Lock size={11} /> Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              <AlertTriangle size={11} /> At-Risk
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {v.isLocked && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => setUnlockModal({ open: true, userId: v.id, name: v.name, reason: '' })}
                            >
                              <Unlock size={12} className="mr-1" /> Unlock Account
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Standup Policy Settings Form */}
          {policyData && (
            <div className="novynth-card p-6 border border-[var(--color-border)] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
                <div>
                  <h4 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <Sliders size={20} className="text-indigo-600" />
                    Standup Policy & Compliance Configuration
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Configure daily timing windows, grace periods, auto-lock rules, and working day settings.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSavePolicy}
                  disabled={savingPolicy}
                  className="font-bold shadow-xs"
                >
                  {savingPolicy ? 'Saving Changes...' : 'Save Policy Changes'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    Daily Start Time
                  </label>
                  <input
                    type="time"
                    className="novynth-input w-full font-semibold"
                    value={policyData.startTime}
                    onChange={(e) => setPolicyData({ ...policyData, startTime: e.target.value })}
                  />
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    When employees can begin submitting standup updates.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    Daily Reminder Time
                  </label>
                  <input
                    type="time"
                    className="novynth-input w-full font-semibold"
                    value={policyData.reminderTime}
                    onChange={(e) => setPolicyData({ ...policyData, reminderTime: e.target.value })}
                  />
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    Automated push & email reminder notification.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    Submission Deadline
                  </label>
                  <input
                    type="time"
                    className="novynth-input w-full font-semibold"
                    value={policyData.submissionDeadline}
                    onChange={(e) => setPolicyData({ ...policyData, submissionDeadline: e.target.value })}
                  />
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    Submissions after this time are flagged as LATE.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    Grace Period (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    className="novynth-input w-full font-semibold"
                    value={policyData.gracePeriodMins}
                    onChange={(e) => setPolicyData({ ...policyData, gracePeriodMins: parseInt(e.target.value, 10) || 0 })}
                  />
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    Window after deadline before standup is marked MISSED.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    Max Missed Threshold (Strikes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="novynth-input w-full font-semibold"
                    value={policyData.maxMissedThreshold}
                    onChange={(e) => setPolicyData({ ...policyData, maxMissedThreshold: parseInt(e.target.value, 10) || 3 })}
                  />
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    Number of missed standups before automatic account lock.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    Time Zone
                  </label>
                  <input
                    type="text"
                    className="novynth-input w-full font-semibold"
                    value={policyData.timezone}
                    onChange={(e) => setPolicyData({ ...policyData, timezone: e.target.value })}
                  />
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    System evaluation timezone (e.g. Asia/Kolkata).
                  </p>
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={policyData.enabled}
                    onChange={(e) => setPolicyData({ ...policyData, enabled: e.target.checked })}
                    className="rounded text-indigo-600 mt-1 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-[var(--color-text-primary)] block">
                      Enable Daily Standup Protocol
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      Enable active enforcement and daily submission prompts across the organization.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={policyData.accountLockEnabled}
                    onChange={(e) => setPolicyData({ ...policyData, accountLockEnabled: e.target.checked })}
                    className="rounded text-rose-600 mt-1 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-[var(--color-text-primary)] block">
                      Automatic Account Lockout Enforcement
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      Automatically suspend account login after an employee reaches maximum missed threshold.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* 1. Intimate Absence Modal (Employee) */}
      <Modal
        isOpen={excuseModal.open}
        onClose={() => setExcuseModal({ ...excuseModal, open: false })}
        title="Intimate Absence / Pre-Excuse Standup"
      >
        <div className="p-3 space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Record an advance absence intimation with a justified reason (e.g., approved casual leave, on-site client travel, hospital visit).
          </p>

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">Standup Date</label>
            <input
              type="date"
              className="novynth-input w-full font-semibold"
              value={excuseModal.date}
              onChange={(e) => setExcuseModal({ ...excuseModal, date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">Reason for Absence</label>
            <textarea
              rows={3}
              className="novynth-input w-full text-xs"
              placeholder="e.g., Authorized annual leave approved on portal / Travelling for client deployment..."
              value={excuseModal.reason}
              onChange={(e) => setExcuseModal({ ...excuseModal, reason: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setExcuseModal({ ...excuseModal, open: false })}>
              Cancel
            </Button>
            <Button variant="primary" disabled={submitting || !excuseModal.date || !excuseModal.reason.trim()} onClick={handleExcuseSubmit}>
              {submitting ? 'Submitting...' : 'Submit Intimation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. Standup Details Modal (View Answers) */}
      <Modal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, record: null })}
        title={`Standup Record • ${detailModal.record?.name ? `${detailModal.record.name} (` : ''}${detailModal.record?.date || ''}${detailModal.record?.name ? ')' : ''}`}
      >
        {detailModal.record && (
          <div className="p-3 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Submission Status:</span>
              {getStatusBadge(detailModal.record.status)}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--color-border)] space-y-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)] block">1. Work Completed:</span>
              <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {detailModal.record.workToday || '-'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--color-border)] space-y-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)] block">2. Blockers / Impediments:</span>
              <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {detailModal.record.blockers || (detailModal.record.hasBlockers ? 'Yes' : 'No active blockers.')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--color-border)] space-y-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)] block">3. Next Plan:</span>
              <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {detailModal.record.nextPlan || '-'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--color-border)] space-y-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)] block">4. Lead Assistance Requested:</span>
              <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {detailModal.record.needSupport ? detailModal.record.supportDetails || 'Yes' : 'None requested.'}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setDetailModal({ open: false, record: null })}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. Grant Exemption Modal (Manager/Lead) */}
      <Modal
        isOpen={exemptModal.open}
        onClose={() => setExemptModal({ ...exemptModal, open: false })}
        title={`Grant Standup Exemption • ${exemptModal.name}`}
      >
        <div className="p-3 space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Authorize an official standup exemption for this team member. The exemption will be recorded in the audit trail and prevent compliance strikes.
          </p>

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">Exemption Date</label>
            <input
              type="date"
              className="novynth-input w-full font-semibold"
              value={exemptModal.date}
              onChange={(e) => setExemptModal({ ...exemptModal, date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">Reason for Exemption</label>
            <textarea
              rows={3}
              className="novynth-input w-full text-xs"
              placeholder="e.g., Assigned to emergency deployment escalation / Approved bereavement leave..."
              value={exemptModal.reason}
              onChange={(e) => setExemptModal({ ...exemptModal, reason: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setExemptModal({ ...exemptModal, open: false })}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!exemptModal.reason.trim()} onClick={handleGrantExemption}>
              Grant Exemption
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Unlock Account Modal (Executive/Admin) */}
      <Modal
        isOpen={unlockModal.open}
        onClose={() => setUnlockModal({ ...unlockModal, open: false })}
        title={`Unlock Account • ${unlockModal.name}`}
      >
        <div className="p-3 space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Restores the employee's active login access and resets the failed standup strike counter. An administrative audit log will be generated.
          </p>

          <div>
            <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">Administrative Note / Resolution</label>
            <textarea
              rows={3}
              className="novynth-input w-full text-xs"
              placeholder="e.g., Compliance consultation conducted, employee acknowledged daily standup protocol..."
              value={unlockModal.reason}
              onChange={(e) => setUnlockModal({ ...unlockModal, reason: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setUnlockModal({ ...unlockModal, open: false })}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUnlockUser}>
              Confirm & Unlock
            </Button>
          </div>
        </div>
      </Modal>

      {/* 5. Policy Explainer Modal */}
      <Modal
        isOpen={policyInfoModal}
        onClose={() => setPolicyInfoModal(false)}
        title="Novynth Standup Policy & Compliance Guide"
      >
        <div className="p-3 space-y-4 text-xs text-[var(--color-text-secondary)] leading-relaxed">
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-900 dark:text-indigo-200">
            <h4 className="font-bold text-sm text-indigo-950 dark:text-indigo-100 mb-1 flex items-center gap-1.5">
              <Sparkles size={16} /> Daily Protocol Rules
            </h4>
            <p>
              Daily Standups are mandatory for all team members on active working days. Updates keep leadership aligned, prevent blockers from compounding, and safeguard team velocity.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold shrink-0">1</span>
              <div>
                <strong className="text-[var(--color-text-primary)]">On-Time Submissions:</strong>
                <p className="mt-0.5">Submitted between 09:00 AM and 10:30 AM are scored 100% compliant.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700 font-bold shrink-0">2</span>
              <div>
                <strong className="text-[var(--color-text-primary)]">Late Grace Window:</strong>
                <p className="mt-0.5">Submissions between 10:30 AM and 11:00 AM (+30m grace) are logged as LATE.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700 font-bold shrink-0">3</span>
              <div>
                <strong className="text-[var(--color-text-primary)]">Missed & Auto-Lockout:</strong>
                <p className="mt-0.5">Unexcused updates past grace period are scored MISSED. Reaching 3 strikes triggers automatic account lockout.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="p-1.5 rounded-lg bg-sky-100 text-sky-700 font-bold shrink-0">4</span>
              <div>
                <strong className="text-[var(--color-text-primary)]">Absence Intimation & Exemption:</strong>
                <p className="mt-0.5">Pre-intimate planned leave or obtain Team Lead exemption in advance to avoid strikes.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-[var(--color-border)]">
            <Button variant="primary" size="sm" onClick={() => setPolicyInfoModal(false)}>
              Understood
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
