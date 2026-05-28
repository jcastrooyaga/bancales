import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Bancal } from '../types';

export const Bancales: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPlataforma = user?.role === 'PLATAFORMA';
  const [bancales, setBancales] = useState<Bancal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cliente, setCliente] = useState('');
  const [estado, setEstado] = useState('');

  const fetchBancales = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (cliente) params.cliente = cliente;
      if (estado) params.estado = estado;
      const { data } = await apiClient.get<Bancal[]>('/bancales', { params });
      setBancales(data);
    } finally {
      setLoading(false);
    }
  }, [q, cliente, estado]);

  useEffect(() => { fetchBancales(); }, [fetchBancales]);

  const exportCSV = () => {
    const headers = ['Código', 'Cliente', 'Plataforma', 'Última lectura', 'Días sin lectura', 'Estado'];
    const rows = bancales.map(b => [
      b.codigo,
      b.cliente,
      b.plataformaActual ? `${b.plataformaActual.codigo} · ${b.plataformaActual.nombre}` : '',
      b.ultimaLectura ? new Date(b.ultimaLectura).toLocaleString('es-ES') : '',
      b.diasSinLectura ?? '',
      b.enBaja ? 'Baja' : b.enRiesgo ? 'En riesgo' : 'Activo',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bancales_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brand">
          {isPlataforma ? `Bancales — ${user?.plataformaCodigo}` : 'Listado de bancales'}
        </h1>
        <button
          onClick={exportCSV}
          disabled={loading || bancales.length === 0}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
        >
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar código..."
          value={q}
          onChange={e => setQ(e.target.value.toUpperCase())}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-44"
        />
        <select
          value={cliente}
          onChange={e => setCliente(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">Todos los clientes</option>
          <option value="MICHELIN">Michelin</option>
          <option value="CONTINENTAL">Continental</option>
        </select>
        <select
          value={estado}
          onChange={e => setEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="riesgo">En riesgo</option>
          <option value="baja">Baja</option>
        </select>
      </div>

      {loading && <div className="text-slate-500 text-sm">Cargando...</div>}

      {!loading && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-2 border-b bg-gray-50 text-xs text-slate-500">
            {bancales.length} bancales
          </div>
          <table className="w-full text-sm">
            <thead className="bg-brand">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-white">Código</th>
                <th className="text-left px-4 py-3 font-medium text-white">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-white">Plataforma actual</th>
                <th className="text-left px-4 py-3 font-medium text-white">Última lectura</th>
                <th className="text-right px-4 py-3 font-medium text-white">Días sin lectura</th>
                <th className="text-left px-4 py-3 font-medium text-white">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bancales.map(b => (
                <tr
                  key={b.id}
                  onClick={() => navigate(`/bancales/${b.codigo}`)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono font-medium text-slate-800">{b.codigo}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.cliente === 'MICHELIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}`}>
                      {b.cliente}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {b.plataformaActual ? `${b.plataformaActual.codigo} · ${b.plataformaActual.nombre}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {b.ultimaLectura ? new Date(b.ultimaLectura).toLocaleString('es-ES') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                    {b.diasSinLectura ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {b.enBaja ? (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Baja</span>
                    ) : b.enRiesgo ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">En riesgo</span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

