import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Request } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export const ValidationInbox: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: 'approve' | 'reject' | 'return'; requestId: string } | null>(null);
  const [comment, setComment] = useState('');

  const load = () => {
    setLoading(true);
    apiClient.get('/validation/pending').then(r => setRequests(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAction = async () => {
    if (!modal) return;
    try {
      if (modal.type === 'approve') {
        await apiClient.post(`/validation/${modal.requestId}/approve`, { comment });
      } else if (modal.type === 'reject') {
        await apiClient.post(`/validation/${modal.requestId}/reject`, { reason: comment });
      } else {
        await apiClient.post(`/validation/${modal.requestId}/return`, { reason: comment });
      }
      setModal(null);
      setComment('');
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Cargando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Bandeja de validación</h1>
      {requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">No hay solicitudes pendientes de validación</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Código</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Solicitante</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Centro</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ETT</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium">{req.code}</td>
                  <td className="px-4 py-3">{(req as any).requester?.name || '—'}</td>
                  <td className="px-4 py-3">{req.workplace?.name || '—'}</td>
                  <td className="px-4 py-3">{req.ett?.name || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => { setModal({ type: 'approve', requestId: req.id }); setComment(''); }}
                      className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded">Aprobar</button>
                    <button onClick={() => { setModal({ type: 'reject', requestId: req.id }); setComment(''); }}
                      className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded">Rechazar</button>
                    <button onClick={() => { setModal({ type: 'return', requestId: req.id }); setComment(''); }}
                      className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded">Devolver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.type === 'approve' ? 'Aprobar solicitud' : modal?.type === 'reject' ? 'Rechazar solicitud' : 'Devolver solicitud'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {modal?.type === 'reject' ? 'Motivo (obligatorio)' : 'Comentario (opcional)'}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAction}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                modal?.type === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                modal?.type === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              Confirmar
            </button>
            <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700">
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
