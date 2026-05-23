import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const adminNavItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/bancales', label: 'Bancales' },
  { path: '/importar', label: 'Importar Excel' },
  { path: '/registro-manual', label: 'Registro Manual' },
  { path: '/plataformas', label: 'Plataformas' },
  { path: '/configuracion', label: 'Configuración' },
];

const plataformaNavItems = [
  { path: '/mi-plataforma', label: 'Mi Plataforma' },
  { path: '/bancales', label: 'Bancales' },
  { path: '/configuracion', label: 'Configuración' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = user?.role === 'PLATAFORMA' ? plataformaNavItems : adminNavItems;

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform md:translate-x-0 md:static md:inset-auto`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <span className="text-lg font-bold">Control Bancales</span>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="mt-2">
          {navItems.map(item => {
            const active = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center px-4 py-3 text-sm transition-colors ${
                  active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-700">
          <p className="text-xs text-slate-400 truncate">{user?.username}</p>
          {user?.role === 'PLATAFORMA' && (
            <p className="text-xs text-slate-500 truncate">Plataforma</p>
          )}
          <button
            onClick={handleLogout}
            className="mt-2 w-full text-xs bg-slate-700 hover:bg-slate-600 text-white py-1.5 px-3 rounded"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-4 py-3 flex items-center md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 mr-4 text-xl">☰</button>
          <span className="font-semibold text-slate-800">Control Bancales</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
