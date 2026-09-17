import { useState, useEffect, useRef } from 'react';
import { Search, X, User, Phone, Loader2 } from 'lucide-react';

interface Option {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

interface SearchableSelectProps {
  value: string | null;
  onChange: (id: string | null, item: Option | null) => void;
  onSearch: (query: string) => Promise<Option[]>;
  placeholder?: string;
  label?: string;
  displayValue?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  onSearch,
  placeholder = 'Search by name or phone...',
  label,
  displayValue,
  disabled = false,
  allowClear = true,
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Option | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.length >= 2) {
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await onSearch(searchQuery);
          setOptions(results);
        } catch (error) {
          console.error('Search error:', error);
          setOptions([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    } else {
      setOptions([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, onSearch]);

  const handleSelect = (item: Option) => {
    setSelectedItem(item);
    onChange(item.id, item);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    setSelectedItem(null);
    onChange(null, null);
    setSearchQuery('');
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        {value && (displayValue || selectedItem) ? (
          <div className="flex items-center justify-between px-3 py-2.5 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {displayValue || selectedItem?.name}
                </p>
                {selectedItem?.phone && (
                  <p className="text-xs text-gray-500">{selectedItem.phone}</p>
                )}
              </div>
            </div>
            {allowClear && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {loading ? (
                <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
              ) : (
                <Search className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleInputFocus}
              disabled={disabled}
              placeholder={placeholder}
              className="w-full pl-10 pr-4 py-2.5 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </>
        )}
      </div>

      {isOpen && !value && (
        <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {loading ? (
            <div className="p-4 text-center">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Searching...</p>
            </div>
          ) : options.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto">
              {options.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-150 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      {item.phone && (
                        <div className="flex items-center text-xs text-gray-500 mt-0.5">
                          <Phone className="h-3 w-3 mr-1" />
                          {item.phone}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : searchQuery.length >= 2 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">No results found</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="p-4 text-center">
              <Search className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Type at least 2 characters to search</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
