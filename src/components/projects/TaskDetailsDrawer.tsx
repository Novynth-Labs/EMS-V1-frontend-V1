import React, { useEffect, useState } from 'react';
import { 
  getTaskDetails, 
  createSubtask, 
  createChecklistItem, 
  toggleChecklistItem, 
  deleteChecklistItem, 
  addTaskDependency, 
  removeTaskDependency, 
  addTaskComment, 
  addTaskAttachment,
  updateTaskSprintAndEstimate,
  updateTaskAssignee,
  updateTaskColumn,
  updateTaskGeneral,
  getTasks
} from '../../api/projects.api';
import { getBoardColumns, type BoardColumn } from '../../api/boards.api';
import { getSprints, type Sprint } from '../../api/sprints.api';
import { getEpics, type Epic } from '../../api/epics.api';
import { 
  X, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Paperclip, 
  MessageSquare, 
  History, 
  Tag, 
  FolderGit2, 
  Calendar,
  AlertTriangle,
  Clock,
  ExternalLink,
  Edit3,
  Save,
  CheckCircle2,
  RefreshCw,
  User,
  Zap,
  Layers,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../../utils/toast';
import { getInitials } from '../../utils/initials';

interface TaskDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  projectId: string;
  projectMembers: { id: string; name: string }[];
  onTaskUpdated: () => void;
}

