import api from './axios';

export const createEmployee = async (data: {
  name: string;
  email: string;
  department: string;
  role: string;
  reportingManagerId?: string;
  customPassword: string;
}) => {
  const payload = { ...data, managerId: data.reportingManagerId, customPassword: data.customPassword };
  const response = await api.post('/hr/employees', payload);
  return response.data.data; // { user, tempPassword }
};

export const assignTeamLead = async (data: {
  deptHeadId: string;
  teamLeadId: string;
}) => {
  const response = await api.post(`/admin/dept-heads/${data.deptHeadId}/assign-team-lead`, { employeeId: data.teamLeadId });
  return response.data;
};

export const grantHRRole = async (userId: string) => {
  const response = await api.post(`/admin/grant-hr-role/${userId}`);
  return response.data;
};

// Use the newly integrated global search for users
export const searchUsers = async (query: string, _roleFilter?: string) => {
  if (!query.trim()) return [];
  const response = await api.get(`/search?q=${encodeURIComponent(query)}`);
  return response.data?.data?.employees || response.data?.employees || [];
};

export const getDirectoryUsers = async () => {
  const response = await api.get('/search/all-users');
  return Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
};

export const getDashboardData = async () => {
  const response = await api.get('/admin/dashboard');
  return response.data;
};

export const getAllUsers = async () => {
  const response = await api.get('/admin/users');
  return Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
};

export const getDepartmentDashboard = async () => {
  const response = await api.get('/admin/dashboard/department');
  return response.data;
};

export const bulkGenerateRoleCards = async () => {
  const response = await api.post('/admin/employees/bulk-generate');
  return response.data;
};

export const unlockUser = async (userId: string) => {
  const response = await api.post(`/admin/users/${userId}/unlock`);
  return response.data;
};

export const lockUser = async (userId: string, reason?: string) => {
  const response = await api.post(`/admin/users/${userId}/lock`, { reason });
  return response.data;
};

export const getLockedUsers = async () => {
  const response = await api.get('/admin/locked-users');
  return Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : [];
};

export interface LoginLogItem {
  id: string;
  userId: string | null;
  userName: string | null;
  empId: string | null;
  avatarUrl: string | null;
  emailAttempted: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason: string | null;
  stage: string;
  isLocked: boolean;
  department: string | null;
  role: string | null;
  roles: string[];
  createdAt: string;
}

export interface LoginLogsStats {
  totalAttempts: number;
  successfulLogins: number;
  failedLogins: number;
  todayAttempts: number;
  todaySuccessful: number;
  todayFailed: number;
  uniqueUsersToday: number;
  lockedCount: number;
  trend: Array<{
    date: string;
    day: string;
    success: number;
    failed: number;
    total: number;
  }>;
}

export const getLoginLogs = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'all' | 'success' | 'failed';
  startDate?: string;
  endDate?: string;
  role?: string;
}) => {
  const response = await api.get('/admin/login-logs', { params });
  return response.data?.data || response.data;
};

export const getLoginLogsStats = async (): Promise<LoginLogsStats> => {
  const response = await api.get('/admin/login-logs/stats');
  return response.data?.data || response.data;
};

export const clearOldLoginLogs = async (days = 90) => {
  const response = await api.delete('/admin/login-logs/clear', { data: { days } });
  return response.data;
};


