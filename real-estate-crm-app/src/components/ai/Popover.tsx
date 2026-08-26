/**
 * A small anchored popover, used by the composer's "+" menu and by the
 * quick-action chips.
 *
 * Deliberately not a library. What these two menus need is dismissal on
 * outside-click and Esc, focus that starts inside, and an opening direction —
 * roughly forty lines. A dropdown package would add a dependency and its own
 * portal/focus model to a codebase that has neither.
 *
 * The caller supplies the anchor by wrapping both the trigger and this
 * component in a `relative` element.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Horizontal edge to pin to. */
  align?: 'left' | 'right' | 'center';
  /** Preferred direction. Flipped automatically when that side has no room. */
  side?: 'top' | 'bottom';
  label: string;
  className?: string;
}

/** Gap left between the menu and the viewport edge. */
const VIEWPORT_MARGIN = 12;

const ALIGN_CLASS: Record<NonNullable<PopoverProps['align']>, string> = {
  left: 'left-0',
  right: 'right-0',
  center: 'left-1/2 -translate-x-1/2',
};

const SIDE_CLASS: Record<NonNullable<PopoverProps['side']>, string> = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
};

export default function Popover({
  open,
  onClose,
  children,
  align = 'left',
  side = 'top',
  label,
  className = '',
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [resolvedSide, setResolvedSide] = useState<'top' | 'bottom'>(side);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  /*
   * Flip and cap.
   *
   * The composer's "+" menu is nine rows tall and sits low on the screen, so
   * opening it upward — the natural direction for a control at the bottom of a
   * form — ran it straight off the top of the viewport with the first two
   * groups unreachable. There is no clipping container to scroll it back into
   * view, so the menu has to measure for itself.
   *
   * Runs in a layout effect so the corrected position is committed before the
   * browser paints; in a plain effect the menu visibly jumps.
   */
  useLayoutEffect(() => {
    if (!open) {
      // Reset before the next open so the measurement below sees the menu's
      // natural height rather than the cap from last time.
      setResolvedSide(side);
      setMaxHeight(undefined);
      return;
    }

    const measure = () => {
      const node = ref.current;
      const anchor = node?.parentElement;
      if (!node || !anchor) return;

      const rect = anchor.getBoundingClientRect();
      const above = rect.top - VIEWPORT_MARGIN;
      const below = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
      const needed = node.scrollHeight;

      // Keep the preferred side unless it cannot fit AND the other side is
      // roomier. Flipping to a side that is also too small helps nobody.
      let next = side;
      if (side === 'top' && needed > above && below > above) next = 'bottom';
      if (side === 'bottom' && needed > below && above > below) next = 'top';

      const available = next === 'top' ? above : below;
      setResolvedSide(next);
      setMaxHeight(needed > available ? Math.max(available, 160) : undefined);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, side]);

  useEffect(() => {
    if (!open) return;

    /*
     * `mousedown` rather than `click`: a click listener fires after React has
     * already handled the trigger's own click, which reopens a menu the user
     * just closed by clicking the trigger again.
     */
    const onPointerDown = (event: MouseEvent) => {
      const node = ref.current;
      if (!node) return;
      const target = event.target as Node;
      // The trigger lives in the same relative wrapper, so treat the whole
      // wrapper as "inside" and let the trigger's own handler toggle.
      if (node.parentElement?.contains(target)) return;
      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      style={maxHeight ? { maxHeight } : undefined}
      className={`absolute z-50 min-w-[240px] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 ${ALIGN_CLASS[align]} ${SIDE_CLASS[resolvedSide]} ${className}`}
    >
      {children}
    </div>
  );
}

/** One tappable row inside a popover. */
export function PopoverItem({
  Icon,
  label,
  hint,
  onSelect,
  disabled = false,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-slate-800">{label}</span>
        {hint && <span className="block truncate text-[11px] text-slate-400">{hint}</span>}
      </span>
    </button>
  );
}

/** Section heading between groups of items. */
export function PopoverLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

export function PopoverDivider() {
  return <div className="my-1 border-t border-slate-100" />;
}
