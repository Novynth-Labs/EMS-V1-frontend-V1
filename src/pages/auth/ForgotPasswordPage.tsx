import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { requestPasswordReset } from '../../api/auth.api';
import { KeyRound, ArrowLeft, Mail, CheckCircle2, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [isTimerActive, setIsTimerActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, resendTimer]);

  const validateEmail = (val: string) => {
    if (!val) {
      setEmailError('Email address is required.');
      return false;
    }
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!pattern.test(val)) {
      setEmailError('Please enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) return;

    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
      setResendTimer(30);
      setIsTimerActive(true);
    } catch (err: any) {
      console.error('Forgot password error:', err);
      const msg = typeof err.response?.data?.error === 'string'
        ? err.response?.data?.error
        : (err.response?.data?.error?.message || err.response?.data?.message);
      setError(msg || 'Unable to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (isTimerActive) return;
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setResendTimer(30);
      setIsTimerActive(true);
    } catch (err: any) {
      setError('Failed to resend reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="animate-fade-in">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to login
        </button>

        {submitted ? (
          <div className="space-y-6 text-center animate-scale-in">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200 text-white flex items-center justify-center">
              <CheckCircle2 size={28} />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold text-slate-900">Reset Link Sent!</h1>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                We've sent password reset instructions to <span className="font-semibold text-slate-800">{email}</span>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2">
              <div className="flex items-start gap-3">
                <Mail size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 text-slate-600">
                  <p className="font-semibold text-slate-800">What to do next?</p>
                  <p>Check your inbox and click the reset link. Check spam folder if not found.</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                size="lg"
                icon={<ArrowRight size={18} />}
                onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}
              >
                Proceed to Reset Password
              </Button>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isTimerActive || loading}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    isTimerActive
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-indigo-600 hover:text-indigo-700'
                  }`}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  {isTimerActive ? `Resend email in ${resendTimer}s` : 'Resend reset link'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200 mb-5">
                <KeyRound className="text-white" size={24} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Forgot password?</h1>
              <p className="text-slate-500 mt-1.5 text-sm">
                Enter your registered work email to receive recovery instructions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-2.5">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) validateEmail(e.target.value);
                  }}
                  onBlur={() => validateEmail(email)}
                  error={emailError}
                  placeholder="name@company.com"
                  autoComplete="email"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                isLoading={loading}
              >
                Send Reset Link
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
};
