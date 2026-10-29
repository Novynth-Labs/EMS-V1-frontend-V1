import React, { useEffect, useState } from 'react';
import { getPendingOnboardings } from '../../api/hr.api';
import { OnboardingCard, type EmployeeOnboardingData } from '../../components/hr/OnboardingCard';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const OnboardingDashboardPage: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeOnboardingData[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshReminders } = useOnboarding();

  useEffect(() => {
    let mounted = true;
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const res = await getPendingOnboardings();
        if (mounted && res.success) {
          const normalized = (res.data || []).map((emp: EmployeeOnboardingData) => ({
            ...emp,
            status: (emp.status?.toLowerCase() === 'active' ? 'Active' : 'Pending') as 'Active' | 'Pending',
          }));
          setEmployees(normalized);
          refreshReminders();
        }
      } catch (error) {
        console.error('Failed to load pending onboardings', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchEmployees();
    return () => { mounted = false; };
  }, [refreshReminders]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Onboarding Dashboard</h2>
        <span className="text-sm bg-[var(--color-canvas)] px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]">
          {employees.filter(e => e.status === 'Pending').length} Pending
        </span>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map(emp => (
            <OnboardingCard key={emp.id} employee={emp} />
          ))}
          {employees.length === 0 && (
            <div className="col-span-full text-center py-12 text-[var(--color-text-secondary)]">
              No pending onboardings found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
