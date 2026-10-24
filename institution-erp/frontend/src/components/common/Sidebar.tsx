import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CheckSquare,
  FileSpreadsheet,
  Receipt,
  Bell,
  ShieldCheck,
  History,
  Cloud,
  HeartHandshake,
  ExternalLink,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { hasRole, user } = useAuth();

  const isHod = hasRole('HOD');
  const isTeacher = hasRole('Teacher');
  const isStudent = hasRole('Student');

  // Navigation Items
  const navItems = [
    {
      title: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      title: 'Student Portal',
      path: '/portal',
      icon: HeartHandshake,
      show: !isStudent && (isHod || isTeacher),
    },
    {
      title: 'Admissions Queue',
      path: '/admissions',
      icon: UserPlus,
      show: isHod,
    },
    {
      title: 'Students Directory',
      path: '/students',
      icon: Users,
      show: isHod,
    },
    {
      title: 'Teachers & Staff',
      path: '/teachers',
      icon: GraduationCap,
      show: isHod,
    },
    {
      title: 'Classes & Subjects',
      path: '/classes',
      icon: BookOpen,
      show: isHod || isTeacher,
    },
    {
      title: 'Timetable Grid',
      path: '/timetable',
      icon: Calendar,
      show: isHod || isTeacher || isStudent,
    },
    {
      title: 'Attendance',
      path: '/attendance',
      icon: CheckSquare,
      show: isHod || isTeacher,
    },
    {
      title: 'Exams & Results',
      path: '/exams',
      icon: FileSpreadsheet,
      show: isHod || isTeacher || isStudent,
    },
    {
      title: 'Fee Management',
      path: '/fees',
      icon: Receipt,
      show: isHod,
    },
    {
      title: 'Notices Board',
      path: '/notices',
      icon: Bell,
      show: true,
    },
    {
      title: 'Staff & Roles',
      path: '/admin/users',
      icon: ShieldCheck,
      show: isHod,
    },
    {
      title: 'System Audit Logs',
      path: '/admin/audit-logs',
      icon: History,
      show: isHod,
    },
    {
      title: 'Supabase Cloud',
      path: '/admin/supabase',
      icon: Cloud,
      show: isHod,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
              CC
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
                Campus Core
              </span>
              <span className="block text-[10px] text-slate-400 font-medium">ERP v1.0</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 active:scale-95 transition-all duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Main Menu
          </p>

          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.98] ${
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.title}</span>
                </NavLink>
              );
            })}

          {!isStudent && (
            <div className="pt-4 mt-4 border-t border-slate-150 dark:border-slate-800">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Public Portal
              </p>
              <NavLink
                to="/admissions/apply"
                target="_blank"
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span>Public Admissions</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </NavLink>
            </div>
          )}
        </div>

        {/* User Card footer */}
        <div className="p-3 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
          <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
              {user?.fullName}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
      </aside>
    </>
  );
};
