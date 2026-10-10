import React, { useState, useEffect } from 'react';
import { createProject } from '../../api/projects.api';
import { getAllUsers, getDirectoryUsers } from '../../api/admin.api';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CheckCircle, ArrowLeft, FolderKanban, Users, Shield, Layers, Sparkles } from 'lucide-react';
import { toast } from '../../utils/toast';

export const CreateProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [teamLeads, setTeamLeads] = useState<any[]>([]);
  const [selectedTeamLeadId, setSelectedTeamLeadId] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    stage: 'Plan' as const,
    template: 'Kanban',
    visibility: 'private'
  });

  const isDeptHead = 
    ['DEPT_HEAD', 'Dept Head', 'Department Head'].includes(role || '') || 
    ['DEPT_HEAD', 'Dept Head', 'Department Head'].includes(user?.role || '');

  const userDept = (user?.department || '').trim();

  // Filter team leads to Department Head's department if current user is Dept Head
  const availableTeamLeads = React.useMemo(() => {
    if (isDeptHead && userDept) {
      const normalizedDept = userDept.toLowerCase();
      const filtered = teamLeads.filter(u => {
        const d = (u.department || '').trim().toLowerCase();
        return d === normalizedDept || d.includes(normalizedDept) || normalizedDept.includes(d);
      });
      return filtered.length > 0 ? filtered : teamLeads;
    }
    return teamLeads;
  }, [teamLeads, isDeptHead, userDept]);

  // Sort so Team Leads appear first, then alphabetically
  const sortedLeads = React.useMemo(() => {
    return [...availableTeamLeads].sort((a, b) => {
      const aIsLead = ['TEAM_LEAD', 'Team Lead'].includes(a.role || '');
      const bIsLead = ['TEAM_LEAD', 'Team Lead'].includes(b.role || '');
      if (aIsLead && !bIsLead) return -1;
      if (!aIsLead && bIsLead) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [availableTeamLeads]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await getAllUsers();
        if (Array.isArray(users) && users.length > 0) {
          setTeamLeads(users);
        } else {
          const dirUsers = await getDirectoryUsers();
          setTeamLeads(dirUsers);
        }
      } catch (err) {
        try {
          const dirUsers = await getDirectoryUsers();
          setTeamLeads(dirUsers);
        } catch (dirErr) {
          console.error('Failed to load team leads', dirErr);
        }
      }
    };
    fetchUsers();
  }, []);

  // Sync selectedTeamLeadId if current selection is invalid or not in sorted list
  useEffect(() => {
    if (sortedLeads.length > 0) {
      const exists = sortedLeads.some(u => String(u.id) === String(selectedTeamLeadId));
      if (!selectedTeamLeadId || !exists) {
        setSelectedTeamLeadId(String(sortedLeads[0].id));
      }
    }
  }, [sortedLeads, selectedTeamLeadId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a project title.');
      return;
    }
    setLoading(true);
    
    try {
      const newProj = await createProject({
        ...formData,
        teamLeadId: selectedTeamLeadId || undefined
      });
      setSuccess(true);
      
      // Auto-navigate to details page
      setTimeout(() => {
        navigate(`/projects/${newProj.id}`);
      }, 1400);
      
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create project');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Projects
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Provision New Project Workspace</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Setup Kanban boards, team lead assignments, and channels</p>
        </div>
      </div>
      
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-8 relative overflow-hidden">
        {success ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Project Workspace Created</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Auto-provisioning messaging channel, role access cards, and board columns...
              </p>
            </div>
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mt-4"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Title & Description */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Project Title *</label>
                <Input 
                  type="text" 
                  required 
                  placeholder="e.g. Novynth Enterprise Mobile Portal v2"
                  value={formData.title} 
                  onChange={e => setFormData({ ...formData, title: e.target.value })} 
                  className="w-full text-sm font-semibold rounded-2xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500 py-3"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Project Scope & Objectives *</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full text-xs font-medium rounded-2xl border border-slate-200 p-3.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                  placeholder="Summarize high-level deliverables, milestones, and goals..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            {/* Stage & Team Lead Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Initial Lifecycle Stage</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                >
                  <option value="Plan">Plan (Research & Requirement Gathering)</option>
                  <option value="Dev">Dev (Active Code Sprint)</option>
                  <option value="Test">Test (QA & User Acceptance)</option>
                  <option value="Deploy">Deploy (Production Staging)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Project Team Lead *
                  </label>
                  {isDeptHead && userDept && (
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                      {user?.department} Team
                    </span>
                  )}
                </div>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  value={selectedTeamLeadId}
                  onChange={(e) => setSelectedTeamLeadId(e.target.value)}
                >
                  <option value="">Select Team Lead Owner</option>
                  {sortedLeads.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.role ? `(${u.role})` : ''} — {u.department || 'General'}
                    </option>
                  ))}
                </select>
                {isDeptHead && userDept && (
                  <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                    Showing members & team leads from your department (<span className="font-semibold text-slate-700">{user?.department}</span>).
                  </p>
                )}
              </div>
            </div>

            {/* Template Selection Cards */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Process Board Template</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'Kanban', title: 'Kanban Board', desc: 'Continuous flow with WIP limits' },
                  { id: 'Scrum', title: 'Scrum Sprints', desc: 'Time-boxed iteration planning' },
                  { id: 'Bug Tracking', title: 'Bug & Issue Tracker', desc: 'Defect logging & triage flow' }
                ].map(tmpl => (
                  <div
                    key={tmpl.id}
                    onClick={() => setFormData({ ...formData, template: tmpl.id })}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      formData.template === tmpl.id
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-md'
                        : 'border-slate-100 bg-slate-50/40 hover:border-slate-300'
                    }`}
                  >
                    <p className={`font-bold text-xs ${formData.template === tmpl.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                      {tmpl.title}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium leading-normal">{tmpl.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Visibility Options */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Visibility Scope</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
              >
                <option value="private">Private (Invite-Only Restricted Access)</option>
                <option value="public">Public (Open for all Organization Staff)</option>
                <option value="department">Department-Scoped Access</option>
              </select>
            </div>

            {/* Submit Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/projects')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="secondary"
                isLoading={loading}
                icon={<Sparkles size={16} />}
              >
                Create Workspace Project
              </Button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
};


