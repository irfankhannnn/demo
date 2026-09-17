import { useState, useRef, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  compact?: boolean;
}

export function LeadAssignmentDropdown({
  leadId,
  assignedTo,
  members,
  onAssign,
  disabled = false,
  compact = false,
}: LeadAssignmentDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  const current = members.find((m) => m.userId === assignedTo);

  const updateMenuPosition = () => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minWidth = Math.max(rect.width, 200);
    let left = rect.left;
    if (left + minWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - minWidth - 8);
    }
    setMenuStyle({ top: rect.bottom + 4, left, minWidth });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

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

  const menu = open && menuStyle
    ? createPortal(
        <>
          <DropdownBackdrop onClose={() => setOpen(false)} />
          <DropdownMenu style={menuStyle}>
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                !current ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-600'
              }`}
            >
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              Unassigned
            </button>
            {members.map((member) => (
              <button
                key={member.userId}
                type="button"
                onClick={() => handleSelect(member.userId)}
                disabled={current?.userId === member.userId}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                  current?.userId === member.userId
                    ? 'bg-blue-50 text-blue-700 font-medium cursor-default'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User
                  className={`h-3.5 w-3.5 shrink-0 ${
                    current?.userId === member.userId ? 'text-blue-400' : 'text-slate-400'
                  }`}
                />
                <span className="flex-1 truncate">{member.label || member.username}</span>
                {current?.userId === member.userId ? (
                  <span className="text-[10px] text-blue-600 shrink-0">Current</span>
                ) : member.role ? (
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 shrink-0">
                    {member.role}
                  </span>
                ) : null}
              </button>
            ))}
          </DropdownMenu>
        </>,
        document.body,
      )
    : null;

  return (
    <div
      className={`relative ${compact ? 'w-full max-w-full' : 'inline-block'}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!disabled && !loading) setOpen((v) => !v);
        }}
        disabled={disabled || loading}
        className={`inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors w-full ${
          compact ? 'px-2 py-1' : 'px-3 py-1.5'
        } ${
          current
            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        ) : (
          <User className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className={`truncate ${compact ? 'max-w-[5.5rem]' : 'max-w-[140px]'}`}>
          {current ? current.label || current.username : 'Unassigned'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}

function DropdownBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200]"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}

function DropdownMenu({
  style,
  children,
}: {
  style: { top: number; left: number; minWidth: number };
  children: ReactNode;
}) {
  return (
    <div
      className="fixed z-[201] bg-white rounded-lg border border-slate-200 shadow-lg py-1 max-h-64 overflow-y-auto"
      style={{ top: style.top, left: style.left, minWidth: style.minWidth }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export default LeadAssignmentDropdown;
