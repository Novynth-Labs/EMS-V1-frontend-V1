import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  getMyTasks, 
  getAllTasks, 
  getTasks, 
  getProjects, 
  createTask, 
  updateTask, 
  updateTaskStatus, 
  type Project, 
  type ProjectTask, 
  type TaskStatus,
  type TaskPriority 
} from '../../api/projects.api';
import { getAllUsers } from '../../api/admin.api';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  FolderKanban, 
  Plus, 
  Search, 
  Filter, 
  ArrowUpDown, 
  User, 
  Trash2, 
  Edit3, 
  ArrowRight,
  Check,
  Layers,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../utils/toast';
import { useAuthStore } from '../../store/authStore';

const COLUMNS: TaskStatus[] = ['To Do', 'In Progress', 'Review', 'Done'];

export const TasksPage: React.FC = () => {
  const { user, role } = useAuthStore();
  const isPrivileged = ['Super Admin', 'Dept Head', 'Team Lead', 'CEO', 'CTO', 'Admin'].includes(role || user?.role || '');

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Filters & State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [scope, setScope] = useState<'assigned' | 'all'>(isPrivileged ? 'all' : 'assigned');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'deadline_asc' | 'deadline_desc' | 'priority_desc' | 'created_desc'>('deadline_asc');

  // Modal State
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalAssigneeId, setModalAssigneeId] = useState('');
  const [modalPriority, setModalPriority] = useState<TaskPriority>('Medium');
  const [modalDeadline, setModalDeadline] = useState(new Date().toISOString().split('T')[0]);
  const [submittingTask, setSubmittingTask] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Projects
      const projs = await getProjects();
      setProjects(projs);

      // 2. Users
      const uList = await getAllUsers().catch(() => []);
      setUsers(uList);

      // 3. Tasks
      let list: ProjectTask[] = [];
      if (selectedProjectId !== 'all') {
        list = await getTasks(selectedProjectId);
      } else if (scope === 'all' && isPrivileged) {
        list = await getAllTasks({ scope: 'all' });
      } else {
        list = await getMyTasks({ scope: 'assigned' });
      }
      setTasks(list);
    } catch (err) {
      console.error('Failed to load tasks', err);
      toast.error('Failed to load project deliverables');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, scope, isPrivileged]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('opacity-50');
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null);
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('opacity-50');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    if (task && task.status !== status) {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, status } : t));
      try {
        await updateTaskStatus(task.projectId || '', draggedTaskId, status);
      } catch (err) {
        loadData();
        toast.error('Failed to transition task status');
      }
    }
    setDraggedTaskId(null);
  };

  const isOverdue = (deadline: string, status: TaskStatus) => {
    if (status === 'Done') return false;
    if (!deadline || deadline === 'No deadline') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    return !isNaN(deadlineDate.getTime()) && deadlineDate < today;
  };

  const getDaysOverdue = (deadline: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((today.getTime() - new Date(deadline).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  };

  const getPriorityColor = (priority: string) => {
    const p = (priority || '').toUpperCase();
    if (p === 'HIGH' || p === 'URGENT') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (p === 'MEDIUM') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };

  // Filtered & Sorted dataset
  const processedTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q);
          const matchProj = t.projectName?.toLowerCase().includes(q);
          const matchAssignee = t.assigneeName?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchProj && !matchAssignee) return false;
        }

        // Priority filter
        if (selectedPriority !== 'All') {
          if (t.priority.toUpperCase() !== selectedPriority.toUpperCase()) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline_asc') return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (sortBy === 'deadline_desc') return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
        if (sortBy === 'priority_desc') {
          const rank: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (rank[b.priority.toUpperCase()] || 0) - (rank[a.priority.toUpperCase()] || 0);
        }
        if (sortBy === 'created_desc') {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA;
        }
        return 0;
      });
  }, [tasks, selectedPriority, searchQuery, sortBy]);

  const handleQuickAdvance = async (task: ProjectTask) => {
    let nextStatus: TaskStatus = 'In Progress';
    if (task.status === 'To Do') nextStatus = 'In Progress';
    else if (task.status === 'In Progress') nextStatus = 'Review';
    else if (task.status === 'Review') nextStatus = 'Done';
    else return;

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    try {
      await updateTaskStatus(task.projectId || '', task.id, nextStatus);
    } catch {
      loadData();
      toast.error('Failed to advance task status');
    }
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setModalTitle('');
    setModalDescription('');
    setModalProjectId(selectedProjectId !== 'all' ? selectedProjectId : projects[0]?.id || '');
    setModalAssigneeId(user?.id || '');
    setModalPriority('Medium');
    setModalDeadline(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
    setTaskModalOpen(true);
  };

  const openEditModal = (task: ProjectTask) => {
    setEditingTask(task);
    setModalTitle(task.title);
    setModalDescription(task.description || '');
    setModalProjectId(task.projectId || projects[0]?.id || '');
    setModalAssigneeId(task.assigneeId || '');
    setModalPriority(task.priority);
    setModalDeadline(task.deadline ? task.deadline.split('T')[0] : new Date().toISOString().split('T')[0]);
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      toast.error('Please enter a task title.');
      return;
    }
    if (!modalProjectId) {
      toast.error('Please select an associated project.');
      return;
    }

    setSubmittingTask(true);
    try {
      if (editingTask) {
        await updateTask(editingTask.id, {
          title: modalTitle.trim(),
          description: modalDescription.trim(),
          priority: modalPriority,
          deadline: modalDeadline,
        });
        toast.success('Task updated successfully.');
      } else {
        await createTask(modalProjectId, {
          title: modalTitle.trim(),
          description: modalDescription.trim(),
          priority: modalPriority,
          deadline: modalDeadline,
          assigneeId: modalAssigneeId || undefined,
        });
        toast.success('Task created successfully.');
      }
      setTaskModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Operation failed');
    } finally {
      setSubmittingTask(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-6rem)] flex flex-col space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Project Tasks & Deliverables</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Tracking {processedTasks.length} sprint items across workspace projects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isPrivileged && (
            <Button
              variant="primary"
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 text-white rounded-xl font-bold px-4 py-2.5"
            >
              <Plus size={16} /> New Task
            </Button>
          )}
        </div>
      </div>

      {/* Control Bar: Project Filter, Search, Priority & Sort */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Project Dropdown */}
          <div className="flex items-center gap-2 min-w-[200px]">
            <FolderKanban size={16} className="text-slate-400" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none w-full"
            >
              <option value="all">All Projects ({tasks.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Scope Toggle for Privileged Roles */}
          {isPrivileged && (
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setScope('assigned')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  scope === 'assigned' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                My Deliverables
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  scope === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Team Tasks
              </button>
            </div>
          )}

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            {['All', 'URGENT', 'High', 'Medium', 'Low'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPriority(p)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  selectedPriority === p ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Right side: Search & Sorting */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks or members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={15} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="deadline_asc">Due: Earliest First</option>
              <option value="deadline_desc">Due: Latest First</option>
              <option value="priority_desc">Priority: Highest First</option>
              <option value="created_desc">Created: Newest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Board Columns */}
      {processedTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
          <CheckCircle size={48} className="text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No tasks found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
            {searchQuery
              ? `No deliverables matched your search query "${searchQuery}".`
              : 'There are currently no tasks matching your selected filters.'}
          </p>
          {isPrivileged && (
            <Button variant="secondary" onClick={openCreateModal} className="mt-4 text-xs">
              <Plus size={14} className="mr-1.5" /> Create New Task
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colTasks = processedTasks.filter((t) => t.status === col);
            return (
              <div
                key={col}
                className="flex-1 min-w-[310px] bg-slate-50/70 rounded-2xl border border-slate-200/80 flex flex-col"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col)}
              >
                <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between bg-white/60 rounded-t-2xl">
                  <h4 className="font-black text-xs text-slate-800 uppercase tracking-wide">{col}</h4>
                  <span className="text-xs font-bold bg-white text-slate-600 px-2.5 py-0.5 rounded-full shadow-sm border border-slate-100">
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {colTasks.map((task) => {
                    const overdue = isOverdue(task.deadline, task.status);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white p-4 rounded-2xl shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
                          overdue ? 'border-l-4 border-l-rose-500 border-slate-200' : 'border-slate-200/80'
                        }`}
                      >
                        {/* Overdue Badge */}
                        {overdue && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg mb-2.5">
                            <AlertTriangle size={13} /> Overdue by {getDaysOverdue(task.deadline)} day(s)
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-2">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider border ${getPriorityColor(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>

                          {isPrivileged && (
                            <button
                              onClick={() => openEditModal(task)}
                              className="text-slate-400 hover:text-indigo-600 p-1 transition-colors"
                              title="Edit Task"
                            >
                              <Edit3 size={13} />
                            </button>
                          )}
                        </div>

                        <h5 className="font-bold text-sm text-slate-900 leading-snug mb-1.5">{task.title}</h5>
                        {task.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Meta: Assignee, Project, Deadline */}
                        <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                                {(task.assigneeName || 'U').charAt(0)}
                              </div>
                              <span className="font-semibold text-slate-700">{task.assigneeName || 'Unassigned'}</span>
                            </div>

                            {task.projectId && (
                              <Link
                                to={`/projects/${task.projectId}`}
                                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                              >
                                <FolderKanban size={12} />
                                <span className="max-w-[110px] truncate">{task.projectName}</span>
                              </Link>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1">
                            <div className="flex items-center gap-1">
                              <Clock size={12} className={overdue ? 'text-rose-500' : ''} />
                              <span className={overdue ? 'text-rose-600 font-bold' : ''}>
                                Due: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>

                            {task.status !== 'Done' ? (
                              <button
                                onClick={() => handleQuickAdvance(task)}
                                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors"
                              >
                                <span>Advance</span>
                                <ArrowRight size={10} />
                              </button>
                            ) : (
                              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                <Check size={12} /> Done
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Task Modal */}
      <Modal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title={editingTask ? 'Edit Task Deliverable' : 'Create Project Task'}
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Implement OAuth Flow"
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Description</label>
            <textarea
              rows={3}
              placeholder="Requirements, acceptance criteria, or context..."
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!editingTask && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Project *</label>
                <select
                  required
                  value={modalProjectId}
                  onChange={(e) => setModalProjectId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Assignee</label>
              <select
                value={modalAssigneeId}
                onChange={(e) => setModalAssigneeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Priority</label>
              <select
                value={modalPriority}
                onChange={(e: any) => setModalPriority(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Due Date</label>
              <input
                type="date"
                required
                value={modalDeadline}
                onChange={(e) => setModalDeadline(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setTaskModalOpen(false)} disabled={submittingTask}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submittingTask}>
              {editingTask ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
