# CampusCore (institution-erp) — Architecture & Dependency Map (MAP.md)

**Branch:** `prod-hardening`  
**Status:** Complete Architecture & Dependency Mapping

---

## 1. System Layers Architecture

```
+---------------------------------------------------------------------------------------+
| 1. PRESENTATION LAYER (Vercel SPA)                                                   |
|    - React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons                       |
|    - Routes: AppRoutes.tsx (RoleDashboardDispatcher, RoleStudentsDispatcher, etc.)    |
|    - Pages: 22 Page Components in src/pages/ (auth, academics, attendance, exams, etc.)|
|    - State: TanStack React Query v5 + React Context (AuthContext)                     |
+---------------------------------------------------------------------------------------+
                                          |
                                          | HTTP /api/v1 (Vercel reverse-proxy rewrite)
                                          v
+---------------------------------------------------------------------------------------+
| 2. API / PRESENTATION HOST (.NET 8 Web API on Render Docker Container)                |
|    - Program.cs: Middleware pipeline, CORS, Forwarded Headers, Auth, Rate Limiting    |
|    - 10 Controller Files hosting 22 Controller Classes (BaseApiController)             |
|    - Direct DbContext injection across all controllers (no MediatR / AutoMapper)       |
+---------------------------------------------------------------------------------------+
                                          |
                                          | DTOs, Interfaces, Validators
                                          v
+---------------------------------------------------------------------------------------+
| 3. APPLICATION LAYER (InstitutionErp.Application)                                    |
|    - Common Interfaces: IApplicationDbContext, IJwtTokenService, IPasswordHasher      |
|    - DTO Contracts: StudentDto, TeacherDto, ExamDto, FeeDto, AuthResponse, etc.       |
|    - Validators: FluentValidation classes in AppValidators.cs                         |
|    - Mapping: Mapster configurations                                                  |
+---------------------------------------------------------------------------------------+
                                          |
                                          | Implementations & Persistence
                                          v
+---------------------------------------------------------------------------------------+
| 4. INFRASTRUCTURE LAYER (InstitutionErp.Infrastructure)                              |
|    - Persistence: ApplicationDbContext (EF Core 8 with SnakeCase naming convention)   |
|    - Auth: PasswordHasher (BCrypt.Net-Next), JwtTokenService (System.IdentityModel)   |
|    - Storage: FileStorageService (Local Disk -> Supabase Storage in Prod)             |
|    - PDF Generation: QuestPdfService (Receipts, Report Cards)                         |
|    - Payments: RazorpayPaymentGateway (HMAC-SHA256 signature verification)            |
|    - Notifications: InApp, Email (MailKit/SMTP -> Brevo HTTPS in Prod), SMS, WhatsApp |
|    - Background Services: NotificationOutboxWorker (IHostedService background poller) |
|    - Seeding: DatabaseSeeder (Roles, Academic structure, Default Admin)               |
+---------------------------------------------------------------------------------------+
                                          |
                                          | Domain Models
                                          v
+---------------------------------------------------------------------------------------+
| 5. DOMAIN LAYER (InstitutionErp.Domain)                                              |
|    - BaseEntity: Id (Guid), CreatedAt, CreatedBy, UpdatedAt, UpdatedBy, IsDeleted     |
|    - Enums: UserRoleType, StudentStatus, AttendanceStatus, ExamStatus, etc.           |
|    - 32 Domain Entities across 10 files                                               |
+---------------------------------------------------------------------------------------+
                                          |
                                          | PostgreSQL Connection (Port 5432 + SSL)
                                          v
+---------------------------------------------------------------------------------------+
| 6. DATABASE LAYER (Supabase PostgreSQL 18)                                           |
|    - 32 Tables with snake_case naming convention                                      |
|    - Soft delete filtering via EF Core Global Query Filter (e.IsDeleted == false)     |
+---------------------------------------------------------------------------------------+
```

---

## 2. Complete UI Page to Database Dependency Map

The following exhaustive table traces every UI page component, the client-side API calls it makes, the receiving backend controller and method, the domain entities manipulated, and the underlying database tables and keys.

