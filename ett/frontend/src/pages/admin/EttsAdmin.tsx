import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Ett } from '../../types';
import { Modal } from '../../components/Modal';

export const EttsAdmin: React.FC = () => {
  const [etts, setEtts] = useState<Ett[]>([]);
  const [modal, setModal] = useState<Ett | 'new' | null>(null);
  const [form, setForm] = useState({ code: '', name: '', contactEmail: '' });
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');

  const load = () => apiClient.get('/admin/etts').then(r => setEtts(r.data));
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setError('');
    try {
      if (modal === 'new') {
        await apiClient.post('/admin/etts', form);
      } else {
        await apiClient.patch(`/admin/etts/${(modal as Ett).id}`, form);
      }
      setModal(null);
      load();
    } catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  };

  const addEmail = async (ettId: string) => {
    if (!newEmail) return;
    await apiClient.post(`/admin/etts/${ettId}/routing`, { email: newEmail });
    setNewEmail('');
    load();
  };

  const removeEmail = async (ettId: string, routingId: string) => {
    await apiClient.delete(`/admin/etts/${ettId}/routing/${routingId}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ETTs</h1>
        <button onClick={() => { setForm({ code: '', name: '', contactEmail: '' }); setModal('new'); setError(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Nueva ETT</button>
      </div>
      <div className="space-y-4">
        {etts.map(ett => (
          <div key={ett.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-semibold">{ett.name}</span>
                <span className="text-gray-400 text-xs ml-2">{ett.code}</span>
              </div>
              <button onClick={() => { setForm({ code: ett.code, name: ett.name, contactEmail: ett.contactEmail || '' }); setModal(ett); setError(''); }}
                className="text-blue-600 hover:underline text-xs">Editar</button>
            </div>
            <div className="text-sm text-gray-600 mb-3">Emails de notificación:</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {ett.emailRouting?.map(r => (
                <span key={r.id} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs">
                  {r.email}
                  <button onClick={() => removeEmail(ett.id, r.id)} className="text-red-400 hover:text-red-600 ml-1">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Nuevo email..."
                className="border border-gray-300 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={() => addEmail(ett.id)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-xs">Añadir</button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nueva ETT' : 'Editar ETT'}>
        <div className="space-y-4">
          {[['Código', 'code'], ['Nombre', 'name'], ['Email de contacto', 'contactEmail']].map(([label, field]) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input value={(form as any)[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Guardar</button>
            <button onClick={() => setModal(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
