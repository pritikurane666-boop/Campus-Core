import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timetableApi, academicApi, teachersApi, dashboardApi, studentsApi } from '../../api/endpoints';
import { TimetableEntry } from '../../types';
import Modal from '../../components/ui/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { Calendar, Plus, Trash2, Clock, MapPin, User, BookOpen, Lock, Unlock, ShieldAlert, CheckCircle2, AlertTriangle, Layers, UserCheck, Award, Bell, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../store/authContext';
import { getErrorMessage } from '../../utils/errorMessage';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface PeriodColumn {
  periodNumber: number;
  name: string;
  displayTime: string;
  isBreak?: boolean;
  breakType?: 'lunch' | 'short';
  breakTitle?: string;
  breakSub?: string;
}

export const INSTITUTIONAL_GRID_COLUMNS: PeriodColumn[] = [
  {
    periodNumber: 1,
    name: 'Period 1',
    displayTime: '10:15 - 11:15',
  },
  {
    periodNumber: 2,
    name: 'Period 2',
    displayTime: '11:15 - 12:15',
  },
  {
    periodNumber: -1,
    name: 'Lunch Break',
    displayTime: '12:15 - 01:00 PM',
    isBreak: true,
    breakType: 'lunch',
    breakTitle: '🍽️ Lunch Break',
    breakSub: '45 mins (12:15 - 1:00 PM)',
  },
  {
    periodNumber: 3,
    name: 'Period 3',
    displayTime: '01:00 - 02:00 PM',
  },
  {
    periodNumber: 4,
    name: 'Period 4',
    displayTime: '02:00 - 03:00 PM',
  },
  {
    periodNumber: -2,
    name: 'Short Break',
    displayTime: '03:00 - 03:15 PM',
    isBreak: true,
    breakType: 'short',
    breakTitle: '☕ Recess',
    breakSub: '15 mins (3:00 - 3:15 PM)',
  },
  {
    periodNumber: 5,
    name: 'Period 5',
    displayTime: '03:15 - 04:15 PM',
  },
  {
    periodNumber: 6,
    name: 'Period 6',
    displayTime: '04:15 - 05:15 PM',
  },
];

export const PERIOD_TIMINGS: Record<number, { start: string; end: string; display: string }> = {
  1: { start: '10:15', end: '11:15', display: '10:15 AM - 11:15 AM' },
  2: { start: '11:15', end: '12:15', display: '11:15 AM - 12:15 PM' },
  3: { start: '13:00', end: '14:00', display: '01:00 PM - 02:00 PM' },
  4: { start: '14:00', end: '15:00', display: '02:00 PM - 03:00 PM' },
  5: { start: '15:15', end: '16:15', display: '03:15 PM - 04:15 PM' },
  6: { start: '16:15', end: '17:15', display: '04:15 PM - 05:15 PM' },
};

export const TEACHING_PERIODS = [1, 2, 3, 4, 5, 6];

