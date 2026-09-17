// Response Normalizer - Converts API/DB data to natural conversational text

const numberWords = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four',
  5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
  10: 'ten', 11: 'eleven', 12: 'twelve',
};

export function numberToWords(num) {
  if (num <= 12) return numberWords[num] || num.toString();
  
  if (num >= 10000000) {
    const crores = Math.floor(num / 10000000);
    const remainder = num % 10000000;
    if (remainder === 0) return `${numberToWords(crores)} crore`;
    return `${numberToWords(crores)} crore ${numberToWords(remainder)}`;
  }
  
  if (num >= 100000) {
    const lakhs = Math.floor(num / 100000);
    const remainder = num % 100000;
    if (remainder === 0) return `${numberToWords(lakhs)} lakh`;
    return `${numberToWords(lakhs)} lakh ${numberToWords(remainder)}`;
  }
  
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    if (remainder === 0) return `${numberToWords(thousands)} thousand`;
    return `${numberToWords(thousands)} thousand ${numberToWords(remainder)}`;
  }
  
  if (num >= 100) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    if (remainder === 0) return `${numberToWords(hundreds)} hundred`;
    return `${numberToWords(hundreds)} hundred ${numberToWords(remainder)}`;
  }
  
  return num.toString();
}

export function formatCurrency(amount) {
  if (!amount || amount === 0) return 'price not specified';
  return `rupees ${numberToWords(amount)}`;
}

function expandAbbreviations(text) {
  if (!text) return '';
  return text
    .replace(/\bBHK\b/gi, 'bedroom hall kitchen')
    .replace(/\bsqft\b/gi, 'square feet')
    .replace(/\bsq\.?\s*ft\.?\b/gi, 'square feet')
    .replace(/\bRs\.?\s*/gi, 'rupees ')
    .replace(/₹\s*/g, 'rupees ')
    .replace(/\bAC\b/g, 'air conditioned')
    .replace(/\bGF\b/gi, 'ground floor')
    .replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1');
}

export function normalizePropertyList(properties, userQuery) {
  if (!properties || properties.length === 0) {
    return "I don't have any properties matching those criteria right now. Would you like me to check for something else?";
  }
  
  const count = properties.length;
  
  if (count === 1) {
    const p = properties[0];
    const rent = formatCurrency(p.rent || p.price);
    const area = p.area || p.location || 'the area';
    const type = expandAbbreviations(p.propertyType || p.type || 'property');
    
    return `I have one ${type} available in ${area} for ${rent} per month. Would you like more details or to schedule a visit?`;
  }
  
  const countWord = count <= 5 ? numberToWords(count) : count.toString();
  const firstThree = properties.slice(0, 3);
  
  const descriptions = firstThree.map((p, i) => {
    const type = expandAbbreviations(p.propertyType || p.type || 'property');
    const area = p.area || p.location || '';
    const rent = formatCurrency(p.rent || p.price);
    const ordinal = i === 0 ? 'first' : i === 1 ? 'second' : 'third';
    return `The ${ordinal} is a ${type} in ${area} for ${rent}`;
  });
  
  let response = `I have ${countWord} properties available. ${descriptions.join('. ')}.`;
  
  if (count > 3) {
    response += ` Would you like to hear about the others, or shall I give you more details on any of these?`;
  } else {
    response += ` Would you like more details on any of these?`;
  }
  
  return response;
}

export function normalizePropertyDetails(property) {
  if (!property) {
    return "I couldn't find the details for that property. Would you like me to check for other available properties?";
  }
  
  const type = expandAbbreviations(property.propertyType || property.type || 'property');
  const area = property.area || property.location || 'the area';
  const rent = formatCurrency(property.rent || property.price);
  const bedrooms = property.bedrooms ? `${numberToWords(property.bedrooms)} bedrooms` : '';
  const bathrooms = property.bathrooms ? `${numberToWords(property.bathrooms)} bathrooms` : '';
  const sqft = property.squareFeet ? `${property.squareFeet} square feet` : '';
  const furnishing = property.furnishing || '';
  
  const details = [bedrooms, bathrooms, sqft, furnishing].filter(Boolean).join(', ');
  
  let response = `This is a ${type} in ${area}. `;
  if (details) {
    response += `It has ${details}. `;
  }
  response += `The rent is ${rent} per month. `;
  
  if (property.amenities && property.amenities.length > 0) {
    const amenitiesList = property.amenities.slice(0, 3).join(', ');
    response += `Amenities include ${amenitiesList}. `;
  }
  
  response += `Would you like to schedule a site visit?`;
  
  return response;
}

export function normalizeSiteVisitConfirmation(visit) {
  if (!visit) {
    return "I've noted your interest. Our team will contact you shortly to schedule a visit.";
  }
  
  const date = visit.date || visit.visitDate;
  const time = visit.time || visit.visitTime;
  const property = visit.propertyName || visit.address || 'the property';
  
  let response = `Great! I've scheduled a site visit for ${property}`;
  if (date) response += ` on ${date}`;
  if (time) response += ` at ${time}`;
  response += `. You'll receive a confirmation message shortly with the details.`;
  
  return response;
}

export function normalizeNoResults() {
  return "I don't have any properties matching those criteria right now. Would you like me to check for different requirements, or should I have our agent call you back with more options?";
}

