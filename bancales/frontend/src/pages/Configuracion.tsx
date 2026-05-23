import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

export const Configuracion: React.FC = () => {
  const [umbral, setUmbral] = useState('4');
  const [ventana, setVentana] = useState('180');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/configuracion').then(({ data }) => {
      setUmbral(data.umbral_bancal_perdido_semanas ?? '4');
      setVentana(data.ventana_deduplicacion_minutos ?? '180');
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setOk(false);
    setError('');
    try {
      await apiClient.put('/configuracion', {
        umbral_bancal_perdido_semanas: parseInt(umbral),
        ventana_deduplicacion_minutos: parseInt(ventana),
      });
      setOk(true);
    } catch {
      setError('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 text-sm">Cargando...</div>;

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Parámetros del sistema</h1>
      <form onSubmit={handleSave} className="bg-white rounded-xl border p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Umbral bancal perdido (semanas)
          </label>
          <input
            type="number"
            min={1}
            max={52}
            value={umbral}
            onChange={e => setUmbral(e.target.value)}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Semanas sin lectura para considerar un bancal en riesgo de pérdida.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ventana de deduplicación (minutos)
          </label>
          <input
            type="number"
            min={1}
            max={10080}
            value={ventana}
            onChange={e => setVentana(e.target.value)}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Margen de tiempo para considerar dos lecturas iguales como duplicado.
          </p>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {ok && <p className="text-green-600 text-sm">Configuración guardada correctamente.</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  );
};
