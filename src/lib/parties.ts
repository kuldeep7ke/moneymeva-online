export type PartyGroup = 'personal' | 'services' | 'financial' | 'business' | 'government' | 'agriculture' | 'office';

export const PARTY_GROUPS: { value: PartyGroup; label: string }[] = [
  { value: 'personal', label: 'Personal' },
  { value: 'services', label: 'Services' },
  { value: 'financial', label: 'Financial' },
  { value: 'business', label: 'Business' },
  { value: 'government', label: 'Govt' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'office', label: 'Office' },
];

export const PARTY_TYPES_BY_GROUP: Record<PartyGroup, { value: string; label: string }[]> = {
  personal: [
    { value: 'friend', label: 'Friend' },
    { value: 'family', label: 'Family' },
    { value: 'roommate', label: 'Roommate' },
    { value: 'colleague', label: 'Colleague' },
    { value: 'neighbor', label: 'Neighbor' },
    { value: 'other', label: 'Other' },
  ],
  services: [
    { value: 'electricity', label: 'Electricity' },
    { value: 'water', label: 'Water' },
    { value: 'gas', label: 'Gas' },
    { value: 'internet', label: 'Internet / Broadband' },
    { value: 'mobile', label: 'Mobile / Telecom' },
    { value: 'dth', label: 'DTH / Cable TV' },
    { value: 'hosting', label: 'Hosting / Domain' },
    { value: 'saas', label: 'SaaS / Software' },
    { value: 'streaming', label: 'Streaming' },
    { value: 'maintenance', label: 'Maintenance / Society' },
    { value: 'other', label: 'Other' },
  ],
  financial: [
    { value: 'bank', label: 'Bank' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'investment', label: 'Investment Platform' },
    { value: 'mutual_fund', label: 'Mutual Fund' },
    { value: 'loan', label: 'Loan Provider' },
    { value: 'gold', label: 'Gold / Dealer' },
    { value: 'ca', label: 'CA / Accountant' },
    { value: 'wallet', label: 'Wallet / UPI' },
    { value: 'other', label: 'Other' },
  ],
  business: [
    { value: 'employer', label: 'Employer' },
    { value: 'client', label: 'Client' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'wholesaler', label: 'Wholesaler' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'service_provider', label: 'Service Provider' },
    { value: 'freelancer', label: 'Freelancer' },
    { value: 'shop', label: 'Shop / Retailer' },
    { value: 'partner', label: 'Partner' },
    { value: 'other', label: 'Other' },
  ],
  government: [
    { value: 'income_tax', label: 'Income Tax' },
    { value: 'gst', label: 'GST' },
    { value: 'municipal', label: 'Municipal' },
    { value: 'court', label: 'Court / Legal' },
    { value: 'scheme', label: 'Government Scheme' },
    { value: 'other', label: 'Other' },
  ],
  agriculture: [
    { value: 'crop_buyer', label: 'Crop Buyer' },
    { value: 'seed_supplier', label: 'Seed / Fertilizer Supplier' },
    { value: 'equipment', label: 'Equipment Dealer' },
    { value: 'farm_labor', label: 'Farm Labor' },
    { value: 'land_owner', label: 'Land Owner' },
    { value: 'agri_loan', label: 'Agri Loan' },
    { value: 'cooperative', label: 'Cooperative Society' },
    { value: 'other', label: 'Other' },
  ],
  office: [
    { value: 'publication', label: 'Publication / Press' },
    { value: 'printer', label: 'Printer / Designer' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'advertiser', label: 'Advertiser' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'client', label: 'Client' },
    { value: 'employee', label: 'Employee' },
    { value: 'other', label: 'Other' },
  ],
};

export function getGroupLabel(group: string): string {
  return PARTY_GROUPS.find(g => g.value === group)?.label || group;
}

export function getTypeLabel(group: string, type: string): string {
  const types = PARTY_TYPES_BY_GROUP[group as PartyGroup] || [];
  return types.find(t => t.value === type)?.label || type;
}

// Credit (उधार) alarm defaults — alarm/highlight ONLY, never blocks entries.
export const DEFAULT_CREDIT_LIMIT = 10000;
export const DEFAULT_CREDIT_SETTLE_DAYS = 30;
export const NEAR_LIMIT_PCT = 0.8;
export const NEAR_DUE_DAYS = 3;

export function creditLimitFor(partner: { creditLimit?: number }): number {
  return partner.creditLimit && partner.creditLimit > 0 ? partner.creditLimit : DEFAULT_CREDIT_LIMIT;
}

export function creditSettleDaysFor(partner: { creditSettleDays?: number }): number {
  return partner.creditSettleDays && partner.creditSettleDays > 0 ? partner.creditSettleDays : DEFAULT_CREDIT_SETTLE_DAYS;
}

export type PartyGroupType = PartyGroup;
