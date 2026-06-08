import { SEED_DATA, generateTestPhone, generateTestEmail, getItemByIndex } from '../../helpers/seedData';

export function buildKhataTestData(runStamp: string, phoneBase: number) {
  const ownerSeed = getItemByIndex(SEED_DATA.owners, Date.now());
  const ownerName = `${ownerSeed.firstName} ${ownerSeed.lastName}`;
  const ownerPhone = generateTestPhone(1, phoneBase);
  const ownerEmail = generateTestEmail(ownerSeed.firstName.toLowerCase(), 1, 'test.com');

  const propertySeed = getItemByIndex(SEED_DATA.properties.titles, Date.now() + 1);
  const propertyTitle = `${propertySeed} (Khata ${runStamp})`;
  const propertyArea = getItemByIndex(SEED_DATA.properties.areas, Date.now() + 2);

  return {
    owner: { name: ownerName, phone: ownerPhone, email: ownerEmail },
    property: { title: propertyTitle, area: propertyArea, city: 'Mumbai', flatNumber: '501' },
    entry: {
      description: `Brokerage and maintenance for ${propertyTitle}`,
      lineItems: [
        { category: 'Brokerage', amount: 75000 },
        { category: 'Maintenance', amount: 25000 },
      ],
      paymentMode: 'Bank Transfer',
      referenceId: `NEFT-${runStamp}`,
      settlementNote: `Settled via NEFT on ${new Date().toLocaleDateString('en-IN')}`,
    },
  };
}
