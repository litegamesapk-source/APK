import { useState, useEffect } from 'react';
import { supabase, formatMoney, type Settings } from '@/lib/supabase';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setSettings(data as Settings);
    });
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const payload: Record<string, string | number | boolean> = {};
    (Object.keys(settings) as (keyof Settings)[]).forEach((k) => {
      if (k !== 'id') {
        payload[k] = settings[k] as string | number | boolean;
      }
    });
    const { error } = await supabase.rpc('admin_update_settings', { p_settings: payload });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (!settings) return <div className="text-gray-400 mt-8 text-center">جارٍ التحميل...</div>;

  const update = (k: keyof Settings, v: string | number | boolean) => {
    setSettings({ ...settings, [k]: v });
  };

  const numField = (label: string, key: keyof Settings, suffix?: string) => (
    <div>
      <label className="text-xs text-gray-400">{label} {suffix && `(${suffix})`}</label>
      <input
        type="number"
        value={settings[key] as number}
        onChange={(e) => update(key, Number(e.target.value))}
        className="input-field"
      />
    </div>
  );

  const boolField = (label: string, key: keyof Settings) => (
    <label className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
      <input type="checkbox" checked={settings[key] as boolean} onChange={(e) => update(key, e.target.checked)} className="w-5 h-5" />
      <span className="text-sm text-gray-600">{label}</span>
    </label>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-beach-800 mb-6">الإعدادات</h1>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-700 mb-3">السحب والإحالة</h3>
          <div className="grid grid-cols-2 gap-3">
            {numField('الحد الأدنى للسحب', 'min_withdrawal_cents', 'سنت')}
            {numField('مكافأة الإحالة', 'referral_reward_cents', 'سنت')}
            {numField('ألعاب التأهيل للإحالة', 'referral_qualification_games')}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-700 mb-3">اللعبة</h3>
          <div className="grid grid-cols-2 gap-3">
            {numField('محاولات يومية', 'daily_game_attempts')}
            {numField('حد الأرباح اليومي', 'daily_game_earnings_limit_cents', 'سنت')}
            {numField('نقاط لكل إجابة صحيحة', 'points_per_correct_answer')}
            {numField('مكافأة إكمال جولة', 'game_reward_completion_cents', 'سنت')}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-700 mb-3">المكافآت حسب النقاط</h3>
          <div className="grid grid-cols-2 gap-3">
            {numField('حد 1 - نقاط', 'score_threshold_1_points')}
            {numField('حد 1 - مكافأة', 'score_threshold_1_cents', 'سنت')}
            {numField('حد 2 - نقاط', 'score_threshold_2_points')}
            {numField('حد 2 - مكافأة', 'score_threshold_2_cents', 'سنت')}
            {numField('حد 3 - نقاط', 'score_threshold_3_points')}
            {numField('حد 3 - مكافأة', 'score_threshold_3_cents', 'سنت')}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-700 mb-3">البونص</h3>
          <div className="grid grid-cols-2 gap-3">
            {numField('نقاط بونص السرعة', 'speed_bonus_points')}
            {numField('نقاط بونص الكومبو', 'combo_bonus_points')}
            {numField('عدد الكومبو المطلوب', 'combo_required')}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {boolField('تفعيل بونص السرعة', 'speed_bonus_enabled')}
            {boolField('تفعيل بونص الكومبو', 'combo_bonus_enabled')}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-bold text-gray-700 mb-3">أخرى</h3>
          {boolField('تفعيل لوحة المتصدرين', 'leaderboard_enabled')}
        </div>

        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? 'جارٍ الحفظ...' : saved ? 'تم الحفظ!' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
}
