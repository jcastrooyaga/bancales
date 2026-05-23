import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type VaciarStep = 'idle' | 'confirm1' | 'confirm2';

export const Configuracion: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Admin: system params
  const [umbral, setUmbral] = useState('4');
  const [ventana, setVentana] = useState('180');
  const [loading, setLoading] = useState(isAdmin);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');

  // Danger zone
  const [vaciarStep, setVaciarStep] = useState<VaciarStep>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [vaciarLoading, setVaciarLoading] = useState(false);
  const [vaciarOk, setVaciarOk] = useState(false);
  const [vaciarError, setVaciarError] = useState('');

  // Platform user: change password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    apiClient.get('/configuracion').then(({ data }) => {
      setUmbral(data.umbral_bancal_perdido_semanas ?? '4');
      setVentana(data.ventana_deduplicacion_minutos ?? '180');
    }).finally(() => setLoading(false));
  }, [isAdmin]);

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

  const handleVaciar = async () => {
    setVaciarLoading(true);
    setVaciarError('');
    try {
      await apiClient.delete('/configuracion/vaciar-bd');
      setVaciarOk(true);
      setVaciarStep('idle');
      setConfirmText('');
    } catch {
      setVaciarError('Error al vaciar la base de datos');
    } finally {
      setVaciarLoading(false);
    }
  };

  const cancelVaciar = () => {
    setVaciarStep('idle');
    setConfirmText('');
    setVaciarError('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwOk(false);
    if (newPassword !== confirmPassword) { setPwError('Las contraseñas no coinciden'); return; }
    if (newPassword.length < 4) { setPwError('La contraseña debe tener al menos 4 caracteres'); return; }
    setPwSaving(true);
    try {
      await apiClient.put('/auth/me/password', { password: newPassword });
      setPwOk(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPwError('Error al cambiar la contraseña');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 text-sm">Cargando...</div>;

  // Platform user view: only password change
  if (!isAdmin) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Configuración</h1>
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Cambiar contraseña</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                required
              />
            </div>
            {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
            {pwOk && <p className="text-green-600 text-sm">Contraseña actualizada correctamente.</p>}
            <button
              type="submit"
              disabled={pwSaving}
              className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {pwSaving ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Admin view: system params + danger zone
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

      {/* Zona peligrosa */}
      <div className="mt-8 bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-sm font-semibold text-red-700 mb-1">Zona peligrosa</h2>
        <p className="text-xs text-slate-500 mb-4">
          Elimina todos los bancales y eventos de la base de datos. Esta acción es irreversible.
        </p>

        {vaciarOk && <p className="text-green-600 text-sm mb-3">Base de datos vaciada correctamente.</p>}
        {vaciarError && <p className="text-red-600 text-sm mb-3">{vaciarError}</p>}

        {vaciarStep === 'idle' && (
          <button
            onClick={() => setVaciarStep('confirm1')}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Vaciar base de datos
          </button>
        )}

        {vaciarStep === 'confirm1' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              ¿Seguro que quieres eliminar todos los bancales y eventos? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setVaciarStep('confirm2'); setConfirmText(''); }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Sí, continuar
              </button>
              <button
                onClick={cancelVaciar}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {vaciarStep === 'confirm2' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Escribe <strong>eliminar</strong> para confirmar:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="eliminar"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 w-48"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleVaciar}
                disabled={confirmText !== 'eliminar' || vaciarLoading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              >
                {vaciarLoading ? 'Eliminando...' : 'Eliminar todo'}
              </button>
              <button
                onClick={cancelVaciar}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
