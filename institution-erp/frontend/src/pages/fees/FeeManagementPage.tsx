import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { feesApi, studentsApi, academicApi } from '../../api/endpoints';
import { Student, StudentFee } from '../../types';
import Modal from '../../components/ui/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../store/authContext';
import {
  Search,
  CreditCard,
  Download,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Settings,
  DollarSign,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export const FeeManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('HOD');

  const [activeTab, setActiveTab] = useState<'collection' | 'structures'>('collection');

  // Student search state
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<string>('Cash');
  const [payRef, setPayRef] = useState<string>('');
  const [payRemarks, setPayRemarks] = useState<string>('');
  const [lastPaymentResult, setLastPaymentResult] = useState<{ id: string; receiptNumber?: string } | null>(null);

  // Remaining Pending Fees state for inclusion in payment collection
  const [additionalPendingFees, setAdditionalPendingFees] = useState<
    { id: string; feeHeadName: string; balanceAmount: number; amount: number; selected: boolean; isCustom?: boolean }[]
  >([]);
  const [isAddingAdHocFee, setIsAddingAdHocFee] = useState(false);
  const [adHocHeadName, setAdHocHeadName] = useState('');
  const [adHocAmount, setAdHocAmount] = useState<number>(0);

  // Fee Structure Edit/Configure Modal state (Admin only)
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  const [structureName, setStructureName] = useState('Standard Institutional Fee Structure');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedFrequency, setSelectedFrequency] = useState<string>('Yearly');
  const [structureItems, setStructureItems] = useState<
    { feeHeadId: string; feeHeadName: string; amount: number; dueDate: string }[]
  >([
    {
      feeHeadId: '00000000-0000-0000-0000-000000000002',
      feeHeadName: 'Tuition Fee',
      amount: 500,
      dueDate: '2026-12-31',
    },
    {
      feeHeadId: '00000000-0000-0000-0000-000000000003',
      feeHeadName: 'Amenities',
      amount: 1000,
      dueDate: '2026-12-31',
    },
  ]);

  // Quick Fee Head Creation state
  const [isAddingNewHead, setIsAddingNewHead] = useState(false);
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadDesc, setNewHeadDesc] = useState('');

  // Search students
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['students-search', studentSearch],
    queryFn: () => studentsApi.getList({ search: studentSearch, pageSize: 6 }),
    enabled: studentSearch.length >= 2,
  });

  // Recent students for quick selection
  const { data: recentStudents } = useQuery({
    queryKey: ['recent-students-fee-picker'],
    queryFn: () => studentsApi.getList({ pageSize: 5 }),
  });

  // Fetch fees for selected student
  const { data: studentFees, isLoading: isFeesLoading, refetch: refetchStudentFees } = useQuery({
    queryKey: ['student-fees', selectedStudent?.id],
    queryFn: () => feesApi.getStudentFees(selectedStudent!.id),
    enabled: !!selectedStudent,
  });

  // Fetch fee structures
  const { data: feeStructures, refetch: refetchStructures } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => feesApi.getStructures(),
  });

  // Fetch classes & years for fee configuration
  const { data: classList } = useQuery({
    queryKey: ['classes-fee-dropdown'],
    queryFn: () => academicApi.getClasses(),
  });

  const { data: yearsList } = useQuery({
    queryKey: ['academic-years-fee-dropdown'],
    queryFn: () => academicApi.getYears(),
  });

  const { data: feeHeadsList, refetch: refetchFeeHeads } = useQuery({
    queryKey: ['fee-heads-list'],
    queryFn: () => feesApi.getHeads(),
  });

  // Record counter payment mutation (supports single & bulk remaining fee collection)
  const recordBulkPaymentMutation = useMutation({
    mutationFn: (data: any) => feesApi.recordBulkPayment(data),
    onSuccess: (res) => {
      refetchStudentFees();
      queryClient.invalidateQueries({ queryKey: ['accountant-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setIsPaymentModalOpen(false);
      const firstPaymentId = res.payments?.[0]?.id || '';
      const receiptNo = res.receiptNumber || 'REC';
      setLastPaymentResult({ id: firstPaymentId, receiptNumber: receiptNo });
      alert(`Fee payment recorded successfully! Official receipt #${receiptNo} generated. Click 'Download QuestPDF Receipt' to save.`);
    },
    onError: (err: any) => {
      alert(`Payment failed: ${err.response?.data?.message || err.response?.data?.detail || err.message}`);
    },
  });

  // Save / Update Fee Structure Mutation
  const saveStructureMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingStructureId && editingStructureId !== '00000000-0000-0000-0000-000000000001') {
        return feesApi.updateStructure(editingStructureId, payload);
      } else if (editingStructureId === '00000000-0000-0000-0000-000000000001') {
        return feesApi.updateStructure(editingStructureId, payload);
      } else {
        return feesApi.createStructure(payload);
      }
    },
    onSuccess: () => {
      refetchStructures();
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      queryClient.invalidateQueries({ queryKey: ['student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['accountant-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setIsStructureModalOpen(false);
      alert('Fee structure configured and saved successfully!');
    },
    onError: (err: any) => {
      alert(`Failed to save fee structure: ${err.response?.data?.message || err.message}`);
    },
  });

  // Delete Fee Structure Mutation
  const deleteStructureMutation = useMutation({
    mutationFn: (id: string) => feesApi.deleteStructure(id),
    onSuccess: () => {
      refetchStructures();
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      alert('Fee structure deleted successfully.');
    },
    onError: (err: any) => {
      alert(`Failed to delete fee structure: ${err.response?.data?.message || err.message}`);
    },
  });

  // Create Fee Head Mutation
  const createHeadMutation = useMutation({
    mutationFn: (data: any) => feesApi.createHead(data),
    onSuccess: (newHead) => {
      refetchFeeHeads();
      setIsAddingNewHead(false);
      setNewHeadName('');
      setNewHeadDesc('');
      setStructureItems((prev) => [
        ...prev,
        {
          feeHeadId: newHead.id,
          feeHeadName: newHead.name,
          amount: 0,
          dueDate: '2026-12-31',
        },
      ]);
    },
    onError: (err: any) => {
      alert(`Failed to create fee head: ${err.response?.data?.message || err.message}`);
    },
  });

  const handleDownloadReceipt = async (paymentId: string, receiptNo: string) => {
    try {
      await feesApi.downloadReceipt(paymentId, receiptNo);
    } catch (err) {
      alert('Failed to download receipt PDF.');
    }
  };

  const handleOpenCreateStructure = () => {
    setEditingStructureId(null);
    setStructureName('Standard Institutional Fee Structure');
    setSelectedClassId(classList && classList.length > 0 ? classList[0].id : '');
    setSelectedYearId(yearsList && yearsList.length > 0 ? yearsList[0].id : '');
    setSelectedFrequency('Yearly');
    setStructureItems([
      {
        feeHeadId: '00000000-0000-0000-0000-000000000002',
        feeHeadName: 'Tuition Fee',
        amount: 500,
        dueDate: '2026-12-31',
      },
      {
        feeHeadId: '00000000-0000-0000-0000-000000000003',
        feeHeadName: 'Amenities',
        amount: 1000,
        dueDate: '2026-12-31',
      },
    ]);
    setIsStructureModalOpen(true);
  };

  const handleOpenEditStructure = (fs: any) => {
    setEditingStructureId(fs.id);
    setStructureName(fs.name || 'Standard Institutional Fee Structure');
    setSelectedClassId(
      fs.classRoomId && fs.classRoomId !== '00000000-0000-0000-0000-000000000000'
        ? fs.classRoomId
        : classList?.[0]?.id || ''
    );
    setSelectedYearId(
      fs.academicYearId && fs.academicYearId !== '00000000-0000-0000-0000-000000000000'
        ? fs.academicYearId
        : yearsList?.[0]?.id || ''
    );
    setSelectedFrequency(fs.frequency || 'Yearly');
    if (fs.items && fs.items.length > 0) {
      setStructureItems(
        fs.items.map((it: any) => ({
          feeHeadId: it.feeHeadId,
          feeHeadName: it.feeHeadName,
          amount: it.amount,
          dueDate: it.dueDate ? it.dueDate.slice(0, 10) : '2026-12-31',
        }))
      );
    } else {
      setStructureItems([
        {
          feeHeadId: '00000000-0000-0000-0000-000000000002',
          feeHeadName: 'Tuition Fee',
          amount: 500,
          dueDate: '2026-12-31',
        },
        {
          feeHeadId: '00000000-0000-0000-0000-000000000003',
          feeHeadName: 'Amenities',
          amount: 1000,
          dueDate: '2026-12-31',
        },
      ]);
    }
    setIsStructureModalOpen(true);
  };

  const handleAddItem = (headId: string, headName: string) => {
    setStructureItems((prev) => [
      ...prev,
      {
        feeHeadId: headId,
        feeHeadName: headName,
        amount: 500,
        dueDate: '2026-12-31',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setStructureItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItemAmount = (index: number, amount: number) => {
    setStructureItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, amount: Math.max(0, amount) } : item))
    );
  };

  const handleUpdateItemDueDate = (index: number, date: string) => {
    setStructureItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, dueDate: date } : item))
    );
  };

  const totalCalculatedAmount = structureItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

  const handleSubmitStructure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structureName.trim()) {
      alert('Please specify a fee structure name.');
      return;
    }
    if (structureItems.length === 0) {
      alert('Fee structure must include at least one fee head item.');
      return;
    }

    const payload = {
      name: structureName.trim(),
      academicYearId: selectedYearId || yearsList?.[0]?.id || '00000000-0000-0000-0000-000000000000',
      classRoomId: selectedClassId || classList?.[0]?.id || '00000000-0000-0000-0000-000000000000',
      frequency: selectedFrequency,
      items: structureItems.map((it) => ({
        feeHeadId: it.feeHeadId,
        amount: Number(it.amount),
        dueDate: it.dueDate ? new Date(it.dueDate).toISOString() : new Date().toISOString(),
      })),
    };

    saveStructureMutation.mutate(payload);
  };

  const handleOpenPaymentModal = (sf: StudentFee) => {
    setSelectedFee(sf);
    setPayAmount(sf.balanceAmount);

    const otherPending = (studentFees || [])
      .filter((f) => f.id !== sf.id && f.balanceAmount > 0)
      .map((f) => ({
        id: f.id,
        feeHeadName: f.feeHeadName,
        balanceAmount: f.balanceAmount,
        amount: f.balanceAmount,
        selected: false,
      }));

    setAdditionalPendingFees(otherPending);
    setIsAddingAdHocFee(false);
    setAdHocHeadName('');
    setAdHocAmount(0);
    setIsPaymentModalOpen(true);
  };

  const handleOpenCollectAllModal = () => {
    if (!studentFees || studentFees.length === 0) return;
    const pending = studentFees.filter((f) => f.balanceAmount > 0);
    if (pending.length === 0) {
      alert('This student has cleared all pending fee obligations!');
      return;
    }
    const primary = pending[0];
    setSelectedFee(primary);
    setPayAmount(primary.balanceAmount);

    const others = pending.slice(1).map((f) => ({
      id: f.id,
      feeHeadName: f.feeHeadName,
      balanceAmount: f.balanceAmount,
      amount: f.balanceAmount,
      selected: true,
    }));

    setAdditionalPendingFees(others);
    setIsAddingAdHocFee(false);
    setAdHocHeadName('');
    setAdHocAmount(0);
    setIsPaymentModalOpen(true);
  };

  const totalAdditionalAmount = additionalPendingFees
    .filter((f) => f.selected)
    .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  const grandTotalPayAmount = (Number(payAmount) || 0) + totalAdditionalAmount;

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (grandTotalPayAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    const itemsToPay = [];
    if (selectedFee && payAmount > 0) {
      itemsToPay.push({
        studentFeeId: selectedFee.id,
        feeHeadName: selectedFee.feeHeadName,
        amount: payAmount,
      });
    }

    for (const addFee of additionalPendingFees) {
      if (addFee.selected && addFee.amount > 0) {
        itemsToPay.push({
          studentFeeId: addFee.id.startsWith('adhoc-') ? undefined : addFee.id,
          feeHeadName: addFee.feeHeadName,
          amount: addFee.amount,
        });
      }
    }

    if (itemsToPay.length === 0) {
      alert('Please select at least one fee item to pay.');
      return;
    }

    recordBulkPaymentMutation.mutate({
      studentId: selectedStudent.id,
      mode: payMode,
      transactionReference: payRef.trim() || undefined,
      remarks: payRemarks.trim() || undefined,
      items: itemsToPay,
    });
  };

  const totalAssignedFees = studentFees
    ? studentFees.reduce((sum, sf) => sum + (Number(sf.totalPayable) || 0), 0)
    : 0;
  const totalPaidFees = studentFees
    ? studentFees.reduce((sum, sf) => sum + (Number(sf.paidAmount) || 0), 0)
    : 0;
  const totalPendingBalance = studentFees
    ? studentFees.reduce((sum, sf) => sum + (Number(sf.balanceAmount) || 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Institutional Fee Management</h1>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Mode
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Accept counter payments, configure standard fee structures, issue QuestPDF receipts & monitor dues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/fees/defaulters"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
          >
            <AlertCircle className="h-4 w-4" />
            Defaulters Ledger
          </Link>

          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
            <button
              onClick={() => setActiveTab('collection')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                activeTab === 'collection' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Collect Fees
            </button>
            <button
              onClick={() => setActiveTab('structures')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                activeTab === 'structures' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fee Structures
            </button>
          </div>
        </div>
      </div>

      {lastPaymentResult && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>Payment received! Official receipt #{lastPaymentResult.receiptNumber} generated.</span>
          </div>
          <button
            onClick={() => handleDownloadReceipt(lastPaymentResult.id, lastPaymentResult.receiptNumber || 'Receipt')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            Download QuestPDF Receipt
          </button>
        </div>
      )}

      {activeTab === 'collection' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Student Search & Profile */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">1. Locate Student</h2>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search student by name or roll number..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Quick Students Selection */}
            {searchResults && searchResults.items.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Search Results</p>
                {searchResults.items.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className={`flex w-full items-center justify-between rounded-lg border p-2 text-left text-xs transition ${
                      selectedStudent?.id === s.id
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-800">{s.fullName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">Roll: {s.rollNumber} • {s.className}</p>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600">Inspect &rarr;</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recent Students</p>
                <div className="space-y-1.5">
                  {recentStudents?.items && recentStudents.items.length > 0 ? (
                    recentStudents.items.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudent(s)}
                        className={`flex w-full items-center justify-between rounded-lg border p-2 text-left text-xs transition ${
                          selectedStudent?.id === s.id
                            ? 'border-indigo-600 bg-indigo-50/50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-slate-800">{s.fullName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Roll: {s.rollNumber} • {s.className}</p>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600">Inspect &rarr;</span>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                      Search and select a student above to inspect fee ledger.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Pending & Paid Fees */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-base font-semibold text-slate-900">2. Student Fee Ledger & Invoices</h2>
            <p className="text-xs text-slate-500">Scheduled fee heads, late penalties, collected sums and dues</p>

            {selectedStudent ? (
              <div className="mt-4 space-y-4">
                {/* Student Financial Summary Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/30 p-3.5 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{selectedStudent.fullName}</h3>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        Roll: {selectedStudent.rollNumber}
                      </span>
                      <span className="text-xs text-slate-500">• {selectedStudent.className}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-slate-600">
                        Total Scheduled: <strong className="text-slate-900">${totalAssignedFees}</strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-600">
                        Total Paid: <strong className="text-emerald-700">${totalPaidFees}</strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-600">
                        Remaining Pending Due:{' '}
                        <strong className="text-rose-700 font-extrabold">${totalPendingBalance}</strong>
                      </span>
                    </div>
                  </div>

                  {totalPendingBalance > 0 && (
                    <button
                      onClick={handleOpenCollectAllModal}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition shrink-0"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Collect All Remaining Fees (${totalPendingBalance})
                    </button>
                  )}
                </div>

                {isFeesLoading ? (
                  <div className="space-y-3 animate-fade-in">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex flex-col justify-between rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center space-y-2 sm:space-y-0">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-8 w-28 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : studentFees && studentFees.length > 0 ? (
                  studentFees.map((sf) => (
                    <div
                      key={sf.id}
                      className="flex flex-col justify-between rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center hover:border-indigo-300 hover:shadow-sm transition-all duration-150"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{sf.feeHeadName}</h4>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              sf.status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sf.status === 'Partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {sf.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Due Date: {new Date(sf.dueDate).toLocaleDateString()} • Net Due: ${sf.totalPayable}
                        </p>
                        <p className="text-xs text-slate-500">
                          Paid: <span className="font-semibold text-emerald-700">${sf.paidAmount}</span> | Remaining Due:{' '}
                          <span className="font-semibold text-rose-700">${sf.balanceAmount}</span>
                        </p>
                      </div>

                      <div className="mt-3 sm:mt-0">
                        {sf.status !== 'Paid' ? (
                          <button
                            onClick={() => handleOpenPaymentModal(sf)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Collect Payment
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Cleared
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">
                    No fee obligations assigned to this student.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-8 text-center text-xs text-slate-400">
                Please select a student on the left to view fee items.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Fee Structures View */
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Institutional Fee Structures</h2>
              <p className="text-xs text-slate-500">
                Tuition, amenities, and facility fee schedules (Configurable by Admin)
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={handleOpenCreateStructure}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Configure New Structure
              </button>
            )}
          </div>

          {/* Standard Status Notice */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold">
                Default Standard: Tuition Fee is $500 and Amenities is $1,000 (Total: $1,500).
              </span>
            </div>
            <p className="mt-1 text-[11px] text-indigo-700">
              {isAdmin
                ? 'As an Administrator, you can edit fee heads and amounts below. Zero payments are currently marked in the DB.'
                : 'Current fee schedule is in read-only mode for non-administrative roles.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {feeStructures?.map((fs) => (
              <div key={fs.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{fs.name}</h3>
                      <p className="text-xs font-semibold text-indigo-700">{fs.className}</p>
                    </div>
                    <span className="rounded bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {fs.frequency}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-extrabold text-slate-800">Total: ${fs.totalAmount}</p>

                  <div className="mt-3 divide-y divide-slate-100 rounded-lg bg-white p-2.5 text-xs">
                    {fs.items?.map((item) => (
                      <div key={item.id} className="flex justify-between py-1 text-slate-600">
                        <span>{item.feeHeadName}</span>
                        <span className="font-semibold text-slate-800">${item.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                    <button
                      onClick={() => handleOpenEditStructure(fs)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit2 className="h-3 w-3 text-slate-500" />
                      Edit Structure
                    </button>
                    {fs.id !== '00000000-0000-0000-0000-000000000001' && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${fs.name}"?`)) {
                            deleteStructureMutation.mutate(fs.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Collection Modal */}
      {selectedFee && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title={`Collect Payment: ${selectedFee.feeHeadName}${additionalPendingFees.some((f) => f.selected) ? ' + Additional Fees' : ''}`}
        >
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div className="rounded-lg bg-indigo-50/80 border border-indigo-100 p-3 text-xs">
              <p className="text-slate-600">
                Student: <strong className="text-slate-800">{selectedStudent?.fullName}</strong> (Roll: {selectedStudent?.rollNumber})
              </p>
              <p className="mt-0.5 text-slate-600">
                Total Remaining Balance across all heads: <strong className="text-rose-700">${totalPendingBalance}</strong>
              </p>
            </div>

            {/* Primary Fee Item */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">{selectedFee.feeHeadName}</span>
                  <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                    Primary Fee
                  </span>
                </div>
                <span className="text-xs font-bold text-rose-600">Due: ${selectedFee.balanceAmount}</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Math.max(0, Number(e.target.value)))}
                  min={0}
                  max={selectedFee.balanceAmount}
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-7 pr-3 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Additional / Remaining Pending Fees Section */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Add Remaining Pending Fee(s)</h4>
                  <p className="text-[11px] text-slate-500">Include other outstanding dues in this collection</p>
                </div>
                {additionalPendingFees.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAdditionalPendingFees((prev) =>
                          prev.map((f) => ({ ...f, selected: true }))
                        )
                      }
                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAdditionalPendingFees((prev) =>
                          prev.map((f) => ({ ...f, selected: false }))
                        )
                      }
                      className="text-[10px] font-bold text-slate-600 hover:text-slate-800 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {additionalPendingFees.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {additionalPendingFees.map((addFee, idx) => (
                    <div
                      key={addFee.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 transition ${
                        addFee.selected
                          ? 'border-indigo-300 bg-white shadow-sm'
                          : 'border-slate-200 bg-slate-100/60 opacity-70'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={addFee.selected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAdditionalPendingFees((prev) =>
                              prev.map((f, i) => (i === idx ? { ...f, selected: checked } : f))
                            );
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{addFee.feeHeadName}</p>
                          <p className="text-[10px] text-rose-600 font-semibold">
                            Pending Due: ${addFee.balanceAmount}
                          </p>
                        </div>
                      </label>

                      {addFee.selected && (
                        <div className="relative w-28">
                          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">$</span>
                          <input
                            type="number"
                            min="1"
                            max={addFee.balanceAmount || 999999}
                            value={addFee.amount}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setAdditionalPendingFees((prev) =>
                                prev.map((f, i) => (i === idx ? { ...f, amount: val } : f))
                              );
                            }}
                            className="w-full rounded border border-slate-300 py-1 pl-6 pr-2 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No other pending fee obligations recorded for this student.</p>
              )}

              {/* Add Custom / Ad-Hoc Fee */}
              <div className="pt-2 border-t border-indigo-100">
                {!isAddingAdHocFee ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingAdHocFee(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="h-3 w-3" />
                    Add Other / Ad-Hoc Pending Fee
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg bg-white p-2.5 border border-indigo-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Add Ad-Hoc Fee Due</span>
                      <button
                        type="button"
                        onClick={() => setIsAddingAdHocFee(false)}
                        className="text-[10px] text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Fee Name (e.g. Lab, Uniform)"
                        value={adHocHeadName}
                        onChange={(e) => setAdHocHeadName(e.target.value)}
                        className="rounded border border-slate-300 p-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Amount ($)"
                        min="1"
                        value={adHocAmount || ''}
                        onChange={(e) => setAdHocAmount(Number(e.target.value))}
                        className="rounded border border-slate-300 p-1.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!adHocHeadName.trim() || adHocAmount <= 0}
                      onClick={() => {
                        setAdditionalPendingFees((prev) => [
                          ...prev,
                          {
                            id: `adhoc-${Date.now()}`,
                            feeHeadName: adHocHeadName.trim(),
                            balanceAmount: adHocAmount,
                            amount: adHocAmount,
                            selected: true,
                            isCustom: true,
                          },
                        ]);
                        setAdHocHeadName('');
                        setAdHocAmount(0);
                        setIsAddingAdHocFee(false);
                      }}
                      className="w-full rounded bg-indigo-600 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Attach to Payment
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Total Collection Summary */}
            <div className="rounded-lg bg-slate-900 p-3 text-white flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Total Collection Amount</p>
                <p className="text-xs text-slate-300">
                  {selectedFee?.feeHeadName}: ${payAmount}
                  {totalAdditionalAmount > 0 && ` + Remaining Dues: $${totalAdditionalAmount}`}
                </p>
              </div>
              <span className="text-xl font-black text-emerald-400">
                ${grandTotalPayAmount.toLocaleString()}
              </span>
            </div>

            {/* Payment Mode & Details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Payment Mode *</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="BankTransfer">Bank Transfer</option>
                  <option value="UPI">UPI / NetBanking</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Transaction / Cheque Ref</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. TXN-948104"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Receipt Notes / Remarks</label>
              <input
                type="text"
                value={payRemarks}
                onChange={(e) => setPayRemarks(e.target.value)}
                placeholder="Optional notes"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={grandTotalPayAmount <= 0 || recordBulkPaymentMutation.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {recordBulkPaymentMutation.isPending
                  ? 'Processing Payments...'
                  : `Confirm & Collect $${grandTotalPayAmount.toLocaleString()}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Admin Fee Structure Configuration Modal */}
      {isAdmin && isStructureModalOpen && (
        <Modal
          isOpen={isStructureModalOpen}
          onClose={() => setIsStructureModalOpen(false)}
          title={editingStructureId ? 'Edit Fee Structure' : 'Configure New Fee Structure'}
        >
          <form onSubmit={handleSubmitStructure} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Structure Title *</label>
              <input
                type="text"
                value={structureName}
                onChange={(e) => setStructureName(e.target.value)}
                placeholder="e.g. Standard Institutional Fee Structure"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Target Classroom *</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">All Institutional Classes</option>
                  {classList?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Academic Year *</label>
                <select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  {yearsList?.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.isActive ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Billing Frequency *</label>
                <select
                  value={selectedFrequency}
                  onChange={(e) => setSelectedFrequency(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Yearly">Yearly</option>
                  <option value="Term">Per Term</option>
                  <option value="Monthly">Monthly</option>
                  <option value="OneTime">One-Time</option>
                </select>
              </div>
            </div>

            {/* Structured Fee Heads List */}
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Fee Head Components & Due Dates</span>
                <span className="text-xs font-extrabold text-indigo-700">
                  Total: ${totalCalculatedAmount.toLocaleString()}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {structureItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <div className="w-1/3">
                      <p className="text-xs font-bold text-slate-800">{item.feeHeadName}</p>
                    </div>
                    <div className="relative w-1/3">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">$</span>
                      <input
                        type="number"
                        min="0"
                        value={item.amount}
                        onChange={(e) => handleUpdateItemAmount(idx, Number(e.target.value))}
                        className="w-full rounded border border-slate-300 py-1 pl-6 pr-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="w-1/3">
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={(e) => handleUpdateItemDueDate(idx, e.target.value)}
                        className="w-full rounded border border-slate-300 py-1 px-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    {structureItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                        title="Remove fee component"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Available Heads */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-[11px] font-semibold text-slate-500">Add fee head:</span>
                {feeHeadsList
                  ?.filter((h) => !structureItems.some((it) => it.feeHeadId === h.id || it.feeHeadName.toLowerCase() === h.name.toLowerCase()))
                  .map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => handleAddItem(h.id, h.name)}
                      className="inline-flex items-center gap-1 rounded bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-indigo-100 hover:text-indigo-800"
                    >
                      <Plus className="h-3 w-3" />
                      {h.name}
                    </button>
                  ))}

                <button
                  type="button"
                  onClick={() => setIsAddingNewHead(!isAddingNewHead)}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-indigo-400 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  <Plus className="h-3 w-3" />
                  {isAddingNewHead ? 'Cancel' : 'New Custom Head'}
                </button>
              </div>

              {/* Custom Fee Head Creation Inline Form */}
              {isAddingNewHead && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-indigo-200 bg-white p-2">
                  <input
                    type="text"
                    placeholder="Fee Head Name (e.g. Lab Fee)"
                    value={newHeadName}
                    onChange={(e) => setNewHeadName(e.target.value)}
                    className="flex-1 rounded border border-slate-300 p-1 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Optional description"
                    value={newHeadDesc}
                    onChange={(e) => setNewHeadDesc(e.target.value)}
                    className="flex-1 rounded border border-slate-300 p-1 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!newHeadName.trim() || createHeadMutation.isPending}
                    onClick={() =>
                      createHeadMutation.mutate({
                        name: newHeadName.trim(),
                        description: newHeadDesc.trim() || null,
                        isMandatory: true,
                      })
                    }
                    className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setIsStructureModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveStructureMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveStructureMutation.isPending ? 'Saving...' : 'Save & Apply Fee Structure'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default FeeManagementPage;
