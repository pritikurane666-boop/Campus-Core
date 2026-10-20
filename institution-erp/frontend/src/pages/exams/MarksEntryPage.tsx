import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { examsApi, academicApi, dashboardApi } from '../../api/endpoints';
import { useAuth } from '../../store/authContext';
import {
  Save,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Award,
  BookOpen,
  Calendar,
  Lock,
  UserCheck,
  Check,
  XCircle,
  Eye,
} from 'lucide-react';

export const MarksEntryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = hasRole('Principal');
  const isTeacher = hasRole('Teacher');

  const examIdParam = searchParams.get('examId') || '';
  const subjectIdParam = searchParams.get('subjectId') || '';

  const [selectedExamId, setSelectedExamId] = useState(examIdParam);
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjectIdParam);
  const [marksState, setMarksState] = useState<
    {
      studentId: string;
      rollNumber: string;
      studentName: string;
      marksObtained: number;
      maxMarks: number;
      passMarks: number;
      isAbsent: boolean;
      remarks: string;
      hasSavedMark: boolean;
    }[]
  >([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch all exams
  const { data: exams, isLoading: isExamsLoading } = useQuery({
    queryKey: ['exams-list'],
    queryFn: () => examsApi.getList(),
  });

  // Auto-select first exam if none selected
  useEffect(() => {
    if (exams && exams.length > 0 && !selectedExamId) {
      const firstExam = exams[0];
      setSelectedExamId(firstExam.id);
      if (firstExam.subjects && firstExam.subjects.length > 0) {
        setSelectedSubjectId(firstExam.subjects[0].subjectId);
        setSearchParams({ examId: firstExam.id, subjectId: firstExam.subjects[0].subjectId });
      } else {
        setSearchParams({ examId: firstExam.id });
      }
    }
  }, [exams, selectedExamId, setSearchParams]);

  // Current exam details
  const activeExam = exams?.find((e) => e.id === selectedExamId);

  // Auto-select first subject when activeExam loads or changes
  useEffect(() => {
    if (activeExam && activeExam.subjects && activeExam.subjects.length > 0) {
      const found = activeExam.subjects.find(
        (s) => s.subjectId === selectedSubjectId || s.id === selectedSubjectId
      );
      if (!found) {
        const defaultSubId = activeExam.subjects[0].subjectId;
        setSelectedSubjectId(defaultSubId);
        setSearchParams({ examId: selectedExamId, subjectId: defaultSubId });
      }
    }
  }, [activeExam, selectedExamId, selectedSubjectId, setSearchParams]);

  const activeExamSubject = activeExam?.subjects?.find(
    (s) => s.subjectId === selectedSubjectId || s.id === selectedSubjectId
  );

  // Fetch teacher dashboard for current teacherId
  const { data: teacherDashboard } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: dashboardApi.getTeacher,
    enabled: isTeacher,
  });
  const currentTeacherId = teacherDashboard?.teacherId;

  // Fetch class syllabus subjects to determine assigned faculty
  const { data: classSubjects } = useQuery({
    queryKey: ['class-subjects', activeExam?.classRoomId],
    queryFn: () => academicApi.getClassSubjects(activeExam!.classRoomId),
    enabled: !!activeExam?.classRoomId,
  });

  const currentClassSubject = classSubjects?.find(
    (cs) => cs.id === selectedSubjectId || cs.id === activeExamSubject?.subjectId
  );

  // Strict check: Is the logged-in teacher allocated to teach this subject in this class?
  const isMySubject =
    isTeacher &&
    (activeExamSubject?.canCurrentUserEdit ??
      (!!currentTeacherId &&
        ((currentClassSubject && currentClassSubject.teacherId === currentTeacherId) ||
          ((activeExamSubject as any)?.teacherId === currentTeacherId))));

  const canEditMarks = isTeacher && !isAdmin && isMySubject && !activeExam?.isLocked;

  // Fetch marks for selected exam & subject
  const {
    data: marksData,
    isLoading: isMarksLoading,
    refetch: refetchMarks,
  } = useQuery({
    queryKey: ['exam-marks', selectedExamId, selectedSubjectId],
    queryFn: () => examsApi.getMarks(selectedExamId, selectedSubjectId),
    enabled: !!selectedExamId && !!selectedSubjectId,
  });

  useEffect(() => {
    if (marksData) {
      setMarksState(
        marksData.map((m: any) => ({
          studentId: m.studentId,
          rollNumber: m.rollNumber || 'N/A',
          studentName: m.studentName || 'Student',
          marksObtained: m.marksObtained ?? 0,
          maxMarks: m.maxMarks ?? (activeExamSubject?.maxMarks || 100),
          passMarks: m.passMarks ?? (activeExamSubject?.passMarks || 35),
          isAbsent: m.isAbsent ?? false,
          remarks: m.remarks || '',
          hasSavedMark: m.hasSavedMark ?? false,
        }))
      );
    }
  }, [marksData, activeExamSubject]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => examsApi.saveMarks(selectedExamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-marks', selectedExamId, selectedSubjectId] });
      queryClient.invalidateQueries({ queryKey: ['class-exam-report', selectedExamId] });
      queryClient.invalidateQueries({ queryKey: ['exams-list'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      refetchMarks();
      setSuccessMessage('Exam marks successfully saved and committed to database!');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message;
      alert(`Failed to save marks: ${msg}`);
    },
  });

  const handleMarksChange = (studentId: string, val: number) => {
    if (!canEditMarks) return;
    const max = activeExamSubject?.maxMarks || 100;
    const clamped = Math.max(0, Math.min(val, max));
    setMarksState((prev) =>
      prev.map((m) => (m.studentId === studentId ? { ...m, marksObtained: clamped } : m))
    );
  };

  const handleAbsentChange = (studentId: string, isAbsent: boolean) => {
    if (!canEditMarks) return;
    setMarksState((prev) =>
      prev.map((m) =>
        m.studentId === studentId
          ? { ...m, isAbsent, marksObtained: isAbsent ? 0 : m.marksObtained }
          : m
      )
    );
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    if (!canEditMarks) return;
    setMarksState((prev) =>
      prev.map((m) => (m.studentId === studentId ? { ...m, remarks } : m))
    );
  };

  const handleSave = () => {
    if (!activeExamSubject) {
      alert('Exam subject definition missing.');
      return;
    }
    if (!canEditMarks) {
      alert('You are not permitted to submit marks.');
      return;
    }

    saveMutation.mutate({
      examSubjectId: activeExamSubject.id,
      marks: marksState.map((m) => ({
        studentId: m.studentId,
        marksObtained: m.marksObtained,
        isAbsent: m.isAbsent,
        remarks: m.remarks || undefined,
      })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/exams')}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {canEditMarks ? 'Subject Scoring & Marks Entry' : 'Subject Marks Overview'}
              </h1>
              {isAdmin && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                  Admin Read-Only
                </span>
              )}
              {isTeacher && !isAdmin && (
                canEditMarks ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                    Faculty Scoring Mode (Your Assigned Subject)
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
                    👁️ View-Only — Faculty: {activeExamSubject?.teacherName || currentClassSubject?.teacherName || 'Subject Teacher'}
                  </span>
                )
              )}
            </div>
            <p className="text-sm text-slate-500">
              {isAdmin
                ? 'Review class examination marks. Only faculty teachers can submit score records.'
                : canEditMarks
                ? 'Enter and submit student scores for your assigned examination subject.'
                : 'Viewing class scores for this subject in read-only mode. Only the allocated subject teacher can edit.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              to={`/exams/results?examId=${selectedExamId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <Award className="h-4 w-4 text-indigo-600" />
              Class Performance Reports
            </Link>
          )}

          {canEditMarks ? (
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending || marksState.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving...' : 'Submit & Save Marks'}
            </button>
          ) : activeExam?.isLocked ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-500">
              <Lock className="h-4 w-4" />
              Marks Locked (Published)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
              <Eye className="h-4 w-4 text-blue-600" />
              View-Only Mode
            </span>
          )}
        </div>
      </div>

      {/* Role Notice Banner for Admin */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Administrator Permission Restriction
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Per institutional policy, administrators cannot enter or alter student marks. Score entry is strictly restricted to assigned subject teachers. You are viewing these grades in read-only mode.
              </p>
            </div>
          </div>
          <Link
            to={`/exams/results?examId=${selectedExamId}`}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition"
          >
            <Award className="h-3.5 w-3.5" />
            Go to Class Reports Portal
          </Link>
        </div>
      )}

      {/* View-Only Banner for Teacher viewing another teacher's subject */}
      {isTeacher && !isAdmin && !isMySubject && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-xs text-blue-900 shadow-sm">
          <BookOpen className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <p className="font-bold text-sm text-blue-950">
              View-Only Access: {activeExamSubject?.subjectName || 'Subject'}
            </p>
            <p className="text-blue-700 mt-0.5">
              You are viewing marks for classroom cohort <strong>{activeExam?.className}</strong>. As per institutional rules, only the allocated faculty teacher (<strong>{currentClassSubject?.teacherName || 'Subject Faculty'}</strong>) can edit marks for this subject.
            </p>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Select Examination</label>
          <select
            value={selectedExamId}
            onChange={(e) => {
              setSelectedExamId(e.target.value);
              setSelectedSubjectId('');
              setSearchParams({ examId: e.target.value });
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">-- Choose Exam --</option>
            {exams?.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.className}) {ex.isPublished ? '✓ Published' : '• In Progress'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Select Subject</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value);
              setSearchParams({ examId: selectedExamId, subjectId: e.target.value });
            }}
            disabled={!selectedExamId}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
          >
            <option value="">-- Choose Subject --</option>
            {activeExam?.subjects?.map((s) => {
              const assignedSub = classSubjects?.find((cs) => cs.id === s.subjectId);
              const isAllocatedToMe = assignedSub?.teacherId === currentTeacherId;
              return (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.subjectName} ({s.subjectCode || 'SUB'}) {isAllocatedToMe ? '⭐ [Your Subject - Can Edit]' : assignedSub?.teacherName ? `• [${assignedSub.teacherName} - View Only]` : ''}
                </option>
              );
            })}
          </select>
        </div>

        {activeExamSubject && (
          <div className="flex items-center justify-around rounded-lg bg-indigo-50/60 border border-indigo-100 p-2 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Maximum Marks:</span>
              <p className="text-base font-bold text-slate-900">{activeExamSubject.maxMarks} pts</p>
            </div>
            <div className="h-8 w-px bg-indigo-200" />
            <div>
              <span className="text-slate-500 font-medium">Passing Threshold:</span>
              <p className="text-base font-bold text-emerald-700">{activeExamSubject.passMarks} pts</p>
            </div>
          </div>
        )}
      </div>

      {/* Marks Entry Table */}
      {selectedExamId && selectedSubjectId ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="text-xs text-slate-500">
              Class Cohort: <strong className="text-slate-800">{activeExam?.className}</strong> • Subject:{' '}
              <strong className="text-slate-800">{activeExamSubject?.subjectName}</strong> • Enrolled Students:{' '}
              <strong className="text-indigo-600">{marksState.length}</strong>
            </div>
            {canEditMarks && (
              <span className="text-xs text-slate-400">
                Click Absent to flag non-appearance. Scores save directly into institutional database.
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead>
                <tr className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5">Roll No</th>
                  <th className="px-4 py-3.5">Student Name</th>
                  <th className="px-4 py-3.5 text-center">Absent Flag</th>
                  <th className="px-4 py-3.5">Marks Obtained (Max: {activeExamSubject?.maxMarks || 100})</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Faculty Evaluation Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isMarksLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                        <span>Loading student roster & existing grades...</span>
                      </div>
                    </td>
                  </tr>
                ) : marksState.length > 0 ? (
                  marksState.map((rec) => {
                    const passThreshold = activeExamSubject?.passMarks || 35;
                    const isPassed = !rec.isAbsent && rec.marksObtained >= passThreshold;

                    return (
                      <tr key={rec.studentId} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-700">{rec.rollNumber}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{rec.studentName}</td>
                        <td className="px-4 py-3 text-center">
                          {canEditMarks ? (
                            <input
                              type="checkbox"
                              checked={rec.isAbsent}
                              onChange={(e) => handleAbsentChange(rec.studentId, e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                          ) : (
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${rec.isAbsent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                              {rec.isAbsent ? 'Absent' : 'Present'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canEditMarks ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                disabled={rec.isAbsent}
                                value={rec.isAbsent ? 0 : rec.marksObtained}
                                onChange={(e) => handleMarksChange(rec.studentId, Number(e.target.value))}
                                min={0}
                                max={activeExamSubject?.maxMarks || 100}
                                step={0.5}
                                className={`w-28 rounded-md border px-3 py-1.5 font-bold focus:outline-none focus:ring-2 ${
                                  rec.isAbsent
                                    ? 'border-slate-200 bg-slate-100 text-slate-400'
                                    : isPassed
                                    ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900 focus:ring-emerald-500'
                                    : 'border-rose-300 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                                }`}
                              />
                              <span className="text-slate-400 font-mono text-[11px]">
                                / {activeExamSubject?.maxMarks || 100}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono text-sm font-bold ${
                                rec.isAbsent
                                  ? 'text-slate-400'
                                  : isPassed
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                              }`}>
                                {rec.isAbsent ? '—' : rec.marksObtained}
                              </span>
                              <span className="text-slate-400 font-mono text-xs">
                                / {activeExamSubject?.maxMarks || 100}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {rec.isAbsent ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              ABSENT
                            </span>
                          ) : isPassed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              <Check className="h-3 w-3" />
                              PASS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                              <XCircle className="h-3 w-3" />
                              FAIL
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canEditMarks ? (
                            <input
                              type="text"
                              placeholder="e.g. Excellent grasp, good presentation..."
                              value={rec.remarks}
                              onChange={(e) => handleRemarksChange(rec.studentId, e.target.value)}
                              className="w-full rounded-md border border-slate-200 px-2.5 py-1 text-slate-700 focus:border-indigo-500 focus:outline-none"
                            />
                          ) : (
                            <span className="text-slate-600 text-xs italic">
                              {rec.remarks || '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No active students found in this classroom cohort.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {canEditMarks && marksState.length > 0 && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Saving Scores...' : 'Submit & Save All Marks to Database'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-500 shadow-sm">
          <BookOpen className="mx-auto h-10 w-10 text-slate-400 mb-2" />
          <h3 className="text-base font-bold text-slate-800">Select Examination & Subject</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Choose an active examination cohort and subject above to load the student roll and enter or view grades.
          </p>
        </div>
      )}
    </div>
  );
};

export default MarksEntryPage;
