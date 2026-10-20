import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { dashboardApi, parentsApi, studentsApi, academicApi, examsApi, feesApi, attendanceApi, timetableApi, noticesApi } from '../../api/endpoints';
import StatCard from '../../components/ui/StatCard';
import { Skeleton, SkeletonStatCard } from '../../components/common/Skeleton';
import {
  GraduationCap,
  CalendarCheck,
  DollarSign,
  Award,
  ArrowLeft,
  ArrowRight,
  Search,
  User,
  Users,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Receipt,
  Layers,
  ChevronRight,
  ShieldCheck,
  Percent,
  Printer,
  Eye,
  X,
  Phone,
  PhoneCall,
  Mail,
  MapPin,
  RefreshCw,
  Bell,
  Clock,
  BookOpen,
  ExternalLink,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../store/authContext';
import { Student, StudentExamResult, TimetableEntry, Notice } from '../../types';

export const ParentDashboardPage: React.FC = () => {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlStudentId = searchParams.get('studentId') || '';
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(urlStudentId || null);
  const [activeTab, setActiveTab] = useState<'all' | 'academic' | 'attendance' | 'fees' | 'routine' | 'notices'>('all');
  const [downloadingExamId, setDownloadingExamId] = useState<string | null>(null);
  const [printingExamId, setPrintingExamId] = useState<string | null>(null);
  const [previewExamResult, setPreviewExamResult] = useState<StudentExamResult | null>(null);
  const [downloadingPaymentId, setDownloadingPaymentId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Synchronize state with URL param
  useEffect(() => {
    setSelectedStudentId(urlStudentId || null);
  }, [urlStudentId]);

  const isStudent = hasRole('Student');
  const isStudentOrParent = isStudent;
  const isPrincipal = hasRole('Principal');
  const isTeacher = hasRole('Teacher');
  const isStaffOrAdmin = isPrincipal || isTeacher;

  // Admin filter states for student directory selector
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Fetch Student's own record (if logged in as student or parent)
  const { data: myProfile } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: studentsApi.getMyProfile,
    enabled: isStudent,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: myChildren } = useQuery({
    queryKey: ['my-children'],
    queryFn: parentsApi.getMyChildren,
    enabled: isStudentOrParent,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Automatically select the logged in student's profile
  useEffect(() => {
    if (isStudent && myProfile && !selectedStudentId) {
      handleSelectStudent(myProfile.id);
    } else if (isStudentOrParent && myChildren && myChildren.length > 0 && !selectedStudentId) {
      handleSelectStudent(myChildren[0].id);
    }
  }, [isStudent, isStudentOrParent, myProfile, myChildren, selectedStudentId]);

  // 2. Fetch Classes for Admin filter dropdown
  const { data: classesList } = useQuery({
    queryKey: ['classes-list-portal'],
    queryFn: () => academicApi.getClasses(),
    enabled: isStaffOrAdmin && !selectedStudentId,
  });

  // 3. Fetch Students directory for Admin selector
  const { data: pagedStudents, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['portal-students-list', currentPage, searchQuery, classFilter],
    queryFn: () =>
      studentsApi.getList({
        page: currentPage,
        pageSize: 12,
        search: searchQuery || undefined,
        classId: classFilter || undefined,
        status: 'Active',
      }),
    enabled: isStaffOrAdmin && !selectedStudentId,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // 4. Fetch Selected Student's Overview Dashboard details
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['parent-dashboard', selectedStudentId],
    queryFn: () => dashboardApi.getParent(selectedStudentId || undefined),
    enabled: !!selectedStudentId,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // 5. Fetch Full Student Personal Details
  const { data: studentDetails, refetch: refetchDetails } = useQuery({
    queryKey: ['student-details', selectedStudentId],
    queryFn: () => studentsApi.getById(selectedStudentId!),
    enabled: !!selectedStudentId,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // 6. Fetch Student's Exam Results & Official Reports
  const { data: examResults, isLoading: isResultsLoading, refetch: refetchResults } = useQuery({
    queryKey: ['student-results', selectedStudentId],
    queryFn: () => examsApi.getStudentResults(selectedStudentId!),
    enabled: !!selectedStudentId,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // 7. Fetch Student Attendance Summary
  const { data: attendanceSummary, isLoading: isAttendanceLoading, refetch: refetchAttendance } = useQuery({
    queryKey: ['student-attendance-summary', selectedStudentId],
    queryFn: () => attendanceApi.getStudentSummary(selectedStudentId!),
    enabled: !!selectedStudentId,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // 8. Fetch Student Fee Ledger
  const { data: studentFees, isLoading: isFeesLoading, refetch: refetchFees } = useQuery({
    queryKey: ['student-fees', selectedStudentId],
    queryFn: () => feesApi.getStudentFees(selectedStudentId!),
    enabled: !!selectedStudentId,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // 9. Fetch Student's Class Timetable for Daily Routine
  const { data: studentTimetable, isLoading: isTimetableLoading, refetch: refetchTimetable } = useQuery({
    queryKey: ['student-dashboard-timetable', studentDetails?.classRoomId || dashboardData?.classRoomId],
    queryFn: () => {
      const cId = studentDetails?.classRoomId || dashboardData?.classRoomId;
      return cId ? timetableApi.getByClass(cId) : Promise.resolve([]);
    },
    enabled: !!(studentDetails?.classRoomId || dashboardData?.classRoomId),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // 10. Fetch Institutional / Class Notices
  const { data: studentNotices, isLoading: isNoticesLoading, refetch: refetchNotices } = useQuery({
    queryKey: ['student-dashboard-notices'],
    queryFn: noticesApi.getList,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const handleManualSync = async () => {
    if (!selectedStudentId) return;
    setIsSyncing(true);
    await Promise.allSettled([
      refetchDashboard(),
      refetchDetails(),
      refetchResults(),
      refetchAttendance(),
      refetchFees(),
      refetchTimetable(),
      refetchNotices(),
      queryClient.invalidateQueries({ queryKey: ['portal-students-list'] }),
      queryClient.invalidateQueries({ queryKey: ['my-children'] }),
    ]);
    setTimeout(() => setIsSyncing(false), 500);
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudentId(id);
    setSearchParams({ studentId: id });
  };

  const handleClearSelection = () => {
    if (isStudent) return; // Prevent student from clearing selection
    setSelectedStudentId(null);
    setSearchParams({});
  };

  const handleDownloadReportCard = async (examId: string, examName: string) => {
    if (!selectedStudentId || !dashboardData) return;
    try {
      setDownloadingExamId(examId);
      await examsApi.downloadReportCard(examId, selectedStudentId, dashboardData.studentName || 'Student');
    } catch (err) {
      console.error('Failed to download report card', err);
    } finally {
      setDownloadingExamId(null);
    }
  };

  const handlePrintReportCard = async (examId: string) => {
    if (!selectedStudentId) return;
    try {
      setPrintingExamId(examId);
      await examsApi.printReportCard(examId, selectedStudentId);
    } catch (err) {
      console.error('Failed to print PDF report card', err);
      // Fallback: open printable preview modal directly
      const match = examResults?.find((r) => r.examId === examId);
      if (match) setPreviewExamResult(match);
    } finally {
      setPrintingExamId(null);
    }
  };

  const handleDownloadReceipt = async (paymentId: string, receiptNumber?: string) => {
    try {
      setDownloadingPaymentId(paymentId);
      await feesApi.downloadReceipt(paymentId, receiptNumber || `REC-${paymentId.slice(0, 8)}`);
    } catch (err) {
      console.error('Failed to download receipt', err);
    } finally {
      setDownloadingPaymentId(null);
    }
  };

  // If student is loading their profile, show rich skeleton instead of directory selection
  if (isStudent && !selectedStudentId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
            <div className="space-y-2 flex-1 text-center sm:text-left">
              <Skeleton className="h-6 w-48 mx-auto sm:mx-0" />
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: STUDENT SELECTION SCREEN (When no student is selected yet - Staff/Parent only)
  // =========================================================================
  if (!selectedStudentId) {
    return (
      <div className="space-y-8 animate-fadeIn">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-7 text-white shadow-xl border border-slate-800">
          <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-500/30 backdrop-blur-sm mb-3">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                <span>Student Academic Portal</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                {isStudent ? 'Your Student Profile' : 'Select Student Profile'}
              </h1>
              <p className="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
                Inspect individual student reports, cumulative attendance records, fee ledger dues, and academic performance marks.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-md border border-white/10 text-xs text-slate-200">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>
                {isStudent ? 'Authenticated Student Access' : 'Faculty & Administrative Portal Inspection'}
              </span>
            </div>
          </div>

          <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        </div>

        {/* STUDENT / PARENT VIEW */}
        {isStudentOrParent && !isStaffOrAdmin && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-600" />
              <span>Your Student Account</span>
            </h2>

            {myChildren && myChildren.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                {myChildren.map((child: Student) => (
                  <div
                    key={child.id}
                    onClick={() => handleSelectStudent(child.id)}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900 p-6 shadow-md hover:shadow-xl hover:border-indigo-500 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-600/30">
                        {child.firstName?.[0]}
                        {child.lastName?.[0]}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                          {child.fullName}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {child.className} • Roll #{child.rollNumber}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition"
                    >
                      <span>Enter Academic Portal</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* ADMIN / STAFF VIEW */}
        {isStaffOrAdmin && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <span>{isTeacher && !isPrincipal ? 'Class Students Portal' : 'Institutional Student Directory'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isTeacher && !isPrincipal
                    ? 'Select any enrolled student from your allocated class cohorts to inspect their academic portal records'
                    : 'Select any enrolled student to preview their personal reports, attendance, fees, and academic performance'}
                </p>
              </div>

              {pagedStudents && (
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Showing {pagedStudents.items.length} of {pagedStudents.totalCount} Students
                </span>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm">
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student by name, roll number, or registration code..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <select
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  <option value="">All Grades & Classes</option>
                  {classesList?.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Students Grid */}
            {isStudentsLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="h-44 rounded-xl border border-slate-200 bg-white p-4 animate-pulse space-y-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200" />
                    <div className="h-4 w-24 bg-slate-200 rounded" />
                    <div className="h-3 w-16 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            ) : pagedStudents?.items && pagedStudents.items.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {pagedStudents.items.map((student: Student) => (
                    <div
                      key={student.id}
                      onClick={() => handleSelectStudent(student.id)}
                      className="group cursor-pointer rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-500 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-sm font-bold text-indigo-700 dark:text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            {student.firstName?.[0] || 'S'}
                            {student.lastName?.[0] || ''}
                          </div>
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                            {student.className || 'Unassigned'}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                          {student.fullName}
                        </h4>

                        <div className="mt-2 space-y-1 text-xs text-slate-500">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Roll No:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {student.rollNumber || 'N/A'}
                            </span>
                          </div>
                          {(student.phoneNumber || student.guardianPhone) && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Contact:</span>
                              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                {student.phoneNumber || student.guardianPhone}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Reg ID:</span>
                            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[110px]">
                              {student.studentRegistrationNumber || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                        <span>Select Student</span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagedStudents.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                    <p className="text-xs text-slate-500">
                      Page {pagedStudents.pageNumber} of {pagedStudents.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!pagedStudents.hasPreviousPage}
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={!pagedStudents.hasNextPage}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
                <Search className="mx-auto h-8 w-8 text-slate-400" />
                <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">No Students Match Your Criteria</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Try adjusting your search keywords or clearing the class filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setClassFilter('');
                  }}
                  className="mt-3 inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: STUDENT DETAILS DASHBOARD (When student is selected)
  // =========================================================================
  if (isDashboardLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <Skeleton className="h-16 w-16 rounded-2xl flex-shrink-0" />
            <div className="space-y-2 flex-1 text-center sm:text-left">
              <Skeleton className="h-6 w-48 mx-auto sm:mx-0" />
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (dashboardError || !dashboardData) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleClearSelection}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-sm transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Student Selection</span>
        </button>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900">
          <p className="font-semibold">Failed to load student dashboard details.</p>
          <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">
            Please verify API connection or student enrollment records.
          </p>
        </div>
      </div>
    );
  }

  // Calculate Fee Totals
  const totalPayableAll = studentFees?.reduce((sum, f) => sum + (f.totalPayable || 0), 0) ?? dashboardData.feesDue;
  const totalPaidAll = studentFees?.reduce((sum, f) => sum + (f.paidAmount || 0), 0) ?? 0;
  const totalBalanceDue = studentFees?.reduce((sum, f) => sum + (f.balanceAmount || 0), 0) ?? dashboardData.feesDue;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Navigation & Student Switcher Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          {(isStaffOrAdmin || ((myChildren?.length ?? 0) > 1)) && (
            <>
              <button
                type="button"
                onClick={handleClearSelection}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition shadow-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{isStaffOrAdmin ? 'Switch / Select Another Student' : 'Switch Student Profile'}</span>
              </button>
              <div className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
            </>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Viewing Student:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {dashboardData.studentName}
            </span>
            <span>•</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {dashboardData.className}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-60"
            title="Refresh student records from database"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Live Data'}</span>
          </button>

          {isStaffOrAdmin && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Search All Students</span>
            </button>
          )}
        </div>
      </div>

      {/* Student Overview Header Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-6 text-white shadow-lg">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white shadow-inner backdrop-blur-md border border-white/20">
              {dashboardData.studentName?.[0] || 'S'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {dashboardData.studentName}
                </h1>
                <span className="rounded-md bg-indigo-500/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-200 border border-indigo-400/30">
                  {dashboardData.className}
                </span>
                <span className="rounded-md bg-white/10 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-300 border border-white/15">
                  Roll: {dashboardData.rollNumber || 'N/A'}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-200">
                {(studentDetails?.phoneNumber || dashboardData.phoneNumber) && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 font-medium border border-white/10">
                    <Phone className="h-3 w-3 text-emerald-400" />
                    <span>Contact: <strong className="text-white font-mono">{studentDetails?.phoneNumber || dashboardData.phoneNumber}</strong></span>
                  </span>
                )}
                {(studentDetails?.guardianPhone || dashboardData.guardianPhone) && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 font-medium border border-white/10">
                    <PhoneCall className="h-3 w-3 text-indigo-300" />
                    <span>Parent No: <strong className="text-white font-mono">{studentDetails?.guardianPhone || dashboardData.guardianPhone}</strong></span>
                  </span>
                )}
                {studentDetails?.studentRegistrationNumber && (
                  <span>Reg ID: <strong className="font-mono text-white">{studentDetails.studentRegistrationNumber}</strong></span>
                )}
                {studentDetails?.bloodGroup && (
                  <span>Blood: <strong className="text-white">{studentDetails.bloodGroup}</strong></span>
                )}
                {studentDetails?.gender && (
                  <span>Gender: <strong className="text-white">{studentDetails.gender}</strong></span>
                )}
                {studentDetails?.guardianName && (
                  <span>Guardian: <strong className="text-white">{studentDetails.guardianName}</strong></span>
                )}
              </div>

              {/* Quick Navigation Action Links */}
              <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-white/10">
                <Link
                  to="/timetable"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition border border-white/10 shadow-xs"
                >
                  <Calendar className="h-3.5 w-3.5 text-indigo-300" />
                  <span>View Weekly Timetable</span>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                </Link>

                <Link
                  to="/exams"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition border border-white/10 shadow-xs"
                >
                  <Award className="h-3.5 w-3.5 text-amber-300" />
                  <span>My Exams & Marks Breakdown</span>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                </Link>

                <Link
                  to="/notices"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition border border-white/10 shadow-xs"
                >
                  <Bell className="h-3.5 w-3.5 text-cyan-300" />
                  <span>Campus Notices ({studentNotices?.length ?? 0})</span>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                </Link>
              </div>
            </div>
          </div>

          {/* Overall Attendance on top right */}
          <div className="rounded-xl bg-white/10 backdrop-blur-md px-5 py-3 border border-white/15 flex items-center gap-3.5 shadow-inner">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
              dashboardData.attendancePercentage >= 75
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] uppercase font-semibold text-slate-300 tracking-wider">Overall Attendance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">
                  {dashboardData.attendancePercentage.toFixed(1)}%
                </span>
                <span className={`text-xs font-bold ${
                  dashboardData.attendancePercentage >= 75 ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  {dashboardData.attendancePercentage >= 75 ? 'Regular' : 'Low (<75%)'}
                </span>
              </div>
              <p className="text-[10px] text-slate-300">
                {attendanceSummary != null
                  ? `${attendanceSummary.presentDays} / ${attendanceSummary.totalDays} Days Present`
                  : `${dashboardData.attendancePercentage.toFixed(1)}% Present`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Contact & Emergency Directory Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-150 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Phone className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Student Contact & Guardian Directory</h3>
              <p className="text-[11px] text-slate-500">Official emergency contact telephone numbers, family guardian contacts, and residential details</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-semibold">
            <ShieldCheck className="h-3 w-3" />
            Verified Contact Records
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* 1. Student Emergency Contact */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Phone className="h-3.5 w-3.5 text-indigo-600" />
              Student Contact No
            </span>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
              {studentDetails?.phoneNumber || dashboardData.phoneNumber || 'Not provided'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Primary mobile line for student</p>
          </div>

          {/* 2. Guardian Phone Number */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Users className="h-3.5 w-3.5 text-emerald-600" />
              Parent / Guardian Contact
            </span>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
              {studentDetails?.guardianPhone || dashboardData.guardianPhone || 'Not provided'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              {studentDetails?.guardianName ? `Name: ${studentDetails.guardianName}` : 'Parent emergency contact'}
            </p>
          </div>

          {/* 3. Communication Email */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Mail className="h-3.5 w-3.5 text-indigo-600" />
              Communication Email
            </span>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {studentDetails?.email || dashboardData.email || studentDetails?.guardianEmail || 'Not provided'}
            </p>
            {studentDetails?.guardianEmail && studentDetails?.email && (
              <p className="text-[10px] text-slate-400 mt-1 truncate">
                Guardian: {studentDetails.guardianEmail}
              </p>
            )}
          </div>

          {/* 4. Residential Address */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
              <MapPin className="h-3.5 w-3.5 text-indigo-600" />
              Residential Address
            </span>
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
              {studentDetails?.address || 'Permanent address not specified in record'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards: Student-focused Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Attendance Record"
          value={`${dashboardData.attendancePercentage.toFixed(1)}%`}
          icon={CalendarCheck}
          color={dashboardData.attendancePercentage < 75 ? 'rose' : 'emerald'}
          trend={{
            value: dashboardData.attendancePercentage < 75 ? 'Under 75% Requirement' : 'Regular Attendance',
            isPositive: dashboardData.attendancePercentage >= 75,
          }}
          description={`${attendanceSummary?.presentDays ?? 0} Present / ${attendanceSummary?.totalDays ?? 0} Total Days (Click to view)`}
          onClick={() => setActiveTab('attendance')}
        />
        <StatCard
          title="Outstanding Fees"
          value={`$${totalBalanceDue.toLocaleString()}`}
          icon={DollarSign}
          color={totalBalanceDue > 0 ? 'rose' : 'emerald'}
          trend={{
            value: totalBalanceDue > 0 ? 'Dues Pending' : 'Fully Cleared',
            isPositive: totalBalanceDue === 0,
          }}
          description={totalBalanceDue > 0 ? `$${totalPaidAll.toLocaleString()} paid towards fees (Click to view)` : 'Zero outstanding dues (Click to view)'}
          onClick={() => setActiveTab('fees')}
        />
        <StatCard
          title="Academic Performance"
          value={
            examResults && examResults.length > 0
              ? `${examResults[0].percentage.toFixed(1)}%`
              : (dashboardData.latestExamResultSummary?.includes('Grade')
                  ? dashboardData.latestExamResultSummary.split('Grade')[1].trim().split(' ')[0]
                  : 'Evaluated')
          }
          icon={Award}
          color="indigo"
          trend={{
            value: examResults && examResults.length > 0 ? `Grade ${examResults[0].overallGrade}` : 'Current Term',
            isPositive: true,
          }}
          description={
            examResults && examResults.length > 0
              ? `Rank #${examResults[0].classRank} in ${examResults[0].examName} (Click to view)`
              : (dashboardData.latestExamResultSummary || 'Term evaluations in progress (Click to view)')
          }
          onClick={() => setActiveTab('academic')}
        />
        <StatCard
          title="Official Report Cards"
          value={examResults ? `${examResults.length}` : '0'}
          icon={FileText}
          color="cyan"
          trend={{
            value: examResults && examResults.length > 0 ? 'Published' : 'Scheduled',
            isPositive: (examResults?.length ?? 0) > 0,
          }}
          description="Verified terminal assessment reports (Click to view)"
          onClick={() => setActiveTab('academic')}
        />
      </div>

      {/* Navigation Filter Tabs: Focus ONLY on Student's Data */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>All Student Data</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('academic')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'academic'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Award className="h-4 w-4 text-indigo-500" />
          <span>Academic Reports & Marks ({examResults?.length ?? 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'attendance'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <CalendarCheck className="h-4 w-4 text-emerald-500" />
          <span>Attendance Records ({dashboardData.attendancePercentage.toFixed(1)}%)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fees')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'fees'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="h-4 w-4 text-emerald-500" />
          <span>Fee Ledger & Receipts (${totalBalanceDue.toLocaleString()} Due)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('routine')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'routine'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Calendar className="h-4 w-4 text-indigo-500" />
          <span>Class Routine ({studentTimetable?.length ?? 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notices')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'notices'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Bell className="h-4 w-4 text-cyan-500" />
          <span>Notices ({studentNotices?.length ?? 0})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: ACADEMIC PERFORMANCE & OFFICIAL REPORT CARDS */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'academic') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-600" />
                <span>Academic Performance & Official Reports</span>
              </h2>
              <p className="text-xs text-slate-500">
                Verified terminal examination marksheets, subject scores, grades, and official PDF report cards
              </p>
            </div>
            <Link
              to="/exams"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3.5 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition shadow-2xs shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Full Exams Schedule & Marks</span>
            </Link>
          </div>

          {isResultsLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center animate-pulse">
              <div className="h-6 w-48 bg-slate-200 rounded mx-auto" />
            </div>
          ) : examResults && examResults.length > 0 ? (
            <div className="space-y-6">
              {examResults.map((result) => (
                <div
                  key={result.examId}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5"
                >
                  {/* Exam Summary Bar - Left Aligned */}
                  <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {result.examName}
                        </h3>
                        <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                          result.isOverallPassed
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                          {result.isOverallPassed ? 'Result: Passed' : 'Result: Needs Improvement'}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <p className="text-xs text-slate-500">
                          Class: <span className="font-semibold text-slate-700 dark:text-slate-300">{result.className}</span> • Roll: <span className="font-semibold text-slate-700 dark:text-slate-300">{result.rollNumber}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-start gap-3">
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-2 border border-slate-200 dark:border-slate-700">
                        <div className="text-center pr-3 border-r border-slate-200 dark:border-slate-700">
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Total Marks</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-white">
                            {result.totalMarksObtained} <span className="text-xs text-slate-400 font-normal">/ {result.totalMaxMarks}</span>
                          </p>
                        </div>
                        <div className="text-center pr-3 border-r border-slate-200 dark:border-slate-700">
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Percentage</p>
                          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {result.percentage.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-center pr-3 border-r border-slate-200 dark:border-slate-700">
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Grade</p>
                          <p className="text-sm font-black text-amber-600 dark:text-amber-400">
                            {result.overallGrade}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Class Rank</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-white">
                            #{result.classRank}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-start gap-2">
                        <button
                          type="button"
                          onClick={() => handlePrintReportCard(result.examId)}
                          disabled={printingExamId === result.examId}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                          {printingExamId === result.examId ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Printer className="h-4 w-4 text-white" />
                          )}
                          <span>Print Report Card (PDF)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadReportCard(result.examId, result.examName)}
                          disabled={downloadingExamId === result.examId}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
                        >
                          {downloadingExamId === result.examId ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                          ) : (
                            <Download className="h-4 w-4 text-slate-500" />
                          )}
                          <span>Download PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewExamResult(result)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                          <Eye className="h-4 w-4 text-slate-500" />
                          <span>Preview Sheet</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Subject-Wise Score Sheet Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 font-semibold uppercase text-slate-500">
                          <th className="px-4 py-3">Subject</th>
                          <th className="px-4 py-3">Subject Code</th>
                          <th className="px-4 py-3 text-center">Max Marks</th>
                          <th className="px-4 py-3 text-center">Pass Marks</th>
                          <th className="px-4 py-3 text-center">Marks Obtained</th>
                          <th className="px-4 py-3 text-center">Percentage</th>
                          <th className="px-4 py-3 text-center">Grade</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {result.subjectResults.map((sub) => {
                          const subPct = sub.maxMarks > 0 ? (sub.marksObtained / sub.maxMarks) * 100 : 0;
                          return (
                            <tr key={sub.subjectId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                                {sub.subjectName}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500">
                                {sub.subjectCode}
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                                {sub.maxMarks}
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                                {sub.passMarks}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">
                                {sub.isAbsent ? (
                                  <span className="text-rose-500 font-semibold">Absent</span>
                                ) : (
                                  sub.marksObtained
                                )}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                                {sub.isAbsent ? '-' : `${subPct.toFixed(1)}%`}
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                                {sub.isAbsent ? '-' : sub.gradeLetter}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {sub.isAbsent ? (
                                  <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                                    ABSENT
                                  </span>
                                ) : sub.isPassed ? (
                                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                                    PASSED
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                                    FAILED
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
              <Award className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                No Published Examination Reports Currently Available
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Official terminal report cards will appear here immediately once evaluation and marks moderation are published by class faculty.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: ATTENDANCE RECORDS & COMPLIANCE */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'attendance') && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-emerald-600" />
              <span>Student Attendance Record & Statutory Compliance</span>
            </h2>
            <p className="text-xs text-slate-500">
              Cumulative presence record, statutory attendance eligibility, and breakdown
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
            {/* Progress Meter against 75% Requirement */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Overall Term Attendance Rate
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {dashboardData.attendancePercentage.toFixed(1)}% Presence
                </span>
              </div>

              <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    dashboardData.attendancePercentage >= 75
                      ? 'bg-emerald-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(dashboardData.attendancePercentage, 100)}%` }}
                />
                {/* 75% Statutory Marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-white"
                  style={{ left: '75%' }}
                  title="75% Mandatory Exam Qualification Line"
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>0%</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  75% Statutory Minimum Threshold
                </span>
                <span>100%</span>
              </div>
            </div>

            {/* Attendance Breakdown Metric Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 text-center">
                <p className="text-xs font-semibold text-slate-500">Total Working Days</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  {attendanceSummary?.totalDays ?? 0}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Class academic days</p>
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 text-center">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Present Days</p>
                <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {attendanceSummary?.presentDays ?? 0}
                </p>
                <p className="mt-1 text-[10px] text-emerald-600/70">Verified presence in class</p>
              </div>

              <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 p-4 text-center">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Absent Days</p>
                <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">
                  {attendanceSummary?.absentDays ?? 0}
                </p>
                <p className="mt-1 text-[10px] text-rose-600/70">Unexcused absences</p>
              </div>

              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-4 text-center">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Late Marked</p>
                <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                  {attendanceSummary?.lateDays ?? 0}
                </p>
                <p className="mt-1 text-[10px] text-amber-600/70">Tardy arrivals</p>
              </div>
            </div>

            {/* Attendance Standing Notice */}
            <div className={`rounded-xl p-4 flex items-center gap-3 text-xs border ${
              dashboardData.attendancePercentage >= 75
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
            }`}>
              {dashboardData.attendancePercentage >= 75 ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Statutory Requirement Satisfied:</span> This student has attained {dashboardData.attendancePercentage.toFixed(1)}% attendance, satisfying the institution's mandatory 75% examination eligibility standard.
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-bold">Statutory Attendance Alert:</span> Current attendance of {dashboardData.attendancePercentage.toFixed(1)}% is below the required 75% threshold. Please coordinate with academic administration.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: FEE LEDGER & RECEIPTS */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'fees') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <span>Student Fee Ledger & Payment Receipts</span>
              </h2>
              <p className="text-xs text-slate-500">
                Term tuition structure, installments, verified payments, and downloadable tax receipts
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
            {/* Financial Summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 p-4">
                <p className="text-xs font-semibold text-slate-500">Total Term Fees</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  ${totalPayableAll.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Institutional assessment</p>
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/30 p-4">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Total Amount Paid</p>
                <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ${totalPaidAll.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-emerald-600/70">Cleared against invoice</p>
              </div>

              <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/30 p-4">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Outstanding Balance Due</p>
                <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">
                  ${totalBalanceDue.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-rose-600/70">
                  {totalBalanceDue === 0 ? 'All fees settled' : 'Payment pending'}
                </p>
              </div>
            </div>

            {/* Fee Items Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Assigned Fee Invoices & Schedules
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 font-semibold uppercase text-slate-500">
                      <th className="px-4 py-3">Fee Category</th>
                      <th className="px-4 py-3 text-right">Base Amount</th>
                      <th className="px-4 py-3 text-right">Total Payable</th>
                      <th className="px-4 py-3 text-right">Paid Amount</th>
                      <th className="px-4 py-3 text-right">Balance Due</th>
                      <th className="px-4 py-3 text-center">Due Date</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {studentFees && studentFees.length > 0 ? (
                      studentFees.map((fee) => (
                        <tr key={fee.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {fee.feeHeadName}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                            ${fee.baseAmount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                            ${fee.totalPayable.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            ${fee.paidAmount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                            ${fee.balanceAmount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500">
                            {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              fee.status === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : fee.status === 'Partial'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            }`}>
                              {fee.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                          No fee ledger items currently assigned.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Receipts Log */}
            {studentFees && studentFees.some((f) => f.payments && f.payments.length > 0) && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-emerald-600" />
                  <span>Payment Receipts & Transaction History</span>
                </h3>

                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 font-semibold uppercase text-slate-500">
                        <th className="px-4 py-3">Receipt No</th>
                        <th className="px-4 py-3">Fee Head</th>
                        <th className="px-4 py-3">Payment Date</th>
                        <th className="px-4 py-3">Payment Mode</th>
                        <th className="px-4 py-3">Txn Reference</th>
                        <th className="px-4 py-3 text-right">Amount Paid</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {studentFees.flatMap((f) =>
                        (f.payments || []).map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {p.receiptNumber || 'REC-SETTLED'}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                              {p.feeHeadName || f.feeHeadName}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {new Date(p.paymentDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                {p.mode}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500">
                              {p.transactionReference || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              ${p.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDownloadReceipt(p.id, p.receiptNumber)}
                                disabled={downloadingPaymentId === p.id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
                              >
                                {downloadingPaymentId === p.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border border-indigo-600 border-t-transparent" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                                <span>Receipt (PDF)</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: WEEKLY LECTURE ROUTINE & CLASS SCHEDULE */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'routine') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <span>Class Lecture Routine & Schedule</span>
              </h2>
              <p className="text-xs text-slate-500">
                Official period timings, subject allocations, faculty instructors and classroom allocations for {dashboardData.className}
              </p>
            </div>
            <Link
              to="/timetable"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3.5 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition shadow-2xs shrink-0"
            >
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Open Full Timetable Grid &rarr;</span>
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            {isTimetableLoading ? (
              <div className="py-8 text-center text-slate-400 animate-pulse">
                <div className="h-5 w-48 bg-slate-200 rounded mx-auto" />
              </div>
            ) : studentTimetable && studentTimetable.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {studentTimetable.map((t: TimetableEntry) => {
                  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                  const dayLabel = typeof t.dayOfWeek === 'number' ? dayNames[t.dayOfWeek] : t.dayOfWeek;
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 transition hover:border-indigo-300 dark:hover:border-indigo-700 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          {dayLabel} &bull; Period #{t.periodNumber}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {t.startTime?.slice(0, 5)} - {t.endTime?.slice(0, 5)}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {t.subjectName}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" />
                          Faculty: <span className="font-semibold text-slate-700 dark:text-slate-300">{t.teacherName || 'Faculty Assigned'}</span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {t.roomNumber || 'Lecture Hall'}
                        </span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {dashboardData.className}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Calendar className="mx-auto h-8 w-8 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No periods scheduled for {dashboardData.className} yet.</p>
                <Link to="/timetable" className="inline-block text-xs font-bold text-indigo-600 hover:underline">
                  Check institutional timetable &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: CAMPUS NOTICEBOARD & ANNOUNCEMENTS */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'notices') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-600" />
                <span>Campus Noticeboard & Official Circulars</span>
              </h2>
              <p className="text-xs text-slate-500">
                Official institutional circulars, academic notices, and class announcements for {dashboardData.className}
              </p>
            </div>
            <Link
              to="/notices"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3.5 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition shadow-2xs shrink-0"
            >
              <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Open Campus Noticeboard &rarr;</span>
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            {isNoticesLoading ? (
              <div className="py-8 text-center text-slate-400 animate-pulse">
                <div className="h-5 w-48 bg-slate-200 rounded mx-auto" />
              </div>
            ) : studentNotices && studentNotices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studentNotices.slice(0, 4).map((n: Notice) => (
                  <div
                    key={n.id}
                    className="rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 transition hover:border-indigo-300 dark:hover:border-indigo-700 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
                        {n.audience === 'All' ? 'Campus-Wide Circular' : n.targetClassName || 'Class Notice'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {n.title}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {n.content}
                    </p>

                    <div className="pt-2 flex justify-end">
                      <Link
                        to="/notices"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <span>Read full notice</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Bell className="mx-auto h-8 w-8 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No circulars posted at this time.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printable Report Card Preview Modal */}
      {previewExamResult && (
        <div
          onClick={() => setPreviewExamResult(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible"
          >
            {/* Modal Header Toolbar (hidden during print) */}
            <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3.5 print:hidden">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Official Student Report Card Preview
                  </h3>
                  <p className="text-xs text-slate-500">
                    {previewExamResult.examName} &bull; Ready for printing or export
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintReportCard(previewExamResult.examId)}
                  disabled={printingExamId === previewExamResult.examId}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {printingExamId === previewExamResult.examId ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  <span>Print Official PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadReportCard(previewExamResult.examId, previewExamResult.examName)}
                  disabled={downloadingExamId === previewExamResult.examId}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  <Download className="h-4 w-4 text-slate-500" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  title="Print sheet directly from browser"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  <span>Browser Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewExamResult(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Report Sheet Content */}
            <div className="p-8 sm:p-12 bg-white text-slate-900 overflow-y-auto print:overflow-visible print:p-6 print:m-0">
              {/* Institution Letterhead Header */}
              <div className="text-center pb-6 border-b-2 border-indigo-600">
                <div className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-2">
                  Academic Evaluation & Examination Division
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl uppercase">
                  Excellence University & Institution ERP
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Accredited Academic Authority &bull; Central Examination Board &bull; Official Transcript Record
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-1 text-xs font-bold text-slate-800">
                  <span>EXAMINATION:</span>
                  <span className="text-indigo-700 uppercase">{previewExamResult.examName}</span>
                  {previewExamResult.academicYear && (
                    <span className="text-slate-500">({previewExamResult.academicYear})</span>
                  )}
                </div>
              </div>

              {/* Student Metadata Card */}
              <div className="my-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Student Name</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {dashboardData?.studentName || studentDetails?.fullName || 'Student'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Class & Section</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {dashboardData?.className || studentDetails?.className || 'Class'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Roll Number</span>
                    <span className="font-mono font-bold text-slate-900">
                      {dashboardData?.rollNumber || studentDetails?.rollNumber || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Overall Attendance</span>
                    <span className="font-bold text-emerald-600 text-sm">
                      {dashboardData?.attendancePercentage != null
                        ? `${dashboardData.attendancePercentage.toFixed(1)}%`
                        : attendanceSummary?.attendancePercentage != null
                        ? `${attendanceSummary.attendancePercentage.toFixed(1)}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Subject Results Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-100 font-bold uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">Subject</th>
                      <th className="px-3 py-2.5 font-mono">Code</th>
                      <th className="px-3 py-2.5 text-center">Max Marks</th>
                      <th className="px-3 py-2.5 text-center">Passing</th>
                      <th className="px-3 py-2.5 text-center font-bold">Obtained</th>
                      <th className="px-3 py-2.5 text-center">%</th>
                      <th className="px-3 py-2.5 text-center">Grade</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewExamResult.subjectResults.map((sub, idx) => {
                      const subPct = sub.maxMarks > 0 ? (sub.marksObtained / sub.maxMarks) * 100 : 0;
                      return (
                        <tr key={sub.subjectId} className="even:bg-slate-50/50">
                          <td className="px-3 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{sub.subjectName}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-500">{sub.subjectCode}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600">{sub.maxMarks}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600">{sub.passMarks}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-900">{sub.marksObtained}</td>
                          <td className="px-3 py-2.5 text-center font-medium text-slate-700">{subPct.toFixed(1)}%</td>
                          <td className="px-3 py-2.5 text-center font-bold text-indigo-700">{sub.gradeLetter}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                sub.isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {sub.isPassed ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary Cards */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Marks</p>
                  <p className="text-base font-extrabold text-slate-900">
                    {previewExamResult.totalMarksObtained} <span className="text-xs font-normal text-slate-400">/ {previewExamResult.totalMaxMarks}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Overall Percentage</p>
                  <p className="text-base font-extrabold text-indigo-600">
                    {previewExamResult.percentage.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Grade</p>
                  <p className="text-base font-black text-amber-600">
                    {previewExamResult.overallGrade}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Class Rank</p>
                  <p className="text-base font-extrabold text-slate-900">
                    #{previewExamResult.classRank}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Result Status</p>
                  <p
                    className={`text-base font-black uppercase ${
                      previewExamResult.isOverallPassed ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {previewExamResult.isOverallPassed ? 'PASSED' : 'FAILED'}
                  </p>
                </div>
              </div>

              {/* Signatures & Verification Seal */}
              <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-3 gap-8 text-center text-xs">
                <div>
                  <div className="h-10 border-b border-dashed border-slate-400" />
                  <p className="mt-2 font-bold text-slate-800">Class Teacher</p>
                  <p className="text-[10px] text-slate-400">Signature & Date</p>
                </div>
                <div>
                  <div className="h-10 border-b border-dashed border-slate-400" />
                  <p className="mt-2 font-bold text-slate-800">Controller of Examinations</p>
                  <p className="text-[10px] text-slate-400">Signature & Seal</p>
                </div>
                <div>
                  <div className="h-10 border-b border-dashed border-slate-400" />
                  <p className="mt-2 font-bold text-slate-800">Principal / Director</p>
                  <p className="text-[10px] text-slate-400">Official Stamp</p>
                </div>
              </div>

              {/* Bottom Verification Note */}
              <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
                This official grade sheet was verified and generated via the Institution ERP Portal on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboardPage;
