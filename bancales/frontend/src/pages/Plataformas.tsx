import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Plataforma } from '../types';

export const Plataformas: React.FC = () => {
  const navigate = useNavigate();
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ codigo: '', nombre: '', pais: 'ES' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [error, setError] = useState('');
  const [pwCodigo, setPwCodigo] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  const fetchPlataformas = () =>
    apiClient.get<Plataforma[]>('/plataformas').then(({ data }) => setPlataformas(data));

  useEffect(() => { fetchPlataformas(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiClient.post('/plataformas', form);
      setForm({ codigo: '', nombre: '', pais: 'ES' });
      setShowForm(false);
      fetchPlataformas();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al crear';
      setError(msg);
    }
  };

  const handleToggle = async (p: Plataforma) => {
    await apiClient.put(`/plataformas/${p.id}`, { activa: !p.activa });
    fetchPlataformas();
  };

  const handleEdit = async (id: string) => {
    await apiClient.put(`/plataformas/${id}`, { nombre: editNombre });
    setEditId(null);
    fetchPlataformas();
  };

  const handlePwChange = async (codigo: string) => {
    if (!pwValue || pwValue.length < 4) { setPwMsg('MÃ­nimo 4 caracteres'); return; }
    setPwSaving(true);
    setPwMsg('');
    try {
      await apiClient.put(`/plataformas/${codigo}/password`, { password: pwValue });
      setPwCodigo(null);
      setPwValue('');
      setPwMsg('');
    } catch {
      setPwMsg('Error al cambiar contraseÃ±a');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand">GestiÃ³n de plataformas</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Nueva plataforma
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-600 mb-1">CÃ³digo</label>
            <input
              value={form.codigo}
              onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
              placeholder="ESXXX"
              maxLength={6}
              className="w-24 border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Nombre</label>
            <input
              value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ciudad"
              className="w-40 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">PaÃ­s</label>
            <select
              value={form.pais}
              onChange={e => setForm(p => ({ ...p, pais: e.target.value }))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
            >
              <option value="ES">ES</option>
              <option value="PT">PT</option>
            </select>
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm">Crear</button>
          <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 px-3 py-1.5 text-sm">Cancelar</button>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-white">CÃ³digo</th>
              <th className="text-left px-4 py-3 font-medium text-white">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-white">PaÃ­s</th>
              <th className="text-left px-4 py-3 font-medium text-white">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-white">ContraseÃ±a</th>
              <th className="text-left px-4 py-3 font-medium text-white">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {plataformas.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td
                  className="px-4 py-3 font-mono font-medium text-blue-700 cursor-pointer hover:underline"
                  onClick={() => navigate(`/plataforma/${p.codigo}`)}
                >
                  {p.codigo}
                </td>
                <td className="px-4 py-3">
                  {editId === p.id ? (
                    <div className="flex gap-2">
                      <input
                        value={editNombre}
                        onChange={e => setEditNombre(e.target.value)}
                        className="border rounded px-2 py-1 text-sm w-40 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleEdit(p.id)} className="text-green-600 text-xs font-medium">OK</button>
                      <button onClick={() => setEditId(null)} className="text-slate-400 text-xs">âœ•</button>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer hover:text-blue-600"
                      onClick={() => { setEditId(p.id); setEditNombre(p.nombre); }}
                    >
                      {p.nombre}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{p.pais}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {pwCodigo === p.codigo ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="password"
                        value={pwValue}
                        onChange={e => setPwValue(e.target.value)}
                        placeholder="Nueva contraseÃ±a"
                        className="border rounded px-2 py-1 text-xs w-36 focus:outline-none"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handlePwChange(p.codigo)}
                      />
                      <button onClick={() => handlePwChange(p.codigo)} disabled={pwSaving} className="text-green-600 text-xs font-medium">OK</button>
                      <button onClick={() => { setPwCodigo(null); setPwValue(''); setPwMsg(''); }} className="text-slate-400 text-xs">âœ•</button>
                      {pwMsg && <span className="text-red-500 text-xs">{pwMsg}</span>}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setPwCodigo(p.codigo); setPwValue(''); setPwMsg(''); }}
                      className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      Cambiar
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(p)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {p.activa ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

