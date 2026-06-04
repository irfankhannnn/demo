/**
 * Realistic seed data for Playwright tests
 * Uses Indian names, realistic phone numbers, and proper addresses
 * Expanded to large pools to minimize duplicate entries across runs.
 */

/* ------------------------------------------------------------------
 * Large first-name / last-name pools (50+ each) so composite names
 * have 2 500+ combinations — collisions are extremely unlikely.
 * ------------------------------------------------------------------ */
const FIRST_NAMES = [
  'Rajesh','Priya','Amit','Sneha','Vikram','Anita','Rahul','Pooja','Sanjay','Neha',
  'Arjun','Kavya','Deepak','Divya','Karthik','Lakshmi','Ravi','Meera','Suresh','Anjali',
  'Siddharth','Riya','Aditya','Ishita','Vishal','Tanvi','Rohan','Sakshi','Aarav','Diya',
  'Nikhil','Swati','Manish','Geeta','Alok','Preeti','Rohit','Shalini','Vivek','Jyoti',
  'Gaurav','Sunita','Harish','Monica','Kiran','Fatima','Imran','Nisha','Yusuf','Leela',
  'Ashok','Bharat','Chetan','Devika','Ekta','Farhan','Gopal','Hemant','Indira','Jatin',
  'Kabir','Lalita','Mohan','Nandini','Om','Prakash','Qadir','Ramesh','Shankar','Tara',
  'Umesh','Varsha','Waseem','Xavier','Zara','Bhavna','Chirag','Dinesh','Eshaan','Faisal',
  'Gautam','Harsha','Irfan','Jagdish','Kamal','Lavanya','Madhu','Naveen','Omkar','Pankaj',
] as const;

const LAST_NAMES = [
  'Kumar','Sharma','Patel','Reddy','Singh','Desai','Mehta','Verma','Kapoor','Gupta',
  'Menon','Nair','Iyer','Krishnan','Subramanian','Venkat','Chandran','Sundaram','Balakrishnan','Raghavan',
  'Joshi','Pillai','Kulkarni','Jadhav','Patil','Kale','Gokhale','Thakur','Chopra','Mishra',
  'Banerjee','Ghosh','Dutta','Chatterjee','Bose','Agarwal','Bhatia','Chauhan','Dubey','Goyal',
  'Jain','Kaur','Lamba','Malhotra','Narang','Oberoi','Pandey','Rao','Sethi','Tiwari',
  'Upadhyay','Vohra','Yadav','Acharya','Bajaj','Chawla','Dhar','Grover','Hegde','Iyengar',
  'Jha','Khanna','Lohia','Mukherjee','Nambiar','Parekh','Qureshi','Rastogi','Sarin','Talwar',
  'Unnikrishnan','Vasudev','Wadhwa','Xalxo','Zachariah','Bedi','Chadha','Dwivedi','Eswaran','Fernandes',
  'Ganguly','Haldar','Inamdar','Jindal','Kohli','Luthra','Mahajan','Nigam','Ojha','Prasad',
] as const;

/* ------------------------------------------------------------------
 * Property title prefixes / suffixes — generates thousands of combos
 * ------------------------------------------------------------------ */
const PROP_PREFIXES = [
  'Sunrise','Green Valley','Lake View','Metro Prime','Garden','City Center','Palm Grove',
  'Hillside','Riverside','Skyline','Ocean','Emerald','Golden','Silver','Royal','Diamond',
  'Pearl','Paradise','Grand','Supreme','Elite','Prestige','Signature','Heritage','Maple',
  'Cedar','Willow','Pine','Oak','Birch','Saffron','Ivory','Coral','Sapphire','Ruby',
  'Opal','Topaz','Amber','Crystal','Azure','Serene','Tranquil','Harmony','Bliss','Zen',
  'Aura','Nova','Vista','Horizon','Pinnacle','Summit','Crest','Apex','Zenith','Solace',
  'Elysian','Utopia','Nirvana','Eden','Oasis','Haven','Retreat','Sanctuary','Refuge','Arcadia',
] as const;

const PROP_SUFFIXES = [
  'Heights','Residency','Villa','Towers','Enclave','Flats','Society','Apartments','Greens','View',
  'Complex','Estate','Plaza','Park','Gardens','Meadows','Grove','Court','Terrace','Arcade',
  'Mansion','Palace','Haven','Oasis','Hub','Point','Walk','Boulevard','Avenue','Lane',
  'Court','Square','Quarters','Dwellings','Habitat','Abode','Nest','Corner','Crest','Ridge',
  'Vale','Glade','Hollow','Point','Shores','Bay','Harbour','Quay','Docks','Landing',
] as const;

