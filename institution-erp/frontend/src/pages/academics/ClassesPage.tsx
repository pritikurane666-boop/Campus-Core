import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { academicApi, teachersApi } from '../../api/endpoints';
import { ClassRoom, Subject, Student, Teacher } from '../../types';
import Modal from '../../components/ui/Modal';
import { getErrorMessage } from '../../utils/errorMessage';
import { Skeleton } from '../../components/common/Skeleton';
import {
  School,
  Plus,
  BookOpen,
  Users,
  Trash2,
  ExternalLink,
  Search,
  User,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Mail,
  Phone,
  Layers,
  UserCheck,
  Award,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

import { useAuth } from '../../store/authContext';

export const ClassesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole('HOD');
  const isTeacher = hasRole('Teacher') && !isAdmin;

  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'subjects' | 'students'>('subjects');
  const [studentSearch, setStudentSearch] = useState('');

  // Allot Class Teacher modal states
  const [isAllotModalOpen, setIsAllotModalOpen] = useState(false);
  const [allotTargetClass, setAllotTargetClass] = useState<ClassRoom | null>(null);
  const [allotTeacherId, setAllotTeacherId] = useState('');

  // Add class form states
  const [className, setClassName] = useState('');
  const [classSection, setClassSection] = useState('A');
  const [classCapacity, setClassCapacity] = useState(40);
  const [academicYearId, setAcademicYearId] = useState('');

  // Assign subject state
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [isAssignClassTeacher, setIsAssignClassTeacher] = useState(false);

  // Allot Faculty to individual class subject modal state
  const [allotFacultyModal, setAllotFacultyModal] = useState<{
    isOpen: boolean;
    classRoom: ClassRoom;
    subject: Subject;
    teacherId: string;
    isClassTeacher: boolean;
  } | null>(null);

  // Add subject form states
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [newSubTeacherIds, setNewSubTeacherIds] = useState<string[]>([]);

  // Fetch classes, years, subjects
  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes-list'],
    queryFn: academicApi.getClasses,
  });

  const { data: years } = useQuery({
    queryKey: ['academic-years'],
    queryFn: academicApi.getYears,
  });

  React.useEffect(() => {
    if (years && years.length > 0 && !academicYearId) {
      setAcademicYearId(years[0].id);
    }
  }, [years, academicYearId]);

  const { data: subjects } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: academicApi.getSubjects,
  });

  // Fetch teachers for class teacher allotment
  const { data: teachers } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: teachersApi.getList,
  });

  // Query teachers allocated to the selected subject
  const { data: subjectTeachers } = useQuery({
    queryKey: ['subject-teachers', assignSubjectId],
    queryFn: () => academicApi.getSubjectTeachers(assignSubjectId),
    enabled: !!assignSubjectId,
  });

  // Query teachers for the allotFacultyModal if opened
  const { data: modalSubjectTeachers } = useQuery({
    queryKey: ['subject-teachers', allotFacultyModal?.subject?.id],
    queryFn: () => academicApi.getSubjectTeachers(allotFacultyModal!.subject.id),
    enabled: !!allotFacultyModal?.subject?.id,
  });

  // Auto-select qualified teacher when assignSubjectId changes
  React.useEffect(() => {
    if (subjectTeachers && subjectTeachers.length > 0) {
      const allocated = subjectTeachers.find((t) => t.isAllocatedToSubject);
      if (allocated) {
        setAssignTeacherId(allocated.teacherId);
      } else {
        setAssignTeacherId('');
      }
    } else {
      setAssignTeacherId('');
    }
  }, [subjectTeachers, assignSubjectId]);

  const openAllotModal = (cls: ClassRoom) => {
    setAllotTargetClass(cls);
    setAllotTeacherId(cls.classTeacherId || '');
    setIsAllotModalOpen(true);
  };

  const assignClassTeacherMutation = useMutation({
    mutationFn: (data: { classId: string; teacherId: string }) =>
      academicApi.assignClassTeacher(data.classId, { teacherId: data.teacherId }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      setIsAllotModalOpen(false);
      alert(res?.message || 'Class teacher allotted successfully!');
      if (selectedClass && allotTargetClass && selectedClass.id === allotTargetClass.id) {
        const t = teachers?.find((tc) => tc.id === allotTeacherId);
        setSelectedClass((prev) =>
          prev
            ? {
              ...prev,
              classTeacherId: allotTeacherId,
              classTeacherName: t?.fullName,
              classTeacherEmployeeCode: t?.employeeCode,
              classTeacherEmail: t?.email,
              classTeacherPhone: t?.phoneNumber,
            }
            : null
        );
      }
    },
    onError: (err: any) => {
      alert(`Assignment failed: ${err.response?.data?.message || err.message}`);
    },
  });

  const removeClassTeacherMutation = useMutation({
    mutationFn: (classId: string) => academicApi.removeClassTeacher(classId),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['class-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      setIsAllotModalOpen(false);
      alert(res?.message || 'Class teacher unassigned successfully.');
      if (selectedClass && allotTargetClass && selectedClass.id === allotTargetClass.id) {
        setSelectedClass((prev) =>
          prev
            ? {
              ...prev,
              classTeacherId: undefined,
              classTeacherName: undefined,
              classTeacherEmployeeCode: undefined,
              classTeacherEmail: undefined,
              classTeacherPhone: undefined,
            }
            : null
        );
      }
    },
    onError: (err: any) => {
      alert(`Failed to unassign: ${err.response?.data?.message || err.message}`);
    },
  });

  // Query subjects for selected class
  const { data: classSubjects, refetch: refetchClassSubjects } = useQuery({
    queryKey: ['class-subjects', selectedClass?.id],
    queryFn: () => academicApi.getClassSubjects(selectedClass!.id),
    enabled: !!selectedClass,
  });

  // Query enrolled students for selected class
  const { data: classStudents, isLoading: isClassStudentsLoading, refetch: refetchClassStudents } = useQuery({
    queryKey: ['class-students', selectedClass?.id],
    queryFn: () => academicApi.getClassStudents(selectedClass!.id),
    enabled: !!selectedClass,
  });

  const createClassMutation = useMutation({
    mutationFn: (data: any) => academicApi.createClass(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      setIsAddClassModalOpen(false);
      setClassName('');
      alert('Class created successfully!');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const createSubjectMutation = useMutation({
    mutationFn: (data: any) => academicApi.createSubject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects-list'] });
      setIsAddSubjectModalOpen(false);
      setNewSubName('');
      setNewSubCode('');
      setNewSubDesc('');
      setNewSubTeacherIds([]);
      alert('New subject added to curriculum catalog!');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const assignSubjectMutation = useMutation({
    mutationFn: (data: { classId: string; subjectId: string; teacherId?: string; isClassTeacher?: boolean }) =>
      academicApi.assignSubject(data.classId, data.subjectId, data.teacherId, data.isClassTeacher),
    onSuccess: (res: any) => {
      refetchClassSubjects();
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      setAssignSubjectId('');
      setAssignTeacherId('');
      setIsAssignClassTeacher(false);
      alert(res?.message || 'Subject assigned to class curriculum successfully!');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const assignSubjectTeacherMutation = useMutation({
    mutationFn: (data: { classId: string; subjectId: string; teacherId: string; isClassTeacher?: boolean }) =>
      academicApi.assignSubjectTeacher(data.classId, data.subjectId, {
        teacherId: data.teacherId,
        isClassTeacher: data.isClassTeacher,
      }),
    onSuccess: (res: any) => {
      refetchClassSubjects();
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      setAllotFacultyModal(null);
      alert(res?.message || 'Faculty assigned to subject successfully!');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const removeSubjectTeacherMutation = useMutation({
    mutationFn: (data: { classId: string; subjectId: string }) =>
      academicApi.removeSubjectTeacher(data.classId, data.subjectId),
    onSuccess: (res: any) => {
      refetchClassSubjects();
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      setAllotFacultyModal(null);
      alert(res?.message || 'Faculty removed from subject.');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const removeSubjectMutation = useMutation({
    mutationFn: (data: { classId: string; subjectId: string }) =>
      academicApi.removeSubject(data.classId, data.subjectId),
    onSuccess: () => {
      refetchClassSubjects();
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      alert('Subject successfully removed from class curriculum.');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id: string) => academicApi.deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      alert('Class deleted successfully!');
    },
    onError: (err: any) => {
      alert(getErrorMessage(err));
    },
  });

  const handleDeleteClass = (id: string, name: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${name}"?\n\nThis will remove the class cohort from the institutional registry.`
      )
    ) {
      deleteClassMutation.mutate(id);
    }
  };

  const handleRemoveSubject = (subjectId: string, subjectName: string) => {
    if (!selectedClass) return;
    if (
      window.confirm(
        `Are you sure you want to remove "${subjectName}" from ${selectedClass.fullName}?\n\nThis will unassign the subject from this classroom syllabus.`
      )
    ) {
      removeSubjectMutation.mutate({ classId: selectedClass.id, subjectId });
    }
  };

  const filteredStudents = classStudents?.filter((st) => {
    if (!studentSearch.trim()) return true;
    const query = studentSearch.toLowerCase();
    return (
      st.fullName.toLowerCase().includes(query) ||
      st.rollNumber.toLowerCase().includes(query) ||
      (st.studentRegistrationNumber && st.studentRegistrationNumber.toLowerCase().includes(query)) ||
      (st.email && st.email.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isTeacher ? 'My Allotted Classrooms & Curriculum' : 'Classrooms & Academic Cohorts'}
          </h1>
          <p className="text-sm text-slate-500">
            {isTeacher
              ? 'View syllabus, subject teachers, and enrolled student roster for your allocated class cohorts'
              : 'Define institutional classes, sections, seat capacities, subject curricula, and student cohorts'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddSubjectModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <BookOpen className="h-4 w-4 text-indigo-600" />
              New Subject
            </button>
            <button
              onClick={() => setIsAddClassModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              Create Class
            </button>
          </div>
        )}
      </div>

      {/* Grid of Classes */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center">
                <Skeleton className="h-7 w-24 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            </div>
          ))
        ) : classes && classes.length > 0 ? (
          classes.map((cls) => {
            const pct = cls.capacity > 0 ? Math.min(100, Math.round((cls.studentCount / cls.capacity) * 100)) : 0;
            return (
              <div
                key={cls.id}
                onClick={() => {
                  setSelectedClass(cls);
                  setActiveModalTab('subjects');
                }}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out hover:border-indigo-400 cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition">
                        <School className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
                          {cls.fullName}
                        </h3>
                        <p className="text-xs text-slate-500">{cls.academicYearName || '2026-2027 Session'}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                      Sec {cls.section}
                    </span>
                  </div>

                  {/* Dynamic Class Teacher Allotment Badge */}
                  <div className={`mt-3.5 flex items-center justify-between rounded-xl p-2.5 text-xs transition border ${cls.classTeacherName
                      ? 'bg-gradient-to-r from-indigo-50/90 to-purple-50/50 border-indigo-150'
                      : 'bg-amber-50/80 border-amber-200/70'
                    }`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs ${cls.classTeacherName
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-amber-200 text-amber-800'
                        }`}>
                        {cls.classTeacherName ? cls.classTeacherName.charAt(0).toUpperCase() : <UserCheck className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Class Teacher
                          </span>
                          {cls.classTeacherName && (
                            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-mono font-bold text-indigo-700">
                              {cls.classTeacherEmployeeCode || 'FACULTY'}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 truncate text-xs leading-tight">
                          {cls.classTeacherName || <span className="text-amber-700 font-semibold italic">Not Allotted</span>}
                        </p>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAllotModal(cls);
                        }}
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold border transition shadow-2xs ${cls.classTeacherName
                            ? 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
                            : 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                          }`}
                      >
                        {cls.classTeacherName ? 'Change' : '+ Allot'}
                      </button>
                    )}
                  </div>

                  <div className="mt-3.5 rounded-xl bg-slate-50 p-3.5 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <div>
                        <span className="text-[11px] font-medium text-slate-400">Enrolled Cohort</span>
                        <p className="font-bold text-slate-900 text-sm">{cls.studentCount} Students</p>
                      </div>
                      <div className="text-center">
                        <span className="text-[11px] font-medium text-slate-400">Syllabus</span>
                        <p className="font-bold text-slate-700 text-sm">{cls.subjectCount ?? 0} Subjects</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-medium text-slate-400">Class Capacity</span>
                        <p className="font-bold text-slate-700 text-sm">{cls.capacity} Seats</p>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-medium mb-1">
                        <span className="text-slate-500">Occupancy Rate</span>
                        <span className={`font-bold ${pct >= 90 ? 'text-rose-600' : pct >= 70 ? 'text-amber-600' : 'text-indigo-600'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-600'
                            }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClass(cls);
                      setActiveModalTab('subjects');
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Curriculum</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClass(cls);
                      setActiveModalTab('students');
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                  >
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Students ({cls.studentCount})</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      title="Delete Class"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClass(cls.id, cls.fullName);
                      }}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-50 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">No classes found.</div>
        )}
      </div>

      {/* Add Class Modal */}
      <Modal
        isOpen={isAddClassModalOpen}
        onClose={() => setIsAddClassModalOpen(false)}
        title="Create New Classroom Cohort"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Class Name *</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Grade 11"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Section *</label>
              <input
                type="text"
                value={classSection}
                onChange={(e) => setClassSection(e.target.value)}
                placeholder="A, B, or C"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Capacity *</label>
              <input
                type="number"
                value={classCapacity}
                onChange={(e) => setClassCapacity(Number(e.target.value))}
                min={10}
                max={100}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Academic Year *</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
            >
              <option value="">-- Choose Academic Session --</option>
              {years?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setIsAddClassModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!className || !classSection || !academicYearId || createClassMutation.isPending}
              onClick={() =>
                createClassMutation.mutate({
                  name: className,
                  section: classSection,
                  capacity: classCapacity,
                  academicYearId,
                })
              }
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Create Classroom
            </button>
          </div>
        </div>
      </Modal>

      {/* Class Details Modal (Subjects + Students) */}
      {selectedClass && (
        <Modal
          isOpen={!!selectedClass}
          onClose={() => {
            setSelectedClass(null);
            setStudentSearch('');
          }}
          title={`Classroom Overview: ${selectedClass.fullName}`}
          size="4xl"
        >
          <div className="space-y-5">
            {/* Class Info Header Summary */}
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-slate-50/50 to-emerald-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">
                    {selectedClass.section}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedClass.fullName}</h3>
                    <p className="text-xs text-slate-500">
                      {selectedClass.academicYearName || '2026-2027 Session'} • Section {selectedClass.section}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => openAllotModal(selectedClass)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:shadow ${selectedClass.classTeacherName
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100'
                          : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                        }`}
                    >
                      <UserCheck className={`h-3.5 w-3.5 ${selectedClass.classTeacherName ? 'text-indigo-600' : 'text-amber-600'}`} />
                      <span>Class Teacher: <strong>{selectedClass.classTeacherName || 'Not Allotted'}</strong></span>
                      {selectedClass.classTeacherEmployeeCode && (
                        <span className="font-mono text-[10px] text-indigo-600 font-bold">({selectedClass.classTeacherEmployeeCode})</span>
                      )}
                      <span className="text-[10px] text-indigo-600 underline font-semibold ml-1">Edit</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-900 shadow-sm">
                      <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Class Teacher: <strong>{selectedClass.classTeacherName || 'Not Allotted'}</strong></span>
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      {classStudents ? classStudents.length : selectedClass.studentCount} / {selectedClass.capacity} Enrolled
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                    <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{classSubjects ? classSubjects.length : 0} Subjects</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveModalTab('subjects')}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${activeModalTab === 'subjects'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Curriculum & Subjects</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeModalTab === 'subjects' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  {classSubjects?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('students')}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${activeModalTab === 'students'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <Users className="h-4 w-4" />
                <span>Enrolled Students</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeModalTab === 'students' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  {classStudents?.length || 0}
                </span>
              </button>
            </div>

            {/* TAB 1: CURRICULUM & SUBJECTS */}
            {activeModalTab === 'subjects' && (
              <div className="space-y-4">
                {/* Add Subject to Class section (Admin Only) */}
                {isAdmin && (
                  <div className="rounded-xl border border-indigo-150 bg-indigo-50/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-indigo-950">
                          Link Subject to {selectedClass.fullName}
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Select subject and assign its designated faculty member
                        </p>
                      </div>
                      {assignSubjectId && (
                        <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100/70 border border-indigo-200 rounded px-2 py-0.5">
                          {subjectTeachers?.filter((t) => t.isAllocatedToSubject).length || 0} Faculty Allocated for this Subject
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      {/* 1. Subject selector */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Select Subject *
                        </label>
                        <select
                          value={assignSubjectId}
                          onChange={(e) => setAssignSubjectId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="">-- Choose Subject to Link --</option>
                          {subjects?.map((s) => {
                            const isAlreadyAssigned = classSubjects?.some((cs) => cs.id === s.id);
                            return (
                              <option key={s.id} value={s.id} disabled={isAlreadyAssigned}>
                                {s.name} ({s.code}) {isAlreadyAssigned ? '— (Already Linked)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* 2. Teacher selector (auto-filtered/prioritized for this subject) */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Assign Faculty for this Subject (Optional)
                        </label>
                        <select
                          value={assignTeacherId}
                          onChange={(e) => setAssignTeacherId(e.target.value)}
                          disabled={!assignSubjectId}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">-- No Faculty (Unassigned) --</option>
                          {subjectTeachers && subjectTeachers.some((t) => t.isAllocatedToSubject) && (
                            <optgroup label="✨ Teachers Qualified / Allocated for this Subject">
                              {subjectTeachers
                                .filter((t) => t.isAllocatedToSubject)
                                .map((t) => (
                                  <option key={t.teacherId} value={t.teacherId}>
                                    ★ {t.fullName} ({t.employeeCode}) {t.specialization ? `— ${t.specialization}` : ''}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                          <optgroup label="Other Available Faculty">
                            {teachers
                              ?.filter(
                                (t) =>
                                  !subjectTeachers?.some(
                                    (st) => st.isAllocatedToSubject && st.teacherId === t.id
                                  )
                              )
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.fullName} ({t.employeeCode}) {t.specialization ? `— ${t.specialization}` : ''}
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>

                    {/* Class Teacher checkbox & Action button */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 mt-3 border-t border-indigo-100/60">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                        <input
                          type="checkbox"
                          checked={isAssignClassTeacher}
                          onChange={(e) => setIsAssignClassTeacher(e.target.checked)}
                          disabled={!assignTeacherId}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                        />
                        <span>Designate assigned faculty as <strong>Class Teacher</strong> for this classroom</span>
                      </label>

                      <button
                        type="button"
                        disabled={!assignSubjectId || assignSubjectMutation.isPending}
                        onClick={() =>
                          assignSubjectMutation.mutate({
                            classId: selectedClass.id,
                            subjectId: assignSubjectId,
                            teacherId: assignTeacherId || undefined,
                            isClassTeacher: isAssignClassTeacher,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{assignSubjectMutation.isPending ? 'Linking...' : 'Add Subject to Class'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Assigned Subjects Table */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-150">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Active Subjects in Syllabus ({classSubjects?.length || 0})
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Click Allot / Change Faculty or Remove to manage subjects
                    </span>
                  </div>

                  <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                    {classSubjects && classSubjects.length > 0 ? (
                      classSubjects.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-3.5 text-xs hover:bg-slate-50/80 transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded-md bg-indigo-100 font-mono text-[11px] font-bold text-indigo-700">
                              {s.code}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900">{s.name}</p>
                                {s.isClassTeacher && (
                                  <span className="rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[9px] font-bold text-indigo-700 flex items-center gap-1 shadow-2xs">
                                    <Award className="h-3 w-3" /> Class Teacher
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {s.teacherName ? (
                                  <span className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 bg-indigo-50/60 rounded px-1.5 py-0.5 border border-indigo-100">
                                    <UserCheck className="h-3 w-3 text-indigo-600" />
                                    Faculty: {s.teacherName} {s.teacherEmployeeCode && `(${s.teacherEmployeeCode})`}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-amber-700 font-medium italic flex items-center gap-1 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200">
                                    <AlertCircle className="h-3 w-3 text-amber-500" /> No faculty allotted
                                  </span>
                                )}
                                {s.description && (
                                  <span className="text-[11px] text-slate-400 line-clamp-1">— {s.description}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isAdmin && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setAllotFacultyModal({
                                    isOpen: true,
                                    classRoom: selectedClass,
                                    subject: s,
                                    teacherId: s.teacherId || '',
                                    isClassTeacher: !!s.isClassTeacher,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-600 hover:text-white transition shadow-2xs"
                                title={`Assign or reallocate faculty for ${s.name}`}
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>{s.teacherName ? 'Change Faculty' : '+ Allot Faculty'}</span>
                              </button>

                              <button
                                type="button"
                                disabled={removeSubjectMutation.isPending}
                                onClick={() => handleRemoveSubject(s.id, s.name)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition shadow-sm disabled:opacity-50"
                                title={`Delete ${s.name} from this classroom`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Remove</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400">
                        <BookOpen className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                        No subjects linked to this classroom yet.
                        <p className="text-[11px] text-slate-400 mt-1">Use the form above to add syllabus subjects.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ENROLLED STUDENTS */}
            {activeModalTab === 'students' && (
              <div className="space-y-4">
                {/* Search & Actions Bar */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search students by name or roll #..."
                      className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      Showing <strong className="text-slate-800">{filteredStudents?.length || 0}</strong> students
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClass(null);
                          navigate('/students');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                      >
                        <Plus className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Enroll New Student</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Students Table */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="max-h-[380px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10 uppercase tracking-wider text-[11px] text-slate-500 font-semibold">
                        <tr>
                          <th className="px-4 py-3">Roll #</th>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Registration #</th>
                          <th className="px-4 py-3">Contact</th>
                          <th className="px-4 py-3">Gender / Blood</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Profile Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {isClassStudentsLoading ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400">
                              Loading enrolled students...
                            </td>
                          </tr>
                        ) : filteredStudents && filteredStudents.length > 0 ? (
                          filteredStudents.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50/80 transition">
                              <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                                #{st.rollNumber}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                                    {st.firstName[0]}
                                    {st.lastName[0]}
                                  </div>
                                  <span className="font-bold text-slate-900">{st.fullName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                                {st.studentRegistrationNumber || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <div className="space-y-0.5">
                                  {st.email && (
                                    <p className="flex items-center gap-1 text-[11px] text-slate-600 truncate max-w-[150px]">
                                      <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                      <span className="truncate">{st.email}</span>
                                    </p>
                                  )}
                                  {st.guardianPhone && (
                                    <p className="flex items-center gap-1 text-[11px] text-slate-600">
                                      <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                      <span>{st.guardianPhone}</span>
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {st.gender} {st.bloodGroup ? `• ${st.bloodGroup}` : ''}
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  {st.status || 'Active'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClass(null);
                                    navigate(`/portal?studentId=${st.id}`);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition shadow-sm group"
                                  title={`Redirect to Student Portal for ${st.fullName}`}
                                >
                                  <GraduationCap className="h-3.5 w-3.5" />
                                  <span>Student Portal</span>
                                  <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400">
                              <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                              {studentSearch ? 'No students match your search criteria.' : 'No students currently enrolled in this classroom.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-between items-center border-t border-slate-200 pt-4">
              <span className="text-xs text-slate-400">
                Classroom Cohort ID: <code className="font-mono text-slate-500">{selectedClass.id.slice(0, 13)}...</code>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedClass(null);
                  setStudentSearch('');
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Close View
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Subject Modal */}
      {isAddSubjectModalOpen && (
        <Modal
          isOpen={isAddSubjectModalOpen}
          onClose={() => setIsAddSubjectModalOpen(false)}
          title="Create New Subject"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Subject Name *</label>
              <input
                type="text"
                required
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="e.g. Computer Science"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Subject Code *</label>
              <input
                type="text"
                required
                value={newSubCode}
                onChange={(e) => setNewSubCode(e.target.value)}
                placeholder="e.g. CS-101"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs uppercase focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Description (Optional)</label>
              <textarea
                value={newSubDesc}
                onChange={(e) => setNewSubDesc(e.target.value)}
                placeholder="Curriculum overview and syllabus notes"
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Designated Teachers for this Subject (Optional)
              </label>
              <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-300 p-2 space-y-1.5 bg-slate-50/50">
                {teachers && teachers.length > 0 ? (
                  teachers.map((t) => {
                    const isChecked = newSubTeacherIds.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100/70 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewSubTeacherIds([...newSubTeacherIds, t.id]);
                            } else {
                              setNewSubTeacherIds(newSubTeacherIds.filter((id) => id !== t.id));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium text-slate-800">{t.fullName}</span>
                        <span className="text-[10px] text-slate-400">({t.employeeCode})</span>
                        {t.specialization && <span className="text-[10px] text-indigo-600 truncate">— {t.specialization}</span>}
                      </label>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400">No teachers found.</p>
                )}
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                A single subject can have multiple teachers.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setIsAddSubjectModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newSubName || !newSubCode || createSubjectMutation.isPending}
                onClick={() =>
                  createSubjectMutation.mutate({
                    name: newSubName,
                    code: newSubCode,
                    description: newSubDesc || undefined,
                    teacherIds: newSubTeacherIds.length > 0 ? newSubTeacherIds : undefined,
                  })
                }
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {createSubjectMutation.isPending ? 'Creating...' : 'Save Subject'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Allot / Change Class Teacher Modal */}
      {isAllotModalOpen && allotTargetClass && (
        <Modal
          isOpen={isAllotModalOpen}
          onClose={() => setIsAllotModalOpen(false)}
          title={`Allot Class Teacher — ${allotTargetClass.fullName}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-150 bg-gradient-to-r from-indigo-50/90 to-purple-50/40 p-4">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Classroom Cohort</span>
                  <p className="font-bold text-slate-900 text-sm">{allotTargetClass.fullName}</p>
                  <p className="text-[11px] text-slate-500">{allotTargetClass.academicYearName || 'Current Session'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Current Class Teacher</span>
                  <p className="font-bold text-indigo-700 text-sm">
                    {allotTargetClass.classTeacherName ? (
                      allotTargetClass.classTeacherName
                    ) : (
                      <span className="text-amber-600 font-semibold italic">Not Allotted</span>
                    )}
                  </p>
                  {allotTargetClass.classTeacherEmployeeCode && (
                    <span className="font-mono text-[10px] text-indigo-600 font-bold">
                      {allotTargetClass.classTeacherEmployeeCode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Faculty Member to Allot as Class Teacher *
              </label>
              <select
                value={allotTeacherId}
                onChange={(e) => setAllotTeacherId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="">-- Choose Faculty / Teacher --</option>
                {teachers?.filter((t) => t.status === 'Active' || (t as any).status === 0 || !t.status).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.employeeCode}) {t.specialization ? `— ${t.specialization}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                Assigning a Class Teacher designates them as the primary mentor, daily attendance coordinator, and parent liaison for this cohort.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              {allotTargetClass.classTeacherId ? (
                <button
                  type="button"
                  disabled={removeClassTeacherMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Unassign ${allotTargetClass.classTeacherName} as Class Teacher for ${allotTargetClass.fullName}?`)) {
                      removeClassTeacherMutation.mutate(allotTargetClass.id);
                    }
                  }}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                >
                  {removeClassTeacherMutation.isPending ? 'Unassigning...' : 'Remove Class Teacher'}
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAllotModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!allotTeacherId || assignClassTeacherMutation.isPending}
                  onClick={() => {
                    if (allotTargetClass && allotTeacherId) {
                      assignClassTeacherMutation.mutate({
                        classId: allotTargetClass.id,
                        teacherId: allotTeacherId,
                      });
                    }
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                >
                  {assignClassTeacherMutation.isPending ? 'Saving Allotment...' : 'Confirm Allotment'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Allot Faculty to Class Subject Modal */}
      {allotFacultyModal && (
        <Modal
          isOpen={allotFacultyModal.isOpen}
          onClose={() => setAllotFacultyModal(null)}
          title={`Allot Faculty — ${allotFacultyModal.subject.name}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-150 bg-gradient-to-r from-indigo-50/90 to-purple-50/40 p-4">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Subject & Classroom</span>
                  <p className="font-bold text-slate-900 text-sm">
                    {allotFacultyModal.subject.name} ({allotFacultyModal.subject.code})
                  </p>
                  <p className="text-[11px] text-slate-500">{allotFacultyModal.classRoom.fullName}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Current Assigned Faculty</span>
                  <p className="font-bold text-indigo-700 text-sm">
                    {allotFacultyModal.subject.teacherName ? (
                      allotFacultyModal.subject.teacherName
                    ) : (
                      <span className="text-amber-600 font-semibold italic">Unallocated</span>
                    )}
                  </p>
                  {allotFacultyModal.subject.teacherEmployeeCode && (
                    <span className="font-mono text-[10px] text-indigo-600 font-bold">
                      {allotFacultyModal.subject.teacherEmployeeCode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Faculty Member *
              </label>
              <select
                value={allotFacultyModal.teacherId}
                onChange={(e) =>
                  setAllotFacultyModal({ ...allotFacultyModal, teacherId: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="">-- Choose Faculty Member --</option>
                {modalSubjectTeachers && modalSubjectTeachers.some((t) => t.isAllocatedToSubject) && (
                  <optgroup label="✨ Teachers Qualified / Allocated for this Subject">
                    {modalSubjectTeachers
                      .filter((t) => t.isAllocatedToSubject)
                      .map((t) => (
                        <option key={t.teacherId} value={t.teacherId}>
                          ★ {t.fullName} ({t.employeeCode}) {t.specialization ? `— ${t.specialization}` : ''}
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Other Available Faculty">
                  {teachers
                    ?.filter(
                      (t) =>
                        !modalSubjectTeachers?.some(
                          (st) => st.isAllocatedToSubject && st.teacherId === t.id
                        )
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} ({t.employeeCode}) {t.specialization ? `— ${t.specialization}` : ''}
                      </option>
                    ))}
                </optgroup>
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                A single subject can have multiple teachers across different classes, or multiple qualified teachers assigned.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 font-medium">
                <input
                  type="checkbox"
                  checked={allotFacultyModal.isClassTeacher}
                  onChange={(e) =>
                    setAllotFacultyModal({ ...allotFacultyModal, isClassTeacher: e.target.checked })
                  }
                  disabled={!allotFacultyModal.teacherId}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                />
                <span>Also designate as <strong>Class Teacher</strong> for {allotFacultyModal.classRoom.fullName}</span>
              </label>
              <p className="mt-1 text-[10px] text-slate-500 pl-6">
                This teacher will be displayed dynamically as the main cohort advisor and attendance authority.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              {allotFacultyModal.subject.teacherId ? (
                <button
                  type="button"
                  disabled={removeSubjectTeacherMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove assigned faculty from ${allotFacultyModal.subject.name}?`
                      )
                    ) {
                      removeSubjectTeacherMutation.mutate({
                        classId: allotFacultyModal.classRoom.id,
                        subjectId: allotFacultyModal.subject.id,
                      });
                    }
                  }}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                >
                  {removeSubjectTeacherMutation.isPending ? 'Removing...' : 'Remove Faculty'}
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAllotFacultyModal(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!allotFacultyModal.teacherId || assignSubjectTeacherMutation.isPending}
                  onClick={() => {
                    if (allotFacultyModal.teacherId) {
                      assignSubjectTeacherMutation.mutate({
                        classId: allotFacultyModal.classRoom.id,
                        subjectId: allotFacultyModal.subject.id,
                        teacherId: allotFacultyModal.teacherId,
                        isClassTeacher: allotFacultyModal.isClassTeacher,
                      });
                    }
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                >
                  {assignSubjectTeacherMutation.isPending ? 'Saving...' : 'Save Faculty'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ClassesPage;
