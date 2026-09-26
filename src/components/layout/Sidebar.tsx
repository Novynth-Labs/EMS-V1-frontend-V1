import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { 
  LayoutDashboard, Users, CheckSquare, Settings, UserPlus, 
  ClipboardList, Camera, MessageCircle, FolderKanban, 
  FileText, PlusCircle, Shield, ShieldAlert, BarChart3, UserCheck, 
  GitPullRequest, Building2, Calendar, UserMinus, BookOpen, Clock,
  ChevronDown, ChevronRight, Award, DollarSign, Hexagon, Video
} from 'lucide-react';

export interface SidebarProps {
  collapsed: boolean;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const { role, user } = useAuthStore();
  const { pendingRemindersCount } = useOnboarding();
  const location = useLocation();

  // Collapsible section state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const savedNew = localStorage.getItem('novynth_sidebar_collapsed_sections');
      if (savedNew) return JSON.parse(savedNew);

      // Migrate from old key if present
      const savedOld = localStorage.getItem('ems_sidebar_collapsed_sections');
      if (savedOld) {
        try {
          localStorage.setItem('novynth_sidebar_collapsed_sections', savedOld);
        } catch (err) {
          console.error('Failed to migrate sidebar state to new key', err);
        }
        return JSON.parse(savedOld);
      }

