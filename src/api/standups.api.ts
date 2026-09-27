import api from './axios';

export type StandupStatus = 'PENDING' | 'SUBMITTED' | 'LATE' | 'MISSED' | 'EXEMPTED';

export interface StandupSubmission {
  id?: string;
  status: StandupStatus;
  workToday: string;
  blockers: string;
  hasBlockers: boolean;
  nextPlan: string;
  needSupport: boolean;
  supportDetails?: string | null;
  submittedAt?: string;
  exemptionReason?: string | null;
  notes?: string | null;
}

export interface StandupPolicy {
  id?: number;
  enabled: boolean;
  startTime: string;
  reminderTime: string;
  submissionDeadline: string;
  gracePeriodMins: number;
  maxMissedThreshold: number;
  accountLockEnabled: boolean;
  workingDays: number[];
  timezone: string;
}

export interface TodayStandupStatusResponse {
  date: string;
  isWorkingDay: boolean;
  policy: StandupPolicy;
  isLocked: boolean;
  missedCount: number;
  submission: StandupSubmission | null;
  canSubmit: boolean;
  timing: {
    isBeforeStart: boolean;
    isPastDeadline: boolean;
    isPastGrace: boolean;
    currentTime: string;
  };
}

export interface StandupHistoryRecord {
  id: string;
  date: string;
  status: StandupStatus;
  workToday?: string;
  blockers?: string;
  hasBlockers?: boolean;
  nextPlan?: string;
  needSupport?: boolean;
  supportDetails?: string;
  submittedAt?: string;
  exemptionReason?: string;
  notes?: string | null;
}

export interface MyStandupsResponse {
  stats: {
    totalSubmissions: number;
    submitted: number;
    late: number;
    missed: number;
    exempted: number;
    complianceRate: number;
  };
  history: StandupHistoryRecord[];
}

export interface TeamMemberStandup {
  id: string;
  name: string;
  empId: string;
  email: string;
  department?: string;
  subTeam?: string;
  isLocked: boolean;
  status: StandupStatus;
  submission: StandupSubmission | null;
}

export interface TeamStandupsResponse {
  date: string;
  summary: {
    total: number;
    submitted: number;
    late: number;
    missed: number;
    pending: number;
    exempted: number;
    blockersCount: number;
    supportCount: number;
    complianceRate: number;
  };
  members: TeamMemberStandup[];
}

export interface DepartmentStandupsResponse {
  date: string;
  departmentId: string;
  summary: {
    total: number;
    submitted: number;
    late: number;
    missed: number;
    pending: number;
    exempted: number;
    complianceRate: number;
  };
  blockers: Array<{
    userId: string;
    name: string;
    empId: string;
    managerName?: string;
    blockers: string;
  }>;
  supportRequests: Array<{
    userId: string;
    name: string;
    empId: string;
    managerName?: string;
    supportDetails: string;
  }>;
  members: Array<{
    id: string;
    name: string;
    empId: string;
    email: string;
    managerName?: string;
    subTeam?: string;
    isLocked: boolean;
    status: StandupStatus;
    submission: StandupSubmission | null;
  }>;
}

export interface ExecutiveAnalyticsResponse {
  date: string;
  overview: {
    totalEmployees: number;
    submitted: number;
    late: number;
    missed: number;
    pending: number;
    exempted: number;
    complianceRate: number;
    activeBlockersCount: number;
    lockedAccountsCount: number;
  };
  departments: Array<{
    departmentId: string;
    departmentName: string;
    totalEmployees: number;
    submitted: number;
    late: number;
    missed: number;
    exempted: number;
    pending: number;
    blockersCount: number;
    supportCount: number;
    complianceRate: number;
  }>;
  violators: Array<{
    id: string;
    name: string;
    empId: string;
    email: string;
    department?: string;
    manager?: string;
    isLocked: boolean;
    missedCount: number;
    lateCount: number;
    submittedCount: number;
  }>;
  activeBlockers: Array<{
    id: string;
    userId: string;
    userName: string;
    empId: string;
    department?: string;
    manager?: string;
    workToday: string;
    blockers: string;
    needSupport: boolean;
    supportDetails?: string;
    submittedAt?: string;
  }>;
}

// 1. Get Today Status & Form data for user
export const getTodayStandupStatus = async (): Promise<TodayStandupStatusResponse> => {
  const res = await api.get('/standups/today');
  return res.data.data;
};

// 2. Submit Daily Standup
export const submitDailyStandup = async (data: {
  workToday: string;
  hasBlockers: boolean;
  blockers?: string;
  nextPlan: string;
  needSupport: boolean;
  supportDetails?: string;
}) => {
  const res = await api.post('/standups/submit', data);
  return res.data.data;
};

// 3. Get Personal History
export const getMyStandupsHistory = async (limit = 30): Promise<MyStandupsResponse> => {
  const res = await api.get('/standups/me', { params: { limit } });
  return res.data.data;
};

// 4. Intimate Absence (Self Excuse)
export const excuseStandup = async (date: string, reason: string) => {
  const res = await api.post('/standups/excuse', { date, reason });
  return res.data;
};

// 5. Team Standups (Team Lead / Manager)
export const getTeamStandups = async (date?: string): Promise<TeamStandupsResponse> => {
  const res = await api.get('/standups/team', { params: { date } });
  return res.data.data;
};

// 6. Department Standups (Dept Head)
export const getDepartmentStandups = async (deptId?: string, date?: string): Promise<DepartmentStandupsResponse> => {
  const url = deptId ? `/standups/department/${deptId}` : '/standups/department';
  const res = await api.get(url, { params: { date } });
  return res.data.data;
};

// 7. Executive Analytics (CEO, CTO, Super Admin, HR)
export const getStandupAnalytics = async (date?: string): Promise<ExecutiveAnalyticsResponse> => {
  const res = await api.get('/standups/analytics', { params: { date } });
  return res.data.data;
};

// 8. Policy Settings
export const getStandupPolicy = async (): Promise<StandupPolicy> => {
  const res = await api.get('/standups/policy');
  return res.data.data;
};

export const updateStandupPolicy = async (policy: Partial<StandupPolicy>): Promise<StandupPolicy> => {
  const res = await api.put('/standups/policy', policy);
  return res.data.data;
};

// 9. Grant Exemption
export const grantStandupExemption = async (userId: string, date: string, reason: string) => {
  const res = await api.post('/standups/exemption', { userId, date, reason });
  return res.data;
};

// 10. Unlock User
export const unlockStandupUser = async (userId: string, reason?: string) => {
  const res = await api.post('/standups/unlock', { userId, reason });
  return res.data;
};

// 11. Trigger Compliance Check
export const triggerStandupComplianceCheck = async () => {
  const res = await api.post('/standups/compliance-check');
  return res.data;
};
