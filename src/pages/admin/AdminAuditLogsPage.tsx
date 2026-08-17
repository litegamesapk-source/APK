import { useState, useEffect, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type AuditLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const perPage = 50;

  const load = useCallback(async () => {
    const { data } = await supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).range(page * perPage, (page + 1) * perPage - 1);
    if (data) setLogs(data as AuditLog[]);
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-gray-400 mt-8 text-center">جارٍ التحميل...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-beach-800 mb-6">سجلات الإدارة</h1>
      {logs.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400">لا توجد سجلات</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-gray-800">{l.action}</p>
                  <p className="text-xs text-gray-300">{new Date(l.created_at).toLocaleDateString('ar')}</p>
                </div>
                {l.target_type && <p className="text-xs text-gray-500">الهدف: {l.target_type}</p>}
                {l.new_value && (
                  <details className="mt-1">
                    <summary className="text-xs text-beach-500 cursor-pointer">التفاصيل</summary>
                    <pre className="text-xs text-gray-400 mt-1 overflow-x-auto">{JSON.stringify(l.new_value, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-secondary text-sm px-4">السابق</button>
            <button onClick={() => setPage(page + 1)} disabled={logs.length < perPage} className="btn-secondary text-sm px-4">التالي</button>
          </div>
        </>
      )}
    </div>
  );
}
