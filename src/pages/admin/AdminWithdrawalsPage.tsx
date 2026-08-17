import { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { supabase, formatMoney, type Withdrawal, type Profile } from '@/lib/supabase';

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<(Withdrawal & { user?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<(Withdrawal & { user?: Profile }) | null>(null);
  const [note, setNote] = useState('');
  const [actioning, setActioning] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(100);
    if (!data) { setLoading(false); return; }
    const wds = data as Withdrawal[];
    const enriched = await Promise.all(wds.map(async (w) => {
      const { data: u } = await supabase.from('profiles').select('*').eq('id', w.user_id).maybeSingle();
      return { ...w, user: u as Profile };
    }));
    setWithdrawals(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const process = async (status: string) => {
    if (!selected) return;
    setActioning(true);
    await supabase.rpc('process_withdrawal', { p_withdrawal_id: selected.id, p_new_status: status, p_admin_note: note || null });
    setActioning(false);
    setSelected(null);
    setNote('');
    load();
  };

  const statusInfo: Record<string, { text: string; color: string }> = {
    pending: { text: 'قيد المراجعة', color: 'bg-warning-100 text-warning-600' },
    processing: { text: 'قيد المعالجة', color: 'bg-beach-100 text-beach-600' },
    paid: { text: 'مدفوع', color: 'bg-success-100 text-success-600' },
    rejected: { text: 'مرفوض', color: 'bg-error-100 text-error-600' },
    cancelled: { text: 'ملغى', color: 'bg-gray-100 text-gray-400' },
  };

  if (loading) return <div className="text-gray-400 mt-8 text-center">جارٍ التحميل...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-beach-800 mb-6">السحوبات</h1>
      {withdrawals.length === 0 ? (
        <p className="text-gray-400 text-center mt-8">لا توجد سحوبات</p>
      ) : (
        <div className="space-y-2">
          {withdrawals.map((w) => {
            const si = statusInfo[w.status] || statusInfo.pending;
            return (
              <button
                key={w.id}
                onClick={() => { setSelected(w); setNote(w.admin_note || ''); }}
                className="w-full bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:border-beach-200 transition-colors text-right"
              >
                <div>
                  <p className="font-bold text-gray-800">${formatMoney(w.amount_cents)}</p>
                  <p className="text-xs text-gray-400">{w.user?.username || '?'} — {new Date(w.created_at).toLocaleDateString('ar')}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${si.color}`}>{si.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-800 mb-4">طلب سحب</h3>
            <div className="space-y-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">المستخدم</p>
                <p className="font-bold text-gray-800">{selected.user?.username}</p>
                <p className="text-xs text-gray-400">{selected.user?.email}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">المبلغ</p>
                <p className="font-bold text-2xl text-gray-800">${formatMoney(selected.amount_cents)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">الطريقة</p>
                <p className="text-gray-700">{selected.method}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">رصيد المستخدم المتاح</p>
                <p className="text-gray-700">${formatMoney(selected.user?.balance_cents || 0)}</p>
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} className="input-field" placeholder="ملاحظة إدارية..." rows={2} />
            </div>
            {selected.status === 'pending' || selected.status === 'processing' ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => process('processing')} disabled={actioning} className="btn-secondary text-sm flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> معالجة
                </button>
                <button onClick={() => process('paid')} disabled={actioning} className="bg-success-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-success-600">
                  <Check className="w-4 h-4" /> دفع
                </button>
                <button onClick={() => process('rejected')} disabled={actioning} className="bg-error-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-error-600">
                  <X className="w-4 h-4" /> رفض
                </button>
                <button onClick={() => process('cancelled')} disabled={actioning} className="btn-secondary text-sm flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" /> إلغاء
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm">تمت معالجة هذا الطلب.</p>
            )}
            <button onClick={() => setSelected(null)} className="w-full mt-3 text-sm text-gray-400">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}