| UI Page Component | Route & Guard | API Endpoint Method (`endpoints.ts`) | HTTP & Route | Controller & Action | Domain Entities Touched | Database Tables & Foreign Keys |
|---|---|---|---|---|---|---|
| **`LoginPage`** | `/login`<br>*(Public)* | `authApi.login` | `POST api/v1/auth/login` | `AuthController.Login` | `User`, `Role`, `UserRole`, `RefreshToken` | `users` (PK: `id`)<br>`roles` (PK: `id`)<br>`user_roles` (FK: `user_id`, `role_id`)<br>`refresh_tokens` (FK: `user_id`) |
| **`ForgotPasswordPage`** | `/forgot-password`<br>*(Public)* | `authApi.forgotPassword` | `POST api/v1/auth/forgot-password` | `AuthController.ForgotPassword` | `User`, `NotificationOutbox` | `users` (PK: `id`)<br>`notification_outboxes` (PK: `id`) |
| **`ResetPasswordPage`** | `/reset-password`<br>*(Public)* | `authApi.resetPassword` | `POST api/v1/auth/reset-password` | `AuthController.ResetPassword` | `User`, `RefreshToken` | `users` (PK: `id`)<br>`refresh_tokens` (FK: `user_id`) |
| **`ApplyAdmissionPage`** | `/admissions/apply`<br>*(Public)* | `academicApi.getClasses`<br>`admissionsApi.apply`<br>`admissionsApi.uploadDoc` | `GET api/v1/classes`<br>`POST api/v1/admissions/apply`<br>`POST api/v1/admissions/{id}/documents` | `ClassesController.GetClasses`<br>`AdmissionsController.Apply`<br>`AdmissionsController.UploadDocument` | `ClassRoom`, `Admission`, `AdmissionDocument`, `AdmissionStatusHistory`, `NotificationOutbox` | `classes` (PK: `id`)<br>`admissions` (PK: `id`, FK: `class_room_id`)<br>`admission_documents` (FK: `admission_id`)<br>`admission_status_histories` (FK: `admission_id`)<br>`notification_outboxes` |
| **`AdminDashboardPage`** | `/dashboard`<br>*(Principal)* | `dashboardApi.getAdmin`<br>`noticesApi.getList` | `GET api/v1/dashboard/admin`<br>`GET api/v1/notices` | `DashboardController.GetAdminDashboard`<br>`NoticesController.GetNotices` | `Student`, `Teacher`, `ClassRoom`, `FeePayment`, `Attendance`, `Notice` | `students`<br>`teachers`<br>`classes`<br>`fee_payments`<br>`attendances`<br>`notices` |
| **`TeacherDashboardPage`** | `/dashboard`<br>*(Teacher)* | `dashboardApi.getTeacher`<br>`noticesApi.getList` | `GET api/v1/dashboard/teacher`<br>`GET api/v1/notices` | `DashboardController.GetTeacherDashboard`<br>`NoticesController.GetNotices` | `Teacher`, `TeacherAllocation`, `TimetableEntry`, `Attendance`, `Notice` | `teachers` (FK: `user_id`)<br>`teacher_allocations` (FK: `teacher_id`, `class_room_id`)<br>`timetable_entries`<br>`attendances`<br>`notices` |
| **`ParentDashboardPage`** (Student Portal) | `/dashboard` or `/portal`<br>*(Student)* | `dashboardApi.getParent`<br>`examsApi.getMyResults`<br>`timetableApi.getMyClass`<br>`noticesApi.getList` | `GET api/v1/dashboard/parent`<br>`GET api/v1/results/me`<br>`GET api/v1/timetable/my-class`<br>`GET api/v1/notices` | `DashboardController.GetStudentDashboard`<br>`ResultsController.GetMyResults`<br>`TimetableController.GetMyClassTimetable`<br>`NoticesController.GetNotices` | `Student`, `Attendance`, `ExamMark`, `Exam`, `Subject`, `TimetableEntry`, `Notice` | `students` (FK: `user_id`, `class_room_id`)<br>`attendances` (FK: `student_id`)<br>`exam_marks` (FK: `student_id`, `exam_subject_id`)<br>`exams`<br>`subjects`<br>`timetable_entries`<br>`notices` |
| **`AdmissionsQueuePage`** | `/admissions`<br>*(StaffOnly)* | `admissionsApi.getList`<br>`admissionsApi.updateStatus`<br>`admissionsApi.delete`<br>`admissionsApi.downloadDocument`<br>`admissionsApi.exportCsv` | `GET api/v1/admissions`<br>`PUT api/v1/admissions/{id}/status`<br>`DELETE api/v1/admissions/{id}`<br>`GET api/v1/admissions/documents/{id}/download`<br>`GET api/v1/admissions/export` | `AdmissionsController.GetAdmissions`<br>`AdmissionsController.UpdateStatus`<br>`AdmissionsController.DeleteAdmission`<br>`AdmissionsController.DownloadDocument`<br>`AdmissionsController.ExportToCsv` | `Admission`, `AdmissionDocument`, `AdmissionStatusHistory`, `Student`, `User`, `UserRole`, `Role` | `admissions`<br>`admission_documents`<br>`admission_status_histories`<br>`students`<br>`users`<br>`user_roles` |
| **`StudentsListPage`** | `/students`<br>*(RoleStudentsDispatcher)* | `studentsApi.getList`<br>`studentsApi.create`<br>`studentsApi.update`<br>`studentsApi.delete`<br>`studentsApi.resetPassword`<br>`studentsApi.exportCsv`<br>`academicApi.getClasses` | `GET api/v1/students`<br>`POST api/v1/students`<br>`PUT api/v1/students/{id}`<br>`DELETE api/v1/students/{id}`<br>`POST api/v1/students/{id}/reset-password`<br>`GET api/v1/students/export`<br>`GET api/v1/classes` | `StudentsController.GetStudents`<br>`StudentsController.Create`<br>`StudentsController.Update`<br>`StudentsController.Delete`<br>`StudentsController.ResetPassword`<br>`StudentsController.ExportToCsv`<br>`ClassesController.GetClasses` | `Student`, `User`, `UserRole`, `Role`, `ClassRoom`, `StudentFee`, `FeeStructure` | `students` (FK: `user_id`, `class_room_id`)<br>`users`<br>`user_roles`<br>`classes`<br>`student_fees`<br>`fee_structures` |
| **`TeachersListPage`** | `/teachers`<br>*(StaffOnly)* | `teachersApi.getList`<br>`teachersApi.create`<br>`teachersApi.update`<br>`teachersApi.delete`<br>`teachersApi.resetPassword`<br>`teachersApi.allocate`<br>`teachersApi.deallocate`<br>`teachersApi.getAttendance`<br>`teachersApi.markAttendance` | `GET api/v1/teachers`<br>`POST api/v1/teachers`<br>`PUT api/v1/teachers/{id}`<br>`DELETE api/v1/teachers/{id}`<br>`POST api/v1/teachers/{id}/reset-password`<br>`POST api/v1/teachers/{id}/allocations`<br>`DELETE api/v1/teachers/{id}/allocations/{allocationId}`<br>`GET api/v1/teacher-attendance`<br>`POST api/v1/teacher-attendance` | `TeachersController.GetTeachers`<br>`TeachersController.Create`<br>`TeachersController.Update`<br>`TeachersController.DeleteTeacher`<br>`TeachersController.ResetPassword`<br>`TeachersController.AllocateTeacher`<br>`TeachersController.DeallocateTeacher`<br>`TeacherAttendanceController.GetAttendance`<br>`TeacherAttendanceController.Mark` | `Teacher`, `User`, `UserRole`, `Role`, `TeacherAllocation`, `TeacherAttendance`, `ClassRoom`, `Subject` | `teachers` (FK: `user_id`)<br>`users`<br>`user_roles`<br>`teacher_allocations` (FK: `teacher_id`, `class_room_id`, `subject_id`)<br>`teacher_attendances` (FK: `teacher_id`)<br>`classes`<br>`subjects` |
| **`ClassesPage`** | `/classes`<br>*(StaffOnly)* | `academicApi.getClasses`<br>`academicApi.createClass`<br>`academicApi.updateClass`<br>`academicApi.deleteClass`<br>`academicApi.getYears`<br>`academicApi.getSubjects`<br>`academicApi.assignSubject`<br>`academicApi.assignSubjectTeacher`<br>`academicApi.removeSubjectTeacher`<br>`academicApi.removeSubject`<br>`academicApi.assignClassTeacher`<br>`academicApi.removeClassTeacher` | `GET api/v1/classes`<br>`POST api/v1/classes`<br>`PUT api/v1/classes/{id}`<br>`DELETE api/v1/classes/{id}`<br>`GET api/v1/academic-years`<br>`GET api/v1/subjects`<br>`POST api/v1/classes/{id}/subjects`<br>`POST api/v1/classes/{id}/subjects/{subjectId}/teacher`<br>`DELETE api/v1/classes/{id}/subjects/{subjectId}/teacher`<br>`DELETE api/v1/classes/{id}/subjects/{subjectId}`<br>`POST api/v1/classes/{id}/class-teacher`<br>`DELETE api/v1/classes/{id}/class-teacher` | `ClassesController` (multiple methods)<br>`AcademicYearsController.GetAcademicYears`<br>`SubjectsController.GetSubjects` | `ClassRoom`, `AcademicYear`, `Subject`, `ClassSubject`, `Teacher`, `TeacherAllocation` | `classes` (FK: `academic_year_id`, `class_teacher_id`)<br>`academic_years`<br>`subjects`<br>`class_subjects` (FK: `class_room_id`, `subject_id`, `teacher_id`)<br>`teachers`<br>`teacher_allocations` |
| **`TimetablePage`** | `/timetable`<br>*(All Roles)* | `timetableApi.getByClass`<br>`timetableApi.getMyClass`<br>`timetableApi.create`<br>`timetableApi.delete`<br>`timetableApi.getYearStatus`<br>`timetableApi.fixYear`<br>`timetableApi.unfixYear` | `GET api/v1/timetable/class/{classId}`<br>`GET api/v1/timetable/my-class`<br>`POST api/v1/timetable`<br>`DELETE api/v1/timetable/{id}`<br>`GET api/v1/timetable/academic-year/{academicYearId}/status`<br>`POST api/v1/timetable/academic-year/{academicYearId}/fix`<br>`POST api/v1/timetable/academic-year/{academicYearId}/unfix` | `TimetableController.GetByClass`<br>`TimetableController.GetMyClassTimetable`<br>`TimetableController.Create`<br>`TimetableController.Delete`<br>`TimetableController.GetYearTimetableStatus`<br>`TimetableController.FixYearTimetable`<br>`TimetableController.UnfixYearTimetable` | `TimetableEntry`, `ClassRoom`, `Subject`, `Teacher`, `AcademicYear` | `timetable_entries` (FK: `class_room_id`, `subject_id`, `teacher_id`, `academic_year_id`)<br>`classes`<br>`subjects`<br>`teachers`<br>`academic_years` |
| **`MarkAttendancePage`** | `/attendance`<br>*(StaffOnly)* | `academicApi.getClasses`<br>`attendanceApi.getClass`<br>`attendanceApi.mark`<br>`attendanceApi.getLowAttendance` | `GET api/v1/classes`<br>`GET api/v1/attendance/class/{classId}`<br>`POST api/v1/attendance/mark`<br>`GET api/v1/attendance/low-attendance` | `ClassesController.GetClasses`<br>`AttendanceController.GetClassAttendance`<br>`AttendanceController.MarkAttendance`<br>`AttendanceController.GetLowAttendance` | `Attendance`, `Student`, `ClassRoom`, `TeacherAllocation` | `attendances` (FK: `student_id`, `class_room_id`)<br>`students`<br>`classes`<br>`teacher_allocations` |
| **`ExamsListPage`** | `/exams`<br>*(All Roles)* | `examsApi.getList`<br>`examsApi.create`<br>`examsApi.update`<br>`examsApi.delete`<br>`examsApi.publish`<br>`academicApi.getClasses`<br>`academicApi.getYears`<br>`examsApi.getMyResults` | `GET api/v1/exams`<br>`POST api/v1/exams`<br>`PUT api/v1/exams/{id}`<br>`DELETE api/v1/exams/{id}`<br>`POST api/v1/exams/{id}/publish`<br>`GET api/v1/classes`<br>`GET api/v1/academic-years`<br>`GET api/v1/results/me` | `ExamsController.GetExams`<br>`ExamsController.Create`<br>`ExamsController.Update`<br>`ExamsController.Delete`<br>`ExamsController.PublishExam`<br>`ClassesController.GetClasses`<br>`AcademicYearsController.GetAcademicYears`<br>`ResultsController.GetMyResults` | `Exam`, `ExamSubject`, `ExamMark`, `ClassRoom`, `AcademicYear`, `Subject`, `GradeScale` | `exams` (FK: `academic_year_id`, `class_room_id`)<br>`exam_subjects` (FK: `exam_id`, `subject_id`)<br>`exam_marks` (FK: `exam_subject_id`, `student_id`)<br>`classes`<br>`academic_years`<br>`subjects`<br>`grade_scales` |
| **`MarksEntryPage`** | `/exams/marks`<br>*(RoleMarksEntryDispatcher)* | `examsApi.getById`<br>`examsApi.getMarks`<br>`examsApi.saveMarks` | `GET api/v1/exams/{id}`<br>`GET api/v1/exams/{id}/marks/{subjectId}`<br>`POST api/v1/exams/{id}/marks` | `ExamsController.GetExam`<br>`ExamsController.GetMarks`<br>`ExamsController.SaveMarks` | `Exam`, `ExamSubject`, `ExamMark`, `Student`, `TeacherAllocation` | `exams`<br>`exam_subjects`<br>`exam_marks`<br>`students`<br>`teacher_allocations` |
| **`ResultsViewPage`** | `/exams/results`<br>*(RoleResultsViewDispatcher)* | `examsApi.getClassReport`<br>`examsApi.exportClassCsv`<br>`examsApi.downloadReportCard`<br>`examsApi.openReportCardPdf` | `GET api/v1/results/exam/{examId}/class-report`<br>`GET api/v1/results/exam/{examId}/export-csv`<br>`GET api/v1/results/{examId}/report-card/{studentId}` | `ResultsController.GetClassExamReport`<br>`ResultsController.ExportClassExamCsv`<br>`ResultsController.DownloadReportCardPdf` | `Exam`, `ExamSubject`, `ExamMark`, `Student`, `GradeScale` | `exams`<br>`exam_subjects`<br>`exam_marks`<br>`students`<br>`grade_scales` |
| **`FeeManagementPage`** | `/fees`<br>*(StaffOnly)* | `feesApi.getStructures`<br>`feesApi.createStructure`<br>`feesApi.updateStructure`<br>`feesApi.deleteStructure`<br>`feesApi.getHeads`<br>`feesApi.createHead`<br>`feesApi.updateHead`<br>`feesApi.deleteHead`<br>`feesApi.getStudentFees`<br>`feesApi.recordPayment`<br>`feesApi.recordBulkPayment`<br>`feesApi.downloadReceipt`<br>`feesApi.getCollectionReport` | `GET api/v1/fee-structures`<br>`POST api/v1/fee-structures`<br>`PUT api/v1/fee-structures/{id}`<br>`DELETE api/v1/fee-structures/{id}`<br>`GET api/v1/fee-heads`<br>`POST api/v1/fee-heads`<br>`PUT api/v1/fee-heads/{id}`<br>`DELETE api/v1/fee-heads/{id}`<br>`GET api/v1/fees/student/{studentId}`<br>`POST api/v1/fees/payments`<br>`POST api/v1/fees/payments/bulk`<br>`GET api/v1/fees/payments/{paymentId}/receipt`<br>`GET api/v1/fees/reports/collection` | `FeeStructuresController` (multiple)<br>`FeeHeadsController` (multiple)<br>`FeesController` (multiple) | `FeeStructure`, `FeeStructureItem`, `FeeHead`, `StudentFee`, `FeePayment`, `FeeReceipt`, `Student` | `fee_structures` (FK: `class_room_id`, `academic_year_id`)<br>`fee_structure_items` (FK: `fee_structure_id`, `fee_head_id`)<br>`fee_heads`<br>`student_fees` (FK: `student_id`, `fee_structure_id`)<br>`fee_payments` (FK: `student_fee_id`)<br>`fee_receipts` (FK: `fee_payment_id`)<br>`students` |
| **`FeeDefaultersPage`** | `/fees/defaulters`<br>*(StaffOnly)* | `feesApi.getDefaulters`<br>`feesApi.exportDefaultersCsv`<br>`academicApi.getClasses` | `GET api/v1/fees/reports/defaulters`<br>`GET api/v1/fees/reports/defaulters/export`<br>`GET api/v1/classes` | `FeesController.GetDefaulters`<br>`FeesController.ExportDefaultersToCsv`<br>`ClassesController.GetClasses` | `StudentFee`, `Student`, `ClassRoom` | `student_fees`<br>`students`<br>`classes` |
| **`NoticesPage`** | `/notices`<br>*(All Roles)* | `noticesApi.getList`<br>`noticesApi.create`<br>`noticesApi.delete` | `GET api/v1/notices`<br>`POST api/v1/notices`<br>`DELETE api/v1/notices/{id}` | `NoticesController.GetNotices`<br>`NoticesController.Create`<br>`NoticesController.Delete` | `Notice`, `NotificationOutbox` | `notices` (PK: `id`)<br>`notification_outboxes` |
| **`UsersPage`** | `/admin/users`<br>*(StaffOnly)* | `adminApi.getUsers`<br>`adminApi.createUser`<br>`adminApi.updateUserStatus`<br>`adminApi.updateUserRoles`<br>`adminApi.resetUserPassword` | `GET api/v1/users`<br>`POST api/v1/users`<br>`PUT api/v1/users/{id}/status`<br>`PUT api/v1/users/{id}/roles`<br>`PUT api/v1/users/{id}/reset-password` | `UsersController.GetUsers`<br>`UsersController.CreateUser`<br>`UsersController.UpdateStatus`<br>`UsersController.UpdateRoles`<br>`UsersController.ResetPassword` | `User`, `Role`, `UserRole`, `RefreshToken` | `users` (PK: `id`)<br>`roles`<br>`user_roles` (FK: `user_id`, `role_id`)<br>`refresh_tokens` |
| **`AuditLogsPage`** | `/admin/audit-logs`<br>*(StaffOnly)* | `adminApi.getAuditLogs` | `GET api/v1/audit-logs` | `AuditLogsController.GetAuditLogs` | `AuditLog` | `audit_logs` (PK: `id`, FK: `user_id`) |
| **`NotificationsBar` / Header** | *(All Authenticated)* | `notificationsApi.getList`<br>`notificationsApi.getUnreadCount`<br>`notificationsApi.markRead`<br>`notificationsApi.markAllRead` | `GET api/v1/notifications`<br>`GET api/v1/notifications/unread-count`<br>`PUT api/v1/notifications/{id}/read`<br>`PUT api/v1/notifications/read-all` | `NotificationsController.GetNotifications`<br>`NotificationsController.GetUnreadCount`<br>`NotificationsController.MarkRead`<br>`NotificationsController.MarkAllRead` | `Notification` | `notifications` (PK: `id`, FK: `user_id`) |

