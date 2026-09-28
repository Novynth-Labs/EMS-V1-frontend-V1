import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = string;

// Normalize Prisma enum (SUPER_ADMIN, DEPT_HEAD...) to display strings used in frontend
export const normalizeRole = (role: string): UserRole => {
  const map: Record<string, UserRole> = {
    SUPER_ADMIN: 'Super Admin',
    HR: 'HR',
    DEPT_HEAD: 'Dept Head',
    TEAM_LEAD: 'Team Lead',
    EMPLOYEE: 'Employee',
    INTERN: 'Intern',
    CEO: 'CEO',
    CTO: 'CTO',
  };
  return map[role] ?? role;
};

export const getRoleDashboardRoute = (role: UserRole | string): string => {
  return '/dashboard';
};

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  avatarUrl?: string;
  mustChangePassword?: boolean;
}

interface AuthState {
  user: User | null;
  role: UserRole | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLockedOut: boolean;
  
  // Actions
  loginSuccess: (token: string, user: User) => void;
  setLockedOut: (locked: boolean) => void;
  completePasswordChange: () => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      accessToken: null,
      isAuthenticated: false,
      isLockedOut: false,

      loginSuccess: (token, user) => set({ 
        accessToken: token, 
        user: { ...user, role: normalizeRole(user.role) as UserRole },
        role: normalizeRole(user.role), 
        isAuthenticated: true, 
        isLockedOut: false 
      }),
      
      logout: () => set({ 
        user: null, 
        role: null,
        accessToken: null, 
        isAuthenticated: false,
        isLockedOut: false
      }),
      setLockedOut: (locked) => set({ isLockedOut: locked }),
      completePasswordChange: () => set((state) => ({
        user: state.user ? { ...state.user, mustChangePassword: false } : null
      })),
      updateUser: (userData) => set((state) => ({
        user: state.user ? { ...state.user, ...userData } as User : null
      }))
    }),
    {
      name: 'auth-storage', // unique name for localStorage key
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        isLockedOut: state.isLockedOut
      }),
    }
  )
);
