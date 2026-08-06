export function calculateLeaseEndDateFromTenure(moveInDate, tenureMonths) {
  if (!moveInDate || !tenureMonths) return null;
  const date = new Date(moveInDate);
  date.setMonth(date.getMonth() + tenureMonths);
  return date.toISOString().split('T')[0];
}

export function getDaysUntilLeaseExpiry(leaseEndDate) {
  if (!leaseEndDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(leaseEndDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function resolvePropertyMonthlyRent(property) {
  return property.rentalInfo?.currentRent
    || property.rentAmount
    || property.monthlyRent
    || property.rentalInfo?.expectedRent
    || 0;
}

export function resolveLeaseEndDate(property, latestAgreement) {
  return property.rentalInfo?.leaseEndDate
    || latestAgreement?.endDate
    || calculateLeaseEndDateFromTenure(
      property.rentalInfo?.leaseStartDate || property.tenantMoveInDate,
      property.tenureMonths,
    );
}
