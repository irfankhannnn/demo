/**
 * Indian phone number input component with validation
 */

import { Phone } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

export default function PhoneInput({ value, onChange, error, disabled, placeholder }: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    // Format display value
    if (value) {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length === 10) {
        setDisplayValue(`${cleaned.substring(0, 5)} ${cleaned.substring(5)}`);
      } else {
        setDisplayValue(cleaned);
      }
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, ''); // Remove non-digits
    
    // Limit to 10 digits
    if (input.length <= 10) {
      onChange(input);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">
        Phone Number
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <Phone className="h-5 w-5 text-gray-400" />
        </div>
        <div className="absolute inset-y-0 left-12 flex items-center pointer-events-none">
          <span className="text-gray-500 font-medium">+91</span>
        </div>
        <input
          type="tel"
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder || '98765 43210'}
          className={`w-full pl-24 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-200'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          maxLength={11} // 5 + space + 5
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">Enter 10-digit Indian mobile number</p>
    </div>
  );
}
