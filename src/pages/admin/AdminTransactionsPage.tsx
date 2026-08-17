import { useState, useEffect, useCallback } from 'react';
import { supabase, formatMoney, type Transaction, type Profile } from '@/lib/supabase';

export default function AdminTransactionsPage() {
  const [txs, setTxs] = useState<(Transaction & { user?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const perPage = 50;

  const load = useCallback(async () => {
    const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).range(page * perPage, (page + 1) * perPage - 1);
    if (!data) { setLoading(false); return; }
    const enriched = await Promise.all((data as Transaction[]).map(async (t) => {
      const { data: u } = await supabase.from('profiles').select('*').eq('id', t.user_id).maybeSingle();
      return { ...t, user: u as Profile };
    }));
    setTxs(enriched);
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const txLabels: Record<string, string> = {
    game_reward: 'مكافأة لعبة',
    task_reward: 'مكافأة مهمة',
    referral_reward: 'مكافأة إحالة',
    daily_reward: 'مكافأة يومية',
    bonus: 'مكافأة',
    withdrawal: 'سحب',
    withdrawal_refund: 'استرداد سحب',
  };

  if (loading) return <div className="text-gray-400 mt-8 text-center">جارٍ التحميل...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-beach-800 mb-6">المعاملات</h1>
      {txs.length === 0 ? (
        <p className="text-gray-400 text-center mt-8">لا توجد معاملات</p>
      ) : (
        <>
          <div className="space-y-2">
            {txs.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{txLabels[t.type] || t.type}</p>
                  <p className="text-xs text-gray-400">{t.user?.username || '?'} — {new Date(t.created_at).toLocaleDateString('ar')}</p>
                </div>
                <p className={`font-bold text-sm ${t.amount_cents >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                  {t.amount_cents >= 0 ? '+' : ''}${formatMoney(Math.abs(t.amount_cents))}
                </p>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-secondary text-sm px-4">السابق</button>
            <button onClick={() => setPage(page + 1)} disabled={txs.length < perPage} className="btn-secondary text-sm px-4">التالي</button>
          </div>
        </>
      )}
    </div>
  );
}
