export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface LatestReleaseInfo {
  hasRelease: boolean;
  tagName: string;
  version: string;
  releaseNotes?: string;
  htmlUrl: string;
  windowsInstallerUrl: string;
  linuxAppImageUrl: string;
  assets: ReleaseAsset[];
}

const GITHUB_OWNER = 'Tejaspadaki';
const GITHUB_REPO = 'EMS-V1-frontend-V1';
export const CURRENT_VERSION = '2.1.0';

export const getBackendBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5000';
  }
  return 'https://ems-backend.yuktiyantra.com';
};

export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

export const getDirectWindowsDownloadUrl = (version?: string): string => {
  const base = getBackendBaseUrl();
  const ver = version || CURRENT_VERSION;
  return `${base}/updates/download/windows?version=${ver}`;
};

export const getDirectLinuxDownloadUrl = (version?: string): string => {
  const base = getBackendBaseUrl();
  const ver = version || CURRENT_VERSION;
  return `${base}/updates/download/linux?version=${ver}`;
};

export const DIRECT_WINDOWS_DOWNLOAD_URL = getDirectWindowsDownloadUrl();
export const DIRECT_LINUX_DOWNLOAD_URL = getDirectLinuxDownloadUrl();

export type OperatingSystem = 'windows' | 'linux' | 'other';

/**
 * Detect user's Operating System safely in browser environment.
 */
export function detectOS(): OperatingSystem {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent || '';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return 'other';
}

/**
 * Fetch the latest GitHub Release metadata dynamically via the backend.
 */
export async function fetchLatestRelease(version?: string): Promise<LatestReleaseInfo> {
  const base = getBackendBaseUrl();
  const targetVer = version || CURRENT_VERSION;
  const apiUrl = `${base}/api/updates/latest${version ? `?version=${version}` : ''}`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.warn(`[Update API] Backend returned status ${response.status}`);
      return {
        hasRelease: true,
        tagName: `v${targetVer}`,
        version: targetVer,
        htmlUrl: `${RELEASES_PAGE_URL}/tag/v${targetVer}`,
        windowsInstallerUrl: getDirectWindowsDownloadUrl(targetVer),
        linuxAppImageUrl: getDirectLinuxDownloadUrl(targetVer),
        assets: [],
      };
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error("Backend reported failure fetching release");
    }

    const resolvedVersion = data.version || targetVer;
    const tagName = data.tagName || `v${resolvedVersion}`;

    // Ensure URLs are absolute
    const winUrl = data.windows?.startsWith('http') 
      ? data.windows 
      : `${base}${data.windows || `/updates/download/windows?version=${resolvedVersion}`}`;
      
    const linuxUrl = data.linux?.startsWith('http') 
      ? data.linux 
      : `${base}${data.linux || `/updates/download/linux?version=${resolvedVersion}`}`;

    return {
      hasRelease: true,
      tagName,
      version: resolvedVersion,
      releaseNotes: data.releaseNotes || `Novynth Workflow Desktop App v${resolvedVersion}`,
      htmlUrl: data.releaseUrl || `${RELEASES_PAGE_URL}/tag/v${resolvedVersion}`,
      windowsInstallerUrl: winUrl,
      linuxAppImageUrl: linuxUrl,
      assets: [],
    };
  } catch (error) {
    console.warn('[Update API] Failed to fetch release metadata from backend:', error);
    return {
      hasRelease: true,
      tagName: `v${targetVer}`,
      version: targetVer,
      htmlUrl: `${RELEASES_PAGE_URL}/tag/v${targetVer}`,
      windowsInstallerUrl: getDirectWindowsDownloadUrl(targetVer),
      linuxAppImageUrl: getDirectLinuxDownloadUrl(targetVer),
      assets: [],
    };
  }
}

