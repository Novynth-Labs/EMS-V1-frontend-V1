import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  getMyTasks, 
  getAllTasks, 
  getTasks, 
  getProjects, 
  createTask, 
  updateTask, 
  updateTaskStatus, 
  updateTaskAssignee,
  deleteTask,
  type Project, 
  type ProjectTask, 
  type TaskStatus,
  type TaskPriority 
} from '../../api/projects.api';
import { getAllUsers } from '../../api/admin.api';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  FolderKanban, 
  Plus, 
  Search, 
  ArrowUpDown, 
  User, 
  UserPlus,
  Trash2, 
  Edit3, 
  ArrowRight,
  ArrowLeft,
  Check,
  Radio,
  Eye,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  Flame,
  CheckSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../utils/toast';
import { useAuthStore } from '../../store/authStore';
import { socket } from '../../services/socket';

interface ColumnDef {
  id: TaskStatus;
  label: string;
  dotColor: string;
  badgeBg: string;
  headerBorder: string;
  accentBg: string;
}

const COLUMNS: ColumnDef[] = [
  { 
    id: 'To Do', 
    label: 'To Do', 
    dotColor: 'bg-slate-400', 
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    headerBorder: 'border-t-slate-400',
    accentBg: 'hover:border-slate-300'
  },
  { 
    id: 'In Progress', 
    label: 'In Progress', 
    dotColor: 'bg-blue-500', 
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    headerBorder: 'border-t-blue-500',
    accentBg: 'hover:border-blue-300'
  },
  { 
    id: 'Review', 
    label: 'Review', 
    dotColor: 'bg-purple-500', 
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
    headerBorder: 'border-t-purple-500',
    accentBg: 'hover:border-purple-300'
  },
  { 
    id: 'Completed', 
    label: 'Completed', 
    dotColor: 'bg-emerald-500', 
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    headerBorder: 'border-t-emerald-500',
    accentBg: 'hover:border-emerald-300'
  },
];

