import { apiClient } from './client';
import * as T from '../types';

export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient.post<T.AuthResponse | T.TotpChallengeResponse>('/auth/login', data).then(r => r.data),
  adminLogin: (data: { email: string; password: string }) =>
    apiClient.post<T.AuthResponse>('/auth/admin-login', data).then(r => r.data),
  logout: () => apiClient.post('/auth/logout').then(r => r.data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.post<T.AuthResponse>('/auth/change-password', data).then(r => r.data),
  keepPassword: () =>
    apiClient.post<T.AuthResponse>('/auth/keep-password').then(r => r.data),
  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword: (data: { email: string; token: string; newPassword: string }) =>
    apiClient.post('/auth/reset-password', data).then(r => r.data),
  getMe: () => apiClient.get<T.User>('/auth/me').then(r => r.data),

  // ─── Email OTP ────────────────────────────────────────────────────────────
  verifyOtp: (data: { challengeId: string; code: string }) =>
    apiClient.post<T.AuthResponse>('/auth/verify-otp', data).then(r => r.data),

  resendOtp: (challengeId: string) =>
    apiClient.post<{ message: string; emailMasked?: string }>('/auth/resend-otp', { challengeId }).then(r => r.data),

  // ─── Legacy 2FA ────────────────────────────────────────────────────────────
  /** Request setup: returns { otpAuthUri, base32Key } */
  totp2faSetup: (challengeId: string) =>
    apiClient.post<T.TotpSetupResponse>('/auth/2fa/setup', { challengeId }).then(r => r.data),

  /** Confirm enrollment: returns { recoveryCodes[], ...AuthResponse } */
  totp2faConfirm: (challengeId: string, code: string) =>
    apiClient.post<T.TotpConfirmResponse>('/auth/2fa/confirm', { challengeId, code }).then(r => r.data),

  /** Verify TOTP code or recovery code: returns AuthResponse */
  totp2faVerify: (challengeId: string, data: { code?: string; recoveryCode?: string; trustDevice?: boolean }) =>
    apiClient.post<T.AuthResponse>('/auth/2fa/verify', { challengeId, ...data }).then(r => r.data),

  /** 2FA status for current user */
  totp2faStatus: () =>
    apiClient.get<T.TwoFaStatus>('/auth/2fa/status').then(r => r.data),

  /** Regenerate recovery codes (requires password + code) */
  totp2faRegenerateCodes: (password: string, code: string) =>
    apiClient.post<{ recoveryCodes: string[] }>('/auth/2fa/regenerate-codes', { password, code }).then(r => r.data),

  /** Forget all trusted devices */
  totp2faForgetDevices: () =>
    apiClient.post<{ message: string }>('/auth/2fa/forget-devices').then(r => r.data),

  /** Admin reset of another user's 2FA (Principal step-up) */
  totp2faAdminReset: (targetUserId: string, principalCode: string) =>
    apiClient.post<{ message: string }>('/auth/2fa/admin-reset', { targetUserId, principalCode }).then(r => r.data),
};

export const dashboardApi = {
  getAdmin: () => apiClient.get<T.AdminDashboardData>('/dashboard/admin').then(r => r.data),
  getAccountant: () => apiClient.get<T.AccountantDashboardData>('/dashboard/accountant').then(r => r.data),
  getTeacher: () => apiClient.get<T.TeacherDashboardData>('/dashboard/teacher').then(r => r.data),
  getParent: (studentId?: string) =>
    apiClient.get<T.ParentStudentDashboardData>('/dashboard/parent', { params: { studentId } }).then(r => r.data),
};

