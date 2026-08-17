import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Trophy, Flame, Gamepad2, Gift, LogOut, Settings, Edit, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, formatMoney, type PlayerLevel } from '@/lib/supabase';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile, signOut, refreshProfile } = useAuth();
  const [levels, setLevels] = useState<PlayerLevel[]>([]);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const loadLevels = useCallback(async () => {
    const { data } = await supabase.from('player_levels').select('*').order('level', { ascending: true });
    if (data) setLevels(data as PlayerLevel[]);
  }, []);

  useEffect(() => {
    loadLevels();
    if (profile) setUsername(profile.username);
  }, [loadLevels, profile]);

  if (!profile) return <div className="page-container"><p className="text-center text-beach-400 mt-20">جارٍ التحميل...</p></div>;

  const currentLevel = levels.find(l => l.level === profile.level);
  const nextLevel = levels.find(l => l.level === profile.level + 1);
  const levelProgress = nextLevel
    ? Math.min(((profile.game_points - (currentLevel?.min_points || 0)) / (nextLevel.min_points - (currentLevel?.min_points || 1))) * 100, 100)
    : 100;

  const saveProfile = async () => {
    if (!profile || username.trim().length < 3) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ username: username.trim() }).eq('id', profile.id);
    setSaving(false);
    if (!error) {
      setEditing(false);
      refreshProfile();
    }
  };

  return (
    <div className="page-container">
      {/* Profile header */}
      <div className="card text-center mb-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-l from-beach-400 to-beach-600 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-3">
          {profile.username.charAt(0).toUpperCase()}
        </div>
        {editing ? (
          <div className="flex gap-2 justify-center mb-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field max-w-[200px] text-center"
              minLength={3}
            />
            <button onClick={saveProfile} disabled={saving} className="btn-primary text-sm px-4">
              {saving ? '...' : 'حفظ'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-beach-800">{profile.username}</h2>
            <button onClick={() => setEditing(true)} className="text-beach-300 hover:text-beach-500">
              <Edit className="w-4 h-4" />
            </button>
          </div>
        )}
        <p className="text-beach-400 text-sm">{profile.email}</p>
        {profile.is_admin && (
          <span className="inline-block mt-2 text-xs bg-beach-100 text-beach-700 px-3 py-1 rounded-full font-bold">مشرف</span>
        )}
      </div>

      {/* Level progress */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-sand-500" />
          <h3 className="font-bold text-beach-800">المستوى {profile.level} — {currentLevel?.title || ''}</h3>
        </div>
        <div className="w-full h-3 bg-beach-100 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-gradient-to-l from-sand-400 to-sand-600 rounded-full transition-all" style={{ width: `${levelProgress}%` }} />
        </div>
        <p className="text-xs text-beach-400">
          {nextLevel ? `${profile.game_points} / ${nextLevel.min_points} نقطة للمستوى ${nextLevel.level}` : 'وصلت أعلى مستوى!'}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card flex items-center gap-3">
          <Gamepad2 className="w-8 h-8 text-beach-500" />
          <div>
            <p className="text-2xl font-bold text-beach-800">{profile.total_games}</p>
            <p className="text-xs text-beach-400">ألعاب</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Trophy className="w-8 h-8 text-success-500" />
          <div>
            <p className="text-2xl font-bold text-beach-800">{profile.games_won}</p>
            <p className="text-xs text-beach-400">فوز</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Flame className="w-8 h-8 text-error-500" />
          <div>
            <p className="text-2xl font-bold text-beach-800">{profile.current_streak}</p>
            <p className="text-xs text-beach-400">سلسلة</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Gift className="w-8 h-8 text-sand-500" />
          <div>
            <p className="text-2xl font-bold text-beach-800">${formatMoney(profile.total_earned_cents)}</p>
            <p className="text-xs text-beach-400">إجمالي الأرباح</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button onClick={() => navigate('/wallet')} className="card w-full flex items-center gap-3 active:scale-95 transition-transform">
          <User className="w-5 h-5 text-beach-500" />
          <span className="font-medium text-beach-800">المحفظة</span>
        </button>
        <button onClick={() => navigate('/referrals')} className="card w-full flex items-center gap-3 active:scale-95 transition-transform">
          <Users className="w-5 h-5 text-beach-500" />
          <span className="font-medium text-beach-800">الإحالات</span>
        </button>
        {profile.is_admin && (
          <button onClick={() => navigate('/admin')} className="card w-full flex items-center gap-3 active:scale-95 transition-transform">
            <Settings className="w-5 h-5 text-beach-500" />
            <span className="font-medium text-beach-800">لوحة الإدارة</span>
          </button>
        )}
        <button onClick={signOut} className="card w-full flex items-center gap-3 active:scale-95 transition-transform">
          <LogOut className="w-5 h-5 text-error-500" />
          <span className="font-medium text-error-600">تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
}
