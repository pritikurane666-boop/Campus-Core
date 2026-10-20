import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { admissionsApi, academicApi } from '../../api/endpoints';
import { Admission } from '../../types';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { CredentialSlipModal, CredentialSlipData } from '../../components/common/CredentialSlipModal';
import { CheckCircle2, XCircle, Clock, FileText, Search, Filter, Eye, Check, X, Download, ExternalLink, Trash2, AlertTriangle, GraduationCap, Copy, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const AdmissionsQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [admissionToDelete, setAdmissionToDelete] = useState<Admission | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [credentialSlip, setCredentialSlip] = useState<CredentialSlipData | null>(null);

  const handleDownloadDocument = async (docId: string, fileName: string) => {
    try {
      setDownloadingDocId(docId);
      await admissionsApi.downloadDocument(docId, fileName);
    } catch (err) {
      alert('Failed to download document.');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleViewDocument = async (docId: string) => {
    try {
      await admissionsApi.viewDocument(docId);
    } catch (err) {
      alert('Failed to open document preview.');
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      await admissionsApi.exportCsv(statusFilter || undefined);
    } catch (err) {
      alert('Failed to export admissions CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admissions-list', page, search, statusFilter],
    queryFn: () =>
      admissionsApi.getList({
        page,
        pageSize: 10,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, newStatus, remarks }: { id: string; newStatus: string; remarks?: string }) =>
      admissionsApi.updateStatus(id, { newStatus, remarks }),
    onSuccess: (res: any, variables) => {
      // Invalidate admissions & dashboard
      queryClient.invalidateQueries({ queryKey: ['admissions-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });

      // Invalidate student and portal queries so newly enrolled students appear everywhere immediately
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      queryClient.invalidateQueries({ queryKey: ['portal-students-list'] });
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes-list-portal'] });
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
      queryClient.invalidateQueries({ queryKey: ['students-search'] });
      queryClient.invalidateQueries({ queryKey: ['recent-students-fee-picker'] });
      queryClient.invalidateQueries({ queryKey: ['student-details'] });
      queryClient.invalidateQueries({ queryKey: ['parent-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['my-children'] });

      if (res?.credentialSlip) {
        setCredentialSlip({
          title: 'Student Admission Enrolled — Credential Slip',
          ...res.credentialSlip,
        });
      } else if (res?.generatedPassword) {
        setCredentialSlip({
          title: 'Student Admission Enrolled — Credential Slip',
          fullName: selectedAdmission ? `${selectedAdmission.firstName} ${selectedAdmission.lastName}` : 'Enrolled Student',
          role: 'Student',
          identifier: res.studentRegistrationNumber,
          email: res.email,
          temporaryPassword: res.generatedPassword,
          mustChangePassword: true,
          generatedAtUtc: new Date().toISOString(),
        });
      }

      setActionSuccess(`Application successfully marked as ${variables.newStatus}! If Approved, student record & portal credentials have been generated and synchronized across all directories.`);
      setSelectedAdmission(null);
      setRemarks('');
      setTimeout(() => setActionSuccess(null), 8000);
    },

    onError: (err: any) => {
      alert(`Status update failed: ${err.response?.data?.detail || err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => admissionsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['admissions-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setActionSuccess('Admission application has been permanently deleted.');
      setAdmissionToDelete(null);
      if (selectedAdmission?.id === deletedId) {
        setSelectedAdmission(null);
      }
      setTimeout(() => setActionSuccess(null), 5000);
    },
    onError: (err: any) => {
      alert(`Failed to delete application: ${err.response?.data?.message || err.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-3 w-3" /> Approved</span>;
      case 'Rejected':
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800"><XCircle className="h-3 w-3" /> Rejected</span>;
      case 'Waitlisted':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800"><Clock className="h-3 w-3" /> Waitlisted</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800"><FileText className="h-3 w-3" /> {status}</span>;
    }
  };

  const columns = [
    {
      header: 'Ref Number',
      accessor: (row: Admission) => (
        <span className="font-mono text-xs font-bold text-indigo-700">{row.referenceNumber}</span>
      ),
    },
    {
      header: 'Applicant Name',
      accessor: (row: Admission) => (
        <div>
          <p className="font-semibold text-slate-900">{row.fullName}</p>
          <p className="text-xs text-slate-500">{row.email || 'No email'}</p>
        </div>
      ),
    },
    {
      header: 'Applied Class',
      accessor: (row: Admission) => (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {row.desiredClassName}
        </span>
      ),
    },
    {
      header: 'Submission Date',
      accessor: (row: Admission) => (
        <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      header: 'Status',
      accessor: (row: Admission) => getStatusBadge(row.status),
    },
    {
      header: 'Actions',
      accessor: (row: Admission) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedAdmission(row)}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition"
            title="Review application"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Review</span>
          </button>
          <button
            onClick={() => setAdmissionToDelete(row)}
            className="inline-flex items-center gap-1 rounded-md bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition"
            title="Delete application"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admissions Application Review</h1>
          <p className="text-sm text-slate-500">
            Verify submitted admission applications, review credentials, and enroll approved candidates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admissions/apply"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <ExternalLink className="h-4 w-4 text-indigo-600" />
            <span>Public Application Portal</span>
          </Link>
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {actionSuccess}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or reference number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="UnderReview">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Waitlisted">Waitlisted</option>
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

      {/* Application Review Modal */}
      {selectedAdmission && (
        <Modal
          isOpen={!!selectedAdmission}
          onClose={() => setSelectedAdmission(null)}
          title={`Admission Application: ${selectedAdmission.referenceNumber}`}
          size="2xl"
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedAdmission.fullName}</h3>
                  <span className="text-xs font-mono font-medium text-slate-500 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded">
                    {selectedAdmission.referenceNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Applied for Class: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAdmission.desiredClassName || 'Not Assigned'}</span>
                </p>
              </div>
              <div className="shrink-0">{getStatusBadge(selectedAdmission.status)}</div>
            </div>

            {/* Enrolled Status Banner (if already enrolled and approved) */}
            {selectedAdmission.status === 'Approved' && selectedAdmission.createdStudentId && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    Student Profile is Enrolled and Active
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const sId = selectedAdmission.createdStudentId;
                    setSelectedAdmission(null);
                    navigate(`/portal?studentId=${sId}`);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition shrink-0"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>Open Student Portal</span>
                </button>
              </div>
            )}

            {/* Rejected Warning Banner */}
            {selectedAdmission.status === 'Rejected' && (
              <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3.5 text-xs text-rose-800 dark:text-rose-200">
                <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>
                  This application is currently <strong>Rejected</strong>. Student class enrollment and portal access are revoked. You can re-approve this applicant below.
                </span>
              </div>
            )}

            {/* Waitlisted Info Banner */}
            {selectedAdmission.status === 'Waitlisted' && (
              <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  This application is on <strong>Waitlist</strong>. Click Approve & Enroll to enroll the student into the class.
                </span>
              </div>
            )}

            {/* Applicant Personal Details */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Applicant Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div>
                  <span className="text-slate-400">Date of Birth:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{new Date(selectedAdmission.dateOfBirth).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-slate-400">Gender:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{selectedAdmission.gender}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400">Email Address:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 break-all">{selectedAdmission.email || 'N/A'}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400">Phone Number:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{selectedAdmission.phoneNumber || 'N/A'}</p>
                </div>
                <div className="sm:col-span-2 min-w-0">
                  <span className="text-slate-400">Residential Address:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 break-words">{selectedAdmission.address || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Parent Details */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Parent / Guardian Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div className="min-w-0">
                  <span className="text-slate-400">Name:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate">{selectedAdmission.guardianName || 'N/A'}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400">Phone:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{selectedAdmission.guardianPhone || 'N/A'}</p>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-400">Email:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 break-all">{selectedAdmission.guardianEmail || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Uploaded Supporting Documents */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Supporting Documents ({selectedAdmission.documents?.length || 0})
                </h4>
                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                  PDF Format
                </span>
              </div>
              {selectedAdmission.documents && selectedAdmission.documents.length > 0 ? (
                <div className="mt-2.5 space-y-2">
                  {selectedAdmission.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold text-[10px]">
                          PDF
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{doc.fileName}</p>
                          <p className="text-[10px] text-slate-400">
                            {doc.documentType} {doc.fileSize ? `• ${(doc.fileSize / 1024).toFixed(0)} KB` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={() => handleViewDocument(doc.id)}
                          className="inline-flex items-center gap-1 rounded bg-slate-200 dark:bg-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </button>
                        <button
                          type="button"
                          disabled={downloadingDocId === doc.id}
                          onClick={() => handleDownloadDocument(doc.id, doc.fileName)}
                          className="inline-flex items-center gap-1 rounded bg-primary-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition"
                        >
                          {downloadingDocId === doc.id ? (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">No documents uploaded for this applicant.</p>
              )}
            </div>

            {/* Review Remarks */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Review Remarks / Notes</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter evaluation notes, entrance exam scores, or enrollment instructions..."
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Decision Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <button
                type="button"
                disabled={deleteMutation.isPending || updateStatusMutation.isPending}
                onClick={() => setAdmissionToDelete(selectedAdmission)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Application</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAdmission(null)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>

                {/* Waitlist button: available if not already waitlisted */}
                {selectedAdmission.status !== 'Waitlisted' && (
                  <button
                    type="button"
                    disabled={updateStatusMutation.isPending}
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: selectedAdmission.id,
                        newStatus: 'Waitlisted',
                        remarks,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 shadow-sm"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>Waitlist</span>
                  </button>
                )}

                {/* Reject button: available if not already rejected */}
                {selectedAdmission.status !== 'Rejected' && (
                  <button
                    type="button"
                    disabled={updateStatusMutation.isPending}
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: selectedAdmission.id,
                        newStatus: 'Rejected',
                        remarks,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 shadow-sm"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </button>
                )}

                {/* Approve & Enroll button: always available if not currently approved */}
                {selectedAdmission.status !== 'Approved' && (
                  <button
                    type="button"
                    disabled={updateStatusMutation.isPending}
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: selectedAdmission.id,
                        newStatus: 'Approved',
                        remarks,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 shadow-sm"
                  >
                    {updateStatusMutation.isPending ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {selectedAdmission.status === 'Rejected'
                        ? 'Approve & Re-Enroll'
                        : selectedAdmission.status === 'Waitlisted'
                        ? 'Approve from Waitlist'
                        : 'Approve & Enroll'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {admissionToDelete && (
        <Modal
          isOpen={!!admissionToDelete}
          onClose={() => !deleteMutation.isPending && setAdmissionToDelete(null)}
          title="Delete Admission Application"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 p-3.5 text-rose-800 dark:text-rose-200">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Are you sure you want to delete this application?</p>
                <p className="mt-1 text-rose-700 dark:text-rose-300 leading-relaxed">
                  Application <strong className="font-mono">{admissionToDelete.referenceNumber}</strong> for{' '}
                  <strong>{admissionToDelete.fullName}</strong> will be permanently removed along with all uploaded documents.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setAdmissionToDelete(null)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(admissionToDelete.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Enrolled Student Confidential Credential Slip Modal */}
      <CredentialSlipModal
        isOpen={!!credentialSlip}
        onClose={() => setCredentialSlip(null)}
        data={credentialSlip}
      />
    </div>
  );
};


export default AdmissionsQueuePage;
