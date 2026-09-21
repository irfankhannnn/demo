/**
 * Seeds a demo agency and published listings for the public property pages.
 *
 * Usage:
 *   node agency-app/api/scripts/seed-public-pages-demo.js [--tenant <id>] [--slug <slug>] [--batch base|mumbai]
 *
 * --batch base (default) writes the agency config and one listing in each of
 * four cities. --batch mumbai adds a Mumbai-only set (Kurla, Andheri, Powai,
 * Bandra; rent and sale) and leaves the agency config alone — enough depth in
 * one city for the consumer marketplace's locality and "closest match"
 * behaviour to be seen working.
 *
 * The agency config write is idempotent. The listings are NOT — every run
 * creates a fresh batch, because createProperty always mints a new id. Each
 * one carries a `demoSeed: true` marker so a batch can be identified and
 * removed later. Re-run only when you actually want more listings.
 *
 * Images are generated here rather than shipped as fixtures. They are real
 * PNGs, not SVGs, because the point of the demo is to see a WhatsApp/Instagram
 * link preview render — and no major unfurler accepts an SVG as an og:image.
 */

import 'dotenv/config';
import zlib from 'zlib';
import { createProperty } from '../crmDynamodbService.js';
import { getAgencyConfig, updateAgencyConfig } from '../agencyConfigService.js';
import { uploadToS3 } from '../s3Service.js';
import { logger } from '../logger.js';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const TENANT_ID = argValue('--tenant', 'demo_properties_pages');
const AGENCY_SLUG = argValue('--slug', 'sunrise-realty');
const BATCH = argValue('--batch', 'base');