const PROP_AREAS = [
  'Andheri West','Bandra East','Powai','Juhu','Malad West','Borivali East','Thane West','Dadar','Worli','Chembur',
  'Andheri East','Bandra West','Khar','Santacruz','Vile Parle','Goregaon','Kandivali','Bhandup','Vikhroli','Kanakia',
  'Kurla','Sion','Matunga','Mahim','Prabhadevi','Lower Parel','Parel','Byculla','Colaba','Churchgate',
  'Marine Lines','Grant Road','Mumbai Central','Dadar East','Dadar West','Wadala','Sewri','Trombay','Deonar','Govandi',
  'Mankhurd','Kanjurmarg','Bhandup West','Mulund','Nahur','Airoli','Rabale','Ghansoli','Koparkhairane','Vashi',
  'Nerul','Sanpada','Turbhe','Juinagar','Seawoods','Kharghar','Kamothe','Kalamboli','Panvel','New Panvel',
  'Ulwe','Roadpali','Taloja','Navi Mumbai','Kalamboli','Uran','Karjat','Khopoli','Neral','Matheran',
] as const;

const PROP_CITIES = [
  'Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai',
  'Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai','Mumbai',
  'Thane','Thane','Thane','Thane','Thane','Navi Mumbai','Navi Mumbai','Navi Mumbai','Navi Mumbai','Navi Mumbai',
  'Pune','Pune','Pune','Pune','Pune','Bangalore','Bangalore','Bangalore','Delhi','Delhi',
] as const;

const BUILDINGS = [
  'Omkar Alta Monte','Lodha World Towers','Godrej Properties','Piramal Realty','Raheja Universal',
  'Hiranandani Developers','Godrej Infinity','Kalyani Developers','Rustomjee','Amit Enterprises',
  'Tata Housing','Shapoorji Pallonji','Kalpataru Group','Mahindra Lifespaces','Brigade Group',
  'Sobha Limited','Prestige Group','Puravankara','DLF Homes','Indiabulls Real Estate',
  'Peninsula Land','Nirmal Lifestyle','Runwal Group','Ace Group','Sunteck Realty',
  'Kanakia Spaces','Gundecha Builders','Supreme Universal','Chandak Group','Hubtown',
  'Wadhwa Group','Neumec','Rajesh Lifespaces','Rohan Builders','Nahar Group',
  'Sheth Creators','Viniar Constructions','G Corp','Bhumiraj Homes','Unimark Group',
  'Siddha Group','Vascon Engineers','Gera Developments','Mantri Developers','Salarpuria Sattva',
  'Embassy Group','RMZ Corp','DivyaSree','Phoenix Mills','L&T Realty',
] as const;

const REQUIREMENT_SNIPPETS = [
  'with parking near metro station','sea-facing apartment','villa with garden and pool',
  'studio for investment purpose','in gated community with gym','with modern amenities and lift',
  'for joint family with servant quarter','corner flat with extra ventilation','penthouse with terrace garden',
  'ground floor for senior citizens','duplex with private entrance','furnished and ready to move',
  'unfurnished for personal customization','new construction under RERA','resale in established society',
  'with power backup and water purifier','near school and hospital','close to highway and airport',
  'low maintenance and high rental yield','spacious balcony and modular kitchen',
] as const;

const PREFERRED_AREAS = [
  'Andheri West','Bandra West','Juhu','Malad West','Powai','Andheri East','Bandra Kurla Complex',
  'Thane West','Dadar','Worli','Chembur','Khar','Santacruz','Goregaon','Kandivali',
  'Bhandup','Vikhroli','Kurla','Sion','Matunga','Mahim','Prabhadevi','Lower Parel',
  'Colaba','Churchgate','Marine Lines','Borivali West','Borivali East','Mulund','Nerul',
  'Vashi','Kharghar','Panvel','Pune Camp','Koregaon Park','Kalyani Nagar','Viman Nagar',
  'Whitefield','Koramangala','Indiranagar','MG Road','Connaught Place','Dwarka','Janakpuri',
] as const;

const TIMELINES = [
  'Immediate','Within 1 month','Within 2 months','Within 3 months','Within 4 months',
  'Within 6 months','Within 1 year','Flexible','After possession','End of financial year',
] as const;