---

## 3. Database Entities & Tables Cross-Reference

| Entity Class (`InstitutionErp.Domain.Entities`) | Database Table | Primary Key | Foreign Keys & Target Tables | Key Indexes & Constraints |
|---|---|---|---|---|
| `User` | `users` | `id` (uuid) | None | Unique(`email`) |
| `Role` | `roles` | `id` (uuid) | None | Unique(`name`) |
| `UserRole` | `user_roles` | (`user_id`, `role_id`) | `user_id` -> `users.id`<br>`role_id` -> `roles.id` | Composite PK; Cascade Delete |
| `RefreshToken` | `refresh_tokens` | `id` (uuid) | `user_id` -> `users.id` | Index(`token_hash`) |
| `AcademicYear` | `academic_years` | `id` (uuid) | None | `name`, `start_date`, `end_date`, `is_current` |
| `ClassRoom` | `classes` | `id` (uuid) | `academic_year_id` -> `academic_years.id`<br>`class_teacher_id` -> `teachers.id` | `name`, `section`, `capacity` |
| `Subject` | `subjects` | `id` (uuid) | None | `name`, `code` |
| `ClassSubject` | `class_subjects` | `id` (uuid) | `class_room_id` -> `classes.id`<br>`subject_id` -> `subjects.id`<br>`teacher_id` -> `teachers.id` | Index(`class_room_id`, `subject_id`) |
| `Teacher` | `teachers` | `id` (uuid) | `user_id` -> `users.id` | Unique(`employee_code`) |
| `TeacherAllocation` | `teacher_allocations` | `id` (uuid) | `teacher_id` -> `teachers.id`<br>`class_room_id` -> `classes.id`<br>`subject_id` -> `subjects.id` | Index(`teacher_id`, `class_room_id`) |
| `TimetableEntry` | `timetable_entries` | `id` (uuid) | `academic_year_id` -> `academic_years.id`<br>`class_room_id` -> `classes.id`<br>`subject_id` -> `subjects.id`<br>`teacher_id` -> `teachers.id` | Unique(`class_room_id`, `day_of_week`, `period_number`)<br>Unique(`teacher_id`, `day_of_week`, `period_number`) |
| `TeacherAttendance` | `teacher_attendances` | `id` (uuid) | `teacher_id` -> `teachers.id` | Unique(`teacher_id`, `date`) |
| `Student` | `students` | `id` (uuid) | `user_id` -> `users.id`<br>`class_room_id` -> `classes.id` | Unique(`student_registration_number`) |
| `Admission` | `admissions` | `id` (uuid) | `class_room_id` -> `classes.id` | Unique(`reference_number`) |
| `AdmissionDocument` | `admission_documents` | `id` (uuid) | `admission_id` -> `admissions.id` | Cascade Delete |
| `AdmissionStatusHistory` | `admission_status_histories` | `id` (uuid) | `admission_id` -> `admissions.id` | Cascade Delete |
| `FeeHead` | `fee_heads` | `id` (uuid) | None | `name`, `code`, `is_optional` |
| `FeeStructure` | `fee_structures` | `id` (uuid) | `academic_year_id` -> `academic_years.id`<br>`class_room_id` -> `classes.id` | `name`, `total_amount` |
| `FeeStructureItem` | `fee_structure_items` | `id` (uuid) | `fee_structure_id` -> `fee_structures.id`<br>`fee_head_id` -> `fee_heads.id` | Cascade Delete |
| `StudentFee` | `student_fees` | `id` (uuid) | `student_id` -> `students.id`<br>`fee_structure_id` -> `fee_structures.id` | Index(`student_id`, `status`) |
| `FeePayment` | `fee_payments` | `id` (uuid) | `student_fee_id` -> `student_fees.id` | `receipt_number`, `payment_mode` |
| `FeeReceipt` | `fee_receipts` | `id` (uuid) | `fee_payment_id` -> `fee_payments.id` | 1:1 Unique with `FeePayment` |
| `Attendance` | `attendances` | `id` (uuid) | `student_id` -> `students.id`<br>`class_room_id` -> `classes.id` | Unique(`student_id`, `date`) |
| `Exam` | `exams` | `id` (uuid) | `academic_year_id` -> `academic_years.id`<br>`class_room_id` -> `classes.id` | `name`, `term`, `status` |
| `ExamSubject` | `exam_subjects` | `id` (uuid) | `exam_id` -> `exams.id`<br>`subject_id` -> `subjects.id` | Cascade Delete |
| `ExamMark` | `exam_marks` | `id` (uuid) | `exam_subject_id` -> `exam_subjects.id`<br>`student_id` -> `students.id` | Unique(`exam_subject_id`, `student_id`) |
| `GradeScale` | `grade_scales` | `id` (uuid) | None | `grade`, `min_percentage`, `max_percentage` |
| `Notice` | `notices` | `id` (uuid) | None | `title`, `target_role`, `is_pinned` |
| `Notification` | `notifications` | `id` (uuid) | `user_id` -> `users.id` | Index(`user_id`, `is_read`) |
| `NotificationOutbox` | `notification_outboxes` | `id` (uuid) | None | Index(`status`, `next_retry_at`) |
| `AuditLog` | `audit_logs` | `id` (uuid) | `user_id` -> `users.id` | Index(`entity_name`, `entity_id`) |
| `AppSetting` | `app_settings` | `id` (uuid) | None | Unique(`key`) |
