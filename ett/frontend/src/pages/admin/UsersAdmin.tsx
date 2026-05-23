import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { User, Role } from '../../types';
import { Modal } from '../../components/Modal';

const ROLES: Role[] = ['ADMIN', 'REQUESTER', 'VALIDATOR', 'SUPERVALIDATOR', 'READONLY'];

export const UsersAdmin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [modal, setModal] = useState<User | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', roles: ['REQUESTER'] as Role[], active: true });
  const [error, setError] = useState('');

  const load = () => apiClient.get('/admin/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ name: '', email: '', password: '', roles: ['REQUESTER'], active: true });
    setModal('new');
    setError('');
  };

  const openEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, password: '', roles: u.roles, active: u.active ?? true });
    setModal(u);
    setError('');
  };

  const handleSave = async () => {
    setError('');
    try {
      if (modal === 'new') {
        await apiClient.post('/admin/users', form);
      } else {
        const payload: any = { name: form.name, email: form.email, roles: form.roles, active: form.active };
        if (form.password) payload.password = form.password;
        await apiClient.patch(`/admin/users/${(modal as User).id}`, payload);
      }
      setModal(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  const toggleRole = (role: Role) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Nuevo usuario</button>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Roles</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Activo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {u.roles.map(r => <span key={r} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{r}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.active ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline text-xs">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Nuevo usuario' : 'Editar usuario'}>
        <div className="space-y-4">
          {[['Nombre', 'name', 'text'], ['Email', 'email', 'email'], ['Contraseña', 'password', 'password']].map(([label, field, type]) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}{field === 'password' && modal !== 'new' ? ' (dejar en blanco para no cambiar)' : ''}</label>
              <input type={type} value={(form as any)[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
            <div className="flex gap-2 flex-wrap">
              {ROLES.map(role => (
                <button key={role} type="button" onClick={() => toggleRole(role)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.roles.includes(role) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                  {role}
                </button>
              ))}
            </div>
          </div>
          {modal !== 'new' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
              Usuario activo
            </label>
          )}
          {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Guardar</button>
            <button onClick={() => setModal(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
