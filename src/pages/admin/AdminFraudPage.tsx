import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type FraudEvent = {
  id: string;
  user_id: string | null;
  type: string;
  severity: string;
  description: string | null;
  created_at: string;
};

export default function AdminFraudPage() {
  const [events, setEvents] = useState<FraudEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('fraud_events').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setEvents(data as FraudEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const severityColors: Record<string, string> = {
    low: 'bg-beach-100 text-beach-600',
    medium: 'bg-warning-100 text-warning-600',
    high: 'bg-error-100 text-error-600',
    critical: 'bg-error-500 text-white',
  };

  if (loading) return <div className="text-gray-400 mt-8 text-center">جارٍ التحميل...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-beach-800 mb-6">الاحتيال</h1>
      {events.length === 0 ? (
        <div className="text-center py-8">
          <ShieldAlert className="w-12 h-12 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400">لا توجد أحداث احتيال</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-gray-800">{e.type}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColors[e.severity] || severityColors.low}`}>
                  {e.severity}
                </span>
              </div>
              {e.description && <p className="text-xs text-gray-500">{e.description}</p>}
              <p className="text-xs text-gray-300 mt-1">{new Date(e.created_at).toLocaleDateString('ar')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
