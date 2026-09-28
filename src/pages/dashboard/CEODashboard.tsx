import React, { useEffect, useState } from 'react';
import { getCEODashboardData, exportCEOReportCSV } from '../../api/ceo.api';
import { getStandupAnalytics, type ExecutiveAnalyticsResponse } from '../../api/standups.api';
import { KPICard } from '../../components/dashboard/KPICard';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { 
  DollarSign, TrendingUp, Users, FolderKanban, Download, FileText, Sparkles, 
  ShieldCheck, AlertCircle, CheckCircle, Plus, Eye, Megaphone, ArrowRight, 
  Layers, Target, FileCheck, BarChart3, AlertTriangle, UserX, Briefcase, 
  Clock, ShieldAlert, CheckCircle2, Building2, ChevronRight, UserCheck, Flame
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { toast } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { DepartmentDetailModal } from '../../components/dashboard/DepartmentDetailModal';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const CEODashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [standupData, setStandupData] = useState<ExecutiveAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [isCritical, setIsCritical] = useState(false);
  
  // Drill-down Modal State
  const [selectedDept, setSelectedDept] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [announcements, setAnnouncements] = useState<any[]>([
    { id: 1, text: 'Q3 All-Hands Executive Review scheduled for Friday 3:00 PM', critical: true, date: 'Today' },
    { id: 2, text: 'New AI Automation Service Line official launch completed', critical: false, date: 'Yesterday' }
  ]);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [res, sRes] = await Promise.all([
        getCEODashboardData().catch(() => null),
        getStandupAnalytics().catch(() => null)
      ]);
      if (res) setData(res);
      if (sRes) setStandupData(sRes);
    } catch (err) {
      console.error('Error fetching CEO dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      await exportCEOReportCSV();
      toast.success('Executive report exported successfully.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export CSV report.');
    } finally {
      setExporting(false);
    }
  };

  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    const newAnn = {
      id: Date.now(),
      text: announcementText,
      critical: isCritical,
      date: 'Just now'
    };
    setAnnouncements([newAnn, ...announcements]);
    setAnnouncementText('');
    toast.success(isCritical ? 'Critical announcement pinned company-wide!' : 'Company announcement posted.');
  };

  const openDepartmentModal = (dept: any) => {
    setSelectedDept(dept);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <span className="text-sm text-slate-500 font-medium">Loading Executive Dashboard...</span>
        </div>
      </div>
    );
  }

  const { metrics, charts, departmentSnapshots, workforceAnalytics, flightRiskList, atsFunnel, pendingInvoices, alerts, aiSummary } = data || {};
  const leadStageCounts = metrics?.leadStageCounts || { New: 5, Contacted: 8, Interested: 6, 'Meeting Scheduled': 4, 'Proposal Sent': 3, Negotiation: 2, Won: 6, Lost: 2 };
  const quotationStatusCounts = metrics?.quotationStatusCounts || { Draft: 2, Sent: 5, Accepted: 8, Rejected: 1, Expired: 1 };

  const defaultDepts = [
    { id: 'dept-prod', name: 'Product & Engineering', headcount: 14, lead: 'Tejas Terse', attendanceRate: 95.2, reviewCompletion: 92, openRoles: 3, health: 'green', healthReason: 'Sprints on schedule; 95% attendance' },
    { id: 'dept-growth', name: 'Growth & Sales', headcount: 5, lead: 'Rahul Sharma', attendanceRate: 88.0, reviewCompletion: 80, openRoles: 2, health: 'amber', healthReason: 'Slight delay in proposal pipeline' },
    { id: 'dept-design', name: 'UI/UX & Design', headcount: 3, lead: 'Ananya Verma', attendanceRate: 96.5, reviewCompletion: 100, openRoles: 1, health: 'green', healthReason: 'All deliverables approved' },
    { id: 'dept-hrops', name: 'HR & Operations', headcount: 4, lead: 'Pooja Nair', attendanceRate: 98.0, reviewCompletion: 95, openRoles: 1, health: 'green', healthReason: 'Onboarding & compliance complete' },
    { id: 'dept-fin', name: 'Finance & Accounts', headcount: 3, lead: 'Siddharth Mehta', attendanceRate: 91.0, reviewCompletion: 85, openRoles: 0, health: 'green', healthReason: 'Payroll & audit reconciliations clean' }
  ];

  const deptsToDisplay = departmentSnapshots || defaultDepts;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header with Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">CEO Executive Dashboard</h1>
          <p className="text-slate-500">Bird's-eye view across Product, Growth, Design, HR/Ops, and Finance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            icon={<Users size={16} />} 
            onClick={() => navigate('/attendance/standups')}
          >
            Standups Hub
          </Button>
          <Button 
            variant="outline" 
            icon={<CheckCircle2 size={16} />} 
            onClick={() => navigate('/approval-queue')}
          >
            Pending Approvals
          </Button>
          <Button 
            variant="outline" 
            icon={<Eye size={16} />} 
            onClick={() => navigate('/admin/role-cards')}
          >
            Directory
          </Button>
          <Button 
            variant="outline" 
            icon={<Plus size={16} />} 
            onClick={() => navigate('/quotations')}
          >
            Generate Quotation
          </Button>
          <Button 
            variant="primary" 
            icon={<FileText size={16} />} 
            onClick={handleExportCSV}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* AI Executive Summary Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs uppercase tracking-widest">
              <Sparkles size={16} className="text-indigo-400" />
              AI Executive Summary
            </div>
            <p className="text-slate-200 text-sm max-w-3xl leading-relaxed font-medium">
              {aiSummary || 'Business operations are performing steadily with balanced profit margins and active team engagement.'}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 flex items-center gap-3 shrink-0">
            <ShieldCheck size={28} className="text-emerald-400" />
            <div>
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Company Health Index</p>
              <p className="text-2xl font-extrabold text-white">{metrics?.businessHealthScore || 88}<span className="text-sm font-normal text-slate-300">/100</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. TOP-LEVEL EXECUTIVE KPI STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard 
          title="Total Headcount" 
          value={metrics?.headcount?.toString() || '29'} 
          trend={`${metrics?.activeEmployees || 28} Active | ${metrics?.resignedEmployees || 1} Exited`} 
          trendUp={true} 
          icon={<Users size={24} className="text-blue-500" />} 
        />
        <KPICard 
          title="Attrition Rate" 
          value={`${metrics?.attritionRate || 2.1}%`} 
          trend="Voluntary vs Involuntary" 
          trendUp={false} 
          icon={<UserX size={24} className="text-rose-500" />} 
        />
        <KPICard 
          title="Time to Fill" 
          value={`${metrics?.timeToFillDays || 21} Days`} 
          trend={`${atsFunnel?.openRequisitions || 7} Open Positions`} 
          trendUp={true} 
          icon={<Clock size={24} className="text-purple-500" />} 
        />
        <KPICard 
          title="Attendance Rate" 
          value={`${metrics?.attendancePercentage || 94.2}%`} 
          trend="Daily Utilization" 
          trendUp={true} 
          icon={<UserCheck size={24} className="text-emerald-500" />} 
        />
        <KPICard 
          title="Standup Compliance" 
          value={`${standupData?.overview?.complianceRate || 96}%`} 
          trend={`${standupData?.overview?.activeBlockersCount || 0} Blockers | ${standupData?.overview?.submitted || 0} In`} 
          trendUp={true} 
          icon={<Flame size={24} className="text-indigo-500" />} 
        />
        <KPICard 
          title="Payroll Run-Rate" 
          value={`$${metrics?.monthlyRevenue ? Math.round(metrics.monthlyRevenue * 0.45).toLocaleString() : '65,250'}`} 
          trend="Linked to Finance" 
          trendUp={true} 
          icon={<DollarSign size={24} className="text-indigo-500" />} 
        />
      </div>

      {/* 2. TEAM-WISE SNAPSHOT CARDS WITH HEALTH INDICATORS & DRILL-DOWN */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="text-indigo-600" size={22} />
              Department Health & Snapshot Cards
            </h3>
            <p className="text-xs text-slate-500">Click any card to drill down into department-level details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {deptsToDisplay.map((dept: any) => (
            <div 
              key={dept.id} 
              onClick={() => openDepartmentModal(dept)}
              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`w-3 h-3 rounded-full ${
                    dept.health === 'green' ? 'bg-emerald-500 ring-4 ring-emerald-100' :
                    dept.health === 'amber' ? 'bg-amber-500 ring-4 ring-amber-100' : 'bg-rose-500 ring-4 ring-rose-100'
                  }`} />
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 group-hover:bg-indigo-100 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1">
                    Drill Down <ChevronRight size={10} />
                  </span>
                </div>

                <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{dept.name}</h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Lead: {dept.lead}</p>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Headcount</span>
                    <span className="font-bold text-slate-900">{dept.headcount}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Attendance</span>
                    <span className="font-bold text-emerald-600">{dept.attendanceRate}%</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Review Done</span>
                    <span className="font-bold text-indigo-600">{dept.reviewCompletion}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span>Open Roles: {dept.openRoles}</span>
                <span className={dept.health === 'green' ? 'text-emerald-600' : 'text-amber-600'}>
                  {dept.health === 'green' ? 'Healthy' : 'Alert'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. HR & WORKFORCE ANALYTICS + 4. FLIGHT RISK & HIGH PERFORMERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attrition Trend & Exit Reasons */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UserX className="text-rose-600" size={20} />
              Attrition Trends & Exit Interview Tags
            </span>
            <span className="text-xs font-extrabold text-slate-500">Leave Liability: ${workforceAnalytics?.leaveLiabilityUSD?.toLocaleString() || '24,500'}</span>
          </h3>

          <div className="space-y-3">
            {(workforceAnalytics?.exitReasons || [
              { reason: 'Better Opportunity / Career Growth', percentage: 45 },
              { reason: 'Higher Compensation', percentage: 30 },
              { reason: 'Relocation / Personal', percentage: 15 },
              { reason: 'Work-Life Balance', percentage: 10 }
            ]).map((item: any, idx: number) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{item.reason}</span>
                  <span className="font-bold text-slate-900">{item.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
            <div className="p-3 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase">eNPS Score</p>
              <p className="text-xl font-black text-emerald-600 mt-1">+{workforceAnalytics?.enpsScore || 42}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Avg Tenure</p>
              <p className="text-xl font-black text-indigo-600 mt-1">2.4 Years</p>
            </div>
          </div>
        </div>

        {/* Flight Risk & High Performers Panel */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldAlert className="text-amber-600" size={20} />
                High Performers / Retention Flight Risk
              </span>
              <button onClick={() => navigate('/hr/performance')} className="text-xs font-bold text-indigo-600 hover:underline">
                Open Appraisals
              </button>
            </h3>

            <div className="space-y-3">
              {(flightRiskList || [
                { id: 'fr-1', name: 'Omkar Misal', role: 'Senior Developer', department: 'Engineering', performanceScore: '4.8 / 5.0', tenure: '2.5 Yrs', riskLevel: 'Medium', riskFactor: 'High workload / Pending appraisal' },
                { id: 'fr-2', name: 'Aarav Gupta', role: 'Lead UI/UX Designer', department: 'Design', performanceScore: '4.9 / 5.0', tenure: '3.1 Yrs', riskLevel: 'Low', riskFactor: 'Market competitive offer' }
              ]).map((emp: any) => (
                <div key={emp.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between hover:bg-indigo-50/40 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-xs text-slate-900">{emp.name}</h4>
                      <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{emp.performanceScore}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{emp.role} • {emp.department} ({emp.tenure})</p>
                    <p className="text-[10px] text-amber-700 font-semibold mt-1">Risk Factor: {emp.riskFactor}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/users')}>
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
            <span className="font-semibold">Appraisal & Promotion Pipeline on track</span>
            <span className="font-bold text-indigo-700">Q3 Calibration Active</span>
          </div>
        </div>
      </div>

      {/* 5. FINANCE PEOPLE COSTS & 6. RECRUITMENT ATS FUNNEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Finance People Costs: Budget vs Actual */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <DollarSign className="text-emerald-600" size={20} />
            Finance-Linked People Costs (Budget vs Actuals)
          </h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.departmentCosts || [
                { department: 'Engineering', budget: 65000, actual: 61200 },
                { department: 'Growth & Sales', budget: 35000, actual: 32800 },
                { department: 'Design', budget: 22000, actual: 20500 },
                { department: 'HR & Ops', budget: 20000, actual: 18900 },
                { department: 'Finance', budget: 18000, actual: 17200 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="department" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Cost']} />
                <Legend />
                <Bar dataKey="budget" name="Payroll Budget" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual Cost" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recruitment ATS Funnel */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Briefcase className="text-purple-600" size={20} />
                Recruitment & Hiring Funnel
              </span>
              <button onClick={() => navigate('/hr/ats')} className="text-xs font-bold text-indigo-600 hover:underline">
                Open ATS Hub
              </button>
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 text-center">
                <p className="text-[10px] font-bold text-purple-600 uppercase">Offer Acceptance</p>
                <p className="text-xl font-black text-purple-900 mt-1">{atsFunnel?.offerAcceptanceRate || 85.7}%</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                <p className="text-[10px] font-bold text-indigo-600 uppercase">Avg Time to Hire</p>
                <p className="text-xl font-black text-indigo-900 mt-1">{atsFunnel?.avgTimeToHireDays || 21} Days</p>
              </div>
            </div>

            <div className="space-y-2">
              {(atsFunnel?.pipelineStages || [
                { stage: 'Sourced', count: 42 },
                { stage: 'Screened', count: 24 },
                { stage: 'Interview', count: 12 },
                { stage: 'Offer Sent', count: 6 },
                { stage: 'Joined', count: 4 }
              ]).map((stg: any) => (
                <div key={stg.stage} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs">
                  <span className="font-semibold text-slate-700">{stg.stage}</span>
                  <span className="font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">{stg.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* EXISTING MAIN CHARTS: Revenue Trend & Service Lines & Quotations & Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Growth Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Revenue & Expense Trend</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.revenueGrowth || []}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} tickFormatter={(value) => `$${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quotation Status Counts */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileCheck className="text-emerald-600" size={20} />
              Quotation Status Breakdown
            </span>
          </h3>
          <div className="space-y-3">
            {Object.entries(quotationStatusCounts).map(([status, count]) => (
              <div key={status} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{status}</span>
                <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                  status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' :
                  status === 'Sent' ? 'bg-indigo-100 text-indigo-700' :
                  status === 'Draft' ? 'bg-slate-200 text-slate-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {count as number} Quotations
                </span>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4" icon={<FileText size={16} />} onClick={() => navigate('/quotations')}>
            View All Quotations
          </Button>
        </div>
      </div>

      {/* Grid: Service Line Breakdown & Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Service Line */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Layers className="text-indigo-600" size={20} />
            Revenue by Service Line
          </h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.serviceLineRevenue || [
                { name: 'AI Automation', revenue: 437500 },
                { name: 'Dynamic Website', revenue: 312500 },
                { name: 'Mobile Apps', revenue: 250000 },
                { name: 'UI/UX Design', revenue: 125000 },
                { name: 'Static Website', revenue: 75000 },
                { name: 'Branding', revenue: 50000 }
              ]} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${v/1000}k`} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#6366F1" radius={[0, 6, 6, 0]}>
                  {(charts?.serviceLineRevenue || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Company Announcements */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Megaphone className="text-indigo-600" size={20} />
                Company Announcements
              </span>
            </h3>
            
            <form onSubmit={handlePostAnnouncement} className="mb-4 space-y-2">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Broadcast an announcement..." 
                  value={announcementText} 
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button variant="primary" size="sm" type="submit">Post</Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 font-semibold cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isCritical} 
                  onChange={(e) => setIsCritical(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                Pin as Critical (Non-dismissible)
              </label>
            </form>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
              {announcements.map((ann) => (
                <div key={ann.id} className={`p-3 rounded-2xl border text-xs flex justify-between items-start ${
                  ann.critical ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-100 text-slate-800'
                }`}>
                  <div>
                    {ann.critical && <span className="font-extrabold text-[10px] uppercase bg-rose-200 text-rose-800 px-2 py-0.5 rounded mr-2">Critical</span>}
                    <span>{ann.text}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">{ann.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drill-Down Modal */}
      <DepartmentDetailModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        department={selectedDept}
      />
    </div>
  );
};
