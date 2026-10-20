# Institutional ERP Database Schema & Architecture

This document specifies the relational database schema implemented in **PostgreSQL** via **Entity Framework Core 8** with snake_case naming conventions, soft delete query filters, and audit metadata.

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned
    USERS ||--o{ REFRESH_TOKENS : owns
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOGS : triggers

    ACADEMIC_YEARS ||--o{ CLASSES : defines
    CLASSES ||--o{ STUDENTS : enrolls
    CLASSES ||--o{ CLASS_SUBJECTS : teaches
    SUBJECTS ||--o{ CLASS_SUBJECTS : belongs
    CLASSES ||--o{ TEACHER_ALLOCATIONS : assigns
    TEACHERS ||--o{ TEACHER_ALLOCATIONS : assigned
    SUBJECTS ||--o{ TEACHER_ALLOCATIONS : covers
    CLASSES ||--o{ TIMETABLE_ENTRIES : schedules
    TEACHERS ||--o{ TIMETABLE_ENTRIES : instructs
    SUBJECTS ||--o{ TIMETABLE_ENTRIES : for

    STUDENTS ||--o{ STUDENT_PARENTS : relates
    PARENTS ||--o{ STUDENT_PARENTS : relates
    ADMISSIONS ||--o{ ADMISSION_DOCUMENTS : submits
    ADMISSIONS ||--o{ ADMISSION_STATUS_HISTORIES : tracks
    CLASSES ||--o{ ADMISSIONS : applies_for

    STUDENTS ||--o{ ATTENDANCES : records
    CLASSES ||--o{ ATTENDANCES : happens_in
    TEACHERS ||--o{ TEACHER_ATTENDANCES : logs

    EXAMS ||--o{ EXAM_SUBJECTS : includes
    SUBJECTS ||--o{ EXAM_SUBJECTS : tested
    CLASSES ||--o{ EXAMS : conducts
    STUDENTS ||--o{ STUDENT_MARKS : graded
    EXAM_SUBJECTS ||--o{ STUDENT_MARKS : evaluates

    CLASSES ||--o{ FEE_STRUCTURES : has
    FEE_HEADS ||--o{ FEE_STRUCTURE_ITEMS : categorizes
    FEE_STRUCTURES ||--o{ FEE_STRUCTURE_ITEMS : contains
    STUDENTS ||--o{ STUDENT_FEES : incurs
    FEE_STRUCTURE_ITEMS ||--o{ STUDENT_FEES : specifies
    STUDENT_FEES ||--o{ FEE_PAYMENTS : paid_by
    FEE_PAYMENTS ||--|| RECEIPTS : generates

    NOTICES ||--o{ CLASSES : targets
```

## Key Entities & Constraints
1. **Users & Auth:**
   - Password hashing: `BCrypt.Net-Next` (WorkFactor 12).
   - Refresh Token rotation: Expired on usage, stores client IP and revoked status.
2. **Admissions:**
   - Automatic reference generation: `ADM-YYYY-####`.
   - On Approval: Instantly invokes transaction generating Student record, Student User (`student{N}@institution.edu`), Parent User (`parent{N}@family.com`), and links via `StudentParent`.
3. **Attendance:**
   - Unique constraint: `(StudentId, Date)` prevents duplicate daily records.
   - Triggers automated notifications to parents for any student marked `Absent`.
4. **Fees & Receipts:**
   - Payment modes: Cash, Card, Cheque, UPI, BankTransfer, OnlineGateway.
   - QuestPDF engine generates immutable, downloadable PDF receipts with receipt numbering `REC-YYYY-####`.
5. **Grading & Report Cards:**
   - Percentage calculation and letter grade resolution (A+, A, B+, B, C, D, F).
   - QuestPDF engine generates full institution-branded report cards.
