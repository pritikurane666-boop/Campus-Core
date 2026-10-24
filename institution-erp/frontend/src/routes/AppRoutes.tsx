import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../store/authContext';

// Layouts
import { MainLayout } from '../layouts/MainLayout';
import { PublicLayout } from '../layouts/PublicLayout';

// Auth Pages
import { LoginPage } from '../pages/auth/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from '../pages/auth/PasswordPages';

// Public Admission Pages
import { ApplyAdmissionPage } from '../pages/public/AdmissionPublicPages';

// Dashboards
import { AdminDashboardPage } from '../pages/dashboards/AdminDashboardPage';
import { TeacherDashboardPage } from '../pages/dashboards/TeacherDashboardPage';
import { ParentDashboardPage } from '../pages/dashboards/ParentDashboardPage';

// Modules
import { AdmissionsQueuePage } from '../pages/admissions/AdmissionsQueuePage';
import { StudentsListPage } from '../pages/students/StudentsListPage';
import { TeachersListPage } from '../pages/teachers/TeachersListPage';
import { ClassesPage } from '../pages/academics/ClassesPage';
import { TimetablePage } from '../pages/academics/TimetablePage';
import { MarkAttendancePage } from '../pages/attendance/MarkAttendancePage';
import { ExamsListPage } from '../pages/exams/ExamsListPage';
import { MarksEntryPage } from '../pages/exams/MarksEntryPage';
import { ResultsViewPage } from '../pages/exams/ResultsViewPage';
import { FeeManagementPage } from '../pages/fees/FeeManagementPage';
import { FeeDefaultersPage } from '../pages/fees/FeeDefaultersPage';
import { NoticesPage } from '../pages/notices/NoticesPage';
import { UsersPage } from '../pages/admin/UsersPage';
import { AuditLogsPage } from '../pages/admin/AuditLogsPage';
import { SupabaseManagementPage } from '../pages/admin/SupabaseManagementPage';

// Smart Dashboard Dispatcher
const RoleDashboardDispatcher: React.FC = () => {
  const { user } = useAuth();

  if (!user || !user.roles || user.roles.length === 0) {
    return <AdminDashboardPage />;
  }

  if (user.roles.includes('HOD')) {
    return <AdminDashboardPage />;
  }
  if (user.roles.includes('Teacher')) {
    return <TeacherDashboardPage />;
  }
  if (user.roles.includes('Student')) {
    return <ParentDashboardPage />;
  }

  return <AdminDashboardPage />;
};

// HOD Only Guard (HOD: Admin Governance, Fees, Teachers, Admissions, Student Directory)
const HodOnly: React.FC<{ children: React.ReactNode; fallback?: string }> = ({
  children,
  fallback = '/dashboard',
}) => {
  const { hasRole } = useAuth();
  if (!hasRole('HOD')) {
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
};

// Staff Only Guard (HOD or Teacher: Classroom management, Attendance, Student Portal, Marks Entry)
const StaffOnly: React.FC<{ children: React.ReactNode; fallback?: string }> = ({
  children,
  fallback = '/dashboard',
}) => {
  const { hasRole } = useAuth();
  if (!hasRole(['HOD', 'Teacher'])) {
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes with Public Layout */}
      <Route element={<PublicLayout />}>
        <Route path="/admissions/apply" element={<ApplyAdmissionPage />} />
        <Route path="/admissions/status" element={<Navigate to="/admissions/apply" replace />} />
      </Route>

      {/* Standalone Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected Routes with Main ERP Layout */}
      <Route element={<MainLayout />}>
        {/* Default route redirects to /dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RoleDashboardDispatcher />} />
        <Route path="/portal" element={<ParentDashboardPage />} />

        {/* HOD-Only Governance Modules */}
        <Route path="/admissions" element={<HodOnly><AdmissionsQueuePage /></HodOnly>} />
        <Route path="/students" element={<HodOnly><StudentsListPage /></HodOnly>} />
        <Route path="/teachers" element={<HodOnly><TeachersListPage /></HodOnly>} />
        <Route path="/fees" element={<HodOnly><FeeManagementPage /></HodOnly>} />
        <Route path="/fees/defaulters" element={<HodOnly><FeeDefaultersPage /></HodOnly>} />
        <Route path="/admin/users" element={<HodOnly><UsersPage /></HodOnly>} />
        <Route path="/admin/audit-logs" element={<HodOnly><AuditLogsPage /></HodOnly>} />
        <Route path="/admin/supabase" element={<HodOnly><SupabaseManagementPage /></HodOnly>} />
        <Route path="/supabase" element={<HodOnly><SupabaseManagementPage /></HodOnly>} />

        {/* Staff Operations (HOD & Teachers) */}
        <Route path="/classes" element={<StaffOnly><ClassesPage /></StaffOnly>} />
        <Route path="/attendance" element={<StaffOnly><MarkAttendancePage /></StaffOnly>} />
        <Route path="/attendance/mark" element={<StaffOnly><MarkAttendancePage /></StaffOnly>} />
        <Route path="/attendance/low" element={<StaffOnly><MarkAttendancePage /></StaffOnly>} />
        <Route path="/exams/marks" element={<StaffOnly><MarksEntryPage /></StaffOnly>} />
        <Route path="/exams/results" element={<StaffOnly><ResultsViewPage /></StaffOnly>} />

        {/* Academic & All-Role Views */}
        <Route path="/timetable" element={<TimetablePage />} />
        <Route path="/exams" element={<ExamsListPage />} />
        <Route path="/notices" element={<NoticesPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
