import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Gamepad2, Gift, ListTodo, Users, TrendingUp, Wallet, Bell, Flame, Trophy } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, formatMoney, type Settings, type Transaction } from '@/lib/supabase';

export default function HomePage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [s, tx, notif, daily] = await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('is_read', false),
      supabase.from('daily_rewards').select('id').eq('user_id', profile.id).eq('claimed_date', new Date().toISOString().slice(0, 10)).maybeSingle(),
    ]);
    if (s.data) setSettings(s.data as Settings);
    if (tx.data) setRecentTx(tx.data as Transaction[]);
    if (notif.count !== null) setUnreadCount(notif.count);
    setDailyClaimed(!!daily.data);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const claimDaily = async () => {
    setClaiming(true);
    setClaimMsg('');
    const { error } = await supabase.rpc('claim_daily_reward');
    setClaiming(false);
    if (error) {
      setClaimMsg(error.message);
      return;
    }
    setDailyClaimed(true);
    setClaimMsg('تم استلام المكافأة اليومية!');
    refreshProfile();
    loadData();
  };

  if (!profile || !settings) {
    return <div className="page-container"><div className="animate-pulse text-beach-400 text-center mt-20">جارٍ التحميل...</div></div>;
  }

  const progress = Math.min((profile.balance_cents / settings.min_withdrawal_cents) * 100, 100);
  const canWithdraw = profile.balance_cents >= settings.min_withdrawal_cents;
  const remaining = Math.max(0, settings.min_withdrawal_cents - profile.balance_cents);

  const txLabels: Record<string, string> = {
    game_reward: 'مكافأة لعبة',
    task_reward: 'مكافأة مهمة',
    referral_reward: 'مكافأة إحالة',
    daily_reward: 'مكافأة يومية',
    bonus: 'مكافأة',
    withdrawal: 'سحب',
    withdrawal_refund: 'استرداد سحب',
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-beach-200 flex items-center justify-center text-beach-700 font-bold text-lg">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-beach-400 text-sm">مرحبًا</p>
            <p className="font-bold text-beach-800">{profile.username} 👋</p>
          </div>
        </div>
        <button onClick={() => navigate('/notifications')} className="relative p-2 rounded-full bg-white shadow-sm border border-beach-100">
          <Bell className="w-5 h-5 text-beach-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-error-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Balance Card */}
      <div className="card bg-gradient-to-l from-beach-500 to-beach-600 border-none mb-4">
        <p className="text-beach-100 text-sm">رصيدك المتاح</p>
        <p className="text-white text-4xl font-bold mt-1">${formatMoney(profile.balance_cents)}</p>
        <div className="flex gap-4 mt-3 text-sm">
          <div>
            <p className="text-beach-100">معلق</p>
            <p className="text-white font-bold">${formatMoney(profile.pending_balance_cents)}</p>
          </div>
          <div>
            <p className="text-beach-100">إجمالي الأرباح</p>
            <p className="text-white font-bold">${formatMoney(profile.total_earned_cents)}</p>
          </div>
        </div>
      </div>

      {/* Progress to withdrawal */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold text-beach-700">الحد الأدنى للسحب</span>
          <span className="text-sm text-beach-500">${formatMoney(profile.balance_cents)} / ${formatMoney(settings.min_withdrawal_cents)}</span>
        </div>
        <div className="w-full h-3 bg-beach-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-l from-beach-400 to-beach-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className={`text-sm mt-2 ${canWithdraw ? 'text-success-600 font-bold' : 'text-beach-400'}`}>
          {canWithdraw ? '🎉 يمكنك الآن طلب السحب' : `تبقى $${formatMoney(remaining)} للوصول للحد الأدنى`}
        </p>
        {canWithdraw && (
          <button onClick={() => navigate('/withdraw')} className="btn-primary w-full mt-3 text-sm">
            طلب سحب
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card text-center">
          <Trophy className="w-6 h-6 text-sand-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-beach-800">{profile.game_points}</p>
          <p className="text-xs text-beach-400">نقاط</p>
        </div>
        <div className="card text-center">
          <TrendingUp className="w-6 h-6 text-beach-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-beach-800">{profile.level}</p>
          <p className="text-xs text-beach-400">المستوى</p>
        </div>
        <div className="card text-center">
          <Flame className="w-6 h-6 text-error-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-beach-800">{profile.current_streak}</p>
          <p className="text-xs text-beach-400">سلسلة</p>
        </div>
      </div>

      {/* Big Play Button */}
      <button
        onClick={() => navigate('/game')}
        className="w-full bg-gradient-to-l from-beach-500 to-beach-700 text-white font-bold py-5 rounded-2xl shadow-lg active:scale-95 transition-all duration-200 mb-4 flex items-center justify-center gap-3 text-xl"
      >
        <Gamepad2 className="w-8 h-8" /> ابدأ اللعب
      </button>

      {/* Daily Reward */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="w-5 h-5 text-sand-500" />
          <h3 className="font-bold text-beach-800">المكافأة اليومية</h3>
        </div>
        {dailyClaimed ? (
          <p className="text-beach-400 text-sm">استلمت مكافأة اليوم! عد غدًا للمزيد.</p>
        ) : (
          <>
            <p className="text-beach-500 text-sm mb-3">سلسلة {profile.daily_reward_streak} أيام — استلم مكافأتك اليومية!</p>
            <button onClick={claimDaily} disabled={claiming} className="btn-primary w-full text-sm">
              {claiming ? 'جارٍ الاستلام...' : 'استلام المكافأة'}
            </button>
            {claimMsg && <p className="text-sm mt-2 text-center text-beach-600">{claimMsg}</p>}
          </>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link to="/tasks" className="card flex items-center gap-3 active:scale-95 transition-transform">
          <div className="w-10 h-10 rounded-xl bg-beach-100 flex items-center justify-center">
            <ListTodo className="w-5 h-5 text-beach-600" />
          </div>
          <div>
            <p className="font-bold text-beach-800 text-sm">المهام</p>
            <p className="text-xs text-beach-400">أكمل واربح</p>
          </div>
        </Link>
        <Link to="/referrals" className="card flex items-center gap-3 active:scale-95 transition-transform">
          <div className="w-10 h-10 rounded-xl bg-sand-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-sand-600" />
          </div>
          <div>
            <p className="font-bold text-beach-800 text-sm">الإحالات</p>
            <p className="text-xs text-beach-400">ادعُ واربح</p>
          </div>
        </Link>
        <Link to="/wallet" className="card flex items-center gap-3 active:scale-95 transition-transform">
          <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-success-600" />
          </div>
          <div>
            <p className="font-bold text-beach-800 text-sm">المحفظة</p>
            <p className="text-xs text-beach-400">معاملاتك</p>
          </div>
        </Link>
        <Link to="/leaderboard" className="card flex items-center gap-3 active:scale-95 transition-transform">
          <div className="w-10 h-10 rounded-xl bg-warning-100 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-warning-600" />
          </div>
          <div>
            <p className="font-bold text-beach-800 text-sm">المتصدرون</p>
            <p className="text-xs text-beach-400">الترتيب</p>
          </div>
        </Link>
      </div>

      {/* Referral Card */}
      <div className="card bg-gradient-to-l from-sand-400 to-sand-500 border-none mb-4">
        <h3 className="font-bold text-white mb-1">ادعُ أصدقاءك واربح!</h3>
        <p className="text-sand-100 text-sm mb-3">احصل على ${formatMoney(settings.referral_reward_cents)} لكل إحالة مؤهلة</p>
        <button onClick={() => navigate('/referrals')} className="bg-white text-sand-700 font-bold py-2 px-4 rounded-xl text-sm active:scale-95 transition-transform">
          مشاركة الرابط
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <h3 className="section-title">آخر المعاملات</h3>
        {recentTx.length === 0 ? (
          <p className="text-beach-400 text-sm text-center py-4">لا توجد معاملات بعد</p>
        ) : (
          <div className="space-y-2">
            {recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-beach-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-beach-800">{txLabels[tx.type] || tx.type}</p>
                  <p className="text-xs text-beach-400">{new Date(tx.created_at).toLocaleDateString('ar')}</p>
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
