import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ettApiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Request } from '../types';

export const EttDashboard: React.FC = () => {
  const { ettUser, ettLogout } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<string | null>(null);
  const [form, setForm] = useState({ workerName: '', workerDni: '', workerEmail: '' });

  useEffect(() => {
    ettApiClient.get('/ett/requests').then(r => setRequests(r.data)).finally(() => setLoading(false));
  }, []);

  const handleRegister = async () => {
    if (!modal) return;
    await ettApiClient.post(`/ett/requests/${modal}/register-worker`, form);
    setModal(null);
    setForm({ workerName: '', workerDni: '', workerEmail: '' });
  };

  const handleLogout = () => { ettLogout(); navigate('/ett/login'); };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-800 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Portal ETT</h1>
          <p className="text-green-200 text-sm">{ettUser?.name}</p>
        </div>
        <button onClick={handleLogout} className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg text-sm">Cerrar sesión</button>
      </header>
      <main className="p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4">Solicitudes asignadas</h2>
        {loading ? <div className="text-center py-8 text-gray-500">Cargando...</div> : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Código</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Centro</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Inicio</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium">{req.code}</td>
                    <td className="px-4 py-3">{req.workplace?.name || '—'}</td>
                    <td className="px-4 py-3">{req.jobCategory?.name || '—'}</td>
                    <td className="px-4 py-3">{new Date(req.startDate).toLocaleDateString('es')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setModal(req.id)} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-lg">
                        Registrar trabajador
                      </button>
                    </td>
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No hay solicitudes asignadas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Modal open={!!modal} onClose={() => setModal(null)} title="Registrar trabajador">
        <div className="space-y-4">
          {['workerName', 'workerDni', 'workerEmail'].map(field => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field === 'workerName' ? 'Nombre' : field === 'workerDni' ? 'DNI' : 'Email (opcional)'}
              </label>
              <input
                value={(form as any)[field]}
                onChange={e => setForm({ ...form, [field]: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={handleRegister} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Registrar
            </button>
            <button onClick={() => setModal(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
