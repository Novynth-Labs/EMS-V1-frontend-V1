import api from './axios';

export type ProjectStage = 'Plan' | 'Dev' | 'Test' | 'Deploy' | 'Closed';

export interface ProjectMember {
  id: string;
  name: string;
  role: string;
  capacityHours?: number;
  contributionRate: number; // UI generated percentage
}

export interface Project {
  id: string;
  title: string;
  name?: string;
  description: string;
  stage: ProjectStage;
  creatorId: string;
  teamLeadId?: string;
  teamLeadName?: string;
  channelId?: string;
  template?: string;
  visibility?: 'public' | 'private' | 'department' | 'organization';
  health?: 'on_track' | 'at_risk' | 'off_track';
  archived_at?: string | null;
  members: ProjectMember[];
  stats?: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    totalPRs: number;
    mergedPRs: number;
  };
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Review' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface ProjectTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string;
  assigneeName?: string;
  assigneeId?: string;
  sprintId?: string;
  columnId?: string;
}

const mapStage = (dbStatus: string): ProjectStage => {
  const map: Record<string, ProjectStage> = {
    'PLAN': 'Plan',
    'DEV': 'Dev',
    'TEST': 'Test',
    'DEPLOY': 'Deploy',
    'CLOSED': 'Closed'
  };
  return map[dbStatus] || 'Plan';
};

export const getProjects = async (includeArchived = false) => {
  const res = await api.get(`/projects${includeArchived ? '?archived=true' : ''}`);
  const items = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
  return items.map((p: any) => ({
    ...p,
    title: p.name,
    stage: mapStage(p.status),
    members: p.members || []
  }));
};

export const getProjectDetails = async (id: string) => {
  const res = await api.get(`/projects/${id}`);
  const p = res.data.data;
  return {
    ...p,
    title: p.name,
    stage: mapStage(p.status),
    creatorId: p.creatorId,
    teamLeadId: p.teamLeadId,
    teamLeadName: p.teamLeadName,
    members: (p.members || []).map((m: any) => ({
      ...m,
      contributionRate: Math.floor(Math.random() * 30) + 70 // Generated UI value
    })),
    stats: p.stats || { totalTasks: 0, completedTasks: 0, overdueTasks: 0, totalPRs: 0, mergedPRs: 0 }
  };
};

export const createProject = async (data: { title: string; description: string; stage: ProjectStage; teamLeadId?: string; template?: string; visibility?: string }) => {
  const res = await api.post('/projects', {
    name: data.title,
    description: data.description,
    teamLeadId: data.teamLeadId,
    template: data.template,
    visibility: data.visibility
  });
  const p = res.data.data;
  return {
    ...p,
    title: p.name,
    stage: mapStage(p.status)
  };
};

export const updateProject = async (id: string, data: { name: string; description?: string; status?: string; template?: string; visibility?: string; health?: string; teamLeadId?: string }) => {
  const res = await api.put(`/projects/${id}`, data);
  return res.data.data;
};

export const archiveProject = async (id: string) => {
  const res = await api.post(`/projects/${id}/archive`);
  return res.data.data;
};

export const restoreProject = async (id: string) => {
  const res = await api.post(`/projects/${id}/restore`);
  return res.data.data;
};

export const deleteProject = async (id: string) => {
  const res = await api.delete(`/projects/${id}`);
  return res.data.data;
};

export const addProjectMember = async (projectId: string, userId: string, roleId?: string, capacityHours?: number) => {
  const res = await api.post(`/projects/${projectId}/members`, { userId, roleId, capacityHours });
  return res.data.data;
};

export const removeProjectMember = async (projectId: string, userId: string) => {
  const res = await api.delete(`/projects/${projectId}/members/${userId}`);
  return res.data;
};

export interface ProjectRole {
  id: string;
  name: string;
  description: string;
}

export interface ResourceAllocation {
  userId: string;
  name: string;
  projectRole: string;
  capacityHours: number;
  activeTasksCount: number;
  totalStoryPoints: number;
  workloadIndex: number;
}

export const getProjectRoles = async (): Promise<ProjectRole[]> => {
  const res = await api.get('/projects/meta/roles');
  return res.data.data;
};

export const updateProjectMemberRole = async (projectId: string, userId: string, roleId: string, capacityHours: number) => {
  const res = await api.put(`/projects/${projectId}/members/${userId}`, { roleId, capacityHours });
  return res.data.data;
};

export const transferProjectOwnership = async (projectId: string, targetUserId: string) => {
  const res = await api.post(`/projects/${projectId}/transfer-ownership`, { targetUserId });
  return res.data.data;
};

