import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../api/client';

interface Asociacion {
  id: string;
  originalCodigo: string;
  fechaAsociacion: string;
  eventosMovidos?: number;
  original: { codigo: string; cliente: string };
  final: { codigo: string; cliente: string };
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const AsociacionBancales: React.FC = () => {
  const [asociaciones, setAsociaciones] = useState<Asociacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [originalCodigo, setOriginalCodigo] = useState('');
  const [finalCodigo, setFinalCodigo] = useState('');
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchAsociaciones = useCallback(() => {
    setLoading(true);
    apiClient.get('/asociaciones')
      .then(({ data }) => setAsociaciones(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAsociaciones(); }, [fetchAsociaciones]);

  const handleAsociar = async () => {
    const orig = originalCodigo.trim().toUpperCase();
    const fin = finalCodigo.trim().toUpperCase();
    if (!orig || !fin) return;
    setWorking(true);
    setMsg(null);
    try {
      const { data } = await apiClient.post('/asociaciones', { originalCodigo: orig, finalCodigo: fin });
      setMsg({
        text: `Asociación creada: ${orig} → ${fin}. ${data.eventosMovidos} movimientos transferidos.`,
        ok: true,
      });
      setOriginalCodigo('');
      setFinalCodigo('');
      fetchAsociaciones();
    } catch (e: any) {
      setMsg({ text: e.response?.data?.error ?? 'Error al crear la asociación', ok: false });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand mb-2">Asociación de bancales</h1>
      <p className="text-sm text-slate-500 mb-6">
        Transfiere el historial de un bancal original (p.ej. etiqueta temporal) a un bancal final (etiqueta definitiva).
        El original queda en baja y sus movimientos anteriores a la asociación pasan al código final.
      </p>

      <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Nueva asociación</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Código original</label>
            <input
              value={originalCodigo}
              onChange={e => setOriginalCodigo(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAsociar()}
              placeholder="Ej. MICH12345678901234567890"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Código final (destino)</label>
            <input
              value={finalCodigo}
              onChange={e => setFinalCodigo(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAsociar()}
              placeholder="Ej. BC001234"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand font-mono"
            />
          </div>
        </div>
        <button
          onClick={handleAsociar}
          disabled={working || !originalCodigo.trim() || !finalCodigo.trim()}
          className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {working ? 'Asociando…' : 'Crear asociación'}
        </button>
        {msg && (
          <p className={`text-sm mt-3 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>
        )}
        <p className="text-xs text-slate-400 mt-3">
          Esta operación es definitiva. El bancal original quedará en baja y sus movimientos anteriores
          a este momento se transferirán al bancal final. Si el bancal final no existe, se creará automáticamente.
        </p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">
            Asociaciones registradas <span className="font-normal text-slate-500">({asociaciones.length})</span>
          </h2>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Cargando...</div>
        ) : asociaciones.length === 0 ? (
          <div className="p-6 text-sm text-slate-400 text-center">Sin asociaciones registradas</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand text-white">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Código original</th>
                <th className="text-left px-4 py-3 font-medium">Código final</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Cliente</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Fecha asociación</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {asociaciones.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-600">{a.original.codigo}</td>
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">{a.final.codigo}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.final.cliente === 'MICHELIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}`}>
                      {a.final.cliente}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">{formatDate(a.fechaAsociacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
