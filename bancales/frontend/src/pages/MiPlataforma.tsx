import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PlataformaDetalle } from './PlataformaDetalle';

export const MiPlataforma: React.FC = () => {
  const { user } = useAuth();
  if (!user?.plataformaCodigo) return <Navigate to="/login" replace />;
  return <PlataformaDetalle overrideCodigo={user.plataformaCodigo} />;
};
