import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Request } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export const SupervalidatorView: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: 'approve' | 'reject'; requestId: string } | null>(null);
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    apiClient.get('/supervalidator/requests').then(r => setRequests(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const handleAction = async () => {
    if (!modal) return;
    await apiClient.post(`/supervalidator/${modal.requestId}/${modal.type}`, {
      [modal.type === 'approve' ? 'comment' : 'reason']: comment,
    });
    setModal(null);
    setComment('');
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Supervalidación</h1>
      <div className="mb-4 flex gap-2 flex-wrap">
        {['all', 'SUBMITTED', 'IN_VALIDATION', 'APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'all' ? 'Todas' : s}
          </button>
        ))}
      </div>
      {loading ? <div className="text-center py-8 text-gray-500">Cargando...</div> : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Código</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Solicitante</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ETT</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(req => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium">{req.code}</td>
                  <td className="px-4 py-3">{(req as any).requester?.name || '—'}</td>
                  <td className="px-4 py-3">{req.ett?.name || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => { setModal({ type: 'approve', requestId: req.id }); setComment(''); }}
                      className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded">Aprobar</button>
                    <button onClick={() => { setModal({ type: 'reject', requestId: req.id }); setComment(''); }}
                      className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded">Rechazar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.type === 'approve' ? 'Aprobar' : 'Rechazar'}>
        <div className="space-y-4">
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Comentario..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex gap-3">
            <button onClick={handleAction}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${modal?.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              Confirmar
            </button>
            <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700">Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
