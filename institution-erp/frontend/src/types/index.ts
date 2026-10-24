export type UserRole = 'HOD' | 'Teacher' | 'Student' | 'Parent' | 'Admin' | 'SuperAdmin' | 'Accountant';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  roles: UserRole[];
}

export interface CredentialSlip {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
  identifier: string;
  generatedAtUtc: string;
}

export interface ResetPasswordResponse {
  message: string;
  email: string;
  newPassword?: string;
  credentialSlip?: CredentialSlip;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

// ─── Email OTP ─────────────────────────────────────────────────────────────

export interface LoginOtpChallengeResponse {
  requiresOtp: boolean;
  challengeId: string;
  emailMasked: string;
}

export interface PendingOtpChallenge {
  challengeId: string;
  emailMasked: string;
}

export interface VerifyOtpRequest {
  challengeId: string;
  code: string;
}

export interface ResendOtpRequest {
  challengeId: string;
}

/** Legacy TOTP types kept for compatibility */
export interface TotpChallengeResponse {
  requiresTotpSetup?: boolean;
  requiresTotp?: boolean;
  requiresOtp?: boolean;
  challengeId: string;
  emailMasked?: string;
}

export interface TotpSetupResponse {
  otpAuthUri: string;
  base32Key: string;
}

export interface TotpConfirmResponse extends AuthResponse {
  recoveryCodes: string[];
}

export interface TwoFaStatus {
  isEnabled: boolean;
  recoveryCodesRemaining: number;
  trustedDeviceCount: number;
}

export interface PendingTotpChallenge {
  challengeId: string;
  requiresSetup: boolean;
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface ClassRoom {
  id: string;
  name: string;
  section: string;
  fullName: string;
  capacity: number;
  academicYearId: string;
  academicYearName: string;
  studentCount: number;
  classTeacherId?: string;
  classTeacherName?: string;
  classTeacherEmployeeCode?: string;
  classTeacherEmail?: string;
  classTeacherPhone?: string;
  subjectCount?: number;
  isAttendanceMarkedToday?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmployeeCode?: string;
  isClassTeacher?: boolean;
}

export interface SubjectTeacher {
  teacherId: string;
  fullName: string;
  employeeCode: string;
  specialization: string;
  email?: string;
  phoneNumber?: string;
  isAllocatedToSubject: boolean;
}

export interface TimetableStatus {
  academicYearId: string;
  academicYearName: string;
  isFixed: boolean;
  fixedAt?: string;
  fixedBy?: string;
}

export interface TeacherAllocation {
  id: string;
  teacherId: string;
  teacherName: string;
  classRoomId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  isClassTeacher: boolean;
}

export interface Teacher {
  id: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
  status: 'Active' | 'OnLeave' | 'Resigned';
  allocations: TeacherAllocation[];
  generatedPassword?: string;
}

export interface Student {
  id: string;
  userId: string;
  studentRegistrationNumber: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  address: string;
  status: 'Active' | 'Alumni' | 'Suspended';
  admissionDate: string;
  classRoomId: string;
  className: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  generatedPassword?: string;
}

export interface CreateStudentResponse extends Student {
  credentialSlip?: CredentialSlip;
}

export interface CreateTeacherResponse extends Teacher {
  credentialSlip?: CredentialSlip;
}


export interface AdmissionDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadUrl: string;
}

export interface AdmissionHistory {
  id: string;
  fromStatus: string;
  toStatus: string;
  remarks?: string;
  changedBy?: string;
  changedAt: string;
}

export interface Admission {
  id: string;
  referenceNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
  address: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianRelation: string;
  desiredClassRoomId: string;
  desiredClassName: string;
  previousSchoolName?: string;
  previousSchoolPercentage: number;
  status: 'Submitted' | 'UnderReview' | 'Approved' | 'Rejected' | 'Waitlisted';
  reviewRemarks?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  createdStudentId?: string;
  documents: AdmissionDocument[];
  statusHistory: AdmissionHistory[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Leave';
  remarks?: string;
  markedBy?: string;
}

export interface ClassAttendanceSummary {
  classRoomId: string;
  className: string;
  date: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  presentPercentage: number;
  isMarked?: boolean;
  records: AttendanceRecord[];
}

export interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  leaveDays: number;
  attendancePercentage: number;
  isLowAttendance: boolean;
}

export interface ExamSubject {
  id: string;
  examId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  passMarks: number;
  examDate: string;
  teacherId?: string;
  teacherName?: string;
  canCurrentUserEdit?: boolean;
}

export interface Exam {
  id: string;
  name: string;
  type: 'UnitExam' | 'MidTerm' | 'FinalExam' | 'Practical';
  academicYearId: string;
  academicYearName: string;
  classRoomId: string;
  className: string;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  isLocked: boolean;
  publishedAt?: string;
  subjects: ExamSubject[];
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  passMarks: number;
  marksObtained: number;
  isAbsent: boolean;
  isPassed: boolean;
  gradeLetter: string;
  remarks?: string;
}

export interface StudentExamResult {
  examId: string;
  examName: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  academicYear?: string;
  subjectResults: SubjectResult[];
  totalMarksObtained: number;
  totalMaxMarks: number;
  percentage: number;
  overallGrade: string;
  isOverallPassed: boolean;
  classRank: number;
  attendancePercentage: number;
}

export interface ExamMarkEntry {
  studentId: string;
  rollNumber: string;
  studentName: string;
  marksObtained: number;
  maxMarks: number;
  passMarks: number;
  isAbsent: boolean;
  remarks?: string;
  hasSavedMark: boolean;
  examSubjectId: string;
  subjectName: string;
  enteredBy?: string;
}

export interface ClassSubjectMark {
  subjectId: string;
  subjectName: string;
  marksObtained: number;
  maxMarks: number;
  passMarks: number;
  isAbsent: boolean;
  isPassed: boolean;
  gradeLetter: string;
  remarks?: string;
}

export interface ClassStudentResult {
  studentId: string;
  studentName: string;
  rollNumber: string;
  subjectMarks: Record<string, ClassSubjectMark>;
  totalMarksObtained: number;
  totalMaxMarks: number;
  percentage: number;
  overallGrade: string;
  isOverallPassed: boolean;
  classRank: number;
  attendancePercentage: number;
}

export interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  passMarks: number;
  averageMarks: number;
  highestMarks: number;
  lowestMarks: number;
  passPercentage: number;
}

