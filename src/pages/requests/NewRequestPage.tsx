import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { type RequestType, createLeaveRequest, createWfhRequest, getMyRequests } from '../../api/requests.api';
import { toast } from '../../utils/toast';

export const NewRequestPage: React.FC = () => {
  const [type, setType] = useState<RequestType>('Leave');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [casualLeavesUsed, setCasualLeavesUsed] = useState(0);
  
  const casualLeavesTotal = 4;

  useEffect(() => {
    getMyRequests().then(requests => {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      let used = 0;
      requests.forEach((r: any) => {
        if (r.type === 'LEAVE' && (r.status === 'Active' || r.status === 'Pending')) {
          const start = new Date(r.startDate);
          if (start.getMonth() === currentMonth && start.getFullYear() === currentYear) {
            if (r.endDate) {
              const end = new Date(r.endDate);
              const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              used += days;
            } else {
              used += 1;
            }
          }
        }
      });
      setCasualLeavesUsed(used);
    });
  }, []);

  const [isMultiDayLeave, setIsMultiDayLeave] = useState(false);
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    deliverables: '',
    isHalfDay: false,
    reason: ''
  });

  const calculateLeaveDays = () => {
    if (!formData.startDate) return 0;
    if (formData.isHalfDay) return 0.5;
    if (!isMultiDayLeave || !formData.endDate) return 1;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end < start) return 0;
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const leaveDaysRequested = calculateLeaveDays();
  const remainingCasualLeaves = Math.max(0, casualLeavesTotal - casualLeavesUsed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      if (type === 'Leave') {
        const startIso = new Date(formData.startDate).toISOString();
        const endIso = isMultiDayLeave && formData.endDate 
          ? new Date(formData.endDate).toISOString() 
          : startIso;

        await createLeaveRequest({ 
          startDate: startIso, 
          endDate: endIso,
          isHalfDay: formData.isHalfDay,
          reason: formData.reason
        });
      } else {
        const startIso = new Date(formData.startDate).toISOString();
        const endIso = new Date(formData.endDate).toISOString();
        await createWfhRequest({ 
          startDate: startIso, 
          endDate: endIso, 
          deliverables: formData.deliverables,
          isHalfDay: formData.isHalfDay,
          reason: formData.reason
        });
      }
      setSuccess(true);
      toast.success(`${type} request submitted successfully!`);
      setFormData({ startDate: '', endDate: '', deliverables: '', isHalfDay: false, reason: '' });
      setTimeout(() => setSuccess(false), 4000);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || error.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">New Request</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Submit your official Leave or Work From Home applications</p>
        </div>
        <a 
          href="/requests/my" 
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          View My Requests &rarr;
        </a>
      </div>
      
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-6 md:p-8">
        <div className="flex bg-slate-100/80 p-1 rounded-2xl mb-6 w-full max-w-sm">
          <button 
            type="button"
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${type === 'Leave' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setType('Leave')}
          >
            Leave Application
          </button>
          <button 
            type="button"
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${type === 'WFH' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setType('WFH')}
          >
            Work From Home
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {type === 'Leave' ? (
            <>
              <div className="bg-gradient-to-r from-indigo-50/70 to-slate-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">Casual Leave Balance</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Capped at 4 casual days per calendar month</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-600">{remainingCasualLeaves}</span>
                  <span className="text-xs text-slate-500 font-medium"> / {casualLeavesTotal} days left</span>
                </div>
              </div>

              {/* Single Day vs Multi-Day toggle */}
              <div className="flex items-center gap-4 pt-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Duration:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsMultiDayLeave(false); setFormData({ ...formData, endDate: '' }); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!isMultiDayLeave ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsMultiDayLeave(true); setFormData({ ...formData, isHalfDay: false }); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isMultiDayLeave ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Multiple Days
                  </button>
                </div>
              </div>
              
              {!isMultiDayLeave ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Leave Date *</label>
                  <Input 
                    type="date" 
                    required 
                    value={formData.startDate} 
                    onChange={e => setFormData({ ...formData, startDate: e.target.value, endDate: e.target.value })} 
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Start Date *</label>
                    <Input 
                      type="date" 
                      required 
                      value={formData.startDate} 
                      onChange={e => setFormData({ ...formData, startDate: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">End Date *</label>
                    <Input 
                      type="date" 
                      required 
                      min={formData.startDate}
                      value={formData.endDate} 
                      onChange={e => setFormData({ ...formData, endDate: e.target.value })} 
                    />
                  </div>
                </div>
              )}

              {!isMultiDayLeave && (
                <div className="flex items-center gap-2 pt-1">
                  <input 
                    type="checkbox" 
                    id="halfDayLeave"
                    checked={formData.isHalfDay}
                    onChange={e => setFormData({ ...formData, isHalfDay: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="halfDayLeave" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Half Day Leave (0.5 day)
                  </label>
                </div>
              )}

              {leaveDaysRequested > 0 && (
                <div className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl">
                  Requested duration: <span className="font-bold text-indigo-600">{leaveDaysRequested} day{leaveDaysRequested !== 1 ? 's' : ''}</span>
                  {leaveDaysRequested > remainingCasualLeaves && (
                    <span className="block text-rose-500 font-semibold mt-0.5">
                      Notice: This request exceeds your remaining casual leave balance ({remainingCasualLeaves} days).
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Reason (Optional)</label>
                <textarea 
                  className="w-full text-xs font-medium rounded-2xl border border-slate-200 p-3.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 min-h-[90px]"
                  placeholder="State the reason or context for your leave..."
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Start Date *</label>
                  <Input 
                    type="date" 
                    required 
                    value={formData.startDate} 
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">End Date *</label>
                  <Input 
                    type="date" 
                    required 
                    min={formData.startDate}
                    value={formData.endDate} 
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Planned Deliverables *</label>
                <textarea 
                  required
                  className="w-full text-xs font-medium rounded-2xl border border-slate-200 p-3.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 min-h-[90px]"
                  placeholder="List specific milestones, commits, or tickets you will accomplish while working remotely..."
                  value={formData.deliverables}
                  onChange={e => setFormData({ ...formData, deliverables: e.target.value })}
                />
              </div>
              
              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="halfDayWfh"
                  checked={formData.isHalfDay}
                  onChange={e => setFormData({ ...formData, isHalfDay: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="halfDayWfh" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Half Day Work From Home
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Reason (Optional)</label>
                <textarea 
                  className="w-full text-xs font-medium rounded-2xl border border-slate-200 p-3.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 min-h-[80px]"
                  placeholder="Reason for remote work (e.g. personal errand, travel, quiet coding sprint)..."
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>
            </>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between">
              <span>Request submitted successfully and forwarded to your manager!</span>
              <a href="/requests/my" className="underline font-bold text-emerald-900">Track Status</a>
            </div>
          )}

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <Button type="submit" variant="primary" isLoading={loading}>
              Submit {type} Application
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
