import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { WeekSelector, currentWeek } from '../components/WeekSelector';
import { WeekId, DetalleData, MovimientoItem, BancalSimple, BancalDescuadre } from '../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// â”€â”€â”€ Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ModalProps {
  title: string;
  items: MovimientoItem[];
  onClose: () => void;
}

const MovimientosModal: React.FC<ModalProps> = ({ title, items, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">Ã—</button>
      </div>
      <div className="overflow-y-auto divide-y flex-1 text-sm">
        {items.length === 0 && <p className="px-5 py-4 text-slate-400">Sin registros</p>}
        {items.map((item, i) => (
          <div key={i} className="px-5 py-2.5 flex items-center justify-between gap-3">
            <span className="font-mono font-medium text-slate-800">{item.codigo}</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.cliente === 'MICHELIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}`}>
                {item.cliente === 'MICHELIN' ? 'M' : 'C'}
              </span>
              <span className="text-slate-400 text-xs tabular-nums">
                {new Date(item.lectura).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t text-right text-xs text-slate-400">{items.length} registros</div>
    </div>
  </div>
);

// â”€â”€â”€ Custom X-axis tick with descuadre â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const WeekTick: React.FC<{ x?: number; y?: number; payload?: { value: string }; data: { semana: string; desviacion: number }[] }> = ({ x = 0, y = 0, payload, data }) => {
  const entry = data.find(d => d.semana === payload?.value);
  const desviacion = entry?.desviacion ?? 0;
  const color = desviacion < 0 ? '#dc2626' : desviacion > 0 ? '#16a34a' : '#94a3b8';
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#64748b" fontSize={11}>{payload?.value}</text>
      <text x={0} y={0} dy={26} textAnchor="middle" fill={color} fontSize={10}>
        {desviacion === 0 ? '(0)' : desviacion > 0 ? `(+${desviacion})` : `(${desviacion})`}
      </text>
    </g>
  );
};

// â”€â”€â”€ Bancal list item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BancalRow: React.FC<{ b: BancalSimple; onClick: () => void; extra?: React.ReactNode }> = ({ b, onClick, extra }) => (
  <div
    onClick={onClick}
    className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 gap-2"
  >
    <span className="font-mono font-medium text-slate-800 text-sm">{b.codigo}</span>
    <div className="flex items-center gap-2">
      {extra}
      {b.ultimoTipo && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
          b.ultimoTipo === 'CNTI' ? 'bg-green-100 text-green-700' :
          b.ultimoTipo === 'CNTO' ? 'bg-orange-100 text-orange-700' :
          'bg-blue-100 text-blue-700'
        }`}>{b.ultimoTipo}</span>
      )}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${b.cliente === 'MICHELIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}`}>
        {b.cliente === 'MICHELIN' ? 'M' : 'C'}
      </span>
    </div>
  </div>
);

// â”€â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Props {
  overrideCodigo?: string;
}

