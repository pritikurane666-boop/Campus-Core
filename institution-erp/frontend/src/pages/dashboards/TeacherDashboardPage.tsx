import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, noticesApi } from '../../api/endpoints';
import StatCard from '../../components/ui/StatCard';
import { Skeleton, SkeletonStatCard } from '../../components/common/Skeleton';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckSquare,
  Award,
  ArrowRight,
  MapPin,
  Users,
  Bell,
  Plus,
  Pin,
  ShieldCheck,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherDashboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: dashboardApi.getTeacher,
  });

  const { data: notices } = useQuery({
    queryKey: ['notices-list'],
    queryFn: noticesApi.getList,
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
            <Skeleton className="h-9 w-36 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>

        {/* Schedule & Quick Actions Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 space-y-3">
            <div className="flex justify-between items-center mb-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-28" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-slate-50/50">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <Skeleton className="h-5 w-32 mb-3" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <Skeleton className="h-5 w-36 mb-3" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <p className="font-semibold">Failed to load teacher dashboard data.</p>
        <p className="text-sm text-rose-600">Please verify API connection on http://localhost:5050</p>
      </div>
    );
  }

  const recentClassNotices = notices?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome, {data.teacherName}
            </h1>
            <span className="rounded-full bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
              Faculty Workspace
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Your daily teaching timetable, assigned classroom cohorts, attendance rosters and grading queue
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(() => {
            const allClassesMarked = Boolean(
              data.classesToMarkAttendance &&
              data.classesToMarkAttendance.length > 0 &&
              data.classesToMarkAttendance.every((c) => c.isAttendanceMarkedToday)
            );
            const anyClassMarked = Boolean(
              data.classesToMarkAttendance &&
              data.classesToMarkAttendance.some((c) => c.isAttendanceMarkedToday)
            );

            return (
              <Link
                to="/attendance/mark"
                className={`inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition ${
                  allClassesMarked
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {allClassesMarked ? (
                  <>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit Attendance
                  </>
                ) : anyClassMarked ? (
                  <>
                    <CheckSquare className="mr-1.5 h-4 w-4" />
                    Mark / Edit Attendance
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-1.5 h-4 w-4" />
                    Mark Today's Attendance
                  </>
                )}
              </Link>
            );
          })()}
          <Link
            to="/exams"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <Award className="mr-1.5 h-4 w-4 text-indigo-600" />
            Marks & Grading
          </Link>
          <Link
            to="/portal"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <Users className="mr-1.5 h-4 w-4 text-indigo-600" />
            Student Portal
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard
          title="Periods Scheduled Today"
          value={data.todayClassesCount}
          icon={Clock}
          color="indigo"
          description="Lectures on your timetable today"
        />
        <StatCard
          title="Allocated Classes"
          value={data.totalAllocatedClasses}
          icon={BookOpen}
          color="emerald"
          description="Assigned classroom cohorts"
        />
        <StatCard
          title="Pending Exam Grading"
          value={data.pendingMarksEntryExams?.length || 0}
          icon={Award}
          color="amber"
          description="Exams awaiting score entry"
        />
      </div>

      {/* Grid: Schedule & Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's Timetable */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Today's Lecture Schedule</h2>
              <p className="text-xs text-slate-500">Chronological timetable for your active periods</p>
            </div>
            <Link to="/timetable" className="text-xs font-semibold text-indigo-600 hover:underline">
              Full Weekly Schedule &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {data.todaySchedule && data.todaySchedule.length > 0 ? (
              data.todaySchedule.map((slot, idx) => (
                <div
                  key={slot.id || idx}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-4 transition-all hover:border-indigo-200 hover:bg-indigo-50/30"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-indigo-100 font-mono text-indigo-700">
                      <span className="text-[10px] uppercase font-bold">Slot</span>
                      <span className="text-sm font-bold">{slot.periodNumber}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{slot.subjectName}</h3>
                      <p className="text-xs font-medium text-indigo-600">{slot.className}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {slot.startTime} - {slot.endTime}
                        </span>
                        {slot.roomNumber && (
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <MapPin className="h-3 w-3 text-indigo-600" />
                            Room {slot.roomNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {(() => {
                    const isSlotClassMarked = data.classesToMarkAttendance?.find(
                      (c) => c.id === slot.classRoomId
                    )?.isAttendanceMarkedToday;

                    return (
                      <Link
                        to={`/attendance/mark?classId=${slot.classRoomId}`}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-inset transition flex items-center gap-1 ${
                          isSlotClassMarked
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                            : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {isSlotClassMarked ? (
                          <>
                            <Pencil className="w-3 h-3 text-emerald-600" /> Edit Attendance
                          </>
                        ) : (
                          'Attendance'
                        )}
                      </Link>
                    );
                  })()}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-700">No classes scheduled for today!</p>
                <p className="text-xs text-slate-400">Enjoy your preparation time or check your full weekly timetable.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right side: Classes for Attendance & Pending Grading & Notices */}
        <div className="space-y-6">
          {/* Quick Attendance Mark */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Your Assigned Classes</h2>
            <p className="mb-3 text-xs text-slate-500">Record or edit interactive daily attendance</p>

            <div className="space-y-2">
              {data.classesToMarkAttendance && data.classesToMarkAttendance.length > 0 ? (
                data.classesToMarkAttendance.map((cls) => {
                  const isMarked = cls.isAttendanceMarkedToday;
                  return (
                    <Link
                      key={cls.id}
                      to={`/attendance/mark?classId=${cls.id}`}
                      className={`flex items-center justify-between rounded-xl p-2.5 border transition ${
                        isMarked
                          ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300'
                          : 'border-slate-100 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-semibold text-slate-800">{cls.fullName}</span>
                        {isMarked ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium mt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Marked Today
                          </span>
                        ) : (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            Not yet marked today
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg border shadow-2xs transition ${
                          isMarked
                            ? 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {isMarked ? (
                          <>
                            <Pencil className="w-3 h-3 text-emerald-600" />
                            Edit Attendance &rarr;
                          </>
                        ) : (
                          <>
                            Mark &rarr;
                          </>
                        )}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400">No classes assigned.</p>
              )}
            </div>
          </div>

          {/* Pending Marks Entry */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Pending Exam Grading</h2>
            <p className="mb-3 text-xs text-slate-500">Exams requiring your score inputs</p>

            <div className="space-y-2.5">
              {data.pendingMarksEntryExams && data.pendingMarksEntryExams.length > 0 ? (
                data.pendingMarksEntryExams.map((es) => (
                  <div key={es.id} className="rounded-lg border border-amber-100 bg-amber-50/50 p-2.5">
                    <p className="text-xs font-semibold text-slate-800">{es.subjectName}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
                      <span>Max: {es.maxMarks} pts</span>
                      <Link
                        to={`/exams/marks?examId=${es.examId}&subjectId=${es.subjectId}`}
                        className="font-semibold text-amber-800 hover:underline"
                      >
                        Enter Marks &rarr;
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckSquare className="h-4 w-4" />
                  <span>All exam grades are up to date!</span>
                </div>
              )}
            </div>
          </div>

          {/* Class Notices Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Class Notices</h2>
                <p className="text-xs text-slate-500">Recent announcements</p>
              </div>
              <Link
                to="/notices"
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
              >
                <Plus className="h-3 w-3" />
                Post Notice
              </Link>
            </div>

            <div className="space-y-2">
              {recentClassNotices.length > 0 ? (
                recentClassNotices.map((n) => (
                  <div key={n.id} className="rounded-lg border border-slate-100 p-2.5 bg-slate-50/60">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 truncate">{n.title}</span>
                      {n.isPinned && <Pin className="h-3 w-3 text-indigo-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{n.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">No notices posted yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboardPage;
