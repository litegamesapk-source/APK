import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // session is now available
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/'), 2000);
  };

  if (done) {
    return (
      <div className="animate-fade-in text-center">
        <h1 className="text-2xl font-bold text-success-600 mb-2">تم تحديث كلمة المرور</h1>
        <p className="text-beach-500">سيتم توجيهك للصفحة الرئيسية...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link to="/login" className="flex items-center gap-1 text-beach-500 hover:text-beach-700 mb-6 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" /> العودة
      </Link>
      <h1 className="text-3xl font-bold text-beach-800 mb-2">كلمة مرور جديدة</h1>
      <p className="text-beach-500 mb-6">أدخل كلمة المرور الجديدة لحسابك.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-beach-700 mb-2">كلمة المرور الجديدة</label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-beach-300" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pr-11 pl-11"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-beach-300 hover:text-beach-500"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-error-50 border border-error-100 text-error-700 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
        </button>
      </form>
    </div>
  );
}
