import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Modal } from '../../components/Modal';

type CatalogItem = { id: string; code: string; name: string; description?: string; active: boolean };
type CatalogKey = 'workplaces' | 'contract-types' | 'job-categories' | 'request-reasons' | 'shifts';

const CATALOGS: { key: CatalogKey; label: string }[] = [
  { key: 'workplaces', label: 'Centros de trabajo' },
  { key: 'contract-types', label: 'Tipos de contrato' },
  { key: 'job-categories', label: 'Categorías profesionales' },
  { key: 'request-reasons', label: 'Motivos de solicitud' },
  { key: 'shifts', label: 'Turnos' },
];

export const CatalogsAdmin: React.FC = () => {
  const [active, setActive] = useState<CatalogKey>('workplaces');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [modal, setModal] = useState<CatalogItem | 'new' | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [error, setError] = useState('');

  const load = () => apiClient.get(`/admin/catalogs/${active}`).then(r => setItems(r.data));
  useEffect(() => { load(); }, [active]);

  const handleSave = async () => {
    setError('');
    try {
      if (modal === 'new') {
        await apiClient.post(`/admin/catalogs/${active}`, form);
      } else {
        await apiClient.patch(`/admin/catalogs/${active}/${(modal as CatalogItem).id}`, { name: form.name, description: form.description });
      }
      setModal(null);
      load();
    } catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Catálogos</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATALOGS.map(c => (
          <button key={c.key} onClick={() => setActive(c.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active === c.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:border-blue-400'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({ code: '', name: '', description: '' }); setModal('new'); setError(''); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Nuevo</button>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Código</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Activo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${item.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.active ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { setForm({ code: item.code, name: item.name, description: item.description || '' }); setModal(item); setError(''); }}
                    className="text-blue-600 hover:underline text-xs">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nuevo elemento' : 'Editar elemento'}>
        <div className="space-y-4">
          {modal === 'new' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
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
