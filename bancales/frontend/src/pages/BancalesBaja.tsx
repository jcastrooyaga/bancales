import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

interface BancalBaja {
  id: string;
  codigo: string;
  cliente: string;
  ultimaLectura: string | null;
  diasSinLectura: number | null;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const BancalesBaja: React.FC = () => {
  const navigate = useNavigate();
  const [bajas, setBajas] = useState<BancalBaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [working, setWorking] = useState(false);

  const fetchBajas = useCallback(() => {
    setLoading(true);
    apiClient.get('/bancales?estado=baja')
      .then(({ data }) => setBajas(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBajas(); }, [fetchBajas]);

  const handleDarDeBaja = async () => {
    const codigo = search.trim().toUpperCase();
    if (!codigo) return;
    setWorking(true);
    setMsg(null);
    try {
      await apiClient.patch(`/bancales/${codigo}/desactivar`);
      setMsg({ text: `Bancal ${codigo} dado de baja correctamente.`, ok: true });
      setSearch('');
      fetchBajas();
    } catch (e: any) {
      setMsg({ text: e.response?.data?.error ?? 'Error al dar de baja', ok: false });
    } finally {
      setWorking(false);
    }
  };

  const handleReactivar = async (codigo: string) => {
    setWorking(true);
    setMsg(null);
    try {
      await apiClient.patch(`/bancales/${codigo}/activar`);
      setMsg({ text: `Bancal ${codigo} reactivado correctamente.`, ok: true });
      fetchBajas();
    } catch (e: any) {
      setMsg({ text: e.response?.data?.error ?? 'Error al reactivar', ok: false });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand mb-6">Bajas de Bancales</h1>

      <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Dar de baja manualmente</h2>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDarDeBaja()}
            placeholder="Código de bancal (ej. BC00001)"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          <button
            onClick={handleDarDeBaja}
            disabled={working || !search.trim()}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            Dar de baja
          </button>
        </div>
        {msg && (
          <p className={`text-sm mt-2 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>
        )}
        <p className="text-xs text-slate-400 mt-2">
          El bancal se reactivará automáticamente si vuelve a ser leído en cualquier plataforma.
        </p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">
            Bancales dados de baja <span className="font-normal text-slate-500">({bajas.length})</span>
          </h2>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Cargando...</div>
        ) : bajas.length === 0 ? (
          <div className="p-6 text-sm text-slate-400 text-center">Sin bancales dados de baja</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand text-white">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Código</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Cliente</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Última lectura</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Días sin lectura</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bajas.map(b => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td
                    className="px-4 py-3 font-mono font-medium text-slate-800 cursor-pointer hover:text-brand"
                    onClick={() => navigate(`/bancales/${b.codigo}`)}
                  >
                    {b.codigo}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{b.cliente}</td>
                  <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{formatDate(b.ultimaLectura)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">
                    {b.diasSinLectura !== null ? `${b.diasSinLectura} días` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleReactivar(b.codigo)}
                      disabled={working}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      Reactivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
