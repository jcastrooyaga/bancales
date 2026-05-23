import React, { useState, useRef } from 'react';
import { apiClient } from '../api/client';
import { ImportResult } from '../types';

export const Importar: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<ImportResult>('/importar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al importar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Importar fichero Excel</h1>
      <div className="bg-white rounded-xl border p-6">
        <p className="text-sm text-slate-600 mb-4">
          Selecciona el fichero <code className="bg-gray-100 px-1 rounded">.xlsx</code> de lecturas.
          Se espera la hoja <strong>LECTURAS</strong> con columnas:
          BANCAL, CLIENTE, EVENTO, PLAT, LECTURA, USUARIO.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white file:text-sm hover:file:bg-slate-700 cursor-pointer"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Importar'}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {result && (
        <div className="mt-4 bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Resultado de la importación</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{result.importados}</p>
              <p className="text-sm text-green-600 mt-1">Importados</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-yellow-700">{result.duplicados}</p>
              <p className="text-sm text-yellow-600 mt-1">Duplicados</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-red-700">{result.errores.length}</p>
              <p className="text-sm text-red-600 mt-1">Errores</p>
            </div>
          </div>
          {result.errores.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Detalle de errores</h3>
              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y text-sm">
                {result.errores.map((e, i) => (
                  <div key={i} className="px-3 py-2 flex gap-4">
                    <span className="text-slate-400 shrink-0">Fila {e.fila}</span>
                    <span className="text-red-700">{e.motivo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
