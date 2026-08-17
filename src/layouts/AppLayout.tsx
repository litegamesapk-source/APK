import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Gamepad2, ListTodo, Wallet, Users, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { path: '/', label: 'الرئيسية', icon: Home },
  { path: '/tasks', label: 'المهام', icon: ListTodo },
  { path: '/game', label: 'اللعب', icon: Gamepad2, primary: true },
  { path: '/wallet', label: 'المحفظة', icon: Wallet },
  { path: '/profile', label: 'الملف', icon: User },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-beach-50 to-white">
      <Outlet />
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-beach-100 shadow-lg z-50">
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            if (item.primary) {
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex flex-col items-center -mt-6"
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-90 ${
                      active ? 'bg-beach-600' : 'bg-beach-500'
                    }`}
                  >
                    <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-bold text-beach-700 mt-1">{item.label}</span>
                </button>
              );
            }
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center py-2 px-3 transition-all duration-200 active:scale-90"
              >
                <Icon
                  className={`w-6 h-6 ${active ? 'text-beach-600' : 'text-beach-300'}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  className={`text-xs mt-1 ${active ? 'font-bold text-beach-700' : 'text-beach-400'}`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        {profile?.is_admin && (
          <div className="text-center pb-1">
            <button
              onClick={() => navigate('/admin')}
              className="text-xs text-beach-400 hover:text-beach-600"
            >
              لوحة الإدارة
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
