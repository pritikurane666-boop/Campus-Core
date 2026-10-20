import React, { useState, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../utils/supabase';
import { supabaseStorage } from '../../utils/supabaseStorage';
import { Database, Cloud, Upload, CheckCircle2, AlertCircle, RefreshCw, Key, HardDrive, ListTodo, Plus } from 'lucide-react';

interface TodoItem {
  id: number | string;
  name: string;
}

export const SupabaseManagementPage: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoName, setNewTodoName] = useState('');
  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [todoError, setTodoError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Storage test state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const supabaseUrl = SUPABASE_URL;
  const supabaseKey = SUPABASE_PUBLISHABLE_KEY;

  const fetchTodos = async () => {
    setIsLoadingTodos(true);
    setTodoError(null);
    try {
      const { data, error } = await supabase.from('todos').select();
      if (error) {
        setTodoError(error.message);
        setIsConnected(false);
      } else {
        setTodos(data || []);
        setIsConnected(true);
      }
    } catch (err: any) {
      setTodoError(err.message || 'Failed to query Supabase todos table');
      setIsConnected(false);
    } finally {
      setIsLoadingTodos(false);
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoName.trim()) return;

    try {
      const { data, error } = await supabase.from('todos').insert([{ name: newTodoName.trim() }]).select();
      if (error) {
        setTodoError(error.message);
      } else {
        setNewTodoName('');
        fetchTodos();
      }
    } catch (err: any) {
      setTodoError(err.message || 'Failed to add todo');
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const cleanName = `${Date.now()}-${selectedFile.name.replace(/\s+/g, '_')}`;
      const result = await supabaseStorage.uploadFile('documents', `campuscore-test/${cleanName}`, selectedFile);
      setUploadedUrl(result.publicUrl);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Ensure the storage bucket "documents" exists in Supabase with public access.');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Cloud className="w-7 h-7 text-emerald-500" />
            Supabase Cloud Database & Storage
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configured as the cloud backend database and asset storage for Campus Core ERP
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTodos}
            disabled={isLoadingTodos}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTodos ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Grid: Config Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Connection Status</span>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            ) : isConnected === false ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full">
                <AlertCircle className="w-3.5 h-3.5" /> Table Pending
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                Checking...
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
            {supabaseUrl}
          </div>
          <p className="text-xs text-slate-400 mt-1">Supabase API Gateway URL</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Publishable Key</span>
            <Key className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">
            {supabaseKey.slice(0, 16)}••••••••
          </div>
          <p className="text-xs text-slate-400 mt-1">Safe client-side API key</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Database Engine</span>
            <Database className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            PostgreSQL 15+ (Cloud)
          </div>
          <p className="text-xs text-slate-400 mt-1">Managed Supabase Database</p>
        </div>
      </div>

      {/* Two Column Section: Live Todos & Storage Demo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supabase Todos Table Test */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-emerald-500" />
              Live Todos Query Test
            </h3>
            <span className="text-xs text-slate-400 font-mono">supabase.from('todos')</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tests querying and inserting records directly into your Supabase database.
          </p>

          {todoError && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-700 dark:text-amber-300 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Notice: {todoError}</span>
              </div>
              <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90">
                To create the test table in your Supabase dashboard, execute this SQL:
              </p>
              <pre className="p-2 rounded-lg bg-black/10 dark:bg-black/40 text-[11px] font-mono overflow-x-auto select-all">
                create table todos (id bigint generated by default as identity primary key, name text);
              </pre>
            </div>
          )}

          <form onSubmit={handleAddTodo} className="flex gap-2">
            <input
              type="text"
              value={newTodoName}
              onChange={(e) => setNewTodoName(e.target.value)}
              placeholder="Add test item (e.g. Verify student fee structure)"
              className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </form>

          <div className="border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
            {todos.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                {isLoadingTodos ? 'Loading todos...' : 'No todos found in table.'}
              </div>
            ) : (
              todos.map((todo) => (
                <div key={todo.id} className="p-2.5 px-3.5 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{todo.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">ID: {todo.id}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supabase Storage File Upload Test */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-indigo-500" />
              Supabase Storage Bucket
            </h3>
            <span className="text-xs text-slate-400 font-mono">bucket: documents</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Used for storing student certificates, admission documents, and notice attachments.
          </p>

          <form onSubmit={handleFileUpload} className="space-y-3">
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950/50 dark:file:text-indigo-400"
            />

            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {isUploading ? 'Uploading to Supabase...' : 'Upload Test File'}
            </button>
          </form>

          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400">
              {uploadError}
            </div>
          )}

          {uploadedUrl && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
              <span className="font-semibold">File Uploaded Successfully!</span>
              <a
                href={uploadedUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-[11px] underline break-all text-emerald-600 dark:text-emerald-400"
              >
                {uploadedUrl}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Backend Database Connection Guide */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Database className="w-5 h-5 text-primary-500" />
          Connecting .NET Backend API to Supabase PostgreSQL
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          To point the entire Campus Core ERP backend directly to your Supabase Cloud PostgreSQL instance, configure the connection string in <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">appsettings.json</code>:
        </p>

        <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto select-all">
{`"ConnectionStrings": {
  "DefaultConnection": "Host=db.${supabaseUrl.replace('https://', '').split('.')[0] || 'YOUR_PROJECT_REF'}.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=<YOUR_SUPABASE_PASSWORD>;SSL Mode=Require;Trust Server Certificate=true;"
}`}
        </pre>
      </div>
    </div>
  );
};

export default SupabaseManagementPage;
