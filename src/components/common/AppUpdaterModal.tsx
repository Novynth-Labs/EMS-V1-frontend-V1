import React, { useState, useEffect } from 'react';
import { X, Info, Download, Sparkles, Monitor, Terminal, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { UpdaterStatusData, UpdaterProgressData } from '../../electron-api';
import { fetchLatestRelease, detectOS, CURRENT_VERSION, getDirectWindowsDownloadUrl, getDirectLinuxDownloadUrl, type LatestReleaseInfo, type OperatingSystem } from '../../utils/githubRelease';

interface AppUpdaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStatus?: 'downloaded' | 'idle' | 'checking' | 'available';
  initialVersion?: string;
}

export const AppUpdaterModal: React.FC<AppUpdaterModalProps> = ({ 
  isOpen, 
  onClose,
  initialStatus = 'idle',
  initialVersion = CURRENT_VERSION
}) => {
  const [currentVersion, setCurrentVersion] = useState<string>(initialVersion);
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>(initialStatus);
  const [targetVersion, setTargetVersion] = useState<string>(initialVersion);
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [detectedOS, setDetectedOS] = useState<OperatingSystem>('windows');
  const [selectedPlatform, setSelectedPlatform] = useState<'windows' | 'linux'>('windows');
  const [releaseInfo, setReleaseInfo] = useState<LatestReleaseInfo | null>(null);
  const [loadingRelease, setLoadingRelease] = useState<boolean>(true);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    if (!isOpen) return;
    setIsClosing(false);

    const os = detectOS();
    setDetectedOS(os);
    if (os === 'linux') {
      setSelectedPlatform('linux');
    } else {
      setSelectedPlatform('windows');
    }

    setLoadingRelease(true);
    fetchLatestRelease()
      .then((info) => {
        setReleaseInfo(info);
        if (info.version) {
          setTargetVersion(info.version);
        }
      })
      .catch((err) => {
        console.error('Failed to load latest release info:', err);
      })
      .finally(() => {
        setLoadingRelease(false);
      });

    if (isElectron && window.electronAPI) {
      window.electronAPI.getAppVersion().then((ver) => {
        if (ver) setCurrentVersion(ver);
      }).catch(() => {});

      const removeStatusListener = window.electronAPI.onUpdaterStatus((data: UpdaterStatusData) => {
        if (data.status === 'checking') {
          setStatus('checking');
        } else if (data.status === 'available') {
          setStatus('available');
          if (data.version) setTargetVersion(data.version);
        } else if (data.status === 'not-available') {
          setStatus('not-available');
          if (data.version) setCurrentVersion(data.version);
        } else if (data.status === 'downloaded') {
          setStatus('downloaded');
          if (data.version) setTargetVersion(data.version);
        } else if (data.status === 'error') {
          setStatus('error');
          setErrorMessage(data.error || 'Failed to check or download update');
        }
      });

      const removeProgressListener = window.electronAPI.onUpdaterProgress((data: UpdaterProgressData) => {
        setStatus('downloading');
        setProgress(Math.round(data.percent || 0));
      });

      return () => {
        if (removeStatusListener) removeStatusListener();
        if (removeProgressListener) removeProgressListener();
      };
    }
  }, [isOpen, isElectron]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const handleRestartNow = () => {
    if (isElectron && window.electronAPI) {
      window.electronAPI.quitAndInstall();
    } else {
      handleClose();
    }
  };

  const displayVersion = releaseInfo?.version || targetVersion || CURRENT_VERSION;
  const winUrl = releaseInfo?.windowsInstallerUrl || getDirectWindowsDownloadUrl(displayVersion);
  const linuxUrl = releaseInfo?.linuxAppImageUrl || getDirectLinuxDownloadUrl(displayVersion);
  const releasePageUrl = releaseInfo?.htmlUrl || `https://github.com/Novynth-Labs/EMS-V1-frontend-V1/releases`;
  const hasReleaseAsset = true;

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes updaterBackdropFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(12px); }
        }
        @keyframes updaterBackdropFadeOut {
          from { opacity: 1; backdrop-filter: blur(12px); }
          to { opacity: 0; backdrop-filter: blur(0px); }
        }
        @keyframes updaterModalPopIn {
          0% { opacity: 0; transform: scale(0.90) translateY(16px); }
          70% { transform: scale(1.01) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes updaterModalPopOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to { opacity: 0; transform: scale(0.92) translateY(12px); }
        }
      `}</style>

      {/* Backdrop overlay */}
      <div 
        onClick={handleClose}
        style={{
          animation: isClosing 
            ? 'updaterBackdropFadeOut 0.2s ease-out forwards' 
            : 'updaterBackdropFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
      >
        {/* Modal Window */}
        <div 
          onClick={e => e.stopPropagation()}
          style={{
            animation: isClosing 
              ? 'updaterModalPopOut 0.2s ease-in forwards' 
              : 'updaterModalPopIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
          className="bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 max-w-[540px] w-full overflow-hidden transition-all relative"
        >
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 backdrop-blur-sm">
            <span className="text-sm font-semibold text-slate-800 tracking-wide flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600 animate-spin" style={{ animationDuration: '6s' }} />
              {isElectron ? 'Novynth Workflow Desktop App Update' : 'Download Novynth Workflow Desktop App'}
            </span>
            <button 
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors active:scale-90"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 space-y-6">

            {/* Electron auto-update prompt */}
            {isElectron && status === 'downloaded' && (
              <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-3">
                <div className="flex items-center gap-3 text-sky-800">
                  <Info size={20} />
                  <p className="text-xs font-semibold">An update has been downloaded automatically!</p>
                </div>
                <button
                  onClick={handleRestartNow}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs rounded-lg transition-all"
                >
                  Restart Application Now
                </button>
              </div>
            )}

            {/* Primary Download Section */}
            {!isElectron && (
              <div className="p-5 bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 rounded-2xl border border-indigo-100/80 text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100/70 text-indigo-700 rounded-full text-xs font-semibold">
                  <span>Detected OS: {detectedOS === 'windows' ? 'Windows' : detectedOS === 'linux' ? 'Linux' : 'Other Platform'}</span>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900">Download Desktop Application</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Experience offline capability, native desktop notifications, and real-time background sync.
                </p>

                {loadingRelease ? (
                  <div className="py-4 text-xs font-medium text-slate-500 flex items-center justify-center gap-2">
                    <Sparkles size={14} className="animate-spin text-indigo-600" />
                    Checking for latest published release...
                  </div>
                ) : hasReleaseAsset ? (
                  <div className="pt-2 flex flex-col items-center gap-2">
                    {detectedOS === 'windows' && winUrl && (
                      <a
                        href={winUrl}
                        download
                        onClick={handleClose}
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <Download size={18} />
                        Download for Windows (Setup .exe)
                      </a>
                    )}

                    {detectedOS === 'linux' && linuxUrl && (
                      <a
                        href={linuxUrl}
                        download
                        onClick={handleClose}
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <Download size={18} />
                        Download for Linux (.AppImage)
                      </a>
                    )}

                    <span className="text-[11px] font-medium text-slate-400 mt-1">
                      Latest Version: <strong className="text-slate-600">v{displayVersion}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-left space-y-2">
                    <div className="flex items-start gap-2 text-amber-800">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold">Release v{displayVersion} Pending GitHub Publish</p>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          The installer binary is being compiled & published via GitHub Actions. Push to <code className="bg-amber-100 px-1 py-0.5 rounded">main</code> branch to generate release artifacts on GitHub.
                        </p>
                      </div>
                    </div>
                    <div className="pt-1 text-center">
                      <a
                        href={releasePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white font-medium text-xs rounded-lg hover:bg-amber-700 transition-colors"
                      >
                        View Releases Page <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Platform Selection Tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Release Packages
                </h4>
                <a
                  href={releasePageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  GitHub Releases <ExternalLink size={12} />
                </a>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setSelectedPlatform('windows')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedPlatform === 'windows'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Monitor size={15} />
                  Windows (.exe)
                </button>
                <button
                  onClick={() => setSelectedPlatform('linux')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedPlatform === 'linux'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Terminal size={15} />
                  Linux (.AppImage)
                </button>
              </div>

              <div className="space-y-2 pt-1">
                {selectedPlatform === 'windows' && (
                  winUrl ? (
                    <a
                      href={winUrl}
                      download
                      onClick={handleClose}
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/40 rounded-xl transition-all group"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600">
                            Windows Setup Installer (.exe)
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            NSIS
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Official Windows setup with auto-update support</p>
                      </div>
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Download size={18} />
                      </div>
                    </a>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                      Windows installer binary will be available once published to GitHub Releases.
                    </div>
                  )
                )}

                {selectedPlatform === 'linux' && (
                  linuxUrl ? (
                    <a
                      href={linuxUrl}
                      download
                      onClick={handleClose}
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 border border-slate-200 hover:border-purple-300 bg-white hover:bg-purple-50/40 rounded-xl transition-all group"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 group-hover:text-purple-600">
                            Universal Linux AppImage (.AppImage)
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            All Distros
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Standalone binary executable for Ubuntu, Fedora, Mint & Arch</p>
                      </div>
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-all">
                        <Download size={18} />
                      </div>
                    </a>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                      Linux AppImage binary will be available once published to GitHub Releases.
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Footer Notice */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Hosted securely via GitHub Releases</span>
              <button
                onClick={handleClose}
                className="font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};
