import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="animate-fade-in text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success-100 mb-4">
          <Mail className="w-10 h-10 text-success-600" />
        </div>
        <h1 className="text-2xl font-bold text-beach-800 mb-2">تحقق من بريدك</h1>
        <p className="text-beach-500 mb-6">أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.</p>
        <Link to="/login" className="btn-secondary inline-block">العودة لتسجيل الدخول</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link to="/login" className="flex items-center gap-1 text-beach-500 hover:text-beach-700 mb-6 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" /> العودة
      </Link>
      <h1 className="text-3xl font-bold text-beach-800 mb-2">نسيت كلمة المرور؟</h1>
      <p className="text-beach-500 mb-6">أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.</p>

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

        {error && (
          <div className="bg-error-50 border border-error-100 text-error-700 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'جارٍ الإرسال...' : 'إرسال الرابط'}
        </button>
      </form>
    </div>
  );
}
