import { useState, useEffect } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type LeaderEntry = {
  rank: number;
  username: string;
  avatar_url: string | null;
  game_points: number;
  level: number;
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('settings').select('leaderboard_enabled').eq('id', 1).maybeSingle();
      if (s && !s.leaderboard_enabled) {
        setEnabled(false);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc('get_leaderboard', { p_period: 'all_time' });
      if (!error && data) {
        setEntries(data as LeaderEntry[]);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="page-container"><p className="text-center text-beach-400 mt-20">جارٍ التحميل...</p></div>;

  if (!enabled) {
    return (
      <div className="page-container">
        <h1 className="text-2xl font-bold text-beach-800 mb-4">المتصدرون</h1>
        <div className="card text-center py-8">
          <Trophy className="w-12 h-12 text-beach-200 mx-auto mb-2" />
          <p className="text-beach-400">لوحة المتصدرين معطلة حاليًا.</p>
        </div>
      </div>
    );
  }

  const medalColors = ['text-sand-500', 'text-beach-400', 'text-sand-700'];

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-beach-800 mb-4">المتصدرون</h1>

      {/* Top 3 */}
      {entries.length >= 3 && (
        <div className="flex items-end justify-center gap-2 mb-6">
          {[1, 0, 2].map((idx) => {
            const e = entries[idx];
            if (!e) return null;
            const heights = ['h-24', 'h-28', 'h-20'];
            const order = idx === 0 ? 1 : idx === 1 ? 0 : 2;
            return (
              <div key={idx} className="flex flex-col items-center" style={{ order }}>
                <div className={`w-14 h-14 rounded-full bg-beach-200 flex items-center justify-center text-beach-700 font-bold text-xl mb-1`}>
                  {e.username.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-bold text-beach-800 mb-1">{e.username}</p>
                <p className="text-xs text-beach-400 mb-1">{e.game_points} نقطة</p>
                <div className={`${heights[order]} w-20 rounded-t-xl flex items-center justify-center ${
                  order === 0 ? 'bg-sand-400' : order === 1 ? 'bg-beach-300' : 'bg-sand-600'
                }`}>
                  <Medal className={`w-8 h-8 ${order === 0 ? 'text-white' : 'text-white/80'}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <div className="card">
        {entries.length === 0 ? (
          <p className="text-beach-400 text-sm text-center py-4">لا توجد بيانات بعد</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-beach-50 last:border-0">
                <div className={`w-8 text-center font-bold ${i < 3 ? medalColors[i] : 'text-beach-300'}`}>
                  {i + 1}
                </div>
                <div className="w-10 h-10 rounded-full bg-beach-100 flex items-center justify-center text-beach-600 font-bold">
                  {e.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-beach-800 text-sm">{e.username}</p>
                  <p className="text-xs text-beach-400">المستوى {e.level}</p>
                </div>
                <p className="font-bold text-beach-700 text-sm">{e.game_points}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
