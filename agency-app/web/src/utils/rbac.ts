/**
 * RBAC (Role-Based Access Control) utilities.
 * Simple permission system: Admin can do everything, Members cannot delete.
 */

import { getUserProfile } from './authStorage';

export type Permission = 'create' | 'read' | 'update' | 'delete';

const ELEVATED_ROLES = ['ADMIN', 'MANAGER', 'FOUNDER', 'OWNER'] as const;

/**
 * Check if the current user has a specific permission.
 * Elevated roles: all permissions (CRUD)
 * Member: Create, Read, Update only (no Delete)
 */
export function hasPermission(permission: Permission): boolean {
  const profile = getUserProfile();
  if (!profile) return false;

  if (ELEVATED_ROLES.includes(profile.role as typeof ELEVATED_ROLES[number])) {
    return true;
  }

  if (profile.role === 'MEMBER' && permission === 'delete') {
    return false;
  }

  return true;
}

/**
 * Check if current user is an admin.
 */
export function isAdmin(): boolean {
  const profile = getUserProfile();
  return profile?.role === 'ADMIN';
}

/**
 * Check if current user can delete leads or perform admin-only lead actions.
 */
export function canManageLeads(): boolean {
  const profile = getUserProfile();
  if (!profile) return false;
  return ['ADMIN', 'MANAGER', 'FOUNDER', 'OWNER'].includes(profile.role);
}

/**
 * Check if current user is a member.
 */
export function isMember(): boolean {
  const profile = getUserProfile();
  return profile?.role === 'MEMBER';
}

/**
 * Get the current user's role as a human-readable string.
 */
export function getRoleLabel(): string {
  const profile = getUserProfile();
  if (!profile) return 'Unknown';
  return profile.role === 'ADMIN' ? 'Admin' : 'Member';
}

/**
 * Get agency membership description for display.
 * Example: "Admin of CloudBerry Solutions" or "Member of CloudBerry Solutions"
 */
export function getAgencyMembershipDescription(): string {
  const profile = getUserProfile();
  if (!profile || !profile.agency) return '';
  
  const roleLabel = profile.role === 'ADMIN' ? 'Admin' : 'Member';
  return `${roleLabel} of ${profile.agency.agencyName}`;
}
