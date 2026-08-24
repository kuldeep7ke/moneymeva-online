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
      { value: 'land_prep', key: 'land_prep' },       // मशागत
      { value: 'sowing', key: 'sowing' },             // पेरणी
      { value: 'fertilizing', key: 'fertilizing' },   // खत देणे
      { value: 'weeding', key: 'weeding' },           // निंदण / तण
      { value: 'spraying', key: 'spraying' },         // फवारण
      { value: 'irrigation', key: 'irrigation' },     // पाणी / सिंचन
      { value: 'harvesting', key: 'harvesting' },     // काढणी
      { value: 'threshing', key: 'threshing' },       // मळणी
      { value: 'transport', key: 'transport' },       // वाहतूक
      { value: 'produce_sale', key: 'produce_sale' }, // उत्पादन विक्री
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
    professions: ['salaried', 'freelancer', 'student', 'homemaker', 'retired', 'investor', 'medical', 'other'],
    workTypes: [
      { value: 'freelance_task', key: 'freelance_task' },
      { value: 'commission_work', key: 'commission_work' },
      { value: 'home_repair', key: 'home_repair' },
    ],
  },
];

export const AREA_UNITS = ['acre', 'hectare', 'guntha', 'are'] as const;

export function getWorkProfile(value: string | undefined | null): WorkProfile {
  return WORK_PROFILES.find(p => p.value === value) || WORK_PROFILES[WORK_PROFILES.length - 1];
}

// Map an onboarding profession → default work profile (first match wins)
export function profileForProfession(profession: string | undefined | null): string {
  if (!profession) return 'general';
  const hit = WORK_PROFILES.find(p => p.professions.includes(profession));
  return hit ? hit.value : 'general';
}
