/**
 * Utility functions for date formatting in Indian format (DD/MM/YYYY)
 */

/**
 * Format ISO date string to Indian format (DD/MM/YYYY)
 */
export function formatToIndianDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Format ISO date string to Indian format with time (DD/MM/YYYY HH:MM)
 */
export function formatToIndianDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Convert DD/MM/YYYY to ISO date string (YYYY-MM-DD)
 */
export function indianDateToISO(indianDate: string): string {
  if (!indianDate) return '';
  
  const parts = indianDate.split('/');
  if (parts.length !== 3) return '';
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  return `${year}-${month}-${day}`;
}

/**
 * Convert ISO date string (YYYY-MM-DD) to DD/MM/YYYY for input fields
 */
export function isoToIndianDateInput(isoDate: string): string {
  if (!isoDate) return '';
  
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Get current date in Indian format (DD/MM/YYYY)
 */
export function getCurrentIndianDate(): string {
  const today = new Date();
  const day = today.getDate().toString().padStart(2, '0');
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const year = today.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Convert Date object to ISO string for database storage
 */
export function dateToISOString(date: Date): string {
  return date.toISOString();
}
