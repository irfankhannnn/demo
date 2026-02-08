// Response Normalizer - Converts API/DB data to natural conversational text

const numberWords = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four',
  5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
  10: 'ten', 11: 'eleven', 12: 'twelve',
};

function numberToWords(num) {
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

function formatCurrency(amount) {
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

export function sanitizeForSpeech(text) {
  if (!text) return '';
  
  return expandAbbreviations(text)
    .replace(/[^\w\s,.!?'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default {
  normalizePropertyList,
  normalizePropertyDetails,
  normalizeSiteVisitConfirmation,
  normalizeNoResults,
  normalizeAPIError,
  normalizeFAQResponse,
  sanitizeForSpeech,
};
