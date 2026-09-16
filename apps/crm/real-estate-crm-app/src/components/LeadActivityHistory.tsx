import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { LeadHistoryEntry } from '../types/crm';
import { TeamMember } from './LeadAssignmentDropdown';
import {
  buildMemberLabelMap,
  formatHistoryEntry,
  sortHistoryDescending,
} from '../utils/activityHistory';

interface LeadActivityHistoryProps {
  history?: LeadHistoryEntry[];
  members?: TeamMember[];
  className?: string;
}

export default function LeadActivityHistory({
  history = [],
  members: membersProp,
  className = '',
}: LeadActivityHistoryProps) {
  const [members, setMembers] = useState<TeamMember[]>(membersProp || []);

  useEffect(() => {
    if (membersProp) {
      setMembers(membersProp);
    }
  }, [membersProp]);

  useEffect(() => {
    if (membersProp?.length) return;
    let cancelled = false;
    api.getLeadAgents()
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setMembers(data as TeamMember[]);
        }
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [membersProp]);

  const memberLabels = useMemo(() => buildMemberLabelMap(members), [members]);
  const sortedHistory = useMemo(() => sortHistoryDescending(history), [history]);

  if (!sortedHistory.length) return null;

  return (
    <div className={`mt-6 pt-4 border-t ${className}`.trim()}>
      <h4 className="text-sm font-medium text-gray-700 mb-3">Activity History</h4>
      <div className="space-y-2">
        {sortedHistory.map((entry, index) => {
          const formatted = formatHistoryEntry(entry, memberLabels);
          return (
            <div key={`${entry.timestamp}-${index}`} className="flex items-start text-sm">
              <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 mr-3 flex-shrink-0" />
              <div>
                <span className="font-medium">{formatted.action}</span>
                <span className="text-gray-500"> - {formatted.details}</span>
                <div className="text-xs text-gray-400">
                  {formatted.actor} • {new Date(formatted.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
