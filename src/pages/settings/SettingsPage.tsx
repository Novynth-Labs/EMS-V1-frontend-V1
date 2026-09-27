import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { changePassword } from '../../api/auth.api';
import { Lock, User, Shield, Bell, Moon, KeyRound, CheckCircle, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { fetchLatestRelease, DIRECT_WINDOWS_DOWNLOAD_URL, DIRECT_LINUX_DOWNLOAD_URL, CURRENT_VERSION } from '../../utils/githubRelease';

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [releaseInfo, setReleaseInfo] = useState<{ version: string; winUrl: string; linuxUrl: string; releaseUrl: string }>({
    version: CURRENT_VERSION,
    winUrl: DIRECT_WINDOWS_DOWNLOAD_URL,
    linuxUrl: DIRECT_LINUX_DOWNLOAD_URL,
    releaseUrl: 'https://github.com/Tejaspadaki/EMS-V1-frontend-V1/releases/latest',
  });

  useEffect(() => {
    fetchLatestRelease().then((info) => {
      setReleaseInfo({
        version: info.version,
        winUrl: info.windowsInstallerUrl || DIRECT_WINDOWS_DOWNLOAD_URL,
        linuxUrl: info.linuxAppImageUrl || DIRECT_LINUX_DOWNLOAD_URL,
        releaseUrl: info.htmlUrl || 'https://github.com/Tejaspadaki/EMS-V1-frontend-V1/releases/latest',
      });
    }).catch(() => {});
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await changePassword(newPassword);
      setMessage({ type: 'success', text: 'Password updated successfully' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  const sidebarItems = [
    { icon: <Lock size={18} />, label: 'Security', active: true },
    { icon: <User size={18} />, label: 'Profile Details', disabled: true },
    { icon: <Bell size={18} />, label: 'Notifications', disabled: true },
    { icon: <Moon size={18} />, label: 'Appearance', disabled: true },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account preferences and security settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100'
                  : 'text-slate-500 hover:bg-slate-50 cursor-not-allowed opacity-50'
              }`}
            >
              <span className={item.active ? 'text-indigo-600' : ''}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="md:col-span-2 space-y-5">
          <Card hover={false}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-indigo-50">
                  <Shield className="text-indigo-600" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
                  <p className="text-sm text-slate-500">Ensure your account is using a strong password.</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                {message.text && (
                  <div className={`p-3.5 rounded-xl text-sm flex items-center gap-2.5 ${
                    message.type === 'error' 
                      ? 'bg-red-50 border border-red-100 text-red-700' 
                      : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                  }`}>
                    {message.type === 'success' ? <CheckCircle size={16} /> : null}
                    {message.text}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                  <input
                    type="password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
                
                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loading || !newPassword || !confirmPassword}
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card hover={false}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-50">
                    <Download className="text-purple-600" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Novynth Workflow Desktop Apps</h2>
                    <p className="text-sm text-slate-500">Download native desktop applications hosted on GitHub Releases.</p>
                  </div>
                </div>
                {releaseInfo?.version && (
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                    v{releaseInfo.version}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Windows Card */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                      🪟 Windows Setup Installer
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">Win 10/11</span>
                  </div>
                  <p className="text-xs text-slate-500">Official Windows NSIS setup package with auto-update integration.</p>
                  <div className="pt-1">
                    <a
                      href={releaseInfo?.winUrl || 'https://github.com/Tejaspadaki/EMS-V1-frontend-V1/releases/latest'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                    >
                      Download Setup (.exe)
                    </a>
                  </div>
                </div>

                {/* Linux Card */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                      🐧 Linux AppImage
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">All Distros</span>
                  </div>
                  <p className="text-xs text-slate-500">Universal Linux AppImage executable for Ubuntu, Fedora, Debian & Arch.</p>
                  <div className="pt-1">
                    <a
                      href={releaseInfo?.linuxUrl || 'https://github.com/Tejaspadaki/EMS-V1-frontend-V1/releases/latest'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                    >
                      Download AppImage (.AppImage)
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover={false}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-sky-50">
                  <KeyRound className="text-sky-600" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Connected Accounts</h2>
                  <p className="text-sm text-slate-500">Manage your single sign-on connections.</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600">
                    G
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900">Google Single Sign-On</p>
                    <p className="text-xs text-slate-500 mt-0.5">Connected as {user?.email}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100">Active</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};