export const TaskDetailsDrawer: React.FC<TaskDetailsDrawerProps> = ({ 
  isOpen, 
  onClose, 
  taskId, 
  projectId, 
  projectMembers = [],
  onTaskUpdated 
}) => {
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [allProjectTasks, setAllProjectTasks] = useState<any[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);

  // Title & description inline editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Mutation states
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  
  // Dependency selection state
  const [depTaskId, setDepTaskId] = useState('');
  const [depType, setDepType] = useState<'blocks' | 'blocked_by'>('blocks');

  // Attachment helper state
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileUrl, setUploadFileUrl] = useState('');

  const loadDetails = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getTaskDetails(taskId);
      setDetails(data);
      setTitleValue(data.title || '');
      setDescValue(data.description || '');

      // Resilient auxiliary loading: load supporting options without failing task view
      const targetProjId = projectId || data.projectId;
      if (targetProjId) {
        Promise.allSettled([
          getBoardColumns(targetProjId),
          getTasks(targetProjId),
          getSprints(targetProjId),
          getEpics(targetProjId)
        ]).then(([colsRes, tasksRes, sprintsRes, epicsRes]) => {
          if (colsRes.status === 'fulfilled' && Array.isArray(colsRes.value)) {
            setColumns(colsRes.value);
          }
          if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) {
            setAllProjectTasks(tasksRes.value.filter(t => t.id !== taskId));
          }
          if (sprintsRes.status === 'fulfilled' && Array.isArray(sprintsRes.value)) {
            setSprints(sprintsRes.value);
          }
          if (epicsRes.status === 'fulfilled' && Array.isArray(epicsRes.value)) {
            setEpics(epicsRes.value);
          }
        });
      }
    } catch (err: any) {
      console.error('Failed to load task details:', err);
      setError(err?.response?.data?.error?.message || err?.message || 'Could not load task details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      setIsEditingTitle(false);
      setIsEditingDesc(false);
      loadDetails();
    } else {
      setDetails(null);
    }
  }, [isOpen, taskId]);

  // Handle Title Save
  const handleSaveTitle = async () => {
    if (!titleValue.trim() || titleValue === details?.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      setIsSavingGeneral(true);
      await updateTaskGeneral(taskId, { title: titleValue.trim() });
      setDetails((prev: any) => ({ ...prev, title: titleValue.trim() }));
      setIsEditingTitle(false);
      toast.success('Task title updated.');
      onTaskUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update title.');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Handle Description Save
  const handleSaveDescription = async () => {
    try {
      setIsSavingGeneral(true);
      await updateTaskGeneral(taskId, { description: descValue.trim() || undefined });
      setDetails((prev: any) => ({ ...prev, description: descValue.trim() }));
      setIsEditingDesc(false);
      toast.success('Description saved.');
      onTaskUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save description.');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Handle Priority Change
  const handlePriorityChange = async (newPriority: string) => {
    try {
      await updateTaskGeneral(taskId, { priority: newPriority.toLowerCase() });
      setDetails((prev: any) => ({ ...prev, priority: newPriority }));
      toast.success(`Priority set to ${newPriority}.`);
      onTaskUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update priority.');
    }
  };

  // Handle Column / Status Change
  const handleColumnChange = async (newColumnId: string) => {
    try {
      const selectedCol = columns.find(c => c.id === newColumnId);
      await updateTaskColumn(taskId, newColumnId);
      setDetails((prev: any) => ({
        ...prev,
        columnId: newColumnId,
        status: selectedCol?.name || prev.status
      }));
      toast.success(`Moved to ${selectedCol?.name || 'new status'}.`);
      onTaskUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to change column.');
    }
  };

  // Handle Deadline Change
  const handleDeadlineChange = async (dateStr: string) => {
    try {
      await updateTaskGeneral(taskId, { deadline: dateStr || undefined });
      setDetails((prev: any) => ({ ...prev, deadline: dateStr }));
      toast.success('Due date updated.');
      onTaskUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update due date.');
    }
  };

  // Handle Assignee Change
  const handleAssigneeChange = async (userId: string) => {
    try {
      await updateTaskAssignee(taskId, userId);
      const member = projectMembers.find(m => m.id === userId);
      setDetails((prev: any) => ({
        ...prev,
        assigneeId: userId || null,
        assigneeName: member?.name || null
      }));
      toast.success('Assignee updated.');
      onTaskUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update assignee.');
    }
  };

  // Handle Sprint, Story Points, Epic
  const handleSprintEstimateEpicChange = async (fields: { sprintId?: string | null; storyPoints?: number | null; epicId?: string | null }) => {
    try {
      await updateTaskSprintAndEstimate(taskId, fields);
      setDetails((prev: any) => ({ ...prev, ...fields }));
      toast.success('Task metrics updated.');
      onTaskUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update metrics.');
    }
  };

  // Subtasks
  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    try {
      await createSubtask(taskId, { title: newSubtaskTitle.trim() });
      setNewSubtaskTitle('');
      toast.success('Subtask added.');
      loadDetails();
      onTaskUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create subtask.');
    }
  };

  // Checklists
  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    try {
      await createChecklistItem(taskId, newChecklistItem.trim());
      setNewChecklistItem('');
      toast.success('Checklist item added.');
      loadDetails();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add checklist item.');
    }
  };

  const handleToggleCheck = async (itemId: string, isCompleted: boolean) => {
    try {
      await toggleChecklistItem(itemId, isCompleted);
      setDetails((prev: any) => ({
        ...prev,
        checklists: prev.checklists.map((c: any) => c.id === itemId ? { ...c, isCompleted } : c)
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCheck = async (itemId: string) => {
    try {
      await deleteChecklistItem(itemId);
      setDetails((prev: any) => ({
        ...prev,
        checklists: prev.checklists.filter((c: any) => c.id !== itemId)
      }));
      toast.success('Checklist item removed.');
    } catch (err) {
      console.error(err);
    }
  };

  // Dependencies
  const handleAddDependencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depTaskId) return;
    try {
      await addTaskDependency(taskId, depTaskId, depType);
      setDepTaskId('');
      toast.success('Dependency linked.');
      loadDetails();
    } catch (err) {
      console.error(err);
      toast.error('Failed to link dependency.');
    }
  };

  const handleRemoveDependency = async (depId: string) => {
    try {
      await removeTaskDependency(depId);
      toast.success('Dependency removed.');
      loadDetails();
    } catch (err) {
      console.error(err);
    }
  };

  // Comments
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    try {
      await addTaskComment(taskId, newCommentText.trim());
      setNewCommentText('');
      toast.success('Comment posted.');
      loadDetails();
    } catch (err) {
      console.error(err);
      toast.error('Failed to post comment.');
    }
  };

  // Attachments
  const handleAddAttachmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileName.trim() || !uploadFileUrl.trim()) return;
    try {
      await addTaskAttachment(taskId, {
        fileName: uploadFileName.trim(),
        fileUrl: uploadFileUrl.trim(),
        fileType: 'link'
      });
      setUploadFileName('');
      setUploadFileUrl('');
      toast.success('Attachment link added.');
      loadDetails();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add attachment.');
    }
  };

  if (!isOpen) return null;

  // Checklist calculations
  const totalChecks = details?.checklists?.length || 0;
  const completedChecks = details?.checklists?.filter((c: any) => c.isCompleted).length || 0;
  const checkPercent = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

  // Format priority colors
  const normPriority = (details?.priority || 'medium').toLowerCase();
  const priorityBadgeStyle = 
    normPriority === 'urgent' ? 'bg-rose-100 text-rose-700 border-rose-200' :
    normPriority === 'high' ? 'bg-amber-100 text-amber-700 border-amber-200' :
    normPriority === 'low' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    'bg-blue-100 text-blue-700 border-blue-200';

  const rawDeadline = details?.deadline ? details.deadline.split('T')[0] : '';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      
      {/* Click outside backdrop close layer */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Drawer Container */}
      <div className="relative w-full md:max-w-4xl bg-white shadow-2xl h-full flex flex-col z-10 border-l border-slate-200 overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase bg-indigo-600 text-white shadow-xs">
              Task #{details?.id || taskId}
            </span>

            {/* Quick Status Pill / Column Switcher */}
            {columns.length > 0 && details && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                <select
                  value={details.columnId || ''}
                  onChange={(e) => handleColumnChange(e.target.value)}
                  className="text-xs font-extrabold text-indigo-700 bg-transparent border-none outline-hidden cursor-pointer"
                >
                  {columns.map(col => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Priority Tag */}
            {details && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${priorityBadgeStyle}`}>
                {details.priority || 'Medium'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={loadDetails} 
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              title="Refresh details"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors"
              title="Close panel"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center gap-3 text-slate-400">
            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Loading task data...</p>
          </div>
        ) : error || !details ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
              <AlertTriangle size={28} />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-800">Task details unavailable</h4>
              <p className="text-xs text-slate-500 mt-1">{error || 'The requested task could not be loaded.'}</p>
            </div>
            <Button onClick={loadDetails} variant="secondary" className="text-xs">
              <RefreshCw size={14} className="mr-1.5" /> Try Again
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Primary Left/Center Workspace */}
            <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar">
              
              {/* Task Title (Editable) */}
              <div>
                {isEditingTitle ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') setIsEditingTitle(false);
                      }}
                      autoFocus
                      className="w-full text-lg font-black text-slate-900 border-b-2 border-indigo-600 outline-hidden pb-1 bg-transparent"
                    />
                    <div className="flex items-center gap-2">
                      <Button onClick={handleSaveTitle} disabled={isSavingGeneral} className="text-xs py-1 px-3">
                        <Save size={12} className="mr-1" /> Save
                      </Button>
                      <button 
                        onClick={() => setIsEditingTitle(false)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsEditingTitle(true)}
                    className="group cursor-pointer flex items-start justify-between gap-2 rounded-lg -m-1.5 p-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <h2 className="text-xl font-black text-slate-900 leading-snug break-words">
                      {details.title}
                    </h2>
                    <span className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity p-1">
                      <Edit3 size={15} />
                    </span>
                  </div>
                )}
              </div>

              {/* Task Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    Description
                  </h4>
                  {!isEditingDesc && (
                    <button 
                      onClick={() => setIsEditingDesc(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                  )}
                </div>

                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      placeholder="Add a detailed description, specifications, or acceptance criteria..."
                      className="w-full p-3 text-xs text-slate-800 bg-slate-50 border border-indigo-200 rounded-xl outline-hidden focus:ring-2 focus:ring-indigo-500/20 resize-y"
                    />
                    <div className="flex items-center gap-2">
                      <Button onClick={handleSaveDescription} disabled={isSavingGeneral} className="text-xs py-1 px-3">
                        <Save size={12} className="mr-1" /> Save Description
                      </Button>
                      <button 
                        onClick={() => { setDescValue(details.description || ''); setIsEditingDesc(false); }}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsEditingDesc(true)}
                    className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100/60 transition-colors"
                  >
                    {details.description ? (
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {details.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No description provided. Click here to add detailed notes...
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Checklists Section with Progress Bar */}
              <div className="space-y-3 bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <CheckSquare size={16} className="text-indigo-600" /> Checklist
                  </h4>
                  <span className="text-[11px] font-extrabold text-slate-500">
                    {completedChecks} / {totalChecks} ({checkPercent}%)
                  </span>
                </div>

                {/* Progress bar */}
                {totalChecks > 0 && (
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${checkPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                      style={{ width: `${checkPercent}%` }}
                    />
                  </div>
                )}

                {/* Checklist items list */}
                <div className="space-y-2 pt-1">
                  {details.checklists.map((chk: any) => (
                    <div 
                      key={chk.id} 
                      className="group flex items-center justify-between gap-3 text-xs bg-white border border-slate-200/70 p-2.5 rounded-xl shadow-2xs hover:border-indigo-200 transition-colors"
                    >
                      <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={chk.isCompleted}
                          onChange={(e) => handleToggleCheck(chk.id, e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className={`text-xs select-none ${chk.isCompleted ? 'line-through text-slate-400 font-normal' : 'text-slate-800 font-bold'}`}>
                          {chk.itemText}
                        </span>
                      </label>
                      <button 
                        onClick={() => handleDeleteCheck(chk.id)} 
                        className="text-slate-300 group-hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                        title="Delete item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Checklist Form */}
                <form onSubmit={handleAddChecklist} className="flex gap-2 pt-2">
                  <Input 
                    type="text" 
                    placeholder="+ Add checklist task..."
                    value={newChecklistItem}
                    onChange={e => setNewChecklistItem(e.target.value)}
                    className="py-1.5 px-3 text-xs shadow-none bg-white"
                  />
                  <Button type="submit" variant="secondary" className="text-xs py-1.5 px-3 shrink-0">
                    <Plus size={14} className="mr-1" /> Add
                  </Button>
                </form>
              </div>

              {/* Subtasks Section */}
              <div className="space-y-3 bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <FolderGit2 size={16} className="text-indigo-600" /> Subtasks
                  </h4>
                  <span className="text-[11px] font-extrabold text-slate-500">
                    {details.subtasks?.length || 0} items
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {details.subtasks.map((sub: any) => (
                    <div 
                      key={sub.id} 
                      className="flex items-center justify-between gap-3 text-xs bg-white border border-slate-200/70 p-2.5 rounded-xl shadow-2xs"
                    >
                      <span className="font-bold text-slate-800">{sub.title}</span>
                      <span className="bg-slate-100 text-slate-700 font-extrabold px-2 py-0.5 rounded-md text-[10px] border border-slate-200">
                        {sub.status || 'To Do'}
                      </span>
                    </div>
                  ))}
                  {details.subtasks.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic py-1">No nested subtasks created yet.</p>
                  )}
                </div>

                <form onSubmit={handleCreateSubtask} className="flex gap-2 pt-2">
                  <Input 
                    type="text" 
                    placeholder="+ New subtask title..."
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    className="py-1.5 px-3 text-xs shadow-none bg-white"
                  />
                  <Button type="submit" variant="secondary" className="text-xs py-1.5 px-3 shrink-0">
                    Create
                  </Button>
                </form>
              </div>

              {/* Dependencies Section */}
              <div className="space-y-3 bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4.5">
                <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" /> Linked Blockers & Dependencies
                </h4>

                <div className="space-y-2 pt-1">
                  {details.dependencies.map((dep: any) => (
                    <div 
                      key={dep.id} 
                      className="flex items-center justify-between gap-3 text-xs bg-white border border-slate-200/70 p-2.5 rounded-xl shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-black uppercase text-[9px] px-2 py-0.5 rounded-md border ${
                          dep.type === 'blocks' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {dep.type === 'blocks' ? 'Blocks' : 'Blocked By'}
                        </span>
                        <span className="font-bold text-slate-800">{dep.title}</span>
                      </div>
                      <button 
                        onClick={() => handleRemoveDependency(dep.id)} 
                        className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                        title="Unlink"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {details.dependencies.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic py-1">No task blockers or dependencies mapped.</p>
                  )}
                </div>

                <form onSubmit={handleAddDependencySubmit} className="flex gap-2 pt-2 flex-wrap">
                  <select
                    value={depTaskId}
                    onChange={e => setDepTaskId(e.target.value)}
                    className="novynth-input text-xs py-1.5 px-3 flex-1 min-w-[140px] bg-white border-slate-200"
                  >
                    <option value="">Select Target Task...</option>
                    {allProjectTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <select
                    value={depType}
                    onChange={e => setDepType(e.target.value as any)}
                    className="novynth-input text-xs py-1.5 px-3 w-32 bg-white border-slate-200"
                  >
                    <option value="blocks">Blocks</option>
                    <option value="blocked_by">Blocked By</option>
                  </select>
                  <Button type="submit" variant="secondary" className="text-xs py-1.5 px-3">
                    Link
                  </Button>
                </form>
              </div>

              {/* Discussion & Comments Thread */}
              <div className="space-y-3 bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4.5">
                <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-600" /> Collaboration & Comments
                </h4>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <Input 
                    type="text" 
                    placeholder="Write a comment or post progress updates..."
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    className="py-1.5 px-3 text-xs shadow-none bg-white"
                  />
                  <Button type="submit" variant="primary" className="text-xs py-1.5 px-4 shrink-0">
                    Post
                  </Button>
                </form>

                <div className="space-y-2.5 mt-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {details.comments.map((comment: any) => (
                    <div key={comment.id} className="bg-white border border-slate-200/70 rounded-xl p-3 shadow-2xs space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-[9px]">
                            {getInitials(comment.userName)}
                          </div>
                          <span className="text-indigo-600 font-extrabold">{comment.userName}</span>
                        </div>
                        <span>{new Date(comment.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed pl-6.5">
                        {comment.commentText}
                      </p>
                    </div>
                  ))}
                  {details.comments.length === 0 && (
                    <p className="text-center py-4 text-xs text-slate-400 italic">No comments posted yet.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Right Inspector & Properties Sidebar */}
            <div className="w-full md:w-80 shrink-0 bg-slate-50/60 p-6 overflow-y-auto space-y-6 border-t md:border-t-0 md:border-l border-slate-200/80 custom-scrollbar">
              
              {/* Properties Section */}
              <div className="space-y-4">
                <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                  Properties
                </h4>

                {/* Assignee */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                    Assignee
                  </label>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-2xs">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                      {details.assigneeName ? getInitials(details.assigneeName) : <User size={13} />}
                    </div>
                    <select
                      value={details.assigneeId || ''}
                      onChange={(e) => handleAssigneeChange(e.target.value)}
                      className="text-xs font-bold text-slate-800 bg-transparent border-none outline-hidden w-full cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {projectMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Priority Picker */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    value={details.priority || 'medium'}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    className="novynth-input text-xs w-full py-2 font-bold bg-white border-slate-200 cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                    Due Date
                  </label>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
                    <Calendar size={14} className="text-slate-400" />
                    <input 
                      type="date"
                      value={rawDeadline}
                      onChange={(e) => handleDeadlineChange(e.target.value)}
                      className="text-xs font-bold text-slate-800 bg-transparent border-none outline-hidden w-full cursor-pointer"
                    />
                  </div>
                </div>

                {/* Story Points */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Story Points</span>
                    <span className="text-slate-400 font-normal">Effort Estimate</span>
                  </label>
                  <div className="space-y-1.5">
                    <input 
                      type="number"
                      min={0}
                      value={details.storyPoints !== null && details.storyPoints !== undefined ? details.storyPoints : ''}
                      onChange={(e) => handleSprintEstimateEpicChange({ storyPoints: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="0"
                      className="novynth-input text-xs w-full py-1.5 font-black text-center bg-white border-slate-200"
                    />
                    <div className="flex gap-1 justify-center">
                      {[1, 2, 3, 5, 8].map(pts => (
                        <button
                          key={pts}
                          type="button"
                          onClick={() => handleSprintEstimateEpicChange({ storyPoints: pts })}
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border transition-colors ${
                            details.storyPoints === pts ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {pts}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sprint */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                    Sprint
                  </label>
                  <select
                    value={details.sprintId || ''}
                    onChange={(e) => handleSprintEstimateEpicChange({ sprintId: e.target.value === '' ? null : e.target.value })}
                    className="novynth-input text-xs w-full py-2 font-bold bg-white border-slate-200 cursor-pointer"
                  >
                    <option value="">Backlog (No Sprint)</option>
                    {sprints.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Epic */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                    Epic
                  </label>
                  <select
                    value={details.epicId || ''}
                    onChange={(e) => handleSprintEstimateEpicChange({ epicId: e.target.value === '' ? null : e.target.value })}
                    className="novynth-input text-xs w-full py-2 font-bold bg-white border-slate-200 cursor-pointer"
                  >
                    <option value="">No Epic</option>
                    {epics.map(ep => (
                      <option key={ep.id} value={ep.id}>{ep.name}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Attachments Section */}
              <div className="space-y-3 pt-2">
                <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-1.5">
                  <Paperclip size={14} className="text-slate-500" /> Links & Attachments
                </h4>
                
                <form onSubmit={handleAddAttachmentSubmit} className="space-y-2">
                  <Input 
                    type="text" placeholder="Title (e.g. Design Spec)..." required
                    value={uploadFileName}
                    onChange={e => setUploadFileName(e.target.value)}
                    className="py-1 text-xs shadow-none bg-white border-slate-200"
                  />
                  <Input 
                    type="url" placeholder="https://..." required
                    value={uploadFileUrl}
                    onChange={e => setUploadFileUrl(e.target.value)}
                    className="py-1 text-xs shadow-none bg-white border-slate-200"
                  />
                  <Button type="submit" variant="secondary" className="w-full text-xs py-1">
                    Attach Link
                  </Button>
                </form>

                <div className="space-y-1.5 pt-1">
                  {details.attachments.map((attach: any) => (
                    <a 
                      key={attach.id} 
                      href={attach.fileUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-between text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 p-2 rounded-xl truncate shadow-2xs hover:border-indigo-200 transition-colors"
                    >
                      <span className="truncate pr-2">📎 {attach.fileName}</span>
                      <ExternalLink size={12} className="shrink-0 text-slate-400" />
                    </a>
                  ))}
                  {details.attachments.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">No attachments attached.</p>
                  )}
                </div>
              </div>

              {/* Activity & History Log */}
              <div className="space-y-3 pt-2">
                <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-1.5">
                  <History size={14} className="text-slate-500" /> History & Audit Trail
                </h4>

                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                  {details.auditLogs.map((log: any) => (
                    <div key={log.id} className="text-[10px] text-slate-500 leading-normal border-l-2 border-indigo-200 pl-2.5 py-0.5">
                      <p className="font-extrabold text-slate-700">
                        {log.userName}{' '}
                        <span className="text-slate-400 font-semibold text-[9px]">
                          {log.action === 'status_changed' ? 'changed status' :
                           log.action === 'assignee_changed' ? 'reassigned task' :
                           log.action === 'estimate_changed' ? 'updated story points' : 
                           log.action === 'details_updated' ? 'edited task details' : 'updated attributes'}
                        </span>
                      </p>
                      {log.fromValue || log.toValue ? (
                        <p className="text-[9px] font-medium text-slate-400 mt-0.5">
                          {log.fromValue ? `"${log.fromValue}"` : 'None'} ➔ {log.toValue ? `"${log.toValue}"` : 'None'}
                        </p>
                      ) : null}
                      <p className="text-[8px] text-slate-300 mt-0.5">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {details.auditLogs.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">No audit trail logged yet.</p>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
