export const PROFESSION_CATEGORIES: Record<string, { income: string[]; expense: string[] }> = {
  salaried: {
    income: ['Salary', 'Freelance', 'Bonus', 'Refund', 'Gift'],
    expense: ['Food', 'Transport', 'Rent', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Education', 'Dining Out', 'Groceries', 'Subscription', 'EMI', 'Insurance', 'Tax'],
  },
  business: {
    income: ['Sales Revenue', 'Client Payment', 'Investment Income', 'Refund'],
    expense: ['Rent', 'Utilities', 'Salary', 'Inventory', 'Marketing', 'Travel', 'Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Dining Out', 'Groceries', 'Subscription', 'EMI', 'Insurance', 'Tax', 'Software'],
  },
  freelancer: {
    income: ['Client Project', 'Consultation', 'Retainer', 'Royalty', 'Refund'],
    expense: ['Software', 'Equipment', 'Travel', 'Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Education', 'Dining Out', 'Groceries', 'Rent', 'Subscription', 'EMI', 'Insurance', 'Tax'],
  },
  student: {
    income: ['Allowance', 'Part-time Job', 'Scholarship', 'Gift', 'Refund'],
    expense: ['Food', 'Transport', 'Rent', 'Education', 'Shopping', 'Entertainment', 'Health', 'Dining Out', 'Groceries', 'Subscription'],
  },
  homemaker: {
    income: ['Allowance', 'Rental Income', 'Gift', 'Refund'],
    expense: ['Food', 'Transport', 'Rent', 'Bills', 'Groceries', 'Shopping', 'Health', 'Education', 'Entertainment', 'Dining Out', 'Subscription'],
  },
  retired: {
    income: ['Pension', 'Investment Income', 'Rental Income', 'Gift', 'Refund'],
    expense: ['Food', 'Transport', 'Rent', 'Bills', 'Health', 'Shopping', 'Entertainment', 'Dining Out', 'Groceries', 'Subscription', 'Insurance'],
  },
  investor: {
    income: ['Dividend', 'Capital Gains', 'Interest', 'Rental Income', 'Refund'],
    expense: ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Dining Out', 'Groceries', 'Subscription', 'Tax', 'Brokerage'],
  },
  medical: {
    income: ['Consultation', 'Procedure', 'Hospital', 'Refund'],
    expense: ['Food', 'Transport', 'Rent', 'Bills', 'Equipment', 'Shopping', 'Entertainment', 'Health', 'Dining Out', 'Groceries', 'Subscription', 'EMI', 'Insurance', 'Tax'],
  },
  farmer: {
    income: ['Farm Sale', 'Milk & Dairy', 'Wages Earned', 'Equipment Hire', 'Work Payment', 'Refund'],
    expense: ['Seeds', 'Fertilizer', 'Pesticide', 'Diesel/Fuel', 'Labor', 'Equipment Repair', 'Irrigation & Power', 'Transport', 'Food', 'Bills', 'Health', 'Education', 'EMI', 'Insurance', 'Tax'],
  },
};

export const DEFAULT_CATEGORIES = {
  income: ['Salary', 'Freelance', 'Business', 'Investment', 'Rental', 'Refund', 'Gift', 'Other'],
  expense: ['Food', 'Transport', 'Rent', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Education', 'Dining Out', 'Groceries', 'Subscription', 'EMI', 'Insurance', 'Tax', 'Other'],
};

export function getDefaultCategories(profession: string | undefined, type: 'income' | 'expense'): string[] {
  const cats = profession && PROFESSION_CATEGORIES[profession] ? PROFESSION_CATEGORIES[profession][type] : DEFAULT_CATEGORIES[type];
  return cats.includes('Other') ? cats : [...cats, 'Other'];
}

// ─── Work Profiles (कामे) ────────────────────────────────────────────────────
// Preset work types per trade. The Works page auto-selects the profile matching
// the user's onboarding profession; users can switch profiles anytime. Every
// profile also allows a custom free-text work type.
export interface WorkProfile {
  value: string;
  icon: string;
  professions: string[];             // onboarding professions that map to this profile
  workTypes: { value: string; key: string }[];   // key = i18n key suffix under works.types
}

export const WORK_PROFILES: WorkProfile[] = [
  {
    value: 'farmer',
    icon: '🌾',
    professions: ['farmer'],
    workTypes: [
      { value: 'land_prep', key: 'land_prep' },
      { value: 'sowing', key: 'sowing' },
      { value: 'fertilizing', key: 'fertilizing' },
      { value: 'weeding', key: 'weeding' },
      { value: 'spraying', key: 'spraying' },
      { value: 'irrigation', key: 'irrigation' },
      { value: 'harvesting', key: 'harvesting' },
      { value: 'threshing', key: 'threshing' },
      { value: 'transport', key: 'transport' },
      { value: 'produce_sale', key: 'produce_sale' },
    ],
  },
  {
    value: 'employee',
    icon: '💼',
    professions: ['salaried'],
    workTypes: [
      { value: 'salary', key: 'salary' },
      { value: 'overtime', key: 'overtime' },
      { value: 'commission', key: 'commission' },
      { value: 'bonus', key: 'bonus' },
      { value: 'advance', key: 'advance' },
      { value: 'reimbursement', key: 'reimbursement' },
    ],
  },
  {
    value: 'freelancer',
    icon: '💻',
    professions: ['freelancer'],
    workTypes: [
      { value: 'project_work', key: 'project_work' },
      { value: 'consulting', key: 'consulting' },
      { value: 'retainer', key: 'retainer' },
      { value: 'royalty', key: 'royalty' },
      { value: 'hourly_work', key: 'hourly_work' },
    ],
  },
  {
    value: 'student',
    icon: '🎓',
    professions: ['student'],
    workTypes: [
      { value: 'part_time_job', key: 'part_time_job' },
      { value: 'internship', key: 'internship' },
      { value: 'tuition', key: 'tuition' },
      { value: 'freelance_help', key: 'freelance_help' },
    ],
  },
  {
    value: 'homemaker',
    icon: '🏠',
    professions: ['homemaker'],
    workTypes: [
      { value: 'household_work', key: 'household_work' },
      { value: 'rental_income', key: 'rental_income' },
      { value: 'catering', key: 'catering' },
      { value: 'handicraft_sale', key: 'handicraft_sale' },
    ],
  },
  {
    value: 'investor',
    icon: '📈',
    professions: ['investor'],
    workTypes: [
      { value: 'trading', key: 'trading' },
      { value: 'dividend_income', key: 'dividend_income' },
      { value: 'capital_gains', key: 'capital_gains' },
      { value: 'interest_income', key: 'interest_income' },
      { value: 'rental_income', key: 'rental_income' },
    ],
  },
  {
    value: 'retired',
    icon: '🏖️',
    professions: ['retired'],
    workTypes: [
      { value: 'pension', key: 'pension' },
      { value: 'part_time_work', key: 'part_time_work' },
      { value: 'consulting', key: 'consulting' },
      { value: 'rental_income', key: 'rental_income' },
    ],
  },
  {
    value: 'farm_services',
    icon: '🚜',
    professions: [],
    workTypes: [
      { value: 'ploughing_service', key: 'ploughing_service' },
      { value: 'rotavator', key: 'rotavator' },
      { value: 'cultivator', key: 'cultivator' },
      { value: 'seed_drilling', key: 'seed_drilling' },
      { value: 'trolley_transport', key: 'trolley_transport' },
      { value: 'water_tanker', key: 'water_tanker' },
      { value: 'harvester_service', key: 'harvester_service' },
    ],
  },
  {
    value: 'labor',
    icon: '👷',
    professions: [],
    workTypes: [
      { value: 'farm_labor', key: 'farm_labor' },
      { value: 'construction_labor', key: 'construction_labor' },
      { value: 'loading_unloading', key: 'loading_unloading' },
      { value: 'earth_work', key: 'earth_work' },
    ],
  },
  {
    value: 'shop',
    icon: '🏪',
    professions: ['business'],
    workTypes: [
      { value: 'supply_order', key: 'supply_order' },
      { value: 'delivery', key: 'delivery' },
      { value: 'installation', key: 'installation' },
      { value: 'repair_job', key: 'repair_job' },
    ],
  },
  {
    value: 'employer',
    icon: '🏢',
    professions: ['salaried', 'business'],
    workTypes: [
      { value: 'payroll', key: 'payroll' },
      { value: 'contractor_payment', key: 'contractor_payment' },
      { value: 'material_purchase', key: 'material_purchase' },
      { value: 'invoice_out', key: 'invoice_out' },
      { value: 'labour', key: 'labour' },
    ],
  },
  {
    value: 'contractor',
    icon: '📋',
    professions: [],
    workTypes: [
      { value: 'site_work', key: 'site_work' },
      { value: 'labor_contract', key: 'labor_contract' },
      { value: 'material_supply', key: 'material_supply' },
    ],
  },
  {
    value: 'transport',
    icon: '🚛',
    professions: [],
    workTypes: [
      { value: 'goods_trip', key: 'goods_trip' },
      { value: 'passenger_trip', key: 'passenger_trip' },
      { value: 'vehicle_rental', key: 'vehicle_rental' },
    ],
  },
  {
    value: 'general',
    icon: '👤',
    professions: ['other'],
    workTypes: [
      { value: 'freelance_task', key: 'freelance_task' },
      { value: 'commission_work', key: 'commission_work' },
      { value: 'home_repair', key: 'home_repair' },
    ],
  },
];

export const AREA_UNITS = ['acre', 'hectare', 'guntha', 'are'] as const;

export function getWorkProfile(value: string | undefined | null): WorkProfile {
  const hit = WORK_PROFILES.find(p => p.value === value);
  return hit || WORK_PROFILES.find(p => p.value === 'general') || WORK_PROFILES[0];
}

// Onboarding profession → its matching work profile(s), ordered most-relevant first.
// Used by the Works add-form to surface the user's profession-specific options on top.
export function workProfilesForProfession(profession: string | undefined | null): WorkProfile[] {
  const matches = WORK_PROFILES.filter(p => profession && p.professions.includes(profession));
  const rest = WORK_PROFILES.filter(p => !profession || !p.professions.includes(profession));
  return [...matches, ...rest];
}

// Map an onboarding profession → default work profile (first match wins)
export function profileForProfession(profession: string | undefined | null): string {
  if (!profession) return 'general';
  const hit = WORK_PROFILES.find(p => p.professions.includes(profession));
  return hit ? hit.value : 'general';
}
