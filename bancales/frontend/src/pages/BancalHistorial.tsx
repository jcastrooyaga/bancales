import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Bancal, Evento } from '../types';

interface HistorialData {
  bancal: Bancal & { plataformaActual?: { codigo: string; nombre: string } | null };
  eventos: Evento[];
}

const tipoColor: Record<string, string> = {
  CNTI: 'bg-green-100 text-green-700',
  CNTO: 'bg-red-100 text-red-700',
  CNTS: 'bg-blue-100 text-blue-700',
};

export const BancalHistorial: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<HistorialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codigo) return;
    apiClient.get<HistorialData>(`/bancales/${codigo}/historial`)
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false));
  }, [codigo]);

  if (loading) return <div className="text-slate-500 text-sm">Cargando...</div>;
  if (!data) return <div className="text-red-600 text-sm">Bancal no encontrado</div>;

  const { bancal, eventos } = data;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-800 text-sm">← Volver</button>
        <h1 className="text-2xl font-bold text-brand font-mono">{bancal.codigo}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${bancal.cliente === 'MICHELIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}`}>
          {bancal.cliente}
        </span>
        {bancal.enRiesgo && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">En riesgo</span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500">Plataforma actual</p>
          <p className="font-medium text-slate-800 mt-1">
            {bancal.plataformaActual ? `${bancal.plataformaActual.codigo} · ${bancal.plataformaActual.nombre}` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500">Última lectura</p>
          <p className="font-medium text-slate-800 mt-1">
            {bancal.ultimaLectura ? new Date(bancal.ultimaLectura).toLocaleString('es-ES') : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500">Días sin lectura</p>
          <p className="font-medium text-slate-800 mt-1">{bancal.diasSinLectura ?? '—'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-slate-700 text-sm">Historial de eventos ({eventos.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-brand">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-white">Fecha y hora</th>
              <th className="text-left px-4 py-2.5 font-medium text-white">Tipo</th>
              <th className="text-left px-4 py-2.5 font-medium text-white">Plataforma</th>
              <th className="text-left px-4 py-2.5 font-medium text-white">Operario</th>
              <th className="text-left px-4 py-2.5 font-medium text-white">Fuente</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {eventos.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-slate-600 text-xs font-mono">
                  {new Date(e.lectura).toLocaleString('es-ES')}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tipoColor[e.tipo] ?? ''}`}>
                    {e.tipo}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {e.plataforma ? `${e.plataforma.codigo} · ${e.plataforma.nombre}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{e.usuario}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs ${e.fuente === 'MANUAL' ? 'text-amber-600' : 'text-slate-400'}`}>
                    {e.fuente}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

