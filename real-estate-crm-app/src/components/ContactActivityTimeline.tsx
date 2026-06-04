import { useEffect, useState } from 'react';
import { 
  Clock, 
  Calendar, 
  FileText, 
  User, 
  ArrowRightCircle, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Phone, 
  DollarSign, 
  Home, 
  MapPin, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../services/api';

export interface ContactActivity {
  activityId: string;
  contactId: string;
  tenantId: string;
  occurredAt: string;
  activityType: string;
  performedBy: string;
  subjectEntityType: string;
  subjectEntityId: string;
  subjectEntityName?: string;
  title: string;
  description?: string;
  payload?: any;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityName?: string | null;
}

interface ContactActivityTimelineProps {
  contactId?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}

export default function ContactActivityTimeline({ contactId, entityType, entityId, limit }: ContactActivityTimelineProps) {
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId && (!entityType || !entityId)) return;

    const loadTimeline = async () => {
      try {
        setLoading(true);
        setError(null);
        // Use a placeholder contactId if resolving from entity
        const targetContactId = contactId || 'resolve';
        const data = await api.getContactActivity(targetContactId, entityType, entityId);
        setActivities(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Failed to load contact activity timeline:', err);
        setError(err.message || 'Failed to load timeline activity');
      } finally {
        setLoading(false);
      }
    };

    loadTimeline();
  }, [contactId, entityType, entityId]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'meeting_scheduled':
        return <Calendar className="w-5 h-5 text-blue-500" />;
      case 'meeting_completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'meeting_cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'meeting_rescheduled':
        return <Calendar className="w-5 h-5 text-orange-500" />;
      case 'note_added':
      case 'note_updated':
        return <FileText className="w-5 h-5 text-yellow-500" />;
      case 'lead_created':
        return <User className="w-5 h-5 text-purple-500" />;
      case 'lead_status_changed':
        return <TrendingUp className="w-5 h-5 text-teal-500" />;
      case 'lead_converted':
        return <ArrowRightCircle className="w-5 h-5 text-indigo-500" />;
      case 'call_made':
      case 'site_visit_scheduled':
        return <Phone className="w-5 h-5 text-sky-500" />;
      case 'property_listed':
        return <Home className="w-5 h-5 text-cyan-500" />;
      case 'property_sold':
      case 'purchase_recorded':
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case 'property_rented':
      case 'rental_started':
        return <Home className="w-5 h-5 text-rose-500" />;
      case 'khata_entry':
        return <DollarSign className="w-5 h-5 text-amber-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActivityBg = (type: string) => {
    switch (type) {
      case 'meeting_scheduled': return 'bg-blue-50 dark:bg-blue-950/25';
      case 'meeting_completed': return 'bg-green-50 dark:bg-green-950/25';
      case 'meeting_cancelled': return 'bg-red-50 dark:bg-red-950/25';
      case 'meeting_rescheduled': return 'bg-orange-50 dark:bg-orange-950/25';
      case 'note_added':
      case 'note_updated': return 'bg-yellow-50 dark:bg-yellow-950/25';
      case 'lead_created': return 'bg-purple-50 dark:bg-purple-950/25';
      case 'lead_status_changed': return 'bg-teal-50 dark:bg-teal-950/25';
      case 'lead_converted': return 'bg-indigo-50 dark:bg-indigo-950/25';
      case 'call_made':
      case 'site_visit_scheduled': return 'bg-sky-50 dark:bg-sky-950/25';
      case 'property_listed': return 'bg-cyan-50 dark:bg-cyan-950/25';
      case 'property_sold':
      case 'purchase_recorded': return 'bg-emerald-50 dark:bg-emerald-950/25';
      case 'property_rented':
      case 'rental_started': return 'bg-rose-50 dark:bg-rose-950/25';
      case 'khata_entry': return 'bg-amber-50 dark:bg-amber-950/25';
      default: return 'bg-gray-50 dark:bg-gray-850/25';
    }
  };

  const formatOccurredAt = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  const displayedActivities = limit ? activities.slice(0, limit) : activities;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading activity timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-3 p-4 text-red-600 bg-red-50 dark:bg-red-950/25 rounded-lg border border-red-200">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-55/10 dark:bg-gray-900/10 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
        <Clock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">No activity yet</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          When this person interacts, schedules meetings, or receives notes, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="relative border-l border-gray-200 dark:border-gray-800 ml-4 pl-6 space-y-6">
      {displayedActivities.map((activity) => (
        <div key={activity.activityId} className="relative group">
          {/* Indicator Dot */}
          <div className={`absolute -left-[37px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center border border-white dark:border-gray-950 shadow-sm ${getActivityBg(activity.activityType)}`}>
            {getActivityIcon(activity.activityType)}
          </div>

          {/* Timeline Card */}
          <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-md rounded-xl p-4 border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition duration-150 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 mb-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {activity.title}
              </h4>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {formatOccurredAt(activity.occurredAt)}
              </span>
            </div>

            {activity.description && (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line mt-1 line-clamp-3 group-hover:line-clamp-none transition duration-150">
                {activity.description}
              </p>
            )}

            {/* Related Entity / Metadata Badge */}
            <div className="flex flex-wrap gap-2 mt-3 items-center text-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 text-[10px]">
                <User className="w-3 h-3 mr-1" />
                By {activity.performedBy}
              </span>

              {activity.relatedEntityName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-gray-50 text-gray-600 dark:bg-gray-900/50 dark:text-gray-400 border border-gray-100 dark:border-gray-800 text-[10px]">
                  <MapPin className="w-3 h-3 mr-1" />
                  {activity.relatedEntityName}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
