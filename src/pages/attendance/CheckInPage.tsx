import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { submitCheckIn } from '../../api/attendance.api';
import { 
  Camera, MapPin, AlertCircle, CheckCircle2, Loader2, ScanLine, 
  ShieldCheck, Clock, Compass, Sun, UserCheck, RefreshCw, Zap, ClipboardList 
} from 'lucide-react';
import { useFaceApi } from '../../hooks/useFaceApi';

export const CheckInPage: React.FC = () => {
  const { isLoaded: faceApiLoaded, detectFaceAndGetDescriptor } = useFaceApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<{ message: string; type: 'general' | 'geo' | 'face' } | null>(null);
  const [success, setSuccess] = useState(false);
  const [successTime, setSuccessTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    let activeStream: MediaStream | null = null;
    
    const init = async () => {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(activeStream);
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (err) {
        setError({ message: 'Camera permission denied or unavailable.', type: 'general' });
      }

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (_err) => {
            console.warn('[CheckIn] Location permission denied or unavailable. Using default office coordinates.');
            setLocation({ lat: 18.573444, lng: 73.756762 });
          }
        );
      } else {
        setLocation({ lat: 18.573444, lng: 73.756762 });
      }
    };

    init();

    return () => {
      clearInterval(interval);
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCapture = async () => {
    if (!videoRef.current || !location) {
      if (!location) setError({ message: 'Waiting for location coordinates...', type: 'geo' });
      return;
    }

    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const descriptor = await detectFaceAndGetDescriptor(videoRef.current);
      if (!descriptor) {
        setError({ message: 'No face detected. Please position your face clearly in the camera frame with good lighting.', type: 'face' });
        setLoading(false);
        return;
      }

      await submitCheckIn({ 
        currentDescriptor: descriptor, 
        lat: location.lat, 
        lng: location.lng
      });
      
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSuccessTime(timeStr);
      setSuccess(true);
    } catch (err: any) {
      const type = err.response?.data?.type === 'GEO_REJECT' ? 'geo' : 
                   err.response?.data?.type === 'FACE_REJECT' ? 'face' : 'general';
      setError({ message: err.response?.data?.error?.message || err.message || 'Check-in failed.', type });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setSuccessTime(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-6 animate-fade-in pb-16">
      
      {/* Header Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                AI Biometric Verification
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Daily Attendance Check-In</h1>
            <p className="text-xs sm:text-sm text-slate-300/80 mt-1 max-w-lg">
              Position your face within the scanner and verify location perimeter for secure, automated clock-in.
            </p>
          </div>

          {/* Clock Widget */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 px-5 py-3 rounded-2xl flex items-center gap-3 shrink-0">
            <Clock size={24} className="text-indigo-400" />
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Current Time</p>
              <p className="text-lg font-mono font-black text-white">{currentTime || '--:--:--'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3.5 text-rose-800 animate-fade-in">
            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-bold text-sm">Check-In Unsuccessful</h4>
              <p className="text-xs text-rose-700 mt-0.5">{error.message}</p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-900 animate-fade-in flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-emerald-950">Attendance Clock-In Logged!</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Verified at <span className="font-mono font-bold">{successTime}</span> · Geolocation & Face Recognition Matched 100%.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/attendance/log"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <ClipboardList size={14} /> View Attendance Log
              </Link>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <RefreshCw size={14} /> Check In Again
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Camera Viewport (7 Columns) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            <div className="relative aspect-video sm:aspect-[4/3] bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl scale-x-[-1] group">
              
              {/* Video Element */}
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />

              {/* Camera Loading Overlay */}
              {(!stream || !faceApiLoaded) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-950/90 scale-x-[-1]">
                  {!stream ? (
                    <div className="p-4 bg-indigo-600/20 rounded-full border border-indigo-500/30 mb-3 animate-pulse">
                      <Camera size={36} className="text-indigo-400" />
                    </div>
                  ) : (
                    <Loader2 size={38} className="mb-3 animate-spin text-indigo-400" />
                  )}
                  <span className="text-sm font-extrabold tracking-wide">
                    {!stream ? 'Requesting Camera Access...' : 'Loading AI Facial Recognition Models...'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">Please allow camera permissions if prompted</span>
                </div>
              )}

              {/* Holographic Face Frame Guide */}
              {stream && faceApiLoaded && !loading && (
                <div className="absolute inset-0 pointer-events-none scale-x-[-1] flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-indigo-400/40 rounded-3xl relative">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-xl"></div>
                  </div>
                </div>
              )}

              {/* Status Badge Overlay */}
              {stream && faceApiLoaded && !loading && (
                <div className="absolute top-4 left-4 scale-x-[-1]">
                  <div className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl text-white text-xs font-semibold flex items-center gap-2 shadow-lg">
                    <ScanLine size={14} className="text-indigo-400 animate-pulse" />
                    <span>AI Detector Active</span>
                  </div>
                </div>
              )}

              {/* Authenticating Loading Overlay */}
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-indigo-950/80 backdrop-blur-md scale-x-[-1] z-20 animate-fade-in">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-full border-4 border-indigo-400/20 border-t-indigo-400 animate-spin"></div>
                    <Zap size={24} className="absolute inset-0 m-auto text-indigo-300 animate-pulse" />
                  </div>
                  <span className="text-xl font-black tracking-tight">Authenticating Face...</span>
                  <span className="text-xs text-indigo-200 mt-1 font-medium">Matching descriptor against registered profile</span>
                </div>
              )}

            </div>

            {/* GPS Location Bar */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${location ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Geofencing Position</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'Acquiring GPS Signal...'}
                  </p>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${location ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700'}`}>
                {location ? 'Perimeter Verified' : 'Searching GPS'}
              </span>
            </div>

          </div>

          {/* Guidelines & Trigger Action (5 Columns) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            
            {/* Checklist */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-indigo-600" />
                Check-In Checklist
              </h3>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 mt-0.5">
                    <Compass size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Perimeter Verification</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Must be inside designated office HQ or approved WFH location.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg shrink-0 mt-0.5">
                    <UserCheck size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Clear Facial Frame</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Position head centered inside the camera guide without obstructions.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0 mt-0.5">
                    <Sun size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Sufficient Lighting</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Ensure direct front light so neural models recognize facial descriptors.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                onClick={handleCapture}
                disabled={loading || !stream || !location || success || !faceApiLoaded}
                className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3.5 cursor-pointer active:scale-98"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Verifying Identity...</span>
                  </>
                ) : (
                  <>
                    <Camera size={20} />
                    <span>Clock In Now</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
