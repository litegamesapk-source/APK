import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Gift, ListTodo } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, formatMoney, type Task } from '@/lib/supabase';

export default function TasksPage() {
  const { profile, refreshProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [t, c] = await Promise.all([
      supabase.from('tasks').select('*').eq('is_active', true).order('created_at', { ascending: true }),
      supabase.from('task_completions').select('task_id').eq('user_id', profile.id),
    ]);
    if (t.data) setTasks(t.data as Task[]);
    if (c.data) setCompleted(new Set(c.data.map((r: { task_id: string }) => r.task_id)));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const checkTasks = async () => {
    const { error } = await supabase.rpc('check_and_complete_tasks');
    if (!error) {
      refreshProfile();
      loadData();
    }
  };

  useEffect(() => {
    checkTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="page-container"><p className="text-center text-beach-400 mt-20">جارٍ التحميل...</p></div>;

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-beach-800 mb-4">المهام</h1>
      <p className="text-beach-400 text-sm mb-4">أكمل المهام واربح مكافآت إضافية. يتم التحقق تلقائيًا.</p>

      {tasks.length === 0 ? (
        <div className="card text-center py-8">
          <ListTodo className="w-12 h-12 text-beach-200 mx-auto mb-2" />
          <p className="text-beach-400">لا توجد مهام حاليًا</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isDone = completed.has(task.id);
            return (
              <div key={task.id} className={`card ${isDone ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  {isDone ? (
                    <CheckCircle2 className="w-6 h-6 text-success-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-6 h-6 text-beach-200 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-beach-800">{task.title}</h3>
                    {task.description && <p className="text-sm text-beach-400 mt-1">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-sand-100 text-sand-700 px-2 py-1 rounded-full">
                        {task.type === 'daily' ? 'يومية' : task.type === 'one_time' ? 'مرة واحدة' : 'سلسلة'}
                      </span>
                      <span className="text-xs bg-success-100 text-success-700 px-2 py-1 rounded-full flex items-center gap-1">
                        <Gift className="w-3 h-3" /> ${formatMoney(task.reward_cents)}
                      </span>
                      {isDone && <span className="text-xs text-success-600 font-bold">تم الإكمال</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