const SOURCES = [
  'Website','Referral','Walk-in','Social Media','Justdial','MagicBricks','99acres',
  'Housing.com','Facebook','WhatsApp','Instagram','LinkedIn','Google Ads','Newspaper',
  'Billboard','Radio','TV Commercial','Email Campaign','SMS Campaign','Broker Network',
] as const;

const STATUSES = ['new','contacted','qualified','negotiating','lost'] as const;
const PRIORITIES = ['low','medium','high'] as const;
const PROP_TYPES = ['apartment','villa','house','studio','penthouse','duplex'] as const;
const BHK_OPTS = [1,2,3,4,5] as const;

/* ------------------------------------------------------------------
 * Deterministic pseudo-random helpers (seeded) so we can repeatably
 * pick items when given a run stamp, while still covering the pool.
 * ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandomInt(seed: number, min: number, maxExclusive: number): number {
  const rng = mulberry32(seed);
  return min + Math.floor(rng() * (maxExclusive - min));
}

/* ------------------------------------------------------------------
 * Public API — expanded seed data + generators
 * ------------------------------------------------------------------ */

export const SEED_DATA = {
  /** 50 first names × 50 last names = 2 500 unique full-name combos */
  firstNames: [...FIRST_NAMES],
  lastNames: [...LAST_NAMES],

  /** 80 prefixes × 50 suffixes = 4 000 unique property title combos */
  propPrefixes: [...PROP_PREFIXES],
  propSuffixes: [...PROP_SUFFIXES],

  /** 80 Mumbai/Pune/Delhi/etc. areas */
  areas: [...PROP_AREAS],

  /** 40 cities (mostly Mumbai + Thane + Navi Mumbai + Pune + Bangalore + Delhi) */
  cities: [...PROP_CITIES],

  /** 50 well-known developers / building names */
  buildings: [...BUILDINGS],

  /** 20 requirement text snippets */
  requirementSnippets: [...REQUIREMENT_SNIPPETS],

  /** 47 preferred-area strings */
  preferredAreas: [...PREFERRED_AREAS],

  /** 10 timelines */
  timelines: [...TIMELINES],

  /** 20 lead sources */
  sources: [...SOURCES],

  /** 5 statuses */
  statuses: [...STATUSES],

  /** 3 priorities */
  priorities: [...PRIORITIES],

  /** 6 property types */
  propertyTypes: [...PROP_TYPES],

  /** BHK options */
  bhkOptions: [...BHK_OPTS],

  /* Legacy accessors for backward compat with existing flows */
  get owners() {
    return FIRST_NAMES.slice(0, 10).map((f, i) => ({
      firstName: f,
      lastName: LAST_NAMES[i % LAST_NAMES.length],
    }));
  },
  get buyers() {
    return FIRST_NAMES.slice(10, 20).map((f, i) => ({
      firstName: f,
      lastName: LAST_NAMES[(i + 5) % LAST_NAMES.length],
    }));
  },
  get tenants() {
    return FIRST_NAMES.slice(20, 30).map((f, i) => ({
      firstName: f,
      lastName: LAST_NAMES[(i + 10) % LAST_NAMES.length],
    }));
  },
  get properties() {
    return {
      titles: PROP_PREFIXES.slice(0, 10).map((p, i) => `${p} ${PROP_SUFFIXES[i % PROP_SUFFIXES.length]}`),
      areas: PROP_AREAS.slice(0, 10),
      cities: PROP_CITIES.slice(0, 10),
      types: ['apartment','apartment','villa','apartment','apartment','apartment','apartment','villa','apartment','apartment'],
      bhk: [2,3,4,2,3,2,3,4,2,3],
    };
  },
  get propertyDetails() {
    return { buildings: BUILDINGS.slice(0, 10) };
  },
  get leadRequirements() {
    return {
      buyer: [
        { requirement: '3BHK with parking near metro station', budget: 15000000, preferredArea: 'Andheri West' },
        { requirement: '2BHK sea-facing apartment', budget: 12000000, preferredArea: 'Bandra West' },
        { requirement: '4BHK villa with garden', budget: 25000000, preferredArea: 'Juhu' },
        { requirement: '1BHK studio for investment', budget: 8000000, preferredArea: 'Malad West' },
        { requirement: '3BHK in gated community', budget: 18000000, preferredArea: 'Powai' },
      ],
      tenant: [
        { requirement: '2BHK near office with parking', budget: 65000, preferredArea: 'Andheri East' },
        { requirement: '1BHK near metro', budget: 35000, preferredArea: 'Bandra Kurla Complex' },
        { requirement: '3BHK for family with amenities', budget: 85000, preferredArea: 'Powai' },
        { requirement: 'Studio apartment near IT park', budget: 25000, preferredArea: 'Malad West' },
        { requirement: '2BHK with balcony', budget: 55000, preferredArea: 'Thane West' },
      ],
      seller: [
        { propertyType: 'apartment', area: 'Bandra West', expectedPrice: 18000000, timeline: 'Within 2 months' },
        { propertyType: 'villa', area: 'Juhu', expectedPrice: 35000000, timeline: 'Within 3 months' },
        { propertyType: 'apartment', area: 'Andheri East', expectedPrice: 12000000, timeline: 'Immediate' },
        { propertyType: 'house', area: 'Powai', expectedPrice: 22000000, timeline: 'Within 6 months' },
        { propertyType: 'apartment', area: 'Malad West', expectedPrice: 9500000, timeline: 'Within 4 months' },
      ],
      owner: [
        { propertyType: 'apartment', area: 'Andheri West', rentExpected: 65000 },
        { propertyType: 'apartment', area: 'Bandra East', rentExpected: 85000 },
        { propertyType: 'villa', area: 'Juhu', rentExpected: 250000 },
        { propertyType: 'apartment', area: 'Powai', rentExpected: 55000 },
        { propertyType: 'apartment', area: 'Malad West', rentExpected: 45000 },
      ],
    };
  },
} as const;

