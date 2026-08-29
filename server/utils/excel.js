import XLSX from 'xlsx';

/**
 * Build Excel workbook buffer from team analytics items.
 */
export function buildTeamAnalyticsWorkbook(items) {
  const rows = items.map((m) => ({
    Name: m.name,
    Email: m.email || '',
    Mobile: m.phone || '',
    Role: m.role,
    Status: m.status,
    'Deals Closed': m.dealsClosed,
    'Active Leads': m.activeLeads,
    'Total Assigned': m.totalAssigned,
    'Conversion %': m.conversionRate,
    'Contacted %': m.contactedRate,
    'Last Activity': m.lastActivityAt || '',
    'Last Login': m.lastLoginAt || '',
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Team Analytics');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