      return {};
    } catch {
      return {};
    }
  });

  const toggleSection = (sectionTitle: string) => {
      setCollapsedSections(prev => {
      const updated = { ...prev, [sectionTitle]: !prev[sectionTitle] };
      try {
        localStorage.setItem('novynth_sidebar_collapsed_sections', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save sidebar state', err);
      }
      return updated;
    });
  };

  const allSections: NavSection[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'Tasks', path: '/tasks', icon: <CheckSquare size={18} />, roles: ['Super Admin', 'Dept Head', 'Team Lead', 'Employee', 'Intern'] },
        // { label: 'Standups', path: '/attendance/standups', icon: <Users size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'Meetings', path: '/meetings', icon: <Calendar size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'File Explorer', path: '/files', icon: <ClipboardList size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
      ],
    },
    {
      title: 'Requests',
      items: [
        { label: 'My Requests', path: '/requests/my', icon: <FileText size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'New Request', path: '/requests/new', icon: <PlusCircle size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'Approval Queue', path: '/requests/queue', icon: <GitPullRequest size={18} />, roles: ['Team Lead', 'Dept Head', 'HR', 'Super Admin'] },
        { label: 'System Requests', path: '/admin/requests', icon: <ClipboardList size={18} />, roles: ['Super Admin'] },
      ],
    },
    {
      title: 'Projects',
      items: [
        { label: 'Projects', path: '/projects', icon: <FolderKanban size={18} />, roles: ['Super Admin', 'Dept Head', 'Team Lead', 'HR', 'CEO', 'CTO'] },
        { label: 'New Project', path: '/projects/new', icon: <PlusCircle size={18} />, roles: ['Super Admin', 'Dept Head', 'Team Lead', 'CEO', 'CTO'] },
        { label: 'Quotations', path: '/quotations', icon: <FileText size={18} />, roles: ['Super Admin', 'CEO', 'CTO'] },
      ],
    },
    // {
    //   title: 'CRM',
    //   items: [
    //     { label: 'Customer Dashboard', path: '/crm', icon: <Users size={18} />, roles: ['Super Admin', 'CEO', 'CTO'] },
    //   ],
    // },
    {
      title: 'Communication',
      items: [
        { label: 'Messages', path: '/messages', icon: <MessageCircle size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'Meetings', path: '/meetings', icon: <Video size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
      ],
    },
    {
      title: 'Attendance',
      items: [
        { label: 'Check-In', path: '/attendance/check-in', icon: <Camera size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'Attendance Log', path: '/attendance/log', icon: <ClipboardList size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
      ],
    },
    {
      title: 'People',
      items: [
        { label: 'My Profile', path: '/profile', icon: <UserCheck size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'My Role Card', path: `/employees/${user?.id}`, icon: <UserCheck size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        // { label: 'My Payslips', path: '/payroll/my-payslips', icon: <FileText size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        // { label: 'My Claims', path: '/claims', icon: <FileText size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'Attendance Fix', path: '/regularization', icon: <Clock size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'My Performance', path: '/performance/my-reviews', icon: <UserCheck size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'Training Center', path: '/training', icon: <BookOpen size={18} />, roles: ['Super Admin', 'HR', 'Dept Head', 'Team Lead', 'Employee', 'Intern', 'CEO', 'CTO'] },
        { label: 'Users', path: '/users', icon: <Users size={18} />, roles: ['Super Admin', 'HR', 'CEO', 'CTO', 'Dept Head', 'Team Lead', 'Executive', 'HR / Admin Executive'] },
      ],
    },
    {
      title: 'HR',
      items: [
        { label: 'HR Dashboard', path: '/hr/dashboard', icon: <BarChart3 size={18} />, roles: ['Super Admin', 'HR'] },
        { label: 'Performance Admin', path: '/hr/performance', icon: <Award size={18} />, roles: ['Super Admin', 'HR', 'CEO', 'CTO', 'Dept Head', 'Team Lead'] },
        { label: 'Regularization Queue', path: '/hr/regularization-queue', icon: <Clock size={18} />, roles: ['Super Admin', 'HR', 'CEO', 'CTO', 'Dept Head', 'Team Lead'] },
        // { label: 'Claims Queue', path: '/hr/claims-queue', icon: <DollarSign size={18} />, roles: ['Super Admin', 'HR', 'CEO', 'CTO', 'Dept Head', 'Team Lead'] },
        // { label: 'Payroll Admin', path: '/hr/payroll', icon: <FileText size={18} />, roles: ['Super Admin', 'HR'] },
        // { label: 'Exit Management', path: '/hr/exits', icon: <UserMinus size={18} />, roles: ['Super Admin', 'HR'] },
        { label: 'Onboard Employee', path: '/hr/onboard', icon: <UserPlus size={18} />, roles: ['Super Admin', 'HR'] },
        { label: 'Onboarding Dashboard', path: '/hr/onboarding-dashboard', icon: <ClipboardList size={18} />, roles: ['Super Admin', 'HR'], badge: pendingRemindersCount },
        // { label: 'Recruitment (ATS)', path: '/hr/ats', icon: <Users size={18} />, roles: ['Super Admin', 'HR', 'CEO'] },
        { label: 'Enroll Face', path: '/hr/enroll-face', icon: <Camera size={18} />, roles: ['Super Admin', 'HR'] },
        { label: 'Face Approvals', path: '/hr/face-approval', icon: <UserCheck size={18} />, roles: ['Super Admin', 'HR'] },
        { label: 'Attendance Audit', path: '/hr/attendance-audit', icon: <Shield size={18} />, roles: ['Super Admin', 'HR'] },
        { label: 'Attendance Dashboard', path: '/hr/attendance-dashboard', icon: <BarChart3 size={18} />, roles: ['Super Admin', 'HR'] },
      ],
    },
    {
      title: 'Administration',
      items: [
        { label: 'Assign Team Lead', path: '/admin/assign-team-lead', icon: <Users size={18} />, roles: ['Super Admin'] },
        { label: 'Grant HR', path: '/admin/grant-hr', icon: <Shield size={18} />, roles: ['Super Admin'] },
        { label: 'Departments', path: '/admin/departments', icon: <Building2 size={18} />, roles: ['Super Admin'] },
        { label: 'Role Cards', path: '/admin/role-cards', icon: <UserCheck size={18} />, roles: ['Super Admin'] },
        { label: 'Login Logs', path: '/admin/login-logs', icon: <ShieldAlert size={18} />, roles: ['Super Admin', 'Admin', 'HR', 'CEO', 'CTO'] },
        { label: 'Settings', path: '/settings', icon: <Settings size={18} />, roles: ['Super Admin'] },
      ],
    },
  ];

  const visibleSections = allSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(role as string)),
    }))
    .filter(section => section.items.length > 0);

  const isActive = (path: string) => {
    if (path === `/employees/${user?.id}`) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <aside className={`novynth-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="h-16 flex items-center justify-center border-b border-white/10 shrink-0 px-4">
        <div className="flex items-center gap-3 w-full">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0 border border-white/10">
            <Hexagon size={20} className="text-white fill-white/20" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <h1 className="text-white font-extrabold text-base tracking-tight leading-none">Novynth Workflow</h1>
              <span className="text-[10px] text-white/40 font-medium mt-0.5">SaaS Enterprise</span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-1">
        {visibleSections.map((section) => {
          const isSectionCollapsed = Boolean(collapsedSections[section.title]);

          return (
            <div key={section.title} className="mb-1">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors group cursor-pointer"
                >
                  <span>{section.title}</span>
                  {isSectionCollapsed ? (
                    <ChevronRight size={12} className="text-white/30 group-hover:text-white/60" />
                  ) : (
                    <ChevronDown size={12} className="text-white/30 group-hover:text-white/60" />
                  )}
                </button>
              ) : null}

              {(!collapsed && isSectionCollapsed) ? null : (
                <ul className="flex flex-col gap-0.5 px-2.5">
                  {section.items.map(item => {
                    const active = isActive(item.path);
                    return (
                      <li key={item.path}>
                        <NavLink 
                          to={item.path}
                          className={`
                            relative flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200
                            ${active 
                              ? 'bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white shadow-md shadow-indigo-500/20' 
                              : 'text-white/65 hover:text-white hover:bg-white/10'
                            }
                            ${collapsed ? 'justify-center px-2' : ''}
                          `}
                          title={collapsed ? item.label : undefined}
                        >
                          <span className={`shrink-0 ${active ? 'text-white' : 'text-white/50'}`}>{item.icon}</span>
                          {!collapsed && (
                            <span className="flex-1 truncate">{item.label}</span>
                          )}
                          
                          {!!item.badge && item.badge > 0 && (
                            <span className={`
                              flex items-center justify-center font-bold
                              ${collapsed 
                                ? 'absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] bg-red-500 rounded-full text-white shadow-md' 
                                : 'bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-md'
                              }
                            `}>
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 px-3 pb-4 pt-2 border-t border-white/5">
            <div className={`rounded-xl bg-white/5 border border-white/10 p-3 ${collapsed ? 'hidden' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Novynth Workflow v1.0</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-white/60 text-xs font-semibold mt-1 truncate">{user?.name || 'Logged in'}</p>
          <p className="text-white/30 text-[10px] truncate">{role || 'User'}</p>
        </div>
      </div>
    </aside>
  );
};

