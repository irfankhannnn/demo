/**
 * Realistic seed data for Playwright tests
 * Uses Indian names, realistic phone numbers, and proper addresses
 * Expanded to large pools to minimize duplicate entries across runs.
 */

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
const PROP_TYPES = ['apartment','villa','house','office'] as const;
const BHK_OPTS = [1,2,3,4,5] as const;
const FURNISHING_OPTS = ['furnished','semi-furnished','unfurnished'] as const;
const AMENITIES_POOL = [
  'Gym','Swimming Pool','Parking','Lift','Power Backup','Water Purifier','Security','CCTV',
  'Modular Kitchen','Balcony','Terrace','Garden','Playground','Community Hall','Clubhouse',
  'Intercom','Visitor Parking','EV Charging','Solar Panel','Rainwater Harvesting',
] as const;

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

export const SEED_DATA = {
  firstNames: [...FIRST_NAMES],
  lastNames: [...LAST_NAMES],
  propPrefixes: [...PROP_PREFIXES],
  propSuffixes: [...PROP_SUFFIXES],
  propAreas: [...PROP_AREAS],
  propCities: [...PROP_CITIES],
  buildings: [...BUILDINGS],
  requirementSnippets: [...REQUIREMENT_SNIPPETS],
  preferredAreas: [...PREFERRED_AREAS],
  timelines: [...TIMELINES],
  sources: [...SOURCES],
  statuses: [...STATUSES],
  priorities: [...PRIORITIES],
  propTypes: [...PROP_TYPES],
  bhkOpts: [...BHK_OPTS],
  furnishingOpts: [...FURNISHING_OPTS],
  amenitiesPool: [...AMENITIES_POOL],
};

export function getItemByIndex<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length];
}

export function generateUniqueName(runStamp: string, offset: number) {
  const seed = runStamp.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + offset * 7919;
  const firstName = getItemByIndex(SEED_DATA.firstNames, seededRandomInt(seed, 0, SEED_DATA.firstNames.length));
  const lastName = getItemByIndex(SEED_DATA.lastNames, seededRandomInt(seed + 1, 0, SEED_DATA.lastNames.length));
  const fullName = `${firstName} ${lastName}`;
  return { firstName, lastName, fullName };
}

export function generateTestPhone(offset: number, phoneBase: number) {
  const phone = String(phoneBase + offset).padStart(10, '0');
  return phone;
}

export function generateTestEmail(firstName: string, offset: number, domain = 'test.com') {
  return `${firstName}.${offset}.${Date.now()}@${domain}`;
}

export function generateUniquePropertyTitle(runStamp: string, offset: number) {
  const seed = runStamp.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + offset * 7919;
  const prefix = getItemByIndex(SEED_DATA.propPrefixes, seededRandomInt(seed, 0, SEED_DATA.propPrefixes.length));
  const suffix = getItemByIndex(SEED_DATA.propSuffixes, seededRandomInt(seed + 1, 0, SEED_DATA.propSuffixes.length));
  return `${prefix} ${suffix}`;
}

export function generateUniqueLocation(runStamp: string, offset: number) {
  const seed = runStamp.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + offset * 7919;
  const area = getItemByIndex(SEED_DATA.propAreas, seededRandomInt(seed, 0, SEED_DATA.propAreas.length));
  const city = getItemByIndex(SEED_DATA.propCities, seededRandomInt(seed + 1, 0, SEED_DATA.propCities.length));
  return { area, city };
}

function selectAmenities(seed: number, count: number = 3): string[] {
  const amenities: string[] = [];
  for (let i = 0; i < count && i < AMENITIES_POOL.length; i++) {
    amenities.push(getItemByIndex(SEED_DATA.amenitiesPool, seededRandomInt(seed + i, 0, SEED_DATA.amenitiesPool.length)));
  }
  return [...new Set(amenities)]; // Remove duplicates
}

