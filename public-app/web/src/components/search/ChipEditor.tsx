/**
 * Small editor sheet for one intent chip. Reuses the filter controls so an
 * edit here is identical to an edit in the filter rail.
 */
import { useState } from 'react';
import type { FilterKey, SearchAction, SearchState } from '@/lib/searchState';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { CityPicker } from './CityPicker';
import { BhkControl, FurnishingControl, LocalityControl, ModeControl, PriceControl, PropertyTypeControl } from './FilterControls';

const TITLES: Record<FilterKey | 'city', string> = {
  city: 'City',
  mode: 'Buy or rent?',
  bhk: 'How many bedrooms?',
  minPrice: 'Budget',
  maxPrice: 'Budget',
  locality: 'Locality',
  propertyType: 'Property type',
  furnishing: 'Furnishing',
};

export function ChipEditor({ editing, state, onClose, onApply }: { editing: FilterKey | 'city' | null; state: SearchState; onClose: () => void; onApply: (a: SearchAction) => void }) {
  if (editing === 'city') {
    return <CityPicker open onClose={onClose} onPick={(name) => onApply({ type: 'setCity', city: name })} title="Change city" />;
  }
  return <ChipEditorSheet key={editing ?? 'none'} editing={editing} state={state} onClose={onClose} onApply={onApply} />;
}

function ChipEditorSheet({ editing, state, onClose, onApply }: { editing: FilterKey | null; state: SearchState; onClose: () => void; onApply: (a: SearchAction) => void }) {
  const [draft, setDraft] = useState<SearchState>(state);
  const open = editing !== null;
  const isPrice = editing === 'minPrice' || editing === 'maxPrice';

  const apply = () => {
    if (!editing) return;
    if (isPrice) onApply({ type: 'setPriceRange', minPrice: draft.minPrice, maxPrice: draft.maxPrice });
    else onApply({ type: 'setFilter', key: editing, value: draft[editing] });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? TITLES[editing] : ''}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={onClose}>
            Cancel
          </Button>
          <Button full onClick={apply}>
            Update results
          </Button>
        </div>
      }
    >
      {editing === 'mode' && <ModeControl value={draft.mode} onChange={(mode) => setDraft({ ...draft, mode })} />}
      {editing === 'bhk' && <BhkControl value={draft.bhk} onChange={(bhk) => setDraft({ ...draft, bhk })} />}
      {isPrice && <PriceControl mode={draft.mode} min={draft.minPrice} max={draft.maxPrice} onChange={(minPrice, maxPrice) => setDraft({ ...draft, minPrice, maxPrice })} />}
      {editing === 'locality' && <LocalityControl value={draft.locality} onChange={(locality) => setDraft({ ...draft, locality })} autoFocus />}
      {editing === 'propertyType' && <PropertyTypeControl value={draft.propertyType} onChange={(propertyType) => setDraft({ ...draft, propertyType })} />}
      {editing === 'furnishing' && <FurnishingControl value={draft.furnishing} onChange={(furnishing) => setDraft({ ...draft, furnishing })} />}
    </Sheet>
  );
}
