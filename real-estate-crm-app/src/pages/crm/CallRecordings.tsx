import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UploadCloud, Loader2, AlertTriangle, CheckCircle2, Clock,
  PhoneCall, Search, RefreshCw, X, FileAudio,
} from 'lucide-react';
import { api } from '../../services/api';
import CallRecordingReviewDrawer from '../../components/CallRecordingReviewDrawer';
import type { CallRecordingDetail, CallRecordingSummary, CallRecordingStatus } from '../../types/callIntelligence';
import { IN_FLIGHT_STATUSES, STATUS_LABELS } from '../../types/callIntelligence';

import {
  ACCEPTED_AUDIO_EXTENSIONS as ACCEPTED_EXTENSIONS,
  MAX_AUDIO_UPLOAD_MB as MAX_UPLOAD_MB,
  resolveAudioContentType as resolveContentType,
} from '../../utils/audioUpload';

interface UploadItem {
  id: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

function statusStyle(status: CallRecordingStatus): string {
  switch (status) {
    case 'COMPLETED': return 'bg-green-100 text-green-700';
    case 'AWAITING_APPROVAL': return 'bg-amber-100 text-amber-700';
    case 'FAILED': return 'bg-red-100 text-red-700';
    case 'ANALYZED': return 'bg-blue-100 text-blue-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function CallRecordings() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recordings, setRecordings] = useState<CallRecordingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setRefreshing(true);
    try {
      const response = await api.getCallRecordings({ limit: 50, status: statusFilter || undefined });
      setRecordings(response.recordings || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load call recordings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    load({ silent: true });
  }, [load]);

  // Poll while anything is still being transcribed or analysed.
  const hasInFlight = useMemo(
    () => recordings.some((item) => IN_FLIGHT_STATUSES.includes(item.status)),
    [recordings],
  );

  useEffect(() => {
    if (!hasInFlight) return undefined;
    const timer = setInterval(() => load({ silent: true }), 10000);
    return () => clearInterval(timer);
  }, [hasInFlight, load]);

  const upsertUpload = (id: string, patch: Partial<UploadItem>) => {
    setUploads((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const uploadFile = async (file: File) => {
    const uploadId = `${file.name}-${file.size}-${Date.now()}`;
    setUploads((current) => [
      ...current,
      { id: uploadId, filename: file.name, progress: 0, status: 'uploading' },
    ]);

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      upsertUpload(uploadId, { status: 'error', error: `File is larger than ${MAX_UPLOAD_MB} MB` });
      return;
    }

    try {
      const contentType = resolveContentType(file);
      const created = await api.createCallRecordingUploadUrl({
        filename: file.name,
        contentType,
        sizeBytes: file.size,
      });

      await api.uploadCallRecordingToS3(created.uploadUrl, file, (percent) => {
        upsertUpload(uploadId, { progress: percent });
      }, contentType);

      upsertUpload(uploadId, { status: 'processing', progress: 100 });
      await api.confirmCallRecordingUpload(created.recordingId);
      upsertUpload(uploadId, { status: 'done' });

      await load({ silent: true });

      // Clear the finished row after a moment so the list stays readable.
      setTimeout(() => {
        setUploads((current) => current.filter((item) => item.id !== uploadId));
      }, 4000);
    } catch (err) {
      upsertUpload(uploadId, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    // Sequential upload keeps the presigned URLs and the progress UI predictable.
    for (const file of Array.from(fileList)) {
      // eslint-disable-next-line no-await-in-loop
      await uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recordings;
    return recordings.filter((item) => (
      item.filename.toLowerCase().includes(query)
      || (item.phone || '').includes(query.replace(/\D/g, ''))
      || (item.matchedEntityName || '').toLowerCase().includes(query)
      || (item.summary || '').toLowerCase().includes(query)
    ));
  }, [recordings, search]);

  const pendingApprovalCount = useMemo(
    () => recordings.reduce((total, item) => total + item.pendingActions, 0),
    [recordings],
  );

  const handleRecordingUpdated = useCallback((updated: CallRecordingDetail) => {
    setRecordings((current) => current.map((item) => (
      item.recordingId === updated.recordingId ? { ...item, ...updated } : item
    )));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/crm')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
            aria-label="Back to CRM"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-7 h-7 text-blue-600" />
              Call Recordings
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Upload your call recordings. We identify the customer, transcribe the call and suggest CRM updates for your approval.
            </p>
          </div>
          <button
            onClick={() => load()}
            disabled={refreshing}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {pendingApprovalCount > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {pendingApprovalCount} suggested CRM {pendingApprovalCount === 1 ? 'update needs' : 'updates need'} your approval.
          </div>
        )}

        {/* Upload area */}
        <div
          onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            handleFiles(event.dataTransfer.files);
          }}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            dragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white/70'
          }`}
        >
          <UploadCloud className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <p className="text-slate-700 font-medium">Drop call recordings here</p>
          <p className="text-slate-500 text-sm mt-1">
            Keep the customer&apos;s phone number in the file name (e.g. <code>9876543210_call.mp3</code>) so we can match the right record.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Choose files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <p className="text-xs text-slate-400 mt-3">
            MP3, M4A, WAV, AMR, OPUS and more · up to {MAX_UPLOAD_MB} MB each
          </p>
        </div>

        {/* In-progress uploads */}
        {uploads.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploads.map((upload) => (
              <div key={upload.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileAudio className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-800 truncate flex-1">{upload.filename}</span>
                  {upload.status === 'uploading' && (
                    <span className="text-xs text-slate-500">{upload.progress}%</span>
                  )}
                  {upload.status === 'processing' && (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Starting analysis
                    </span>
                  )}
                  {upload.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {upload.status === 'error' && (
                    <button
                      onClick={() => setUploads((current) => current.filter((item) => item.id !== upload.id))}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {upload.status === 'uploading' && (
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${upload.progress}%` }} />
                  </div>
                )}
                {upload.error && <p className="mt-1 text-xs text-red-600">{upload.error}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, phone, file or summary"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* List */}
        <div className="mt-4 space-y-3 pb-10">
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading recordings…
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 bg-white/60 rounded-2xl border border-slate-200">
              <PhoneCall className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-700 font-medium">
                {recordings.length === 0 ? 'No recordings yet' : 'No recordings match your filters'}
              </p>
              <p className="text-slate-500 text-sm mt-1">
                {recordings.length === 0
                  ? 'Upload your first call recording to see the AI summary and suggested CRM updates.'
                  : 'Try a different search or status filter.'}
              </p>
            </div>
          )}

          {filtered.map((item) => (
            <button
              key={item.recordingId}
              onClick={() => setSelectedId(item.recordingId)}
              className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 truncate">
                      {item.matchedEntityName || (item.phone ? `+91 ${item.phone}` : item.filename)}
                    </span>
                    {item.matchedEntityType !== 'unmatched' && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 capitalize">
                        {item.matchedEntityType}
                      </span>
                    )}
                    {item.matchedEntityType === 'unmatched' && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Not in CRM
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusStyle(item.status)}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    {item.pendingActions > 0 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                        {item.pendingActions} to approve
                      </span>
                    )}
                    {/* A recording is COMPLETED once nothing is pending, even if
                        every CRM write failed. Without this the row reads as
                        fully done and nobody opens the drawer to retry. */}
                    {item.failedActions > 0 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 border border-red-200">
                        {item.failedActions} failed
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 mt-1.5 line-clamp-2">
                    {item.summary || (item.status === 'FAILED'
                      ? item.failureReason || 'Processing failed'
                      : 'Analysis in progress…')}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.callDate}
                    </span>
                    <span>{formatDuration(item.audioDurationSeconds)}</span>
                    {item.asrLanguage && <span>{item.asrLanguage}</span>}
                    <span className="truncate max-w-[16rem]">{item.filename}</span>
                    {item.possibleDuplicateOf && (
                      <span className="text-amber-600">Possible duplicate</span>
                    )}
                  </div>
                </div>

                {IN_FLIGHT_STATUSES.includes(item.status) && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500 flex-shrink-0 mt-1" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedId && (
        <CallRecordingReviewDrawer
          recordingId={selectedId}
          onClose={() => { setSelectedId(null); load({ silent: true }); }}
          onUpdated={handleRecordingUpdated}
        />
      )}
    </div>
  );
}
