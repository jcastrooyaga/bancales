import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Workplace, Ett, ContractType, JobCategory, RequestReason, Shift, ValidationCircuit } from '../types';

export const RequestForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({
    workplaceId: '', ettId: '', contractTypeId: '', jobCategoryId: '',
    requestReasonId: '', shiftId: '', circuitId: '',
    startDate: '', endDate: '', headcount: 1, notes: '',
  });
  const [catalogs, setCatalogs] = useState<{
    workplaces: Workplace[]; etts: Ett[]; contractTypes: ContractType[];
    jobCategories: JobCategory[]; requestReasons: RequestReason[]; shifts: Shift[]; circuits: ValidationCircuit[];
  }>({ workplaces: [], etts: [], contractTypes: [], jobCategories: [], requestReasons: [], shifts: [], circuits: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiClient.get('/admin/catalogs/workplaces'),
      apiClient.get('/admin/etts'),
      apiClient.get('/admin/catalogs/contract-types'),
      apiClient.get('/admin/catalogs/job-categories'),
      apiClient.get('/admin/catalogs/request-reasons'),
      apiClient.get('/admin/catalogs/shifts'),
      apiClient.get('/admin/circuits'),
    ]).then(([wp, etts, ct, jc, rr, sh, circ]) => {
      setCatalogs({
        workplaces: wp.data, etts: etts.data, contractTypes: ct.data,
        jobCategories: jc.data, requestReasons: rr.data, shifts: sh.data, circuits: circ.data,
      });
    }).catch(() => {});

    if (id) {
      apiClient.get(`/requests/${id}`).then(r => {
        const req = r.data;
        setForm({
          workplaceId: req.workplaceId, ettId: req.ettId, contractTypeId: req.contractTypeId,
          jobCategoryId: req.jobCategoryId, requestReasonId: req.requestReasonId, shiftId: req.shiftId,
          circuitId: req.circuitId || '', startDate: req.startDate.slice(0, 10),
          endDate: req.endDate ? req.endDate.slice(0, 10) : '', headcount: req.headcount, notes: req.notes || '',
        });
      });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await apiClient.patch(`/requests/${id}`, form);
      } else {
        await apiClient.post('/requests', form);
      }
      navigate('/requests');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );

  const selectClass = "w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";
  const inputClass = selectClass;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Editar solicitud' : 'Nueva solicitud'}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('Centro de trabajo', (
            <select value={form.workplaceId} onChange={e => setForm({ ...form, workplaceId: e.target.value })} className={selectClass} required>
              <option value="">Seleccionar...</option>
              {catalogs.workplaces.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          ))}
          {field('ETT', (
            <select value={form.ettId} onChange={e => setForm({ ...form, ettId: e.target.value })} className={selectClass} required>
              <option value="">Seleccionar...</option>
              {catalogs.etts.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          ))}
          {field('Tipo de contrato', (
            <select value={form.contractTypeId} onChange={e => setForm({ ...form, contractTypeId: e.target.value })} className={selectClass} required>
              <option value="">Seleccionar...</option>
              {catalogs.contractTypes.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ))}
          {field('Categoría profesional', (
            <select value={form.jobCategoryId} onChange={e => setForm({ ...form, jobCategoryId: e.target.value })} className={selectClass} required>
              <option value="">Seleccionar...</option>
              {catalogs.jobCategories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ))}
          {field('Motivo', (
            <select value={form.requestReasonId} onChange={e => setForm({ ...form, requestReasonId: e.target.value })} className={selectClass} required>
              <option value="">Seleccionar...</option>
              {catalogs.requestReasons.filter(r => r.active).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          ))}
          {field('Turno', (
            <select value={form.shiftId} onChange={e => setForm({ ...form, shiftId: e.target.value })} className={selectClass} required>
              <option value="">Seleccionar...</option>
              {catalogs.shifts.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ))}
          {field('Circuito de validación', (
            <select value={form.circuitId} onChange={e => setForm({ ...form, circuitId: e.target.value })} className={selectClass}>
              <option value="">Sin circuito</option>
              {catalogs.circuits.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ))}
          {field('Número de trabajadores', (
            <input type="number" min={1} value={form.headcount} onChange={e => setForm({ ...form, headcount: parseInt(e.target.value) })} className={inputClass} required />
          ))}
          {field('Fecha inicio', (
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={inputClass} required />
          ))}
          {field('Fecha fin (opcional)', (
            <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className={inputClass} />
          ))}
        </div>
        {field('Observaciones', (
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className={inputClass} />
        ))}
        {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={() => navigate('/requests')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};
