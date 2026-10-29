import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getProjectDetails, 
  getTasks, 
  type Project, 
  type ProjectTask, 
  createTask, 
  addProjectMember, 
  removeProjectMember,
  updateProjectTeamLead,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
  getProjectRoles,
  updateProjectMemberRole,
  transferProjectOwnership,
  getProjectResourceAllocation,
  getProjectVelocity,
  type ProjectRole,
  type ResourceAllocation
} from '../../api/projects.api';
import { searchUsers, getDirectoryUsers, getAllUsers } from '../../api/admin.api';
import { KanbanBoard } from '../../components/projects/KanbanBoard';
import { GitPRPanel } from '../../components/projects/GitPRPanel';
import { BacklogPage } from './BacklogPage';
import { Button } from '../../components/ui/Button';
import { getInitials } from '../../utils/initials';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { 
  MessageCircle, 
  Users, 
  Plus, 
  ArrowLeft, 
  Info, 
  FileText, 
  Activity, 
  Settings, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Archive, 
  Trash2, 
  RefreshCw,
  Sliders,
  UserCheck,
  Crown,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../utils/toast';

export const ProjectDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamLeads, setTeamLeads] = useState<any[]>([]);
  const [projectRoles, setProjectRoles] = useState<ProjectRole[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  
  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'Medium' as any, deadline: '', assigneeId: '' });

  // Add member modal states
  const [memberModal, setMemberModal] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<any[]>([]);
  const [addMemberForm, setAddMemberForm] = useState({
    userId: '',
    roleId: '',
    capacityHours: 40
  });
  const [isAdding, setIsAdding] = useState(false);

  // Edit project member modal states
  const [editMemberModal, setEditMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [editMemberForm, setEditMemberForm] = useState({
    roleId: '',
    capacityHours: 40
  });

  const [activeTab, setActiveTab] = useState<'board' | 'overview' | 'backlog' | 'prs' | 'settings'>('board');

  // Edit settings form state
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    description: '',
    visibility: 'private' as any,
    template: 'Kanban',
    health: 'on_track' as any,
    teamLeadId: ''
  });

  const [velocityData, setVelocityData] = useState<any>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      const [projData, taskData, rolesData, allocData, velData] = await Promise.all([
        getProjectDetails(id),
        getTasks(id),
        getProjectRoles(),
        getProjectResourceAllocation(id),
        getProjectVelocity(id).catch(() => null)
      ]);
      setProject(projData);
      setTasks(taskData);
      setProjectRoles(rolesData);
      setAllocations(allocData);
      if (velData) setVelocityData(velData);

      setProjectRoles(rolesData);
      setAllocations(allocData);

      setSettingsForm({
        name: projData.name || projData.title,
        description: projData.description,
        visibility: projData.visibility || 'private',
        template: projData.template || 'Kanban',
        health: projData.health || 'on_track',
        teamLeadId: projData.teamLeadId || ''
      });

      // Default the select role to developer if seeded
      const devRole = rolesData.find(r => r.name === 'Developer');
      setAddMemberForm(prev => ({
        ...prev,
        roleId: devRole ? devRole.id : rolesData[0]?.id || ''
      }));

      setLoading(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load project details.');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (role === 'Super Admin' || role === 'Dept Head') {
      getAllUsers().then((users: any[]) => {
        setTeamLeads(users);
      }).catch(err => console.error('Failed to load team leads', err));
    }
  }, [role]);

  const handleTeamLeadChange = async (newLeadId: string) => {
    if (!project) return;
    try {
      await updateProjectTeamLead(project.id, newLeadId);
      toast.success('Team leader updated successfully.');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update team leader.');
    }
  };

  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!taskForm.title.trim()) {
      toast.error('Task title is required.');
      return;
    }
    setIsSubmittingTask(true);
    try {
      await createTask(id, taskForm);
      setTaskModal(false);
      setTaskForm({ title: '', priority: 'Medium', deadline: '', assigneeId: '' });
      toast.success('Task created successfully!');
      loadData(); // Refetch tasks
    } catch (err: any) {
      console.error('Failed to create task:', err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to create task. Please check parameters.';
      toast.error(errMsg);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleOpenMemberModal = async () => {
    setMemberModal(true);
    try {
      const users = await getDirectoryUsers();
      const availableUsers = users.filter((u: any) => !project?.members.some(m => m.id === u.id));
      setDirectoryUsers(availableUsers);
      if (availableUsers.length > 0) {
        setAddMemberForm(prev => ({ ...prev, userId: availableUsers[0].id }));
      }
    } catch (err) {
      console.error('Failed to load directory users', err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !addMemberForm.userId) return;
    setIsAdding(true);
    try {
      await addProjectMember(id, addMemberForm.userId, addMemberForm.roleId, addMemberForm.capacityHours);
      setMemberModal(false);
      setAddMemberForm(prev => ({ ...prev, userId: '' }));
      toast.success('Member added successfully with role.');
      loadData();
    } catch (err) {
      console.error('Failed to add member', err);
      toast.error('Failed to add member.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenEditMemberModal = (member: any) => {
    if (!isAllowedToAddTask) return;
    setSelectedMember(member);
    const mRoleObj = projectRoles.find(r => r.name === member.role);
    setEditMemberForm({
      roleId: mRoleObj ? mRoleObj.id : projectRoles[0]?.id || '',
      capacityHours: member.capacityHours || 40
    });
    setEditMemberModal(true);
  };

  const handleUpdateMemberRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !selectedMember) return;
    try {
      await updateProjectMemberRole(project.id, selectedMember.id, editMemberForm.roleId, editMemberForm.capacityHours);
      setEditMemberModal(false);
      toast.success('Member project role/capacity updated.');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update member role.');
    }
  };

  const handleTransferOwnership = async () => {
    if (!project || !selectedMember) return;
    if (!confirm(`Are you sure you want to transfer PROJECT OWNERSHIP to ${selectedMember.name}? This will demote you to Project Manager.`)) return;
    try {
      await transferProjectOwnership(project.id, selectedMember.id);
      setEditMemberModal(false);
      toast.success(`Project ownership transferred to ${selectedMember.name}`);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Transfer ownership failed.');
    }
  };

  const handleRemoveMember = async () => {
    if (!project || !selectedMember) return;
    if (!confirm(`Are you sure you want to remove ${selectedMember.name} from this project?`)) return;
    try {
      await removeProjectMember(project.id, selectedMember.id);
      setEditMemberModal(false);
      toast.success('Member removed from project and group chat.');
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove member.');
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    try {
      await updateProject(project.id, settingsForm);
      toast.success('Project settings updated.');
      loadData();
      setActiveTab('overview');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update project settings.');
    }
  };

  const handleArchive = async () => {
    if (!project) return;
    try {
      if (project.archived_at) {
        await restoreProject(project.id);
        toast.success('Project restored successfully.');
      } else {
        if (!confirm('Are you sure you want to archive this project? It will be hidden from the active project overview.')) return;
        await archiveProject(project.id);
        toast.success('Project archived successfully.');
      }
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('Operation failed.');
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!confirm('Are you absolutely sure you want to delete this project? This will soft-delete the project and redirect you back to projects dashboard.')) return;
    try {
      await deleteProject(project.id);
      toast.success('Project deleted.');
      navigate('/projects');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete project.');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div></div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-gray-500">Project not found or unauthorized.</div>;
  }

  const isAllowedToAddTask = role === 'Super Admin' || role === 'Dept Head' || 
    (user && (
      user.id === project.creatorId || 
      user.id === project.teamLeadId
    ));

  return (
    <div className="min-h-full flex flex-col max-w-[1600px] mx-auto w-full pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0 bg-white/40 backdrop-blur-3xl p-6 rounded-3xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.06)] transition-all duration-500">
        <div>
          <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600 mb-2.5 transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1.5 transition-transform duration-300" /> Back to Projects
          </button>
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 tracking-tight drop-shadow-sm pb-1">
              {project.name || project.title}
            </h2>
            <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200/50 hover:shadow-indigo-300/50 hover:-translate-y-0.5 transition-all cursor-default">
              {project.stage}
            </span>
            {project.archived_at && (
              <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-amber-200/50 hover:-translate-y-0.5 transition-all cursor-default">
                Archived
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500 mt-2 font-medium flex items-center gap-2">
            <span>Lead:</span>
            {(role === 'Super Admin' || role === 'Dept Head' || (user && user.id === project.creatorId)) ? (
              <select
                value={project.teamLeadId || ''}
                onChange={(e) => handleTeamLeadChange(e.target.value)}
                className="bg-indigo-50 text-indigo-700 font-bold border-0 rounded-md py-0.5 px-1.5 cursor-pointer focus:ring-2 focus:ring-indigo-300 outline-none"
              >
                <option value="">Select Team Lead</option>
                {teamLeads.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
                {project.teamLeadId && !teamLeads.some(u => u.id === project.teamLeadId) && (
                  <option value={project.teamLeadId}>{project.teamLeadName}</option>
                )}
              </select>
            ) : (
              <span className="text-indigo-600 font-semibold">{project.teamLeadName || 'Unassigned'}</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            variant="secondary" 
            onClick={() => {
              const gid = project.groupId || project.channelId;
              if (gid) {
                navigate(`/messages?channel=${gid}`);
              } else {
                navigate('/messages');
              }
            }} 
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 shadow-sm hover:shadow-md border border-indigo-200 text-indigo-700 transition-all duration-300 hover:-translate-y-0.5 rounded-xl font-bold px-5 py-2.5"
          >
            <MessageCircle size={18} className="text-indigo-600" /> Project Discussion 💬
          </Button>
          {isAllowedToAddTask && !project.archived_at && (
            <Button variant="primary" onClick={() => setTaskModal(true)} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/50 transition-all duration-300 hover:-translate-y-0.5 rounded-xl text-white border-0 font-bold px-6 py-2.5">
              <Plus size={18} /> Add Task
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0 w-full">
        
        {/* Kanban Board / PR Area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-white p-2 rounded-2xl w-fit flex-wrap shadow-xs border border-slate-200/80">
            <button 
              onClick={() => setActiveTab('board')}
              className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-200 flex items-center gap-2 cursor-pointer ${activeTab === 'board' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold'}`}
            >
              <Activity size={18} /> Kanban Board
            </button>
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-200 flex items-center gap-2 cursor-pointer ${activeTab === 'overview' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold'}`}
            >
              <FileText size={18} /> Overview & Health
            </button>
            <button 
              onClick={() => setActiveTab('backlog')}
              className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-200 flex items-center gap-2 cursor-pointer ${activeTab === 'backlog' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold'}`}
            >
              <Sliders size={18} /> Backlog & Sprints
            </button>
            <button 
              onClick={() => setActiveTab('prs')}
              className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-200 flex items-center gap-2 cursor-pointer ${activeTab === 'prs' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold'}`}
            >
              <Clock size={18} /> Git & Code Reviews
            </button>
            {isAllowedToAddTask && (
              <button 
                onClick={() => setActiveTab('settings')}
                className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-200 flex items-center gap-2 cursor-pointer ${activeTab === 'settings' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold'}`}
              >
                <Settings size={18} /> Settings
              </button>
            )}
          </div>

          {activeTab === 'overview' && (
            <div className="flex-1 overflow-y-auto space-y-6 bg-white/40 backdrop-blur-2xl border border-white/80 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-8 relative">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Health widget */}
                <div className="bg-white/80 p-6 rounded-2xl border border-white/60 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">Project Health</h4>
                    <p className="text-sm font-semibold text-slate-400">Current execution status</p>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <span className={`w-4 h-4 rounded-full inline-block shadow-inner ${
                      project.health === 'on_track' ? 'bg-emerald-400 shadow-emerald-200 animate-pulse' :
                      project.health === 'at_risk' ? 'bg-amber-400 shadow-amber-200 animate-pulse' : 'bg-rose-400 shadow-rose-200 animate-pulse'
                    }`} />
                    <span className="font-black text-xl text-slate-800 capitalize tracking-tight">
                      {(project.health || 'on_track').replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Template widget */}
                <div className="bg-white/80 p-6 rounded-2xl border border-white/60 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-violet-500 transition-colors">Board Template</h4>
                    <p className="text-sm font-semibold text-slate-400">Process structure configured</p>
                  </div>
                  <div className="mt-5 flex">
                    <span className="font-black text-lg text-indigo-700 bg-indigo-50/80 border border-indigo-100/50 rounded-xl px-4 py-1.5 shadow-sm">
                      {project.template || 'Kanban'}
                    </span>
                  </div>
                </div>

                {/* Visibility widget */}
                <div className="bg-white/80 p-6 rounded-2xl border border-white/60 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">Visibility Scope</h4>
                    <p className="text-sm font-semibold text-slate-400">Who can see this workspace</p>
                  </div>
                  <div className="mt-5 flex">
                    <span className="font-black text-lg text-slate-700 bg-slate-100/80 border border-slate-200/50 rounded-xl px-4 py-1.5 shadow-sm capitalize">
                      {project.visibility || 'private'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description body */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-900 text-lg mb-3">Project Description & Scope</h3>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line text-sm">
                  {project.description || 'No description provided for this project.'}
                </p>
              </div>

              {/* Resource capacity allocation widget */}
              {allocations.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                      <Sliders size={18} className="text-indigo-500" /> Team Resource & Capacity Planning
                    </h3>
                    <span className="text-xs text-slate-400 font-semibold">Total Allocation workload limits</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allocations.map(alloc => (
                      <div key={alloc.userId} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-800">{alloc.name}</h4>
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">{alloc.projectRole}</p>
                          </div>
                          <span className="text-xs font-semibold text-slate-400">
                            {alloc.capacityHours}h/wk capacity
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs pt-1 text-slate-600 font-medium">
                          <span>Active Cards: <strong>{alloc.activeTasksCount}</strong></span>
                          <span>Story points workload: <strong>{alloc.totalStoryPoints} pts</strong></span>
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] font-extrabold text-slate-600 mb-1">
                            <span>Workload Allocation</span>
                            <span className={
                              alloc.workloadIndex > 90 ? 'text-rose-600' :
                              alloc.workloadIndex > 50 ? 'text-indigo-600' : 'text-emerald-600'
                            }>
                              {alloc.workloadIndex}% {alloc.workloadIndex > 90 && '(Over-allocated)'}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                alloc.workloadIndex > 90 ? 'bg-gradient-to-r from-rose-500 to-orange-500' :
                                alloc.workloadIndex > 50 ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                              }`} 
                              style={{ width: `${Math.min(alloc.workloadIndex, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sprint Velocity Analytics Widget */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    <Activity size={18} className="text-indigo-500" /> Sprint Velocity & Story Point Completion
                  </h3>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                    {velocityData?.averageVelocity || 34} Story Points / Sprint Avg
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase">Completed Points (Last Sprint)</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">{velocityData?.lastCompletedPoints || 38} pts</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Delivered on schedule</p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Sprint Completion Rate</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">{velocityData?.completionRate || 88}%</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Commitment accuracy</p>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-600 uppercase">Active Backlog Scope</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">{tasks.length} Tasks</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Items in queue</p>
                  </div>
                </div>
              </div>

              {/* Project Stats and progress bars */}
              {project.stats && (
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                  <h3 className="font-black text-slate-900 text-lg">Work Item Analytics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Tasks progress */}
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1 text-sm font-bold text-slate-700">
                          <span>Task Completion Ratio</span>
                          <span>
                            {project.stats.totalTasks > 0 
                              ? `${Math.round((project.stats.completedTasks / project.stats.totalTasks) * 100)}%`
                              : '0%'}
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000"
                            style={{ 
                              width: `${project.stats.totalTasks > 0 
                                ? (project.stats.completedTasks / project.stats.totalTasks) * 100 
                                : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <p className="font-black text-slate-800 text-base">{project.stats.totalTasks}</p>
                          <p className="text-slate-500 font-semibold">Total Cards</p>
                        </div>
                        <div className="p-2.5 bg-emerald-50 rounded-xl">
                          <p className="font-black text-emerald-600 text-base">{project.stats.completedTasks}</p>
                          <p className="text-emerald-700 font-semibold">Done</p>
                        </div>
                        <div className="p-2.5 bg-rose-50 rounded-xl">
                          <p className="font-black text-rose-600 text-base">{project.stats.overdueTasks}</p>
                          <p className="text-rose-700 font-semibold">Overdue</p>
                        </div>
                      </div>
                    </div>

                    {/* Git Code Review progress */}
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1 text-sm font-bold text-slate-700">
                          <span>PR Merge Ratio</span>
                          <span>
                            {project.stats.totalPRs > 0 
                              ? `${Math.round((project.stats.mergedPRs / project.stats.totalPRs) * 100)}%`
                              : '0%'}
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000"
                            style={{ 
                              width: `${project.stats.totalPRs > 0 
                                ? (project.stats.mergedPRs / project.stats.totalPRs) * 100 
                                : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-center text-xs pt-2">
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <p className="font-black text-slate-800 text-base">{project.stats.totalPRs}</p>
                          <p className="text-slate-500 font-semibold">Total PRs</p>
                        </div>
                        <div className="p-2.5 bg-emerald-50 rounded-xl">
                          <p className="font-black text-emerald-600 text-base">{project.stats.mergedPRs}</p>
                          <p className="text-emerald-700 font-semibold">Merged</p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'backlog' && (
            <BacklogPage projectId={project.id} project={project} isAllowedToEdit={isAllowedToAddTask} />
          )}

          {activeTab === 'board' && (
            <div className="flex-1 flex flex-col min-h-[550px] min-w-0 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-sm p-6 relative overflow-x-auto">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-indigo-50/40 blur-3xl -z-10 pointer-events-none"></div>
              <KanbanBoard 
                projectId={project.id} 
                tasks={tasks} 
                onTaskUpdated={loadData} 
                readOnly={!isAllowedToAddTask || !!project.archived_at} 
                channelId={project.channelId} 
                projectMembers={project.members}
              />
            </div>
          )}

          {activeTab === 'prs' && (
            <GitPRPanel projectId={project.id} />
          )}

          {activeTab === 'settings' && isAllowedToAddTask && (
            <div className="flex-1 overflow-y-auto bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 space-y-6">
              <h3 className="font-black text-slate-900 text-lg border-b pb-3">Project Workspace Settings</h3>
              
              <form onSubmit={handleUpdateSettings} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                  <Input 
                    type="text" required
                    value={settingsForm.name}
                    onChange={e => setSettingsForm({...settingsForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea 
                    className="novynth-input w-full min-h-[120px]" required
                    value={settingsForm.description}
                    onChange={e => setSettingsForm({...settingsForm, description: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Project Template</label>
                    <select
                      className="novynth-input w-full"
                      value={settingsForm.template}
                      onChange={e => setSettingsForm({...settingsForm, template: e.target.value})}
                    >
                      <option value="Kanban">Kanban Board (Default)</option>
                      <option value="Scrum">Scrum Sprint Board</option>
                      <option value="Bug Tracking">Bug / Defect Tracker</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Project Health</label>
                    <select
                      className="novynth-input w-full"
                      value={settingsForm.health}
                      onChange={e => setSettingsForm({...settingsForm, health: e.target.value as any})}
                    >
                      <option value="on_track">On Track</option>
                      <option value="at_risk">At Risk</option>
                      <option value="off_track">Off Track (Delayed)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Visibility Scope</label>
                  <select
                    className="novynth-input w-full"
                    value={settingsForm.visibility}
                    onChange={e => setSettingsForm({...settingsForm, visibility: e.target.value as any})}
                  >
                    <option value="private">Private (Invite Only)</option>
                    <option value="public">Public (Everyone in Org)</option>
                    <option value="department">Department-Scoped</option>
                    <option value="organization">Organization-Scoped</option>
                  </select>
                </div>

                <div className="pt-2 flex gap-3">
                  <Button type="submit" variant="primary">Save Configuration</Button>
                </div>
              </form>

              {/* Dangerous operations */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <h4 className="font-extrabold text-slate-800 text-sm">Dangerous / Admin Operations</h4>
                
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleArchive}
                    className="flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-colors bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                  >
                    <Archive size={14} /> 
                    {project.archived_at ? 'Restore Project' : 'Archive Project'}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-colors bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 size={14} /> Soft Delete Project
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Members Sidebar */}
        <div className="w-full xl:w-[380px] flex flex-col shrink-0 bg-white/40 backdrop-blur-2xl border border-white/80 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="p-6 border-b border-white/60 bg-white/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800 flex items-center gap-3 text-xl w-full">
                <div className="p-2.5 bg-indigo-100/80 rounded-xl text-indigo-600 shadow-sm"><Users size={20} /></div>
                Team Directory
                {isAllowedToAddTask && !project.archived_at && (
                  <button 
                    onClick={handleOpenMemberModal} 
                    className="ml-auto text-sm flex items-center gap-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg transition-all font-bold shadow-sm"
                  >
                    <Plus size={16} /> Invite
                  </button>
                )}
              </h3>
              <span className="text-xs font-black bg-slate-800 text-white px-3 py-1.5 rounded-full shadow-md ml-3">
                {project.members.length}
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-indigo-800 bg-indigo-50/80 p-3 rounded-xl border border-indigo-100 shadow-sm backdrop-blur-sm">
              <Info size={16} className="shrink-0 mt-0.5 text-indigo-600" />
              <span className="leading-relaxed font-medium">Click a member to modify project role, adjust weekly capacity, or transfer ownership.</span>
            </div>

            {/* Auto-created Project Group Chat Banner */}
            <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-md shadow-indigo-200/50 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-white shrink-0 shadow-inner">
                  <MessageSquare size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-indigo-200">Group Chat Sync</h4>
                  </div>
                  <p className="text-xs font-bold truncate text-white">Project: {project.name}</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/messages')}
                className="px-3 py-1.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold text-xs shadow transition-all hover:scale-105 shrink-0 flex items-center gap-1 cursor-pointer"
              >
                Chat <ExternalLink size={12} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white/20">
            {project.members.map(member => (
              <div 
                key={member.id} 
                onClick={() => handleOpenEditMemberModal(member)}
                className={`flex items-start gap-4 group p-3.5 rounded-2xl hover:bg-white/90 transition-all duration-300 border border-transparent hover:border-white hover:shadow-md relative ${isAllowedToAddTask && !project.archived_at ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-md ring-4 ring-white">
                  {getInitials(member.name)}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex justify-between items-center mb-0.5">
                    <h4 className="text-sm font-bold text-slate-900 truncate pr-2 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                      {member.name}
                      {member.role === 'Project Owner' && (
                        <span title="Project Owner"><Crown size={14} className="text-amber-500 shrink-0 drop-shadow-sm" /></span>
                      )}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/messages');
                      }}
                      title={`Send direct message to ${member.name}`}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <MessageCircle size={15} />
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">{member.role || 'Developer'}</p>
                  
                  {/* Contribution Rate Widget */}
                  <div className="mt-2.5 flex items-center gap-2.5" title={`Weekly Capacity: ${member.capacityHours || 40} Hours`}>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(((member.capacityHours || 40) / 40) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 w-8 text-right tracking-tight">
                      {member.capacityHours || 40} hrs
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal isOpen={taskModal} onClose={() => setTaskModal(false)} title="Create New Task">
        <form onSubmit={handleCreateTask} className="p-2 space-y-5">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input 
              type="text" 
              required 
              placeholder="e.g. Implement user authentication workflow"
              value={taskForm.title} 
              onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} 
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-xl text-sm font-semibold text-slate-800 transition-all outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">Priority</label>
              <select 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-xl text-sm font-bold text-slate-700 transition-all outline-none cursor-pointer"
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">Deadline</label>
              <input 
                type="date" 
                value={taskForm.deadline} 
                onChange={e => setTaskForm({ ...taskForm, deadline: e.target.value })} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-xl text-sm font-semibold text-slate-800 transition-all outline-none cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
              Assignee Member
            </label>
            <select 
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-xl text-sm font-bold text-slate-700 transition-all outline-none cursor-pointer"
              value={taskForm.assigneeId}
              onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
            >
              <option value="">Unassigned (Open Backlog)</option>
              {project?.members.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.role || 'Member'})</option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-3 items-center">
            <button 
              type="button" 
              onClick={() => setTaskModal(false)}
              className="px-4 py-2.5 text-xs font-extrabold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmittingTask}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingTask ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Task...
                </>
              ) : (
                'Create Task'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={memberModal} onClose={() => setMemberModal(false)} title="Invite Team Member">
        <form onSubmit={handleAddMember} className="p-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Employee</label>
            <select 
              className="novynth-input w-full"
              value={addMemberForm.userId}
              onChange={e => setAddMemberForm({ ...addMemberForm, userId: e.target.value })}
              required
            >
              <option value="">Choose employee...</option>
              {directoryUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role}) - {u.email}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Project Role</label>
              <select 
                className="novynth-input w-full"
                value={addMemberForm.roleId}
                onChange={e => setAddMemberForm({ ...addMemberForm, roleId: e.target.value })}
                required
              >
                {projectRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Weekly Capacity (Hours)</label>
              <Input 
                type="number" 
                min={0} max={168} required
                value={addMemberForm.capacityHours}
                onChange={e => setAddMemberForm({ ...addMemberForm, capacityHours: Number(e.target.value) })}
              />
            </div>
          </div>
          
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setMemberModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!addMemberForm.userId || isAdding}>
              {isAdding ? 'Inviting...' : 'Invite to Project'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editMemberModal} onClose={() => setEditMemberModal(false)} title="Manage Project Member">
        {selectedMember && (
          <form onSubmit={handleUpdateMemberRole} className="p-2 space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold">
                {getInitials(selectedMember.name)}
              </div>
              <div>
                <h4 className="font-bold text-slate-900">{selectedMember.name}</h4>
                <p className="text-xs text-slate-500">Currently: {selectedMember.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Project Role</label>
                <select 
                  className="novynth-input w-full"
                  value={editMemberForm.roleId}
                  onChange={e => setEditMemberForm({ ...editMemberForm, roleId: e.target.value })}
                  required
                >
                  {projectRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Weekly Capacity (Hours)</label>
                <Input 
                  type="number" 
                  min={0} max={168} required
                  value={editMemberForm.capacityHours}
                  onChange={e => setEditMemberForm({ ...editMemberForm, capacityHours: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="pt-4 border-t flex flex-col gap-2">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditMemberModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Update Member</Button>
              </div>

              {selectedMember.role !== 'Project Owner' && (
                <div className="pt-2 flex flex-wrap gap-2 justify-between">
                  <button
                    type="button"
                    onClick={handleTransferOwnership}
                    className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors"
                  >
                    <Crown size={12} /> Transfer Ownership
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveMember}
                    className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors"
                  >
                    <Trash2 size={12} /> Remove from Project
                  </button>
                </div>
              )}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
