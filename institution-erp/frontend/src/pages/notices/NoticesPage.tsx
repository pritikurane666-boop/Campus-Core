import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noticesApi, academicApi } from '../../api/endpoints';
import { Notice } from '../../types';
import Modal from '../../components/ui/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { Bell, Pin, Plus, Trash2, Calendar, Users, Filter, BookOpen, Award, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../store/authContext';

export const NoticesPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const isPrincipal = hasRole('Principal');
  const isTeacher = hasRole('Teacher');
  const isAdmin = hasRole('Principal');
  const queryClient = useQueryClient();

  const [audienceFilter, setAudienceFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState(isTeacher && !isAdmin ? 'SpecificClass' : 'All');
  const [targetClassRoomId, setTargetClassRoomId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');

  // Fetch classes (for teachers, automatically filtered to their allocated classes)
  const { data: classes } = useQuery({
    queryKey: ['classes-list'],
    queryFn: academicApi.getClasses,
  });

  useEffect(() => {
    if (classes && classes.length > 0 && !targetClassRoomId) {
      setTargetClassRoomId(classes[0].id);
    }
  }, [classes, targetClassRoomId]);

  const { data: notices, isLoading } = useQuery({
    queryKey: ['notices-list'],
    queryFn: noticesApi.getList,
  });

  const createNoticeMutation = useMutation({
    mutationFn: (data: any) => noticesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices-list'] });
      setIsCreateModalOpen(false);
      setTitle('');
      setContent('');
      setIsPinned(false);
      alert('Notice published successfully!');
    },
    onError: (err: any) => {
      alert(`Failed to publish notice: ${err.response?.data?.message || err.message}`);
    },
  });

  const deleteNoticeMutation = useMutation({
    mutationFn: (id: string) => noticesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices-list'] });
    },
    onError: (err: any) => {
      alert(`Failed to delete notice: ${err.response?.data?.message || err.message}`);
    },
  });

  const filteredNotices = notices?.filter((n) => {
    if (!audienceFilter) return true;
    return n.audience === audienceFilter || n.audience === 'All';
  });

  const handleOpenCreateModal = () => {
    if (isTeacher && !isAdmin) {
      setAudience('SpecificClass');
      if (classes && classes.length > 0 && !targetClassRoomId) {
        setTargetClassRoomId(classes[0].id);
      }
    }
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campus Noticeboard & Circulars</h1>
            {isTeacher && !isAdmin && (
              <span className="rounded-full bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                Class Notices Portal
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {isTeacher && !isAdmin
              ? 'Broadcast urgent notices, schedule updates, and circulars directly to your allocated classroom cohort'
              : 'Institutional announcements, academic calendars, holiday notices and emergency alerts'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(isPrincipal || isTeacher) && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              {isTeacher && !isAdmin ? 'Publish Notice for My Class' : 'Publish Notice'}
            </button>
          )}

          {!isTeacher && !isPrincipal && (
            <>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/timetable"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition"
              >
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>Class Timetable</span>
              </Link>
              <Link
                to="/exams"
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs transition"
              >
                <Award className="h-3.5 w-3.5 text-indigo-600" />
                <span>My Exams & Marks</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Filter className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">Audience Filter:</span>
        <div className="flex gap-1.5 flex-wrap">
          {['', 'All', 'Principal', 'Teacher', 'Student', 'SpecificClass'].map((aud) => (
            <button
              key={aud}
              onClick={() => setAudienceFilter(aud)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                audienceFilter === aud
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {aud === '' ? 'Show Everything' : aud === 'SpecificClass' ? 'Class Specific' : aud}
            </button>
          ))}
        </div>
      </div>

      {/* Notices Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
          ))
        ) : filteredNotices && filteredNotices.length > 0 ? (
          filteredNotices.map((n) => {
            const isCreator = user?.email && (n.postedBy === user.email || n.postedBy === user.fullName);
            const canDelete = isPrincipal || (isTeacher && isCreator);

            return (
              <div
                key={n.id}
                className={`flex flex-col justify-between rounded-xl border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out ${
                  n.isPinned
                    ? 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-300'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {n.isPinned && (
                        <span className="flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          <Pin className="h-3 w-3" /> Pinned
                        </span>
                      )}
                      {n.targetClassName ? (
                        <span className="rounded bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                          <BookOpen className="h-3 w-3 text-indigo-600" />
                          Class: {n.targetClassName}
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          Audience: {n.audience}
                        </span>
                      )}
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this notice?')) {
                            deleteNoticeMutation.mutate(n.id);
                          }
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Delete notice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="mt-2 text-base font-bold text-slate-900">{n.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-xs text-slate-600 leading-relaxed">{n.content}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                  <span>Posted by: <strong className="text-slate-600">{n.postedBy || 'Campus Admin'}</strong></span>
                  <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">No notices posted.</div>
        )}
      </div>

      {/* Publish Notice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={isTeacher && !isAdmin ? 'Publish Notice for Your Class' : 'Broadcast Campus Notice'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Notice Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isTeacher ? 'e.g. Unit Test 2 Syllabus & Assignment Submission' : 'e.g. Annual Sports Meet 2026 Schedule'}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* If teacher, strictly allow selecting their allocated class */}
          {isTeacher && !isAdmin ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700">Target Classroom Cohort *</label>
              <select
                value={targetClassRoomId}
                onChange={(e) => setTargetClassRoomId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none"
              >
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-indigo-600 mt-1 block">
                As a teacher, you can publish circulars and notices strictly for your allocated classroom.
              </span>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700">Audience Scope *</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="All">All Campus (Faculty & Students)</option>
                <option value="Principal">Principal Executive</option>
                <option value="Teacher">Faculty Only</option>
                <option value="Student">Students Only</option>
                <option value="SpecificClass">Specific Classroom Cohort</option>
              </select>

              {audience === 'SpecificClass' && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-700">Select Classroom *</label>
                  <select
                    value={targetClassRoomId}
                    onChange={(e) => setTargetClassRoomId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Choose Target Classroom --</option>
                    {classes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700">Notice Body *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Detailed announcement text, instructions, and deadlines..."
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pinNotice"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="pinNotice" className="text-xs font-medium text-slate-700">
              Pin to top of class noticeboard
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                !title ||
                !content ||
                createNoticeMutation.isPending ||
                (isTeacher && !isAdmin && !targetClassRoomId)
              }
              onClick={() =>
                createNoticeMutation.mutate({
                  title,
                  content,
                  audience: isTeacher && !isAdmin ? 'SpecificClass' : audience,
                  targetClassRoomId: (isTeacher && !isAdmin) || audience === 'SpecificClass' ? targetClassRoomId : undefined,
                  isPinned,
                })
              }
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {createNoticeMutation.isPending ? 'Publishing...' : 'Publish Circular'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NoticesPage;
