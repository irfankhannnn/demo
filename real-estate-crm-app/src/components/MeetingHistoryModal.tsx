import { useEffect, useState } from 'react';
import { X, Clock, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface MeetingHistoryEvent {
  meetingId: string;
  eventId: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromMeetingDate?: string | null;
  toMeetingDate?: string | null;
  fromMeetingTime?: string | null;
  toMeetingTime?: string | null;
  note?: string;
  createdBy?: string;
  createdAt: string;
}

interface MeetingHistoryModalProps {
  isOpen: boolean;
  meetingId: string | null;
  onClose: () => void;
}

export default function MeetingHistoryModal({ isOpen, meetingId, onClose }: MeetingHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<MeetingHistoryEvent[]>([]);

  const load = async () => {
    if (!meetingId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMeetingHistory(meetingId);
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load meeting history', e);
      setError(e instanceof Error ? e.message : 'Failed to load meeting history');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !meetingId) return;
    load();
  }, [isOpen, meetingId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !meetingId) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Meeting History</h3>
            <p className="text-xs text-gray-500">All changes and outcomes for this meeting</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              Loading history...
            </div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : events.length === 0 ? (
            <div className="text-sm text-gray-600">No history events yet.</div>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.eventId} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 capitalize">{ev.action}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(ev.createdAt).toLocaleString()}
                        {ev.createdBy ? ` • ${ev.createdBy}` : ''}
                      </div>

                      {(ev.fromMeetingDate || ev.toMeetingDate || ev.fromMeetingTime || ev.toMeetingTime) && (
                        <div className="text-xs text-gray-700 mt-2">
                          <div>
                            <span className="font-medium">When:</span>{' '}
                            {ev.fromMeetingDate || ev.fromMeetingTime ? (
                              <span className="text-gray-500">
                                {ev.fromMeetingDate || '-'} {ev.fromMeetingTime || ''}
                              </span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                            <span className="mx-2 text-gray-400">→</span>
                            <span className="text-gray-800">
                              {ev.toMeetingDate || '-'} {ev.toMeetingTime || ''}
                            </span>
                          </div>
                        </div>
                      )}

                      {(ev.fromStatus || ev.toStatus) && (
                        <div className="text-xs text-gray-700 mt-2">
                          <span className="font-medium">Status:</span>{' '}
                          <span className="text-gray-500">{ev.fromStatus || '-'}</span>
                          <span className="mx-2 text-gray-400">→</span>
                          <span className="text-gray-800">{ev.toStatus || '-'}</span>
                        </div>
                      )}

                      {ev.note ? (
                        <div className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">{ev.note}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