export const PlataformaDetalle: React.FC<Props> = ({ overrideCodigo }) => {
  const { codigo: paramCodigo } = useParams<{ codigo: string }>();
  const codigo = overrideCodigo ?? paramCodigo;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initWeek = (): WeekId => {
    const s = searchParams.get('semana');
    const y = searchParams.get('year');
    if (s && y) {
      const w = parseInt(s.replace(/^W/i, ''));
      const yr = parseInt(y);
      if (!isNaN(w) && !isNaN(yr)) return { week: w, year: yr };
    }
    return currentWeek();
  };

  const [week, setWeek] = useState<WeekId>(initWeek);
  const [data, setData] = useState<DetalleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ title: string; items: MovimientoItem[] } | null>(null);

  useEffect(() => {
    if (!codigo) return;
    setLoading(true);
    setError(null);
    apiClient.get<DetalleData>(`/plataformas/${codigo}/detalle`, {
      params: { semana: `W${String(week.week).padStart(2, '0')}`, year: week.year },
    })
      .then(({ data: d }) => setData(d))
      .catch(err => setError(err?.response?.data?.message ?? err?.message ?? 'Error desconocido'))
      .finally(() => setLoading(false));
  }, [codigo, week]);

  const openModal = (title: string, items: MovimientoItem[]) => setModal({ title, items });

  const bancalToMovimiento = (b: BancalSimple): MovimientoItem => ({
    codigo: b.codigo, cliente: b.cliente, lectura: b.ultimaLectura ?? '',
  });

  if (loading) return <div className="text-slate-500 text-sm p-6">Cargando...</div>;
  if (error) return <div className="text-red-600 text-sm p-6">Error: {error}</div>;
  if (!data) return <div className="text-red-600 text-sm p-6">Plataforma no encontrada</div>;

  const { plataforma, historico, resumenSemana: r, bancalesEnPlataforma, sobrantes, descuadre, bancalesRiesgo, umbral } = data;

  const resumenCards = [
    {
      label: 'Inv. anterior',
      value: r.invRealAnterior,
      color: 'bg-slate-50 text-slate-700',
      detail: { title: `Inv. real semana anterior (${r.invRealAnterior})`, items: r.invRealAnteriorDetalle },
    },
    {
      label: 'Entradas',
      value: `+${r.cntiCount}`,
      color: 'bg-green-50 text-green-700',
      detail: { title: `Entradas CNTI (${r.cntiCount})`, items: r.cntiDetalle },
    },
    {
      label: 'Salidas',
      value: `-${r.cntoCount}`,
      color: 'bg-orange-50 text-orange-700',
      detail: { title: `Salidas CNTO (${r.cntoCount})`, items: r.cntoDetalle },
    },
    {
      label: 'Inv. TeÃ³rico',
      value: r.invTeorico,
      color: 'bg-indigo-50 text-indigo-700',
      detail: null, // formula only, no list
    },
    {
      label: 'Inv. Real',
      value: r.invReal,
      color: 'bg-blue-50 text-blue-700',
      detail: { title: `Inventario real CNTS (${r.invReal})`, items: r.invRealDetalle },
    },
    {
      label: 'Diferencia',
      value: r.desviacion === 0 ? '0' : (r.desviacion > 0 ? `+${r.desviacion}` : String(r.desviacion)),
      color: r.desviacion < 0 ? 'bg-red-50 text-red-700' : r.desviacion > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500',
      detail: descuadre.length > 0
        ? { title: `Descuadre â€” bancales no inventariados (${descuadre.length})`, items: descuadre.map(b => ({ codigo: b.codigo, cliente: b.cliente, lectura: b.ultimaLectura ?? '' })) }
        : null,
    },
  ];

  return (
    <div>
      {modal && <MovimientosModal title={modal.title} items={modal.items} onClose={() => setModal(null)} />}

      <div className="flex items-center gap-3 mb-6">
        {!overrideCodigo && (
          <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-800 text-sm">â† Volver</button>
        )}
        <h1 className="text-2xl font-bold text-brand">{plataforma.codigo} Â· {plataforma.nombre}</h1>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{plataforma.pais}</span>
      </div>

      <div className="mb-4">
        <WeekSelector value={week} onChange={setWeek} />
      </div>

      {/* Evolution chart */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">EvoluciÃ³n histÃ³rica (Ãºltimas 12 semanas)</h2>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={historico} margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="semana" tick={(props) => <WeekTick {...props} data={historico} />} height={50} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <ReferenceLine y={0} stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="real" name="Real" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="teorico" name="TeÃ³rico" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen semanal */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Resumen semana</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {resumenCards.map(card => (
            <div
              key={card.label}
              onClick={() => card.detail && openModal(card.detail.title, card.detail.items)}
              className={`rounded-xl p-3 text-center ${card.color} ${card.detail ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            >
              <p className="text-2xl font-bold tabular-nums">{card.value}</p>
              <p className="text-xs mt-1 opacity-75">{card.label}</p>
              {card.detail && <p className="text-xs mt-0.5 opacity-50">Ver detalle</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Bancales en plataforma */}
        <div className="bg-white rounded-xl border flex flex-col">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-slate-700 text-sm">
              Bancales en plataforma ({bancalesEnPlataforma.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Esperados en plataforma en la semana actual</p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y flex-1">
            {bancalesEnPlataforma.length === 0 && <p className="px-4 py-3 text-slate-400 text-sm">Sin bancales</p>}
            {bancalesEnPlataforma.map(b => (
              <BancalRow key={b.id} b={b} onClick={() => navigate(`/bancales/${b.codigo}`)} />
            ))}
          </div>
        </div>

        {/* Descuadre */}
        <div className="bg-white rounded-xl border flex flex-col">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-slate-700 text-sm">
              Descuadre de la semana ({descuadre.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Esperados pero no inventariados</p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y flex-1">
            {descuadre.length === 0 && <p className="px-4 py-3 text-slate-400 text-sm">Sin descuadre</p>}
            {descuadre.map(b => (
              <BancalRow
                key={b.id}
                b={b}
                onClick={() => navigate(`/bancales/${b.codigo}`)}
                extra={
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${b.motivo === 'ANTERIOR' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}`}>
                    {b.motivo === 'ANTERIOR' ? 'INV.ANT' : 'CNTI'}
                  </span>
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* Sobrantes */}
      {sobrantes.length > 0 && (
        <div className="bg-white rounded-xl border flex flex-col mb-6">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-slate-700 text-sm">
              Bancales sobrantes ({sobrantes.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Inventariados pero no esperados</p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y flex-1">
            {sobrantes.map(b => (
              <BancalRow key={b.id} b={b} onClick={() => navigate(`/bancales/${b.codigo}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Bancales en riesgo */}
      <div className="bg-white rounded-xl border mb-6">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-slate-700 text-sm">
            Bancales en riesgo de pÃ©rdida ({bancalesRiesgo.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Sin movimiento en mÃ¡s de {umbral ?? 'â€”'} semanas</p>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y text-sm">
          {bancalesRiesgo.length === 0 && <p className="px-4 py-3 text-slate-400">Ninguno</p>}
          {bancalesRiesgo.map(b => (
            <BancalRow
              key={b.id}
              b={b}
              onClick={() => navigate(`/bancales/${b.codigo}`)}
              extra={
                <span className="text-xs text-slate-500 tabular-nums">
                  {b.ultimaLectura
                    ? `${Math.floor((Date.now() - new Date(b.ultimaLectura).getTime()) / 86400000)}d`
                    : 'Sin lectura'}
                </span>
              }
            />
          ))}
        </div>
      </div>

      {/* Historical table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-slate-700 text-sm">HistÃ³rico semana a semana</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-brand">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-white">Semana</th>
              <th className="text-right px-4 py-2.5 font-medium text-white">Inv. Real</th>
              <th className="text-right px-4 py-2.5 font-medium text-white">Inv. TeÃ³rico</th>
              <th className="text-right px-4 py-2.5 font-medium text-white">DesviaciÃ³n</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...historico].reverse().map(h => (
              <tr key={`${h.year}-${h.semana}`} className={h.desviacion < 0 ? 'bg-red-50' : ''}>
                <td className="px-4 py-2.5 font-mono text-slate-700">{h.semana} Â· {h.year}</td>
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

