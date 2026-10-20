import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import '../../utils/chartSetup';
import { dashboardApi } from '../../api/endpoints';
import StatCard from '../../components/ui/StatCard';
import { Skeleton, SkeletonStatCard, SkeletonChart, SkeletonTable } from '../../components/common/Skeleton';
import {
  Users,
  GraduationCap,
  School,
  DollarSign,
  CalendarCheck,
  AlertTriangle,
  ArrowRight,
  Bell,
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  History,
  TrendingDown,
  UserX,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboardPage: React.FC = () => {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: dashboardApi.getAdmin,
    staleTime: 60000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Top Banner Skeleton */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-36 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>

        {/* Analytics Charts Grid Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonChart title="Fee Inflow Trend (Last 6 Months)" />
          <SkeletonChart title="Student Strength by Classroom" />
        </div>

        {/* Tables & Lists Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonTable columns={4} rows={5} />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <p className="font-semibold">Failed to load admin dashboard data.</p>
        <p className="text-sm text-rose-600">Please verify API connection on http://localhost:5050</p>
      </div>
    );
  }

  // Monthly fee collection trend (Bar chart)
  const feeMonths = data.monthlyFeeCollectionTrend?.map((t) => t.label) || [];
  const feeValues = data.monthlyFeeCollectionTrend?.map((t) => t.value) || [];
  const feeChartData = {
    labels: feeMonths,
    datasets: [
      {
        label: 'Collected ($/₹)',
        data: feeValues,
        backgroundColor: '#6366f1',
        borderRadius: 6,
        hoverBackgroundColor: '#4f46e5',
      },
    ],
  };

  // 30 days attendance trend (Line chart)
  const attTrendDates = data.attendanceTrend30Days?.map((t) => t.label) || [];
  const attTrendPercents = data.attendanceTrend30Days?.map((t) => t.value) || [];
  const attTrendChartData = {
    labels: attTrendDates,
    datasets: [
      {
        label: 'Daily Attendance %',
        data: attTrendPercents,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
    ],
  };

  // Class wise strength (Doughnut chart as specified in prompt section 5.9)
  const classLabels = data.classWiseStrength?.map((c) => c.className) || [];
  const classCounts = data.classWiseStrength?.map((c) => c.studentCount) || [];
  const doughnutColors = [
    '#6366f1',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ec4899',
    '#8b5cf6',
    '#3b82f6',
    '#14b8a6',
  ];
  const classStrengthData = {
    labels: classLabels,
    datasets: [
      {
        data: classCounts,
        backgroundColor: doughnutColors.slice(0, classLabels.length),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const lowAttendanceList = data.lowAttendanceStudents || [];

  return (
    <div className="space-y-6">
      {/* Top Executive Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Principal Executive Dashboard
            </h1>
            <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Principal
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time institutional oversight, academic indicators & financial governance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            to="/admissions"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            Review Admissions
          </Link>
          <Link
            to="/fees"
            className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Fee Ledger
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Students"
          value={data.totalStudents}
          icon={GraduationCap}
          trend={{ value: `${data.totalClasses} Active Classes`, isPositive: true }}
          description="Total enrolled student body"
        />
        <StatCard
          title="Faculty Teachers"
          value={data.totalTeachers}
          icon={Users}
          color="emerald"
          description="Teaching staff across all depts"
        />
        <StatCard
          title="Month Fee Collection"
          value={`$${(data.monthlyFeeCollected || 0).toLocaleString()}`}
          icon={DollarSign}
          color="amber"
          trend={{ value: `$${(data.totalPendingFees || 0).toLocaleString()} pending`, isPositive: false }}
          description="Inflow this calendar month"
        />
        <StatCard
          title="Today's Attendance"
          value={`${(data.todayAttendancePercentage || 0).toFixed(1)}%`}
          icon={CalendarCheck}
          color={data.todayAttendancePercentage < 75 ? 'rose' : 'cyan'}
          description="Students reported today"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Fee Collection Trend */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Fee Inflow Trend (Last 6 Months)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Collected tuition, admission & lab fees</p>
            </div>
            <Link to="/fees" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              Ledger &rarr;
            </Link>
          </div>
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

        {/* Class-wise Strength - Doughnut Chart */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Student Strength by Classroom</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Classroom cohort distribution</p>
            </div>
            <Link to="/classes" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              Manage Classes &rarr;
            </Link>
          </div>
          <div className="h-64 flex items-center justify-center">
            {classLabels.length > 0 ? (
              <Doughnut
                data={classStrengthData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: { boxWidth: 12, font: { size: 11 } },
                    },
                  },
                }}
              />
            ) : (
              <p className="text-xs text-slate-400">No classes registered.</p>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Row: 30-day Attendance Trend & Recent Admissions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Attendance Trend Line */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">30-Day Attendance Health Curve</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Daily attendance percentage trend</p>
            </div>
            <Link to="/attendance" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              Mark / View &rarr;
            </Link>
          </div>
          <div className="h-64">
            <Line
              data={attTrendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 40, max: 100 } },
              }}
            />
          </div>
        </div>

        {/* Recent Admissions Queue */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">New Admissions</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Recent student applicants</p>
              </div>
              <Link to="/admissions" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                View All &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {data.recentAdmissions && data.recentAdmissions.length > 0 ? (
                data.recentAdmissions.map((adm) => (
                  <div
                    key={adm.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{adm.fullName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {adm.desiredClassName} • Ref: {adm.referenceNumber}
                      </p>
                    </div>
                    <span
                      className={`ml-2 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium ${
                        adm.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : adm.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : adm.status === 'Waitlisted'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                      }`}
                    >
                      {adm.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">No recent applications submitted.</p>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
            <Link
              to="/admissions"
              className="flex items-center justify-between text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800"
            >
              <span>Process Pending Applications</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Low Attendance Watchlist Section (< 75%) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 dark:bg-rose-950/80 rounded-lg text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Low Attendance Watchlist (&lt; 75%)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Students below statutory attendance threshold requiring administrative intervention
              </p>
            </div>
          </div>
          <Link
            to="/attendance"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <span>Full Attendance Register</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {lowAttendanceList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-medium">
                <tr>
                  <th className="px-3 py-2.5">Roll No</th>
                  <th className="px-3 py-2.5">Student Name</th>
                  <th className="px-3 py-2.5">Class</th>
                  <th className="px-3 py-2.5">Total Days</th>
                  <th className="px-3 py-2.5">Present / Absent</th>
                  <th className="px-3 py-2.5">Attendance %</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-normal text-slate-700 dark:text-slate-300">
                {lowAttendanceList.map((st) => (
                  <tr key={st.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-slate-400">{st.rollNumber}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">{st.studentName}</td>
                    <td className="px-3 py-2.5">{st.className}</td>
                    <td className="px-3 py-2.5">{st.totalDays} days</td>
                    <td className="px-3 py-2.5">
                      <span className="text-emerald-600 font-semibold">{st.presentDays}</span> /{' '}
                      <span className="text-rose-600 font-semibold">{st.absentDays}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-950 px-2 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                        {st.attendancePercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        to={`/students`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Profile
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">All student cohorts meet attendance standards</p>
            <p className="text-xs text-slate-500">No active students are currently below the 75% threshold.</p>
          </div>
        )}
      </div>

      {/* Quick Executive Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Link
          to="/admissions"
          className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm transition text-center group"
        >
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform mb-2">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Admissions Queue</span>
          <span className="text-[10px] text-slate-400">Review & Enroll</span>
        </Link>

        <Link
          to="/students"
          className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm transition text-center group"
        >
          <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform mb-2">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Students Directory</span>
          <span className="text-[10px] text-slate-400">Profiles & Data</span>
        </Link>

        <Link
          to="/teachers"
          className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm transition text-center group"
        >
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform mb-2">
            <Users className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Faculty Staff</span>
          <span className="text-[10px] text-slate-400">Teaching Allocations</span>
        </Link>

        <Link
          to="/timetable"
          className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm transition text-center group"
        >
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform mb-2">
            <Clock className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Timetable Guide</span>
          <span className="text-[10px] text-slate-400">Schedules & Slots</span>
        </Link>

        <Link
          to="/admin/users"
          className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm transition text-center group"
        >
          <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform mb-2">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Staff & Roles</span>
          <span className="text-[10px] text-slate-400">Security & RBAC</span>
        </Link>

        <Link
          to="/admin/audit-logs"
          className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm transition text-center group"
        >
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform mb-2">
            <History className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Audit Trails</span>
          <span className="text-[10px] text-slate-400">System Activity</span>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
