import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { feesApi, academicApi } from '../../api/endpoints';
import { Download, ArrowLeft } from 'lucide-react';
import { Skeleton } from '../../components/common/Skeleton';

export const FeeDefaultersPage: React.FC = () => {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes-list'],
    queryFn: academicApi.getClasses,
  });

  const { data: defaulters, isLoading } = useQuery({
    queryKey: ['fee-defaulters', selectedClassId],
    queryFn: () => feesApi.getDefaulters(selectedClassId || undefined),
  });

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      await feesApi.exportDefaultersCsv(selectedClassId || undefined);
    } catch (err) {
      alert('Failed to export fee defaulters CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const totalOverdue = defaulters?.reduce((sum, d) => sum + (d.totalDue || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Link
            to="/fees"
            className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fee Defaulters & Arrears</h1>
            <p className="text-sm text-slate-500">
              Students with unfulfilled fee obligations past their scheduled due dates
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export Defaulters CSV'}
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <span className="text-xs font-semibold text-rose-600">Total Arrears Balance</span>
          <p className="mt-1 text-2xl font-bold text-rose-700">${totalOverdue.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-semibold text-slate-500">Defaulter Students</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{defaulters?.length || 0}</p>
        </div>
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-4">
          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-700">Filter by Cohort:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Cohorts</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead>
            <tr className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3.5">Roll No</th>
              <th className="px-4 py-3.5">Student</th>
              <th className="px-4 py-3.5">Class</th>
              <th className="px-4 py-3.5">Guardian Contact</th>
              <th className="px-4 py-3.5">Earliest Due Date</th>
              <th className="px-4 py-3.5">Days Overdue</th>
              <th className="px-4 py-3.5 text-right">Overdue Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-fade-in">
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3.5"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3.5 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : defaulters && defaulters.length > 0 ? (
              defaulters.map((d) => (
                <tr key={d.studentId} className="hover:bg-slate-50/70 transition-colors duration-150 ease-out">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-700">{d.rollNumber}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{d.studentName}</td>
                  <td className="px-4 py-3 text-slate-600">{d.className}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <p className="font-medium text-slate-800">{d.guardianName || 'Guardian'}</p>
                    <p className="text-[11px] text-slate-500">{d.guardianPhone || 'N/A'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(d.earliestDueDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                      {d.daysOverdue} days
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-rose-700">
                    ${d.totalDue.toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No fee defaulters found in this selection!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeeDefaultersPage;
