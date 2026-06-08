import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../../../components/LoadingSpinner';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Bot,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Volume2,
} from 'lucide-react';
import { aiCallingApi } from '../../../services/aiCallingApi';
import type { CallSession, TranscriptEntry, CallStatus } from '../../../types/aiCalling';

const statusConfig: Record<CallStatus, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  initiated: { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: <Phone className="w-5 h-5" />, label: 'Initiated' },
  ringing: { color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: <Phone className="w-5 h-5 animate-pulse" />, label: 'Ringing' },
  connected: { color: 'text-green-600', bgColor: 'bg-green-50', icon: <PhoneCall className="w-5 h-5" />, label: 'Connected' },
  in_progress: { color: 'text-green-600', bgColor: 'bg-green-50', icon: <PhoneCall className="w-5 h-5 animate-pulse" />, label: 'In Progress' },
  completed: { color: 'text-gray-600', bgColor: 'bg-gray-50', icon: <CheckCircle2 className="w-5 h-5" />, label: 'Completed' },
  failed: { color: 'text-red-600', bgColor: 'bg-red-50', icon: <XCircle className="w-5 h-5" />, label: 'Failed' },
  no_answer: { color: 'text-orange-600', bgColor: 'bg-orange-50', icon: <PhoneOff className="w-5 h-5" />, label: 'No Answer' },
  busy: { color: 'text-purple-600', bgColor: 'bg-purple-50', icon: <Phone className="w-5 h-5" />, label: 'Busy' },
  cancelled: { color: 'text-gray-500', bgColor: 'bg-gray-50', icon: <XCircle className="w-5 h-5" />, label: 'Cancelled' },
};

export default function CallDetails() {
  const navigate = useNavigate();
  const { callSessionId } = useParams<{ callSessionId: string }>();
  const [call, setCall] = useState<CallSession | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (callSessionId) {
      loadCallDetails();
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [callSessionId]);

  useEffect(() => {
    // Auto-scroll transcript
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    // Poll for updates if call is active
    if (call && ['initiated', 'ringing', 'connected', 'in_progress'].includes(call.status)) {
      pollIntervalRef.current = setInterval(() => {
        loadCallDetails(true);
      }, 3000);
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [call?.status]);

  const loadCallDetails = async (silent = false) => {
    if (!callSessionId) return;
    
    try {
      if (!silent) setLoading(true);
      setError(null);

      const [callData, transcriptData] = await Promise.all([
        aiCallingApi.getCallDetails(callSessionId),
        aiCallingApi.getCallTranscript(callSessionId),
      ]);

      setCall(callData);
      setTranscript(transcriptData.transcript);
    } catch (err) {
      console.error('Error loading call details:', err);
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to load call details');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleEndCall = async () => {
    if (!callSessionId) return;
    
    try {
      setEnding(true);
      await aiCallingApi.endCall(callSessionId, 'user_ended');
      await loadCallDetails();
    } catch (err) {
      console.error('Error ending call:', err);
      setError(err instanceof Error ? err.message : 'Failed to end call');
    } finally {
      setEnding(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const isCallActive = call && ['initiated', 'ringing', 'connected', 'in_progress'].includes(call.status);
  const statusInfo = call ? statusConfig[call.status] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <LoadingSpinner message="Loading call details..." />
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-6">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate('/crm/ai-calling')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error || 'Call not found'}</p>
            <button
              onClick={() => loadCallDetails()}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/ai-calling')}
                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-white/50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{call.leadName || 'Unknown'}</h1>
                <p className="text-xs sm:text-sm text-gray-500">{call.leadPhone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadCallDetails()}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              {isCallActive && (
                <button
                  onClick={handleEndCall}
                  disabled={ending}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <PhoneOff className="w-5 h-5" />
                  {ending ? 'Ending...' : 'End Call'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Status Card */}
        <div className={`rounded-xl p-6 mb-6 ${statusInfo?.bgColor || 'bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 bg-white rounded-xl ${statusInfo?.color}`}>
                {statusInfo?.icon}
              </div>
              <div>
                <p className={`text-sm font-medium ${statusInfo?.color}`}>Status</p>
                <p className="text-xl font-bold text-gray-900">{statusInfo?.label}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-lg">{formatDuration(call.duration)}</span>
              </div>
              {isCallActive && (
                <span className="inline-flex items-center gap-1 text-green-600 text-sm mt-1">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                  Live
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Call Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Purpose</p>
            <p className="font-medium text-gray-900 capitalize">{call.callPurpose?.replace('_', ' ') || 'N/A'}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Started At</p>
            <p className="font-medium text-gray-900">{call.startedAt ? formatTime(call.startedAt) : 'N/A'}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Intents Detected</p>
            <p className="font-medium text-gray-900">{call.intentsDetected?.length || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Actions Taken</p>
            <p className="font-medium text-gray-900">{call.actionsPerformed?.length || 0}</p>
          </div>
        </div>

        {/* Live Transcript */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <h2 className="font-bold text-gray-900">Live Transcript</h2>
            </div>
            {isCallActive && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <Volume2 className="w-4 h-4 animate-pulse" />
                Recording
              </span>
            )}
          </div>

          <div className="h-96 overflow-y-auto p-4 bg-gray-50">
            {transcript.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Transcript will appear here</p>
                  {isCallActive && <p className="text-sm mt-1">Waiting for conversation...</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {transcript.map((entry, index) => (
                  <div
                    key={index}
                    className={`flex ${entry.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        entry.speaker === 'ai'
                          ? 'bg-white border border-gray-200'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {entry.speaker === 'ai' ? (
                          <Bot className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                        <span className={`text-xs font-medium ${entry.speaker === 'ai' ? 'text-gray-500' : 'text-indigo-200'}`}>
                          {entry.speaker === 'ai' ? 'AI Agent' : 'Customer'}
                        </span>
                        <span className={`text-xs ${entry.speaker === 'ai' ? 'text-gray-400' : 'text-indigo-200'}`}>
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <p className={entry.speaker === 'ai' ? 'text-gray-900' : ''}>{entry.text}</p>
                      {entry.intent && entry.intent !== 'SMALL_TALK' && (
                        <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${
                          entry.speaker === 'ai' ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500 text-indigo-100'
                        }`}>
                          {entry.intent.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Recording Link */}
        {call.recordingUrl && (
          <div className="mt-6 bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Call Recording</span>
              </div>
              <a
                href={call.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Download Recording
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
