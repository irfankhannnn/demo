import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  AlertCircle,
  MessageCircle,
  Bot,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import { api } from '../services/api';
import {
  type ContactActivity,
  getActivityMeta,
  getActivityLinks,
  getActivityNarrative,
  groupActivitiesByDate,
  sortActivitiesDescending,
  formatPerformedBy,
  formatOccurredAt,
  formatRelativeTime,
} from '../utils/activityTimelineMeta';

export type { ContactActivity };

interface ContactActivityTimelineProps {
  contactId?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  compact?: boolean;
  /** Preloaded activities — skips fetch (used by contact list cards). */
  activities?: ContactActivity[];
}

function ActivityIcon({ type }: { type: string }) {
  const className = 'w-4 h-4';
  switch (type) {
    case 'meeting_scheduled':
      return <Calendar className={`${className} text-blue-600`} />;
    case 'meeting_completed':
      return <CheckCircle className={`${className} text-green-600`} />;
    case 'meeting_cancelled':
      return <XCircle className={`${className} text-red-600`} />;
    case 'meeting_rescheduled':
      return <Calendar className={`${className} text-orange-600`} />;
    case 'note_added':
    case 'note_updated':
      return <FileText className={`${className} text-amber-600`} />;
    case 'lead_created':
      return <User className={`${className} text-purple-600`} />;
    case 'lead_status_changed':
      return <TrendingUp className={`${className} text-teal-600`} />;
    case 'lead_converted':
      return <ArrowRightCircle className={`${className} text-indigo-600`} />;
    case 'call_made':
    case 'site_visit_scheduled':
      return <Phone className={`${className} text-sky-600`} />;
    case 'property_listed':
    case 'property_added':
      return <Home className={`${className} text-cyan-600`} />;
    case 'property_sold':
    case 'purchase_recorded':
      return <DollarSign className={`${className} text-emerald-600`} />;
    case 'ownership_changed':
      return <ArrowRightCircle className={`${className} text-violet-600`} />;
    case 'property_rented':
    case 'rental_started':
      return <KeyRound className={`${className} text-rose-600`} />;
    case 'rental_ended':
      return <KeyRound className={`${className} text-orange-600`} />;
    case 'khata_entry':
      return <DollarSign className={`${className} text-amber-600`} />;
    case 'whatsapp_message_received':
    case 'whatsapp_message_sent':
      return <MessageCircle className={`${className} text-green-600`} />;
    case 'whatsapp_ai_reply':
      return <Bot className={`${className} text-blue-600`} />;
    default:
      return <Clock className={`${className} text-gray-500`} />;
  }
}

function ActivityCard({ activity }: { activity: ContactActivity }) {
  const meta = getActivityMeta(activity.activityType);
  const narrative = getActivityNarrative(activity);
  const links = getActivityLinks(activity);
  const performer = formatPerformedBy(activity.performedBy);
  const isAutomated = performer === 'Automated';

  return (
    <article
      className={`rounded-xl border-l-4 ${meta.accent} border border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.chip}`}>
            <ActivityIcon type={activity.activityType} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${meta.chip}`}>
                {meta.label}
              </span>
              {activity.payload?.active === true && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                  Active lease
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {narrative.title}
            </h4>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {formatRelativeTime(activity.occurredAt)}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {formatOccurredAt(activity.occurredAt)}
          </p>
        </div>
      </div>

      {narrative.summary && (
        <p className="text-sm text-gray-600 dark:text-gray-300 ml-11 whitespace-pre-line leading-relaxed">
          {narrative.summary}
        </p>
      )}

      {narrative.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 ml-11">
          {narrative.chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3 ml-11">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
            isAutomated
              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
          }`}
        >
          <User className="w-3 h-3 mr-1" />
          {isAutomated ? 'System' : performer}
        </span>

        {links.map((link) => (
          <Link
            key={`${link.href}-${link.label}`}
            to={link.href}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/30 dark:text-primary-300 transition-colors"
          >
            {link.label}
            <ExternalLink className="w-3 h-3" />
          </Link>
        ))}
      </div>
    </article>
  );
}

export default function ContactActivityTimeline({
  contactId,
  entityType,
  entityId,
  limit,
  compact = false,
  activities: preloadedActivities,
}: ContactActivityTimelineProps) {
  const [activities, setActivities] = useState<ContactActivity[]>(preloadedActivities || []);
  const [loading, setLoading] = useState(!preloadedActivities);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preloadedActivities) {
      setActivities(sortActivitiesDescending(preloadedActivities));
      setLoading(false);
      return;
    }
    if (!contactId && (!entityType || !entityId)) return;

    const loadTimeline = async () => {
      try {
        setLoading(true);
        setError(null);
        const targetContactId = contactId || 'resolve';
        const data = await api.getContactActivity(targetContactId, entityType, entityId);
        setActivities(sortActivitiesDescending(Array.isArray(data) ? data : []));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load timeline activity';
        console.error('Failed to load contact activity timeline:', err);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadTimeline();
  }, [contactId, entityType, entityId, preloadedActivities]);

  const displayedActivities = limit ? activities.slice(0, limit) : activities;

  if (loading) {
    if (compact) {
      return <p className="text-xs text-gray-400 py-1">Loading history...</p>;
    }
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading activity timeline...</p>
      </div>
    );
  }

  if (error) {
    if (compact) {
      return <p className="text-xs text-red-500 py-1">{error}</p>;
    }
    return (
      <div className="flex items-center space-x-3 p-4 text-red-600 bg-red-50 dark:bg-red-950/25 rounded-lg border border-red-200">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    if (compact) {
      return <p className="text-xs text-gray-400 py-1">No activity yet</p>;
    }
    return (
      <div className="text-center p-8 bg-gray-50/50 dark:bg-gray-900/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
        <Clock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">No activity yet</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
          Lead conversions, property listings, rentals, meetings, and notes will appear here as they happen.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <ul className="space-y-2">
        {sortActivitiesDescending(displayedActivities).map((activity) => {
          const meta = getActivityMeta(activity.activityType);
          const narrative = getActivityNarrative(activity);
          return (
            <li key={activity.activityId} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center ${meta.chip}`}>
                <ActivityIcon type={activity.activityType} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-gray-800 font-medium truncate">{narrative.title}</p>
                <p className="text-gray-400 truncate">
                  {formatRelativeTime(activity.occurredAt)}
                  {narrative.summary ? ` · ${narrative.summary}` : ` · ${meta.label}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  const grouped = groupActivitiesByDate(displayedActivities);

  return (
    <div className="space-y-8">
      {grouped.map((group) => (
        <section key={group.label}>
          <div className="sticky top-0 z-10 mb-4">
            <h3 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-white/90 dark:bg-gray-950/90 backdrop-blur px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-800">
              <Calendar className="w-3.5 h-3.5" />
              {group.label}
            </h3>
          </div>
          <div className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-800 space-y-4 ml-2">
            {group.items.map((activity) => (
              <div key={activity.activityId} className="relative">
                <div className="absolute -left-[21px] top-5 w-3 h-3 rounded-full bg-white dark:bg-gray-950 border-2 border-primary-400" />
                <ActivityCard activity={activity} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
