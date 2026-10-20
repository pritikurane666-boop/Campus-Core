import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { attendanceApi, academicApi, studentsApi } from '../../api/endpoints';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  CheckCheck,
  Save,
  Users,
  AlertCircle,
  RotateCcw,
  LayoutGrid,
  List,
  Sparkles,
  Pencil,
  X,
} from 'lucide-react';
import { useAuth } from '../../store/authContext';
import { Skeleton } from '../../components/common/Skeleton';

export const MarkAttendancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isTeacher = hasRole('Teacher');
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get('classId') || '';

  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewStyle, setViewStyle] = useState<'cards' | 'table'>('cards');
  const [isEditing, setIsEditing] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<
    {
      studentId: string;
      rollNumber: string;
      studentName: string;
      status: 'Present' | 'Absent' | 'Unmarked' | 'Late' | 'Excused';
      remarks: string;
    }[]
  >([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch classes (for teachers, backend automatically returns only their allocated classes)
  const { data: classes } = useQuery({
    queryKey: ['classes-list'],
    queryFn: academicApi.getClasses,
  });

  useEffect(() => {
    if (classes && classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Fetch students for selected class
  const { data: studentsData, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['students-class-att', selectedClassId],
    queryFn: () => studentsApi.getList({ classId: selectedClassId, pageSize: 100 }),
    enabled: !!selectedClassId,
  });

  // Fetch already marked attendance for date
  const { data: existingAttendance } = useQuery({
    queryKey: ['attendance-existing', selectedClassId, selectedDate],
    queryFn: () => attendanceApi.getClass(selectedClassId, selectedDate),
    enabled: !!selectedClassId,
  });

  // Check if attendance is already recorded for this class & date
  const isAlreadyMarked = Boolean(
    existingAttendance?.isMarked ||
    (existingAttendance?.records && existingAttendance.records.some((r) => r.id && r.id !== '00000000-0000-0000-0000-000000000000'))
  );

  // Reset editing mode whenever class or date changes
  useEffect(() => {
    setIsEditing(false);
  }, [selectedClassId, selectedDate]);

  // Sync students and existing attendance into local state
  useEffect(() => {
    if (!studentsData?.items) return;

    const hasMarkedData = Boolean(
      existingAttendance?.isMarked ||
      (existingAttendance?.records && existingAttendance.records.some((r) => r.id && r.id !== '00000000-0000-0000-0000-000000000000'))
    );

    const records = studentsData.items.map((s) => {
      const existing = existingAttendance?.records?.find((r) => r.studentId === s.id);
      return {
        studentId: s.id,
        rollNumber: s.rollNumber,
        studentName: s.fullName,
        // If marked, use recorded status (or Present). If unmarked, start as 'Unmarked' (White card)
        status: hasMarkedData ? ((existing?.status as any) || 'Present') : 'Unmarked',
        remarks: existing?.remarks || '',
      };
    });

    setAttendanceRecords(records);
  }, [studentsData, existingAttendance]);

  const markMutation = useMutation({
    mutationFn: (data: any) => attendanceApi.mark(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-existing', selectedClassId, selectedDate] });
      setSuccessMessage(isAlreadyMarked ? 'Attendance updated successfully!' : 'Attendance recorded successfully! Absence SMS/Email notifications queued.');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      alert(`Failed to save attendance: ${err.response?.data?.detail || err.message}`);
    },
  });

  const handleCancelEdit = () => {
    if (!studentsData?.items) return;
    const records = studentsData.items.map((s) => {
      const existing = existingAttendance?.records?.find((r) => r.studentId === s.id);
      return {
        studentId: s.id,
        rollNumber: s.rollNumber,
        studentName: s.fullName,
        status: (existing?.status as any) || 'Present',
        remarks: existing?.remarks || '',
      };
    });
    setAttendanceRecords(records);
    setIsEditing(false);
  };

  // Click card handler: toggles between Present (Green) and Absent (Red), initial is White
  const handleCardClick = (studentId: string) => {
    if (isAlreadyMarked && !isEditing) {
      setIsEditing(true);
    }
    setAttendanceRecords((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        if (r.status === 'Unmarked') {
          return { ...r, status: 'Present' };
        } else if (r.status === 'Present') {
          return { ...r, status: 'Absent' };
        } else {
          return { ...r, status: 'Present' };
        }
      })
    );
  };

  const handleMarkAllPresent = () => {
    setAttendanceRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status: 'Present',
      }))
    );
  };

  const handleMarkAllAbsent = () => {
    setAttendanceRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status: 'Absent',
      }))
    );
  };

  const handleResetToWhite = () => {
    setAttendanceRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status: 'Unmarked',
      }))
    );
  };

  const updateStudentStatus = (studentId: string, status: 'Present' | 'Absent' | 'Late' | 'Excused' | 'Unmarked') => {
    if (isAlreadyMarked && !isEditing) {
      setIsEditing(true);
    }
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r))
    );
  };

  const updateStudentRemarks = (studentId: string, remarks: string) => {
    if (isAlreadyMarked && !isEditing) {
      setIsEditing(true);
    }
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, remarks } : r))
    );
  };

  const handleSave = () => {
    // Treat any untouched/unmarked as Present when saving
    const payloadRecords = attendanceRecords.map((r) => ({
      studentId: r.studentId,
      status: r.status === 'Absent' ? 'Absent' : r.status === 'Late' ? 'Late' : r.status === 'Excused' ? 'Excused' : 'Present',
      remarks: r.remarks || undefined,
    }));

    markMutation.mutate({
      classRoomId: selectedClassId,
      date: selectedDate,
      records: payloadRecords,
    });
  };

  const presentCount = attendanceRecords.filter((r) => r.status === 'Present' || r.status === 'Late').length;
  const absentCount = attendanceRecords.filter((r) => r.status === 'Absent').length;
  const unmarkedCount = attendanceRecords.filter((r) => r.status === 'Unmarked').length;
  const totalCount = attendanceRecords.length;
  const turnoutPct = totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : '0';

  const selectedClass = classes?.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isAlreadyMarked
                ? isEditing
                  ? 'Edit Class Attendance'
                  : 'Class Attendance Roll'
                : 'Mark Student Attendance'}
            </h1>
            {isAlreadyMarked ? (
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold flex items-center gap-1 ${
                isEditing
                  ? 'bg-amber-100 border-amber-200 text-amber-800'
                  : 'bg-emerald-100 border-emerald-200 text-emerald-800'
              }`}>
                {isEditing ? (
                  <>
                    <Pencil className="w-3.5 h-3.5 text-amber-600" /> Editing Mode
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Attendance Marked
                  </>
                )}
              </span>
            ) : (
              <span className="rounded-full bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                {isTeacher ? 'Teacher Roll Call' : 'Class Roll Call'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {isAlreadyMarked
              ? isEditing
                ? 'Modifying recorded attendance. Click student cards to toggle status, then click Update Attendance.'
                : 'Attendance for this session has already been recorded. Click Edit Attendance below to make updates.'
              : 'Click on student cards to toggle attendance: Initial is White, Green is Present, Red is Absent.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200 mr-2">
            <button
              type="button"
              onClick={() => setViewStyle('cards')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                viewStyle === 'cards' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards Grid
            </button>
            <button
              type="button"
              onClick={() => setViewStyle('table')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                viewStyle === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Table View
            </button>
          </div>

          {isAlreadyMarked && !isEditing ? (
            /* WHEN ATTENDANCE HAS ALREADY BEEN MARKED: TEACHER ONLY SEES "EDIT ATTENDANCE"! */
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <Pencil className="h-4 w-4" />
              Edit Attendance
            </button>
          ) : (
            /* WHEN UNMARKED OR IN ACTIVE EDIT MODE */
            <>
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-100 transition"
              >
                <CheckCheck className="h-4 w-4 text-emerald-600" />
                All Present
              </button>
              <button
                type="button"
                onClick={handleMarkAllAbsent}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 shadow-sm hover:bg-rose-100 transition"
              >
                <XCircle className="h-4 w-4 text-rose-600" />
                All Absent
              </button>

              {isEditing ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                >
                  <X className="h-3.5 w-3.5 text-slate-500" />
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetToWhite}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                  title="Reset cards to white unmarked state"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  Reset
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={markMutation.isPending || attendanceRecords.length === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition ${
                  isEditing ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <Save className="h-4 w-4" />
                {markMutation.isPending
                  ? isEditing
                    ? 'Updating...'
                    : 'Saving...'
                  : isEditing
                  ? 'Update Attendance'
                  : 'Save Attendance'}
              </button>
            </>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filter Row: Class & Date & Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Classroom Cohort *</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
          >
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {isTeacher ? 'Showing your assigned class cohort only' : 'All institutional classes'}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Attendance Date *</label>
          <div className="mt-1 flex items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="col-span-2 grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-3 border border-slate-100">
          <div className="text-center border-r border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400">Total</span>
            <p className="text-base font-bold text-slate-900">{totalCount}</p>
          </div>
          <div className="text-center border-r border-slate-200">
            <span className="text-[10px] font-bold uppercase text-emerald-600">Present (Green)</span>
            <p className="text-base font-bold text-emerald-700">{presentCount}</p>
          </div>
          <div className="text-center border-r border-slate-200">
            <span className="text-[10px] font-bold uppercase text-rose-600">Absent (Red)</span>
            <p className="text-base font-bold text-rose-700">{absentCount}</p>
          </div>
          <div className="text-center">
            <span className="text-[10px] font-bold uppercase text-indigo-600">
              {isAlreadyMarked ? 'Turnout' : 'Initial (White)'}
            </span>
            <p className="text-base font-bold text-indigo-700">
              {isAlreadyMarked ? `${turnoutPct}%` : unmarkedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Guide / Status Banner for Teachers */}
      {isAlreadyMarked && !isEditing ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Attendance Already Recorded:</strong> Turnout is <strong>{turnoutPct}%</strong> ({presentCount} Present, {absentCount} Absent). To modify student records, click <strong>Edit Attendance</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Attendance
          </button>
        </div>
      ) : isEditing ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Pencil className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Editing Recorded Attendance:</strong> Click student cards to toggle status between Present and Absent. When finished, click <strong>Update Attendance</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition shrink-0"
          >
            <X className="h-3 w-3" />
            Exit Edit
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-indigo-150 bg-gradient-to-r from-indigo-50/80 via-purple-50/30 to-white px-4 py-3 text-xs text-slate-700 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Interactive Attendance Mode:</strong> Click any student card to mark. Card is{' '}
              <strong className="text-slate-800">WHITE</strong> initially, clicks to{' '}
              <strong className="text-emerald-700">GREEN (Present)</strong>, and clicks again to{' '}
              <strong className="text-rose-700">RED (Absent)</strong>.
            </span>
          </div>
          <span className="font-semibold text-slate-500 text-[11px] shrink-0">
            Turnout: <strong className="text-indigo-700">{turnoutPct}%</strong>
          </span>
        </div>
      )}

      {/* MAIN VIEW: Interactive Cards Block Grid */}
      {viewStyle === 'cards' ? (
        <div>
          {isStudentsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 animate-fade-in">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col justify-between rounded-xl p-4 bg-white border-2 border-slate-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-8 rounded" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-6 w-full rounded-md" />
                </div>
              ))}
            </div>
          ) : attendanceRecords.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {attendanceRecords.map((rec) => {
                const isWhite = rec.status === 'Unmarked';
                const isPresent = rec.status === 'Present' || rec.status === 'Late';
                const isAbsent = rec.status === 'Absent';

                return (
                  <div
                    key={rec.studentId}
                    onClick={() => handleCardClick(rec.studentId)}
                    className={`relative flex flex-col justify-between rounded-xl p-4 transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                      isWhite
                        ? 'bg-white text-slate-800 border-2 border-slate-200 hover:border-indigo-400 hover:shadow-md'
                        : isPresent
                        ? 'bg-emerald-600 text-white border-2 border-emerald-700 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-300'
                        : 'bg-rose-600 text-white border-2 border-rose-700 shadow-md shadow-rose-600/30 ring-2 ring-rose-300'
                    }`}
                  >
                    {/* Top Row: Roll Number & Status Icon */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                          isWhite
                            ? 'bg-slate-100 text-indigo-700 border border-slate-200'
                            : 'bg-white/20 text-white'
                        }`}
                      >
                        Roll: {rec.rollNumber}
                      </span>
                      {isWhite && <span className="h-3 w-3 rounded-full border-2 border-slate-300" />}
                      {isPresent && <CheckCircle2 className="h-4 w-4 text-emerald-100" />}
                      {isAbsent && <XCircle className="h-4 w-4 text-rose-100" />}
                    </div>

                    {/* Middle: Student Full Name */}
                    <div className="my-3 text-center">
                      <h3
                        className={`text-sm font-bold truncate leading-tight ${
                          isWhite ? 'text-slate-900' : 'text-white'
                        }`}
                        title={rec.studentName}
                      >
                        {rec.studentName}
                      </h3>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          isWhite ? 'text-slate-400' : 'text-white/80'
                        }`}
                      >
                        {selectedClass?.fullName || 'Student'}
                      </p>
                    </div>

                    {/* Bottom: Interactive Status Pill */}
                    <div className="text-center pt-2 border-t border-slate-100/30">
                      {isWhite && (
                        <span className="inline-block rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 w-full">
                          ⚪ Click to Mark
                        </span>
                      )}
                      {isPresent && (
                        <span className="inline-block rounded-md bg-white/20 border border-white/30 px-2 py-1 text-[11px] font-bold text-white w-full uppercase tracking-wider">
                          ✓ PRESENT
                        </span>
                      )}
                      {isAbsent && (
                        <span className="inline-block rounded-md bg-white/20 border border-white/30 px-2 py-1 text-[11px] font-bold text-white w-full uppercase tracking-wider">
                          ✕ ABSENT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
              <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No students enrolled in this class cohort.</p>
              <p className="text-xs text-slate-400">Students will appear once assigned to {selectedClass?.fullName}.</p>
            </div>
          )}
        </div>
      ) : (
        /* SECONDARY VIEW: Table View with Remarks */
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead>
              <tr className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3.5">Roll No</th>
                <th className="px-4 py-3.5">Student Name</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Remarks / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isStudentsLoading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Loading class students...
                  </td>
                </tr>
              ) : attendanceRecords.length > 0 ? (
                attendanceRecords.map((rec) => (
                  <tr key={rec.studentId} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">{rec.rollNumber}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{rec.studentName}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => updateStudentStatus(rec.studentId, 'Present')}
                          className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                            rec.status === 'Present'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStudentStatus(rec.studentId, 'Absent')}
                          className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                            rec.status === 'Absent'
                              ? 'bg-rose-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Absent
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStudentStatus(rec.studentId, 'Unmarked')}
                          className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                            rec.status === 'Unmarked'
                              ? 'bg-slate-200 text-slate-800'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          White (Reset)
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="e.g. Doctor appointment, illness..."
                        value={rec.remarks}
                        onChange={(e) => updateStudentRemarks(rec.studentId, e.target.value)}
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No students found in this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MarkAttendancePage;