export function generateLeadRequirement(runStamp: string, leadType: string, offset: number) {
  const seed = runStamp.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + offset * 7919;
  const area = getItemByIndex(SEED_DATA.preferredAreas, seededRandomInt(seed, 0, SEED_DATA.preferredAreas.length));
  const propType = getItemByIndex(SEED_DATA.propTypes, seededRandomInt(seed + 1, 0, SEED_DATA.propTypes.length));
  const bhk = getItemByIndex(SEED_DATA.bhkOpts, seededRandomInt(seed + 2, 0, SEED_DATA.bhkOpts.length));
  const snippet = getItemByIndex(SEED_DATA.requirementSnippets, seededRandomInt(seed + 3, 0, SEED_DATA.requirementSnippets.length));
  const budget = seededRandomInt(seed + 4, 25, 300) * 100_000;
  const timeline = getItemByIndex(SEED_DATA.timelines, seededRandomInt(seed + 5, 0, SEED_DATA.timelines.length));
  const furnishing = getItemByIndex(SEED_DATA.furnishingOpts, seededRandomInt(seed + 22, 0, SEED_DATA.furnishingOpts.length));
  const amenities = selectAmenities(seed + 23, 3);

  if (leadType === 'buyer') {
    return {
      requirement: `Looking for a ${bhk}BHK ${propType} ${snippet}`,
      budget,
      preferredArea: area,
      propertyType: propType,
      bhk,
      address: `${area}, ${getItemByIndex(SEED_DATA.propCities, seededRandomInt(seed + 6, 0, SEED_DATA.propCities.length))}`,
      moveInDate: new Date(Date.now() + seededRandomInt(seed + 7, 30, 180) * 86400000).toISOString().split('T')[0],
      timeline,
      furnishing,
      amenities,
    };
  }
  if (leadType === 'seller') {
    return {
      propertyType: propType,
      area,
      expectedPrice: budget,
      timeline,
      buildingName: getItemByIndex(SEED_DATA.buildings, seededRandomInt(seed + 8, 0, SEED_DATA.buildings.length)),
      flatNumber: `${seededRandomInt(seed + 9, 1, 20)}${String.fromCharCode(65 + (seed % 4))}`,
      floor: String(seededRandomInt(seed + 10, 1, 25)),
      city: getItemByIndex(SEED_DATA.propCities, seededRandomInt(seed + 11, 0, SEED_DATA.propCities.length)),
      carpetArea: seededRandomInt(seed + 12, 500, 2500),
      furnishing,
      bhk,
      address: `${area}, ${getItemByIndex(SEED_DATA.propCities, seededRandomInt(seed + 13, 0, SEED_DATA.propCities.length))}`,
      amenities,
      description: `Well-maintained ${bhk}BHK ${propType} in ${area}. Ready for immediate possession. ${snippet}`,
    };
  }
  if (leadType === 'tenant') {
    return {
      requirement: `Need a ${bhk}BHK ${propType} for rent ${snippet}`,
      budget: Math.floor(budget * 0.02),
      preferredArea: area,
      moveInDate: new Date(Date.now() + seededRandomInt(seed + 14, 7, 60) * 86400000).toISOString().split('T')[0],
      propertyType: propType,
      bhk,
      address: `${area}, ${getItemByIndex(SEED_DATA.propCities, seededRandomInt(seed + 15, 0, SEED_DATA.propCities.length))}`,
      furnishing,
      amenities,
    };
  }
  if (leadType === 'owner') {
    return {
      propertyType: propType,
      area,
      rentExpected: Math.floor(budget * 0.025),
      buildingName: getItemByIndex(SEED_DATA.buildings, seededRandomInt(seed + 16, 0, SEED_DATA.buildings.length)),
      flatNumber: `${seededRandomInt(seed + 17, 1, 20)}${String.fromCharCode(65 + (seed % 4))}`,
      floor: String(seededRandomInt(seed + 18, 1, 25)),
      city: getItemByIndex(SEED_DATA.propCities, seededRandomInt(seed + 19, 0, SEED_DATA.propCities.length)),
      carpetArea: seededRandomInt(seed + 20, 400, 3000),
      furnishing,
      bhk,
      address: `${area}, ${getItemByIndex(SEED_DATA.propCities, seededRandomInt(seed + 21, 0, SEED_DATA.propCities.length))}`,
      securityDeposit: Math.floor(budget * 0.05),
      amenities,
      description: `Premium ${bhk}BHK ${propType} available for rent in ${area}. Excellent rental yield. ${snippet}`,
    };
  }
  return {};
}
