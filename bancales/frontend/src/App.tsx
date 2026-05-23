import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PlataformaDetalle } from './pages/PlataformaDetalle';
import { Bancales } from './pages/Bancales';
import { BancalHistorial } from './pages/BancalHistorial';
import { Importar } from './pages/Importar';
import { RegistroManual } from './pages/RegistroManual';
import { Plataformas } from './pages/Plataformas';
import { Configuracion } from './pages/Configuracion';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
    <Route path="/plataforma/:codigo" element={<RequireAuth><Layout><PlataformaDetalle /></Layout></RequireAuth>} />
    <Route path="/bancales" element={<RequireAuth><Layout><Bancales /></Layout></RequireAuth>} />
    <Route path="/bancales/:codigo" element={<RequireAuth><Layout><BancalHistorial /></Layout></RequireAuth>} />
    <Route path="/importar" element={<RequireAuth><Layout><Importar /></Layout></RequireAuth>} />
    <Route path="/registro-manual" element={<RequireAuth><Layout><RegistroManual /></Layout></RequireAuth>} />
    <Route path="/plataformas" element={<RequireAuth><Layout><Plataformas /></Layout></RequireAuth>} />
    <Route path="/configuracion" element={<RequireAuth><Layout><Configuracion /></Layout></RequireAuth>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
