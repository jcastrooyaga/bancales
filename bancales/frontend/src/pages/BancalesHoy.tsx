import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

interface BancalHoy {
  id: string;
  codigo: string;
  cliente: string;
  ultimoTipo: string;
  ultimaLectura: string;
}

interface FilaHoy {
  plataforma: { id: string; codigo: string; nombre: string; pais: string };
  count: number;
  ultimaLectura: string | null;
  bancales: BancalHoy[];
}

const TIPO_LABEL: Record<string, string> = { CNTS: 'Inventario', CNTI: 'Entrada' };
const TIPO_COLOR: Record<string, string> = {
  CNTS: 'bg-slate-100 text-slate-700',
  CNTI: 'bg-green-100 text-green-700',
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const BancalesHoy: React.FC = () => {
  const [plataformas, setPlataformas] = useState<FilaHoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/hoy')
      .then(({ data }) => setPlataformas(data.plataformas))
      .catch(() => setError('Error al cargar los datos'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500 text-sm">Cargando...</div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  const total = plataformas.reduce((sum, f) => sum + f.count, 0);

  return (
    <div>
      <div className="flex items-baseline gap-4 mb-6">
        <h1 className="text-2xl font-bold text-brand">Bancales hoy</h1>
        <span className="text-sm text-slate-500">{total} bancales en circuito</span>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand text-white">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Plataforma</th>
              <th className="text-right px-4 py-3 font-medium">Bancales</th>
              <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Última lectura</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {plataformas.map(fila => {
              const isOpen = expanded === fila.plataforma.id;
              return (
                <React.Fragment key={fila.plataforma.id}>
                  <tr
                    className="border-t cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : fila.plataforma.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-brand">{fila.plataforma.codigo}</span>
                      <span className="text-slate-500 ml-2 hidden sm:inline">{fila.plataforma.nombre}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{fila.count}</td>
                    <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{formatDate(fila.ultimaLectura)}</td>
                    <td className="px-4 py-3 text-center text-slate-400 text-xs select-none">{isOpen ? '▲' : '▼'}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50 border-t px-6 py-3">
                        {fila.bancales.length === 0 ? (
                          <p className="text-slate-400 text-sm text-center py-2">Sin bancales registrados</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500 border-b">
                                <th className="text-left pb-2 font-medium">Bancal</th>
                                <th className="text-left pb-2 font-medium">Cliente</th>
                                <th className="text-center pb-2 font-medium">Tipo movimiento</th>
                                <th className="text-right pb-2 font-medium">Fecha lectura</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fila.bancales.map(b => (
                                <tr key={b.id} className="border-b last:border-0">
                                  <td className="py-1.5 font-mono font-medium text-slate-800">{b.codigo}</td>
                                  <td className="py-1.5 text-slate-600">{b.cliente}</td>
                                  <td className="py-1.5 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded font-medium ${TIPO_COLOR[b.ultimoTipo] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {TIPO_LABEL[b.ultimoTipo] ?? b.ultimoTipo}
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-right text-slate-500">{formatDate(b.ultimaLectura)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
