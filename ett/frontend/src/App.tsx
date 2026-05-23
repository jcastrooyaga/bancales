import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { EttLogin } from './pages/EttLogin';
import { Dashboard } from './pages/Dashboard';
import { RequestList } from './pages/RequestList';
import { RequestForm } from './pages/RequestForm';
import { RequestDetail } from './pages/RequestDetail';
import { ValidationInbox } from './pages/ValidationInbox';
import { SupervalidatorView } from './pages/SupervalidatorView';
import { EttDashboard } from './pages/EttDashboard';
import { UsersAdmin } from './pages/admin/UsersAdmin';
import { EttsAdmin } from './pages/admin/EttsAdmin';
import { CircuitsAdmin } from './pages/admin/CircuitsAdmin';
import { CatalogsAdmin } from './pages/admin/CatalogsAdmin';

const RequireAuth: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.some(r => user.roles.includes(r as any))) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const RequireEttAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ettUser } = useAuth();
  if (!ettUser) return <Navigate to="/ett/login" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/ett/login" element={<EttLogin />} />

    <Route path="/ett/dashboard" element={
      <RequireEttAuth><EttDashboard /></RequireEttAuth>
    } />

    <Route path="/dashboard" element={
      <RequireAuth><Layout><Dashboard /></Layout></RequireAuth>
    } />
    <Route path="/requests" element={
      <RequireAuth roles={['ADMIN', 'REQUESTER']}><Layout><RequestList /></Layout></RequireAuth>
    } />
    <Route path="/requests/new" element={
      <RequireAuth roles={['ADMIN', 'REQUESTER']}><Layout><RequestForm /></Layout></RequireAuth>
    } />
    <Route path="/requests/:id" element={
      <RequireAuth><Layout><RequestDetail /></Layout></RequireAuth>
    } />
    <Route path="/requests/:id/edit" element={
      <RequireAuth roles={['ADMIN', 'REQUESTER']}><Layout><RequestForm /></Layout></RequireAuth>
    } />
    <Route path="/validation" element={
      <RequireAuth roles={['ADMIN', 'VALIDATOR', 'SUPERVALIDATOR']}><Layout><ValidationInbox /></Layout></RequireAuth>
    } />
    <Route path="/supervalidator" element={
      <RequireAuth roles={['ADMIN', 'SUPERVALIDATOR']}><Layout><SupervalidatorView /></Layout></RequireAuth>
    } />
    <Route path="/admin/users" element={
      <RequireAuth roles={['ADMIN']}><Layout><UsersAdmin /></Layout></RequireAuth>
    } />
    <Route path="/admin/etts" element={
      <RequireAuth roles={['ADMIN']}><Layout><EttsAdmin /></Layout></RequireAuth>
    } />
    <Route path="/admin/circuits" element={
      <RequireAuth roles={['ADMIN']}><Layout><CircuitsAdmin /></Layout></RequireAuth>
    } />
    <Route path="/admin/catalogs" element={
      <RequireAuth roles={['ADMIN']}><Layout><CatalogsAdmin /></Layout></RequireAuth>
    } />

    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
