import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { admissionsApi, academicApi } from '../../api/endpoints';
import {
  CheckCircle2,
  Upload,
  ArrowRight,
  Search,
  Clock,
  Check,
  XCircle,
  FileText,
} from 'lucide-react';

export const ApplyAdmissionPage: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: 'Male',
    bloodGroup: 'O+',
    address: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianRelation: 'Father',
    desiredClassRoomId: '',
    previousSchoolName: '',
    previousSchoolPercentage: '',
  });

  const [files, setFiles] = useState<{ idProof?: File; marksheet?: File }>({});
  const [submittedAttempt, setSubmittedAttempt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (key: 'idProof' | 'marksheet', file: File | undefined) => {
    if (!file) {
      setFiles((prev) => ({ ...prev, [key]: undefined }));
      return;
    }

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      setError('Only PDF documents are accepted. Please select a valid .pdf file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('File size must not exceed 2 MB.');
      return;
    }

    setError(null);
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const { data: classes } = useQuery({
    queryKey: ['public-classes'],
    queryFn: academicApi.getClasses,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!files.idProof || !files.marksheet) {
      setSubmittedAttempt(true);
      setError('Please upload all required supporting documents (Birth Certificate / Identity Proof and Previous School Marksheet).');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        dateOfBirth: new Date(formData.dateOfBirth).toISOString(),
        previousSchoolPercentage: parseFloat(formData.previousSchoolPercentage) || 0,
      };

      const result = await admissionsApi.apply(payload);

      // Upload documents if selected
      if (files.idProof) {
        const fd = new FormData();
        fd.append('file', files.idProof);
        fd.append('documentType', 'IdentityProof');
        await admissionsApi.uploadDoc(result.id, fd);
      }
      if (files.marksheet) {
        const fd = new FormData();
        fd.append('file', files.marksheet);
        fd.append('documentType', 'PreviousMarksheet');
        await admissionsApi.uploadDoc(result.id, fd);
      }

      setSuccessResult(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to submit application. Please check inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Application Submitted!</h2>
        <p className="text-sm text-slate-500 mt-2">
          Your admission form has been received. Please save your application reference number for your records:
        </p>

        <div className="my-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-400 block uppercase">Reference Number</span>
          <span className="text-2xl font-mono font-black text-primary-600 dark:text-primary-400 mt-1 block">
            {successResult.referenceNumber}
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-6">
          An email confirmation has been sent to <strong>{formData.email}</strong>.
        </p>

        <a
          href="/login"
          className="inline-flex items-center gap-2 py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold shadow-md transition-colors"
        >
          Go to Portal Login <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-200 dark:border-slate-800">
      <div className="border-b border-slate-150 dark:border-slate-800 pb-5 mb-8">
        <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400 uppercase tracking-wider">
          Academic Year 2026-2027
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">
          Online Student Admission Application
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Complete the form below to enroll. No login required. All fields marked with * are required.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Applicant Info */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-4">
            1. Applicant Personal Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender *</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Blood Group *</label>
              <select
                required
                value={formData.bloodGroup}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Date of Birth *</label>
              <input
                type="date"
                required
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Residential Address *</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>

        {/* Section 2: Guardian Details */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-4">
            2. Parent / Guardian Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Guardian Name *</label>
              <input
                type="text"
                required
                value={formData.guardianName}
                onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Relationship *</label>
              <select
                value={formData.guardianRelation}
                onChange={(e) => setFormData({ ...formData, guardianRelation: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Legal Guardian</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Guardian Phone *</label>
              <input
                type="tel"
                required
                value={formData.guardianPhone}
                onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Guardian Email *</label>
              <input
                type="email"
                required
                value={formData.guardianEmail}
                onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Course & Academic Record */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-4">
            3. Desired Program & Previous Academic History
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Desired Class / Grade *</label>
              <select
                required
                value={formData.desiredClassRoomId}
                onChange={(e) => setFormData({ ...formData, desiredClassRoomId: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="">-- Select Class --</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Previous School / College</label>
              <input
                type="text"
                value={formData.previousSchoolName}
                onChange={(e) => setFormData({ ...formData, previousSchoolName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Previous Score / Percentage (%) *</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                required
                value={formData.previousSchoolPercentage}
                onChange={(e) => setFormData({ ...formData, previousSchoolPercentage: e.target.value })}
                placeholder="e.g. 85.5"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Document Uploads */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
              4. Supporting Document Uploads *
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
              PDF only, up to 2 MB
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-4 border-2 border-dashed rounded-2xl text-center transition-colors ${
              submittedAttempt && !files.idProof
                ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
            }`}>
              <Upload className="w-6 h-6 text-primary-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Identity / Birth Certificate (PDF) *</p>
              <p className="text-[11px] text-slate-400 mb-2">Government issued ID or birth cert</p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => handleFileChange('idProof', e.target.files?.[0])}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-primary-50 file:text-primary-600 dark:file:bg-primary-900/40 dark:file:text-primary-300 file:font-semibold"
              />
              {files.idProof && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate max-w-[180px]">{files.idProof.name}</span>
                </div>
              )}
              {submittedAttempt && !files.idProof && (
                <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Birth certificate or identity proof is required.</span>
                </p>
              )}
            </div>
            <div className={`p-4 border-2 border-dashed rounded-2xl text-center transition-colors ${
              submittedAttempt && !files.marksheet
                ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
            }`}>
              <Upload className="w-6 h-6 text-primary-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Previous School Marksheet (PDF) *</p>
              <p className="text-[11px] text-slate-400 mb-2">Official academic grade transcript</p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => handleFileChange('marksheet', e.target.files?.[0])}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-primary-50 file:text-primary-600 dark:file:bg-primary-900/40 dark:file:text-primary-300 file:font-semibold"
              />
              {files.marksheet && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate max-w-[180px]">{files.marksheet.name}</span>
                </div>
              )}
              {submittedAttempt && !files.marksheet && (
                <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Previous school marksheet is required.</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-150 dark:border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="py-3 px-8 text-sm font-bold rounded-xl text-white bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
          </button>
        </div>
      </form>
    </div>
  );
};

