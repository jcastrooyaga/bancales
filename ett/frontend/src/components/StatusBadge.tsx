import React from 'react';
import { RequestStatus } from '../types';

const STATUS_CONFIG: Record<RequestStatus, { label: string; className: string }> = {
  DRAFT:         { label: 'Borrador',       className: 'bg-gray-100 text-gray-700' },
  SUBMITTED:     { label: 'Enviada',        className: 'bg-blue-100 text-blue-700' },
  IN_VALIDATION: { label: 'En validación',  className: 'bg-yellow-100 text-yellow-700' },
  APPROVED:      { label: 'Aprobada',       className: 'bg-green-100 text-green-700' },
  REJECTED:      { label: 'Rechazada',      className: 'bg-red-100 text-red-700' },
  RETURNED:      { label: 'Devuelta',       className: 'bg-orange-100 text-orange-700' },
  CANCELLED:     { label: 'Cancelada',      className: 'bg-gray-200 text-gray-500' },
};

export const StatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};
