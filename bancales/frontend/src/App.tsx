import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PlataformaDetalle } from './pages/PlataformaDetalle';
import { MiPlataforma } from './pages/MiPlataforma';
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

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/mi-plataforma" replace />;
  return <>{children}</>;
};

const HomeRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'PLATAFORMA') return <Navigate to="/mi-plataforma" replace />;
  return <Layout><Dashboard /></Layout>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<HomeRedirect />} />
    <Route path="/mi-plataforma" element={<RequireAuth><Layout><MiPlataforma /></Layout></RequireAuth>} />
    <Route path="/plataforma/:codigo" element={<RequireAdmin><Layout><PlataformaDetalle /></Layout></RequireAdmin>} />
    <Route path="/bancales" element={<RequireAuth><Layout><Bancales /></Layout></RequireAuth>} />
    <Route path="/bancales/:codigo" element={<RequireAuth><Layout><BancalHistorial /></Layout></RequireAuth>} />
    <Route path="/importar" element={<RequireAdmin><Layout><Importar /></Layout></RequireAdmin>} />
    <Route path="/registro-manual" element={<RequireAdmin><Layout><RegistroManual /></Layout></RequireAdmin>} />
    <Route path="/plataformas" element={<RequireAdmin><Layout><Plataformas /></Layout></RequireAdmin>} />
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
