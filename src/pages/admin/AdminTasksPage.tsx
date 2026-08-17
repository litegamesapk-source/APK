import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Gift, Power } from 'lucide-react';
import { supabase, formatMoney, type Task } from '@/lib/supabase';

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  if (loading) return <div className="text-gray-400 mt-8 text-center">جارٍ التحميل...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-beach-800">المهام</h1>
        <button onClick={() => setCreating(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> مهمة جديدة
        </button>
      </div>

      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">{t.title}</h3>
                {t.description && <p className="text-sm text-gray-400 mt-1">{t.description}</p>}
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-sand-100 text-sand-700 px-2 py-1 rounded-full">${formatMoney(t.reward_cents)}</span>
                  <span className="text-xs bg-beach-100 text-beach-600 px-2 py-1 rounded-full">
                    {t.type === 'daily' ? 'يومية' : t.type === 'one_time' ? 'مرة واحدة' : 'سلسلة'}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                    {t.requirement.type}: {t.requirement.count}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${t.is_active ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-400'}`}>
                    {t.is_active ? 'نشط' : 'معطل'}
                  </span>
                </div>
              </div>
              <button onClick={() => setEditing(t)} className="text-beach-400 hover:text-beach-600 p-1">
                <Edit className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <TaskEditor
          task={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); loadTasks(); }}
        />
      )}
    </div>
  );
}

function TaskEditor({ task, onClose, onSaved }: { task: Task | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [rewardCents, setRewardCents] = useState(task ? Math.round(task.reward_cents) : 0);
  const [type, setType] = useState(task?.type || 'one_time');
  const [reqType, setReqType] = useState(task?.requirement?.type || 'games_played');
  const [reqCount, setReqCount] = useState(task?.requirement?.count || 1);
  const [isActive, setIsActive] = useState(task?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    const { error } = await supabase.rpc('admin_upsert_task', {
      p_title: title,
      p_description: description || null,
      p_reward_cents: Math.round(rewardCents),
      p_type: type,
      p_requirement: { type: reqType, count: Number(reqCount) },
      p_is_active: isActive,
      p_id: task?.id || null,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSaved();
  };

  const reqTypes: Record<string, string> = {
    games_played: 'ألعاب ملعوبة',
    game_points: 'نقاط اللعب',
    games_won: 'ألعاب فائزة',
    current_streak: 'السلسلة الحالية',
    daily_games: 'ألعاب اليوم',
    score_in_session: 'نقاط في جولة',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-gray-800 mb-4">{task ? 'تعديل مهمة' : 'مهمة جديدة'}</h3>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="العنوان" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="الوصف" rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">المكافأة (سنت)</label>
              <input type="number" value={rewardCents} onChange={(e) => setRewardCents(Number(e.target.value))} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-gray-400">النوع</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'daily' | 'one_time' | 'streak')} className="input-field">
                <option value="one_time">مرة واحدة</option>
                <option value="daily">يومية</option>
                <option value="streak">سلسلة</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">نوع المتطلب</label>
              <select value={reqType} onChange={(e) => setReqType(e.target.value)} className="input-field">
                {Object.entries(reqTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">العدد المطلوب</label>
              <input type="number" value={reqCount} onChange={(e) => setReqCount(Number(e.target.value))} className="input-field" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-5 h-5" />
            <span className="text-sm text-gray-600">نشط</span>
          </label>
          {error && <p className="text-error-600 text-sm">{error}</p>}
          <button onClick={save} disabled={saving} className="btn-primary w-full">{saving ? '...' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