/* ------------------------------------------------------------------
 * Generators
 * ------------------------------------------------------------------ */

/**
 * Generate a unique full name using seeded randomness + run stamp.
 * With 50×50=2 500 base combos and a run stamp, collisions are negligible.
 */
export function generateUniqueName(runStamp: string, offset = 0): { firstName: string; lastName: string; fullName: string } {
  const seed = hashString(runStamp) + offset;
  const fi = seededRandomInt(seed, 0, FIRST_NAMES.length);
  const li = seededRandomInt(seed + 1, 0, LAST_NAMES.length);
  const firstName = FIRST_NAMES[fi];
  const lastName = LAST_NAMES[li];
  return { firstName, lastName, fullName: `${firstName} ${lastName}` };
}

/**
 * Generate a unique property title.
 * 80 prefixes × 50 suffixes = 4 000 base combos; run stamp makes it unique.
 */
export function generateUniquePropertyTitle(runStamp: string, offset = 0): string {
  const seed = hashString(runStamp) + offset;
  const pi = seededRandomInt(seed, 0, PROP_PREFIXES.length);
  const si = seededRandomInt(seed + 1, 0, PROP_SUFFIXES.length);
  return `${PROP_PREFIXES[pi]} ${PROP_SUFFIXES[si]}`;
}

/**
 * Generate a unique area + city combo.
 */
export function generateUniqueLocation(runStamp: string, offset = 0): { area: string; city: string } {
  const seed = hashString(runStamp) + offset;
  const ai = seededRandomInt(seed, 0, PROP_AREAS.length);
  const ci = seededRandomInt(seed + 1, 0, PROP_CITIES.length);
  return { area: PROP_AREAS[ai], city: PROP_CITIES[ci] };
}

/**
 * Pick a random building name.
 */
export function generateUniqueBuilding(runStamp: string, offset = 0): string {
  const seed = hashString(runStamp) + offset;
  return BUILDINGS[seededRandomInt(seed, 0, BUILDINGS.length)];
}

/**
 * Generate a random requirement description.
 */
export function generateRequirement(runStamp: string, offset = 0, bhk = 2): string {
  const seed = hashString(runStamp) + offset;
  const snippet = REQUIREMENT_SNIPPETS[seededRandomInt(seed, 0, REQUIREMENT_SNIPPETS.length)];
  return `${bhk}BHK ${snippet}`;
}

/**
 * Generate a lead requirement object for a given type.
 */
