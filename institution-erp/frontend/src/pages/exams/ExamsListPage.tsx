import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { examsApi, academicApi, studentsApi } from '../../api/endpoints';
import { useAuth } from '../../store/authContext';
import Modal from '../../components/ui/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import {
  Award,
  Plus,
  Calendar,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  BookOpen,
  BarChart3,
  Trash2,
  Download,
  Printer,
  FileText,
  Percent,
  Trophy,
  AlertCircle,
  AlertTriangle,
  X,
  ArrowLeft,
  Bell,
} from 'lucide-react';
import { Exam, StudentExamResult } from '../../types';

export const ExamsListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('HOD');
  const isTeacher = hasRole('Teacher');
  const isStudent = hasRole('Student');

  const [selectedClassId, setSelectedClassId] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Student drill-down state
  const [selectedStudentExam, setSelectedStudentExam] = useState<{
    exam: Exam;
    result?: StudentExamResult;
  } | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [printingReportId, setPrintingReportId] = useState<string | null>(null);

  // Form states for Admin
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState('MidTerm');
  const [formClassId, setFormClassId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // 1. Fetch Student Profile (if student)
  const { data: myProfile } = useQuery({
    queryKey: ['my-student-profile-exams'],
    queryFn: studentsApi.getMyProfile,
    enabled: isStudent,
  });

  // Lock selectedClassId to student's own enrolled class
  useEffect(() => {
    if (isStudent && myProfile?.classRoomId) {
      setSelectedClassId(myProfile.classRoomId);
    }
  }, [isStudent, myProfile]);

  // 2. Fetch Student Results (if student)
  const { data: myResults } = useQuery({
    queryKey: ['my-student-exam-results', myProfile?.id],
    queryFn: () => (myProfile?.id ? examsApi.getStudentResults(myProfile.id) : examsApi.getMyResults()),
    enabled: isStudent && (!!myProfile?.id || true),
    refetchOnMount: 'always',
  });

  // 3. Fetch Classes list for Staff/Admin
  const { data: classes } = useQuery({
    queryKey: ['classes-list'],
    queryFn: academicApi.getClasses,
    enabled: !isStudent,
  });

  // 4. Fetch Exams list
  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams-list', selectedClassId],
    queryFn: () => examsApi.getList(selectedClassId || undefined),
  });

  const publishMutation = useMutation({
    mutationFn: (examId: string) => examsApi.publish(examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams-list'] });
      alert('Examination published! Final report cards are now accessible to students & parents.');
    },
    onError: (err: any) => {
      alert(`Publish failed: ${err.response?.data?.detail || err.message}`);
    },
  });

  const handleDownloadReportCard = async (examId: string, examName: string) => {
    if (!myProfile) return;
    try {
      setDownloadingReportId(examId);
      await examsApi.downloadReportCard(examId, myProfile.id, myProfile.fullName || 'Student');
    } catch (err: any) {
      alert(`Failed to download report card: ${err.response?.data?.message || err.message}`);
    } finally {
      setDownloadingReportId(null);
    }
  };

  const handlePrintReportCard = async (examId: string) => {
    if (!myProfile) return;
    try {
      setPrintingReportId(examId);
      await examsApi.printReportCard(examId, myProfile.id);
    } catch (err: any) {
      alert(`Failed to print report card: ${err.response?.data?.message || err.message}`);
    } finally {
      setPrintingReportId(null);
    }
  };

  // =========================================================================
  // RENDER: STUDENT VIEW
  // =========================================================================
  if (isStudent) {
    return (
      <div className="space-y-6">
        {/* Student Top Banner */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                My Examinations & Subject Marks
              </h1>
              <span className="rounded-full bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                Student View
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Select any examination card below (e.g. Unit Test, Mid-Term) to inspect your individual subject marks and official report cards.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/timetable"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs transition"
            >
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              <span>Weekly Timetable</span>
            </Link>
            <Link
              to="/notices"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition"
            >
              <Bell className="h-3.5 w-3.5 text-slate-500" />
              <span>Notices</span>
            </Link>
          </div>
        </div>

        {/* Student Enrolled Class Badge Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-indigo-150 bg-gradient-to-r from-indigo-50/90 via-purple-50/50 to-slate-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-2xs">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  {myProfile?.className || 'Enrolled Class'}
                </span>
                <span className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700 shadow-2xs">
                  Academic Year 2026-2027
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Student: <strong className="text-slate-900">{myProfile?.fullName || user?.fullName}</strong> • Roll Number: <strong className="text-indigo-950 font-mono">{myProfile?.rollNumber || 'N/A'}</strong>
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs shrink-0 flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <span>{exams?.length || 0} Scheduled Assessment{exams?.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        {/* Student Exam Cards Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-20 rounded-md" />
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <Skeleton className="h-8 w-28 rounded-lg" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            ))
          ) : exams && exams.length > 0 ? (
            exams.map((ex) => {
              const result = myResults?.find((r) => r.examId === ex.id);

              return (
                <div
                  key={ex.id}
                  onClick={() => setSelectedStudentExam({ exam: ex, result })}
                  className="group relative cursor-pointer flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block rounded-md bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wide mb-1.5">
                          {ex.type || 'Examination'}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {ex.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {ex.className} {ex.academicYearName && `• ${ex.academicYearName}`}
                        </p>
                      </div>

                      {result ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-2xs shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Results Declared</span>
                        </span>
                      ) : ex.isPublished ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-800 shadow-2xs shrink-0">
                          <Eye className="h-3.5 w-3.5 text-blue-600" />
                          <span>Published</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800 shadow-2xs shrink-0">
                          <Calendar className="h-3.5 w-3.5 text-amber-600" />
                          <span>Grading in Progress</span>
                        </span>
                      )}
                    </div>

                    {/* Quick Summary Preview */}
                    <div className="mt-4 rounded-xl bg-slate-50 border border-slate-150 p-3.5 space-y-2">
                      {result ? (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">Aggregate Percentage:</span>
                            <span className="font-extrabold text-sm text-indigo-700 font-mono">{result.percentage}%</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-medium">Total Score:</span>
                            <span className="font-bold text-slate-800 font-mono">{result.totalMarksObtained} / {result.totalMaxMarks}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                            <span className="text-slate-500 font-medium">Overall Standing:</span>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                result.isOverallPassed
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              Grade {result.overallGrade} • {result.isOverallPassed ? 'Passed' : 'Needs Improvement'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>Schedule: {new Date(ex.startDate).toLocaleDateString()} - {new Date(ex.endDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                            <span>Evaluated Subjects: {ex.subjects?.length || 0} subjects</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1.5 transition">
                      <span>View My Subject Marks</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Click Card to Open
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Award className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Examinations Scheduled Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Examinations and assessments for your classroom cohort will be published here by institution faculty.
              </p>
            </div>
          )}
        </div>

        {/* Modal: Student Subject Marks Drilldown (Full Screen / Extra-Wide Layout) */}
        <Modal
          isOpen={!!selectedStudentExam}
          onClose={() => setSelectedStudentExam(null)}
          title={`${selectedStudentExam?.exam.name || 'Examination'} — Subject Marks & Official Grade Sheet`}
          size="6xl"
        >
          {selectedStudentExam && (
            <div className="space-y-6">
              {/* Exam & Student Info Strip */}
              <div className="rounded-2xl border border-indigo-150 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-white p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-2xs">
                      {selectedStudentExam.exam.name}
                    </span>
                    <span className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 shadow-2xs">
                      Cohort: {selectedStudentExam.exam.className}
                    </span>
                    <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-2xs">
                      Type: {selectedStudentExam.exam.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium pt-1">
                    Academic Session: <strong className="text-slate-800">{selectedStudentExam.exam.academicYearName || '2026-2027'}</strong> &bull; Examination Board Verified
                  </p>
                </div>
                <div className="flex flex-col md:items-end justify-center rounded-xl bg-white/80 border border-indigo-100 p-3 text-xs shadow-2xs">
                  <p className="font-extrabold text-slate-900 text-sm">{myProfile?.fullName || user?.fullName}</p>
                  <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                    Roll Number: <strong className="text-indigo-900 font-black">{myProfile?.rollNumber || 'N/A'}</strong> &bull; Reg No: <strong className="text-slate-700">{myProfile?.studentRegistrationNumber || 'N/A'}</strong>
                  </p>
                </div>
              </div>

              {selectedStudentExam.result ? (
                <>
                  {/* KPI Chips */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Marks</span>
                      <p className="text-2xl font-black text-slate-900 mt-1 font-mono">
                        {selectedStudentExam.result.totalMarksObtained} <span className="text-sm text-slate-400 font-normal">/ {selectedStudentExam.result.totalMaxMarks}</span>
                      </p>
                    </div>

                    <div className="rounded-2xl border border-indigo-150 bg-indigo-50/70 p-4 text-center shadow-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Aggregate Percentage</span>
                      <p className="text-2xl font-black text-indigo-700 mt-1 font-mono">
                        {selectedStudentExam.result.percentage.toFixed(1)}%
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Letter Grade</span>
                      <p className="text-2xl font-black text-indigo-600 mt-1">
                        Grade {selectedStudentExam.result.overallGrade}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Final Standing</span>
                      <div className="mt-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          selectedStudentExam.result.isOverallPassed
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{selectedStudentExam.result.isOverallPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Subject Marks Table - Full Width with Complete Alignment */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                      <thead>
                        <tr className="bg-slate-50 font-bold uppercase tracking-wider text-slate-600 text-[11px]">
                          <th className="px-4 py-3.5 text-center w-12 text-slate-400 font-mono">#</th>
                          <th className="px-5 py-3.5 min-w-[200px]">Subject Name</th>
                          <th className="px-4 py-3.5 text-center w-28 font-mono">Code</th>
                          <th className="px-4 py-3.5 text-center w-28 font-mono">Max Marks</th>
                          <th className="px-4 py-3.5 text-center w-28 font-mono">Pass Marks</th>
                          <th className="px-4 py-3.5 text-center w-32 font-mono">Obtained</th>
                          <th className="px-4 py-3.5 text-center w-28 font-mono">%</th>
                          <th className="px-4 py-3.5 text-center w-24">Grade</th>
                          <th className="px-4 py-3.5 text-center w-28">Status</th>
                          <th className="px-5 py-3.5 min-w-[220px]">Faculty Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedStudentExam.result.subjectResults?.map((sr, idx) => {
                          const pct = sr.maxMarks > 0 ? Math.round((sr.marksObtained / sr.maxMarks) * 100) : 0;
                          const isPass = !sr.isAbsent && sr.marksObtained >= sr.passMarks;

                          return (
                            <tr key={sr.subjectId} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3.5 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                              <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">
                                {sr.subjectName}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-semibold text-slate-600">
                                {sr.subjectCode || '—'}
                              </td>
                              <td className="px-4 py-3.5 text-center text-slate-600 font-mono font-medium">{sr.maxMarks}</td>
                              <td className="px-4 py-3.5 text-center text-slate-600 font-mono font-medium">{sr.passMarks}</td>
                              <td className="px-4 py-3.5 text-center">
                                {sr.isAbsent ? (
                                  <span className="inline-block rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                                    ABSENT
                                  </span>
                                ) : (
                                  <span
                                    className={`font-mono text-base font-extrabold ${
                                      isPass ? 'text-emerald-700' : 'text-rose-600'
                                    }`}
                                  >
                                    {sr.marksObtained}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-700 text-sm">
                                {sr.isAbsent ? '—' : `${pct}%`}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className="inline-block rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-700">
                                  {sr.gradeLetter || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${
                                    sr.isAbsent
                                      ? 'bg-amber-100 text-amber-800'
                                      : isPass
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {sr.isAbsent ? 'Absent' : isPass ? 'Passed' : 'Failed'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-slate-600 text-xs italic">
                                {sr.remarks || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50/80 font-bold border-t-2 border-slate-200 text-xs text-slate-800">
                          <td colSpan={3} className="px-5 py-3.5 text-right font-extrabold uppercase tracking-wide">
                            Aggregate Summary
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold">{selectedStudentExam.result.totalMaxMarks}</td>
                          <td className="px-4 py-3.5 text-center font-mono text-slate-400">—</td>
                          <td className="px-4 py-3.5 text-center font-mono font-black text-indigo-700 text-base">
                            {selectedStudentExam.result.totalMarksObtained}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-black text-indigo-700 text-sm">
                            {selectedStudentExam.result.percentage.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3.5 text-center font-black text-indigo-700">
                            {selectedStudentExam.result.overallGrade}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-block rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                              {selectedStudentExam.result.isOverallPassed ? 'PASSED' : 'FAILED'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 font-medium text-[11px]">
                            Cohort Rank #{selectedStudentExam.result.classRank}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Actions footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadReportCard(selectedStudentExam.exam.id, selectedStudentExam.exam.name)}
                        disabled={downloadingReportId === selectedStudentExam.exam.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                        <span>{downloadingReportId === selectedStudentExam.exam.id ? 'Generating PDF...' : 'Download Official Report Card (PDF)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrintReportCard(selectedStudentExam.exam.id)}
                        disabled={printingReportId === selectedStudentExam.exam.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
                      >
                        <Printer className="h-4 w-4 text-slate-500" />
                        <span>Print</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedStudentExam(null)}
                      className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-900 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm">Evaluation Currently in Progress</p>
                      <p className="mt-1 leading-relaxed text-amber-800">
                        Subject marks for {selectedStudentExam.exam.name} are currently being evaluated and recorded by faculty teachers. Your full grade card and subject scores will be reflected here immediately upon official publication.
                      </p>
                    </div>
                  </div>

                  {/* Evaluated Subjects list for info */}
                  {selectedStudentExam.exam.subjects && selectedStudentExam.exam.subjects.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                      <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">Evaluated Subjects in this Examination:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {selectedStudentExam.exam.subjects.map((sub) => (
                          <div key={sub.id} className="p-3 rounded-xl bg-slate-50 border border-slate-150 flex flex-col justify-between">
                            <span className="font-bold text-slate-900">{sub.subjectName}</span>
                            <span className="text-[11px] text-slate-500 font-mono mt-1">Code: {sub.subjectCode || '—'} &bull; Max: {sub.maxMarks} &bull; Pass: {sub.passMarks}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentExam(null)}
                      className="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // =========================================================================
  // RENDER: STAFF / ADMIN VIEW
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Examinations & Grading</h1>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? 'Schedule examinations, monitor faculty grading progress, and generate class-wide performance reports'
              : 'View examination rosters and input student marks for your allocated subjects'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/exams/results"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <BarChart3 className="h-4 w-4 text-indigo-600" />
            Class Reports & Analytics
          </Link>
          {isAdmin && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              New Examination
            </button>
          )}
        </div>
      </div>

      {/* Class filter */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <span className="text-xs font-semibold text-slate-600">Filter by Cohort:</span>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">All Cohorts</option>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
      </div>

      {/* Exams Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3.5 w-32" />
              </div>
              <div className="pt-2 flex justify-between items-center">
                <Skeleton className="h-7 w-24 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            </div>
          ))
        ) : exams && exams.length > 0 ? (
          exams.map((ex) => (
            <div
              key={ex.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out hover:border-indigo-300"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{ex.name}</h3>
                    <p className="text-xs text-indigo-700 font-medium">{ex.className}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      ex.isPublished
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ex.isPublished ? 'Published' : 'Draft / Grading'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {new Date(ex.startDate).toLocaleDateString()} -{' '}
                      {new Date(ex.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                    <span>{ex.subjects?.length || 0} Evaluated Subjects</span>
                  </div>
                </div>

                {/* Subjects breakdown */}
                <div className="mt-3 divide-y divide-slate-100 rounded-lg bg-slate-50 p-2.5 text-xs">
                  {ex.subjects?.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1">
                      <span className="font-medium text-slate-800">{s.subjectName}</span>
                      {s.canCurrentUserEdit ? (
                        <Link
                          to={`/exams/marks?examId=${ex.id}&subjectId=${s.subjectId}`}
                          className="text-[11px] font-semibold text-indigo-600 hover:underline"
                        >
                          Enter Marks &rarr;
                        </Link>
                      ) : (
                        <Link
                          to={`/exams/marks?examId=${ex.id}&subjectId=${s.subjectId}`}
                          className="text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:underline"
                        >
                          View Marks &rarr;
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                <Link
                  to={`/exams/results?examId=${ex.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Class Report & Analytics
                </Link>

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        if (window.confirm(`Delete ${ex.name}? This will remove the examination roster and marks.`)) {
                          try {
                            await examsApi.delete(ex.id);
                            queryClient.invalidateQueries({ queryKey: ['exams-list'] });
                            alert('Exam deleted successfully.');
                          } catch (delErr: any) {
                            alert(`Failed to delete exam: ${delErr.response?.data?.message || delErr.message}`);
                          }
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  )}

                  {isAdmin && !ex.isPublished && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Publish ${ex.name} results? This will lock marks and make report cards downloadable.`)) {
                          publishMutation.mutate(ex.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Publish Results
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">No exams configured yet.</div>
        )}
      </div>

      {/* Create Exam Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule New Examination"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Exam Title *</label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="e.g. Annual Final Examination 2026"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Exam Type *</label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="MidTerm">Mid-Term Assessment</option>
                <option value="FinalExam">Final Examination</option>
                <option value="UnitExam">Unit Test</option>
                <option value="Practical">Practical Lab</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Classroom Cohort *</label>
              <select
                value={formClassId}
                onChange={(e) => setFormClassId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select Class</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!examName || !formClassId) {
                  alert('Please enter Exam Title and select Classroom Cohort.');
                  return;
                }
                try {
                  await examsApi.create({
                    name: examName,
                    type: examType,
                    classRoomId: formClassId,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                  });
                  queryClient.invalidateQueries({ queryKey: ['exams-list'] });
                  setIsCreateModalOpen(false);
                  setExamName('');
                  alert('Examination roster scheduled successfully!');
                } catch (createErr: any) {
                  alert(`Failed to create exam: ${createErr.response?.data?.message || createErr.message}`);
                }
              }}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Create Examination
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
