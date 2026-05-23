import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Request } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';

export const RequestDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    apiClient.get(`/requests/${id}`).then(r => setRequest(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleSubmit = async () => {
    await apiClient.post(`/requests/${id}/submit`);
    load();
  };

  const handleCancel = async () => {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    await apiClient.post(`/requests/${id}/cancel`);
    navigate('/requests');
  };

  const handleRenew = async () => {
    const { data } = await apiClient.post(`/requests/${id}/renew`);
    navigate(`/requests/${data.id}`);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Cargando...</div>;
  if (!request) return <div className="text-center py-8 text-gray-500">Solicitud no encontrada</div>;

  const isOwner = request.requesterId === user?.id;
  const canEdit = isOwner && ['DRAFT', 'RETURNED'].includes(request.status);
  const canSubmit = isOwner && ['DRAFT', 'RETURNED'].includes(request.status);
  const canCancel = (isOwner || user?.roles.includes('ADMIN')) && !['APPROVED', 'CANCELLED'].includes(request.status);
  const canRenew = request.status === 'APPROVED';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/requests" className="text-gray-500 hover:text-gray-700">← Volver</Link>
        <h1 className="text-2xl font-bold flex-1">{request.code}</h1>
        <StatusBadge status={request.status} />
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Centro:</span> <span className="font-medium">{request.workplace?.name}</span></div>
          <div><span className="text-gray-500">ETT:</span> <span className="font-medium">{request.ett?.name}</span></div>
          <div><span className="text-gray-500">Contrato:</span> <span className="font-medium">{request.contractType?.name}</span></div>
          <div><span className="text-gray-500">Categoría:</span> <span className="font-medium">{request.jobCategory?.name}</span></div>
          <div><span className="text-gray-500">Motivo:</span> <span className="font-medium">{request.requestReason?.name}</span></div>
          <div><span className="text-gray-500">Turno:</span> <span className="font-medium">{request.shift?.name}</span></div>
          <div><span className="text-gray-500">Trabajadores:</span> <span className="font-medium">{request.headcount}</span></div>
          <div><span className="text-gray-500">Inicio:</span> <span className="font-medium">{new Date(request.startDate).toLocaleDateString('es')}</span></div>
          {request.endDate && <div><span className="text-gray-500">Fin:</span> <span className="font-medium">{new Date(request.endDate).toLocaleDateString('es')}</span></div>}
          {request.notes && <div className="col-span-2"><span className="text-gray-500">Notas:</span> <span className="font-medium">{request.notes}</span></div>}
          {request.rejectionReason && (
            <div className="col-span-2 bg-red-50 p-3 rounded-lg">
              <span className="text-red-600 font-medium">Motivo de rechazo: </span>{request.rejectionReason}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 flex-wrap">
          {canEdit && (
            <Link to={`/requests/${id}/edit`} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Editar
            </Link>
          )}
          {canSubmit && (
            <button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Enviar a validación
            </button>
          )}
          {canRenew && (
            <button onClick={handleRenew} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Renovar
            </button>
          )}
          {canCancel && (
            <button onClick={handleCancel} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
