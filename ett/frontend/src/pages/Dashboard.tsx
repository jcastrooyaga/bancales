import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Stats } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiClient.get('/stats/summary').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const cards = stats ? [
    { label: 'Total solicitudes', value: stats.total, color: 'bg-blue-500' },
    { label: 'Pendientes', value: stats.pending, color: 'bg-yellow-500' },
    { label: 'Aprobadas', value: stats.approved, color: 'bg-green-500' },
    { label: 'Rechazadas', value: stats.rejected, color: 'bg-red-500' },
  ] : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bienvenido, {user?.name}</h1>
        <p className="text-gray-500 text-sm mt-1">Roles: {user?.roles.join(', ')}</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {cards.map(card => (
            <div key={card.label} className="bg-white rounded-xl shadow p-4">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${card.color} text-white text-lg font-bold mb-3`}>
                {card.value}
              </div>
              <p className="text-sm text-gray-600">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Accesos rápidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {user?.roles.includes('REQUESTER') || user?.roles.includes('ADMIN') ? (
            <a href="/requests/new" className="flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              <span className="text-blue-600 mr-3 text-xl">+</span>
              <span className="text-sm font-medium text-blue-700">Nueva solicitud</span>
            </a>
          ) : null}
          <a href="/requests" className="flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
            <span className="text-gray-600 mr-3 text-xl">📋</span>
            <span className="text-sm font-medium text-gray-700">Ver solicitudes</span>
          </a>
          {(user?.roles.includes('VALIDATOR') || user?.roles.includes('ADMIN')) && (
            <a href="/validation" className="flex items-center p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors">
              <span className="text-yellow-600 mr-3 text-xl">✓</span>
              <span className="text-sm font-medium text-yellow-700">Bandeja de validación</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
