import {
  generateTestPhone,
  generateTestEmail,
  generateUniqueName,
  generateUniquePropertyTitle,
  generateUniqueLocation,
} from '../../helpers/seedData';

export function buildKhataTestData(runStamp: string, phoneBase: number) {
  const ownerNameObj = generateUniqueName(runStamp, 0);
  const ownerName = ownerNameObj.fullName;
  const ownerPhone = generateTestPhone(1, phoneBase);
  const ownerEmail = generateTestEmail(ownerNameObj.firstName.toLowerCase(), 1, 'test.com');

  const propertyTitle = `${generateUniquePropertyTitle(runStamp, 1)} (Khata ${runStamp})`;
  const propertyLoc = generateUniqueLocation(runStamp, 2);

  return {
    owner: { name: ownerName, phone: ownerPhone, email: ownerEmail },
    property: { title: propertyTitle, area: propertyLoc.area, city: propertyLoc.city, flatNumber: '501' },
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