export function normalizeAPIError() {
  return "I'm having a bit of trouble accessing that information right now. Let me connect you with one of our agents who can help you directly. Please hold for a moment.";
}

export function normalizeFAQResponse(answer, sources = []) {
  if (!answer) {
    return "I don't have specific information about that. Would you like me to connect you with our team who can answer your question?";
  }
  
  // Clean up the answer for speech
  let response = answer
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Keep it concise for voice
  if (response.length > 200) {
    const sentences = response.split(/[.!?]+/);
    response = sentences.slice(0, 2).join('. ') + '.';
  }
  
  return expandAbbreviations(response);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Turn an ISO date (2026-09-06) into "6 September 2026". Anything that isn't
 * an ISO date is passed through untouched — the follow-up service may hand us
 * a free-text schedule hint like "Saturday 4pm" and that already reads fine.
 */
export function speakDate(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  const month = MONTH_NAMES[Number(match[2]) - 1];
  if (!month) return String(value);
  return `${Number(match[3])} ${month} ${match[1]}`;
}

/**
 * Turn a 24h time (16:00) into "4 PM" / "4:30 PM". Non-matching input is
 * passed through as-is for the same reason as speakDate.
 */
export function speakTime(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value);
  const hours24 = Number(match[1]);
  const minutes = match[2];
  if (hours24 > 23) return String(value);
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return minutes === '00' ? `${hours12} ${suffix}` : `${hours12}:${minutes} ${suffix}`;
}

/**
 * One spoken sentence describing a booked meeting / site visit, for the
 * {{meeting_details}} dynamic variable. Returns null when there is nothing
 * usable so the caller can substitute its own "not known" text.
 */
export function normalizeMeetingDetails(meeting) {
  if (!meeting || typeof meeting !== 'object') return null;

  const date = speakDate(meeting.meetingDate || meeting.date);
  const time = speakTime(meeting.meetingTime || meeting.time);
  const location = meeting.location || meeting.propertyName || '';
  const schedule = meeting.meetingSchedule || '';

  if (!date && !time && !location && !schedule) return null;

  const kind = meeting.meetingType === 'site_visit' || !meeting.meetingType ? 'Site visit' : 'Meeting';
  let text = kind;
  if (date) text += ` on ${date}`;
  if (time) text += ` at ${time}`;
  if (!date && !time && schedule) text += ` ${schedule}`;
  if (location) text += `, at ${expandAbbreviations(location)}`;
  if (meeting.status) text += ` (currently ${String(meeting.status).replace(/_/g, ' ')})`;
  return `${text}.`;
}

/**
 * A short spoken description of one property, for {{property_details}} and
 * {{visit_details}}. Prices go through the Indian number words so the agent
 * says "one crore eighty lakh", not "18000000". Returns null when the object
 * carries nothing worth saying.
 */
export function normalizePropertyBrief(property) {
  if (!property || typeof property !== 'object') return null;

  const p = property;
  const parts = [];

  const title = p.title || p.propertyName || p.name;
  if (title) parts.push(expandAbbreviations(String(title)));

  const bhk = p.bhk ?? p.bedrooms;
  const type = p.propertyType || p.type;
  const bhkType = [
    bhk ? `${numberToWords(Number(bhk))} bedroom` : null,
    type ? String(type) : null,
  ].filter(Boolean).join(' ');
  if (bhkType) parts.push(bhkType);

  const place = [p.buildingName, p.area || p.location, p.city].filter(Boolean).join(', ');
  if (place) parts.push(`in ${expandAbbreviations(place)}`);

  if (p.price) parts.push(`priced at ${formatCurrency(Number(p.price))}`);
  else if (p.rentAmount || p.rent) parts.push(`rent ${formatCurrency(Number(p.rentAmount || p.rent))} per month`);

  const carpet = p.carpetArea || p.squareFeet;
  if (carpet) parts.push(`${carpet} square feet carpet area`);

  if (p.furnishing) parts.push(String(p.furnishing));

  if (parts.length === 0) return null;
  return `${parts.join(', ')}.`;
}

/**
 * Speech for confirm_site_visit, spoken after the CRM has updated the meeting.
 */
export function normalizeMeetingUpdate(meeting, action) {
  const date = speakDate(meeting?.meetingDate);
  const time = speakTime(meeting?.meetingTime);
  const when = [date && `on ${date}`, time && `at ${time}`].filter(Boolean).join(' ');

  if (action === 'reschedule') {
    return when
      ? `Done, I've moved your visit to ${when}. You'll get a confirmation message with the details.`
      : "Done, I've noted the new timing. You'll get a confirmation message with the details.";
  }
  return when
    ? `Great, your visit is confirmed ${when}. Our team will be there to receive you.`
    : 'Great, your visit is confirmed. Our team will be there to receive you.';
}

export function sanitizeForSpeech(text) {
  if (!text) return '';
  
  return expandAbbreviations(text)
    .replace(/[^\w\s,.!?'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default {
  numberToWords,
  formatCurrency,
  speakDate,
  speakTime,
  normalizeMeetingDetails,
  normalizePropertyBrief,
  normalizeMeetingUpdate,
  normalizePropertyList,
  normalizePropertyDetails,
  normalizeSiteVisitConfirmation,
  normalizeNoResults,
  normalizeAPIError,
  normalizeFAQResponse,
  sanitizeForSpeech,
};
