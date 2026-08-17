import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, ListTodo, HelpCircle, Gift, CreditCard, Receipt, ShieldAlert, Settings, FileText, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const adminNav = [
  { path: '/admin', label: 'الرئيسية', icon: LayoutDashboard },
  { path: '/admin/users', label: 'المستخدمون', icon: Users },
  { path: '/admin/tasks', label: 'المهام', icon: ListTodo },
  { path: '/admin/questions', label: 'الأسئلة', icon: HelpCircle },
  { path: '/admin/referrals', label: 'الإحالات', icon: Gift },
  { path: '/admin/withdrawals', label: 'السحوبات', icon: CreditCard },
  { path: '/admin/transactions', label: 'المعاملات', icon: Receipt },
  { path: '/admin/fraud', label: 'الاحتيال', icon: ShieldAlert },
  { path: '/admin/settings', label: 'الإعدادات', icon: Settings },
  { path: '/admin/audit-logs', label: 'السجلات', icon: FileText },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="md:hidden bg-beach-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link to="/admin" className="font-bold text-lg">لوحة الإدارة</Link>
        <button onClick={() => navigate('/')} className="text-sm flex items-center gap-1">
          للتطبيق <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-beach-800 text-white min-h-screen sticky top-0">
        <div className="p-5 border-b border-beach-700">
          <h1 className="font-bold text-xl">لوحة الإدارة</h1>
          <p className="text-beach-200 text-sm mt-1">{profile?.username}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  active ? 'bg-beach-600 text-white' : 'text-beach-200 hover:bg-beach-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-beach-700 space-y-2">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-3 py-2 text-beach-200 hover:bg-beach-700 rounded-lg text-sm"
          >
            <ArrowRight className="w-5 h-5" /> للتطبيق
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 text-error-300 hover:bg-beach-700 rounded-lg text-sm"
          >
            <ArrowRight className="w-5 h-5" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile horizontal nav */}
      <div className="md:hidden overflow-x-auto bg-beach-700 border-b border-beach-600">
        <div className="flex gap-1 px-2 py-2 min-w-max">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
                  active ? 'bg-beach-500 text-white' : 'text-beach-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