export const TimetablePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('HOD');
  const isTeacher = hasRole('Teacher');
  const isStudent = hasRole('Student');

  const [viewMode, setViewMode] = useState<'class' | 'my-schedule'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday default
  const [periodNumber, setPeriodNumber] = useState(1);
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [startTime, setStartTime] = useState('10:15');
  const [endTime, setEndTime] = useState('11:15');
  const [roomNumber, setRoomNumber] = useState('Room 101');

  const handlePeriodChange = (pNum: number) => {
    setPeriodNumber(pNum);
    const timing = PERIOD_TIMINGS[pNum];
    if (timing) {
      setStartTime(timing.start);
      setEndTime(timing.end);
    }
  };

  // Load student profile to enforce own class timetable isolation
  const { data: myProfile } = useQuery({
    queryKey: ['my-student-profile-timetable'],
    queryFn: studentsApi.getMyProfile,
    enabled: isStudent,
  });

  // Load teacher dashboard for personal teacherId & allocated cohorts
  const { data: teacherDashboard } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: dashboardApi.getTeacher,
    enabled: isTeacher,
  });
  const currentTeacherId = teacherDashboard?.teacherId;

  // Load teacher's personal timetable
  const { data: teacherTimetable } = useQuery({
    queryKey: ['timetable-teacher', currentTeacherId],
    queryFn: () => timetableApi.getByTeacher(currentTeacherId!),
    enabled: isTeacher && !!currentTeacherId,
  });

  // Load classes (only needed for staff/admin selection)
  const { data: classes } = useQuery({
    queryKey: ['classes-list'],
    queryFn: academicApi.getClasses,
    enabled: !isStudent,
  });

  React.useEffect(() => {
    if (isStudent && myProfile?.classRoomId) {
      setSelectedClassId(myProfile.classRoomId);
    } else if (!isStudent && classes && classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [isStudent, myProfile, classes, selectedClassId]);

  const selectedClass = classes?.find((c) => c.id === selectedClassId);
  const academicYearId = selectedClass?.academicYearId;

  // Load teachers for fallback selection
  const { data: teachers } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: teachersApi.getList,
  });

  // STRICT REQUIREMENT: Only load subjects ALLOCATED to the selected class
  const { data: classSubjects, isLoading: isSubjectsLoading } = useQuery({
    queryKey: ['class-subjects', selectedClassId],
    queryFn: () => academicApi.getClassSubjects(selectedClassId),
    enabled: !!selectedClassId,
  });

  // Load Academic Year Lock / Fixed status
  const { data: yearStatus, refetch: refetchYearStatus } = useQuery({
    queryKey: ['timetable-year-status', academicYearId],
    queryFn: () => timetableApi.getYearStatus(academicYearId!),
    enabled: !!academicYearId,
  });

  // Load timetable for active class
  const { data: timetable, isLoading } = useQuery({
    queryKey: ['timetable-class', selectedClassId],
    queryFn: () => timetableApi.getByClass(selectedClassId),
    enabled: !!selectedClassId,
  });

  const isTimetableLocked = !!yearStatus?.isFixed;

  const fixYearMutation = useMutation({
    mutationFn: (yearId: string) => timetableApi.fixYear(yearId),
    onSuccess: (res: any) => {
      refetchYearStatus();
      queryClient.invalidateQueries({ queryKey: ['timetable-year-status'] });
      alert(res?.message || 'Timetable has been officially fixed and locked for this academic year!');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const unfixYearMutation = useMutation({
    mutationFn: (yearId: string) => timetableApi.unfixYear(yearId),
    onSuccess: (res: any) => {
      refetchYearStatus();
      queryClient.invalidateQueries({ queryKey: ['timetable-year-status'] });
      alert(res?.message || 'Timetable unlocked for adjustments.');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const handleToggleFixTimetable = () => {
    if (!academicYearId) {
      alert('Academic year is not specified for this classroom cohort.');
      return;
    }

    if (isTimetableLocked) {
      if (
        window.confirm(
          `Are you sure you want to UNLOCK the timetable for ${yearStatus?.academicYearName || 'this year'}?\n\nThis will allow administrators to edit and delete periods.`
        )
      ) {
        unfixYearMutation.mutate(academicYearId);
      }
    } else {
      if (
        window.confirm(
          `Do you want to FIX AND PUBLISH the timetable for Academic Year "${selectedClass?.academicYearName || yearStatus?.academicYearName || 'Current'}"?\n\nOnce fixed, scheduled periods are protected against accidental modifications.`
        )
      ) {
        fixYearMutation.mutate(academicYearId);
      }
    }
  };

  const createSlotMutation = useMutation({
    mutationFn: (data: any) => timetableApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-class', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['timetable-teacher'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      setIsAddModalOpen(false);
      setSubjectId('');
      setTeacherId('');
      alert('Timetable period scheduled successfully!');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: (id: string) => timetableApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-class', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['timetable-teacher'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  // Auto-fill teacher when subject is picked
  const handleSubjectChange = (subId: string) => {
    setSubjectId(subId);
    const chosen = classSubjects?.find((s) => s.id === subId);
    if (chosen && chosen.teacherId) {
      setTeacherId(chosen.teacherId);
    }
  };

  // Find slot for day & period based on viewMode
  const activeEntries = viewMode === 'my-schedule' ? teacherTimetable : timetable;

  const getSlot = (dayIdx: number, period: number) => {
    return activeEntries?.find((t) => {
      const dayMatches =
        typeof t.dayOfWeek === 'number'
          ? t.dayOfWeek === dayIdx
          : String(t.dayOfWeek).toLowerCase() === DAYS[dayIdx]?.toLowerCase();
      return dayMatches && t.periodNumber === period;
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isStudent ? 'My Class Weekly Timetable' : viewMode === 'my-schedule' ? 'My Teaching Timetable' : 'Institutional Timetable'}
            </h1>
            {isTimetableLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800 shadow-2xs">
                <Lock className="h-3 w-3" /> Fixed & Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shadow-2xs">
                <Unlock className="h-3 w-3" /> In Draft Mode
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {isStudent
              ? 'Your weekly lecture schedule: period timings, subject allocations, faculty instructors and classroom numbers'
              : viewMode === 'my-schedule'
              ? 'Your personal lecture schedule: where, when, and what subject you are teaching each week'
              : 'Interactive weekly schedule matrix, teacher allocations and lecture period distribution'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isStudent ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-1.5 text-xs font-bold text-indigo-900 flex items-center gap-2 shadow-2xs">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                <span>Enrolled Class: <strong className="text-indigo-950 font-extrabold">{myProfile?.className || selectedClass?.fullName || 'Your Class'}</strong></span>
              </div>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/exams"
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs transition"
              >
                <Award className="h-3.5 w-3.5 text-indigo-600" />
                <span>My Exams & Marks</span>
              </Link>
              <Link
                to="/notices"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition"
              >
                <Bell className="h-3.5 w-3.5 text-slate-500" />
                <span>Notices</span>
              </Link>
            </div>
          ) : viewMode === 'class' ? (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
            >
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-600" />
              <span>{teacherDashboard?.teacherName || 'Faculty Schedule'}</span>
            </div>
          )}

          {/* Option to Fix the Timetable for that year */}
          {isAdmin && academicYearId && (
            <button
              onClick={handleToggleFixTimetable}
              disabled={fixYearMutation.isPending || unfixYearMutation.isPending}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold shadow-sm transition ${
                isTimetableLocked
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
              title={
                isTimetableLocked
                  ? 'Click to unlock timetable for editing'
                  : 'Click to lock and fix the schedule for the entire academic year'
              }
            >
              {isTimetableLocked ? (
                <>
                  <Unlock className="h-4 w-4" />
                  <span>Unlock Timetable</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Fix Timetable for {selectedClass?.academicYearName || 'Year'}</span>
                </>
              )}
            </button>
          )}

          {!isStudent && (
            <button
              onClick={() => {
                if (classSubjects && classSubjects.length > 0) {
                  setSubjectId(classSubjects[0].id);
                  if (classSubjects[0].teacherId) {
                    setTeacherId(classSubjects[0].teacherId);
                  }
                }
                setIsAddModalOpen(true);
              }}
              disabled={!selectedClassId || isTimetableLocked}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
              title={isTimetableLocked ? 'Timetable is fixed for this academic year. Unlock to add periods.' : 'Add Period'}
            >
              <Plus className="h-4 w-4" />
              Add Period
            </button>
          )}
        </div>
      </div>

      {/* View Mode Toggle for Teachers */}
      {isTeacher && (
        <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
          <div className="inline-flex rounded-lg bg-slate-200/80 p-1">
            <button
              type="button"
              onClick={() => setViewMode('class')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-bold transition ${
                viewMode === 'class'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Class Timetable ({selectedClass?.fullName || 'Cohort'})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('my-schedule')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-bold transition ${
                viewMode === 'my-schedule'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="h-4 w-4" />
              My Teaching Schedule (Where & When I Have Class)
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {viewMode === 'my-schedule' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 font-bold text-indigo-800">
                <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                Teaching Schedule for {teacherDashboard?.teacherName || 'Faculty'} ({teacherTimetable?.length || 0} periods scheduled)
              </span>
            ) : (
              <span className="text-slate-500 font-medium">
                Viewing schedule for classroom cohort: <strong className="text-slate-800">{selectedClass?.fullName}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Lock Notification Banner */}
      {isTimetableLocked && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-indigo-50/40 p-4 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">
                Official Timetable is Fixed & Locked for Academic Year {yearStatus?.academicYearName || selectedClass?.academicYearName}
              </p>
              <p className="text-slate-600 mt-0.5">
                The institutional lecture schedule is verified and locked to prevent accidental period changes.
                {yearStatus?.fixedAt && ` Locked on ${new Date(yearStatus.fixedAt).toLocaleDateString()} at ${new Date(yearStatus.fixedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={handleToggleFixTimetable}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs shrink-0"
            >
              <Unlock className="h-3.5 w-3.5 text-amber-600" />
              <span>Modify / Unlock</span>
            </button>
          )}
        </div>
      )}

      {/* Class Subjects Allocation Status Pill Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 shadow-2xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold text-slate-800">
            {selectedClass?.fullName} Syllabus Subjects:
          </span>
          <span className="font-bold text-indigo-700">
            {classSubjects?.length || 0} subjects linked
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {classSubjects && classSubjects.length > 0 ? (
            classSubjects.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-150 px-2 py-0.5 text-[11px] font-medium text-indigo-800"
              >
                <span className="font-bold">{s.code}</span>
                <span className="opacity-75">• {s.name}</span>
                {s.teacherName && (
                  <span className="text-[10px] text-indigo-600">({s.teacherName})</span>
                )}
              </span>
            ))
          ) : (
            <span className="text-amber-700 italic flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              No subjects linked to this class yet. Go to Classes & Subjects to add syllabus curriculum.
            </span>
          )}
        </div>
      </div>

      {/* Institutional Class & Break Schedule Strip */}
      <div className="rounded-xl border border-indigo-150 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50 p-3.5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-2xs shrink-0">
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Official Institutional Period Schedule
              </h3>
              <p className="text-[11px] text-slate-500">
                60-min lecture blocks with official lunch break and afternoon recess
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700 shadow-2xs">
              P1: <span className="text-indigo-600">10:15 - 11:15</span>
            </span>
            <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700 shadow-2xs">
              P2: <span className="text-indigo-600">11:15 - 12:15</span>
            </span>
            <span className="rounded-md bg-amber-100/70 border border-amber-200 px-2 py-1 font-bold text-amber-900 shadow-2xs flex items-center gap-1">
              🍽️ Lunch: 12:15 - 1:00 PM
            </span>
            <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700 shadow-2xs">
              P3: <span className="text-indigo-600">1:00 - 2:00 PM</span>
            </span>
            <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700 shadow-2xs">
              P4: <span className="text-indigo-600">2:00 - 3:00 PM</span>
            </span>
            <span className="rounded-md bg-teal-100/70 border border-teal-200 px-2 py-1 font-bold text-teal-900 shadow-2xs flex items-center gap-1">
              ☕ Recess: 3:00 - 3:15 PM
            </span>
            <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700 shadow-2xs">
              P5: <span className="text-indigo-600">3:15 - 4:15 PM</span>
            </span>
            <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700 shadow-2xs">
              P6: <span className="text-indigo-600">4:15 - 5:15 PM</span>
            </span>
          </div>
        </div>
      </div>

      {/* Weekly Matrix Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead>
            <tr className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
              <th className="px-4 py-3.5 whitespace-nowrap">Day</th>
              {INSTITUTIONAL_GRID_COLUMNS.map((col) => {
                if (col.isBreak) {
                  return (
                    <th
                      key={col.name}
                      className={`px-3 py-3 text-center min-w-[130px] ${
                        col.breakType === 'lunch'
                          ? 'bg-amber-50/80 border-x border-amber-200/70 text-amber-900'
                          : 'bg-teal-50/80 border-x border-teal-200/70 text-teal-900'
                      }`}
                    >
                      <div className="font-bold text-xs">{col.breakTitle}</div>
                      <div className="text-[10px] font-semibold opacity-85 tracking-normal normal-case">
                        {col.displayTime}
                      </div>
                    </th>
                  );
                }

                return (
                  <th key={col.periodNumber} className="px-3 py-3 text-center min-w-[160px]">
                    <div className="font-bold text-slate-900">{col.name}</div>
                    <div className="text-[10px] font-semibold text-indigo-600 tracking-normal normal-case">
                      {col.displayTime}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {[1, 2, 3, 4, 5, 6].map((dayIdx) => (
              <tr key={dayIdx} className="hover:bg-slate-50/50">
                <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-900 border-r border-slate-100">
                  {DAYS[dayIdx]}
                </td>
                {INSTITUTIONAL_GRID_COLUMNS.map((col) => {
                  if (col.isBreak) {
                    return (
                      <td
                        key={col.name}
                        className={`p-2 text-center align-middle ${
                          col.breakType === 'lunch'
                            ? 'bg-amber-50/30 border-x border-amber-150'
                            : 'bg-teal-50/30 border-x border-teal-150'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center py-3 px-1 rounded-lg border border-dashed border-slate-200/90 text-[11px] font-bold text-slate-600 bg-white/60">
                          <span>{col.breakTitle}</span>
                          <span className="text-[10px] font-medium opacity-75 mt-0.5">{col.displayTime}</span>
                        </div>
                      </td>
                    );
                  }

                  const slot = getSlot(dayIdx, col.periodNumber);

                  return (
                    <td key={col.periodNumber} className="min-w-[160px] p-2 align-top">
                      {isLoading ? (
                        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 space-y-2 animate-fade-in">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      ) : slot ? (
                        <div className="group relative rounded-lg border border-indigo-100 bg-indigo-50/60 p-2.5 transition-all duration-200 ease-out hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md hover:-translate-y-0.5 shadow-2xs">
                          <p className="font-bold text-slate-900 text-xs">{slot.subjectName}</p>
                          {viewMode === 'my-schedule' ? (
                            <p className="mt-0.5 text-[11px] font-bold text-indigo-800 flex items-center gap-1">
                              <BookOpen className="h-3 w-3 shrink-0 text-indigo-600" />
                              <span className="truncate">{slot.className}</span>
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] font-medium text-indigo-700 flex items-center gap-1">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">{slot.teacherName}</span>
                            </p>
                          )}
                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="flex items-center gap-0.5 font-mono font-medium text-indigo-600">
                              <Clock className="h-2.5 w-2.5" />
                              {slot.startTime} - {slot.endTime}
                            </span>
                            {slot.roomNumber && (
                              <span className="flex items-center gap-0.5 bg-white border border-slate-200 rounded px-1 py-0.5 font-medium">
                                <MapPin className="h-2.5 w-2.5 text-slate-400" />
                                {slot.roomNumber}
                              </span>
                            )}
                          </div>

                          {!isTimetableLocked && !isStudent && (
                            <button
                              onClick={() => {
                                const confirmMsg =
                                  viewMode === 'my-schedule'
                                    ? `Remove ${col.name} (${slot.subjectName} in ${slot.className})?`
                                    : `Remove ${col.name} (${slot.subjectName}) for ${DAYS[dayIdx]}?`;
                                if (window.confirm(confirmMsg)) {
                                  deleteSlotMutation.mutate(slot.id);
                                }
                              }}
                              className="absolute right-1 top-1 hidden rounded p-1 text-rose-500 hover:bg-rose-100 group-hover:block transition"
                              title="Remove Period"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ) : isStudent ? (
                        <div className="flex h-20 w-full flex-col items-center justify-center rounded-lg border border-slate-100 bg-slate-50/50 text-slate-300 select-none">
                          <span className="text-sm font-semibold text-slate-300">—</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Free Period</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (isTimetableLocked) {
                              alert('Timetable is fixed and locked for this academic year.');
                              return;
                            }
                            setDayOfWeek(dayIdx);
                            handlePeriodChange(col.periodNumber);
                            if (classSubjects && classSubjects.length > 0) {
                              setSubjectId(classSubjects[0].id);
                              if (classSubjects[0].teacherId) {
                                setTeacherId(classSubjects[0].teacherId);
                              } else if (currentTeacherId) {
                                setTeacherId(currentTeacherId);
                              }
                            }
                            setIsAddModalOpen(true);
                          }}
                          disabled={isTimetableLocked}
                          className="flex h-20 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20 hover:text-indigo-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-slate-200 disabled:hover:text-slate-300 transition group"
                          title={isTimetableLocked ? 'Timetable is locked for this year' : `Add ${col.name} (${col.displayTime})`}
                        >
                          <Plus className="h-4 w-4 group-hover:scale-110 transition" />
                          <span className="text-[10px] font-medium opacity-60 mt-0.5">{col.displayTime}</span>
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Slot Modal */}
      {!isStudent && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title={`Schedule Timetable Period — ${selectedClass?.fullName || 'Classroom'}`}
        >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Classroom Cohort *</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSubjectId('');
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
            >
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Day of Week *</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    {DAYS[d]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Period Slot *</label>
              <select
                value={periodNumber}
                onChange={(e) => handlePeriodChange(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                {TEACHING_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    Period {p} ({PERIOD_TIMINGS[p]?.display})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Institutional timing alert card */}
          <div className="rounded-lg border border-indigo-150 bg-indigo-50/70 p-3 text-xs text-indigo-950">
            <div className="flex items-center justify-between font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                Slot Timing: {PERIOD_TIMINGS[periodNumber]?.display || `${startTime} - ${endTime}`}
              </span>
              <span className="rounded bg-indigo-600 text-white px-2 py-0.5 text-[10px]">60 Minutes</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Institutional Breaks: Lunch (12:15 PM - 1:00 PM) • Afternoon Recess (3:00 PM - 3:15 PM)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Classroom Subject *
              </label>
              {classSubjects && classSubjects.length > 0 ? (
                <select
                  value={subjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- Choose Class Subject --</option>
                  {classSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) {s.teacherName ? `• Faculty: ${s.teacherName}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                  No subjects linked to this class. Please link subjects to this class first.
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 block">
                Showing strictly subjects allocated to {selectedClass?.fullName}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Assigned Faculty *</label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="">-- Choose Faculty --</option>
                {teachers?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.employeeCode}) {t.specialization ? `— ${t.specialization}` : ''}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-indigo-600 mt-1 block">
                Auto-selected from subject's allocated faculty
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Start Time</label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="10:15"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50/50 p-2 text-xs font-mono font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">End Time</label>
              <input
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="11:15"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50/50 p-2 text-xs font-mono font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Room #</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="Room 101"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!subjectId || !teacherId) {
                  alert('Please select both a classroom subject and an assigned teacher.');
                  return;
                }
                createSlotMutation.mutate({
                  classRoomId: selectedClassId,
                  subjectId,
                  teacherId,
                  dayOfWeek,
                  periodNumber,
                  startTime,
                  endTime,
                  roomNumber,
                });
              }}
              disabled={createSlotMutation.isPending || !subjectId || !teacherId}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createSlotMutation.isPending ? 'Scheduling Period...' : 'Confirm Schedule'}
            </button>
          </div>
        </div>
      </Modal>
      )}
    </div>
  );
};
