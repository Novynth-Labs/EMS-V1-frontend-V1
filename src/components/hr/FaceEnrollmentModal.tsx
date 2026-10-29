import React, { useRef, useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { enrollFace } from '../../api/attendance.api';
import { Camera, AlertCircle, Loader, ScanLine, X, CheckCircle } from 'lucide-react';
import { useFaceApi } from '../../hooks/useFaceApi';

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onSuccess: () => void;
}

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({ isOpen, onClose, employeeId, onSuccess }) => {
  const { isLoaded: faceApiLoaded, detectFaceAndGetDescriptor, captureFrameAsJpeg } = useFaceApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    
    const init = async () => {
      if (!isOpen) return;
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(activeStream);
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (err) {
        setError('Camera permission denied or unavailable.');
      }
    };

    init();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCapture = async () => {
    if (!videoRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const descriptor = await detectFaceAndGetDescriptor(videoRef.current);
      if (!descriptor) {
        setError('No face detected. Please ensure the employee is looking directly at the camera with good lighting.');
        setLoading(false);
        return;
      }

      const capturedImage = captureFrameAsJpeg(videoRef.current, 0.5, 320) || undefined;

      await enrollFace({ 
        descriptors: { front: descriptor },
        images: capturedImage ? { front: capturedImage } : undefined,
        employeeId: employeeId
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Enrollment failed.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Face Enrollment</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="aspect-video bg-black rounded-xl overflow-hidden relative border border-slate-200 scale-x-[-1]">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
            {(!stream || !faceApiLoaded) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 bg-black/80 scale-x-[-1]">
                {!stream ? <Camera size={32} className="mb-2" /> : <Loader size={32} className="mb-2 animate-spin" />}
                <span className="text-sm font-medium">{!stream ? 'Starting Camera...' : 'Loading ML Models...'}</span>
              </div>
            )}
            {stream && faceApiLoaded && !loading && !success && (
              <div className="absolute top-3 left-3 scale-x-[-1]">
                <div className="px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-white text-xs font-medium flex items-center gap-1.5">
                  <ScanLine size={14} />
                  Face Detection Active
                </div>
              </div>
            )}
            {success && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 bg-emerald-500/90 backdrop-blur-sm scale-x-[-1] animate-fade-in">
                <CheckCircle size={48} className="mb-3 animate-bounce" />
                <span className="text-xl font-bold">Done!</span>
                <span className="text-sm font-medium mt-1">Face enrolled successfully</span>
              </div>
            )}
          </div>
          
          <div className="text-sm text-slate-500 text-center scale-x-100">
            Position the employee's face clearly in the frame.
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="accent" 
            onClick={handleCapture}
            disabled={loading || !stream || !faceApiLoaded || success}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader size={16} className="animate-spin" />
                Processing...
              </span>
            ) : success ? (
              <span className="flex items-center gap-2">
                <CheckCircle size={16} />
                Success
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Camera size={16} />
                Capture & Enroll
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
