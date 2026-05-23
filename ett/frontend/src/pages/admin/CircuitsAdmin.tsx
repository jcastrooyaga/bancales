import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { ValidationCircuit, User } from '../../types';

export const CircuitsAdmin: React.FC = () => {
  const [circuits, setCircuits] = useState<ValidationCircuit[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    apiClient.get('/admin/circuits').then(r => setCircuits(r.data));
    apiClient.get('/admin/users').then(r => setUsers(r.data));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Circuitos de validación</h1>
      </div>
      <div className="space-y-4">
        {circuits.map(circuit => (
          <div key={circuit.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">{circuit.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${circuit.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {circuit.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="space-y-2">
              {circuit.steps.map(step => (
                <div key={step.id} className="flex items-center gap-3 text-sm bg-gray-50 p-2 rounded">
                  <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{step.order}</span>
                  <div>
                    <span className="font-medium">{step.validator?.name}</span>
                    {step.backup && <span className="text-gray-500 ml-2">→ Suplente: {step.backup.name}</span>}
                    <span className="text-gray-400 ml-2 text-xs">({step.timeoutHours}h)</span>
                  </div>
                </div>
              ))}
              {circuit.steps.length === 0 && <p className="text-gray-400 text-sm">Sin pasos configurados</p>}
            </div>
          </div>
        ))}
        {circuits.length === 0 && (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            No hay circuitos. Créalos desde la API o añade soporte de formulario.
          </div>
        )}
      </div>
    </div>
  );
};
