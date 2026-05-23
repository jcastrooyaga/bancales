import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { WeekSelector, currentWeek } from '../components/WeekSelector';
import { WeekId, Plataforma, Bancal } from '../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface HistoricoItem {
  semana: string;
  year: number;
  real: number;
  teorico: number;
  desviacion: number;
}

interface DetalleData {
  plataforma: Plataforma;
  historico: HistoricoItem[];
  bancalesActuales: Bancal[];
  bancalesRiesgo: Bancal[];
}

export const PlataformaDetalle: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const [week, setWeek] = useState<WeekId>(currentWeek());
  const [data, setData] = useState<DetalleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!codigo) return;
    setLoading(true);
    apiClient.get(`/plataformas/${codigo}/detalle`, {
      params: { semana: `W${String(week.week).padStart(2, '0')}`, year: week.year },
    }).then(({ data: d }) => setData(d))
      .finally(() => setLoading(false));
  }, [codigo, week]);

  if (loading) return <div className="text-slate-500 text-sm">Cargando...</div>;
  if (!data) return <div className="text-red-600 text-sm">Plataforma no encontrada</div>;

  const { plataforma, historico, bancalesActuales, bancalesRiesgo } = data;
  const current = historico[historico.length - 1];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-800 text-sm">← Volver</button>
        <h1 className="text-2xl font-bold text-slate-800">{plataforma.codigo} · {plataforma.nombre}</h1>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{plataforma.pais}</span>
      </div>

      <div className="mb-4">
        <WeekSelector value={week} onChange={setWeek} />
      </div>

      {/* Current week KPIs */}
      {current && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-700">{current.real}</p>
            <p className="text-xs text-blue-600 mt-1">Inventario Real</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-slate-700">{current.teorico}</p>
            <p className="text-xs text-slate-600 mt-1">Inventario Teórico</p>
          </div>
          <div className={`rounded-xl p-4 text-center ${current.desviacion < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className={`text-3xl font-bold ${current.desviacion < 0 ? 'text-red-700' : 'text-green-700'}`}>
              {current.desviacion > 0 ? '+' : ''}{current.desviacion}
            </p>
            <p className={`text-xs mt-1 ${current.desviacion < 0 ? 'text-red-600' : 'text-green-600'}`}>Desviación</p>
          </div>
        </div>
      )}

      {/* Evolution chart */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Evolución histórica (últimas 12 semanas)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={historico}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="real" name="Real" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="teorico" name="Teórico" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Bancales actuales */}
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-slate-700 text-sm">Bancales en plataforma ({bancalesActuales.length})</h2>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y text-sm">
            {bancalesActuales.length === 0 && <p className="px-4 py-3 text-slate-400">Sin bancales</p>}
            {bancalesActuales.map(b => (
              <div
                key={b.id}
                onClick={() => navigate(`/bancales/${b.codigo}`)}
                className="px-4 py-2.5 flex justify-between cursor-pointer hover:bg-gray-50"
              >
                <span className="font-mono font-medium text-slate-800">{b.codigo}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.cliente === 'MICHELIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}`}>
                  {b.cliente === 'MICHELIN' ? 'M' : 'C'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bancales en riesgo */}
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-slate-700 text-sm">
              Bancales en riesgo de pérdida ({bancalesRiesgo.length})
            </h2>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y text-sm">
            {bancalesRiesgo.length === 0 && <p className="px-4 py-3 text-slate-400">Ninguno</p>}
            {bancalesRiesgo.map(b => (
              <div
                key={b.id}
                onClick={() => navigate(`/bancales/${b.codigo}`)}
                className="px-4 py-2.5 flex justify-between cursor-pointer hover:bg-gray-50"
              >
                <span className="font-mono font-medium text-slate-800">{b.codigo}</span>
                <span className="text-xs text-slate-500">
                  {b.ultimaLectura
                    ? `${Math.floor((Date.now() - new Date(b.ultimaLectura).getTime()) / 86400000)}d`
                    : 'Sin lectura'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Historical table */}
      <div className="mt-6 bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-slate-700 text-sm">Histórico semana a semana</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Semana</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">Inv. Real</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">Inv. Teórico</th>
              <th className="text-right px-4 py-2.5 font-medium text-slate-600">Desviación</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...historico].reverse().map(h => (
              <tr key={`${h.year}-${h.semana}`} className={h.desviacion < 0 ? 'bg-red-50' : ''}>
                <td className="px-4 py-2.5 font-mono text-slate-700">{h.semana} · {h.year}</td>
                <td className="px-4 py-2.5 text-right font-mono">{h.real}</td>
                <td className="px-4 py-2.5 text-right font-mono">{h.teorico}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold">
                  <span className={h.desviacion < 0 ? 'text-red-600' : h.desviacion > 0 ? 'text-green-600' : 'text-slate-400'}>
                    {h.desviacion > 0 ? '+' : ''}{h.desviacion}
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
