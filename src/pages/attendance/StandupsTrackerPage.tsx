import React, { useEffect, useState } from 'react';
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
  type StandupPolicy
} from '../../api/standups.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
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
  Info
} from 'lucide-react';
import { toast } from '../../utils/toast';

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

  // Tab 2: Team Standups State
  const [teamDate, setTeamDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [teamData, setTeamData] = useState<TeamStandupsResponse | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
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

  // Tab 4: Executive Analytics & Policy State
  const [analyticsDate, setAnalyticsDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [analyticsData, setAnalyticsData] = useState<ExecutiveAnalyticsResponse | null>(null);
  const [policyData, setPolicyData] = useState<StandupPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [unlockModal, setUnlockModal] = useState<{ open: boolean; userId: string; name: string; reason: string }>({
    open: false,
    userId: '',
    name: '',
    reason: ''
  });

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
      console.error('Failed to load my standup data:', err);
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
  const handleSubmitDailyStandup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.workToday.trim()) {
      toast.error('Please describe what you worked on.');
      return;
    }
    if (!formValues.nextPlan.trim()) {
      toast.error('Please describe your next plan.');
      return;
    }
    if (formValues.hasBlockers && !formValues.blockers.trim()) {
      toast.error('Please describe your blockers or check "No blockers".');
      return;
    }
    if (formValues.needSupport && !formValues.supportDetails.trim()) {
      toast.error('Please describe what support you need from your manager.');
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

  // Handlers for Team / Exemption
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

  // Handlers for Policy & Unlock
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
    try {
      const res = await triggerStandupComplianceCheck();
      toast.success(res.message || 'Compliance check completed successfully');
      loadExecutiveData(analyticsDate);
    } catch (err: any) {
      toast.error('Failed to trigger compliance check');
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'SUBMITTED':
      case 'ATTENDED':
      case 'PRESENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" /> Submitted
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} className="text-amber-600" /> Late
          </span>
        );
      case 'MISSED':
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={12} className="text-rose-600" /> Missed
          </span>
        );
      case 'EXEMPTED':
      case 'EXCUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Info size={12} className="text-blue-600" /> Exempted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <Clock size={12} /> Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-primary)]"></div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-3">Loading Standups Module...</p>
      </div>
    );
  }

  const isSubmittedToday = todayData?.submission && (todayData.submission.status === 'SUBMITTED' || todayData.submission.status === 'LATE');

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Users className="text-[var(--color-primary)]" size={26} />
            Standups Module
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Daily updates, team blocker escalation, compliance tracking, and management analytics.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 bg-gray-100 dark:bg-gray-800/60 p-1.5 rounded-xl border border-[var(--color-border)]">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'my'
                ? 'bg-white dark:bg-gray-700 text-[var(--color-primary)] shadow-sm font-semibold'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            My Daily Standup
          </button>

          {isTeamLeadOrHigher && (
            <button
              onClick={() => setActiveTab('team')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'team'
                  ? 'bg-white dark:bg-gray-700 text-[var(--color-primary)] shadow-sm font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Team Standups
            </button>
          )}

          {isDeptHead && (
            <button
              onClick={() => setActiveTab('department')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'department'
                  ? 'bg-white dark:bg-gray-700 text-[var(--color-primary)] shadow-sm font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Department Overview
            </button>
          )}

          {isExecutive && (
            <button
              onClick={() => setActiveTab('executive')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'executive'
                  ? 'bg-white dark:bg-gray-700 text-[var(--color-primary)] shadow-sm font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Executive & Policy
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY DAILY STANDUP                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {/* Warning / Account Lock Banner */}
          {todayData?.isLocked && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 flex items-start gap-3">
              <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-semibold text-rose-900">Account Locked due to Missed Standup Policy</h4>
                <p className="text-sm mt-0.5">
                  You have exceeded the maximum threshold of unexcused missed daily standups. Please contact your Department Head or HR Administrator to review and reactivate your account.
                </p>
              </div>
            </div>
          )}

          {todayData && todayData.missedCount > 0 && !todayData.isLocked && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-semibold">Compliance Notice: {todayData.missedCount} Missed Standup(s) Recorded</h4>
                <p className="text-sm mt-0.5">
                  You currently have {todayData.missedCount} unexcused missed standup update(s). Under company compliance policy, reaching {todayData.policy.maxMissedThreshold} missed updates will automatically lock your account.
                </p>
              </div>
            </div>
          )}

          {/* Quick Timing & Status Bar */}
          <div className="novynth-card p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-gradient-to-r from-blue-50/50 via-white to-purple-50/50 dark:from-gray-800 dark:to-gray-900 border border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-xl">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Today's Date</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                  {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-xl">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Submission Deadline</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                  {todayData?.policy.submissionDeadline || '10:30'} AM
                  <span className="text-xs font-normal text-[var(--color-text-secondary)] ml-1">
                    (+{todayData?.policy.gracePeriodMins || 30}m grace)
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-xl">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Today's Status</p>
                <div className="mt-0.5">
                  {getStatusBadge(todayData?.submission?.status || (todayData?.isWorkingDay ? 'PENDING' : 'EXEMPTED'))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExcuseModal({ open: true, date: todayData?.date || '', reason: '' })}
              >
                Intimate Absence
              </Button>
            </div>
          </div>

          {/* Standup Form Section */}
          <div className="novynth-card p-6 border border-[var(--color-border)] shadow-sm">
            <div className="border-b border-[var(--color-border)] pb-4 mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  Daily Standup Update
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Standardized daily update for your Team Lead and Department Head.
                </p>
              </div>
              {isSubmittedToday && (
                <div className="text-right">
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                    <CheckCircle2 size={14} /> Submitted Successfully
                  </span>
                  {todayData?.submission?.submittedAt && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      Submitted at: {new Date(todayData.submission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitDailyStandup} className="space-y-6">
              {/* Question 1: Work Update */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
                  1. What did you work on? <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Describe the tasks, features, bugs, meetings, or other work you completed or are working on.
                </p>
                <textarea
                  rows={3}
                  disabled={isSubmittedToday || todayData?.isLocked}
                  className="novynth-input w-full"
                  placeholder="e.g. Completed Clearance Management API integration, fixed mobile layout responsiveness, reviewed PRs..."
                  value={formValues.workToday}
                  onChange={(e) => setFormValues({ ...formValues, workToday: e.target.value })}
                />
              </div>

              {/* Question 2: Problems / Blockers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
                    2. What problems or blockers are you facing? <span className="text-rose-500">*</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-[var(--color-text-primary)]">
                    <input
                      type="checkbox"
                      disabled={isSubmittedToday || todayData?.isLocked}
                      checked={!formValues.hasBlockers}
                      onChange={(e) => {
                        const noBlockers = e.target.checked;
                        setFormValues({
                          ...formValues,
                          hasBlockers: !noBlockers,
                          blockers: noBlockers ? '' : formValues.blockers
                        });
                      }}
                      className="rounded text-[var(--color-primary)] focus:ring-0"
                    />
                    ☑ No blockers
                  </label>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Describe any technical blocker, dependency on another team, client delay, or resource issue.
                </p>
                {formValues.hasBlockers ? (
                  <textarea
                    rows={2}
                    disabled={isSubmittedToday || todayData?.isLocked}
                    className="novynth-input w-full border-amber-300 focus:border-amber-500"
                    placeholder="Describe the blocker or dependency affecting your progress..."
                    value={formValues.blockers}
                    onChange={(e) => setFormValues({ ...formValues, blockers: e.target.value })}
                  />
                ) : (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg text-xs text-[var(--color-text-secondary)] flex items-center gap-2 border border-dashed border-[var(--color-border)]">
                    <CheckCircle2 size={14} className="text-emerald-500" /> No active blockers reported.
                  </div>
                )}
              </div>

              {/* Question 3: Next Plan */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
                  3. What is your next plan? <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Describe the tasks or goals you plan to complete next.
                </p>
                <textarea
                  rows={2}
                  disabled={isSubmittedToday || todayData?.isLocked}
                  className="novynth-input w-full"
                  placeholder="e.g. Integrate standup audit reports, run load tests, prepare release documentation..."
                  value={formValues.nextPlan}
                  onChange={(e) => setFormValues({ ...formValues, nextPlan: e.target.value })}
                />
              </div>

              {/* Question 4: Support Required */}
              <div className="space-y-3 p-4 bg-gray-50/60 dark:bg-gray-800/40 rounded-xl border border-[var(--color-border)]">
                <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
                  4. Do you need any support from your Manager / Team Lead?
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
                    <input
                      type="radio"
                      name="supportRadio"
                      disabled={isSubmittedToday || todayData?.isLocked}
                      checked={!formValues.needSupport}
                      onChange={() => setFormValues({ ...formValues, needSupport: false, supportDetails: '' })}
                    />
                    No
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
                    <input
                      type="radio"
                      name="supportRadio"
                      disabled={isSubmittedToday || todayData?.isLocked}
                      checked={formValues.needSupport}
                      onChange={() => setFormValues({ ...formValues, needSupport: true })}
                    />
                    Yes
                  </label>
                </div>

                {formValues.needSupport && (
                  <div className="pt-2 space-y-1">
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
                      What support do you need?
                    </label>
                    <textarea
                      rows={2}
                      disabled={isSubmittedToday || todayData?.isLocked}
                      className="novynth-input w-full bg-white dark:bg-gray-900"
                      placeholder="e.g. Need architecture review on auth token sync, requires design signoff..."
                      value={formValues.supportDetails}
                      onChange={(e) => setFormValues({ ...formValues, supportDetails: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Submit Action */}
              {!isSubmittedToday && (
                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={submitting || todayData?.isLocked}
                    className="px-6 py-2.5 font-semibold"
                  >
                    {submitting ? 'Submitting Daily Update...' : 'Submit Daily Update'}
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* Compliance Summary & Standup History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                My Standup History & Compliance
              </h3>
              {historyData && (
                <span className="text-sm font-semibold text-[var(--color-primary)]">
                  Compliance Rate: {historyData.stats.complianceRate}%
                </span>
              )}
            </div>

            {/* Metric Chips */}
            {historyData && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="novynth-card p-3.5 text-center">
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">Total Updates</p>
                  <p className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{historyData.stats.totalSubmissions}</p>
                </div>
                <div className="novynth-card p-3.5 text-center bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200">
                  <p className="text-xs text-emerald-700 font-medium">On-Time</p>
                  <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">{historyData.stats.submitted}</p>
                </div>
                <div className="novynth-card p-3.5 text-center bg-amber-50/40 dark:bg-amber-950/20 border-amber-200">
                  <p className="text-xs text-amber-700 font-medium">Late</p>
                  <p className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-0.5">{historyData.stats.late}</p>
                </div>
                <div className="novynth-card p-3.5 text-center bg-rose-50/40 dark:bg-rose-950/20 border-rose-200">
                  <p className="text-xs text-rose-700 font-medium">Missed</p>
                  <p className="text-xl font-bold text-rose-800 dark:text-rose-300 mt-0.5">{historyData.stats.missed}</p>
                </div>
                <div className="novynth-card p-3.5 text-center bg-blue-50/40 dark:bg-blue-950/20 border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">Exempted</p>
                  <p className="text-xl font-bold text-blue-800 dark:text-blue-300 mt-0.5">{historyData.stats.exempted}</p>
                </div>
              </div>
            )}

            {/* History Table */}
            <div className="novynth-card overflow-hidden border border-[var(--color-border)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold">
                    <tr>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Work Completed</th>
                      <th className="px-5 py-3.5">Blockers</th>
                      <th className="px-5 py-3.5">Support</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {historyData?.history && historyData.history.length > 0 ? (
                      historyData.history.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="px-5 py-4 flex items-center gap-2 font-medium text-[var(--color-text-primary)]">
                            <Calendar size={15} className="text-[var(--color-text-secondary)]" />
                            {new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-4">
                            {getStatusBadge(record.status)}
                          </td>
                          <td className="px-5 py-4 max-w-xs truncate text-xs">
                            {record.workToday || (record.status === 'EXEMPTED' ? record.exemptionReason || 'Authorized Exemption' : '-')}
                          </td>
                          <td className="px-5 py-4 text-xs">
                            {record.hasBlockers ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <AlertCircle size={12} /> {record.blockers?.substring(0, 30)}...
                              </span>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs">
                            {record.needSupport ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                <HelpCircle size={12} /> Requested
                              </span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailModal({ open: true, record })}
                            >
                              <Eye size={14} className="mr-1" /> View
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                          No previous standup submissions recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM STANDUPS (Team Lead / Manager)                                */}
      {/* ========================================================================= */}
      {activeTab === 'team' && isTeamLeadOrHigher && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="novynth-card p-4 flex flex-wrap items-center justify-between gap-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-[var(--color-text-primary)]">
                Select Date:
              </label>
              <input
                type="date"
                value={teamDate}
                onChange={(e) => {
                  setTeamDate(e.target.value);
                  loadTeamData(e.target.value);
                }}
                className="novynth-input py-1.5 px-3 text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadTeamData(teamDate)}
                disabled={teamLoading}
              >
                <RefreshCw size={14} className={teamLoading ? 'animate-spin' : ''} />
              </Button>
            </div>

            {/* Filter by status */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Filter:</span>
              {['ALL', 'SUBMITTED', 'LATE', 'MISSED', 'PENDING', 'EXEMPTED'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTeamFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    teamFilter === filter
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Team Summary Cards */}
          {teamData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              <div className="novynth-card p-3 text-center">
                <p className="text-xs text-[var(--color-text-secondary)]">Team Size</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">{teamData.summary.total}</p>
              </div>
              <div className="novynth-card p-3 text-center bg-emerald-50/40 border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">Submitted</p>
                <p className="text-lg font-bold text-emerald-800">{teamData.summary.submitted}</p>
              </div>
              <div className="novynth-card p-3 text-center bg-amber-50/40 border-amber-200">
                <p className="text-xs text-amber-700 font-medium">Late</p>
                <p className="text-lg font-bold text-amber-800">{teamData.summary.late}</p>
              </div>
              <div className="novynth-card p-3 text-center bg-rose-50/40 border-rose-200">
                <p className="text-xs text-rose-700 font-medium">Missed</p>
                <p className="text-lg font-bold text-rose-800">{teamData.summary.missed}</p>
              </div>
              <div className="novynth-card p-3 text-center bg-gray-50 border-gray-200">
                <p className="text-xs text-gray-700 font-medium">Pending</p>
                <p className="text-lg font-bold text-gray-800">{teamData.summary.pending}</p>
              </div>
              <div className="novynth-card p-3 text-center bg-blue-50/40 border-blue-200">
                <p className="text-xs text-blue-700 font-medium">Exempted</p>
                <p className="text-lg font-bold text-blue-800">{teamData.summary.exempted}</p>
              </div>
              <div className="novynth-card p-3 text-center bg-purple-50/40 border-purple-200">
                <p className="text-xs text-purple-700 font-medium">Compliance</p>
                <p className="text-lg font-bold text-purple-800">{teamData.summary.complianceRate}%</p>
              </div>
            </div>
          )}

          {/* Team Members List */}
          <div className="novynth-card overflow-hidden border border-[var(--color-border)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Work Update</th>
                    <th className="px-5 py-3.5">Blockers / Support</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {teamData?.members && teamData.members.length > 0 ? (
                    teamData.members
                      .filter((m) => teamFilter === 'ALL' || m.status === teamFilter)
                      .map((member) => (
                        <tr key={member.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-[var(--color-text-primary)]">{member.name}</div>
                            <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2 mt-0.5">
                              <span>{member.empId}</span>
                              {member.isLocked && (
                                <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  <Lock size={10} /> Locked
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {getStatusBadge(member.status)}
                          </td>
                          <td className="px-5 py-4 max-w-sm text-xs">
                            {member.submission?.workToday ? (
                              <p className="line-clamp-2">{member.submission.workToday}</p>
                            ) : (
                              <span className="text-gray-400 italic">No update submitted</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs space-y-1">
                            {member.submission?.hasBlockers && (
                              <div className="text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                <strong>Blocker:</strong> {member.submission.blockers}
                              </div>
                            )}
                            {member.submission?.needSupport && (
                              <div className="text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                <strong>Support:</strong> {member.submission.supportDetails}
                              </div>
                            )}
                            {!member.submission?.hasBlockers && !member.submission?.needSupport && (
                              <span className="text-gray-400">None</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right space-x-2">
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
                        No team members found for the selected date.
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
      {/* TAB 3: DEPARTMENT OVERVIEW (Dept Head)                                     */}
      {/* ========================================================================= */}
      {activeTab === 'department' && isDeptHead && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="novynth-card p-4 flex items-center justify-between border border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <Building2 className="text-[var(--color-primary)]" size={20} />
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                Department Compliance Overview
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={deptDate}
                onChange={(e) => {
                  setDeptDate(e.target.value);
                  loadDeptData(e.target.value);
                }}
                className="novynth-input py-1.5 px-3 text-sm"
              />
              <Button variant="ghost" size="sm" onClick={() => loadDeptData(deptDate)}>
                <RefreshCw size={14} className={deptLoading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>

          {/* Dept Stats */}
          {deptData && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="novynth-card p-4 text-center">
                <p className="text-xs text-[var(--color-text-secondary)]">Total Staff</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{deptData.summary.total}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-emerald-50/40 border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">Submitted</p>
                <p className="text-xl font-bold text-emerald-800">{deptData.summary.submitted}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-amber-50/40 border-amber-200">
                <p className="text-xs text-amber-700 font-medium">Late</p>
                <p className="text-xl font-bold text-amber-800">{deptData.summary.late}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-rose-50/40 border-rose-200">
                <p className="text-xs text-rose-700 font-medium">Missed</p>
                <p className="text-xl font-bold text-rose-800">{deptData.summary.missed}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-blue-50/40 border-blue-200">
                <p className="text-xs text-blue-700 font-medium">Exempted</p>
                <p className="text-xl font-bold text-blue-800">{deptData.summary.exempted}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-purple-50/40 border-purple-200">
                <p className="text-xs text-purple-700 font-medium">Compliance Rate</p>
                <p className="text-xl font-bold text-purple-800">{deptData.summary.complianceRate}%</p>
              </div>
            </div>
          )}

          {/* Department Blockers Radar */}
          {deptData && deptData.blockers.length > 0 && (
            <div className="novynth-card p-5 border border-amber-200 bg-amber-50/30">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-600" />
                Active Department Blockers ({deptData.blockers.length})
              </h4>
              <div className="space-y-2">
                {deptData.blockers.map((b, idx) => (
                  <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[var(--color-text-primary)]">{b.name} ({b.empId})</span>
                      <span className="text-[var(--color-text-secondary)]">Lead: {b.managerName || 'None'}</span>
                    </div>
                    <p className="text-amber-900 dark:text-amber-200">{b.blockers}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members Table */}
          <div className="novynth-card overflow-hidden border border-[var(--color-border)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Sub-Team</th>
                    <th className="px-5 py-3.5">Manager</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Work Done</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {deptData?.members && deptData.members.length > 0 ? (
                    deptData.members.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[var(--color-text-primary)]">{member.name}</div>
                          <div className="text-xs text-[var(--color-text-secondary)]">{member.empId}</div>
                        </td>
                        <td className="px-5 py-4 text-xs">{member.subTeam || 'General'}</td>
                        <td className="px-5 py-4 text-xs">{member.managerName || '-'}</td>
                        <td className="px-5 py-4">{getStatusBadge(member.status)}</td>
                        <td className="px-5 py-4 text-xs max-w-xs truncate">
                          {member.submission?.workToday || '-'}
                        </td>
                        <td className="px-5 py-4 text-right">
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
                <BarChart3 className="text-[var(--color-primary)]" size={22} />
                Company-Wide Standup Analytics
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Real-time compliance radar, department breakdowns, and automated enforcement controls.
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
                className="novynth-input py-1.5 px-3 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerComplianceCheck}
              >
                <Sparkles size={14} className="mr-1 text-[var(--color-primary)]" /> Run Compliance Check Now
              </Button>
            </div>
          </div>

          {/* High-Level Numbers */}
          {analyticsData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              <div className="novynth-card p-4 text-center">
                <p className="text-xs text-[var(--color-text-secondary)]">Total Workforce</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{analyticsData.overview.totalEmployees}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-emerald-50/40 border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">Submitted</p>
                <p className="text-2xl font-bold text-emerald-800">{analyticsData.overview.submitted}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-amber-50/40 border-amber-200">
                <p className="text-xs text-amber-700 font-medium">Late</p>
                <p className="text-2xl font-bold text-amber-800">{analyticsData.overview.late}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-rose-50/40 border-rose-200">
                <p className="text-xs text-rose-700 font-medium">Missed</p>
                <p className="text-2xl font-bold text-rose-800">{analyticsData.overview.missed}</p>
              </div>
              <div className="novynth-card p-4 text-center bg-purple-50/40 border-purple-200">
                <p className="text-xs text-purple-700 font-medium">Overall Compliance</p>
                <p className="text-2xl font-bold text-purple-800">{analyticsData.overview.complianceRate}%</p>
              </div>
              <div className="novynth-card p-4 text-center bg-red-50/40 border-red-200">
                <p className="text-xs text-red-700 font-medium">Locked Accounts</p>
                <p className="text-2xl font-bold text-red-800">{analyticsData.overview.lockedAccountsCount}</p>
              </div>
            </div>
          )}

          {/* Department-wise Breakdown Table */}
          <div className="novynth-card p-5 border border-[var(--color-border)]">
            <h4 className="text-sm font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-[var(--color-primary)]" />
              Department-Wise Compliance Matrix
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Total Active</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Late</th>
                    <th className="px-4 py-3">Missed</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Exempted</th>
                    <th className="px-4 py-3">Blockers</th>
                    <th className="px-4 py-3">Compliance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {analyticsData?.departments && analyticsData.departments.length > 0 ? (
                    analyticsData.departments.map((dept) => (
                      <tr key={dept.departmentId || dept.departmentName} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3.5 font-semibold text-[var(--color-text-primary)]">{dept.departmentName}</td>
                        <td className="px-4 py-3.5">{dept.totalEmployees}</td>
                        <td className="px-4 py-3.5 text-emerald-700 font-medium">{dept.submitted}</td>
                        <td className="px-4 py-3.5 text-amber-700">{dept.late}</td>
                        <td className="px-4 py-3.5 text-rose-700 font-medium">{dept.missed}</td>
                        <td className="px-4 py-3.5 text-gray-500">{dept.pending}</td>
                        <td className="px-4 py-3.5 text-blue-700">{dept.exempted}</td>
                        <td className="px-4 py-3.5">
                          {dept.blockersCount > 0 ? (
                            <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded text-xs">
                              {dept.blockersCount}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-[var(--color-primary)]">
                          {dept.complianceRate}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500">
                        No department data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Violators & At-Risk Employees */}
          {analyticsData && analyticsData.violators && analyticsData.violators.length > 0 && (
            <div className="novynth-card p-5 border border-rose-200 bg-rose-50/20">
              <h4 className="text-sm font-bold text-rose-900 flex items-center gap-2 mb-4">
                <ShieldAlert size={18} className="text-rose-600" />
                Compliance Violations & Locked Accounts ({analyticsData.violators.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[var(--color-text-secondary)]">
                  <thead className="bg-rose-100/50 text-rose-900 font-semibold border-b border-rose-200">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Manager</th>
                      <th className="px-4 py-3">Missed Updates</th>
                      <th className="px-4 py-3">Account Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100">
                    {analyticsData.violators.map((v) => (
                      <tr key={v.id} className="hover:bg-rose-50/40">
                        <td className="px-4 py-3 font-semibold text-rose-950">
                          {v.name} <span className="text-xs font-normal text-rose-700">({v.empId})</span>
                        </td>
                        <td className="px-4 py-3 text-xs">{v.department || '-'}</td>
                        <td className="px-4 py-3 text-xs">{v.manager || '-'}</td>
                        <td className="px-4 py-3 font-bold text-rose-700">{v.missedCount}</td>
                        <td className="px-4 py-3">
                          {v.isLocked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900">
                              <Lock size={12} /> Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              <AlertTriangle size={12} /> At-Risk
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
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                <div>
                  <h4 className="text-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <Sliders size={20} className="text-[var(--color-primary)]" />
                    Standup Policy & Compliance Configuration
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Configure daily timing thresholds, grace periods, auto-lock policies, and working days.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSavePolicy}
                  disabled={savingPolicy}
                >
                  {savingPolicy ? 'Saving Settings...' : 'Save Policy Changes'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                    Daily Start Time
                  </label>
                  <input
                    type="time"
                    className="novynth-input w-full"
                    value={policyData.startTime}
                    onChange={(e) => setPolicyData({ ...policyData, startTime: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                    Daily Reminder Time
                  </label>
                  <input
                    type="time"
                    className="novynth-input w-full"
                    value={policyData.reminderTime}
                    onChange={(e) => setPolicyData({ ...policyData, reminderTime: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                    Submission Deadline
                  </label>
                  <input
                    type="time"
                    className="novynth-input w-full"
                    value={policyData.submissionDeadline}
                    onChange={(e) => setPolicyData({ ...policyData, submissionDeadline: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                    Grace Period (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    className="novynth-input w-full"
                    value={policyData.gracePeriodMins}
                    onChange={(e) => setPolicyData({ ...policyData, gracePeriodMins: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                    Max Missed Updates Threshold
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="novynth-input w-full"
                    value={policyData.maxMissedThreshold}
                    onChange={(e) => setPolicyData({ ...policyData, maxMissedThreshold: parseInt(e.target.value, 10) || 3 })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                    Time Zone
                  </label>
                  <input
                    type="text"
                    className="novynth-input w-full"
                    value={policyData.timezone}
                    onChange={(e) => setPolicyData({ ...policyData, timezone: e.target.value })}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={policyData.enabled}
                    onChange={(e) => setPolicyData({ ...policyData, enabled: e.target.checked })}
                    className="rounded text-[var(--color-primary)]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)] block">
                      Enable Daily Standup Module
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      Turn system-wide daily standup compliance tracking on or off.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={policyData.accountLockEnabled}
                    onChange={(e) => setPolicyData({ ...policyData, accountLockEnabled: e.target.checked })}
                    className="rounded text-rose-600"
                  />
                  <div>
                    <span className="text-sm font-semibold text-[var(--color-text-primary)] block">
                      Automatic Account Lockout on Violation
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      Lock employee login after reaching max missed updates threshold.
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
          <p className="text-xs text-[var(--color-text-secondary)]">
            Pre-excuse your upcoming daily standup if you have a valid reason (e.g. approved leave, client travel, illness).
          </p>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Standup Date</label>
            <input
              type="date"
              className="novynth-input w-full"
              value={excuseModal.date}
              onChange={(e) => setExcuseModal({ ...excuseModal, date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Reason for Absence</label>
            <textarea
              rows={3}
              className="novynth-input w-full"
              placeholder="e.g. Approved annual leave / On-site client meeting..."
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
        title={`Standup Details - ${detailModal.record?.date || ''}`}
      >
        {detailModal.record && (
          <div className="p-3 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-secondary)]">Status:</span>
              {getStatusBadge(detailModal.record.status)}
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)] block">1. Work Completed:</span>
              <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {detailModal.record.workToday || '-'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)] block">2. Blockers / Issues:</span>
              <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {detailModal.record.blockers || (detailModal.record.hasBlockers ? 'Yes' : 'No blockers reported.')}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)] block">3. Next Plan:</span>
              <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {detailModal.record.nextPlan || '-'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)] block">4. Support Requested:</span>
              <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">
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
        title={`Grant Standup Exemption - ${exemptModal.name}`}
      >
        <div className="p-3 space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Authorize an official standup exemption for this employee on the specified date.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Date</label>
            <input
              type="date"
              className="novynth-input w-full"
              value={exemptModal.date}
              onChange={(e) => setExemptModal({ ...exemptModal, date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Reason for Exemption</label>
            <textarea
              rows={3}
              className="novynth-input w-full"
              placeholder="e.g. Approved client escalation duty / Authorized medical leave..."
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
        title={`Unlock Account - ${unlockModal.name}`}
      >
        <div className="p-3 space-y-4">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Restores the employee's active login status and records the administrative unlock in the audit log.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">Administrative Note / Reason</label>
            <textarea
              rows={3}
              className="novynth-input w-full"
              placeholder="e.g. Compliance review resolved, employee acknowledged standup policy..."
              value={unlockModal.reason}
              onChange={(e) => setUnlockModal({ ...unlockModal, reason: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setUnlockModal({ ...unlockModal, open: false })}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUnlockUser}>
              Confirm Unlock
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
