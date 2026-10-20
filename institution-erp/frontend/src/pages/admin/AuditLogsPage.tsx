import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints';
import { AuditLog } from '../../types';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { ShieldAlert, Eye, Search, Filter, RefreshCw, CheckCircle, Clock } from 'lucide-react';

const COMMON_ACTIONS = [
  'Login',
  'CreateUser',
  'UpdateUserStatus',
  'UpdateUserRoles',
  'ResetUserPassword',
  'CreateStudent',
  'UpdateStudent',
  'MarkStudentAttendance',
  'MarkTeacherAttendance',
  'RecordFeePayment',
  'CreateFeeStructure',
  'CreateExam',
  'PublishExam',
  'CreateNotice',
  'DeleteNotice',
];

const COMMON_ENTITIES = [
  'User',
  'Student',
  'StudentAttendance',
  'TeacherAttendance',
  'FeePayment',
  'FeeStructure',
  'Exam',
  'Notice',
  'AdmissionApplication',
  'TimetableEntry',
];

export const AuditLogsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter, entityFilter],
    queryFn: () =>
      adminApi.getAuditLogs({
        page,
        pageSize: 12,
        search: search || undefined,
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
      }),
  });

  const columns = [
    {
      header: 'Timestamp',
      accessor: (row: AuditLog) => (
        <div>
          <span className="text-xs font-mono font-medium text-slate-700">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
          <p className="text-[10px] font-mono text-slate-400">
            {new Date(row.createdAt).toLocaleTimeString()}
          </p>
        </div>
      ),
    },
    {
      header: 'Initiator User',
      accessor: (row: AuditLog) => (
        <div>
          <p className="font-semibold text-slate-900">{row.userEmail || 'System Process'}</p>
          <p className="text-[10px] text-slate-400 font-mono">{row.ipAddress || '127.0.0.1'}</p>
        </div>
      ),
    },
    {
      header: 'Action',
      accessor: (row: AuditLog) => (
        <span
          className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
            row.action.toLowerCase().includes('delete') || row.action.toLowerCase().includes('reject')
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : row.action.toLowerCase().includes('create') || row.action.toLowerCase().includes('approve')
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          }`}
        >
          {row.action}
        </span>
      ),
    },
    {
      header: 'Target Entity',
      accessor: (row: AuditLog) => (
        <span className="text-xs font-medium text-slate-700">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800">
            {row.entityName}
          </span>{' '}
          {row.entityId && <span className="text-[11px] text-slate-400 font-mono">({row.entityId.slice(0, 8)}...)</span>}
        </span>
      ),
    },
    {
      header: 'Audit Payload',
      accessor: (row: AuditLog) => (
        <button
          onClick={() => setSelectedLog(row)}
          className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
        >
          <Eye className="h-3 w-3" />
          Inspect Diff
        </button>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Immutable Audit Trail</h1>
          <p className="text-sm text-slate-500">
            Cryptographically tracked transactional logs, authentication changes, role adjustments & data mutations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Tamper-Evident Ledger Active
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user email, action, entity..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Actions</option>
              {COMMON_ACTIONS.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Entity:</span>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Entities</option>
              {COMMON_ENTITIES.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>
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

      {/* Audit Log Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Event: ${selectedLog.action}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
              <div>
                <span className="text-slate-400">Initiator:</span>
                <p className="font-semibold text-slate-800">{selectedLog.userEmail || 'System'}</p>
              </div>
              <div>
                <span className="text-slate-400">Entity:</span>
                <p className="font-semibold text-slate-800">
                  {selectedLog.entityName} {selectedLog.entityId && `(${selectedLog.entityId})`}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Recorded At:</span>
                <p className="font-semibold text-slate-800">{new Date(selectedLog.createdAt).toISOString()}</p>
              </div>
              <div>
                <span className="text-slate-400">Client IP:</span>
                <p className="font-semibold text-slate-800">{selectedLog.ipAddress || '127.0.0.1'}</p>
              </div>
            </div>

            {selectedLog.oldValuesJson && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600">Prior State Snapshot</h4>
                <pre className="mt-1 max-h-48 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-rose-300">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedLog.oldValuesJson), null, 2);
                    } catch {
                      return selectedLog.oldValuesJson;
                    }
                  })()}
                </pre>
              </div>
            )}

            {selectedLog.newValuesJson ? (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600">Committed Changes</h4>
                <pre className="mt-1 max-h-48 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-300">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedLog.newValuesJson), null, 2);
                    } catch {
                      return selectedLog.newValuesJson;
                    }
                  })()}
                </pre>
              </div>
            ) : (
              <p className="text-xs italic text-slate-400">No delta payload recorded for this event.</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AuditLogsPage;
