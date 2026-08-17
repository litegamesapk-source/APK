import { useState, useEffect, useCallback } from 'react';
import { Check, X, Ban } from 'lucide-react';
import { supabase, formatMoney, type Referral, type Profile } from '@/lib/supabase';

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<(Referral & { referrer?: Profile; referred?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('referrals').select('*').order('created_at', { ascending: false }).limit(100);
    if (!data) { setLoading(false); return; }
    const refs = data as Referral[];
    const userPromises = refs.map(async (r) => {
      const [ref, rec] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', r.referrer_id).maybeSingle(),
        supabase.from('profiles').select('*').eq('id', r.referred_user_id).maybeSingle(),
      ]);
      return { ...r, referrer: ref.data as Profile, referred: rec.data as Profile };
    });
    const enriched = await Promise.all(userPromises);
    setReferrals(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async (id: string, action: string) => {
    setActioning(id);
    await supabase.rpc('admin_process_referral', { p_referral_id: id, p_action: action });
    setActioning(null);
    load();
  };

  const statusInfo: Record<string, { text: string; color: string }> = {
    pending: { text: 'قيد التأهيل', color: 'bg-warning-100 text-warning-600' },
    approved: { text: 'مؤهل', color: 'bg-success-100 text-success-600' },
    rejected: { text: 'مرفوض', color: 'bg-error-100 text-error-600' },
    cancelled: { text: 'ملغى', color: 'bg-gray-100 text-gray-400' },
  };

  if (loading) return <div className="text-gray-400 mt-8 text-center">جارٍ التحميل...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-beach-800 mb-6">الإحالات</h1>
      {referrals.length === 0 ? (
        <p className="text-gray-400 text-center mt-8">لا توجد إحالات</p>
      ) : (
        <div className="space-y-2">
          {referrals.map((r) => {
            const si = statusInfo[r.status] || statusInfo.pending;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-800">
                      {r.referrer?.username || '?'} ← {r.referred?.username || '?'}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('ar')}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${si.color}`}>{si.text}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-success-600 font-bold">${formatMoney(r.reward_cents)}</p>
                  {r.status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => doAction(r.id, 'approve')} disabled={actioning === r.id} className="p-2 bg-success-100 text-success-600 rounded-lg hover:bg-success-200">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => doAction(r.id, 'reject')} disabled={actioning === r.id} className="p-2 bg-error-100 text-error-600 rounded-lg hover:bg-error-200">
                        <X className="w-4 h-4" />
                      </button>
                      <button onClick={() => doAction(r.id, 'cancel')} disabled={actioning === r.id} className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200">
                        <Ban className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