export const TasksPage: React.FC = () => {
  const { user, role } = useAuthStore();
  const normRole = (role || user?.role || '').toLowerCase().trim().replace(/_/g, ' ');
  const isPrivileged = ['super admin', 'admin', 'dept head', 'department head', 'team lead', 'ceo', 'cto', 'hr'].includes(normRole);

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  // Drag & Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Filters & State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [scope, setScope] = useState<'assigned' | 'all'>('assigned');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'deadline_asc' | 'deadline_desc' | 'priority_desc' | 'created_desc'>('deadline_asc');

  // Modal State for Create / Edit
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalAssigneeId, setModalAssigneeId] = useState('');
  const [modalPriority, setModalPriority] = useState<TaskPriority>('Medium');
  const [modalDeadline, setModalDeadline] = useState(new Date().toISOString().split('T')[0]);
  const [modalStatus, setModalStatus] = useState<TaskStatus>('To Do');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Task Details Modal
  const [viewingTask, setViewingTask] = useState<ProjectTask | null>(null);

  // Task Delete Modal
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  // Fetch all initial data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // 1. Projects
      const projs = await getProjects();
      setProjects(projs);

      // 2. Users (silently catch if regular employee doesn't have admin access)
      const uList = await getAllUsers().catch(() => []);
      setUsers(uList);

      // 3. Tasks
      let list: ProjectTask[] = [];
      if (selectedProjectId !== 'all') {
        if (scope === 'assigned') {
          list = await getMyTasks({ projectId: selectedProjectId, scope: 'assigned' });
        } else {
          list = await getTasks(selectedProjectId);
        }
      } else if (scope === 'all') {
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
      setRefreshing(false);
    }
  }, [selectedProjectId, scope]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time WebSocket Listeners
  useEffect(() => {
    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    setSocketConnected(socket.connected);

    // Real-time task moved event
    const handleTaskMoved = (data: any) => {
      if (!data || !data.taskId) return;
      const tId = String(data.taskId);
      const rawStatus = data.status || data.columnName;
      const targetStatus: TaskStatus = (rawStatus === 'Done' ? 'Completed' : rawStatus) || 'To Do';

      setTasks(prev => prev.map(t => {
        if (t.id === tId) {
          return { ...t, status: targetStatus, columnId: data.targetColumnId };
        }
        return t;
      }));

      // Update viewing modal if open
      setViewingTask(current => (current && current.id === tId ? { ...current, status: targetStatus } : current));
    };

    // Real-time task created event
    const handleTaskCreated = (newTask: any) => {
      if (!newTask || !newTask.id) return;
      const mappedTask: ProjectTask = {
        ...newTask,
        id: String(newTask.id),
        deadline: newTask.deadline ? newTask.deadline.split('T')[0] : 'No deadline',
        status: (newTask.status === 'Done' ? 'Completed' : newTask.status) || 'To Do',
        priority: newTask.priority || 'Medium',
        projectName: newTask.projectName || 'General Project',
        assigneeName: newTask.assigneeName || 'Unassigned'
      };

      setTasks(prev => {
        if (prev.some(t => t.id === mappedTask.id)) return prev;
        return [mappedTask, ...prev];
      });
    };

    // Real-time task updated event
    const handleTaskUpdated = (updatedTask: any) => {
      if (!updatedTask || !updatedTask.id) return;
      const tId = String(updatedTask.id);

      setTasks(prev => prev.map(t => {
        if (t.id === tId) {
          return {
            ...t,
            ...updatedTask,
            id: tId,
            deadline: updatedTask.deadline ? updatedTask.deadline.split('T')[0] : t.deadline,
            status: (updatedTask.status === 'Done' ? 'Completed' : updatedTask.status) || t.status,
            priority: updatedTask.priority || t.priority,
            assigneeName: updatedTask.assigneeName || t.assigneeName,
            projectName: updatedTask.projectName || t.projectName
          };
        }
        return t;
      }));

      // Update viewing modal if open
      setViewingTask(current => (current && current.id === tId ? { ...current, ...updatedTask } : current));
    };

    // Real-time task deleted event
    const handleTaskDeleted = (data: any) => {
      if (!data || !data.taskId) return;
      const tId = String(data.taskId);
      setTasks(prev => prev.filter(t => t.id !== tId));
      setViewingTask(current => (current && current.id === tId ? null : current));
    };

    socket.on('kanban_task_moved', handleTaskMoved);
    socket.on('task_created', handleTaskCreated);
    socket.on('task_updated', handleTaskUpdated);
    socket.on('task_deleted', handleTaskDeleted);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('kanban_task_moved', handleTaskMoved);
      socket.off('task_created', handleTaskCreated);
      socket.off('task_updated', handleTaskUpdated);
      socket.off('task_deleted', handleTaskDeleted);
    };
  }, []);

  // Join project rooms for live synchronization
  useEffect(() => {
    if (projects.length > 0) {
      projects.forEach(p => {
        socket.emit('join_project', p.id);
      });
    }
  }, [projects]);

  // Compute available assignees for task creation/editing
  const availableAssignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string }>();
    if (user?.id) {
      map.set(String(user.id), { id: String(user.id), name: `${user.name || 'Me'} (You)`, role: user.role });
    }
    const targetProjectId = modalProjectId || selectedProjectId;
    const proj = projects.find(p => String(p.id) === String(targetProjectId));
    if (proj?.members) {
      proj.members.forEach(m => {
        if (m.id && !map.has(String(m.id))) {
          map.set(String(m.id), { id: String(m.id), name: m.name, role: m.role });
        }
      });
    }
    users.forEach(u => {
      if (u.id && !map.has(String(u.id))) {
        map.set(String(u.id), { id: String(u.id), name: u.name, role: u.role });
      }
    });
    return Array.from(map.values());
  }, [user, projects, modalProjectId, selectedProjectId, users]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('opacity-40', 'scale-95');
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('opacity-40', 'scale-95');
    }
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === targetStatus) {
      setDraggedTaskId(null);
      return;
    }

    const previousStatus = task.status;

    // Optimistic state update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetStatus } : t));

    try {
      await updateTaskStatus(task.projectId || '', taskId, targetStatus);
      toast.success(`Moved to ${targetStatus}`);
    } catch (err: any) {
      // Rollback on failure
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: previousStatus } : t));
      toast.error(err.response?.data?.error?.message || 'Failed to transition task status');
    } finally {
      setDraggedTaskId(null);
    }
  };

  // Quick Advance and Revert
  const handleQuickAdvance = async (task: ProjectTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let nextStatus: TaskStatus = 'In Progress';
    if (task.status === 'To Do') nextStatus = 'In Progress';
    else if (task.status === 'In Progress') nextStatus = 'Review';
    else if (task.status === 'Review') nextStatus = 'Completed';
    else return;

    const oldStatus = task.status;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));

    try {
      await updateTaskStatus(task.projectId || '', task.id, nextStatus);
      toast.success(`Task advanced to ${nextStatus}`);
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: oldStatus } : t));
      toast.error('Failed to advance task status');
    }
  };

  const handleQuickRevert = async (task: ProjectTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let prevStatus: TaskStatus = 'To Do';
    if (task.status === 'Completed' || task.status === 'Done') prevStatus = 'Review';
    else if (task.status === 'Review') prevStatus = 'In Progress';
    else if (task.status === 'In Progress') prevStatus = 'To Do';
    else return;

    const oldStatus = task.status;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: prevStatus } : t));

    try {
      await updateTaskStatus(task.projectId || '', task.id, prevStatus);
      toast.success(`Task moved back to ${prevStatus}`);
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: oldStatus } : t));
      toast.error('Failed to move task');
    }
  };

  // Self-assignment / Claim Task Action
  const handleClaimTask = async (task: ProjectTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user?.id) return;
    const oldAssigneeId = task.assigneeId;
    const oldAssigneeName = task.assigneeName;

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, assigneeId: String(user.id), assigneeName: user.name || 'You' } : t));

    try {
      await updateTaskAssignee(task.id, String(user.id));
      toast.success('Task claimed and assigned to you!');
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, assigneeId: oldAssigneeId, assigneeName: oldAssigneeName } : t));
      toast.error(err.response?.data?.error?.message || 'Failed to claim task');
    }
  };

  // Delete Task Action
  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setDeletingTask(true);
    try {
      await deleteTask(taskToDelete.id);
      setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
      if (viewingTask?.id === taskToDelete.id) {
        setViewingTask(null);
      }
      toast.success('Task deleted successfully');
      setTaskToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete task');
    } finally {
      setDeletingTask(false);
    }
  };

  // Overdue and Date Helpers
  const isOverdue = (deadline: string, status: TaskStatus) => {
    if (status === 'Completed' || status === 'Done') return false;
    if (!deadline || deadline === 'No deadline') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    return !isNaN(deadlineDate.getTime()) && deadlineDate < today;
  };

  const isDueToday = (deadline: string, status: TaskStatus) => {
    if (status === 'Completed' || status === 'Done') return false;
    if (!deadline || deadline === 'No deadline') return false;
    const today = new Date().toISOString().split('T')[0];
    return deadline.split('T')[0] === today;
  };

  const getDaysOverdue = (deadline: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((today.getTime() - new Date(deadline).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || '').toUpperCase();
    if (p === 'URGENT') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
          <Flame size={11} className="text-rose-600" /> URGENT
        </span>
      );
    }
    if (p === 'HIGH') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
          High
        </span>
      );
    }
    if (p === 'LOW') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
          Low
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
        Medium
      </span>
    );
  };

  // Filtered & Sorted dataset
  const processedTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchDesc = t.description?.toLowerCase().includes(q);
          const matchProj = t.projectName?.toLowerCase().includes(q);
          const matchAssignee = t.assigneeName?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchProj && !matchAssignee) return false;
        }

        // Priority Filter
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

  // Modal Open Handlers
  const openCreateModal = (defaultStatus?: TaskStatus) => {
    setEditingTask(null);
    setModalTitle('');
    setModalDescription('');
    setModalProjectId(selectedProjectId !== 'all' ? selectedProjectId : projects[0]?.id || '');
    // Default assignee to logged in user for true self-service flow
    setModalAssigneeId(user?.id ? String(user.id) : '');
    setModalPriority('Medium');
    setModalStatus(defaultStatus || 'To Do');
    setModalDeadline(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
    setTaskModalOpen(true);
  };

  const openEditModal = (task: ProjectTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTask(task);
    setModalTitle(task.title);
    setModalDescription(task.description || '');
    setModalProjectId(task.projectId || projects[0]?.id || '');
    setModalAssigneeId(task.assigneeId || '');
    setModalPriority(task.priority);
    setModalStatus(task.status);
    setModalDeadline(task.deadline && task.deadline !== 'No deadline' ? task.deadline.split('T')[0] : new Date().toISOString().split('T')[0]);
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
        const updated = await updateTask(editingTask.id, {
          title: modalTitle.trim(),
          description: modalDescription.trim(),
          priority: modalPriority,
          deadline: modalDeadline,
          assigneeId: modalAssigneeId || undefined
        });

        // Also update status if changed
        if (modalStatus !== editingTask.status) {
          await updateTaskStatus(modalProjectId, editingTask.id, modalStatus);
        }

        setTasks(prev => prev.map(t => {
          if (t.id === editingTask.id) {
            const assigneeObj = availableAssignees.find(a => a.id === modalAssigneeId);
            return {
              ...t,
              title: modalTitle.trim(),
              description: modalDescription.trim(),
              priority: modalPriority,
              deadline: modalDeadline,
              status: modalStatus,
              assigneeId: modalAssigneeId || undefined,
              assigneeName: assigneeObj ? assigneeObj.name.replace(' (You)', '') : t.assigneeName
            };
          }
          return t;
        }));

        toast.success('Task updated successfully.');
      } else {
        const created = await createTask(modalProjectId, {
          title: modalTitle.trim(),
          description: modalDescription.trim(),
          priority: modalPriority,
          deadline: modalDeadline,
          assigneeId: modalAssigneeId || undefined,
        });

        const currentProj = projects.find(p => String(p.id) === String(modalProjectId));
        const assigneeObj = availableAssignees.find(a => a.id === modalAssigneeId);

        const fullCreated: ProjectTask = {
          ...created,
          projectId: modalProjectId,
          projectName: currentProj?.title || currentProj?.name || 'Assigned Project',
          assigneeName: assigneeObj ? assigneeObj.name.replace(' (You)', '') : 'Unassigned',
          status: 'To Do'
        };

        setTasks(prev => [fullCreated, ...prev]);
        toast.success('Task created successfully.');
      }
      setTaskModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Operation failed');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Quick deadline setter helper
  const setQuickDeadline = (days: number) => {
    const d = new Date(Date.now() + 86400000 * days);
    setModalDeadline(d.toISOString().split('T')[0]);
  };

  // Check if current user can edit or delete a task
  const canModifyTask = (task: ProjectTask) => {
    if (isPrivileged) return true;
    if (task.assigneeId && String(task.assigneeId) === String(user?.id)) return true;
    return true; // Self-service project member permission
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-80 space-y-4">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
          <Sparkles size={18} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading deliverables...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-6rem)] flex flex-col space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Self-Service Task Management
            </h1>
            {/* Live Socket Status Pill */}
            <div 
              className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                socketConnected 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title={socketConnected ? 'Connected to live WebSocket updates' : 'Reconnecting to live sync...'}
            >
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="hidden sm:inline">{socketConnected ? 'Live Sync Active' : 'Connecting...'}</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Independently track project deliverables, manage tasks on the interactive Kanban board, and collaborate in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:border-indigo-200 shadow-xs transition-all active:scale-95 disabled:opacity-50"
            title="Refresh Deliverables"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-600' : ''} />
          </button>

          {/* Self-Service New Task Button (Available to all employees) */}
          <Button
            variant="primary"
            onClick={() => openCreateModal()}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-md shadow-indigo-100 text-white rounded-xl font-bold px-4 py-2.5 transition-all active:scale-95"
          >
            <Plus size={16} /> New Task
          </Button>
        </div>
      </div>

      {/* Control Bar: Project Filter, Scope Toggle, Search, Priority & Sort */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Project Dropdown */}
          <div className="flex items-center gap-2 min-w-[220px]">
            <FolderKanban size={16} className="text-slate-400 shrink-0" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none w-full transition-colors cursor-pointer"
            >
              <option value="all">All Assigned Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Scope Toggle: My Deliverables vs All Team Tasks (Available to everyone) */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setScope('assigned')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                scope === 'assigned' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User size={13} />
              My Tasks
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                scope === 'all' 
                  ? 'bg-white text-indigo-700 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers size={13} />
              All Team Tasks
            </button>
          </div>

          {/* Priority Filter Chips */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            {['All', 'URGENT', 'High', 'Medium', 'Low'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPriority(p)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  selectedPriority === p ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Right side: Search & Sorting */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search deliverables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 min-w-[170px]">
            <ArrowUpDown size={14} className="text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2 focus:ring-2 focus:ring-indigo-500 outline-none w-full cursor-pointer"
            >
              <option value="deadline_asc">Due: Earliest First</option>
              <option value="deadline_desc">Due: Latest First</option>
              <option value="priority_desc">Priority: High to Low</option>
              <option value="created_desc">Created: Newest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      {processedTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-dashed border-slate-300">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <CheckSquare size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No deliverables found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
            {searchQuery
              ? `No tasks matched your search query "${searchQuery}".`
              : scope === 'assigned'
              ? 'You do not have any active tasks assigned in this project view.'
              : 'There are currently no tasks in the selected project.'}
          </p>
          <Button 
            variant="primary" 
            onClick={() => openCreateModal()} 
            className="mt-5 text-xs font-bold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
          >
            <Plus size={14} className="mr-1.5" /> Create New Task
          </Button>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col) => {
            const colTasks = processedTasks.filter((t) => t.status === col.id);
            const isDragTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`bg-slate-50/80 rounded-2xl border flex flex-col transition-all min-h-[500px] ${
                  isDragTarget 
                    ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-400/40 shadow-md' 
                    : 'border-slate-200/90 shadow-2xs'
                }`}
              >
                {/* Column Header */}
                <div className={`p-3.5 border-b border-slate-200/80 flex items-center justify-between bg-white rounded-t-2xl border-t-4 ${col.headerBorder}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">{col.label}</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                      {colTasks.length}
                    </span>
                    <button
                      onClick={() => openCreateModal(col.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                      title={`Add task in ${col.label}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Task Cards Container */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-18rem)]">
                  {colTasks.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold p-4 text-center">
                      <span>No tasks in {col.label}</span>
                      <button 
                        onClick={() => openCreateModal(col.id)} 
                        className="mt-2 text-[11px] text-indigo-600 hover:underline font-bold flex items-center gap-1"
                      >
                        <Plus size={12} /> Add a task
                      </button>
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const overdue = isOverdue(task.deadline, task.status);
                      const dueToday = isDueToday(task.deadline, task.status);
                      const isAssignedToMe = String(task.assigneeId) === String(user?.id);
                      const canModify = canModifyTask(task);

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setViewingTask(task)}
                          className={`group bg-white p-4 rounded-2xl shadow-2xs border cursor-grab active:cursor-grabbing hover:shadow-md transition-all hover:-translate-y-0.5 ${
                            overdue 
                              ? 'border-l-4 border-l-rose-500 border-slate-200/90' 
                              : dueToday
                              ? 'border-l-4 border-l-amber-500 border-slate-200/90'
                              : isAssignedToMe
                              ? 'border-l-4 border-l-indigo-600 border-slate-200/90'
                              : 'border-slate-200/90'
                          }`}
                        >
                          {/* Top Badges: Overdue / Due Today Banner */}
                          {overdue && (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50/90 border border-rose-200 px-2.5 py-1 rounded-lg mb-2.5">
                              <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                              <span>Overdue by {getDaysOverdue(task.deadline)} day(s)</span>
                            </div>
                          )}

                          {dueToday && (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50/90 border border-amber-200 px-2.5 py-1 rounded-lg mb-2.5">
                              <Clock size={13} className="text-amber-600 shrink-0" />
                              <span>Due Today</span>
                            </div>
                          )}

                          {/* Priority and Action Buttons */}
                          <div className="flex justify-between items-start mb-2 gap-2">
                            {getPriorityBadge(task.priority)}

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canModify && (
                                <button
                                  onClick={(e) => openEditModal(task, e)}
                                  className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                                  title="Edit Task"
                                >
                                  <Edit3 size={13} />
                                </button>
                              )}
                              {canModify && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTaskToDelete(task);
                                  }}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                                  title="Delete Task"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h5 className="font-bold text-sm text-slate-900 leading-snug mb-1.5 hover:text-indigo-600 transition-colors">
                            {task.title}
                          </h5>

                          {/* Description */}
                          {task.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Meta Information */}
                          <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 text-xs">
                            {/* Project & Assignee row */}
                            <div className="flex items-center justify-between gap-2">
                              {/* Assignee / Claim button */}
                              {isAssignedToMe ? (
                                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-200 text-[10px] font-bold">
                                  <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[8px]">
                                    ✓
                                  </div>
                                  <span>Assigned to You</span>
                                </div>
                              ) : task.assigneeName && task.assigneeName !== 'Unassigned' ? (
                                <div className="flex items-center gap-1.5 text-slate-700">
                                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                                    {task.assigneeName.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-semibold text-[11px] truncate max-w-[100px]">{task.assigneeName}</span>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => handleClaimTask(task, e)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition-all"
                                  title="Self-assign this task"
                                >
                                  <UserPlus size={11} />
                                  <span>Assign to Me</span>
                                </button>
                              )}

                              {/* Project tag */}
                              {task.projectName && (
                                <span 
                                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[120px]"
                                  title={task.projectName}
                                >
                                  <FolderKanban size={10} className="shrink-0 text-slate-400" />
                                  <span className="truncate">{task.projectName}</span>
                                </span>
                              )}
                            </div>

                            {/* Due Date & Quick Advance / Revert row */}
                            <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1">
                              <div className="flex items-center gap-1">
                                <Clock size={12} className={overdue ? 'text-rose-500' : dueToday ? 'text-amber-500' : ''} />
                                <span className={overdue ? 'text-rose-600 font-bold' : dueToday ? 'text-amber-600 font-bold' : 'font-medium'}>
                                  {task.deadline && task.deadline !== 'No deadline' 
                                    ? new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
                                    : 'No due date'}
                                </span>
                              </div>

                              {/* Navigation Controls */}
                              <div className="flex items-center gap-1">
                                {col.id !== 'To Do' && (
                                  <button
                                    onClick={(e) => handleQuickRevert(task, e)}
                                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                    title="Move back"
                                  >
                                    <ArrowLeft size={11} />
                                  </button>
                                )}

                                {col.id !== 'Completed' && col.id !== 'Done' ? (
                                  <button
                                    onClick={(e) => handleQuickAdvance(task, e)}
                                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors"
                                    title="Advance to next stage"
                                  >
                                    <span>Advance</span>
                                    <ArrowRight size={10} />
                                  </button>
                                ) : (
                                  <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md">
                                    <Check size={11} /> Completed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
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
        title={editingTask ? 'Edit Deliverable' : 'Create Project Deliverable'}
        subtitle="Organize requirements, set deadlines, and assign tasks directly within your project."
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Implement Drag & Drop Kanban Board"
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Description & Details</label>
            <textarea
              rows={3}
              placeholder="Provide specifications, acceptance criteria, or relevant links..."
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                Project <span className="text-rose-500">*</span>
              </label>
              <select
                required
                disabled={Boolean(editingTask)}
                value={modalProjectId}
                onChange={(e) => setModalProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Assignee</label>
                {user?.id && modalAssigneeId !== String(user.id) && (
                  <button
                    type="button"
                    onClick={() => setModalAssigneeId(String(user.id))}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Assign to Myself
                  </button>
                )}
              </div>
              <select
                value={modalAssigneeId}
                onChange={(e) => setModalAssigneeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {availableAssignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.role ? `(${u.role})` : ''}
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
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="URGENT">URGENT Priority</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Due Date <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setQuickDeadline(1)}
                    className="text-[10px] font-semibold text-slate-500 hover:text-indigo-600 px-1"
                  >
                    +1d
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDeadline(3)}
                    className="text-[10px] font-semibold text-slate-500 hover:text-indigo-600 px-1"
                  >
                    +3d
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDeadline(7)}
                    className="text-[10px] font-semibold text-slate-500 hover:text-indigo-600 px-1"
                  >
                    +1w
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={modalDeadline}
                onChange={(e) => setModalDeadline(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {editingTask && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Status Column</label>
              <select
                value={modalStatus}
                onChange={(e: any) => setModalStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setTaskModalOpen(false)} disabled={submittingTask}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={submittingTask} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              {editingTask ? 'Save Changes' : 'Create Deliverable'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Details Modal */}
      {viewingTask && (
        <Modal
          isOpen={Boolean(viewingTask)}
          onClose={() => setViewingTask(null)}
          title={viewingTask.title}
          subtitle={`Deliverable ID: #${viewingTask.id} • ${viewingTask.projectName || 'General Project'}`}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {getPriorityBadge(viewingTask.priority)}
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                viewingTask.status === 'Completed' || viewingTask.status === 'Done'
                  ? 'bg-emerald-100 text-emerald-800'
                  : viewingTask.status === 'In Progress'
                  ? 'bg-blue-100 text-blue-800'
                  : viewingTask.status === 'Review'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {viewingTask.status}
              </span>
              {isOverdue(viewingTask.deadline, viewingTask.status) && (
                <span className="flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  <AlertTriangle size={11} /> Overdue by {getDaysOverdue(viewingTask.deadline)} day(s)
                </span>
              )}
            </div>

            {viewingTask.description ? (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</h6>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{viewingTask.description}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No description provided for this deliverable.</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Assignee</span>
                <span className="font-semibold text-slate-800">
                  {viewingTask.assigneeName || 'Unassigned'}
                  {String(viewingTask.assigneeId) === String(user?.id) && ' (You)'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Due Date</span>
                <span className="font-semibold text-slate-800">
                  {viewingTask.deadline && viewingTask.deadline !== 'No deadline' 
                    ? new Date(viewingTask.deadline).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) 
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              {String(viewingTask.assigneeId) !== String(user?.id) && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleClaimTask(viewingTask)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <UserPlus size={13} /> Assign to Me
                </Button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {canModifyTask(viewingTask) && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const t = viewingTask;
                      setViewingTask(null);
                      openEditModal(t);
                    }}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <Edit3 size={13} /> Edit
                  </Button>
                )}
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => setViewingTask(null)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
        <Modal
          isOpen={Boolean(taskToDelete)}
          onClose={() => setTaskToDelete(null)}
          title="Delete Deliverable"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Are you sure you want to delete deliverable <span className="font-bold text-slate-900">"{taskToDelete.title}"</span>? This will remove the task from the Kanban board.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setTaskToDelete(null)} disabled={deletingTask}>
                Cancel
              </Button>
              <Button 
                variant="danger" 
                onClick={handleDeleteTask} 
                isLoading={deletingTask}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Delete Task
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
