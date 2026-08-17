import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, ArrowDownToLine, Clock, Check, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, formatMoney, type Withdrawal, type Settings } from '@/lib/supabase';

export default function WithdrawPage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [s, w] = await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('withdrawals').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (s.data) setSettings(s.data as Settings);
    if (w.data) setWithdrawals(w.data as Withdrawal[]);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!profile || !settings) return <div className="page-container"><p className="text-center text-beach-400 mt-20">جارٍ التحميل...</p></div>;

  const minWithdrawal = settings.min_withdrawal_cents;
  const canWithdraw = profile.balance_cents >= minWithdrawal;
  const hasPending = withdrawals.some(w => w.status === 'pending' || w.status === 'processing');

  const handleWithdraw = async () => {
    setError('');
    setSuccess('');
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!amountCents || amountCents <= 0) {
      setError('أدخل مبلغًا صحيحًا');
      return;
    }
    if (amountCents < minWithdrawal) {
      setError(`الحد الأدنى للسحب هو $${formatMoney(minWithdrawal)}`);
      return;
    }
    if (amountCents > profile.balance_cents) {
      setError('رصيدك غير كافٍ');
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc('create_withdrawal', {
      p_amount_cents: amountCents,
      p_method: 'manual',
      p_method_details: null,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess('تم إنشاء طلب السحب! سيتم مراجعته من قبل الإدارة.');
    setAmount('');
    refreshProfile();
    loadData();
  };

  const statusInfo: Record<string, { text: string; color: string; icon: typeof Clock }> = {
    pending: { text: 'قيد المراجعة', color: 'text-warning-600 bg-warning-100', icon: Clock },
    processing: { text: 'قيد المعالجة', color: 'text-beach-600 bg-beach-100', icon: Clock },
    paid: { text: 'مدفوع', color: 'text-success-600 bg-success-100', icon: Check },
    rejected: { text: 'مرفوض', color: 'text-error-600 bg-error-100', icon: X },
    cancelled: { text: 'ملغى', color: 'text-beach-400 bg-beach-50', icon: X },
  };

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-beach-800 mb-4">السحب</h1>

      {/* Balance */}
      <div className="card bg-gradient-to-l from-beach-500 to-beach-600 border-none mb-4">
        <p className="text-beach-100 text-sm">رصيدك المتاح</p>
        <p className="text-white text-3xl font-bold">${formatMoney(profile.balance_cents)}</p>
      </div>

      {/* Withdraw form */}
      <div className="card mb-4">
        <h3 className="section-title">طلب سحب جديد</h3>

        {!canWithdraw ? (
          <div className="bg-warning-50 border border-warning-100 rounded-xl p-3 mb-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <p className="text-warning-700 text-sm">
              تحتاج إلى $${formatMoney(minWithdrawal - profile.balance_cents)} إضافية للوصول للحد الأدنى للسحب ($${formatMoney(minWithdrawal)}).
            </p>
          </div>
        ) : hasPending ? (
          <div className="bg-warning-50 border border-warning-100 rounded-xl p-3 mb-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <p className="text-warning-700 text-sm">لديك طلب سحب قيد المعالجة بالفعل.</p>
          </div>
        ) : (
          <>
            <label className="block text-sm font-bold text-beach-700 mb-2">المبلغ (دولار)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field mb-3"
              placeholder={`الحد الأدنى: $${formatMoney(minWithdrawal)}`}
              min={minWithdrawal / 100}
              step="0.01"
            />
            <button onClick={handleWithdraw} disabled={loading} className="btn-primary w-full">
              {loading ? 'جارٍ الإرسال...' : 'طلب سحب'}
            </button>
          </>
        )}

        {error && <p className="text-error-600 text-sm mt-2">{error}</p>}
        {success && <p className="text-success-600 text-sm mt-2">{success}</p>}
      </div>

      {/* Withdrawal history */}
      <div className="card">
        <h3 className="section-title">سجل السحب</h3>
        {withdrawals.length === 0 ? (
          <p className="text-beach-400 text-sm text-center py-4">لا توجد طلبات سحب</p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((w) => {
              const si = statusInfo[w.status] || statusInfo.pending;
              const SIcon = si.icon;
              return (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-beach-50 last:border-0">
                  <div>
                    <p className="font-bold text-beach-800 text-sm">${formatMoney(w.amount_cents)}</p>
                    <p className="text-xs text-beach-400">{new Date(w.created_at).toLocaleDateString('ar')}</p>
                    {w.admin_note && <p className="text-xs text-beach-500 mt-1">ملاحظة: {w.admin_note}</p>}
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 ${si.color}`}>
                    <SIcon className="w-3 h-3" /> {si.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
