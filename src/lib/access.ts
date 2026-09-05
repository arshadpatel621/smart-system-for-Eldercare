import type { UserRole } from '../types/auth';

export const roleAccess = {
  all: ['admin', 'caregiver', 'elder'] as UserRole[],
  careTeam: ['admin', 'caregiver'] as UserRole[],
  adminOnly: ['admin'] as UserRole[],
};

type NavItem = { path: string; icon: string; label: string; roles: UserRole[] };

/** Admin Navigation — System Management & Platform Oversight */
const adminNav: NavItem[] = [
  { path: '/admin/dashboard',     icon: 'dashboard',      label: 'Dashboard',       roles: roleAccess.adminOnly },
  { path: '/admin/users',         icon: 'manage_accounts',label: 'Users',           roles: roleAccess.adminOnly },
  { path: '/admin/residents',     icon: 'elderly',        label: 'Residents',       roles: roleAccess.adminOnly },
  { path: '/admin/relationships', icon: 'link',           label: 'Relationships',   roles: roleAccess.adminOnly },
  { path: '/admin/devices',       icon: 'devices',        label: 'Device Registry', roles: roleAccess.adminOnly },
  { path: '/admin/monitoring',    icon: 'monitor_heart',  label: 'System Monitoring',roles: roleAccess.adminOnly },
  { path: '/admin/ai',            icon: 'psychology',     label: 'AI & Analytics',  roles: roleAccess.adminOnly },
  { path: '/admin/incidents',     icon: 'report_problem', label: 'Incidents',       roles: roleAccess.adminOnly },
  { path: '/admin/audit',         icon: 'history',        label: 'Audit Logs',      roles: roleAccess.adminOnly },
  { path: '/admin/settings',      icon: 'settings',       label: 'Settings',        roles: roleAccess.adminOnly },
  { path: '/admin/account',       icon: 'person',          label: 'My Account',      roles: roleAccess.adminOnly },
];

/** Caregiver Navigation — Operational Caregiver Monitoring of Linked Elders */
const caregiverNav: NavItem[] = [
  { path: '/caregiver/dashboard', icon: 'dashboard',      label: 'Dashboard',       roles: roleAccess.careTeam },
  { path: '/caregiver/elders',    icon: 'elderly',        label: 'My Elders',       roles: roleAccess.careTeam },
  { path: '/caregiver/health',    icon: 'monitor_heart',  label: 'Health Monitor',  roles: roleAccess.careTeam },
  { path: '/caregiver/live-monitor',icon: 'videocam',     label: 'Live Monitor',    roles: roleAccess.careTeam },
  { path: '/caregiver/devices',   icon: 'devices',        label: 'Device Mgmt',     roles: roleAccess.careTeam },
  { path: '/caregiver/routine',   icon: 'event_repeat',   label: 'Routine',         roles: roleAccess.careTeam },
  { path: '/caregiver/care-team', icon: 'group',          label: 'Care Team',       roles: roleAccess.careTeam },
  { path: '/caregiver/ai-insights',icon: 'psychology',    label: 'AI Insights',     roles: roleAccess.careTeam },
  { path: '/caregiver/notifications',icon: 'notifications',label: 'Notifications',  roles: roleAccess.careTeam },
  { path: '/caregiver/emergency', icon: 'emergency',      label: 'Emergency',       roles: roleAccess.careTeam },
  { path: '/caregiver/account',   icon: 'person',          label: 'My Account',      roles: roleAccess.careTeam },
  { path: '/caregiver/settings',  icon: 'settings',       label: 'Settings',        roles: roleAccess.careTeam },
];

/** Elder Navigation — Personal Health, Daily Routine, Devices, AI Insights & Live Monitor */
const elderNav: NavItem[] = [
  { path: '/elder/dashboard',     icon: 'dashboard',      label: 'Dashboard',       roles: roleAccess.all },
  { path: '/elder/health',        icon: 'monitor_heart',  label: 'Health Monitor',  roles: roleAccess.all },
  { path: '/elder/live-monitor',  icon: 'videocam',       label: 'Live Monitor',    roles: roleAccess.all },
  { path: '/elder/devices',       icon: 'devices',        label: 'Device Mgmt',     roles: roleAccess.all },
  { path: '/elder/routine',       icon: 'event_repeat',   label: 'My Routine',      roles: roleAccess.all },
  { path: '/elder/ai-insights',   icon: 'psychology',     label: 'AI Insights',     roles: roleAccess.all },
  { path: '/elder/care-team',     icon: 'group',          label: 'Care Team',       roles: roleAccess.all },
  { path: '/elder/notifications', icon: 'notifications',  label: 'Notifications',   roles: roleAccess.all },
  { path: '/elder/emergency',     icon: 'emergency',      label: 'Emergency / Help',roles: roleAccess.all },
  { path: '/elder/account',       icon: 'person',          label: 'My Account',      roles: roleAccess.all },
  { path: '/elder/settings',      icon: 'settings',       label: 'Settings',        roles: roleAccess.all },
];

export const navItems = adminNav;

export function getRoleNavItems(role: UserRole | null | undefined): NavItem[] {
  if (role === 'admin') return adminNav;
  if (role === 'caregiver') return caregiverNav;
  if (role === 'elder') return elderNav;
  return [];
}

export function hasRoleAccess(role: UserRole | null | undefined, allowedRoles: UserRole[]) {
  return !!role && allowedRoles.includes(role);
}

export function getDashboardPathForRole(role: UserRole | null | undefined): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'caregiver') return '/caregiver/dashboard';
  if (role === 'elder') return '/elder/dashboard';
  return '/login';
}
