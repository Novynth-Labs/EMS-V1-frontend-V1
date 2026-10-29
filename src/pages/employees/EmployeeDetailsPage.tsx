import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { getEmployeeDetails, generateRoleCard, regenerateRoleCard, exportRoleCardPDF, unlockEmployeeAccount, lockEmployeeAccount, type EmployeeDetails } from '../../api/employees.api';
import { getInitials } from '../../utils/initials';
import { ContributionGauge } from '../../components/analytics/ContributionGauge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Download, Fingerprint, Shield, Clock, ShieldAlert, Camera, LayoutDashboard, Settings as SettingsIcon, Mail, Briefcase, MapPin, Phone, AlertTriangle, Calendar, Star, TrendingUp, Award, User, PhoneCall, CreditCard, Building2, CheckCircle2, Lock, Unlock } from 'lucide-react';
import { useFaceApi } from '../../hooks/useFaceApi';
import { enrollFace } from '../../api/attendance.api';
import { performanceApi } from '../../api/performance.api';
import { getMyProfile, updateMyProfile } from '../../api/profile.api';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { toast } from '../../utils/toast';

export const EmployeeDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { role, user } = useAuthStore();
  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'rolecard' | 'audit' | 'attendance' | 'settings'>('overview');

  // Modals
  const [generateModal, setGenerateModal] = useState(false);
  const [regenerateModal, setRegenerateModal] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  
  // Actions state
  const [actionLoading, setActionLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Face Enrollment
  const [enrollModal, setEnrollModal] = useState(false);
  const { isLoaded: faceApiLoaded, detectFaceAndGetDescriptor, captureFrameAsJpeg } = useFaceApi();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [enrollStream, setEnrollStream] = useState<MediaStream | null>(null);
  const [enrollStatus, setEnrollStatus] = useState<string>('');

  // Performance Review
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({ review_period: 'Q1 2026', rating: 4, kpi_score: 85, feedback: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  // Profile Settings
  const [profileForm, setProfileForm] = useState({
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    skills: '',
    avatarUrl: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    if (activeTab === 'settings') {
      loadProfileData();
    }
  }, [activeTab]);

  const loadProfileData = async () => {
    try {
      const data = await getMyProfile();
      if (data) {
        setProfileForm({
          phone: data.phone || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          ifsc_code: data.ifsc_code || '',
          skills: Array.isArray(data.skills) ? data.skills.join(', ') : (data.skills || ''),
          avatarUrl: data.avatarUrl || ''
        });
      }
    } catch (err) {
      console.error('Failed to load profile settings', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess('');
    try {
      const skillsArray = profileForm.skills ? profileForm.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
      await updateMyProfile({
        ...profileForm,
        skills: skillsArray
      });
      // Update global auth store if avatar was changed
      if (profileForm.avatarUrl && profileForm.avatarUrl !== user?.avatarUrl) {
        useAuthStore.getState().updateUser({ avatarUrl: profileForm.avatarUrl });
      }
      setProfileSuccess('Profile settings updated successfully!');
      setTimeout(() => setProfileSuccess(''), 4000);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to update profile settings');
    } finally {
      setProfileSaving(false);
    }
  };

  const [uploadingImage, setUploadingImage] = useState(false);
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadingImage(true);
    try {
      const api = (await import('../../api/axios')).default;
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success && res.data?.data?.url) {
        setProfileForm({ ...profileForm, avatarUrl: res.data.data.url });
      } else {
        throw new Error('Upload failed');
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const loadData = async () => {
    if (!id) return;
    try {
      const data = await getEmployeeDetails(id);
      setEmployee(data);
      try {
        const allRev = await performanceApi.getAllReviews();
        const filtered = (allRev || []).filter((r: any) => String(r.user_id) === String(id));
        setReviews(filtered);
      } catch (err) {
        console.error('Failed to load user reviews', err);
      }
    } catch (err) {
      console.error('Failed to load employee details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSubmitReview = async () => {
    if (!id) return;
    setReviewSubmitting(true);
    try {
      await performanceApi.submitReview({
        user_id: parseInt(id),
        ...reviewData
      });
      setReviewModal(false);
      setReviewData({ review_period: 'Q1 2026', rating: 4, kpi_score: 85, feedback: '' });
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    if (!id) return;
    setActionLoading(true);
    await generateRoleCard(id);
    setActionLoading(false);
    setGenerateModal(false);
    loadData();
  };

  const handleRegenerate = async () => {
    if (!id) return;
    setActionLoading(true);
    await regenerateRoleCard(id);
    setActionLoading(false);
    setRegenerateModal(false);
    setRegenConfirm(false);
    loadData();
  };

  const handleExportPDF = async () => {
    if (!id) return;
    setExportLoading(true);
    setExportError(null);
    try {
      const { url } = await exportRoleCardPDF(id);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RoleCard_${employee?.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.message === 'rate_limit') {
        setExportError("You've hit the export limit, try again in a minute.");
      } else {
        setExportError("Failed to export PDF.");
      }
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    if (videoRef.current && enrollStream) {
      videoRef.current.srcObject = enrollStream;
    }
  }, [enrollStream, enrollModal]);

  const startCamera = async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      setEnrollStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setEnrollStatus('Camera access denied or unavailable.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setEnrollStream(null);
  };

  const handleEnrollFace = async () => {
    if (!videoRef.current || !id) return;
    
    setEnrollStatus('Detecting face...');
    setActionLoading(true);
    try {
      const descriptor = await detectFaceAndGetDescriptor(videoRef.current);
      if (!descriptor) {
        setEnrollStatus('No face detected. Please look directly at the camera.');
        setActionLoading(false);
        return;
      }

      setEnrollStatus('Saving face data...');
      const capturedImage = captureFrameAsJpeg(videoRef.current, 0.5, 320) || undefined;

      await enrollFace({ 
        employeeId: id, 
        descriptors: { front: descriptor },
        images: capturedImage ? { front: capturedImage } : undefined
      });
      
      setEnrollStatus('Face enrolled successfully!');
      setTimeout(() => {
        setEnrollModal(false);
        stopCamera();
        setEnrollStatus('');
      }, 2000);
    } catch (err: any) {
      setEnrollStatus('Error: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const [unlockLoading, setUnlockLoading] = useState(false);

  const handleUnlockAccount = async () => {
    if (!employee) return;
    try {
      setUnlockLoading(true);
      const res = await unlockEmployeeAccount(employee.id);
      if (res.success) {
        toast.success(`Account unlocked: ${employee.name}`);
        setEmployee(prev => prev ? { ...prev, isLocked: false, failedLoginAttempts: 0, lockedAt: null } : null);
      } else {
        toast.error(res.message || 'Failed to unlock account');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to unlock account');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleLockAccount = async () => {
    if (!employee) return;
    try {
      setUnlockLoading(true);
      const res = await lockEmployeeAccount(employee.id, 'Administrative Lock');
      if (res.success) {
        toast.success(`Account locked: ${employee.name}`);
        setEmployee(prev => prev ? { ...prev, isLocked: true, lockedAt: new Date().toISOString() } : null);
      } else {
        toast.error(res.message || 'Failed to lock account');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to lock account');
    } finally {
      setUnlockLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  if (!employee) {
    return <div className="p-8 text-center text-gray-500 font-semibold text-lg">Employee not found.</div>;
  }

  const isSuperAdmin = ['SUPER_ADMIN', 'Super Admin', 'HR', 'DEPT_HEAD', 'Dept Head', 'CEO', 'CTO', 'Executive', 'Admin', 'HR / Admin Executive'].includes(role || '');
  const hasRoleCard = employee.roleCardGenerated;

  const tabStyles = (tabName: string) => `
    flex items-center gap-2 px-6 py-3.5 font-bold text-sm rounded-t-xl transition-all duration-300 cursor-pointer
    ${activeTab === tabName 
      ? 'bg-white/80 backdrop-blur-md text-indigo-700 shadow-[0_-4px_15px_rgba(0,0,0,0.02)] border-t border-x border-white/60 relative z-10' 
      : 'text-gray-500 hover:bg-white/40 hover:text-indigo-500'}
  `;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12 h-[calc(100vh-8rem)] overflow-y-auto pr-2">
      
      {/* Premium Hero Header */}
      <div className="relative bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mt-4">
        {/* Cover Photo / Banner */}
        {/* Header Background Banner */}
        <div className={`h-36 ${employee.isLocked ? 'bg-gradient-to-r from-rose-700 via-red-600 to-amber-600' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'} relative`}>
          <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-white/20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-indigo-900/20 blur-3xl"></div>
        </div>
        
        <div className="px-8 pb-8 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 -mt-16 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className={`w-28 h-28 sm:w-32 sm:h-32 bg-white ${employee.isLocked ? 'text-rose-600' : 'text-indigo-600'} rounded-full flex items-center justify-center text-3xl sm:text-4xl font-black shadow-2xl border-4 border-white ring-4 ${employee.isLocked ? 'ring-rose-500/20' : 'ring-indigo-500/10'} shrink-0`}>
              {getInitials(employee.name)}
            </div>
            <div className="text-center md:text-left pt-3 md:pt-16">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-1.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {employee.name}
                </h1>
                {employee.isLocked ? (
                  <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Lock size={11} className="text-rose-600" /> Locked Account
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 size={11} className="text-emerald-500" /> Active Profile
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-semibold">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 font-bold flex items-center gap-1.5">
                  <Briefcase size={14} /> {employee.role}
                </span>
                <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-xl border border-purple-100 font-bold">
                  {employee.department}
                </span>
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl border border-slate-200 font-mono text-[11px]">
                  ID: {employee.id}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 items-center mb-2">
            {isSuperAdmin && (
              employee.isLocked ? (
                <button 
                  onClick={handleUnlockAccount}
                  disabled={unlockLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {unlockLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Unlock size={15} />
                  )}
                  Unlock Account
                </button>
              ) : (
                <button 
                  onClick={handleLockAccount}
                  disabled={unlockLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  title="Lock account"
                >
                  <Lock size={14} /> Lock Account
                </button>
              )
            )}
            {employee.id === user?.id && (
              <button 
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <SettingsIcon size={16} /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lockout Alert Banner */}
      {employee.isLocked && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-rose-950 flex items-center gap-2">
                Account Currently Locked Out
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                This member is prevented from logging into EMS. {employee.failedLoginAttempts ? `Triggered after ${employee.failedLoginAttempts} failed password attempts.` : 'Restricted by administrative security hold.'}
              </p>
            </div>
          </div>
          {isSuperAdmin && (
            <Button
              variant="primary"
              size="sm"
              disabled={unlockLoading}
              onClick={handleUnlockAccount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 shadow-xs"
            >
              <Unlock size={14} className="mr-1" /> Unlock Member Now
            </Button>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-200/80 pt-2 px-4 gap-2 overflow-x-auto">
        <button onClick={() => setActiveTab('overview')} className={tabStyles('overview')}>
          <LayoutDashboard size={18} /> Overview
        </button>
        <button onClick={() => setActiveTab('rolecard')} className={tabStyles('rolecard')}>
          <Fingerprint size={18} /> Digital Role Card
        </button>
        <button onClick={() => setActiveTab('audit')} className={tabStyles('audit')}>
          <Shield size={18} /> Security Audit
        </button>
        <button onClick={() => setActiveTab('attendance')} className={tabStyles('attendance')}>
          <Calendar size={18} /> Attendance
        </button>
        {employee.id === user?.id && (
          <button onClick={() => setActiveTab('settings')} className={tabStyles('settings')}>
            <SettingsIcon size={18} /> Settings
          </button>
        )}
      </div>

      {/* Tab Content Area */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 min-h-[420px] transition-all">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fade-in">
            
            {/* Personal Information (5 Cols) */}
            <div className="xl:col-span-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600"><User size={18} /></div>
                Personal Information
              </h3>
              
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100 shrink-0"><Mail size={18} /></div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Address</p>
                    <p className="text-sm font-bold text-slate-800">{employee.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100 shrink-0"><Phone size={18} /></div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Phone Number</p>
                    <p className="text-sm font-bold text-slate-800">{employee.phone && employee.phone !== 'N/A' ? employee.phone : 'Not Provided'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 border border-purple-100 shrink-0"><Building2 size={18} /></div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Department</p>
                    <p className="text-sm font-bold text-slate-800">{employee.department}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance & Contribution Metrics (7 Cols) */}
            <div className="xl:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600"><LayoutDashboard size={18} /></div>
                  Performance & Contribution Metrics
                </h3>
                {['SUPER_ADMIN', 'HR', 'DEPT_HEAD', 'TEAM_LEAD', 'CEO', 'CTO', 'HR / Admin Executive', 'Executive', 'Super Admin'].includes(role || '') && (
                  <button 
                    onClick={() => setReviewModal(true)} 
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl px-3.5 py-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    + Add Review
                  </button>
                )}
              </div>
              
              <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center gap-6">
                
                {/* Contribution Gauge */}
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200/80 w-full sm:w-48 shrink-0 shadow-2xs">
                  <ContributionGauge score={employee.contributionScore} isGenerated={hasRoleCard} />
                  <p className="text-[11px] font-bold text-slate-500 mt-2 text-center">Task & Role Completion</p>
                </div>

                {/* Performance Review Appraisal */}
                <div className="flex-1 w-full space-y-3">
                  {reviews.length > 0 ? (
                    (() => {
                      const latest = reviews[0];
                      return (
                        <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1 text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  size={16} 
                                  fill={i < Math.floor(latest.rating) ? 'currentColor' : 'none'} 
                                  className={i < Math.floor(latest.rating) ? '' : 'text-slate-200'} 
                                />
                              ))}
                              <span className="ml-1.5 text-xs font-black text-slate-800">{latest.rating}.0 / 5.0</span>
                            </div>
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-[11px] rounded-full border border-indigo-100">
                              {latest.review_period}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 flex-wrap">
                            {latest.kpi_score != null && (
                              <div className="flex items-center gap-1.5">
                                <TrendingUp size={14} className="text-emerald-600" />
                                <span>KPI Score: <strong className="text-emerald-700 font-extrabold">{latest.kpi_score}%</strong></span>
                              </div>
                            )}
                            {latest.reviewer_name && (
                              <div>Reviewed by: <strong className="text-slate-800">{latest.reviewer_name}</strong></div>
                            )}
                          </div>

                          {latest.feedback && (
                            <p className="text-xs text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                              "{latest.feedback}"
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                      <Award size={32} className="text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-700">No Appraisals Recorded</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click "+ Add Review" above to evaluate this employee.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ROLE CARD TAB */}
        {activeTab === 'rolecard' && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Digital Role Card</h3>
                <p className="text-xs text-slate-500 mt-0.5">Physical and digital QR access profile for corporate credentials.</p>
              </div>
              
              <div className="flex items-center gap-2.5 flex-wrap">
                {hasRoleCard && (
                  <button 
                    onClick={handleExportPDF} 
                    disabled={exportLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    {exportLoading ? <div className="w-4 h-4 rounded-full border-2 border-t-indigo-600 border-r-indigo-600 border-b-transparent border-l-transparent animate-spin" /> : <Download size={15} className="text-indigo-600" />}
                    Export PDF
                  </button>
                )}
                
                {(isSuperAdmin || role === 'HR') && (
                  <button 
                    onClick={() => { setEnrollModal(true); startCamera(); }} 
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    <Camera size={15} /> Enroll Face
                  </button>
                )}
                
                {isSuperAdmin && (
                  hasRoleCard ? (
                    <button 
                      onClick={() => setRegenerateModal(true)} 
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Regenerate
                    </button>
                  ) : (
                    <button 
                      onClick={() => setGenerateModal(true)} 
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <Fingerprint size={15} /> Generate Role Card
                    </button>
                  )
                )}
              </div>
            </div>

            {hasRoleCard ? (
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-2xl flex flex-col items-center text-center max-w-md mx-auto relative overflow-hidden border border-slate-800 group">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                
                <div className="w-full flex items-center justify-between text-xs font-bold text-slate-400 border-b border-white/10 pb-3 mb-4">
                  <span className="flex items-center gap-1.5 text-indigo-400 tracking-wider font-extrabold text-[11px]">
                    <Fingerprint size={16} /> CORPORATE DIGITAL PASS
                  </span>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
                    VERIFIED CARD
                  </span>
                </div>

                <div className="w-44 h-44 bg-white p-3 rounded-2xl flex items-center justify-center my-4 shadow-2xl border-4 border-white/20 group-hover:scale-105 transition-transform duration-300">
                  {employee.roleCardQrCodeUrl ? (
                    <img src={employee.roleCardQrCodeUrl} alt="QR Access" className="w-full h-full object-contain rounded-lg" />
                  ) : (
                    <Fingerprint size={54} className="text-indigo-600 opacity-20" />
                  )}
                </div>
                
                <h4 className="text-2xl font-black tracking-tight text-white mt-2">{employee.name}</h4>
                <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mt-1 mb-4">{employee.role}</p>

                <div className="w-full h-px bg-white/10 my-2"></div>
                
                <div className="flex items-center justify-between w-full text-xs text-slate-400 font-mono pt-2">
                  <span>DEPT: {employee.department}</span>
                  <span className="bg-white/10 px-2.5 py-1 rounded-lg text-slate-300 font-bold">ID: {employee.id}</span>
                </div>
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50/60 rounded-3xl border border-dashed border-slate-300 p-8 space-y-4">
                <div className="w-20 h-20 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-center justify-center shadow-xs">
                  <Fingerprint size={38} className="text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-slate-900">Digital Role Card Not Generated</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Initialize this employee's digital credentials to enable QR code scanning, access verification, and security tracking.
                  </p>
                </div>
                {isSuperAdmin && (
                  <button 
                    onClick={() => setGenerateModal(true)} 
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Generate Role Card Now
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* AUDIT TAB */}
        {activeTab === 'audit' && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Shield size={20} className="text-indigo-600" />
              Security Audit Trail
            </h3>
            
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 overflow-hidden">
              {employee.auditLog.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Account Status: Secure & Compliant</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">No security anomalies or permission breaches logged for this employee profile.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200/60">
                  {employee.auditLog.map(log => (
                    <div key={log.id} className="p-5 flex items-start gap-4 hover:bg-white transition-colors">
                      <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100 shrink-0">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{log.action}</p>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-1">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-700">By {log.actor}</span>
                          <span>•</span>
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Calendar size={20} className="text-indigo-600" />
              Attendance Log History
            </h3>
            
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 overflow-hidden">
              {(!employee.attendances || employee.attendances.length === 0) ? (
                <div className="p-12 text-center text-xs font-semibold text-slate-400">No attendance logs available for this employee yet.</div>
              ) : (
                <div className="divide-y divide-slate-200/60">
                  {employee.attendances.map(log => (
                    <div key={log.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-white transition-colors gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl border shrink-0 ${log.type === 'check_in' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                          {log.type === 'check_in' ? <Clock size={18} /> : <Calendar size={18} />}
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                            {log.type.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 shadow-2xs">
                          {new Date(log.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-extrabold uppercase">
                          Logged
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-2xl font-extrabold text-slate-900">Profile Settings</h3>
                <p className="text-xs text-slate-500 mt-1">Manage contact information, emergency contacts, and banking details.</p>
              </div>
            </div>

            {profileSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm font-semibold flex items-center gap-3 animate-fade-in shadow-xs">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Personal Contact Info */}
              <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/80 space-y-4">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <User size={18} className="text-indigo-600" />
                  Personal & Contact Information
                </h4>

                <div className="flex items-center gap-6 mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100 flex items-center justify-center">
                      {profileForm.avatarUrl ? (
                        <img src={profileForm.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl font-bold text-slate-400">{getInitials(employee.name)}</span>
                      )}
                    </div>
                    <label className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer rounded-full transition-opacity">
                      <Camera size={24} />
                      <span className="text-[10px] font-bold mt-1">Change</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">Profile Picture</h5>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">Upload a professional photo to be displayed across the workspace. JPG, PNG (Max 5MB).</p>
                    {uploadingImage && <span className="text-xs text-indigo-600 font-bold mt-2 inline-block animate-pulse">Uploading...</span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Full Name</label>
                    <input type="text" value={employee.name} disabled className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                    <input type="email" value={employee.email} disabled className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Phone Number</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="e.g. +1 (555) 000-0000"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Department</label>
                    <input type="text" value={employee.department} disabled className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed" />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/80 space-y-4">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <PhoneCall size={18} className="text-rose-500" />
                  Emergency Contact Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Emergency Contact Name</label>
                    <input
                      type="text"
                      value={profileForm.emergency_contact_name}
                      onChange={e => setProfileForm({ ...profileForm, emergency_contact_name: e.target.value })}
                      placeholder="e.g. Spouse / Parent / Relative"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Emergency Contact Phone</label>
                    <input
                      type="text"
                      value={profileForm.emergency_contact_phone}
                      onChange={e => setProfileForm({ ...profileForm, emergency_contact_phone: e.target.value })}
                      placeholder="e.g. +1 (555) 999-8888"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Banking & Payroll */}
              <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/80 space-y-4">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <CreditCard size={18} className="text-emerald-600" />
                  Banking & Payroll Credentials
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Bank Name</label>
                    <input
                      type="text"
                      value={profileForm.bank_name}
                      onChange={e => setProfileForm({ ...profileForm, bank_name: e.target.value })}
                      placeholder="e.g. Chase Bank / HDFC"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Account Number</label>
                    <input
                      type="text"
                      value={profileForm.account_number}
                      onChange={e => setProfileForm({ ...profileForm, account_number: e.target.value })}
                      placeholder="Account Number"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">IFSC / Routing Code</label>
                    <input
                      type="text"
                      value={profileForm.ifsc_code}
                      onChange={e => setProfileForm({ ...profileForm, ifsc_code: e.target.value })}
                      placeholder="IFSC / Swift Code"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Skills & Specialization */}
              <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/80 space-y-4">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <Building2 size={18} className="text-purple-600" />
                  Skills & Specializations
                </h4>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Comma-Separated Skills</label>
                  <input
                    type="text"
                    value={profileForm.skills}
                    onChange={e => setProfileForm({ ...profileForm, skills: e.target.value })}
                    placeholder="e.g. React, Node.js, UI/UX Design, Project Management"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 size={18} />
                  {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* Generation Modals */}
      <Modal isOpen={generateModal} onClose={() => setGenerateModal(false)} title="Generate Role Card">
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600 font-medium leading-relaxed">
            This will provision a public QR profile and activate analytics tracking for <strong className="text-gray-900">{employee.name}</strong>.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setGenerateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleGenerate} disabled={actionLoading} className="shadow-md">
              {actionLoading ? 'Generating...' : 'Confirm Generation'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={regenerateModal} onClose={() => { setRegenerateModal(false); setRegenConfirm(false); }} title="Regenerate Role Card">
        <div className="p-4 space-y-4">
          <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl">
            <h4 className="text-rose-700 font-bold text-sm mb-2 flex items-center gap-2">
              <AlertTriangle size={18} /> Danger Zone
            </h4>
            <p className="text-xs text-rose-600 font-medium leading-relaxed">
              Regenerating this card will invalidate all previous QR codes and public links immediately. 
              Physical access cards tied to the old QR will stop working.
            </p>
          </div>
          
          <label className="flex items-start gap-3 mt-6 cursor-pointer p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <input 
              type="checkbox" 
              checked={regenConfirm}
              onChange={(e) => setRegenConfirm(e.target.checked)}
              className="mt-0.5 shrink-0 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <span className="text-sm font-bold text-gray-700">
              I understand this will regenerate the existing Role Card and invalidate prior versions.
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <Button variant="ghost" onClick={() => { setRegenerateModal(false); setRegenConfirm(false); }}>Cancel</Button>
            <Button variant="primary" onClick={handleRegenerate} disabled={!regenConfirm || actionLoading} className="bg-rose-600 hover:bg-rose-700 shadow-md">
              {actionLoading ? 'Regenerating...' : 'Regenerate Card'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={enrollModal} onClose={() => { setEnrollModal(false); stopCamera(); setEnrollStatus(''); }} title="Enroll Face Data">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Position the employee's face clearly in the camera view to capture their face profile for Check-In authentication.
          </p>
          
          <div className="relative bg-black rounded-2xl overflow-hidden h-72 flex items-center justify-center shadow-inner border border-gray-200">
            {!faceApiLoaded ? (
              <div className="flex flex-col items-center gap-3 text-white/70">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
                <span className="text-sm font-semibold tracking-wide">Loading ML Models...</span>
              </div>
            ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
            
            {/* Camera Frame overlay */}
            <div className="absolute inset-0 pointer-events-none border-[12px] border-black/20 z-10"></div>
          </div>

          {enrollStatus && (
            <div className={`p-4 rounded-xl text-sm text-center font-bold shadow-sm border ${enrollStatus.includes('successfully') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
              {enrollStatus}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setEnrollModal(false); stopCamera(); setEnrollStatus(''); }}>Cancel</Button>
            <Button 
              variant="primary" 
              onClick={handleEnrollFace} 
              disabled={actionLoading || !faceApiLoaded}
              className="flex items-center gap-2 shadow-md"
            >
              <Camera size={18} /> 
              {actionLoading ? 'Processing...' : 'Capture & Enroll'}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal isOpen={reviewModal} onClose={() => setReviewModal(false)} title="Submit Performance Review">
        <div className="space-y-4 pt-4">
          <Input 
            label="Review Period (e.g. Q3 2026)" 
            value={reviewData.review_period} 
            onChange={(e: any) => setReviewData({...reviewData, review_period: e.target.value})} 
          />
          <Input 
            label="Rating (out of 5)" 
            type="number" 
            min="1" max="5" step="0.1" 
            value={reviewData.rating} 
            onChange={(e: any) => setReviewData({...reviewData, rating: parseFloat(e.target.value)})} 
          />
          <Input 
            label="KPI Score (0-100)" 
            type="number" 
            min="0" max="100" 
            value={reviewData.kpi_score} 
            onChange={(e: any) => setReviewData({...reviewData, kpi_score: parseInt(e.target.value)})} 
          />
          <Textarea 
            label="Feedback" 
            rows={4}
            value={reviewData.feedback} 
            onChange={(e: any) => setReviewData({...reviewData, feedback: e.target.value})} 
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setReviewModal(false)}>Cancel</Button>
            <Button onClick={handleSubmitReview} isLoading={reviewSubmitting}>Submit Review</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
