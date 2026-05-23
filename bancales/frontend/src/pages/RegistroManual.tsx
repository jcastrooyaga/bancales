import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { Plataforma } from '../types';

export const RegistroManual: React.FC = () => {
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [form, setForm] = useState({
    codigoBancal: '',
    tipo: 'CNTI',
    codigoPlataforma: '',
    lectura: new Date().toISOString().slice(0, 16),
    usuario: '',
  });
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get<Plataforma[]>('/plataformas').then(({ data }) =>
      setPlataformas(data.filter(p => p.activa))
    );
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setOk(false);
    setError('');
    try {
      await apiClient.post('/eventos', {
        ...form,
        codigoBancal: form.codigoBancal.toUpperCase(),
        lectura: new Date(form.lectura).toISOString(),
      });
      setOk(true);
      setForm(prev => ({ ...prev, codigoBancal: '', usuario: '' }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al registrar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Registro manual de evento</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Código bancal</label>
          <input
            name="codigoBancal"
            value={form.codigoBancal}
            onChange={handleChange}
            placeholder="BC001234 / CAT001234"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 font-mono uppercase"
            required
          />
          <p className="text-xs text-slate-500 mt-1">Prefijo BC = Michelin · CAT = Continental</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de evento</label>
          <select
            name="tipo"
            value={form.tipo}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="CNTI">CNTI — Entrada</option>
            <option value="CNTO">CNTO — Salida</option>
            <option value="CNTS">CNTS — Inventario</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Plataforma</label>
          <select
            name="codigoPlataforma"
            value={form.codigoPlataforma}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
            required
          >
            <option value="">Seleccionar plataforma...</option>
            {plataformas.map(p => (
              <option key={p.id} value={p.codigo}>{p.codigo} · {p.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha y hora de lectura</label>
          <input
            type="datetime-local"
            name="lectura"
            value={form.lectura}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Operario / Usuario</label>
          <input
            name="usuario"
            value={form.usuario}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
            required
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {ok && <p className="text-green-600 text-sm">Evento registrado correctamente.</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Registrando...' : 'Registrar evento'}
        </button>
      </form>
    </div>
  );
};
