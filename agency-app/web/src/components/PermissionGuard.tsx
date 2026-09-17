/**
 * PermissionGuard component - conditionally renders children based on permissions.
 * Use this to hide/show UI elements based on user role/permissions.
 */

import { ReactNode } from 'react';
import { hasPermission, type Permission } from '../utils/rbac';

interface PermissionGuardProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  if (hasPermission(permission)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
}
