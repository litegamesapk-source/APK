import { useState, useEffect, useCallback } from 'react';
import { Search, ShieldAlert, User as UserIcon } from 'lucide-react';
import { supabase, formatMoney, type Profile } from '@/lib/supabase';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadUsers = useCallback(async () => {
    let q = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    if (search) {
      q = q.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { data } = await q;
    if (data) setUsers(data as Profile[]);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
  }, [loadUsers]);

  const updateStatus = async (userId: string, status: string) => {
    setUpdating(true);
    const { error } = await supabase.rpc('admin_update_account_status', { p_user_id: userId, p_new_status: status });
    setUpdating(false);
    if (!error) {
      setSelected(null);
      loadUsers();
    }
  };

  const statusColors: Record<string, string> = {
    normal: 'bg-success-100 text-success-600',
    review: 'bg-warning-100 text-warning-600',
    suspended: 'bg-error-100 text-error-600',
    banned: 'bg-error-500 text-white',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-beach-800 mb-6">المستخدمون</h1>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border-2 border-gray-100 rounded-xl py-2.5 pr-11 pl-4 text-sm focus:outline-none focus:border-beach-300"
          placeholder="بحث بالاسم أو البريد..."
        />
      </div>

      {loading ? (
        <p className="text-gray-400 text-center mt-8">جارٍ التحميل...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-400 text-center mt-8">لا يوجد مستخدمون</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelected(u)}
              className="w-full bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 hover:border-beach-200 transition-colors text-right"
            >
              <div className="w-10 h-10 rounded-full bg-beach-100 flex items-center justify-center text-beach-700 font-bold">
                {u.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm">{u.username}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-700 text-sm">${formatMoney(u.balance_cents)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[u.account_status]}`}>
                  {u.account_status === 'normal' ? 'طبيعي' : u.account_status === 'review' ? 'مراجعة' : u.account_status === 'suspended' ? 'موقوف' : 'محظور'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* User detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-beach-100 flex items-center justify-center text-beach-700 font-bold text-2xl">
                {selected.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800">{selected.username}</h3>
                <p className="text-sm text-gray-400">{selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">الرصيد</p>
                <p className="font-bold text-gray-800">${formatMoney(selected.balance_cents)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">معلق</p>
                <p className="font-bold text-gray-800">${formatMoney(selected.pending_balance_cents)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">نقاط اللعب</p>
                <p className="font-bold text-gray-800">{selected.game_points}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">المستوى</p>
                <p className="font-bold text-gray-800">{selected.level}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">ألعاب</p>
                <p className="font-bold text-gray-800">{selected.total_games}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">فوز</p>
                <p className="font-bold text-gray-800">{selected.games_won}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">إجمالي الأرباح</p>
                <p className="font-bold text-gray-800">${formatMoney(selected.total_earned_cents)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">إجمالي المسحوب</p>
                <p className="font-bold text-gray-800">${formatMoney(selected.total_withdrawn_cents)}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-bold text-gray-700 mb-2">رمز الإحالة: <span className="text-beach-600">{selected.referral_code}</span></p>
              <p className="text-sm text-gray-400">تاريخ التسجيل: {new Date(selected.created_at).toLocaleDateString('ar')}</p>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> تغيير حالة الحساب
              </p>
              <div className="grid grid-cols-2 gap-2">
                {['normal', 'review', 'suspended', 'banned'].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(selected.id, s)}
                    disabled={updating || selected.account_status === s}
                    className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                      selected.account_status === s
                        ? `${statusColors[s]} cursor-default`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s === 'normal' ? 'طبيعي' : s === 'review' ? 'مراجعة' : s === 'suspended' ? 'موقوف' : 'محظور'}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setSelected(null)} className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}
