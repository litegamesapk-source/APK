import { useState, useEffect, useCallback } from 'react';
import { Wallet, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, formatMoney, type Transaction } from '@/lib/supabase';

export default function WalletPage() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const loadTx = useCallback(async () => {
    if (!profile) return;
    let q = supabase.from('transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50);
    if (filter !== 'all') q = q.eq('type', filter);
    const { data } = await q;
    if (data) setTransactions(data as Transaction[]);
  }, [profile, filter]);

  useEffect(() => {
    loadTx();
  }, [loadTx]);

  if (!profile) return <div className="page-container"><p className="text-center text-beach-400 mt-20">جارٍ التحميل...</p></div>;

  const txLabels: Record<string, string> = {
    game_reward: 'مكافأة لعبة',
    task_reward: 'مكافأة مهمة',
    referral_reward: 'مكافأة إحالة',
    daily_reward: 'مكافأة يومية',
    bonus: 'مكافأة',
    withdrawal: 'سحب',
    withdrawal_refund: 'استرداد سحب',
  };

  const filters = [
    { value: 'all', label: 'الكل' },
    { value: 'game_reward', label: 'لعبة' },
    { value: 'task_reward', label: 'مهام' },
    { value: 'referral_reward', label: 'إحالة' },
    { value: 'daily_reward', label: 'يومية' },
    { value: 'withdrawal', label: 'سحب' },
  ];

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-beach-800 mb-4">المحفظة</h1>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card bg-gradient-to-l from-beach-500 to-beach-600 border-none">
          <Wallet className="w-6 h-6 text-beach-100 mb-2" />
          <p className="text-beach-100 text-xs">المتاح</p>
          <p className="text-white text-2xl font-bold">${formatMoney(profile.balance_cents)}</p>
        </div>
        <div className="card bg-gradient-to-l from-sand-400 to-sand-500 border-none">
          <ArrowDownCircle className="w-6 h-6 text-sand-100 mb-2" />
          <p className="text-sand-100 text-xs">معلق</p>
          <p className="text-white text-2xl font-bold">${formatMoney(profile.pending_balance_cents)}</p>
        </div>
        <div className="card">
          <TrendingUp className="w-6 h-6 text-success-500 mb-2" />
          <p className="text-beach-400 text-xs">إجمالي الأرباح</p>
          <p className="text-beach-800 text-xl font-bold">${formatMoney(profile.total_earned_cents)}</p>
        </div>
        <div className="card">
          <TrendingDown className="w-6 h-6 text-beach-400 mb-2" />
          <p className="text-beach-400 text-xs">إجمالي المسحوب</p>
          <p className="text-beach-800 text-xl font-bold">${formatMoney(profile.total_withdrawn_cents)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto mb-4 pb-1">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.value ? 'bg-beach-500 text-white' : 'bg-white text-beach-500 border border-beach-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transactions */}
      <div className="card">
        <h3 className="section-title">المعاملات</h3>
        {transactions.length === 0 ? (
          <p className="text-beach-400 text-sm text-center py-4">لا توجد معاملات</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-beach-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${tx.amount_cents >= 0 ? 'bg-success-100' : 'bg-error-100'}`}>
                    {tx.amount_cents >= 0 ? <ArrowUpCircle className="w-5 h-5 text-success-600" /> : <ArrowDownCircle className="w-5 h-5 text-error-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-beach-800">{txLabels[tx.type] || tx.type}</p>
                    <p className="text-xs text-beach-400">{new Date(tx.created_at).toLocaleDateString('ar')} {new Date(tx.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <p className={`font-bold text-sm ${tx.amount_cents >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                  {tx.amount_cents >= 0 ? '+' : ''}${formatMoney(Math.abs(tx.amount_cents))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
