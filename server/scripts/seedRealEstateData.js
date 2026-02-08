/**
 * Seed Script for Real Estate Data (Developers, Areas, Projects)
 * Creates sample data for India (Mumbai) and Dubai (UAE)
 * 
 * Usage: node scripts/seedRealEstateData.js <tenantId>
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { createDeveloper, getDevelopers } from '../developersDynamodbService.js';
import { createArea, getAreas } from '../realEstateAreasDynamodbService.js';
import { createProject, getProjects } from '../projectsDynamodbService.js';

const TENANT_ID = process.argv[2] || 'demo-tenant';

console.log(`\n🏗️  Seeding Real Estate Data for Tenant: ${TENANT_ID}\n`);

// ============== DEVELOPERS DATA ==============

const developersData = [
  // India Developers
  {
    name: 'Lodha Group',
    slug: 'lodha-group',
    description: 'Lodha Group is one of India\'s largest real estate developers known for luxury residential and commercial projects.',
    aboutText: 'Founded in 1980, Lodha Group has delivered over 30,000 homes and 40+ million sq.ft. of commercial space across Mumbai, Pune, London, and other major cities.',
    headquarters: 'Mumbai, Maharashtra',
    establishedYear: 1980,
    companyType: 'Private',
    website: 'https://www.lodhagroup.in',
    reraRegistrationNumber: 'P51900012345',
    reraState: 'Maharashtra',
    keyFeatures: ['Luxury Homes', 'Green Buildings', 'World-class Amenities', 'Prime Locations'],
    specializations: ['residential', 'commercial'],
    totalUnitsDelivered: 30000,
    featured: true,
    verified: true,
    status: 'active',
    visibility: 'public',
    displayOrder: 1,
  },
  {
    name: 'Godrej Properties',
    slug: 'godrej-properties',
    description: 'Godrej Properties is a leading real estate developer with a legacy of over 125 years in business excellence.',
    aboutText: 'Part of the Godrej Group, Godrej Properties delivers residential, commercial, and township projects across India with a focus on sustainability and innovation.',
    headquarters: 'Mumbai, Maharashtra',
    establishedYear: 1990,
    companyType: 'Public',
    website: 'https://www.godrejproperties.com',
    reraRegistrationNumber: 'P51900023456',
    reraState: 'Maharashtra',
    keyFeatures: ['Sustainable Development', 'Trust of 125+ Years', 'Pan-India Presence', 'Innovative Designs'],
    specializations: ['residential', 'commercial', 'mixed-use'],
    totalUnitsDelivered: 25000,
    featured: true,
    verified: true,
    status: 'active',
    visibility: 'public',
    displayOrder: 2,
  },
  {
    name: 'Tata Housing',
    slug: 'tata-housing',
    description: 'Tata Housing is a closely held public limited company and a subsidiary of Tata Sons Limited.',
    aboutText: 'Tata Housing has been a pioneer in the real estate industry, focusing on affordable housing, premium housing, and commercial spaces.',
    headquarters: 'Mumbai, Maharashtra',
    establishedYear: 1984,
    companyType: 'Private',
    website: 'https://www.tatahousing.in',
    reraRegistrationNumber: 'P51900034567',
    reraState: 'Maharashtra',
    keyFeatures: ['Tata Trust', 'Quality Construction', 'Timely Delivery', 'Customer-centric'],
    specializations: ['residential', 'commercial'],
    totalUnitsDelivered: 20000,
    featured: true,
    verified: true,
    status: 'active',
    visibility: 'public',
    displayOrder: 3,
  },
  // Dubai Developers
  {
    name: 'Emaar Properties',
    slug: 'emaar-properties',
    description: 'Emaar Properties is a global leader in real estate development and has developed iconic landmarks including Burj Khalifa.',
    aboutText: 'Emaar Properties has a proven track record of delivering world-class residential, retail, hospitality, and leisure assets across the UAE and internationally.',
    headquarters: 'Dubai, UAE',
    establishedYear: 1997,
    companyType: 'Public',
    website: 'https://www.emaar.com',
    dedLicenseNumber: 'DED123456',
    tradeLicenseNumber: 'TL987654',
    keyFeatures: ['Iconic Developments', 'Global Presence', 'Award-winning', 'Master-planned Communities'],
    specializations: ['residential', 'commercial', 'mixed-use'],
    totalUnitsDelivered: 80000,
    featured: true,
    verified: true,
    status: 'active',
    visibility: 'public',
    displayOrder: 1,
  },
  {
    name: 'DAMAC Properties',
    slug: 'damac-properties',
    description: 'DAMAC Properties is one of the leading luxury real estate developers in the Middle East.',
    aboutText: 'Since 2002, DAMAC has delivered over 40,000 homes and has a development portfolio of over 30,000 units at various stages of progress.',
    headquarters: 'Dubai, UAE',
    establishedYear: 2002,
    companyType: 'Public',
    website: 'https://www.damacproperties.com',
    dedLicenseNumber: 'DED234567',
    tradeLicenseNumber: 'TL876543',
    keyFeatures: ['Luxury Living', 'Branded Residences', 'Premium Locations', 'International Standards'],
    specializations: ['residential', 'commercial'],
    totalUnitsDelivered: 40000,
    featured: true,
    verified: true,
    status: 'active',
    visibility: 'public',
    displayOrder: 2,
  },
  {
    name: 'Sobha Realty',
    slug: 'sobha-realty',
    description: 'Sobha Realty is a premier luxury real estate developer known for its world-class craftsmanship.',
    aboutText: 'Sobha Realty operates with a unique backward integration model, ensuring complete control over quality from design to delivery.',
    headquarters: 'Dubai, UAE',
    establishedYear: 1976,
    companyType: 'Private',
    website: 'https://www.sobharealty.com',
    dedLicenseNumber: 'DED345678',
    tradeLicenseNumber: 'TL765432',
    keyFeatures: ['Backward Integration', 'Premium Quality', 'Luxury Villas', 'Green Communities'],
    specializations: ['residential'],
    totalUnitsDelivered: 15000,
    featured: true,
    verified: true,
    status: 'active',
    visibility: 'public',
    displayOrder: 3,
  },
  {
    name: 'DIFC Developments',
    slug: 'difc-developments',
    description: 'DIFC Developments is the property development arm of Dubai International Financial Centre.',
    aboutText: 'DIFC Developments focuses on premium residential and commercial properties within the DIFC district, catering to global finance professionals.',
    headquarters: 'Dubai, UAE',
    establishedYear: 2004,
    companyType: 'Government',
    website: 'https://www.difc.ae',
    dedLicenseNumber: 'DED456789',
    tradeLicenseNumber: 'TL654321',
    keyFeatures: ['Prime Location', 'Financial Hub', 'Premium Finishes', 'Smart Technology'],
    specializations: ['residential', 'commercial'],
    totalUnitsDelivered: 5000,
    featured: true,
    verified: true,
    status: 'active',
    visibility: 'public',
    displayOrder: 4,
  },
];

// ============== AREAS DATA ==============

const areasData = [
  // Mumbai Areas
  {
    name: 'Worli',
    slug: 'worli-mumbai',
    city: 'Mumbai',
    country: 'India',
    state: 'Maharashtra',
    pincode: '400018',
    description: 'Worli is one of Mumbai\'s most prestigious neighborhoods, known for its sea-facing residences and corporate offices.',
    overviewText: 'Worli offers a perfect blend of residential luxury and commercial connectivity, with the iconic Bandra-Worli Sea Link providing quick access to the western suburbs.',
    tagline: 'Mumbai\'s Premium Sea-Facing Address',
    amenities: ['Sea View', 'Metro Connectivity', 'Premium Malls', 'Business Districts', 'Hospitals', 'Schools'],
    propertyTypes: ['apartment', 'penthouse', 'office'],
    accessibility: {
      nearestMetro: 'Worli Metro Station',
      metroDistanceKm: 0.5,
      nearestMall: 'Atria Mall',
      mallDistanceKm: 2,
      airportDistanceKm: 15,
      downtownDistanceKm: 8,
    },
    nearbyLandmarks: [
      { name: 'Bandra-Worli Sea Link', distance: '2 min', type: 'landmark' },
      { name: 'Nehru Planetarium', distance: '5 min', type: 'entertainment' },
      { name: 'Siddhivinayak Temple', distance: '10 min', type: 'landmark' },
    ],
    investmentHighlights: ['High rental yields', 'Premium appreciation', 'Sea-facing premium', 'Corporate demand'],
    featured: true,
    verified: true,
    currency: 'INR',
    status: 'active',
    visibility: 'public',
    displayOrder: 1,
  },
  {
    name: 'Andheri West',
    slug: 'andheri-west-mumbai',
    city: 'Mumbai',
    country: 'India',
    state: 'Maharashtra',
    pincode: '400053',
    description: 'Andheri West is a vibrant commercial and residential hub with excellent connectivity.',
    overviewText: 'Andheri West offers a mix of mid-range to premium housing options, thriving retail spaces, and proximity to the airport and business districts.',
    tagline: 'Mumbai\'s Connectivity Hub',
    amenities: ['Metro Station', 'Railway Station', 'Malls', 'Restaurants', 'IT Parks', 'Schools'],
    propertyTypes: ['apartment', 'studio', 'office'],
    accessibility: {
      nearestMetro: 'Andheri Metro Station',
      metroDistanceKm: 0.3,
      nearestMall: 'Infiniti Mall',
      mallDistanceKm: 1,
      airportDistanceKm: 5,
      downtownDistanceKm: 20,
    },
    nearbyLandmarks: [
      { name: 'Mumbai Airport', distance: '10 min', type: 'transport' },
      { name: 'Lokhandwala Market', distance: '5 min', type: 'retail' },
      { name: 'Versova Beach', distance: '15 min', type: 'entertainment' },
    ],
    investmentHighlights: ['Airport proximity', 'Metro connectivity', 'Rental demand', 'Commercial growth'],
    featured: true,
    verified: true,
    currency: 'INR',
    status: 'active',
    visibility: 'public',
    displayOrder: 2,
  },
  {
    name: 'Powai',
    slug: 'powai-mumbai',
    city: 'Mumbai',
    country: 'India',
    state: 'Maharashtra',
    pincode: '400076',
    description: 'Powai is Mumbai\'s planned township known for its IT parks, lake, and premium residential complexes.',
    overviewText: 'Powai offers a self-contained ecosystem with IT companies, retail, healthcare, and educational institutions, all centered around the scenic Powai Lake.',
    tagline: 'Mumbai\'s IT & Lake Township',
    amenities: ['Powai Lake', 'IT Parks', 'IIT Bombay', 'Hiranandani Complex', 'Malls', 'Hospitals'],
    propertyTypes: ['apartment', 'penthouse', 'villa', 'office'],
    accessibility: {
      nearestMetro: 'Saki Naka Metro',
      metroDistanceKm: 3,
      nearestMall: 'Haiko Mall',
      mallDistanceKm: 1,
      airportDistanceKm: 8,
      downtownDistanceKm: 22,
    },
    nearbyLandmarks: [
      { name: 'Powai Lake', distance: '2 min', type: 'landmark' },
      { name: 'IIT Bombay', distance: '5 min', type: 'education' },
      { name: 'Hiranandani Gardens', distance: '5 min', type: 'landmark' },
    ],
    investmentHighlights: ['IT corridor', 'Lake view premium', 'Educational institutions', 'Self-sufficient township'],
    featured: true,
    verified: true,
    currency: 'INR',
    status: 'active',
    visibility: 'public',
    displayOrder: 3,
  },
  // Dubai Areas
  {
    name: 'DIFC',
    slug: 'difc-dubai',
    city: 'Dubai',
    country: 'UAE',
    emirate: 'Dubai',
    description: 'Dubai International Financial Centre (DIFC) is the leading financial hub in the Middle East, Africa, and South Asia region.',
    overviewText: 'DIFC offers world-class infrastructure, a common-law framework, and a vibrant community for finance professionals and businesses.',
    tagline: 'The Financial Heart of Dubai',
    amenities: ['Gate District', 'Fine Dining', 'Art Galleries', 'Fitness Centers', 'Business Centers'],
    propertyTypes: ['apartment', 'penthouse', 'office'],
    accessibility: {
      nearestMetro: 'DIFC Metro Station',
      metroDistanceKm: 0.2,
      nearestMall: 'Dubai Mall',
      mallDistanceKm: 2,
      airportDistanceKm: 10,
      downtownDistanceKm: 1,
    },
    nearbyLandmarks: [
      { name: 'Burj Khalifa', distance: '5 min', type: 'landmark' },
      { name: 'Dubai Mall', distance: '5 min', type: 'retail' },
      { name: 'Museum of the Future', distance: '5 min', type: 'entertainment' },
    ],
    investmentHighlights: ['Financial hub', 'Premium rental yields', 'Freehold ownership', 'Golden Visa eligible'],
    featured: true,
    verified: true,
    currency: 'AED',
    status: 'active',
    visibility: 'public',
    displayOrder: 1,
  },
  {
    name: 'Dubai Marina',
    slug: 'dubai-marina',
    city: 'Dubai',
    country: 'UAE',
    emirate: 'Dubai',
    description: 'Dubai Marina is a prestigious waterfront community with stunning marina views and vibrant lifestyle.',
    overviewText: 'Dubai Marina features over 200 residential towers, a 7km walkway, and direct beach access, making it one of the most sought-after addresses in Dubai.',
    tagline: 'Waterfront Living at Its Best',
    amenities: ['Marina Walk', 'Beach Access', 'JBR Walk', 'Yacht Club', 'Fine Dining', 'Metro'],
    propertyTypes: ['apartment', 'penthouse', 'studio'],
    accessibility: {
      nearestMetro: 'DMCC Metro Station',
      metroDistanceKm: 0.5,
      nearestMall: 'Marina Mall',
      mallDistanceKm: 0.5,
      airportDistanceKm: 30,
      beachDistanceKm: 0.5,
      downtownDistanceKm: 20,
    },
    nearbyLandmarks: [
      { name: 'JBR Beach', distance: '5 min', type: 'entertainment' },
      { name: 'Ain Dubai', distance: '10 min', type: 'landmark' },
      { name: 'Palm Jumeirah', distance: '15 min', type: 'landmark' },
    ],
    investmentHighlights: ['Waterfront premium', 'High rental demand', 'Tourist attraction', 'Lifestyle destination'],
    featured: true,
    verified: true,
    currency: 'AED',
    status: 'active',
    visibility: 'public',
    displayOrder: 2,
  },
  {
    name: 'Downtown Dubai',
    slug: 'downtown-dubai',
    city: 'Dubai',
    country: 'UAE',
    emirate: 'Dubai',
    description: 'Downtown Dubai is home to iconic landmarks including Burj Khalifa and Dubai Mall.',
    overviewText: 'Downtown Dubai is a masterpiece of urban planning, offering a perfect blend of residential, commercial, and entertainment options.',
    tagline: 'The Centre of Now',
    amenities: ['Burj Khalifa', 'Dubai Mall', 'Dubai Fountain', 'Opera House', 'Souk Al Bahar'],
    propertyTypes: ['apartment', 'penthouse', 'duplex'],
    accessibility: {
      nearestMetro: 'Burj Khalifa/Dubai Mall Metro',
      metroDistanceKm: 0.3,
      nearestMall: 'Dubai Mall',
      mallDistanceKm: 0.2,
      airportDistanceKm: 12,
      downtownDistanceKm: 0,
    },
    nearbyLandmarks: [
      { name: 'Burj Khalifa', distance: '2 min', type: 'landmark' },
      { name: 'Dubai Mall', distance: '2 min', type: 'retail' },
      { name: 'Dubai Opera', distance: '5 min', type: 'entertainment' },
    ],
    investmentHighlights: ['Prime address', 'Highest appreciation', 'Tourism demand', 'Emaar quality'],
    featured: true,
    verified: true,
    currency: 'AED',
    status: 'active',
    visibility: 'public',
    displayOrder: 3,
  },
  {
    name: 'Palm Jumeirah',
    slug: 'palm-jumeirah-dubai',
    city: 'Dubai',
    country: 'UAE',
    emirate: 'Dubai',
    description: 'Palm Jumeirah is the world\'s largest man-made island and an iconic symbol of Dubai.',
    overviewText: 'Palm Jumeirah offers exclusive beachfront living with luxury villas, premium apartments, and 5-star resort hotels.',
    tagline: 'The Eighth Wonder of the World',
    amenities: ['Private Beach', 'Atlantis Hotel', 'Nakheel Mall', 'Beach Clubs', 'Water Sports'],
    propertyTypes: ['villa', 'apartment', 'penthouse', 'townhouse'],
    accessibility: {
      nearestMetro: 'Palm Gateway Metro',
      metroDistanceKm: 2,
      nearestMall: 'Nakheel Mall',
      mallDistanceKm: 1,
      airportDistanceKm: 35,
      beachDistanceKm: 0,
      downtownDistanceKm: 25,
    },
    nearbyLandmarks: [
      { name: 'Atlantis The Royal', distance: '10 min', type: 'landmark' },
      { name: 'Dubai Marina', distance: '15 min', type: 'landmark' },
      { name: 'Ain Dubai', distance: '20 min', type: 'entertainment' },
    ],
    investmentHighlights: ['Iconic address', 'Beachfront premium', 'Exclusive community', 'High net worth residents'],
    featured: true,
    verified: true,
    currency: 'AED',
    status: 'active',
    visibility: 'public',
    displayOrder: 4,
  },
];

// ============== SEED FUNCTIONS ==============

async function seedDevelopers() {
  console.log('📦 Seeding Developers...');
  const existingDevelopers = await getDevelopers(TENANT_ID);
  
  for (const dev of developersData) {
    const exists = existingDevelopers.find(d => d.slug === dev.slug);
    if (exists) {
      console.log(`  ⏭️  Skipping ${dev.name} (already exists)`);
      continue;
    }
    
    try {
      await createDeveloper(TENANT_ID, dev);
      console.log(`  ✅ Created ${dev.name}`);
    } catch (error) {
      console.log(`  ❌ Failed to create ${dev.name}: ${error.message}`);
    }
  }
}

async function seedAreas() {
  console.log('\n📦 Seeding Areas...');
  const existingAreas = await getAreas(TENANT_ID);
  
  for (const area of areasData) {
    const exists = existingAreas.find(a => a.slug === area.slug);
    if (exists) {
      console.log(`  ⏭️  Skipping ${area.name} (already exists)`);
      continue;
    }
    
    try {
      await createArea(TENANT_ID, area);
      console.log(`  ✅ Created ${area.name}, ${area.city}`);
    } catch (error) {
      console.log(`  ❌ Failed to create ${area.name}: ${error.message}`);
    }
  }
}

async function seedProjects() {
  console.log('\n📦 Seeding Projects...');
  
  const developers = await getDevelopers(TENANT_ID);
  const areas = await getAreas(TENANT_ID);
  const existingProjects = await getProjects(TENANT_ID);
  
  // Helper to find developer/area by slug
  const findDeveloper = (slug) => developers.find(d => d.slug === slug);
  const findArea = (slug) => areas.find(a => a.slug === slug);
  
  // Sample Projects
  const projectsData = [
    // Mumbai Projects
    {
      name: 'Lodha World One',
      slug: 'lodha-world-one-worli',
      developerSlug: 'lodha-group',
      areaSlug: 'worli-mumbai',
      tagline: 'India\'s Tallest Residential Tower',
      description: 'Lodha World One is a 117-storey super-luxury residential tower offering panoramic views of the Arabian Sea and Mumbai skyline.',
      projectType: 'residential',
      propertyCategory: 'ready',
      propertyTypes: [
        { type: 'apartment', bedrooms: '3-BR', bedroomsMin: 3, bedroomsMax: 3, areaMin: 2500, areaMax: 3000, areaUnit: 'sq ft', priceMin: 80000000, priceMax: 100000000, priceOnRequest: false, availability: 'limited' },
        { type: 'apartment', bedrooms: '4-BR', bedroomsMin: 4, bedroomsMax: 4, areaMin: 3500, areaMax: 4500, areaUnit: 'sq ft', priceMin: 120000000, priceMax: 180000000, priceOnRequest: false, availability: 'available' },
        { type: 'penthouse', bedrooms: '5-BR', bedroomsMin: 5, bedroomsMax: 5, areaMin: 6000, areaMax: 12000, areaUnit: 'sq ft', priceMin: 250000000, priceMax: 500000000, priceOnRequest: true, availability: 'limited' },
      ],
      startingPrice: 80000000,
      currency: 'INR',
      totalUnits: 300,
      totalFloors: 117,
      totalBuildings: 1,
      handoverDate: '2024-12-31',
      handoverYear: 2024,
      constructionStatus: 'completed',
      completionPercentage: 100,
      amenities: ['Infinity Pool', 'Sky Lounge', 'Private Cinema', 'Spa', 'Gym', 'Concierge', 'Helipad'],
      keyFeatures: ['Tallest residential tower in India', 'Sea-facing views', '24/7 concierge', 'Italian marble flooring'],
      reraNumber: 'P51900012345',
      reraState: 'Maharashtra',
      nearbyLandmarks: [
        { name: 'Bandra-Worli Sea Link', distance: '3 min', type: 'landmark' },
        { name: 'Nehru Planetarium', distance: '8 min', type: 'entertainment' },
      ],
      investmentHighlights: ['Landmark property', 'Premium appreciation', 'High rental yield', 'Sea views'],
      featured: true,
      verified: true,
      trending: true,
      status: 'active',
      visibility: 'public',
    },
    {
      name: 'Godrej Platinum',
      slug: 'godrej-platinum-andheri',
      developerSlug: 'godrej-properties',
      areaSlug: 'andheri-west-mumbai',
      tagline: 'Luxury Redefined in Andheri',
      description: 'Godrej Platinum offers contemporary luxury apartments with world-class amenities in the heart of Andheri West.',
      projectType: 'residential',
      propertyCategory: 'off-plan',
      propertyTypes: [
        { type: 'apartment', bedrooms: '2-BR', bedroomsMin: 2, bedroomsMax: 2, areaMin: 1200, areaMax: 1400, areaUnit: 'sq ft', priceMin: 35000000, priceMax: 45000000, priceOnRequest: false, availability: 'available' },
        { type: 'apartment', bedrooms: '3-BR', bedroomsMin: 3, bedroomsMax: 3, areaMin: 1800, areaMax: 2200, areaUnit: 'sq ft', priceMin: 55000000, priceMax: 70000000, priceOnRequest: false, availability: 'available' },
      ],
      startingPrice: 35000000,
      currency: 'INR',
      totalUnits: 200,
      totalFloors: 45,
      totalBuildings: 2,
      handoverDate: '2026-06-30',
      handoverQuarter: 'Q2',
      handoverYear: 2026,
      constructionStatus: 'under-construction',
      completionPercentage: 45,
      paymentPlan: {
        planType: 'construction-linked',
        bookingPercentage: 10,
        duringConstructionPercentage: 70,
        onHandoverPercentage: 20,
        installments: [
          { stageNumber: 1, name: 'Booking', percentage: 10, dueDate: 'On Booking', linkedToMilestone: false },
          { stageNumber: 2, name: 'Agreement', percentage: 15, dueDate: '30 days', linkedToMilestone: false },
          { stageNumber: 3, name: 'Foundation', percentage: 15, dueDate: 'Foundation Complete', linkedToMilestone: true },
          { stageNumber: 4, name: 'Structure', percentage: 20, dueDate: 'Structure Complete', linkedToMilestone: true },
          { stageNumber: 5, name: 'Finishing', percentage: 20, dueDate: 'Finishing Complete', linkedToMilestone: true },
          { stageNumber: 6, name: 'Handover', percentage: 20, dueDate: 'On Handover', linkedToMilestone: false },
        ],
      },
      amenities: ['Swimming Pool', 'Clubhouse', 'Gym', 'Children\'s Play Area', 'Garden', 'Security'],
      keyFeatures: ['Godrej quality', 'Metro connectivity', 'Green building', 'Vastu compliant'],
      reraNumber: 'P51900023456',
      reraState: 'Maharashtra',
      nearbyLandmarks: [
        { name: 'Andheri Metro', distance: '5 min', type: 'transport' },
        { name: 'Mumbai Airport', distance: '10 min', type: 'transport' },
      ],
      investmentHighlights: ['Godrej brand premium', 'Metro proximity', 'Airport connectivity', 'Rental potential'],
      featured: true,
      verified: true,
      newLaunch: true,
      status: 'active',
      visibility: 'public',
    },
    // Dubai Projects
    {
      name: 'DIFC Heights Tower',
      slug: 'difc-heights-tower-dubai',
      developerSlug: 'difc-developments',
      areaSlug: 'difc-dubai',
      tagline: 'Residences in Dubai\'s Financial Centre',
      description: 'DIFC Heights Tower offers premium 1-4 bedroom apartments and duplexes in Dubai\'s buzzing financial centre.',
      projectType: 'residential',
      propertyCategory: 'off-plan',
      propertyTypes: [
        { type: 'apartment', bedrooms: '1-BR', bedroomsMin: 1, bedroomsMax: 1, areaMin: 844, areaMax: 1100, areaUnit: 'sq ft', priceMin: 3900000, priceMax: 5000000, priceOnRequest: false, availability: 'limited' },
        { type: 'apartment', bedrooms: '2-BR', bedroomsMin: 2, bedroomsMax: 2, areaMin: 1200, areaMax: 1600, areaUnit: 'sq ft', priceMin: 5500000, priceMax: 7500000, priceOnRequest: false, availability: 'available' },
        { type: 'apartment', bedrooms: '3-BR', bedroomsMin: 3, bedroomsMax: 3, areaMin: 1800, areaMax: 2400, areaUnit: 'sq ft', priceMin: 8000000, priceMax: 12000000, priceOnRequest: false, availability: 'available' },
        { type: 'duplex', bedrooms: '4-BR', bedroomsMin: 4, bedroomsMax: 4, areaMin: 2500, areaMax: 3618, areaUnit: 'sq ft', priceMin: 15000000, priceMax: 25000000, priceOnRequest: false, availability: 'available' },
      ],
      startingPrice: 3900000,
      currency: 'AED',
      totalUnits: 350,
      totalFloors: 55,
      totalBuildings: 1,
      handoverDate: '2029-12-31',
      handoverQuarter: 'Q4',
      handoverYear: 2029,
      constructionStatus: 'under-construction',
      completionPercentage: 25,
      paymentPlan: {
        planType: '70/30',
        bookingPercentage: 10,
        duringConstructionPercentage: 60,
        onHandoverPercentage: 30,
        installments: [
          { stageNumber: 1, name: 'On Booking', percentage: 10, dueDate: 'On Booking', linkedToMilestone: false },
          { stageNumber: 2, name: 'During Construction', percentage: 60, dueDate: 'Construction Linked', linkedToMilestone: true },
          { stageNumber: 3, name: 'On Handover', percentage: 30, dueDate: 'Q4 2029', linkedToMilestone: false },
        ],
      },
      amenities: ['Infinity Pool', 'Gym', 'Cinema', 'Co-working Spaces', 'Concierge', 'Valet Parking'],
      keyFeatures: ['Smart home integration', '24/7 concierge', 'Premium finishes', 'DIFC address'],
      oqoodNumber: 'OQ123456',
      escrowAccountNumber: 'ESC789012',
      escrowBankName: 'Emirates NBD',
      nearbyLandmarks: [
        { name: 'Museum of the Future', distance: '5 min', type: 'landmark' },
        { name: 'Dubai Mall', distance: '5 min', type: 'retail' },
        { name: 'Burj Khalifa', distance: '5 min', type: 'landmark' },
      ],
      investmentHighlights: ['Prime DIFC location', 'Golden Visa eligible', 'High rental yield', 'Financial hub address'],
      featured: true,
      verified: true,
      trending: true,
      status: 'active',
      visibility: 'public',
    },
    {
      name: 'Emaar Beachfront Residences',
      slug: 'emaar-beachfront-residences-dubai',
      developerSlug: 'emaar-properties',
      areaSlug: 'dubai-marina',
      tagline: 'Beachfront Living by Emaar',
      description: 'Emaar Beachfront offers exclusive island living with private beach access and stunning views of the Arabian Gulf.',
      projectType: 'residential',
      propertyCategory: 'off-plan',
      propertyTypes: [
        { type: 'apartment', bedrooms: '1-BR', bedroomsMin: 1, bedroomsMax: 1, areaMin: 750, areaMax: 950, areaUnit: 'sq ft', priceMin: 2500000, priceMax: 3500000, priceOnRequest: false, availability: 'available' },
        { type: 'apartment', bedrooms: '2-BR', bedroomsMin: 2, bedroomsMax: 2, areaMin: 1100, areaMax: 1400, areaUnit: 'sq ft', priceMin: 4000000, priceMax: 5500000, priceOnRequest: false, availability: 'available' },
        { type: 'apartment', bedrooms: '3-BR', bedroomsMin: 3, bedroomsMax: 3, areaMin: 1600, areaMax: 2100, areaUnit: 'sq ft', priceMin: 6000000, priceMax: 8500000, priceOnRequest: false, availability: 'available' },
        { type: 'penthouse', bedrooms: '4-BR', bedroomsMin: 4, bedroomsMax: 4, areaMin: 3000, areaMax: 5000, areaUnit: 'sq ft', priceMin: 15000000, priceMax: 30000000, priceOnRequest: true, availability: 'limited' },
      ],
      startingPrice: 2500000,
      currency: 'AED',
      totalUnits: 450,
      totalFloors: 40,
      totalBuildings: 3,
      totalTowers: 3,
      handoverDate: '2027-06-30',
      handoverQuarter: 'Q2',
      handoverYear: 2027,
      constructionStatus: 'under-construction',
      completionPercentage: 55,
      paymentPlan: {
        planType: '60/40',
        bookingPercentage: 10,
        duringConstructionPercentage: 50,
        onHandoverPercentage: 40,
        installments: [
          { stageNumber: 1, name: 'On Booking', percentage: 10, dueDate: 'On Booking', linkedToMilestone: false },
          { stageNumber: 2, name: 'During Construction', percentage: 50, dueDate: 'Construction Linked', linkedToMilestone: true },
          { stageNumber: 3, name: 'On Handover', percentage: 40, dueDate: 'Q2 2027', linkedToMilestone: false },
        ],
      },
      amenities: ['Private Beach', 'Infinity Pool', 'Beach Club', 'Gym', 'Kids Club', 'Retail Boulevard'],
      keyFeatures: ['Emaar quality', 'Private beach access', 'Marina views', 'Island living'],
      oqoodNumber: 'OQ234567',
      escrowAccountNumber: 'ESC890123',
      escrowBankName: 'Dubai Islamic Bank',
      nearbyLandmarks: [
        { name: 'JBR Beach', distance: '5 min', type: 'entertainment' },
        { name: 'Dubai Marina Walk', distance: '10 min', type: 'retail' },
        { name: 'Ain Dubai', distance: '15 min', type: 'landmark' },
      ],
      investmentHighlights: ['Emaar brand', 'Beachfront premium', 'High rental yields', 'Tourist destination'],
      featured: true,
      verified: true,
      newLaunch: true,
      status: 'active',
      visibility: 'public',
    },
    {
      name: 'Sobha Sanctuary Villas',
      slug: 'sobha-sanctuary-villas-dubai',
      developerSlug: 'sobha-realty',
      areaSlug: 'downtown-dubai',
      tagline: 'Luxury Villas in Dubailand',
      description: 'Sobha Sanctuary is Sobha Realty\'s largest master-planned development featuring luxury villas with nature-centric design.',
      projectType: 'residential',
      propertyCategory: 'off-plan',
      propertyTypes: [
        { type: 'villa', bedrooms: '4-BR', bedroomsMin: 4, bedroomsMax: 4, areaMin: 4500, areaMax: 5500, areaUnit: 'sq ft', priceMin: 8000000, priceMax: 12000000, priceOnRequest: false, availability: 'available' },
        { type: 'villa', bedrooms: '5-BR', bedroomsMin: 5, bedroomsMax: 5, areaMin: 6000, areaMax: 8000, areaUnit: 'sq ft', priceMin: 12000000, priceMax: 18000000, priceOnRequest: false, availability: 'available' },
        { type: 'villa', bedrooms: '6-BR', bedroomsMin: 6, bedroomsMax: 6, areaMin: 8500, areaMax: 12000, areaUnit: 'sq ft', priceMin: 20000000, priceMax: 35000000, priceOnRequest: true, availability: 'available' },
      ],
      startingPrice: 8000000,
      currency: 'AED',
      totalUnits: 500,
      totalFloors: 3,
      totalBuildings: 500,
      handoverDate: '2029-08-31',
      handoverQuarter: 'Q3',
      handoverYear: 2029,
      constructionStatus: 'booking-open',
      completionPercentage: 15,
      paymentPlan: {
        planType: '80/20',
        bookingPercentage: 10,
        duringConstructionPercentage: 70,
        onHandoverPercentage: 20,
        installments: [
          { stageNumber: 1, name: 'On Booking', percentage: 10, dueDate: 'On Booking', linkedToMilestone: false },
          { stageNumber: 2, name: 'During Construction', percentage: 70, dueDate: 'Construction Linked', linkedToMilestone: true },
          { stageNumber: 3, name: 'On Handover', percentage: 20, dueDate: 'Q3 2029', linkedToMilestone: false },
        ],
      },
      amenities: ['Crystal Lagoon', 'Central Park', 'Wellness Loop', 'Schools', 'Hospital', 'Retail'],
      keyFeatures: ['38M sq ft masterplan', '50% open space', '6km crystal lagoon', 'Nature-centric living'],
      oqoodNumber: 'OQ345678',
      escrowAccountNumber: 'ESC901234',
      escrowBankName: 'Mashreq Bank',
      nearbyLandmarks: [
        { name: 'Global Village', distance: '10 min', type: 'entertainment' },
        { name: 'IMG Worlds', distance: '15 min', type: 'entertainment' },
        { name: 'Dubai Marina', distance: '25 min', type: 'landmark' },
      ],
      investmentHighlights: ['Sobha quality', 'Largest masterplan', 'Nature community', 'Capital appreciation'],
      featured: true,
      verified: true,
      newLaunch: true,
      trending: true,
      status: 'active',
      visibility: 'public',
    },
  ];
  
  for (const project of projectsData) {
    const exists = existingProjects.find(p => p.slug === project.slug);
    if (exists) {
      console.log(`  ⏭️  Skipping ${project.name} (already exists)`);
      continue;
    }
    
    const developer = findDeveloper(project.developerSlug);
    const area = findArea(project.areaSlug);
    
    if (!developer) {
      console.log(`  ❌ Skipping ${project.name}: Developer ${project.developerSlug} not found`);
      continue;
    }
    if (!area) {
      console.log(`  ❌ Skipping ${project.name}: Area ${project.areaSlug} not found`);
      continue;
    }
    
    try {
      const projectData = {
        ...project,
        developerId: developer.developerId,
        areaId: area.areaId,
      };
      delete projectData.developerSlug;
      delete projectData.areaSlug;
      
      await createProject(TENANT_ID, projectData);
      console.log(`  ✅ Created ${project.name}`);
    } catch (error) {
      console.log(`  ❌ Failed to create ${project.name}: ${error.message}`);
    }
  }
}

// ============== MAIN ==============

async function main() {
  try {
    await seedDevelopers();
    await seedAreas();
    await seedProjects();
    
    console.log('\n✅ Seeding completed!\n');
    
    // Print summary
    const developers = await getDevelopers(TENANT_ID);
    const areas = await getAreas(TENANT_ID);
    const projects = await getProjects(TENANT_ID);
    
    console.log('📊 Summary:');
    console.log(`   Developers: ${developers.length}`);
    console.log(`   Areas: ${areas.length}`);
    console.log(`   Projects: ${projects.length}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
