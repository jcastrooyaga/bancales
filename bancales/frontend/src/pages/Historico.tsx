import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { HistoricoItem, Plataforma } from '../types';

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const tipoColor: Record<string, string> = {
  CNTI: 'bg-green-100 text-green-700',
  CNTO: 'bg-orange-100 text-orange-700',
  CNTS: 'bg-blue-100 text-blue-700',
};

const exportarCSV = (rows: HistoricoItem[], label: string) => {
  const headers = ['Fecha', 'Código', 'Cliente', 'Evento', 'Plataforma', 'Usuario'];
  const lines = [
    headers.join(';'),
    ...rows.map(r => [
      fmtFecha(r.fecha),
      r.codigo,
      r.cliente,
      r.evento,
      r.plataforma,
      r.usuario,
    ].join(';')),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico${label ? '_' + label : ''}_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const Historico: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [items, setItems] = useState<HistoricoItem[]>([]);
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
  const [plataformaId, setPlataformaId] = useState('');
  const [desde, setDesde] = useState(daysAgo(30));
  const [hasta, setHasta] = useState(today());
  const [tipo, setTipo] = useState('');
  const [cliente, setCliente] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      apiClient.get<Plataforma[]>('/plataformas').then(({ data }) => setPlataformas(data));
    }
  }, [isAdmin]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { desde, hasta };
    if (isAdmin && plataformaId) params.plataformaId = plataformaId;
    if (tipo) params.tipo = tipo;
    if (cliente) params.cliente = cliente;
    apiClient.get<HistoricoItem[]>('/historico', { params })
      .then(({ data }) => setItems(data))
      .catch(err => setError(err?.response?.data?.message ?? err?.message ?? 'Error'))
      .finally(() => setLoading(false));
  }, [isAdmin, plataformaId, desde, hasta, tipo, cliente]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedPlat = plataformas.find(p => p.id === plataformaId);
  const exportLabel = isAdmin ? (selectedPlat?.codigo ?? 'todas') : (user?.username ?? '');

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Histórico</h1>
        </div>
        <button
          onClick={() => exportarCSV(items, exportLabel)}
          disabled={items.length === 0}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Desde</label>
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={e => setDesde(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Hasta</label>
          <input
            type="date"
            value={hasta}
            min={desde}
            max={today()}
            onChange={e => setHasta(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Evento</label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
          >
            <option value="">Todos</option>
            <option value="CNTI">CNTI</option>
            <option value="CNTO">CNTO</option>
            <option value="CNTS">CNTS</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Cliente</label>
          <select
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
          >
            <option value="">Todos</option>
            <option value="MICHELIN">Michelin</option>
            <option value="CONTINENTAL">Continental</option>
          </select>
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Plataforma</label>
            <select
              value={plataformaId}
              onChange={e => setPlataformaId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white w-52"
            >
              <option value="">Todas</option>
              {plataformas.map(p => (
                <option key={p.id} value={p.id}>{p.codigo} — {p.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <p className="text-slate-500 text-sm py-6">Cargando...</p>}
      {error && <p className="text-red-600 text-sm py-6">Error: {error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b">
            <span className="text-sm text-slate-500">{items.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-white whitespace-nowrap">Fecha</th>
                  <th className="text-left px-4 py-2.5 font-medium text-white">Código</th>
                  <th className="text-left px-4 py-2.5 font-medium text-white">Cliente</th>
                  <th className="text-left px-4 py-2.5 font-medium text-white">Evento</th>
                  {isAdmin && <th className="text-left px-4 py-2.5 font-medium text-white">Plataforma</th>}
                  <th className="text-left px-4 py-2.5 font-medium text-white">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-4 py-6 text-slate-400 text-center">
                      Sin movimientos para los filtros seleccionados
                    </td>
                  </tr>
                )}
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap text-xs">
                      {fmtFecha(item.fecha)}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-800">{item.codigo}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.cliente === 'MICHELIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}`}>
                        {item.cliente === 'MICHELIN' ? 'M' : 'C'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${tipoColor[item.evento] ?? 'bg-gray-100 text-gray-600'}`}>
                        {item.evento}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2.5 font-mono text-slate-600 text-xs">{item.plataforma}</td>
                    )}
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{item.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

