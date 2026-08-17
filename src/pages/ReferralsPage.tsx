import { useState, useEffect, useCallback } from 'react';
import { Users, Copy, Share2, Check, Gift } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, formatMoney, type Referral, type Settings } from '@/lib/supabase';

export default function ReferralsPage() {
  const { profile } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [r, s] = await Promise.all([
      supabase.from('referrals').select('*').eq('referrer_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (r.data) setReferrals(r.data as Referral[]);
    if (s.data) setSettings(s.data as Settings);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!profile) return <div className="page-container"><p className="text-center text-beach-400 mt-20">جارٍ التحميل...</p></div>;

  const refLink = `${window.location.origin}/ref/${profile.referral_code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Reward Game',
          text: 'العب واربح مكافآت حقيقية! سجّل عبر رابطي:',
          url: refLink,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  const statusLabels: Record<string, { text: string; color: string }> = {
    pending: { text: 'قيد التأهيل', color: 'bg-warning-100 text-warning-600' },
    approved: { text: 'مؤهل', color: 'bg-success-100 text-success-600' },
    rejected: { text: 'مرفوض', color: 'bg-error-100 text-error-600' },
    cancelled: { text: 'ملغى', color: 'bg-beach-100 text-beach-500' },
  };

  const approvedCount = referrals.filter(r => r.status === 'approved').length;
  const pendingCount = referrals.filter(r => r.status === 'pending').length;

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-beach-800 mb-4">الإحالات</h1>

      {/* Referral card */}
      <div className="card bg-gradient-to-l from-sand-400 to-sand-500 border-none mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-6 h-6 text-white" />
          <h3 className="font-bold text-white text-lg">شارك واربح</h3>
        </div>
        <p className="text-sand-100 text-sm mb-1">احصل على ${formatMoney(settings?.referral_reward_cents || 50)} لكل إحالة مؤهلة</p>
        <p className="text-sand-200 text-xs mb-4">يصبح الإحالة مؤهلاً بعد إكمال {settings?.referral_qualification_games || 3} جولات لعب.</p>

        <div className="bg-white/20 rounded-xl p-3 mb-3">
          <p className="text-white text-sm">رمزك: <span className="font-bold">{profile.referral_code}</span></p>
          <p className="text-sand-100 text-xs mt-1 break-all">{refLink}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={copyLink} className="flex-1 bg-white text-sand-700 font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform flex items-center justify-center gap-2">
            {copied ? <><Check className="w-4 h-4" /> تم النسخ</> : <><Copy className="w-4 h-4" /> نسخ الرابط</>}
          </button>
          <button onClick={shareLink} className="flex-1 bg-sand-700 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4" /> مشاركة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-success-600">{approvedCount}</p>
          <p className="text-xs text-beach-400">إحالات مؤهلة</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-warning-600">{pendingCount}</p>
          <p className="text-xs text-beach-400">قيد التأهيل</p>
        </div>
      </div>

      {/* Referral list */}
      <div className="card">
        <h3 className="section-title">إحالاتك</h3>
        {referrals.length === 0 ? (
          <div className="text-center py-6">
            <Gift className="w-10 h-10 text-beach-200 mx-auto mb-2" />
            <p className="text-beach-400 text-sm">لا توجد إحالات بعد. شارك رابطك وابدأ الربح!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref) => {
              const st = statusLabels[ref.status] || statusLabels.pending;
              return (
                <div key={ref.id} className="flex items-center justify-between py-2 border-b border-beach-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-beach-800">{new Date(ref.created_at).toLocaleDateString('ar')}</p>
                    {ref.reward_paid && <p className="text-xs text-success-600">+${formatMoney(ref.reward_cents)}</p>}
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${st.color}`}>{st.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
