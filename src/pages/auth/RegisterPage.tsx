import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Gamepad2, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const referralCode = params.get('ref') || '';
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          referral_code: referralCode || undefined,
        },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message === 'User already registered' ? 'هذا البريد مسجل بالفعل' : error.message);
      return;
    }
    if (data.session) {
      navigate('/');
    } else {
      navigate('/login?registered=1');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-beach-500 shadow-lg mb-4">
          <Gamepad2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-beach-800">حساب جديد</h1>
        <p className="text-beach-500 mt-2">سجّل وابدأ بكسب المكافآت</p>
        {referralCode && (
          <p className="text-sand-600 text-sm mt-2 font-medium">تمت دعوتك بواسطة: {referralCode}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-beach-700 mb-2">اسم المستخدم</label>
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-beach-300" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field pr-11"
              placeholder="اسمك"
              required
              minLength={3}
            />
          </div>
        </div>

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
          <div className="bg-error-50 border border-error-100 text-error-700 text-sm rounded-xl p-3 animate-slide-up">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'جارٍ التسجيل...' : 'تسجيل'}
        </button>
      </form>

      <div className="text-center mt-4 text-sm">
        <Link to="/login" className="text-beach-500 hover:text-beach-700 font-medium">
          لديك حساب؟ سجّل الدخول
        </Link>
      </div>
    </div>
  );
}