export const admissionsApi = {
  apply: (data: any) => apiClient.post<T.Admission>('/admissions/apply', data).then(r => r.data),
  getStatus: (refNumber: string) => apiClient.get<T.Admission>(`/admissions/status/${refNumber}`).then(r => r.data),
  getList: (params: { page?: number; pageSize?: number; search?: string; status?: string; classId?: string }) =>
    apiClient.get<T.PagedResult<T.Admission>>('/admissions', { params }).then(r => r.data),
  uploadDoc: (id: string, formData: FormData) =>
    apiClient.post(`/admissions/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  updateStatus: (id: string, data: { newStatus: string; remarks?: string }) =>
    apiClient.put(`/admissions/${id}/status`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/admissions/${id}`).then(r => r.data),
  downloadDocument: async (id: string, fileName: string) => {
    const res = await apiClient.get(`/admissions/documents/${id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },
  viewDocument: async (id: string) => {
    const res = await apiClient.get(`/admissions/documents/${id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
  },
  exportCsv: async (status?: string, classId?: string) => {
    const res = await apiClient.get('/admissions/export', { params: { status, classId }, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admissions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

export const studentsApi = {
  getMyProfile: () => apiClient.get<T.Student>('/students/me').then(r => r.data),
  getList: (params: { page?: number; pageSize?: number; search?: string; classId?: string; status?: string }) =>
    apiClient.get<T.PagedResult<T.Student>>('/students', { params }).then(r => r.data),
  getById: (id: string) => apiClient.get<T.Student>(`/students/${id}`).then(r => r.data),
  create: (data: any) => apiClient.post<T.CreateStudentResponse>('/students', data).then(r => r.data),
  update: (id: string, data: any) => apiClient.put(`/students/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/students/${id}`).then(r => r.data),
  resetPassword: (id: string, newPassword?: string) =>
    apiClient.post<T.ResetPasswordResponse>(`/students/${id}/reset-password`, { newPassword }).then(r => r.data),
  exportCsv: async (classId?: string) => {
    const res = await apiClient.get('/students/export', { params: { classId }, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

export const parentsApi = {
  getMyChildren: () => apiClient.get<T.Student[]>('/parents/my-children').then(r => r.data),
};

export const teachersApi = {
  getList: () => apiClient.get<T.Teacher[]>('/teachers').then(r => r.data),
  getById: (id: string) => apiClient.get<T.Teacher>(`/teachers/${id}`).then(r => r.data),
  create: (data: any) => apiClient.post<T.CreateTeacherResponse>('/teachers', data).then(r => r.data),
  update: (id: string, data: any) => apiClient.put<T.Teacher>(`/teachers/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/teachers/${id}`).then(r => r.data),
  resetPassword: (id: string, newPassword?: string) =>
    apiClient.post<T.ResetPasswordResponse>(`/teachers/${id}/reset-password`, { newPassword }).then(r => r.data),
  allocate: (id: string, data: { classRoomId: string; subjectId: string; isClassTeacher: boolean }) =>
    apiClient.post(`/teachers/${id}/allocations`, data).then(r => r.data),
  deallocate: (allocationId: string, teacherId?: string) =>
    apiClient.delete(teacherId ? `/teachers/${teacherId}/allocations/${allocationId}` : `/teachers/allocations/${allocationId}`).then(r => r.data),
  getAttendance: (date?: string) => apiClient.get<any[]>('/teacher-attendance', { params: { date } }).then(r => r.data),
  markAttendance: (data: any) => apiClient.post('/teacher-attendance', data).then(r => r.data),
};

export const academicApi = {
  getYears: () => apiClient.get<T.AcademicYear[]>('/academic-years').then(r => r.data),
  createYear: (data: any) => apiClient.post<T.AcademicYear>('/academic-years', data).then(r => r.data),
  updateYear: (id: string, data: any) => apiClient.put<T.AcademicYear>(`/academic-years/${id}`, data).then(r => r.data),
  deleteYear: (id: string) => apiClient.delete(`/academic-years/${id}`).then(r => r.data),
  getClasses: () => apiClient.get<T.ClassRoom[]>('/classes').then(r => r.data),
  createClass: (data: any) => apiClient.post<T.ClassRoom>('/classes', data).then(r => r.data),
  updateClass: (id: string, data: any) => apiClient.put<T.ClassRoom>(`/classes/${id}`, data).then(r => r.data),
  deleteClass: (id: string) => apiClient.delete(`/classes/${id}`).then(r => r.data),
  getSubjects: () => apiClient.get<T.Subject[]>('/subjects').then(r => r.data),
  createSubject: (data: any) => apiClient.post<T.Subject>('/subjects', data).then(r => r.data),
  updateSubject: (id: string, data: any) => apiClient.put<T.Subject>(`/subjects/${id}`, data).then(r => r.data),
  deleteSubject: (id: string) => apiClient.delete(`/subjects/${id}`).then(r => r.data),
  getClassSubjects: (classId: string) => apiClient.get<T.Subject[]>(`/classes/${classId}/subjects`).then(r => r.data),
  assignSubject: (classId: string, subjectId: string, teacherId?: string, isClassTeacher?: boolean) =>
    apiClient.post(`/classes/${classId}/subjects`, {
      classRoomId: classId,
      subjectId,
      teacherId: teacherId || undefined,
      isClassTeacher: !!isClassTeacher,
    }).then(r => r.data),
  assignSubjectTeacher: (classId: string, subjectId: string, data: { teacherId: string; isClassTeacher?: boolean }) =>
    apiClient.post(`/classes/${classId}/subjects/${subjectId}/teacher`, data).then(r => r.data),
  removeSubjectTeacher: (classId: string, subjectId: string) =>
    apiClient.delete(`/classes/${classId}/subjects/${subjectId}/teacher`).then(r => r.data),
  removeSubject: (classId: string, subjectId: string) =>
    apiClient.delete(`/classes/${classId}/subjects/${subjectId}`).then(r => r.data),
  getSubjectTeachers: (subjectId: string) =>
    apiClient.get<T.SubjectTeacher[]>(`/subjects/${subjectId}/teachers`).then(r => r.data),
  associateSubjectTeacher: (subjectId: string, teacherId: string) =>
    apiClient.post(`/subjects/${subjectId}/teachers`, { teacherId }).then(r => r.data),
  getClassStudents: (classId: string) =>
    apiClient.get<T.Student[]>(`/classes/${classId}/students`).then(r => r.data),
  assignClassTeacher: (classId: string, data: { teacherId: string; subjectId?: string }) =>
    apiClient.post(`/classes/${classId}/class-teacher`, data).then(r => r.data),
  removeClassTeacher: (classId: string) =>
    apiClient.delete(`/classes/${classId}/class-teacher`).then(r => r.data),
};

export const timetableApi = {
  getMyClass: () => apiClient.get<T.TimetableEntry[]>('/timetable/my-class').then(r => r.data),
  getByClass: (classId: string) => apiClient.get<T.TimetableEntry[]>(`/timetable/class/${classId}`).then(r => r.data),
  getByTeacher: (teacherId: string) => apiClient.get<T.TimetableEntry[]>(`/timetable/teacher/${teacherId}`).then(r => r.data),
  create: (data: any) => apiClient.post<T.TimetableEntry>('/timetable', data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/timetable/${id}`).then(r => r.data),
  getYearStatus: (academicYearId: string) =>
    apiClient.get<T.TimetableStatus>(`/timetable/academic-year/${academicYearId}/status`).then(r => r.data),
  fixYear: (academicYearId: string) =>
    apiClient.post(`/timetable/academic-year/${academicYearId}/fix`).then(r => r.data),
  unfixYear: (academicYearId: string) =>
    apiClient.post(`/timetable/academic-year/${academicYearId}/unfix`).then(r => r.data),
};

export const attendanceApi = {
  mark: (data: { classRoomId: string; date: string; records: { studentId: string; status: string; remarks?: string }[] }) =>
    apiClient.post('/attendance/mark', data).then(r => r.data),
  getClass: (classId: string, date?: string) =>
    apiClient.get<T.ClassAttendanceSummary>(`/attendance/class/${classId}`, { params: { date } }).then(r => r.data),
  getStudentSummary: (studentId: string) =>
    apiClient.get<T.StudentAttendanceSummary>(`/attendance/student/${studentId}/summary`).then(r => r.data),
  getLowAttendance: (classId?: string) =>
    apiClient.get<T.StudentAttendanceSummary[]>('/attendance/low-attendance', { params: { classId } }).then(r => r.data),
};

export const examsApi = {
  getMyResults: () => apiClient.get<T.StudentExamResult[]>('/results/me').then(r => r.data),
  getList: (classId?: string) => apiClient.get<T.Exam[]>('/exams', { params: { classId } }).then(r => r.data),
  getById: (id: string) => apiClient.get<T.Exam>(`/exams/${id}`).then(r => r.data),
  create: (data: any) => apiClient.post<T.Exam>('/exams', data).then(r => r.data),
  update: (id: string, data: any) => apiClient.put<T.Exam>(`/exams/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/exams/${id}`).then(r => r.data),
  getMarks: (examId: string, subjectId: string) =>
    apiClient.get<T.ExamMarkEntry[]>(`/exams/${examId}/marks/${subjectId}`).then(r => r.data),
  saveMarks: (examId: string, data: { examSubjectId: string; marks: { studentId: string; marksObtained: number; isAbsent: boolean; remarks?: string }[] }) =>
    apiClient.post(`/exams/${examId}/marks`, data).then(r => r.data),
  publish: (examId: string) => apiClient.post(`/exams/${examId}/publish`).then(r => r.data),
  getStudentResults: (studentId: string) =>
    apiClient.get<T.StudentExamResult[]>(`/results/student/${studentId}`).then(r => r.data),
  getClassReport: (examId: string) =>
    apiClient.get<T.ClassExamReport>(`/results/exam/${examId}/class-report`).then(r => r.data),
  exportClassCsv: async (examId: string, examName: string, className: string) => {
    const res = await apiClient.get(`/results/exam/${examId}/export-csv`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Class_Marks_${examName.replace(/\s+/g, '_')}_${className.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
  downloadReportCard: async (examId: string, studentId: string, studentName: string) => {
    const res = await apiClient.get(`/results/${examId}/report-card/${studentId}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ReportCard_${studentName.replace(/\s+/g, '_')}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
  printReportCard: async (examId: string, studentId: string) => {
    const res = await apiClient.get(`/results/${examId}/report-card/${studentId}`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    iframe.src = url;
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.open(url, '_blank');
      }
    }, 600);
  },
  openReportCardPdf: async (examId: string, studentId: string) => {
    const res = await apiClient.get(`/results/${examId}/report-card/${studentId}`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  },
};

export const feesApi = {
  getStructures: (classId?: string) => apiClient.get<T.FeeStructure[]>('/fee-structures', { params: { classId } }).then(r => r.data),
  createStructure: (data: any) => apiClient.post<T.FeeStructure>('/fee-structures', data).then(r => r.data),
  updateStructure: (id: string, data: any) => apiClient.put<T.FeeStructure>(`/fee-structures/${id}`, data).then(r => r.data),
  deleteStructure: (id: string) => apiClient.delete(`/fee-structures/${id}`).then(r => r.data),
  getHeads: () => apiClient.get<T.FeeHead[]>('/fee-heads').then(r => r.data),
  createHead: (data: any) => apiClient.post<T.FeeHead>('/fee-heads', data).then(r => r.data),
  updateHead: (id: string, data: any) => apiClient.put<T.FeeHead>(`/fee-heads/${id}`, data).then(r => r.data),
  deleteHead: (id: string) => apiClient.delete(`/fee-heads/${id}`).then(r => r.data),
  getStudentFees: (studentId: string) => apiClient.get<T.StudentFee[]>(`/fees/student/${studentId}`).then(r => r.data),
  recordPayment: (data: { studentFeeId: string; amount: number; mode: string; transactionReference?: string; remarks?: string }) =>
    apiClient.post<T.FeePayment>('/fees/payments', data).then(r => r.data),
  recordBulkPayment: (data: {
    studentId: string;
    mode: string;
    transactionReference?: string;
    remarks?: string;
    items: { studentFeeId?: string; feeHeadId?: string; feeHeadName?: string; amount: number }[];
  }) => apiClient.post<{ totalAmount: number; receiptNumber: string; payments: T.FeePayment[] }>('/fees/payments/bulk', data).then(r => r.data),
  downloadReceipt: async (paymentId: string, receiptNo: string) => {
    const res = await apiClient.get(`/fees/payments/${paymentId}/receipt`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Receipt_${receiptNo}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
  getCollectionReport: () => apiClient.get<T.FeeCollectionSummary>('/fees/reports/collection').then(r => r.data),
  getDefaulters: (classId?: string) => apiClient.get<T.FeeDefaulter[]>('/fees/reports/defaulters', { params: { classId } }).then(r => r.data),
  exportDefaultersCsv: async (classId?: string) => {
    const res = await apiClient.get('/fees/reports/defaulters/export', { params: { classId }, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fee_defaulters_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

export const noticesApi = {
  getList: () => apiClient.get<T.Notice[]>('/notices').then(r => r.data),
  create: (data: any) => apiClient.post<T.Notice>('/notices', data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/notices/${id}`).then(r => r.data),
};

export const notificationsApi = {
  getList: () => apiClient.get<T.Notification[]>('/notifications').then(r => r.data),
  getUnreadCount: () => apiClient.get<{ unreadCount: number }>('/notifications/unread-count').then(r => r.data),
  markRead: (id: string) => apiClient.put(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: () => apiClient.put('/notifications/read-all').then(r => r.data),
};

export const adminApi = {
  getUsers: (params: { page?: number; pageSize?: number; search?: string; role?: string }) =>
    apiClient.get<T.PagedResult<T.User>>('/users', { params }).then(r => r.data),
  createUser: (data: any) => apiClient.post<T.User>('/users', data).then(r => r.data),
  updateUserStatus: (id: string, isActive: boolean) =>
    apiClient.put(`/users/${id}/status`, { isActive }).then(r => r.data),
  updateUserRoles: (id: string, roles: string[]) =>
    apiClient.put(`/users/${id}/roles`, { roles }).then(r => r.data),
  resetUserPassword: (id: string, newPassword: string) =>
    apiClient.put(`/users/${id}/reset-password`, { newPassword }).then(r => r.data),
  getAuditLogs: (params: { page?: number; pageSize?: number; action?: string; entity?: string; search?: string }) =>
    apiClient.get<T.PagedResult<T.AuditLog>>('/audit-logs', { params }).then(r => r.data),
};
