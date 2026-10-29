export interface SystemInfo {
  platform: string;
  arch: string;
  totalMem: number;
  freeMem: number;
  cpus: number;
}

export interface UpdaterStatusData {
  status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error';
  version?: string;
  error?: string;
}

export interface UpdaterProgressData {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface ElectronAPI {
  onDeepLink: (callback: (url: string) => void) => (() => void) | void;
  onNavigate: (callback: (path: string) => void) => (() => void) | void;
  openDialog: (options: any) => Promise<any>;
  saveDialog: (options: any) => Promise<any>;
  showNotification: (options: { title: string; body: string; route?: string; silent?: boolean }) => void;
  showIncomingCallNotification: (options: { title: string; body: string; route?: string }) => void;
  dismissIncomingCall: () => void;
  getSystemInfo: () => Promise<SystemInfo>;
  checkForUpdates: () => Promise<{ success: boolean; version?: string; error?: string }>;
  quitAndInstall: () => Promise<void>;
  getAppVersion: () => Promise<string>;
  onUpdaterStatus: (callback: (data: UpdaterStatusData) => void) => (() => void) | void;
  onUpdaterProgress: (callback: (data: UpdaterProgressData) => void) => (() => void) | void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
