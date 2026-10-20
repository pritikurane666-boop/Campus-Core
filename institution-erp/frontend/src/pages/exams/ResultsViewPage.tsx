import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { examsApi } from '../../api/endpoints';
import { useAuth } from '../../store/authContext';
import { ClassStudentResult, ClassExamReport } from '../../types';
import StatCard from '../../components/ui/StatCard';
import {
  Award,
  Download,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Calendar,
  Users,
  TrendingUp,
  BarChart3,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const ResultsViewPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Principal');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialExamId = searchParams.get('examId') || '';

  const [selectedExamId, setSelectedExamId] = useState(initialExamId);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Passed' | 'Failed'>('All');
  const [activeTab, setActiveTab] = useState<'matrix' | 'analytics'>('matrix');
  const [downloadingStudentId, setDownloadingStudentId] = useState<string | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  // Fetch list of examinations
  const { data: exams, isLoading: isExamsLoading } = useQuery({
    queryKey: ['exams-list'],
    queryFn: () => examsApi.getList(),
  });

  // Auto-select first exam if none selected
  React.useEffect(() => {
    if (exams && exams.length > 0 && !selectedExamId) {
      setSelectedExamId(exams[0].id);
      setSearchParams({ examId: exams[0].id });
    }
  }, [exams, selectedExamId, setSearchParams]);

  // Fetch class-wise comprehensive report for selected exam
  const {
    data: classReport,
    isLoading: isReportLoading,
    error: reportError,
  } = useQuery({
    queryKey: ['class-exam-report', selectedExamId],
    queryFn: () => examsApi.getClassReport(selectedExamId),
    enabled: !!selectedExamId,
  });

  const activeExam = exams?.find((e) => e.id === selectedExamId);

  // Publish exam mutation
  const publishMutation = useMutation({
    mutationFn: (examId: string) => examsApi.publish(examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams-list'] });
      queryClient.invalidateQueries({ queryKey: ['class-exam-report', selectedExamId] });
      alert('Examination published successfully! Final results are now visible across student portals.');
    },
    onError: (err: any) => {
      alert(`Publish failed: ${err.response?.data?.message || err.message}`);
    },
  });

  // Filtered student list
  const filteredStudents = useMemo(() => {
    if (!classReport?.students) return [];
    return classReport.students.filter((st: ClassStudentResult) => {
      const matchQuery =
        !searchQuery ||
        st.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Passed' && st.isOverallPassed) ||
        (statusFilter === 'Failed' && !st.isOverallPassed);

      return matchQuery && matchStatus;
    });
  }, [classReport?.students, searchQuery, statusFilter]);

  // Export CSV handler
  const handleExportCsv = async () => {
    if (!classReport) return;
    try {
      setIsExportingCsv(true);
      await examsApi.exportClassCsv(classReport.examId, classReport.examName, classReport.className);
    } catch (err: any) {
      alert(`Failed to export CSV: ${err.message}`);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  // Download individual student PDF report card
  const handleDownloadReportCard = async (studentId: string, studentName: string) => {
    try {
      setDownloadingStudentId(studentId);
      await examsApi.downloadReportCard(selectedExamId, studentId, studentName);
    } catch (err: any) {
      alert('Failed to generate QuestPDF report card. Ensure marks have been submitted.');
    } finally {
      setDownloadingStudentId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Class Results & Performance Reports
            </h1>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 border border-indigo-200">
              Institutional Reports
            </span>
          </div>
          <p className="text-sm text-slate-500">
            View class-wide marks distribution, student rank matrices, and export official reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={isExportingCsv || !classReport || filteredStudents.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            {isExportingCsv ? 'Exporting...' : 'Export Class CSV'}
          </button>

          <button
            onClick={handlePrintReport}
            disabled={!classReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <Printer className="h-4 w-4 text-indigo-600" />
            Print Report
          </button>

          {isAdmin && activeExam && !activeExam.isPublished && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Publish results for "${activeExam.name}"? This will officially release results to students and parents.`
                  )
                ) {
                  publishMutation.mutate(activeExam.id);
                }
              }}
              disabled={publishMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              {publishMutation.isPending ? 'Publishing...' : 'Publish Official Results'}
            </button>
          )}
        </div>
      </div>

      {/* Select Examination Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Selected Examination:
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => {
              setSelectedExamId(e.target.value);
              setSearchParams({ examId: e.target.value });
            }}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none min-w-[260px]"
          >
            <option value="">-- Choose Examination --</option>
            {exams?.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} — {ex.className} ({ex.isPublished ? 'Published' : 'Draft / Grading'})
              </option>
            ))}
          </select>
        </div>

        {classReport && (
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {new Date(classReport.startDate).toLocaleDateString()} -{' '}
              {new Date(classReport.endDate).toLocaleDateString()}
            </span>
            <span className="font-semibold text-indigo-700">
              {classReport.className}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                classReport.isPublished
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {classReport.isPublished ? 'Published' : 'Draft / Grading'}
            </span>
          </div>
        )}
      </div>

      {/* Analytics KPI Cards */}
      {classReport?.analytics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Class Pass Rate"
            value={`${classReport.analytics.passPercentage.toFixed(1)}%`}
            icon={Award}
            color={classReport.analytics.passPercentage >= 75 ? 'emerald' : 'amber'}
            trend={{
              value: `${classReport.analytics.passedStudents} of ${classReport.analytics.totalStudents} passed`,
              isPositive: classReport.analytics.passPercentage >= 75,
            }}
            description="Overall cohort clearing rate"
          />

          <StatCard
            title="Class Average Score"
            value={`${classReport.analytics.classAveragePercentage.toFixed(1)}%`}
            icon={TrendingUp}
            color="indigo"
            description={`Evaluated across ${classReport.subjects?.length || 0} subjects`}
          />

          <StatCard
            title="Top Rank (Highest)"
            value={`${classReport.analytics.highestPercentage.toFixed(1)}%`}
            icon={Sparkles}
            color="purple"
            description={`Topper: ${classReport.analytics.highestScorerName}`}
          />

          <StatCard
            title="Enrolled Students"
            value={classReport.analytics.totalStudents}
            icon={Users}
            color="blue"
            description={`${classReport.analytics.evaluatedStudents} graded submissions`}
          />
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-3 sm:flex-row sm:items-center">
        {/* Tab switch */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Class Marks Sheet (Matrix)
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Subject & Grade Analytics
          </button>
        </div>

        {/* Filter controls */}
        {activeTab === 'matrix' && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs">
              <span className="px-2 text-slate-400 font-medium">Result:</span>
              {(['All', 'Passed', 'Failed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1 font-semibold transition ${
                    statusFilter === st
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Areas */}
      {isReportLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-slate-500 shadow-sm">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mb-3" />
          <p className="text-sm font-semibold">Generating class performance reports & calculating ranks...</p>
        </div>
      ) : classReport ? (
        activeTab === 'matrix' ? (
          /* TAB 1: CONSOLIDATED CLASS MARKS MATRIX */
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 font-bold uppercase tracking-wider text-slate-600">
                    <th className="px-3.5 py-3 text-center w-12">Rank</th>
                    <th className="px-3.5 py-3">Roll No</th>
                    <th className="px-3.5 py-3 min-w-[140px]">Student Name</th>
                    {/* Subject columns */}
                    {classReport.subjects?.map((sub) => (
                      <th key={sub.subjectId} className="px-3 py-3 text-center min-w-[100px]">
                        <div>{sub.subjectName}</div>
                        <span className="text-[10px] font-normal text-slate-400">
                          (Max {sub.maxMarks} / Pass {sub.passMarks})
                        </span>
                      </th>
                    ))}
                    <th className="px-3.5 py-3 text-center">Total Score</th>
                    <th className="px-3.5 py-3 text-center">Percentage</th>
                    <th className="px-3.5 py-3 text-center">Grade</th>
                    <th className="px-3.5 py-3 text-center">Result</th>
                    <th className="px-3.5 py-3 text-center">Attendance</th>
                    <th className="px-3.5 py-3 text-right">Official Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((st: ClassStudentResult) => (
                      <tr key={st.studentId} className="hover:bg-slate-50/70 transition">
                        <td className="px-3.5 py-3 text-center font-bold text-slate-800">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                              st.classRank === 1
                                ? 'bg-amber-100 text-amber-800 font-black'
                                : st.classRank === 2
                                ? 'bg-slate-200 text-slate-800 font-bold'
                                : st.classRank === 3
                                ? 'bg-amber-50 text-amber-700 font-bold'
                                : 'text-slate-600'
                            }`}
                          >
                            #{st.classRank}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 font-mono font-bold text-indigo-700">
                          {st.rollNumber}
                        </td>
                        <td className="px-3.5 py-3 font-semibold text-slate-900">
                          {st.studentName}
                        </td>

                        {/* Subject marks cells */}
                        {classReport.subjects?.map((sub) => {
                          const markRec = st.subjectMarks[sub.subjectId.toString()];
                          if (!markRec) {
                            return (
                              <td key={sub.subjectId} className="px-3 py-3 text-center text-slate-300">
                                —
                              </td>
                            );
                          }

                          if (markRec.isAbsent) {
                            return (
                              <td key={sub.subjectId} className="px-3 py-3 text-center">
                                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                  ABS
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={sub.subjectId} className="px-3 py-3 text-center">
                              <span
                                className={`font-mono font-bold ${
                                  markRec.isPassed ? 'text-slate-800' : 'text-rose-600'
                                }`}
                              >
                                {markRec.marksObtained.toFixed(1)}
                              </span>
                            </td>
                          );
                        })}

                        <td className="px-3.5 py-3 text-center font-mono font-bold text-slate-900">
                          {st.totalMarksObtained.toFixed(1)} / {st.totalMaxMarks.toFixed(0)}
                        </td>
                        <td className="px-3.5 py-3 text-center font-bold text-slate-800">
                          {st.percentage.toFixed(1)}%
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-bold ${
                              st.overallGrade.startsWith('A')
                                ? 'bg-emerald-100 text-emerald-800'
                                : st.overallGrade === 'B'
                                ? 'bg-blue-100 text-blue-800'
                                : st.overallGrade === 'C'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {st.overallGrade}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          {st.isOverallPassed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              PASSED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                              <XCircle className="h-3 w-3" />
                              FAILED
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-center text-slate-600">
                          {st.attendancePercentage.toFixed(1)}%
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <button
                            onClick={() => handleDownloadReportCard(st.studentId, st.studentName)}
                            disabled={downloadingStudentId === st.studentId}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition"
                          >
                            <Download className="h-3 w-3" />
                            {downloadingStudentId === st.studentId ? 'PDF...' : 'Report Card'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8 + (classReport.subjects?.length || 0)}
                        className="py-12 text-center text-slate-400"
                      >
                        No students match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>
                Showing {filteredStudents.length} of {classReport.students.length} students
              </span>
              <span>
                Official grading calculations are synced with active academic year records.
              </span>
            </div>
          </div>
        ) : (
          /* TAB 2: SUBJECT & GRADE ANALYTICS */
          <div className="space-y-6">
            {/* Grade Distribution */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Class Grade Distribution
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Summary of student performance classifications across this cohort
              </p>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {['A+', 'A', 'B', 'C', 'D', 'F'].map((g) => {
                  const count = classReport.analytics.gradeDistribution?.[g] ?? 0;
                  const pct =
                    classReport.analytics.totalStudents > 0
                      ? ((count / classReport.analytics.totalStudents) * 100).toFixed(0)
                      : '0';

                  return (
                    <div
                      key={g}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-center hover:border-indigo-200 transition"
                    >
                      <span className="text-xl font-black text-slate-800">{g}</span>
                      <p className="text-2xl font-bold text-indigo-600 mt-1">{count}</p>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {pct}% of cohort
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subject-Wise Performance Breakdown */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Subject-Wise Evaluation Analytics
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Detailed faculty metrics, class averages, and pass percentages per subject
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {classReport.analytics.subjectSummaries?.map((sub) => (
                  <div
                    key={sub.subjectId}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{sub.subjectName}</h3>
                          <span className="text-[11px] font-mono text-slate-400">
                            {sub.subjectCode || 'CODE'}
                          </span>
                        </div>
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          Max: {sub.maxMarks} pts
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            Avg Score
                          </span>
                          <p className="font-bold text-slate-800">{sub.averageMarks.toFixed(1)}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            Highest
                          </span>
                          <p className="font-bold text-emerald-700">{sub.highestMarks.toFixed(1)}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            Lowest
                          </span>
                          <p className="font-bold text-rose-700">{sub.lowestMarks.toFixed(1)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Subject Pass Rate:</span>
                      <span className="font-bold text-emerald-700">
                        {sub.passPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-400">
          Please select an examination to view results and generate reports.
        </div>
      )}
    </div>
  );
};

export default ResultsViewPage;
