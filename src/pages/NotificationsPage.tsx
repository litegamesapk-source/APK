import { useState, useEffect, useCallback } from 'react';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Notification } from '@/lib/supabase';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    load();
  };

  const typeIcons: Record<string, string> = {
    reward: '🎉',
    success: '✅',
    info: 'ℹ️',
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-beach-800">الإشعارات</h1>
        {notifications.some(n => !n.is_read) && (
          <button onClick={markAllRead} className="text-sm text-beach-500 hover:text-beach-700 font-medium flex items-center gap-1">
            <Check className="w-4 h-4" /> تعليم الكل كمقروء
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-8">
          <Bell className="w-12 h-12 text-beach-200 mx-auto mb-2" />
          <p className="text-beach-400">لا توجد إشعارات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className={`card ${!n.is_read ? 'border-beach-300 bg-beach-50' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{typeIcons[n.type] || '🔔'}</span>
                <div className="flex-1">
                  <p className="font-bold text-beach-800 text-sm">{n.title}</p>
                  {n.body && <p className="text-beach-500 text-sm mt-0.5">{n.body}</p>}
                  <p className="text-xs text-beach-300 mt-1">{new Date(n.created_at).toLocaleDateString('ar')} {new Date(n.created_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-beach-500 mt-2" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
