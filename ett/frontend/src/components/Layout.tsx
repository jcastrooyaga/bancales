import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', roles: ['ADMIN', 'REQUESTER', 'VALIDATOR', 'SUPERVALIDATOR', 'READONLY'] },
  { path: '/requests', label: 'Mis Solicitudes', roles: ['ADMIN', 'REQUESTER'] },
  { path: '/requests/new', label: 'Nueva Solicitud', roles: ['ADMIN', 'REQUESTER'] },
  { path: '/validation', label: 'Validación', roles: ['ADMIN', 'VALIDATOR', 'SUPERVALIDATOR'] },
  { path: '/supervalidator', label: 'Supervalidación', roles: ['ADMIN', 'SUPERVALIDATOR'] },
  { path: '/admin/users', label: 'Usuarios', roles: ['ADMIN'] },
  { path: '/admin/etts', label: 'ETTs', roles: ['ADMIN'] },
  { path: '/admin/circuits', label: 'Circuitos', roles: ['ADMIN'] },
  { path: '/admin/catalogs', label: 'Catálogos', roles: ['ADMIN'] },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const visibleItems = navItems.filter(item => item.roles.some(r => user?.roles.includes(r as any)));

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-blue-900 text-white transform transition-transform md:translate-x-0 md:static md:inset-auto`}>
        <div className="flex items-center justify-between p-4 border-b border-blue-800">
          <span className="text-xl font-bold">Gestión ETT</span>
          <button className="md:hidden" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="mt-4">
          {visibleItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center px-4 py-3 text-sm transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-100 hover:bg-blue-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-blue-800">
          <p className="text-xs text-blue-300 truncate">{user?.name}</p>
          <p className="text-xs text-blue-400 truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 w-full text-xs bg-blue-800 hover:bg-blue-700 text-white py-1.5 px-3 rounded"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-4 py-3 flex items-center md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600 mr-4">☰</button>
          <span className="font-semibold">Gestión ETT</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
