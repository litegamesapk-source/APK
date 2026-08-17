import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      return;
    }
    navigate('/');
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-beach-500 shadow-lg mb-4">
          <Gamepad2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-beach-800">مرحبًا بعودتك</h1>
        <p className="text-beach-500 mt-2">سجّل الدخول للعب وكسب المكافآت</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-beach-700 mb-2">البريد الإلكتروني</label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-beach-300" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field pr-11"
              placeholder="example@email.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-beach-700 mb-2">كلمة المرور</label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-beach-300" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pr-11 pl-11"
              placeholder="••••••••"
              required
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
          <div className="bg-error-50 border border-error-100 text-error-700 text-sm rounded-xl p-3 animate-slide-up">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>

      <div className="flex items-center justify-between mt-4 text-sm">
        <Link to="/forgot-password" className="text-beach-500 hover:text-beach-700 font-medium">
          نسيت كلمة المرور؟
        </Link>
        <Link to="/register" className="text-beach-500 hover:text-beach-700 font-medium">
          حساب جديد
        </Link>
      </div>
    </div>
  );
}
