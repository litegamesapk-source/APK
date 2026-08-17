import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Gamepad2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ReferralLandingPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-beach-50 via-beach-100 to-sand-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-beach-500 shadow-lg mb-6">
          <Gamepad2 className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-beach-800 mb-2">تمت دعوتك!</h1>
        <p className="text-beach-500 mb-1">رمز الدعوة: <span className="font-bold text-beach-700">{code}</span></p>
        <p className="text-beach-400 text-sm mb-6">سجّل الآن وابدأ بكسب المكافآت من اللعب والمهام</p>

        {session === null ? (
          <p className="text-beach-400">جارٍ التحميل...</p>
        ) : session ? (
          <div className="space-y-3">
            <p className="text-beach-600">أنت مسجل بالفعل.</p>
            <button onClick={() => navigate('/')} className="btn-primary w-full">الذهاب للتطبيق</button>
          </div>
        ) : (
          <div className="space-y-3">
            <Link to={`/register?ref=${code}`} className="btn-primary w-full block">سجّل الآن</Link>
            <Link to="/login" className="btn-secondary w-full block flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" /> لديّ حساب
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