// ── Minimal PNG encoder ─────────────────────────────────────────────────────
// A vertical two-tone gradient. Enough to look like a real photo slot in a
// gallery without shipping binary fixtures into the repo.

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(width, height, [r1, g1, b1], [r2, g2, b2]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let off = 0;
  for (let y = 0; y < height; y += 1) {
    raw[off] = 0; // filter: none
    off += 1;
    const t = y / (height - 1);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    for (let x = 0; x < width; x += 1) {
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b;
      off += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PALETTES = [
  [[255, 138, 46], [196, 78, 12]],
  [[92, 138, 196], [34, 68, 120]],
  [[110, 176, 128], [40, 96, 62]],
  [[188, 150, 210], [96, 62, 130]],
];

// ── Demo inventory ──────────────────────────────────────────────────────────

const LISTINGS = [
  {
    title: '3 BHK in Prestige Palm Grove',
    description: 'East-facing 3 BHK with a covered balcony overlooking the central garden.\n\nWalking distance to the tech park, two schools and a metro feeder stop. The society has a clubhouse, lap pool and full power backup.',
    propertyType: 'apartment', bhk: 3, area: 'Whitefield', city: 'Bangalore',
    buildingName: 'Prestige Palm Grove', carpetArea: 1450, builtUpArea: 1720,
    furnishing: 'semi-furnished', facing: 'east', status: 'for-sale',
    saleInfo: { listedPrice: 12500000, soldPrice: null, soldDate: null, soldToBuyerId: null },
    amenities: ['Clubhouse', 'Swimming pool', 'Covered parking', 'Power backup', 'Gym', 'Kids play area'],
    latitude: 12.9698, longitude: 77.7500,
  },
  {
    title: '2 BHK near Hinjewadi Phase 1',
    description: 'Compact, bright 2 BHK on the 7th floor with an unobstructed west view.\n\nIdeal for a working couple — five minutes from the IT park gate, with a supermarket and pharmacy in the same complex.',
    propertyType: 'apartment', bhk: 2, area: 'Hinjewadi', city: 'Pune',
    buildingName: 'Blue Ridge Towers', carpetArea: 890, builtUpArea: 1080,
    furnishing: 'furnished', facing: 'west', status: 'for-rent',
    rentalInfo: { expectedRent: 32000, currentRent: null, currentTenantId: null, leaseStartDate: null, leaseEndDate: null, securityDeposit: 150000 },
    amenities: ['Lift', 'Security', 'Covered parking', 'Gym'],
    latitude: 18.5913, longitude: 73.7389,
  },
  {
    title: '4 BHK villa with private garden',
    description: 'Corner-plot villa with a 1,200 sq.ft. private garden and a double carport.\n\nGround floor has a formal living room, guest bedroom and a modular kitchen with utility. Three bedrooms upstairs, all en-suite.',
    propertyType: 'villa', bhk: 4, area: 'Gachibowli', city: 'Hyderabad',
    buildingName: 'Aparna Sarovar', carpetArea: 2850, builtUpArea: 3400,
    furnishing: 'unfurnished', facing: 'north', status: 'for-sale',
    saleInfo: { listedPrice: 42000000, soldPrice: null, soldDate: null, soldToBuyerId: null },
    amenities: ['Private garden', 'Double carport', 'Servant quarter', 'Clubhouse', 'Tennis court'],
    latitude: 17.4401, longitude: 78.3489,
  },
  {
    title: '1 BHK studio, fully furnished',
    description: 'Move-in ready studio with a queen bed, work desk, washing machine and a fitted kitchenette. Rent includes maintenance.',
    propertyType: 'apartment', bhk: 1, area: 'Andheri East', city: 'Mumbai',
    buildingName: 'Sahar Residency', carpetArea: 480, builtUpArea: 610,
    furnishing: 'furnished', facing: 'south', status: 'for-rent',
    rentalInfo: { expectedRent: 45000, currentRent: null, currentTenantId: null, leaseStartDate: null, leaseEndDate: null, securityDeposit: 200000 },
    amenities: ['Lift', 'Security', '24x7 water', 'Power backup'],
    latitude: 19.1136, longitude: 72.8697,
  },
];

const rent = (expectedRent, securityDeposit) => ({
  expectedRent, currentRent: null, currentTenantId: null, leaseStartDate: null, leaseEndDate: null, securityDeposit,
});
const sale = (listedPrice) => ({ listedPrice, soldPrice: null, soldDate: null, soldToBuyerId: null });

const MUMBAI_LISTINGS = [
  {
    title: '2 BHK in Kohinoor City, Kurla West',
    description: 'Well-kept 2 BHK on the 11th floor with an open east view and cross ventilation.\n\nInside the Kohinoor City township: school, hospital and mall within the gates. Ten minutes to BKC, close to Kurla station and the Santacruz-Chembur Link Road.',
    propertyType: 'apartment', bhk: 2, area: 'Kurla West', city: 'Mumbai',
    buildingName: 'Kohinoor City', carpetArea: 720, builtUpArea: 910,
    furnishing: 'semi-furnished', facing: 'east', status: 'for-sale', saleInfo: sale(16500000),
    amenities: ['Covered parking', 'Lift', 'Gym', 'Security', 'Power backup', 'Kids play area'],
    latitude: 19.0822, longitude: 72.8856,
  },
  {
    title: '2 BHK on rent near Kurla station',
    description: 'Freshly painted 2 BHK with modular kitchen and two balconies. Family or working professionals.\n\nFive minutes walk to Kurla station (Central and Harbour line), 15 minutes to BKC by auto.',
    propertyType: 'apartment', bhk: 2, area: 'Kurla East', city: 'Mumbai',
    buildingName: 'Nehru Nagar Heights', carpetArea: 650, builtUpArea: 800,
    furnishing: 'unfurnished', facing: 'north', status: 'for-rent', rentalInfo: rent(52000, 200000),
    amenities: ['Lift', 'Security', '24x7 water', 'Parking'],
    latitude: 19.0653, longitude: 72.8890,
  },
  {
    title: '2 BHK with deck, Andheri West',
    description: 'Bright 2 BHK off Lokhandwala back road with a usable deck and a society garden.\n\nWalk to the market, Infiniti Mall and the Versova metro. Reserved covered parking for one car.',
    propertyType: 'apartment', bhk: 2, area: 'Andheri West', city: 'Mumbai',
    buildingName: 'Oberoi Springs', carpetArea: 810, builtUpArea: 1020,
    furnishing: 'furnished', facing: 'west', status: 'for-sale', saleInfo: sale(24500000),
    amenities: ['Swimming pool', 'Gym', 'Covered parking', 'Clubhouse', 'Security', 'Garden'],
    latitude: 19.1364, longitude: 72.8296,
  },
  {
    title: '2 BHK semi-furnished, Andheri East (near metro)',
    description: '2 BHK in a gated society off the Andheri-Kurla Road, wardrobes and kitchen fitted.\n\nThree minutes to the Marol Naka metro, easy for SEEPZ, MIDC and the airport.',
    propertyType: 'apartment', bhk: 2, area: 'Andheri East', city: 'Mumbai',
    buildingName: 'Kanakia Sevens', carpetArea: 690, builtUpArea: 860,
    furnishing: 'semi-furnished', facing: 'east', status: 'for-rent', rentalInfo: rent(65000, 250000),
    amenities: ['Lift', 'Gym', 'Security', 'Covered parking', 'Power backup'],
    latitude: 19.1086, longitude: 72.8790,
  },
  {
    title: '3 BHK lake-facing in Hiranandani Gardens, Powai',
    description: 'Large 3 BHK with a Powai lake view from the living room and master bedroom.\n\nHiranandani Gardens: schools, hospital, high street and offices all on foot.',
    propertyType: 'apartment', bhk: 3, area: 'Powai', city: 'Mumbai',
    buildingName: 'Hiranandani Gardens', carpetArea: 1180, builtUpArea: 1500,
    furnishing: 'semi-furnished', facing: 'north', status: 'for-sale', saleInfo: sale(41000000),
    amenities: ['Lake view', 'Swimming pool', 'Gym', 'Clubhouse', 'Covered parking', 'Security'],
    latitude: 19.1176, longitude: 72.9060,
  },
  {
    title: '1 BHK sea-breeze flat, Bandra West',
    description: 'Compact 1 BHK a lane away from Carter Road, fully furnished, pet friendly society.\n\nCafes, the promenade and Bandra station all close by.',
    propertyType: 'apartment', bhk: 1, area: 'Bandra West', city: 'Mumbai',
    buildingName: 'Sea Breeze Apartments', carpetArea: 450, builtUpArea: 560,
    furnishing: 'furnished', facing: 'west', status: 'for-rent', rentalInfo: rent(75000, 300000),
    amenities: ['Lift', 'Security', 'Pet friendly', 'Power backup'],
    latitude: 19.0640, longitude: 72.8235,
  },
];

async function seedImages(index, title) {
  const [from, to] = PALETTES[index % PALETTES.length];
  const keys = [];
  // Three per listing: enough to exercise the gallery's main + two thumbnails.
  for (let i = 0; i < 3; i += 1) {
    const png = makePng(1200, 630, from, to.map((c, j) => Math.max(0, c - i * 18 * (j + 1) / 3)));
    const uploaded = await uploadToS3(
      png,
      `demo-${index}-${i}.png`,
      'image/png',
      'crm/properties/images',
      TENANT_ID,
    );
    keys.push(typeof uploaded === 'string' ? uploaded : uploaded?.key || uploaded?.s3Key);
  }
  logger.info('seed.images_uploaded', { title, count: keys.length });
  return keys.filter(Boolean);
}

async function main() {
  console.log(`Seeding demo public pages for tenant "${TENANT_ID}" (slug: ${AGENCY_SLUG})`);

  // 1. Agency branding + the public-pages switch (base batch only).
  if (BATCH === 'base') {
    const existing = await getAgencyConfig(TENANT_ID);
    await updateAgencyConfig(TENANT_ID, {
      agencySlug: AGENCY_SLUG,
      agencyName: 'Sunrise Realty',
      brandPrimaryColor: '#FF7A1A',
      publicPhone: '+91 98765 43210',
      publicEmail: 'hello@sunriserealty.example',
      publicAddress: '2nd Floor, MG Road, Bangalore 560001',
      publicAbout: 'Family-run brokerage since 2009. We handle resale and rentals across Bangalore, Pune, Hyderabad and Mumbai.',
      publicPagesEnabled: true,
      // Business hours drive the bookable slot range.
      businessHoursStart: 10,
      businessHoursEnd: 19,
      timezone: 'Asia/Kolkata',
      demoSeed: true,
    });
    console.log(`  agency config ${existing ? 'updated' : 'created'}`);
  }

  // 2. Listings.
  const inventory = BATCH === 'mumbai' ? MUMBAI_LISTINGS : LISTINGS;
  const created = [];
  for (let i = 0; i < inventory.length; i += 1) {
    const listing = inventory[i];
    const images = await seedImages(i, listing.title);

    const property = await createProperty(TENANT_ID, {
      ...listing,
      images,
      publicVisibility: 'public',
      listingStatus: 'active',
      demoSeed: true,
    });

    created.push(property);
    console.log(`  ${listing.title}`);
    console.log(`      /property/${property.publicSlug || 'listing'}/${property.propertyId}`);
  }

  console.log('');
  console.log(`Done. ${created.length} published listings for tenant ${TENANT_ID}.`);
  console.log('');
  console.log('Open (path fallback, before DNS is wired):');
  console.log(`  <base-url>/t/${AGENCY_SLUG}/`);
  console.log(`  <base-url>/t/${AGENCY_SLUG}/property/<slug>/${created[0]?.propertyId}`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
