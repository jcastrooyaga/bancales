import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { WeekSelector, currentWeek } from '../components/WeekSelector';
import { DashboardData, WeekId } from '../types';

const clienteOptions = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'MICHELIN', label: 'Michelin' },
  { value: 'CONTINENTAL', label: 'Continental' },
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const getUrlWeek = (): WeekId | null => {
    const s = searchParams.get('semana');
    const y = searchParams.get('year');
    if (s && y) {
      const w = parseInt(s.replace(/^W/i, ''));
      const yr = parseInt(y);
      if (!isNaN(w) && !isNaN(yr)) return { week: w, year: yr };
    }
    return null;
  };

  const urlWeek = getUrlWeek();
  const [week, setWeek] = useState<WeekId>(urlWeek ?? currentWeek());
  const [cliente, setCliente] = useState(searchParams.get('cliente') ?? 'TODOS');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekReady, setWeekReady] = useState(!!urlWeek);

  // On first load without URL params, navigate to the last week with CNTS data
  useEffect(() => {
    if (urlWeek) return;
    apiClient.get<{ week: number; year: number }>('/dashboard/ultima-semana')
      .then(({ data: d }) => setWeek({ week: d.week, year: d.year }))
      .catch(() => {})
      .finally(() => setWeekReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDashboard = useCallback(async (w: WeekId, c: string) => {
    setLoading(true);
    try {
      const { data: d } = await apiClient.get<DashboardData>('/dashboard', {
        params: { semana: `W${String(w.week).padStart(2, '0')}`, year: w.year, cliente: c },
      });
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!weekReady) return;
    setSearchParams({ semana: `W${String(week.week).padStart(2, '0')}`, year: String(week.year), cliente });
    fetchDashboard(week, cliente);
  }, [week, cliente, weekReady, fetchDashboard]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-brand">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <WeekSelector value={week} onChange={setWeek} />
          <select
            value={cliente}
            onChange={e => setCliente(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          >
            {clienteOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="text-slate-500 text-sm">Calculando inventarios...</div>}

      {!loading && data && (
        <>
          {/* KPIs */}
          {(() => {
            const totalDesviados = data.plataformas.reduce((sum, f) => sum + f.desviacion, 0);
            return (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                {[
                  { label: 'En circuito', value: data.kpis.totalEnCircuito, color: 'bg-slate-700 text-white' },
                  { label: 'Michelin', value: data.kpis.totalMichelin, color: 'bg-blue-600 text-white' },
                  { label: 'Continental', value: data.kpis.totalContinental, color: 'bg-orange-500 text-white' },
                  { label: 'Bancales desv.', value: totalDesviados, color: 'bg-red-800 text-white' },
                  { label: 'En riesgo', value: data.kpis.totalRiesgo, color: 'bg-yellow-400 text-red-900' },
                  { label: 'Plat. con desv.', value: data.kpis.plataformasDesviacion, color: 'bg-white text-red-800 ring-2 ring-red-800' },
                ].map(k => (
                  <div key={k.label} className={`rounded-xl p-4 ${k.color}`}>
                    <p className="text-2xl font-bold">{k.value}</p>
                    <p className="text-xs mt-1 opacity-80">{k.label}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Platform table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-brand">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-white">Plataforma</th>
                  <th className="text-right px-4 py-3 font-medium text-white">Inv. Real</th>
                  <th className="text-right px-4 py-3 font-medium text-white">Inv. Teórico</th>
                  <th className="text-right px-4 py-3 font-medium text-white">Desviación</th>
                  <th className="text-right px-4 py-3 font-medium text-white">% Error</th>
                  <th className="text-right px-4 py-3 font-medium text-white">En riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.plataformas.map(fila => (
                  <tr
                    key={fila.plataforma.id}
                    onClick={() => navigate(`/plataforma/${fila.plataforma.codigo}`)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${fila.invReal === 0 ? 'bg-red-50 hover:bg-red-100' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{fila.plataforma.codigo}</span>
                      <span className="text-slate-500 ml-2 text-xs">{fila.plataforma.nombre}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fila.invReal}</td>
                    <td className="px-4 py-3 text-right font-mono">{fila.invTeorico}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      <span className={fila.desviacion < 0 ? 'text-red-600' : fila.desviacion > 0 ? 'text-green-600' : 'text-slate-500'}>
                        {fila.desviacion > 0 ? '+' : ''}{fila.desviacion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {(() => {
                        const denom = fila.prevReal + fila.cntiCount + fila.cntoCount;
                        if (denom === 0) return <span className="text-slate-400">—</span>;
                        const pct = (Math.abs(fila.desviacion) / denom * 100).toFixed(0);
                        return <span className={fila.desviacion !== 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>{pct}%</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fila.bancalesRiesgo > 0 ? (
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">{fila.bancalesRiesgo}</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

