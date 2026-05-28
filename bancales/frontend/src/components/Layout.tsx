import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logoUrl from '../../logo_cat.jpg';

const adminNavItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/bancales-hoy', label: 'Bancales hoy' },
  { path: '/historico', label: 'Histórico' },
  { path: '/bancales', label: 'Bancales' },
  { path: '/bajas', label: 'Bajas' },
  { path: '/importar', label: 'Importar Excel' },
  { path: '/registro-manual', label: 'Registro Manual' },
  { path: '/plataformas', label: 'Plataformas' },
  { path: '/configuracion', label: 'Configuración' },
];

const plataformaNavItems = [
  { path: '/mi-plataforma', label: 'Mi Plataforma' },
  { path: '/historico', label: 'Histórico' },
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
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-brand text-white transform transition-transform md:translate-x-0 md:static md:inset-auto flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-brand-dark">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoUrl} alt="CAT SA" className="h-9 w-9 object-contain flex-shrink-0 rounded" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-white">Control Contenedores</p>
              <p className="text-sm font-bold leading-tight text-white">de Transporte v1.0</p>
            </div>
          </div>
          <button className="md:hidden text-blue-200 hover:text-white" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        {/* Nav */}
        <nav className="mt-1 flex-1">
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
                  active ? 'bg-brand-darker text-white font-medium' : 'text-blue-100 hover:bg-brand-dark'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-brand-dark">
          <p className="text-xs text-blue-200 truncate">{user?.username}</p>
          {user?.role === 'PLATAFORMA' && (
            <p className="text-xs text-blue-300 truncate">Plataforma</p>
          )}
          <button
            onClick={handleLogout}
            className="mt-2 w-full text-xs bg-brand-dark hover:bg-brand-darker text-white py-1.5 px-3 rounded transition-colors"
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
          <span className="font-semibold text-slate-800">Control CT</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
