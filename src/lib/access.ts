import type { UserRole } from '../types/auth';

export const roleAccess = {
  all: ['admin', 'caregiver', 'elder'],
  careTeam: ['admin', 'caregiver'],
} satisfies Record<string, UserRole[]>;

export const navItems = [
  { path: '/', icon: 'dashboard', label: 'Dashboard', roles: roleAccess.all },
  { path: '/health', icon: 'monitor_heart', label: 'Health Monitor', roles: roleAccess.all },
  { path: '/routine', icon: 'event_repeat', label: 'Routine', roles: roleAccess.all },
  { path: '/team', icon: 'group', label: 'Care Team', roles: roleAccess.careTeam },
  { path: '/insights', icon: 'psychology', label: 'AI Insights', roles: roleAccess.all },
  { path: '/camera', icon: 'videocam', label: 'Live Monitor', roles: roleAccess.careTeam },
  { path: '/cameras', icon: 'video_settings', label: 'Camera Mgmt', roles: roleAccess.careTeam },
  { path: '/notifications', icon: 'notifications', label: 'Notifications', roles: roleAccess.all },
  { path: '/emergency', icon: 'emergency', label: 'Emergency Center', roles: roleAccess.all },
  { path: '/settings', icon: 'settings', label: 'Settings', roles: roleAccess.all },
];

export function hasRoleAccess(role: UserRole | null | undefined, allowedRoles: UserRole[]) {
  return !!role && allowedRoles.includes(role);
}
