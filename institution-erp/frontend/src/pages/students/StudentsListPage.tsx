import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { studentsApi, academicApi } from '../../api/endpoints';
import { Student, CreateStudentResponse, ResetPasswordResponse } from '../../types';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { CredentialSlipModal, CredentialSlipData } from '../../components/common/CredentialSlipModal';
import { Search, Download, Eye, EyeOff, Trash2, Plus, Edit, UserCheck, ShieldCheck, KeyRound, Copy, Check, LayoutGrid, List } from 'lucide-react';
import { useAuth } from '../../store/authContext';

export const StudentsListPage: React.FC = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('HOD');
  const isTeacher = hasRole('Teacher');
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlStudentId = searchParams.get('studentId');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    const saved = localStorage.getItem('students_view_mode');
    return saved === 'cards' ? 'cards' : 'table';
  });

  const handleViewModeChange = (mode: 'table' | 'cards') => {
    setViewMode(mode);
    localStorage.setItem('students_view_mode', mode);
  };

  // If a studentId is provided in URL, fetch and open their profile modal
  const { data: urlStudent } = useQuery({
    queryKey: ['student-direct', urlStudentId],
    queryFn: () => studentsApi.getById(urlStudentId!),
    enabled: !!urlStudentId,
  });

  useEffect(() => {
    if (urlStudent) {
      setSelectedStudent(urlStudent);
    }
  }, [urlStudent]);

  // Add / Edit Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Password reset and credential display modal states
  const [resetPasswordStudent, setResetPasswordStudent] = useState<Student | null>(null);
  const [customResetPassword, setCustomResetPassword] = useState('');
  const [credentialModal, setCredentialModal] = useState<CredentialSlipData | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);

  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPassword = (id: string, pass?: string) => {
    if (!pass) return;
    navigator.clipboard.writeText(pass);
    setCopiedPasswordId(id);
    setTimeout(() => setCopiedPasswordId(null), 2000);
  };

  // Form states for Add Student
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRollNumber, setNewRollNumber] = useState('');
  const [newDob, setNewDob] = useState('2010-01-15');
  const [newGender, setNewGender] = useState('Male');
  const [newBloodGroup, setNewBloodGroup] = useState('O+');
  const [newAddress, setNewAddress] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [newAdmissionDate, setNewAdmissionDate] = useState(new Date().toISOString().slice(0, 10));
  const [newGuardianName, setNewGuardianName] = useState('');
  const [newGuardianPhone, setNewGuardianPhone] = useState('');
  const [newGuardianEmail, setNewGuardianEmail] = useState('');

  // Form states for Edit Student
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRollNumber, setEditRollNumber] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState('Male');
  const [editBloodGroup, setEditBloodGroup] = useState('O+');
  const [editAddress, setEditAddress] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'Alumni' | 'Suspended'>('Active');
  const [editGuardianName, setEditGuardianName] = useState('');
  const [editGuardianPhone, setEditGuardianPhone] = useState('');
  const [editGuardianEmail, setEditGuardianEmail] = useState('');

  const { data: classes } = useQuery({
    queryKey: ['classes-list'],
    queryFn: academicApi.getClasses,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['students-list', page, search, selectedClassId],
    queryFn: () =>
      studentsApi.getList({
        page,
        pageSize: 10,
        search: search || undefined,
        classId: selectedClassId || undefined,
      }),
  });

  const invalidateAllStudentCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['students-list'] });
    queryClient.invalidateQueries({ queryKey: ['student-details'] });
    queryClient.invalidateQueries({ queryKey: ['parent-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['portal-students-list'] });
    queryClient.invalidateQueries({ queryKey: ['my-children'] });
    queryClient.invalidateQueries({ queryKey: ['class-students'] });
    queryClient.invalidateQueries({ queryKey: ['classes-list'] });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    queryClient.invalidateQueries({ queryKey: ['classes-list-portal'] });
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['student-direct'] });
    queryClient.invalidateQueries({ queryKey: ['students-search'] });
    queryClient.invalidateQueries({ queryKey: ['recent-students-fee-picker'] });
    queryClient.invalidateQueries({ queryKey: ['student-fees'] });
    queryClient.invalidateQueries({ queryKey: ['student-results'] });
    queryClient.invalidateQueries({ queryKey: ['student-attendance-summary'] });
    queryClient.invalidateQueries({ queryKey: ['fee-defaulters'] });
    queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => studentsApi.create(data),
    onSuccess: (res: CreateStudentResponse) => {
      invalidateAllStudentCaches();
      setIsAddModalOpen(false);
      resetAddForm();
      if (res.credentialSlip) {
        setCredentialModal({
          title: 'Student Enrolled — Credential Slip',
          fullName: res.credentialSlip.fullName,
          role: 'Student',
          identifier: res.credentialSlip.identifier,
          email: res.credentialSlip.email,
          temporaryPassword: res.credentialSlip.temporaryPassword,
          mustChangePassword: true,
          generatedAtUtc: res.credentialSlip.generatedAtUtc,
        });
      } else {
        alert('Student successfully enrolled and account created!');
      }
    },
    onError: (err: any) => {
      alert(`Enrollment failed: ${err.response?.data?.detail || err.message}`);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword?: string }) =>
      studentsApi.resetPassword(id, newPassword),
    onSuccess: (res: ResetPasswordResponse) => {
      const studentName = resetPasswordStudent?.fullName || 'Student';
      const studentId = resetPasswordStudent?.studentRegistrationNumber || resetPasswordStudent?.rollNumber || '';
      setResetPasswordStudent(null);
      setCustomResetPassword('');
      if (res.credentialSlip) {
        setCredentialModal({
          title: 'Student Password Reset — Credential Slip',
          fullName: res.credentialSlip.fullName,
          role: 'Student',
          identifier: res.credentialSlip.identifier,
          email: res.credentialSlip.email,
          temporaryPassword: res.credentialSlip.temporaryPassword,
          mustChangePassword: true,
          generatedAtUtc: res.credentialSlip.generatedAtUtc,
        });
      } else {
        setCredentialModal({
          title: 'Student Password Reset — Credential Slip',
          fullName: studentName,
          role: 'Student',
          identifier: studentId,
          email: res.email,
          temporaryPassword: res.newPassword,
          mustChangePassword: true,
        });
      }
    },
    onError: (err: any) => {
      alert(`Password reset failed: ${err.response?.data?.detail || err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => studentsApi.update(id, data),
    onSuccess: () => {
      invalidateAllStudentCaches();
      setEditingStudent(null);
      alert('Student record updated successfully across all portals and directories!');
    },
    onError: (err: any) => {
      alert(`Update failed: ${err.response?.data?.detail || err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: () => {
      invalidateAllStudentCaches();
      setSelectedStudent(null);
    },
    onError: (err: any) => {
      alert(`Failed to remove student: ${err.message}`);
    },
  });

  const resetAddForm = () => {
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewPhone('');
    setNewPassword('');
    setNewRollNumber('');
    setNewAddress('');
    setNewGuardianName('');
    setNewGuardianPhone('');
    setNewGuardianEmail('');
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setEditFirstName(student.firstName);
    setEditLastName(student.lastName);
    setEditEmail(student.email || '');
    setEditPhone(student.phoneNumber || '');
    setEditRollNumber(student.rollNumber);
    setEditDob(student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '');
    setEditGender(student.gender || 'Male');
    setEditBloodGroup(student.bloodGroup || 'O+');
    setEditAddress(student.address || '');
    setEditClassId(student.classRoomId);
    setEditStatus(student.status);
    setEditGuardianName(student.guardianName || '');
    setEditGuardianPhone(student.guardianPhone || '');
    setEditGuardianEmail(student.guardianEmail || '');
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      await studentsApi.exportCsv(selectedClassId || undefined);
    } catch (err) {
      alert('Failed to export students CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const columns = [
    {
      header: 'Roll No',
      accessor: (row: Student) => (
        <span className="font-mono text-xs font-bold text-indigo-700">{row.rollNumber}</span>
      ),
    },
    {
      header: 'Student Name',
      accessor: (row: Student) => (
        <div>
          <p className="font-semibold text-slate-900">{row.fullName}</p>
          <p className="text-xs text-slate-500">{row.email || 'No email'}</p>
        </div>
      ),
    },
    {
      header: 'Class / Section',
      accessor: (row: Student) => (
        <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
          {row.className}
        </span>
      ),
    },
    {
      header: 'Gender',
      accessor: (row: Student) => (
        <span className="text-xs text-slate-600">{row.gender}</span>
      ),
    },
    {
      header: 'Admission Date',
      accessor: (row: Student) => (
        <span className="text-xs text-slate-500">
          {new Date(row.admissionDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (row: Student) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            row.status === 'Active'
              ? 'bg-emerald-100 text-emerald-800'
              : row.status === 'Alumni'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    ...(isAdmin ? [{
      header: 'Password',
      accessor: (row: Student) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
            {revealedPasswords[row.id] ? (row.generatedPassword || '—') : '••••••••'}
          </span>
          {row.generatedPassword && (
            <>
              <button
                type="button"
                onClick={() => toggleRevealPassword(row.id)}
                className="text-slate-400 hover:text-indigo-600 transition p-0.5 rounded"
                title={revealedPasswords[row.id] ? 'Hide password' : 'Show password'}
              >
                {revealedPasswords[row.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => handleCopyPassword(row.id, row.generatedPassword)}
                className="text-slate-400 hover:text-indigo-600 transition p-0.5 rounded"
                title="Copy password"
              >
                {copiedPasswordId === row.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </>
          )}
        </div>
      ),
    }] : []),
    {
      header: 'Actions',
      accessor: (row: Student) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedStudent(row)}
            className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            title="View Full Profile"
          >
            <Eye className="h-3.5 w-3.5" />
            Profile
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => openEditModal(row)}
                className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                title="Edit Student"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => {
                  setResetPasswordStudent(row);
                  setCustomResetPassword('');
                }}
                className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                title="Reset Student Password"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Reset Pass
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to deactivate student ${row.fullName}?`)) {
                    deleteMutation.mutate(row.id);
                  }
                }}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                title="Deactivate Student"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isTeacher && !isAdmin ? 'Student Portal' : 'Student Directory'}
          </h1>
          <p className="text-sm text-slate-500">
            {isTeacher && !isAdmin
              ? 'Active student cohort roster and profile details for your assigned classroom cohorts'
              : 'Comprehensive student roll, enrollment details, academic records and demographic profiles'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                if (classes && classes.length > 0 && !newClassId) {
                  setNewClassId(classes[0].id);
                }
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Enroll Student
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, roll number, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Classes</option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>

          {/* Table / Cards View Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => handleViewModeChange('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="h-4 w-4" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('cards')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'cards'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="h-4 w-4" />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Student Listing: Table or Cards View */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={data?.items || []}
          isLoading={isLoading}
          page={page}
          totalPages={data?.totalPages || 1}
          onPageChange={setPage}
        />
      ) : (
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl border border-slate-200 bg-white p-5 animate-pulse" />
              ))}
            </div>
          ) : data?.items && data.items.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.items.map((student) => (
                  <div
                    key={student.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5">
                            Roll #{student.rollNumber}
                          </span>
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            {student.className}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            student.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : student.status === 'Alumni'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {student.status}
                        </span>
                      </div>

                      <div className="mt-3">
                        <h3 className="font-semibold text-slate-900 text-sm truncate">{student.fullName}</h3>
                        <p className="text-xs text-slate-500 font-mono truncate">{student.email || 'No email'}</p>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2.5">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Gender</span>
                          <span className="font-medium text-slate-700">{student.gender || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Admission Date</span>
                          <span className="font-medium text-slate-700">{new Date(student.admissionDate).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <KeyRound className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            <span className="text-[11px] text-slate-500 font-medium">Password:</span>
                            <span className="font-mono font-semibold text-slate-800 truncate">
                              {revealedPasswords[student.id] ? (student.generatedPassword || '—') : '••••••••'}
                            </span>
                          </div>
                          {student.generatedPassword && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleRevealPassword(student.id)}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded"
                                title={revealedPasswords[student.id] ? 'Hide password' : 'Show password'}
                              >
                                {revealedPasswords[student.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyPassword(student.id, student.generatedPassword)}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded"
                                title="Copy password"
                              >
                                {copiedPasswordId === student.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex items-center justify-between gap-1.5 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        title="View Full Profile"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Profile</span>
                      </button>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(student)}
                            className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            title="Edit Student"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetPasswordStudent(student);
                              setCustomResetPassword('');
                            }}
                            className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                            title="Reset Student Password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>Reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to deactivate student ${student.fullName}?`)) {
                                deleteMutation.mutate(student.id);
                              }
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Deactivate Student"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination in Cards View */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 rounded-xl shadow-sm">
                <div className="text-xs text-slate-700">
                  Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{data.totalPages || 1}</span> ({data.totalCount || 0} students)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages || 1, p + 1))}
                    disabled={page >= (data.totalPages || 1)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500">
              No students found matching current filters.
            </div>
          )}
        </div>
      )}

      {/* Student Profile Modal */}
      {selectedStudent && (
        <Modal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          title={isTeacher && !isAdmin ? `Student Portal — Profile: ${selectedStudent.fullName}` : `Student Profile: ${selectedStudent.fullName}`}
          size="lg"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl bg-indigo-50 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white shadow-sm">
                  {selectedStudent.firstName?.[0] || 'S'}
                  {selectedStudent.lastName?.[0] || ''}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedStudent.fullName}</h3>
                  <p className="text-xs text-indigo-700">
                    Registration No: <span className="font-semibold">{selectedStudent.studentRegistrationNumber}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Roll No: <span className="font-semibold">{selectedStudent.rollNumber}</span> • Class:{' '}
                    <span className="font-semibold">{selectedStudent.className}</span>
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  selectedStudent.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {selectedStudent.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-slate-400">Date of Birth:</span>
                <p className="font-medium text-slate-800">
                  {new Date(selectedStudent.dateOfBirth).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Gender / Blood Group:</span>
                <p className="font-medium text-slate-800">
                  {selectedStudent.gender} • {selectedStudent.bloodGroup || 'Not specified'}
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Emergency Phone:</span>
                <p className="font-medium text-slate-800">{selectedStudent.phoneNumber || 'N/A'}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Student Portal Email:</span>
                <p className="font-medium text-slate-800">{selectedStudent.email || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <span className="font-semibold text-slate-400">Residential Address:</span>
                <p className="font-medium text-slate-800">{selectedStudent.address || 'N/A'}</p>
              </div>
            </div>

            {/* Login Credentials (Visible to HOD) */}
            {isAdmin && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                      Student Login Credentials
                    </h4>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                    HOD View
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Portal Username / Email:</span>
                    <p className="font-mono font-semibold text-slate-900 mt-0.5">{selectedStudent.email}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Portal Password:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-indigo-950 bg-white px-2.5 py-1 rounded border border-indigo-200">
                        {revealedPasswords[selectedStudent.id] ? (selectedStudent.generatedPassword || '—') : '••••••••'}
                      </span>
                      {selectedStudent.generatedPassword && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleRevealPassword(selectedStudent.id)}
                            className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-white transition"
                            title={revealedPasswords[selectedStudent.id] ? 'Hide password' : 'Show password'}
                          >
                            {revealedPasswords[selectedStudent.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(selectedStudent.id, selectedStudent.generatedPassword)}
                            className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-white transition"
                            title="Copy password"
                          >
                            {copiedPasswordId === selectedStudent.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Guardian Info */}
            {selectedStudent.guardianName && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Parent / Guardian Information
                </h4>
                <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Guardian Name:</span>
                    <p className="font-semibold text-slate-800">{selectedStudent.guardianName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span>
                    <p className="font-semibold text-slate-800">{selectedStudent.guardianPhone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Email:</span>
                    <p className="font-semibold text-slate-800">{selectedStudent.guardianEmail || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-4">
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const s = selectedStudent;
                      setSelectedStudent(null);
                      openEditModal(s);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit Record
                  </button>
                  <button
                    onClick={() => {
                      const s = selectedStudent;
                      setSelectedStudent(null);
                      setResetPasswordStudent(s);
                      setCustomResetPassword('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset Password
                  </button>
                </div>
              )}
              <button
                onClick={() => setSelectedStudent(null)}
                className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Profile
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Enroll Student Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Enroll New Student"
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">First Name *</label>
                <input
                  type="text"
                  required
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="e.g. Liam"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Last Name *</label>
                <input
                  type="text"
                  required
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="e.g. Vance"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Student Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="student@institution.edu"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Phone Number</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 555-0199"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Class Room *</label>
                <select
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- Select Class --</option>
                  {classes?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Roll Number *</label>
                <input
                  type="text"
                  required
                  value={newRollNumber}
                  onChange={(e) => setNewRollNumber(e.target.value)}
                  placeholder="e.g. 199"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Initial Password (Optional)</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to auto-generate (name@123)"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Leave blank to auto-generate: <span className="font-mono font-semibold text-indigo-600">firstthreelettersofname@123</span> (e.g. {newFirstName ? (newFirstName.length >= 3 ? newFirstName.substring(0, 3).toLowerCase() : newFirstName.toLowerCase().padEnd(3, 'x')) : 'pri'}@123).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Date of Birth</label>
                <input
                  type="date"
                  value={newDob}
                  onChange={(e) => setNewDob(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Gender</label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Blood Group</label>
                <select
                  value={newBloodGroup}
                  onChange={(e) => setNewBloodGroup(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Residential Address</label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Residential street, city, state"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Guardian Fields */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Guardian Account (Optional)
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Guardian Name</label>
                  <input
                    type="text"
                    value={newGuardianName}
                    onChange={(e) => setNewGuardianName(e.target.value)}
                    placeholder="Parent / Guardian"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Guardian Phone</label>
                  <input
                    type="text"
                    value={newGuardianPhone}
                    onChange={(e) => setNewGuardianPhone(e.target.value)}
                    placeholder="+1 555-0299"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Guardian Email</label>
                  <input
                    type="email"
                    value={newGuardianEmail}
                    onChange={(e) => setNewGuardianEmail(e.target.value)}
                    placeholder="parent@family.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !newFirstName ||
                  !newLastName ||
                  !newEmail ||
                  !newRollNumber ||
                  !newClassId ||
                  createMutation.isPending
                }
                onClick={() =>
                  createMutation.mutate({
                    firstName: newFirstName,
                    lastName: newLastName,
                    email: newEmail,
                    phoneNumber: newPhone || undefined,
                    password: newPassword || undefined,
                    rollNumber: newRollNumber,
                    dateOfBirth: newDob,
                    gender: newGender,
                    bloodGroup: newBloodGroup,
                    address: newAddress || 'Campus Residence',
                    classRoomId: newClassId,
                    admissionDate: newAdmissionDate,
                    guardianName: newGuardianName || undefined,
                    guardianPhone: newGuardianPhone || undefined,
                    guardianEmail: newGuardianEmail || undefined,
                    guardianRelation: 'Parent',
                  })
                }
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Enrolling...' : 'Enroll & Create Account'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <Modal
          isOpen={!!editingStudent}
          onClose={() => setEditingStudent(null)}
          title={`Edit Student Record: ${editingStudent.fullName}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">First Name *</label>
                <input
                  type="text"
                  required
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Last Name *</label>
                <input
                  type="text"
                  required
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Student Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="student@institution.edu"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Student Phone / Mobile</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+1 555-0100"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Roll Number *</label>
                <input
                  type="text"
                  required
                  value={editRollNumber}
                  onChange={(e) => setEditRollNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Class Room *</label>
                <select
                  value={editClassId}
                  onChange={(e) => setEditClassId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  {classes?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Date of Birth</label>
                <input
                  type="date"
                  value={editDob}
                  onChange={(e) => setEditDob(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Gender</label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Blood Group</label>
                <select
                  value={editBloodGroup}
                  onChange={(e) => setEditBloodGroup(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Alumni">Alumni</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Residential Address</label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Street address, city"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Guardian Account Section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Guardian / Emergency Contact Details
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Guardian Name</label>
                  <input
                    type="text"
                    value={editGuardianName}
                    onChange={(e) => setEditGuardianName(e.target.value)}
                    placeholder="Parent / Guardian"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Guardian Phone</label>
                  <input
                    type="text"
                    value={editGuardianPhone}
                    onChange={(e) => setEditGuardianPhone(e.target.value)}
                    placeholder="+1 555-0299"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Guardian Email</label>
                  <input
                    type="email"
                    value={editGuardianEmail}
                    onChange={(e) => setEditGuardianEmail(e.target.value)}
                    placeholder="guardian@family.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!editFirstName || !editLastName || !editRollNumber || updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: editingStudent.id,
                    data: {
                      firstName: editFirstName,
                      lastName: editLastName,
                      email: editEmail || undefined,
                      phoneNumber: editPhone || undefined,
                      rollNumber: editRollNumber,
                      dateOfBirth: editDob,
                      gender: editGender,
                      bloodGroup: editBloodGroup,
                      address: editAddress,
                      classRoomId: editClassId,
                      status: editStatus,
                      guardianName: editGuardianName || undefined,
                      guardianPhone: editGuardianPhone || undefined,
                      guardianEmail: editGuardianEmail || undefined,
                    },
                  })
                }
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Update Record'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Reset Student Password Modal */}
      {resetPasswordStudent && (
        <Modal
          isOpen={!!resetPasswordStudent}
          onClose={() => {
            setResetPasswordStudent(null);
            setCustomResetPassword('');
          }}
          title={`Reset Password: ${resetPasswordStudent.fullName}`}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
              <p className="text-xs text-amber-800">
                You are about to reset the student portal login password for{' '}
                <span className="font-semibold">{resetPasswordStudent.fullName}</span> (
                <span className="font-mono">{resetPasswordStudent.email || 'No email registered'}</span>).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">New Password (Optional)</label>
              <input
                type="text"
                value={customResetPassword}
                onChange={(e) => setCustomResetPassword(e.target.value)}
                placeholder="Leave blank to reset to default (e.g. pri@123)"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                If left blank, the password will automatically reset to <span className="font-mono font-semibold text-indigo-600">firstthreelettersofname@123</span>.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => {
                  setResetPasswordStudent(null);
                  setCustomResetPassword('');
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetPasswordMutation.isPending}
                onClick={() =>
                  resetPasswordMutation.mutate({
                    id: resetPasswordStudent.id,
                    newPassword: customResetPassword || undefined,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 shadow-sm"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Confirm Reset Password'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* One-Time Credential Slip Modal */}
      <CredentialSlipModal
        isOpen={!!credentialModal}
        onClose={() => setCredentialModal(null)}
        data={credentialModal}
      />
    </div>
  );
};

export default StudentsListPage;
