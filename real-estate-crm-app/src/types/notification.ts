export type NotificationCategory = 
  | 'ENQUIRIES'
  | 'OWNERS'
  | 'TENANTS'
  | 'PROPERTIES'
  | 'KHATABOOK';

export type NotificationType =
  | 'RENT_EXPIRY_SOON'
  | 'MEETING_REMINDER_15M'
  | 'KHATA_REMINDER'
  | 'NEW_ENQUIRY'
  | 'TEST';

export interface NotificationEntityRef {
  entityType: 'property' | 'meeting' | 'khata' | 'enquiry' | 'owner' | 'tenant';
  entityId: string;
}

export interface Notification {
  notificationId: string;
  tenantId: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  deepLink?: string;
  entityRef?: NotificationEntityRef;
  readAt?: string;
  createdAt: string;
}

export interface NotificationCounts {
  total: number;
  byCategory: {
    ENQUIRIES: number;
    OWNERS: number;
    TENANTS: number;
    PROPERTIES: number;
    KHATABOOK: number;
  };
}

export interface NotificationSettings {
  rentedExpiryThresholdDays: number;
  meetingReminderMinutes: number;
  enableRentExpiryNotifications: boolean;
  enableMeetingReminders: boolean;
  enableKhataReminders: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  rentedExpiryThresholdDays: 30,
  meetingReminderMinutes: 15,
  enableRentExpiryNotifications: true,
  enableMeetingReminders: true,
  enableKhataReminders: true,
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  ENQUIRIES: 'Enquiries',
  OWNERS: 'Owners',
  TENANTS: 'Tenants',
  PROPERTIES: 'Properties',
  KHATABOOK: 'Khata Book',
};

export const NOTIFICATION_CATEGORY_ICONS: Record<NotificationCategory, string> = {
  ENQUIRIES: 'MessageSquare',
  OWNERS: 'Users',
  TENANTS: 'UserCheck',
  PROPERTIES: 'Building2',
  KHATABOOK: 'BookOpen',
};
