// Core data types for the Urenregistratie Calculator

export interface Profile {
  id: string;
  name: string;
  hourlyRate: number;
  deductionType: 'Uurloon' | 'Marge';
  deductions: Deduction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Deduction {
  id: string;
  name: string;
  amount: number;
  type: 'percentage' | 'fixed';
  priority: number; // Lower number = higher priority
}

export interface HoursEntry {
  id: string;
  profileId: string;
  date: Date;
  hours: number;
  description?: string;
}

export interface CalculationResult {
  profileId: string;
  profileName: string;
  totalHours: number;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  deductionBreakdown: DeductionBreakdown[];
}

export interface DeductionBreakdown {
  deductionId: string;
  deductionName: string;
  amount: number;
  type: 'percentage' | 'fixed';
}

export interface ClientPayment {
  totalAmount: number;
  totalHours: number;
  averageRate: number;
}

export interface PaymentDistribution {
  profileId: string;
  profileName: string;
  amount: number;
  percentage: number;
}

export interface AppSettings {
  currency: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  defaultDeductions: Deduction[];
  theme: 'light' | 'dark' | 'auto';
}

export interface ExportData {
  profiles: Profile[];
  hoursEntries: HoursEntry[];
  settings: AppSettings;
  exportDate: Date;
  version: string;
}

// UI State types
export interface ModalState {
  isOpen: boolean;
  type: 'profile' | 'export' | 'import' | null;
  data?: any;
}

export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

// Form types
export interface ProfileFormData {
  name: string;
  hourlyRate: number;
  deductionType: 'Uurloon' | 'Marge';
  deductions: Omit<Deduction, 'id'>[];
}

export interface HoursFormData {
  profileId: string;
  date: Date;
  hours: number;
  description?: string;
}

// Utility types
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export interface FilterConfig {
  search: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  profiles: string[];
}

// API/Storage types
export interface StorageService {
  saveProfiles: (profiles: Profile[]) => Promise<void>;
  loadProfiles: () => Promise<Profile[]>;
  saveHoursEntries: (entries: HoursEntry[]) => Promise<void>;
  loadHoursEntries: () => Promise<HoursEntry[]>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  loadSettings: () => Promise<AppSettings>;
  exportData: () => Promise<ExportData>;
  importData: (data: ExportData) => Promise<void>;
  clearAllData: () => Promise<void>;
}
