import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getDirectoryUsers } from '../../api/admin.api';
import { enrollFace } from '../../api/attendance.api';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { useFaceApi, FaceDetectionResult } from '../../hooks/useFaceApi';
import { 
  Camera, Users, UserCheck, Search, AlertCircle, 
  Loader, ScanLine, Trash2, ChevronDown, CheckCircle, Zap, ShieldCheck
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  empId: string;
  role: string;
  department?: string;
}

export const EnrollFacePage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Camera & Face API
  const { isLoaded: faceApiLoaded, detectFaceFull, captureFrameAsJpeg } = useFaceApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // States
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Multi-angle capture states
  const [captureStep, setCaptureStep] = useState<'front' | 'left' | 'right'>('front');
  const [descriptors, setDescriptors] = useState<{ front?: number[], left?: number[], right?: number[] }>({});
  const [images, setImages] = useState<{ front?: string, left?: string, right?: string }>({});

  // Auto-capture detection states
  const [currentPose, setCurrentPose] = useState<'front' | 'left' | 'right' | 'none'>('none');
  const [poseMatchHold, setPoseMatchHold] = useState<number>(0);
  const [isAutoScanning, setIsAutoScanning] = useState(true);

  // References for non-state loops
  const isProcessingRef = useRef(false);
  const captureStepRef = useRef<'front' | 'left' | 'right'>('front');
  const descriptorsRef = useRef<{ front?: number[], left?: number[], right?: number[] }>({});
  const imagesRef = useRef<{ front?: string, left?: string, right?: string }>({});

  captureStepRef.current = captureStep;
  descriptorsRef.current = descriptors;
  imagesRef.current = images;

  // Fetch directory users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await getDirectoryUsers();
        setEmployees(users);
      } catch (err: any) {
        setError('Failed to fetch directory users.');
      } finally {
        setPageLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Camera initialization with optimized fast constraints
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      if (!selectedEmp) return;
      try {
        setError(null);
        setSuccess(false);
        setCaptureStep('front');
        setDescriptors({});
        setImages({});
        descriptorsRef.current = {};
        imagesRef.current = {};
        isProcessingRef.current = false;
        
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 640 }, 
              height: { ideal: 480 }, 
              facingMode: 'user'
            } 
          });
        } catch (strictErr) {
          console.warn('[EnrollFace] Strict constraints failed, falling back to basic video:', strictErr);
          activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        setStream(activeStream);
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (err) {
        setError('Camera permission denied or camera is unavailable.');
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      setStream(null);
    };
  }, [selectedEmp]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Execute Background Submission
  const submitEnrollmentInBackground = useCallback(async (
    targetEmp: Employee, 
    finalDescriptors: { front?: number[], left?: number[], right?: number[] }, 
    finalImages: { front?: string, left?: string, right?: string }
  ) => {
    try {
      await enrollFace({ 
        descriptors: finalDescriptors as any,
        images: finalImages as any,
        employeeId: targetEmp.id
      });
    } catch (err: any) {
      console.error('Background enrollment submission error:', err);
      setError(err.response?.data?.error?.message || err.message || 'Face enrollment save failed in background.');
    }
  }, []);

  // Process frame capture logic
  const handleSingleCapture = useCallback(async (detectionRes?: FaceDetectionResult) => {
    if (!videoRef.current || !selectedEmp || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      let descriptor: number[] | null = null;
      let jpegImage: string | null = null;

      if (detectionRes) {
        descriptor = detectionRes.descriptor;
      } else {
        const full = await detectFaceFull(videoRef.current);
        if (full) descriptor = full.descriptor;
      }

      if (!descriptor) {
        setError('No face detected. Please position your face clearly in the camera view.');
        setLoading(false);
        isProcessingRef.current = false;
        return;
      }

      jpegImage = captureFrameAsJpeg(videoRef.current, 0.5, 320);
      if (!jpegImage) {
        setError('Failed to capture frame.');
        setLoading(false);
        isProcessingRef.current = false;
        return;
      }

      const currentStep = captureStepRef.current;
      const updatedDescriptors = { ...descriptorsRef.current, [currentStep]: descriptor };
      const updatedImages = { ...imagesRef.current, [currentStep]: jpegImage };

      setDescriptors(updatedDescriptors);
      setImages(updatedImages);
      descriptorsRef.current = updatedDescriptors;
      imagesRef.current = updatedImages;

      if (currentStep === 'front') {
        setCaptureStep('left');
        setLoading(false);
        isProcessingRef.current = false;
      } else if (currentStep === 'left') {
        setCaptureStep('right');
        setLoading(false);
        isProcessingRef.current = false;
      } else if (currentStep === 'right') {
        // Complete enrollment instantly in UI
        setSuccess(true);
        setLoading(false);
        
        // Asynchronous background API call
        submitEnrollmentInBackground(selectedEmp, updatedDescriptors, updatedImages);

        setTimeout(() => {
          clearSelection();
        }, 2500);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Capture failed.');
      setLoading(false);
      isProcessingRef.current = false;
    }
  }, [selectedEmp, detectFaceFull, captureFrameAsJpeg, submitEnrollmentInBackground]);

  // Real-time automatic face detection and auto-capture loop (< 3s total)
  useEffect(() => {
    if (!stream || !faceApiLoaded || !selectedEmp || success || !isAutoScanning) return;

    let animFrameId: number;
    let lastScanTime = 0;

    const autoScanLoop = async (time: number) => {
      // Throttle scan to every ~100ms for smooth 10fps detection
      if (time - lastScanTime > 100) {
        lastScanTime = time;

        if (videoRef.current && !isProcessingRef.current && !success) {
          const res = await detectFaceFull(videoRef.current);
          if (res) {
            setCurrentPose(res.pose);
            const targetStep = captureStepRef.current;

            // Check if detected pose matches current step
            if (res.pose === targetStep) {
              setPoseMatchHold((prev) => {
                const nextHold = prev + 1;
                // If pose is stable for 2 consecutive frames (~200ms), auto-capture!
                if (nextHold >= 2 && !isProcessingRef.current) {
                  handleSingleCapture(res);
                  return 0;
                }
                return nextHold;
              });
            } else {
              setPoseMatchHold(0);
            }
          } else {
            setCurrentPose('none');
            setPoseMatchHold(0);
          }
        }
      }

      if (!success) {
        animFrameId = requestAnimationFrame(autoScanLoop);
      }
    };

    animFrameId = requestAnimationFrame(autoScanLoop);

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [stream, faceApiLoaded, selectedEmp, success, isAutoScanning, detectFaceFull, handleSingleCapture]);

  const clearSelection = () => {
    setSelectedEmp(null);
    setSearchTerm('');
    setSuccess(false);
    setError(null);
    setCaptureStep('front');
    setDescriptors({});
    setImages({});
    descriptorsRef.current = {};
    imagesRef.current = {};
    isProcessingRef.current = false;
    setPoseMatchHold(0);
    setCurrentPose('none');
  };

  // Filter employees based on search term
  const filteredEmployees = (employees || []).filter(emp => {
    const term = searchTerm.toLowerCase();
    const nameStr = (emp.name || '').toLowerCase();
    const empIdStr = (emp.empId || '').toLowerCase();
    const emailStr = (emp.email || '').toLowerCase();
    const deptStr = (emp.department || '').toLowerCase();

    return (
      nameStr.includes(term) ||
      empIdStr.includes(term) ||
      emailStr.includes(term) ||
      deptStr.includes(term)
    );
  }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        <p className="text-sm text-slate-500 mt-4 font-medium">Loading employee directory...</p>
      </div>
    );
  }

  const progressPercent = descriptors.right ? 100 : descriptors.left ? 66 : descriptors.front ? 33 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="text-indigo-600" size={26} />
          Face Enrollment
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Select an employee and scan their face to register their face profile for attendance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Search & Selection */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Select Employee for Face Enrollment
              </label>

              {!selectedEmp ? (
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Select or Search Employee..."
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                    />
                    <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <ChevronDown 
                      className="absolute right-3.5 top-3.5 text-slate-400 cursor-pointer" 
                      size={16} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDropdownOpen(!isDropdownOpen);
                      }}
                    />
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-50">
                      {filteredEmployees.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-medium">
                          No matching employees found
                        </div>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col transition-colors"
                            onClick={() => {
                              setSelectedEmp(emp);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <span className="font-bold text-slate-900 text-sm">{emp.name}</span>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">{emp.empId}</span>
                              {emp.department && (
                                <>
                                  <span>•</span>
                                  <span>{emp.department}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="capitalize">{emp.role}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 relative space-y-3">
                  <button 
                    onClick={clearSelection}
                    className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Change Employee"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                      {selectedEmp.name.charAt(0)}
                    </div>
                    <div className="space-y-0.5 pr-8">
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">{selectedEmp.name}</h4>
                      <p className="text-xs text-slate-500 font-mono leading-none">{selectedEmp.empId}</p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/60 grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-semibold">
                    <div>
                      <span className="text-slate-400 font-medium block">Department</span>
                      <span className="text-slate-700 mt-0.5 block">{selectedEmp.department || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Designated Role</span>
                      <span className="text-slate-700 mt-0.5 block capitalize">{selectedEmp.role}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 font-medium block">Email Address</span>
                      <span className="text-slate-700 mt-0.5 block truncate font-mono">{selectedEmp.email}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Speed & Auto-detection info badge */}
          <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-blue-50/70">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Zap size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Ultra-Fast Auto Capture</h5>
                  <p className="text-[11px] text-slate-500">Completes face enrollment in &lt; 3s</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-indigo-700">Auto</span>
                <input 
                  type="checkbox" 
                  checked={isAutoScanning}
                  onChange={(e) => setIsAutoScanning(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  title="Toggle Auto Capture"
                />
              </div>
            </CardContent>
          </Card>

          {error && (
            <Card className="border-rose-100 bg-rose-50/50">
              <CardContent className="p-5 flex items-start gap-3">
                <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-semibold text-rose-800 text-sm">Enrollment Error</h4>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel: Live Camera scan */}
        <div className="lg:col-span-7">
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Camera size={18} className="text-slate-500" />
                  Live View Finder
                </span>
                {selectedEmp && stream && faceApiLoaded && (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Camera Active
                  </span>
                )}
              </div>

              {!selectedEmp ? (
                <div className="aspect-video bg-slate-900/5 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-8">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <UserCheck className="text-slate-400" size={22} />
                  </div>
                  <h4 className="font-semibold text-slate-800 text-sm">Select an employee first</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Choose an employee from the left panel to initialize the camera stream and start face mapping.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-300 ease-out" 
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="aspect-video bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-200/60 scale-x-[-1]">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover"
                    />
                    
                    {(!stream || !faceApiLoaded) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 bg-slate-950/95 scale-x-[-1]">
                        {!stream ? (
                          <>
                            <Loader size={28} className="mb-2.5 animate-spin text-indigo-500" />
                            <span className="text-xs font-medium">Starting Camera Viewfinder...</span>
                          </>
                        ) : (
                          <>
                            <Loader size={28} className="mb-2.5 animate-spin text-indigo-500" />
                            <span className="text-xs font-medium">Loading AI Models...</span>
                          </>
                        )}
                      </div>
                    )}

                    {stream && faceApiLoaded && !loading && !success && (
                      <div className="absolute top-4 left-4 scale-x-[-1] flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-xl text-white text-xs font-semibold flex items-center gap-2 border border-white/10 shadow-lg">
                          <ScanLine size={15} className={currentPose === captureStep ? "text-emerald-400 animate-pulse" : "text-indigo-400"} />
                          {captureStep === 'front' && 'Step 1: Look Straight'}
                          {captureStep === 'left' && 'Step 2: Turn Head Slightly Left'}
                          {captureStep === 'right' && 'Step 3: Turn Head Slightly Right'}
                        </div>
                        {poseMatchHold > 0 && (
                          <span className="px-2 py-1 bg-emerald-500 text-white text-[11px] font-bold rounded-lg animate-bounce shadow">
                            Capturing...
                          </span>
                        )}
                      </div>
                    )}
                    
                    {success && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 bg-emerald-600/90 backdrop-blur-md scale-x-[-1] animate-fade-in z-10">
                        <ShieldCheck size={52} className="mb-2 animate-bounce text-white" />
                        <span className="text-xl font-bold">Face Enrolled!</span>
                        <span className="text-xs font-medium mt-1 opacity-90">Fast registration complete. Profile saved.</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex gap-2 items-center">
                      <div className={`w-3 h-3 rounded-full transition-all ${captureStep === 'front' ? 'bg-indigo-600 ring-4 ring-indigo-100 animate-pulse' : descriptors.front ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      <div className={`w-3 h-3 rounded-full transition-all ${captureStep === 'left' ? 'bg-indigo-600 ring-4 ring-indigo-100 animate-pulse' : descriptors.left ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      <div className={`w-3 h-3 rounded-full transition-all ${captureStep === 'right' ? 'bg-indigo-600 ring-4 ring-indigo-100 animate-pulse' : descriptors.right ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    </div>
                    
                    <Button 
                      variant="accent" 
                      onClick={() => handleSingleCapture()}
                      disabled={loading || !stream || !faceApiLoaded || success}
                      className="w-full md:w-auto px-6 py-2.5"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2 justify-center">
                          <Loader size={16} className="animate-spin" />
                          Processing...
                        </span>
                      ) : success ? (
                        <span className="flex items-center gap-2 justify-center">
                          <CheckCircle size={16} />
                          Enrolled
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 justify-center">
                          <Camera size={16} />
                          {captureStep === 'front' && 'Capture Front (Manual)'}
                          {captureStep === 'left' && 'Capture Left (Manual)'}
                          {captureStep === 'right' && 'Capture Right & Finish'}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
