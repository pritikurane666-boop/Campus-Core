import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints';
import { User } from '../../types';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { Shield, Plus, Search, CheckCircle, XCircle, Key, UserCheck, ShieldAlert, Filter, RefreshCw } from 'lucide-react';

const ALL_ROLES = ['Principal', 'Teacher', 'Student'];

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // Password reset modal state
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Edit roles modal state
  const [editRolesUser, setEditRolesUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Form states for Create User
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Teacher');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users-list', page, search, roleFilter],
    queryFn: () => adminApi.getUsers({
      page,
      pageSize: 10,
      search: search || undefined,
      role: roleFilter || undefined,
    }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateUserStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    },
    onError: (err: any) => {
      alert(`Status update failed: ${err.message}`);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (userData: any) => adminApi.createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setIsAddUserModalOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      alert('System user account created successfully!');
    },
    onError: (err: any) => {
      alert(`Failed to create user: ${err.response?.data?.message || err.response?.data?.detail || err.message}`);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, pass }: { id: string; pass: string }) =>
      adminApi.resetUserPassword(id, pass),
    onSuccess: () => {
      setResetModalUser(null);
      alert('User password has been reset successfully!');
    },
    onError: (err: any) => {
      alert(`Password reset failed: ${err.response?.data?.message || err.message}`);
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) =>
      adminApi.updateUserRoles(id, roles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setEditRolesUser(null);
      alert('User roles updated successfully!');
    },
    onError: (err: any) => {
      alert(`Failed to update roles: ${err.response?.data?.message || err.message}`);
    },
  });

  const handleOpenEditRoles = (user: User) => {
    setEditRolesUser(user);
    setSelectedRoles(user.roles ? [...user.roles] : []);
  };

  const toggleRoleSelection = (r: string) => {
    if (selectedRoles.includes(r)) {
      if (selectedRoles.length === 1) {
        alert('A user must have at least one role assigned.');
        return;
      }
      setSelectedRoles(selectedRoles.filter((item) => item !== r));
    } else {
      setSelectedRoles([...selectedRoles, r]);
    }
  };

  const columns = [
    {
      header: 'Full Name & Email',
      accessor: (row: User) => (
        <div>
          <p className="font-semibold text-slate-900">{row.fullName || `${row.firstName} ${row.lastName}`}</p>
          <p className="text-xs text-slate-500 font-mono">{row.email}</p>
        </div>
      ),
    },
    {
      header: 'Assigned Roles',
      accessor: (row: User) => (
        <div className="flex flex-wrap gap-1">
          {row.roles?.map((r) => (
            <span
              key={r}
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                r === 'Principal'
                  ? 'bg-purple-100 text-purple-800'
                  : r === 'Teacher'
                  ? 'bg-blue-100 text-blue-800'
                  : r === 'Student'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Account Status',
      accessor: (row: User) => (
        <button
          onClick={() => toggleStatusMutation.mutate({ id: row.id, isActive: !row.isActive })}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
            row.isActive
              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
          }`}
          title="Click to toggle active status"
        >
          {row.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {row.isActive ? 'Active' : 'Deactivated'}
        </button>
      ),
    },
    {
      header: 'Security Actions',
      accessor: (row: User) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEditRoles(row)}
            className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            title="Edit roles assigned to this account"
          >
            <Shield className="h-3 w-3" />
            Roles
          </button>
          <button
            onClick={() => {
              setResetModalUser(row);
              setNewPassword('TempPass@123');
            }}
            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            title="Reset password for this user"
          >
            <Key className="h-3 w-3" />
            Reset Key
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Identity & Access Management</h1>
          <p className="text-sm text-slate-500">
            Enterprise RBAC governance, administrative credentials, role delegation and security locks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Create System User
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user full name or email address..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Filter Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        page={page}
        totalPages={data?.totalPages || 1}
        onPageChange={setPage}
      />

      {/* Create User Modal */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Create System User Account"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Eleanor"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Vance"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. e.vance@institution.edu"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Initial Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="Teacher">Teacher</option>
                <option value="Student">Student</option>
                <option value="Principal">Principal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Initial Password *</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setIsAddUserModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!firstName || !lastName || !email || !password || createUserMutation.isPending}
              onClick={() =>
                createUserMutation.mutate({
                  firstName,
                  lastName,
                  email,
                  password,
                  roles: [role],
                })
              }
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createUserMutation.isPending ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Roles Modal */}
      {editRolesUser && (
        <Modal
          isOpen={!!editRolesUser}
          onClose={() => setEditRolesUser(null)}
          title={`Edit Roles: ${editRolesUser.fullName || editRolesUser.email}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Select or deselect the RBAC security roles assigned to this account. Each role grants distinct portal privileges:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map((r) => {
                const isSelected = selectedRoles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRoleSelection(r)}
                    className={`flex items-center justify-between rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{r}</span>
                    {isSelected && <CheckCircle className="h-4 w-4 text-indigo-600" />}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setEditRolesUser(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedRoles.length === 0 || updateRolesMutation.isPending}
                onClick={() =>
                  updateRolesMutation.mutate({
                    id: editRolesUser.id,
                    roles: selectedRoles,
                  })
                }
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateRolesMutation.isPending ? 'Saving...' : 'Save Roles'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resetModalUser && (
        <Modal
          isOpen={!!resetModalUser}
          onClose={() => setResetModalUser(null)}
          title={`Reset Credentials: ${resetModalUser.fullName || resetModalUser.email}`}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">Security Notice</p>
              <p className="mt-0.5">
                Resetting this password will immediately invalidate previous credentials for{' '}
                <span className="font-mono font-bold">{resetModalUser.email}</span>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">New Temporary Password *</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={newPassword.length < 6 || resetPasswordMutation.isPending}
                onClick={() =>
                  resetPasswordMutation.mutate({
                    id: resetModalUser.id,
                    pass: newPassword,
                  })
                }
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Confirm Reset Password'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default UsersPage;
