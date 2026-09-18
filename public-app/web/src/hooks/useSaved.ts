/**
 * Saved-homes state: one query for the set of saved propertyIds (only when
 * logged in) + an optimistic toggle mutation gated behind requireAuth.
 */
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/services/api';
import { marketplace, qk } from '@/services/marketplace';
import type { SavedItem } from '@/types/api';

export function useSaved() {
  const { isAuthed, requireAuth } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: qk.saved,
    queryFn: () => marketplace.saved(),
    enabled: isAuthed,
    staleTime: 60_000,
  });

  const ids = useMemo(() => new Set((query.data?.items ?? []).map((s) => s.propertyId)), [query.data]);

  const mutation = useMutation({
    mutationFn: async ({ slug, propertyId, save }: { slug: string; propertyId: string; save: boolean }) => {
      if (save) await marketplace.save(slug, propertyId);
      else await marketplace.unsave(slug, propertyId);
      return save;
    },
    onMutate: async ({ slug, propertyId, save }) => {
      await qc.cancelQueries({ queryKey: qk.saved });
      const prev = qc.getQueryData<{ items: SavedItem[] }>(qk.saved);
      qc.setQueryData<{ items: SavedItem[] }>(qk.saved, (old) => {
        const items = old?.items ?? [];
        if (save) {
          if (items.some((i) => i.propertyId === propertyId)) return old ?? { items };
          const optimistic: SavedItem = {
            propertyId,
            tenantId: '',
            agencySlug: slug,
            savedAt: new Date().toISOString(),
            snapshot: { title: '', price: null, mode: 'sale', locality: null, city: '', imageCount: 0 },
          };
          return { items: [optimistic, ...items] };
        }
        return { items: items.filter((i) => i.propertyId !== propertyId) };
      });
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.saved, ctx.prev);
      toast.error('Could not update saved homes', errorMessage(e));
    },
    onSuccess: (saved) => {
      toast.success(saved ? 'Saved to your shortlist' : 'Removed from saved');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.saved });
    },
  });

  const toggle = useCallback(
    async (slug: string, propertyId: string) => {
      const ok = await requireAuth({ reason: 'Login to save homes to your shortlist' });
      if (!ok) return;
      const currentlySaved = ids.has(propertyId);
      mutation.mutate({ slug, propertyId, save: !currentlySaved });
    },
    [ids, mutation, requireAuth],
  );

  return { ids, isSaved: (propertyId: string) => ids.has(propertyId), toggle, items: query.data?.items ?? [], query };
}
