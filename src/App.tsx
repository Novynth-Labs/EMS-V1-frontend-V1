import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleBasedRedirect } from './components/auth/RoleBasedRedirect';
import { OnboardingProvider } from './contexts/OnboardingContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { useAuthStore } from './store/authStore';
import { getMyProfile } from './api/profile.api';

import { useMeetingStore } from './store/meetingStore';
import { GlobalMeetingOverlay } from './components/meetings/GlobalMeetingOverlay';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Auth Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const TwoFactorPage = lazy(() => import('./pages/auth/TwoFactorPage').then(m => ({ default: m.TwoFactorPage })));
const AccountLockedPage = lazy(() => import('./pages/auth/AccountLockedPage').then(m => ({ default: m.AccountLockedPage })));
const ChangePasswordPage = lazy(() => import('./pages/auth/ChangePasswordPage').then(m => ({ default: m.ChangePasswordPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));

const UnauthorizedPlaceholder = lazy(() => import('./pages/Placeholders').then(m => ({ default: m.UnauthorizedPlaceholder })));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const TasksPage = lazy(() => import('./pages/tasks/TasksPage').then(m => ({ default: m.TasksPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Admin Pages
const UsersPage = lazy(() => import('./pages/admin/UsersPage').then(m => ({ default: m.UsersPage })));
const AssignTeamLeadPage = lazy(() => import('./pages/admin/AssignTeamLeadPage').then(m => ({ default: m.AssignTeamLeadPage })));
const GrantHRPage = lazy(() => import('./pages/admin/GrantHRPage').then(m => ({ default: m.GrantHRPage })));
const DepartmentsPage = lazy(() => import('./pages/admin/DepartmentsPage').then(m => ({ default: m.DepartmentsPage })));
const RoleCardsDirectory = lazy(() => import('./pages/admin/RoleCardsDirectory').then(m => ({ default: m.RoleCardsDirectory })));
const LoginLogsPage = lazy(() => import('./pages/admin/LoginLogsPage').then(m => ({ default: m.LoginLogsPage })));

// HR Onboarding Pages
const OnboardEmployeePage = lazy(() => import('./pages/hr/OnboardEmployeePage').then(m => ({ default: m.OnboardEmployeePage })));
const OnboardingDashboardPage = lazy(() => import('./pages/hr/OnboardingDashboardPage').then(m => ({ default: m.OnboardingDashboardPage })));
const EnrollFacePage = lazy(() => import('./pages/hr/EnrollFacePage').then(m => ({ default: m.EnrollFacePage })));
const FaceApprovalPage = lazy(() => import('./pages/hr/FaceApprovalPage').then(m => ({ default: m.FaceApprovalPage })));
const AttendanceAuditPage = lazy(() => import('./pages/hr/AttendanceAuditPage'));
const AttendanceDashboardPage = lazy(() => import('./pages/hr/AttendanceDashboardPage'));
const HRDashboard = lazy(() => import('./pages/dashboard/HRDashboard').then(m => ({ default: m.HRDashboard })));
const HRPerformanceDashboard = lazy(() => import('./pages/hr/HRPerformanceDashboard').then(m => ({ default: m.HRPerformanceDashboard })));
const RegularizationApprovalPage = lazy(() => import('./pages/hr/RegularizationApprovalPage').then(m => ({ default: m.RegularizationApprovalPage })));
const ClaimsApprovalPage = lazy(() => import('./pages/hr/ClaimsApprovalPage').then(m => ({ default: m.ClaimsApprovalPage })));
const PayrollDashboard = lazy(() => import('./pages/dashboard/PayrollDashboard').then(m => ({ default: m.PayrollDashboard })));
const MyPayslips = lazy(() => import('./pages/dashboard/MyPayslips').then(m => ({ default: m.MyPayslips })));
const PerformanceDashboard = lazy(() => import('./pages/dashboard/PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard })));
const TrainingDashboard = lazy(() => import('./pages/dashboard/TrainingDashboard').then(m => ({ default: m.TrainingDashboard })));
const ExitManagement = lazy(() => import('./pages/dashboard/ExitManagement').then(m => ({ default: m.ExitManagement })));
const MyClaims = lazy(() => import('./pages/dashboard/MyClaims').then(m => ({ default: m.MyClaims })));
const MyProfile = lazy(() => import('./pages/dashboard/MyProfile').then(m => ({ default: m.MyProfile })));
const Regularization = lazy(() => import('./pages/dashboard/Regularization').then(m => ({ default: m.Regularization })));

// Requests Pages
const NewRequestPage = lazy(() => import('./pages/requests/NewRequestPage').then(m => ({ default: m.NewRequestPage })));
const MyRequestsPage = lazy(() => import('./pages/requests/MyRequestsPage').then(m => ({ default: m.MyRequestsPage })));
const ApprovalQueuePage = lazy(() => import('./pages/requests/ApprovalQueuePage').then(m => ({ default: m.ApprovalQueuePage })));
const AllRequestsPage = lazy(() => import('./pages/admin/AllRequestsPage').then(m => ({ default: m.AllRequestsPage })));

// Attendance & Inactivity Pages
const CheckInPage = lazy(() => import('./pages/attendance/CheckInPage').then(m => ({ default: m.CheckInPage })));
const StandupsTrackerPage = lazy(() => import('./pages/attendance/StandupsTrackerPage').then(m => ({ default: m.StandupsTrackerPage })));
const AttendanceLogPage = lazy(() => import('./pages/attendance/AttendanceLogPage').then(m => ({ default: m.AttendanceLogPage })));

// Messaging & Notifications
const ChatPage = lazy(() => import('./pages/messaging/ChatPage').then(m => ({ default: m.ChatPage })));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage').then(m => ({ default: m.ReportsPage })));

// Projects, Groups & Tasks
const ProjectsDashboardPage = lazy(() => import('./pages/projects/ProjectsDashboardPage').then(m => ({ default: m.ProjectsDashboardPage })));
const CreateProjectPage = lazy(() => import('./pages/projects/CreateProjectPage').then(m => ({ default: m.CreateProjectPage })));
const ProjectDetailsPage = lazy(() => import('./pages/projects/ProjectDetailsPage').then(m => ({ default: m.ProjectDetailsPage })));

// Role Cards & Public Profile
const EmployeeDetailsPage = lazy(() => import('./pages/employees/EmployeeDetailsPage').then(m => ({ default: m.EmployeeDetailsPage })));
const PublicProfilePage = lazy(() => import('./pages/public/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })));

const FileExplorer = lazy(() => import('./pages/files/FileExplorer').then(m => ({ default: m.FileExplorer })));

// Quotations
const QuotationsPage = lazy(() => import('./pages/quotations/QuotationsPage').then(m => ({ default: m.QuotationsPage })));
const CustomerDashboard = lazy(() => import('./pages/dashboard/CustomerDashboard').then(m => ({ default: m.CustomerDashboard })));
const ATSDashboard = lazy(() => import('./pages/dashboard/ATSDashboard').then(m => ({ default: m.ATSDashboard })));

// Meetings
const MeetingsPage = lazy(() => import('./pages/meetings/MeetingsPage').then(m => ({ default: m.MeetingsPage })));
const MeetingRoom = lazy(() => import('./pages/meetings/LiveKitMeetingRoom').then(m => ({ default: m.LiveKitMeetingRoom })));
const MeetingAnalyticsPage = lazy(() => import('./pages/meetings/MeetingAnalyticsPage').then(m => ({ default: m.MeetingAnalyticsPage })));

const SubmitDocumentsPage = lazy(() => import('./pages/hr/SubmitDocumentsPage').then(m => ({ default: m.SubmitDocumentsPage })));

function DeepLinkListener() {
  const navigate = useNavigate();

  useEffect(() => {
    let cleanupDeepLink: (() => void) | void;
    let cleanupNavigate: (() => void) | void;

    if (window.electronAPI && typeof window.electronAPI.onDeepLink === 'function') {
      cleanupDeepLink = window.electronAPI.onDeepLink((url: string) => {
        console.log('[DEEP_LINK] Received deep link:', url);
        const match = url.match(/ems:\/\/*meeting\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
          navigate(`/meeting/${match[1]}`);
        }
      });
    }

    if (window.electronAPI && typeof window.electronAPI.onNavigate === 'function') {
      cleanupNavigate = window.electronAPI.onNavigate((path: string) => {
        console.log('[ELECTRON_NAVIGATE] Received navigation event to:', path);
        navigate(path);
      });
    }

    return () => {
      if (typeof cleanupDeepLink === 'function') cleanupDeepLink();
      if (typeof cleanupNavigate === 'function') cleanupNavigate();
    };
  }, [navigate]);

  return null;
}

function MeetingRouteHandler() {
  const { id } = useParams<{ id: string }>();
  const joinMeeting = useMeetingStore(state => state.joinMeeting);
  
  useEffect(() => {
    if (id) {
      joinMeeting(id);
    }
  }, [id, joinMeeting]);

  return <Navigate to="/dashboard" replace />;
}

function App() {
  const { isAuthenticated, user, updateUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && (!user || !user.name)) {
      getMyProfile()
        .then((profile) => {
          updateUser(profile);
        })
        .catch((err) => {
          console.error('Failed to restore user name', err);
        });
    }
  }, [isAuthenticated, user]);

  return (
    <ErrorBoundary>
      <OnboardingProvider>
        <HashRouter>
        <DeepLinkListener />
        <GlobalMeetingOverlay />
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        }>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/2fa" element={<TwoFactorPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/locked" element={<AccountLockedPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPlaceholder />} />

            {/* Public QR Profile */}
            <Route path="/public/profile/:id" element={<PublicProfilePage />} />
            
            {/* Protected App Shell */}
              <Route element={
                <ActivityProvider>
                  <AppLayout />
                </ActivityProvider>
              }>
                <Route path="/" element={<RoleBasedRedirect />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/change-password" element={<ChangePasswordPage />} />

                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'Dept Head', 'Team Lead', 'Employee', 'Intern']} />}>
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/documents/me" element={<SubmitDocumentsPage />} />
                  <Route path="/files" element={<FileExplorer />} />
                  <Route path="/analytics/meetings" element={<MeetingAnalyticsPage />} />
                </Route>
                
                {/* Employee Routes (Everyone can submit requests) */}
                <Route path="/requests/new" element={<NewRequestPage />} />
                <Route path="/requests/my" element={<MyRequestsPage />} />

                {/* Attendance Routes */}
                <Route path="/attendance/check-in" element={<CheckInPage />} />
                <Route path="/attendance/standups" element={<StandupsTrackerPage />} />
                <Route path="/attendance/log" element={<AttendanceLogPage />} />
                <Route path="/attendance/enroll-face" element={<EnrollFacePage />} />

                {/* Messaging Routes */}
                <Route path="/messages" element={<ChatPage />} />

                {/* Meetings Route */}
                <Route path="/meetings" element={<MeetingsPage />} />
                <Route path="/meeting/:id" element={<MeetingRouteHandler />} />

                {/* Projects Routes */}
                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'Dept Head', 'Team Lead', 'HR', 'CEO', 'CTO']} />}>
                  <Route path="/projects" element={<ProjectsDashboardPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailsPage />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'Dept Head', 'CEO', 'CTO', 'Team Lead', 'Reporting Manager']} />}>
                  <Route path="/projects/new" element={<CreateProjectPage />} />
                </Route>

                {/* Quotations (CEO/CTO Only) */}
                <Route element={<ProtectedRoute allowedRoles={['CEO', 'CTO', 'Super Admin']} />}>
                  <Route path="/quotations" element={<QuotationsPage />} />
                </Route>

                {/* Employee Routes */}
                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO']} />}>
                  <Route path="/employees/:id" element={<EmployeeDetailsPage />} />
                  <Route path="/payroll/my-payslips" element={<MyPayslips />} />
                  <Route path="/performance/my-reviews" element={<PerformanceDashboard />} />
                  <Route path="/training" element={<TrainingDashboard />} />
                  <Route path="/claims" element={<MyClaims />} />
                  <Route path="/profile" element={<MyProfile />} />
                  <Route path="/regularization" element={<Regularization />} />
                </Route>

                {/* Manager/HR Approvals */}
                <Route element={<ProtectedRoute allowedRoles={['Team Lead', 'Dept Head', 'HR', 'Super Admin']} />}>
                  <Route path="/requests/queue" element={<ApprovalQueuePage />} />
                </Route>
                
                {/* Super Admin Only */}
                <Route element={<ProtectedRoute allowedRoles={['Super Admin']} />}>
                  <Route path="/admin/assign-team-lead" element={<AssignTeamLeadPage />} />
                  <Route path="/admin/grant-hr" element={<GrantHRPage />} />
                  <Route path="/admin/departments" element={<DepartmentsPage />} />
                  <Route path="/admin/role-cards" element={<RoleCardsDirectory />} />
                  <Route path="/admin/requests" element={<AllRequestsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR', 'CEO', 'CTO']} />}>
                  <Route path="/admin/reports" element={<ReportsPage />} />
                  <Route path="/admin/login-logs" element={<LoginLogsPage />} />
                </Route>

                {/* HR / Super Admin */}
                {/* Manager / Executive Directory */}
                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'HR', 'CEO', 'CTO', 'Dept Head', 'Team Lead', 'Executive', 'HR / Admin Executive']} />}>
                  <Route path="/users" element={<UsersPage />} />
                </Route>

                {/* HR / Super Admin */}
                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'HR', 'CEO', 'CTO', 'Dept Head', 'Team Lead']} />}>
                  <Route path="/hr/performance" element={<HRPerformanceDashboard />} />
                  <Route path="/hr/regularization-queue" element={<RegularizationApprovalPage />} />
                  <Route path="/hr/claims-queue" element={<ClaimsApprovalPage />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'HR']} />}>
                  <Route path="/hr/onboard" element={<OnboardEmployeePage />} />
                  <Route path="/hr/onboarding-dashboard" element={<OnboardingDashboardPage />} />
                  <Route path="/hr/ats" element={<ATSDashboard />} />
                  <Route path="/hr/enroll-face" element={<EnrollFacePage />} />
                  <Route path="/hr/face-approval" element={<FaceApprovalPage />} />
                  <Route path="/hr/attendance-audit" element={<AttendanceAuditPage />} />
                  <Route path="/hr/attendance-dashboard" element={<AttendanceDashboardPage />} />
                  <Route path="/hr/documents/:userId" element={<SubmitDocumentsPage />} />
                  <Route path="/hr/dashboard" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/hr/payroll" element={<PayrollDashboard />} />
                  <Route path="/hr/exits" element={<ExitManagement />} />
                </Route>

                {/* CEO / CRM / Sales */}
                <Route element={<ProtectedRoute allowedRoles={['Super Admin', 'CEO', 'CTO']} />}>
                  <Route path="/crm" element={<CustomerDashboard />} />
                </Route>

              </Route>
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
      </HashRouter>
    </OnboardingProvider>
  </ErrorBoundary>
  );
}

export default App;
