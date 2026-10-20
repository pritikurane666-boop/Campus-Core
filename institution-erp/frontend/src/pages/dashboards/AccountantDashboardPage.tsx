import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar } from 'react-chartjs-2';
import '../../utils/chartSetup';
import { dashboardApi, feesApi } from '../../api/endpoints';
import StatCard from '../../components/ui/StatCard';
import { Skeleton, SkeletonStatCard, SkeletonChart, SkeletonTable } from '../../components/common/Skeleton';
import { DollarSign, AlertCircle, FileText, Download, CheckCircle, CreditCard, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AccountantDashboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['accountant-dashboard'],
    queryFn: dashboardApi.getAccountant,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonChart title="Monthly Collections Trend" />
          <SkeletonChart title="Outstanding Dues by Classroom" />
        </div>
        <SkeletonTable columns={7} rows={4} hasHeaderControls={false} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <p className="font-semibold">Failed to load accountant dashboard data.</p>
        <p className="text-sm text-rose-600">Please verify API connection on http://localhost:5050</p>
      </div>
    );
  }

  const feeMonths = data.monthlyFeeCollectionTrend?.map((t) => t.label) || [];
  const feeValues = data.monthlyFeeCollectionTrend?.map((t) => t.value) || [];
  const feeChartData = {
    labels: feeMonths,
    datasets: [
      {
        label: 'Collected ($/₹)',
        data: feeValues,
        backgroundColor: '#4f46e5',
        borderRadius: 6,
      },
    ],
  };

  const classLabels = data.duesByClass?.map((c) => c.className) || [];
  const classDues = data.duesByClass?.map((c) => (c as any).dueAmount ?? (c as any).duesAmount ?? 0) || [];
  const duesChartData = {
    labels: classLabels,
    datasets: [
      {
        label: 'Outstanding Dues ($/₹)',
        data: classDues,
        backgroundColor: '#f43f5e',
        borderRadius: 4,
      },
    ],
  };

  const handleDownloadReceipt = async (paymentId: string, receiptNo?: string) => {
    try {
      await feesApi.downloadReceipt(paymentId, receiptNo || 'Receipt');
    } catch (err) {
      alert('Failed to download PDF receipt. Please check server logs.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finance & Fee Operations</h1>
          <p className="text-sm text-slate-500">Real-time collections, outstanding balances, defaulters tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/fees"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <CreditCard className="mr-1.5 h-4 w-4" />
            Record Payment
          </Link>
          <Link
            to="/fees/defaulters"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <AlertCircle className="mr-1.5 h-4 w-4 text-rose-500" />
            Defaulters List
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Collection"
          value={`$${(data.collectionToday || 0).toLocaleString()}`}
          icon={DollarSign}
          color="emerald"
          description="Cash, card & online inflow today"
        />
        <StatCard
          title="Month Total Collection"
          value={`$${(data.collectionThisMonth || 0).toLocaleString()}`}
          icon={CreditCard}
          color="indigo"
          description="Cumulative month collections"
        />
        <StatCard
          title="Total Pending Dues"
          value={`$${(data.totalPendingDues || 0).toLocaleString()}`}
          icon={AlertCircle}
          color="amber"
          description="All uncollected student fees"
        />
        <StatCard
          title="Fee Defaulters"
          value={data.defaulterCount}
          icon={AlertCircle}
          color="rose"
          description="Past due date without clearance"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Monthly Collections Trend</h2>
          <p className="mb-4 text-xs text-slate-500">Inflow across the past 6 months</p>
          <div className="h-64">
            <Bar
              data={feeChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Outstanding Dues by Classroom</h2>
          <p className="mb-4 text-xs text-slate-500">Unpaid fee balances per class cohort</p>
          <div className="h-64">
            <Bar
              data={duesChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
              }}
            />
          </div>
        </div>
      </div>

      {/* Recent Payments Ledger */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Transactions & Receipts</h2>
            <p className="text-xs text-slate-500">Latest payments verified with generated QuestPDF receipts</p>
          </div>
          <Link to="/fees" className="text-xs font-semibold text-indigo-600 hover:underline">
            Manage Complete Ledger &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Receipt #</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Fee Head</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.recentPayments && data.recentPayments.length > 0 ? (
                data.recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">
                      {p.receiptNumber || 'N/A'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.studentName}</td>
                    <td className="px-4 py-3 text-slate-600">{p.feeHeadName}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">
                      ${p.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium">{p.mode}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDownloadReceipt(p.id, p.receiptNumber || 'Receipt')}
                        className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">
                    No transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountantDashboardPage;