export interface ClassExamAnalytics {
  totalStudents: number;
  evaluatedStudents: number;
  passedStudents: number;
  failedStudents: number;
  passPercentage: number;
  classAveragePercentage: number;
  highestPercentage: number;
  highestScorerName: string;
  lowestPercentage: number;
  gradeDistribution: Record<string, number>;
  subjectSummaries: SubjectSummary[];
}

export interface ClassExamReport {
  examId: string;
  examName: string;
  examType: string;
  classRoomId: string;
  className: string;
  academicYearName: string;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  isLocked: boolean;
  publishedAt?: string;
  subjects: ExamSubject[];
  students: ClassStudentResult[];
  analytics: ClassExamAnalytics;
}

export interface FeeHead {
  id: string;
  name: string;
  description?: string;
  isMandatory: boolean;
}

export interface FeeStructureItem {
  id: string;
  feeHeadId: string;
  feeHeadName: string;
  amount: number;
  dueDate: string;
}

export interface FeeStructure {
  id: string;
  name: string;
  academicYearId: string;
  academicYearName: string;
  classRoomId: string;
  className: string;
  frequency: string;
  totalAmount: number;
  items: FeeStructureItem[];
}

export interface FeePayment {
  id: string;
  studentFeeId: string;
  studentName: string;
  feeHeadName: string;
  amount: number;
  mode: 'Cash' | 'Cheque' | 'UPI' | 'Card' | 'BankTransfer' | 'OnlineGateway';
  transactionReference?: string;
  paymentDate: string;
  receivedBy: string;
  remarks?: string;
  receiptId?: string;
  receiptNumber?: string;
}

export interface StudentFee {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  feeStructureItemId: string;
  feeHeadName: string;
  baseAmount: number;
  discountAmount: number;
  lateFeeAmount: number;
  totalPayable: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string;
  status: 'Pending' | 'Partial' | 'Paid' | 'Failed';
  isOverdue: boolean;
  payments: FeePayment[];
}

export interface FeeDefaulter {
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
  totalDue: number;
  earliestDueDate: string;
  daysOverdue: number;
}

export interface FeeCollectionSummary {
  todayCollection: number;
  thisMonthCollection: number;
  totalPendingDues: number;
  defaulterCount: number;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  audience: 'All' | 'HOD' | 'Teacher' | 'Student' | 'SpecificClass';
  targetClassRoomId?: string;
  targetClassName?: string;
  expiryDate?: string;
  attachmentUrl?: string;
  isPinned: boolean;
  postedBy: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  channel: 'InApp' | 'Email' | 'Sms' | 'WhatsApp';
  isRead: boolean;
  readAt?: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

export interface TimetableEntry {
  id: string;
  classRoomId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: number;
  periodNumber: number;
  startTime: string;
  endTime: string;
  roomNumber?: string;
}

export interface AdminDashboardData {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  todayAttendancePercentage: number;
  monthlyFeeCollected: number;
  totalPendingFees: number;
  attendanceTrend30Days: { label: string; value: number }[];
  monthlyFeeCollectionTrend: { label: string; value: number }[];
  classWiseStrength: { className: string; studentCount: number }[];
  recentAdmissions: Admission[];
  lowAttendanceStudents: StudentAttendanceSummary[];
}

export interface AccountantDashboardData {
  collectionToday: number;
  collectionThisMonth: number;
  totalPendingDues: number;
  defaulterCount: number;
  duesByClass: { className: string; dueAmount: number }[];
  recentPayments: FeePayment[];
  monthlyFeeCollectionTrend: { label: string; value: number }[];
}

export interface TeacherDashboardData {
  teacherId?: string;
  teacherName: string;
  totalAllocatedClasses: number;
  todayClassesCount: number;
  todaySchedule: TimetableEntry[];
  classesToMarkAttendance: ClassRoom[];
  pendingMarksEntryExams: ExamSubject[];
}

export interface ParentStudentDashboardData {
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  classRoomId?: string;
  phoneNumber?: string;
  guardianName?: string;
  guardianPhone?: string;
  email?: string;
  attendancePercentage: number;
  feesDue: number;
  latestExamResultSummary?: string;
  recentNotices: Notice[];
  timetable: TimetableEntry[];
}

export interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  entityName: string;
  entityId?: string;
  oldValuesJson?: string;
  newValuesJson?: string;
  ipAddress?: string;
  createdAt: string;
}
