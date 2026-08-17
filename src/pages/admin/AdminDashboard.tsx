import { useState, useEffect } from 'react';
import { Users, Gamepad2, Trophy, Gift, CreditCard, ShieldAlert, TrendingUp, DollarSign } from 'lucide-react';
import { supabase, formatMoney } from '@/lib/supabase';

type Stats = {
  total_users: number;
  active_users: number;
  suspended_users: number;
  games_today: number;
  games_this_week: number;
  total_game_points: number;
  total_game_rewards_cents: number;
  task_rewards_cents: number;
  referral_rewards_cents: number;
  total_withdrawals_cents: number;
  pending_withdrawals_count: number;
  pending_withdrawals_cents: number;
  fraud_events: number;
  pending_referrals: number;
  total_balance_cents: number;
  total_pending_balance_cents: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_admin_stats');
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setStats(data as Stats);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-beach-400 mt-8 text-center">جارٍ التحميل...</div>;
  if (error) return <div className="text-error-600 mt-8 text-center">{error}</div>;
  if (!stats) return null;

  const cards = [
    { label: 'إجمالي المستخدمين', value: stats.total_users, icon: Users, color: 'bg-beach-500' },
    { label: 'مستخدمون نشطون', value: stats.active_users, icon: Users, color: 'bg-success-500' },
    { label: 'موقوفون', value: stats.suspended_users, icon: ShieldAlert, color: 'bg-error-500' },
    { label: 'ألعاب اليوم', value: stats.games_today, icon: Gamepad2, color: 'bg-beach-400' },
    { label: 'ألعاب الأسبوع', value: stats.games_this_week, icon: Gamepad2, color: 'bg-beach-600' },
    { label: 'إجمالي النقاط', value: stats.total_game_points, icon: Trophy, color: 'bg-sand-500' },
    { label: 'مكافآت الألعاب', value: `$${formatMoney(stats.total_game_rewards_cents)}`, icon: DollarSign, color: 'bg-success-500' },
    { label: 'مكافآت المهام', value: `$${formatMoney(stats.task_rewards_cents)}`, icon: Gift, color: 'bg-sand-400' },
    { label: 'مكافآت الإحالة', value: `$${formatMoney(stats.referral_rewards_cents)}`, icon: Gift, color: 'bg-sand-600' },
    { label: 'إجمالي المسحوب', value: `$${formatMoney(stats.total_withdrawals_cents)}`, icon: CreditCard, color: 'bg-beach-700' },
    { label: 'سحوبات معلقة', value: stats.pending_withdrawals_count, icon: CreditCard, color: 'bg-warning-500' },
    { label: 'قيمة السحوبات المعلقة', value: `$${formatMoney(stats.pending_withdrawals_cents)}`, icon: TrendingUp, color: 'bg-warning-600' },
    { label: 'احتيال', value: stats.fraud_events, icon: ShieldAlert, color: 'bg-error-600' },
    { label: 'إحالات معلقة', value: stats.pending_referrals, icon: Gift, color: 'bg-beach-300' },
    { label: 'إجمالي الأرصدة', value: `$${formatMoney(stats.total_balance_cents)}`, icon: DollarSign, color: 'bg-beach-500' },
    { label: 'أرصدة معلقة', value: `$${formatMoney(stats.total_pending_balance_cents)}`, icon: DollarSign, color: 'bg-sand-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-beach-800 mb-6">لوحة الإدارة</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className={`w-10 h-10 rounded-xl ${c.color} flex items-center justify-center mb-2`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{c.value}</p>
              <p className="text-xs text-gray-400">{c.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
