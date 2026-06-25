import { useState } from 'react';
import { User, ChevronDown, Loader2 } from 'lucide-react';

export interface TeamMember {
  userId: string;
  username: string;
  label?: string;
  role?: string;
}

interface LeadAssignmentDropdownProps {
  leadId: string;
  assignedTo?: string | null;
  members: TeamMember[];
  onAssign: (leadId: string, memberId: string | null) => Promise<void>;
  disabled?: boolean;
}

export function LeadAssignmentDropdown({
  leadId,
  assignedTo,
  members,
  onAssign,
  disabled = false,
}: LeadAssignmentDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const current = members.find((m) => m.userId === assignedTo);

  const handleSelect = async (memberId: string | null) => {
    if (memberId === assignedTo || memberId === current?.userId) {
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      await onAssign(leadId, memberId);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => !disabled && !loading && setOpen((v) => !v)}
        disabled={disabled || loading}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
          current
            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <User className="h-3.5 w-3.5" />
        )}
        <span className="max-w-[140px] truncate">
          {current ? current.label || current.username : 'Unassigned'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-1 min-w-[180px] bg-white rounded-lg border border-slate-200 shadow-lg py-1">
            <button
              onClick={() => handleSelect(null)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                !current ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-600'
              }`}
            >
              <User className="h-3.5 w-3.5 text-slate-400" />
              Unassigned
            </button>
            {members.map((member) => (
              <button
                key={member.userId}
                onClick={() => handleSelect(member.userId)}
                disabled={current?.userId === member.userId}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                  current?.userId === member.userId
                    ? 'bg-blue-50 text-blue-700 font-medium cursor-default'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User className={`h-3.5 w-3.5 ${current?.userId === member.userId ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="flex-1 truncate">{member.label || member.username}</span>
                {current?.userId === member.userId ? (
                  <span className="text-[10px] text-blue-600">Current</span>
                ) : member.role ? (
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">
                    {member.role}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default LeadAssignmentDropdown;
