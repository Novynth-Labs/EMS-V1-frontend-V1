import React, { useEffect, useState } from 'react';
import { getProjects, deleteProject, type Project } from '../../api/projects.api';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { 
  FolderKanban, 
  Users, 
  Plus, 
  Filter, 
  ShieldAlert, 
  Trash2, 
  MessageSquare, 
  Search, 
  Sparkles, 
  Activity, 
  TrendingUp, 
  ArrowRight,
  Clock,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { GlobalFilterSidebar, AppliedFilterChips, type FilterFacet } from '../../components/layout/GlobalFilterSidebar';
import { getInitials } from '../../utils/initials';

export const ProjectsDashboardPage: React.FC = () => {
  const { role } = useAuthStore();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

  const FACETS: FilterFacet[] = [
    {
      id: 'stage',
      label: 'Project Stage',
      options: [
        { label: 'Plan', value: 'Plan' },
        { label: 'Dev', value: 'Dev' },
        { label: 'Test', value: 'Test' },
        { label: 'Deploy', value: 'Deploy' },
        { label: 'Closed', value: 'Closed' }
      ]
    }
  ];

  useEffect(() => {
    setLoading(true);
    getProjects(showArchived).then(data => {
      setProjects(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [showArchived]);

  const canCreate = ['Super Admin', 'Dept Head', 'Team Lead', 'CEO', 'CTO'].includes(role || '');

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string, projectTitle: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete the project "${projectTitle}"?`)) return;
    try {
      await deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (err) {
      console.error('Failed to delete project', err);
      alert('Failed to delete project.');
    }
  };

  const getStageBadgeStyle = (stage: string) => {
    switch (stage) {
      case 'Plan':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Dev':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Test':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Deploy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Closed':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Filter projects by active filter facets & search query
  const filteredProjects = projects.filter(proj => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (proj.title || proj.name || '').toLowerCase().includes(q);
      const matchDesc = (proj.description || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    if (activeFilters.stage && activeFilters.stage.length > 0) {
      if (!activeFilters.stage.includes(proj.stage)) return false;
    }
    return true;
  });

  const onTrackCount = projects.filter(p => p.health === 'on_track' || !p.health).length;
  const atRiskCount = projects.filter(p => p.health === 'at_risk').length;
  const delayedCount = projects.filter(p => p.health === 'off_track').length;

  const velocityChartData = [
    { name: 'Sprint 21', points: 34 },
    { name: 'Sprint 22', points: 42 },
    { name: 'Sprint 23', points: 38 },
    { name: 'Sprint 24', points: 45 },
    { name: 'Sprint 25', points: 51 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 animate-pulse" />
            <div className="absolute inset-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 animate-ping opacity-30" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading workspace projects…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full max-w-7xl mx-auto gap-6 items-start pb-12">
      <div className="flex-1 min-w-0 space-y-8">
        
        {/* Premium Dark Glassmorphic Hero Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-violet-500/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                  <FolderKanban size={20} className="text-indigo-300" />
                </div>
                <span className="text-indigo-300 text-sm font-semibold tracking-wide uppercase">Workspace Projects</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                {showArchived ? 'Archived Projects Repository' : 'Agile Project Workspaces'}
              </h1>
              <p className="text-slate-400 mt-1.5 text-sm font-medium">
                {projects.length} total projects · {onTrackCount} on track · {atRiskCount + delayedCount} requiring attention
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  showArchived 
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' 
                    : 'bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                {showArchived ? 'View Active Projects' : 'View Archived'}
              </button>

              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-2xl text-xs font-bold border border-white/20 hover:bg-white/20 transition-all backdrop-blur-sm"
              >
                <Filter size={15} />
                Filter
                {Object.values(activeFilters).flat().length > 0 && (
                  <span className="bg-indigo-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {Object.values(activeFilters).flat().length}
                  </span>
                )}
              </button>

              {canCreate && !showArchived && (
                <button
                  onClick={() => navigate('/projects/new')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-900 rounded-2xl font-bold text-sm transition-all hover:shadow-xl hover:shadow-white/20 hover:-translate-y-0.5"
                >
                  <Plus size={16} /> New Project
                </button>
              )}
            </div>
          </div>

          {/* Search Bar inside Hero */}
          <div className="mt-6 relative max-w-md">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-2xl pl-11 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 backdrop-blur-md"
            />
          </div>
        </div>

        {/* Applied Filter Chips Bar */}
        <AppliedFilterChips 
          facets={FACETS}
          activeFilters={activeFilters}
          onRemove={(facetId, value) => {
            setActiveFilters(prev => ({
              ...prev,
              [facetId]: (prev[facetId] || []).filter(v => v !== value)
            }));
          }}
          onClearAll={() => setActiveFilters({})}
        />

        {/* Agile Analytics Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Velocity Chart */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-indigo-600" /> Workspace Velocity Trend
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Average story points delivered per sprint</p>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
                Avg 42 pts
              </span>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip cursor={{ fill: '#F8FAFC' }} />
                  <Bar dataKey="points" fill="url(#indigoGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="indigoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#4F46E5" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Project Health Status */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
                <Activity size={18} className="text-emerald-600" /> Portfolio Health
              </h3>
              <p className="text-xs text-slate-400 font-medium">Real-time project risk breakdown</p>
            </div>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                <p className="text-2xl font-black text-emerald-600">{onTrackCount}</p>
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">On Track</p>
              </div>
              <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl">
                <p className="text-2xl font-black text-amber-600">{atRiskCount}</p>
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mt-0.5">At Risk</p>
              </div>
              <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl">
                <p className="text-2xl font-black text-rose-600">{delayedCount}</p>
                <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mt-0.5">Off Track</p>
              </div>
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                <p className="text-2xl font-black text-indigo-600">94%</p>
                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mt-0.5">SLA Health</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium text-center">
              Updated automatically from project sprint boards
            </p>
          </div>
        </div>

        {/* Projects Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(proj => {
            const memberCount = (Array.isArray(proj.members) ? proj.members.length : 0) || (proj as any).memberCount || 0;
            const healthColor = 
              proj.health === 'at_risk' ? 'bg-amber-500' :
              proj.health === 'off_track' ? 'bg-rose-500' : 'bg-emerald-500';

            return (
              <div
                key={proj.id}
                onClick={() => navigate(`/projects/${proj.id}`)}
                className="group bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 p-6 flex flex-col justify-between cursor-pointer relative overflow-hidden"
              >
                {/* Stage Badge & Health */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${getStageBadgeStyle(proj.stage)}`}>
                    {proj.stage}
                  </span>

                  <div className="flex items-center gap-2">
                    {proj.template && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                        {proj.template}
                      </span>
                    )}
                    <span className={`w-2.5 h-2.5 rounded-full ${healthColor} animate-pulse`} title={`Health: ${proj.health || 'on_track'}`} />
                    {canCreate && (
                      <button
                        onClick={(e) => handleDeleteProject(e, proj.id, proj.title)}
                        title="Delete Project"
                        className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-2">
                    {proj.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-6 font-medium">
                    {proj.description || 'Agile project workspace for sprint planning, board tracking, and deliverable execution.'}
                  </p>
                </div>

                {/* Bottom Card Footer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                      {memberCount}
                    </div>
                    <span>{memberCount === 1 ? 'Member' : 'Members'}</span>
                    {proj.members && proj.members.length > 0 && (
                      <div className="flex -space-x-1.5 ml-1 overflow-hidden" title={proj.members.map((m: any) => m.name).join(', ')}>
                        {proj.members.slice(0, 3).map((m: any, idx: number) => (
                          <div
                            key={m.id || idx}
                            title={`${m.name} (${m.role || 'Member'})`}
                            className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-white shadow-xs"
                          >
                            {getInitials(m.name || '')}
                          </div>
                        ))}
                        {proj.members.length > 3 && (
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[8px] font-bold flex items-center justify-center ring-1 ring-white shadow-xs">
                            +{proj.members.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate('/messages'); }}
                      className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-xl transition-all border border-slate-200 hover:border-indigo-200"
                      title="Open Workspace Chat"
                    >
                      <MessageSquare size={14} />
                    </button>
                    <div className="flex items-center gap-1 font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                      Workspace <ArrowRight size={13} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-3 shadow-sm border border-slate-200">
                <FolderKanban size={24} className="text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No matching projects found</h3>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search or active stage filters</p>
              {canCreate && !showArchived && (
                <button
                  onClick={() => navigate('/projects/new')}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20"
                >
                  Create New Project
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter Sidebar container */}
      {isFilterOpen && (
        <div className="h-[calc(100vh-8rem)] sticky top-0 rounded-2xl overflow-hidden border border-slate-200 hidden lg:block bg-white shadow-xl">
          <GlobalFilterSidebar 
            facets={FACETS} 
            activeFilters={activeFilters} 
            onChange={setActiveFilters} 
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
          />
        </div>
      )}
    </div>
  );
};


