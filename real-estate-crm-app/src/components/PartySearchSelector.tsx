import { useState, useEffect, useRef } from 'react';
import { Search, X, User } from 'lucide-react';
import { api } from '../services/api';
import { KhataPartyType } from '../types/khata';

interface Party {
  id: string;
  name: string;
  phone: string;
  type: KhataPartyType;
}

interface PartySearchSelectorProps {
  partyType: KhataPartyType;
  selectedParty: { id: string; name: string; phone: string } | null;
  onSelect: (party: { id: string; name: string; phone: string; type: KhataPartyType }) => void;
  className?: string;
  required?: boolean;
}

export default function PartySearchSelector({
  partyType,
  selectedParty,
  onSelect,
  className = '',
  required = false,
}: PartySearchSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Party[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await api.searchKhataParties(searchQuery, partyType);
        setSearchResults(results);
        setShowDropdown(true);
      } catch (error) {
        console.error('Error searching parties:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchQuery, partyType]);

  const handleSelect = (party: Party) => {
    onSelect({
      id: party.id,
      name: party.name,
      phone: party.phone,
      type: party.type,
    });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelect({ id: '', name: '', phone: '', type: partyType });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const getPartyLabel = () => {
    switch (partyType) {
      case 'OWNER':
        return 'Owner';
      case 'TENANT':
        return 'Tenant';
      case 'BUYER':
        return 'Buyer';
      case 'SELLER':
        return 'Seller';
      default:
        return 'Party';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {getPartyLabel()} {required && <span className="text-red-500">*</span>}
      </label>

      {selectedParty && selectedParty.id ? (
        <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm border border-purple-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedParty.name}</p>
              <p className="text-sm text-gray-500">{selectedParty.phone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-2 hover:bg-red-50 rounded-lg text-gray-600 hover:text-red-600 transition-colors"
            title="Clear selection"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div ref={dropdownRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowDropdown(true)}
              placeholder={`Search ${getPartyLabel().toLowerCase()} by name or phone...`}
              className="w-full pl-10 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
              required={required && !selectedParty}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
              </div>
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-xl border border-purple-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {searchResults.map((party) => (
                <button
                  key={party.id}
                  type="button"
                  onClick={() => handleSelect(party)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50/80 transition-colors text-left border-b border-gray-100 last:border-b-0"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shadow-md flex-shrink-0">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{party.name}</p>
                    <p className="text-sm text-gray-500">{party.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-xl border border-purple-200 rounded-xl shadow-xl p-4 text-center text-gray-500">
              No {getPartyLabel().toLowerCase()} found matching "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