export function generateLeadRequirement(
  runStamp: string,
  type: 'buyer' | 'tenant' | 'seller' | 'owner',
  offset = 0,
) {
  const seed = hashString(runStamp) + offset;
  const area = PREFERRED_AREAS[seededRandomInt(seed, 0, PREFERRED_AREAS.length)];
  const propType = PROP_TYPES[seededRandomInt(seed + 1, 0, PROP_TYPES.length)];
  const bhk = BHK_OPTS[seededRandomInt(seed + 2, 0, BHK_OPTS.length)];

  if (type === 'buyer') {
    const budget = seededRandomInt(seed + 3, 50, 300) * 100000;
    const moveIn = new Date();
    moveIn.setDate(moveIn.getDate() + seededRandomInt(seed + 4, 7, 90));
    return {
      requirement: generateRequirement(runStamp, offset, bhk),
      budget,
      preferredArea: area,
      propertyType: propType,
      bhk,
      address: `${area}, ${PROP_CITIES[seededRandomInt(seed + 5, 0, PROP_CITIES.length)]}`,
      moveInDate: moveIn.toISOString().split('T')[0],
    };
  }
  if (type === 'tenant') {
    const budget = seededRandomInt(seed + 3, 15, 150) * 1000;
    const moveIn = new Date();
    moveIn.setDate(moveIn.getDate() + seededRandomInt(seed + 4, 7, 90));
    return {
      requirement: generateRequirement(runStamp, offset, bhk),
      budget,
      preferredArea: area,
      moveInDate: moveIn.toISOString().split('T')[0],
      propertyType: propType,
      bhk,
      address: `${area}, ${PROP_CITIES[seededRandomInt(seed + 5, 0, PROP_CITIES.length)]}`,
    };
  }
  if (type === 'seller') {
    const expectedPrice = seededRandomInt(seed + 3, 80, 400) * 100000;
    const timeline = TIMELINES[seededRandomInt(seed + 4, 0, TIMELINES.length)];
    const building = BUILDINGS[seededRandomInt(seed + 5, 0, BUILDINGS.length)];
    const flatNo = String(seededRandomInt(seed + 6, 101, 999));
    const floorNo = String(seededRandomInt(seed + 7, 1, 20)) + (seededRandomInt(seed + 7, 1, 20) === 1 ? 'st' : 'th');
    const city = PROP_CITIES[seededRandomInt(seed + 8, 0, PROP_CITIES.length)];
    const carpet = seededRandomInt(seed + 9, 500, 2500);
    const furnish = ['furnished', 'semi-furnished', 'unfurnished'][seededRandomInt(seed + 10, 0, 3)];
    return { propertyType: propType, area, expectedPrice, timeline, buildingName: building, flatNumber: flatNo, floor: floorNo, city, carpetArea: carpet, furnishing: furnish, bhk, address: `${building}, ${area}, ${city}` };
  }
  // owner
  const rentExpected = seededRandomInt(seed + 3, 20, 300) * 1000;
  const building = BUILDINGS[seededRandomInt(seed + 4, 0, BUILDINGS.length)];
  const flatNo = String(seededRandomInt(seed + 5, 101, 999));
  const floorNo = String(seededRandomInt(seed + 6, 1, 20)) + (seededRandomInt(seed + 6, 1, 20) === 1 ? 'st' : 'th');
  const city = PROP_CITIES[seededRandomInt(seed + 7, 0, PROP_CITIES.length)];
  const carpet = seededRandomInt(seed + 8, 500, 2500);
  const furnish = ['furnished', 'semi-furnished', 'unfurnished'][seededRandomInt(seed + 9, 0, 3)];
  const securityDeposit = seededRandomInt(seed + 10, 1, 6) * 100000;
  return { propertyType: propType, area, rentExpected, buildingName: building, flatNumber: flatNo, floor: floorNo, city, carpetArea: carpet, furnishing: furnish, bhk, address: `${building}, ${area}, ${city}`, securityDeposit };
}

/**
 * Hash a string to a 32-bit integer seed.
 */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Generate a unique phone number for testing
 * Uses 7000xxxxxx format (Indian mobile number range)
 */
export function generateTestPhone(offset: number, base: number = 7000000000): string {
  return String(base + offset);
}

/**
 * Generate a unique email for testing.
 * Adds a short random token so even identical prefixes stay unique.
 */
export function generateTestEmail(prefix: string, offset: number, suffix: string = 'test.com'): string {
  const token = Math.random().toString(36).slice(2, 6);
  return `${prefix}.${offset}.${token}@${suffix}`.toLowerCase();
}

/**
 * Get a random item from an array
 */
export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a random item from array by index
 */
export function getItemByIndex<T>(array: T[], index: number): T {
  return array[index % array.length];
}