export const getProjectResourceAllocation = async (projectId: string): Promise<ResourceAllocation[]> => {
  const res = await api.get(`/projects/${projectId}/resource-allocation`);
  return res.data.data;
};


export const deleteTask = async (taskId: string) => {
  const response = await api.delete(`/tasks/${taskId}`);
  return response.data;
};

export const getTasks = async (projectId: string) => {
  const res = await api.get(`/tasks/project/${projectId}`);
  return res.data.data.map((t: any) => ({
    ...t,
    deadline: t.deadline.split('T')[0],
    priority: t.priority.charAt(0) + t.priority.slice(1).toLowerCase()
  }));
};

export const updateTaskStatus = async (projectId: string, taskId: string, status: TaskStatus) => {
  const response = await api.patch(`/tasks/${taskId}/status`, { status });
  return response.data.data;
};

export const updateTaskAssignee = async (taskId: string, assigneeId: string) => {
  const response = await api.patch(`/tasks/${taskId}/assignee`, { assigneeId });
  return response.data.data;
};

export const getMyTasks = async () => {
  const response = await api.get('/tasks/me');
  return response.data.data;
};

export const createTask = async (projectId: string, data: Partial<ProjectTask>) => {
  const res = await api.post('/tasks', {
    projectId,
    title: data.title || 'Untitled',
    priority: (data.priority || 'Medium').toUpperCase(),
    deadline: data.deadline || new Date().toISOString().split('T')[0],
    assigneeId: data.assigneeId
  });
  const t = res.data.data;
  return {
    ...t,
    status: 'To Do',
    deadline: t.deadline.split('T')[0],
    priority: data.priority || 'Medium'
  };
};

export const updateProjectTeamLead = async (projectId: string, teamLeadId: string) => {
  const res = await api.patch(`/projects/${projectId}/team-lead`, { teamLeadId });
  return res.data.data;
};

export const updateTaskSprintAndEstimate = async (taskId: string, data: { sprintId?: string | null; storyPoints?: number | null; epicId?: string | null }) => {
  const res = await api.patch(`/tasks/${taskId}/sprint-estimate`, data);
  return res.data.data;
};

export const updateTaskColumn = async (taskId: string, columnId: string) => {
  const response = await api.patch(`/tasks/${taskId}/column`, { columnId });
  return response.data;
};

export const updateTaskGeneral = async (taskId: string, data: { title?: string; description?: string; deadline?: string; priority?: string }) => {
  const response = await api.patch(`/tasks/${taskId}/general`, data);
  return response.data.data;
};

export const getTaskDetails = async (taskId: string) => {
  const response = await api.get(`/tasks/${taskId}/details`);
  return response.data.data;
};

export const createSubtask = async (taskId: string, data: { title: string; description?: string; deadline?: string; priority?: string; assigneeId?: string }) => {
  const response = await api.post(`/tasks/${taskId}/subtasks`, data);
  return response.data.data;
};

export const createChecklistItem = async (taskId: string, itemText: string) => {
  const response = await api.post(`/tasks/${taskId}/checklists`, { itemText });
  return response.data.data;
};

export const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
  const response = await api.put(`/tasks/checklists/${itemId}`, { isCompleted });
  return response.data.data;
};

export const deleteChecklistItem = async (itemId: string) => {
  const response = await api.delete(`/tasks/checklists/${itemId}`);
  return response.data.data;
};

export const addTaskDependency = async (taskId: string, dependencyTaskId: string, type: 'blocks' | 'blocked_by') => {
  const response = await api.post(`/tasks/${taskId}/dependencies`, { dependencyTaskId, type });
  return response.data.data;
};

export const removeTaskDependency = async (depId: string) => {
  const response = await api.delete(`/tasks/dependencies/${depId}`);
  return response.data.data;
};

export const addTaskComment = async (taskId: string, commentText: string) => {
  const response = await api.post(`/tasks/${taskId}/comments`, { commentText });
  return response.data.data;
};

export const addTaskAttachment = async (taskId: string, data: { fileName: string; fileUrl: string; fileType?: string; fileSize?: number }) => {
  const response = await api.post(`/tasks/${taskId}/attachments`, data);
  return response.data.data;
};




export const getProjectVelocity = async (projectId: string) => {
  const res = await api.get(`/projects/${projectId}/analytics/velocity`);
  return res.data.data;
};

export const getProjectCumulativeFlow = async (projectId: string) => {
  const res = await api.get(`/projects/${projectId}/analytics/cumulative-flow`);
  return res.data.data;
};
