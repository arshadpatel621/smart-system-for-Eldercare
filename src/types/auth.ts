export type UserRole = 'admin' | 'caregiver' | 'elder';
export type PublicUserRole = 'caregiver' | 'elder';

export type AccountStatus = 'active' | 'inactive' | 'disabled';

export interface AppUserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  elderId?: string; // Present for Elders (e.g. ELD-7K4P92)
  linkedElderIds?: string[]; // Present for Caregivers (array of ELD-XXXXXX IDs)
  authProvider: 'password' | 'google';
  createdAt: string;
  phone?: string;
  address?: string;
  organization?: string;
  status?: AccountStatus;
  // Caregiver-specific professional fields
  qualifications?: string;
  certifications?: string;
  specialization?: string;
  experienceYears?: number;
  joiningDate?: string;
}


