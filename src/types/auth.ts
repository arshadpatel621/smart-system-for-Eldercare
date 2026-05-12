export type UserRole = 'admin' | 'caregiver' | 'elder';

export interface AppUserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: UserRole;
  elderId: string;
  authProvider: 'password' | 'google';
  createdAt: string;
}
