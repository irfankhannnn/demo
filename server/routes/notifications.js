import express from 'express';
import {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationCounts,
  deleteOldNotifications,
  processDueNotifications,
  generateRentExpiryNotifications,
  NotificationCategory,
  NotificationType,
} from '../notificationDynamodbService.js';
import { getPropertiesByStatus } from '../crmDynamodbService.js';
import { getAgencyConfig, updateAgencyConfig } from '../agencyConfigService.js';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import validateBody from '../middleware/validateBody.js';
import {
  updateNotificationSettingsSchema,
  createTestNotificationSchema,
} from '../validation/otherSchemas.js';

const router = express.Router();

// ============== Notification Inbox Routes ==============

// Get all notifications with optional filters
router.get('/', validateToken, extractTenantId, async (req, res) => {
  try {
    const { category, unreadOnly, limit } = req.query;
    
    const options = {
      category: category || null,
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : 50,
    };

    const notifications = await getNotifications(req.tenantId, options);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to get notifications' });
  }
});

// Get notification counts (for badge display)
router.get('/counts', validateToken, extractTenantId, async (req, res) => {
  try {
    const counts = await getNotificationCounts(req.tenantId);
    res.json(counts);
  } catch (error) {
    console.error('Get notification counts error:', error);
    res.status(500).json({ error: error.message || 'Failed to get notification counts' });
  }
});

// Mark a notification as read
router.post('/:notificationId/read', validateToken, extractTenantId, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await markNotificationAsRead(req.tenantId, notificationId);
    res.json(notification);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', validateToken, extractTenantId, async (req, res) => {
  try {
    const result = await markAllNotificationsAsRead(req.tenantId);
    res.json(result);
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark all notifications as read' });
  }
});

// Delete old notifications (cleanup)
router.delete('/cleanup', validateToken, extractTenantId, async (req, res) => {
  try {
    const { daysOld } = req.query;
    const result = await deleteOldNotifications(req.tenantId, daysOld ? parseInt(daysOld, 10) : 30);
    res.json(result);
  } catch (error) {
    console.error('Delete old notifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete old notifications' });
  }
});

// ============== Notification Processing Routes ==============

// Process due scheduled notifications (can be called by a cron job or manually)
router.post('/process-scheduled', validateToken, extractTenantId, async (req, res) => {
  try {
    const result = await processDueNotifications(req.tenantId);
    res.json(result);
  } catch (error) {
    console.error('Process scheduled notifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to process scheduled notifications' });
  }
});

// Generate rent expiry notifications (can be called by a cron job or manually)
router.post('/generate-rent-expiry', validateToken, extractTenantId, async (req, res) => {
  try {
    // Get notification settings
    const config = await getAgencyConfig(req.tenantId);
    const thresholdDays = config?.notificationSettings?.rentedExpiryThresholdDays || 30;

    // Get rented properties
    const rentedProperties = await getPropertiesByStatus(req.tenantId, 'rented');

    // Generate notifications
    const result = await generateRentExpiryNotifications(req.tenantId, rentedProperties, thresholdDays);
    res.json(result);
  } catch (error) {
    console.error('Generate rent expiry notifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate rent expiry notifications' });
  }
});

// Combined processing endpoint (process scheduled + generate rent expiry)
router.post('/process-all', validateToken, extractTenantId, async (req, res) => {
  try {
    const results = {
      scheduled: null,
      rentExpiry: null,
    };

    // Process scheduled notifications
    results.scheduled = await processDueNotifications(req.tenantId);

    // Get notification settings
    const config = await getAgencyConfig(req.tenantId);
    const thresholdDays = config?.notificationSettings?.rentedExpiryThresholdDays || 30;

    // Get rented properties and generate expiry notifications
    const rentedProperties = await getPropertiesByStatus(req.tenantId, 'rented');
    results.rentExpiry = await generateRentExpiryNotifications(req.tenantId, rentedProperties, thresholdDays);

    res.json(results);
  } catch (error) {
    console.error('Process all notifications error:', error);
    res.status(500).json({ error: error.message || 'Failed to process notifications' });
  }
});

// ============== Notification Settings Routes ==============

// Get notification settings
router.get('/settings', validateToken, extractTenantId, async (req, res) => {
  try {
    const config = await getAgencyConfig(req.tenantId);
    
    // Return default settings if not configured
    const defaultSettings = {
      rentedExpiryThresholdDays: 30,
      meetingReminderMinutes: 15,
      enableRentExpiryNotifications: true,
      enableMeetingReminders: true,
      enableKhataReminders: true,
    };

    const settings = config?.notificationSettings || defaultSettings;
    res.json(settings);
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to get notification settings' });
  }
});

// Update notification settings
router.put('/settings', validateToken, extractTenantId, validateBody(updateNotificationSettingsSchema), async (req, res) => {
  try {
    const {
      rentedExpiryThresholdDays,
      meetingReminderMinutes,
      enableRentExpiryNotifications,
      enableMeetingReminders,
      enableKhataReminders,
    } = req.body;

    const notificationSettings = {
      rentedExpiryThresholdDays: rentedExpiryThresholdDays ?? 30,
      meetingReminderMinutes: meetingReminderMinutes ?? 15,
      enableRentExpiryNotifications: enableRentExpiryNotifications ?? true,
      enableMeetingReminders: enableMeetingReminders ?? true,
      enableKhataReminders: enableKhataReminders ?? true,
    };

    await updateAgencyConfig(req.tenantId, { notificationSettings });
    res.json(notificationSettings);
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: error.message || 'Failed to update notification settings' });
  }
});

// ============== Test/Debug Routes ==============

// Create a test notification (for debugging)
router.post('/test', validateToken, extractTenantId, validateBody(createTestNotificationSchema), async (req, res) => {
  try {
    const { category, type, title, message, deepLink } = req.body;

    const notification = await createNotification(req.tenantId, {
      category: category || NotificationCategory.PROPERTIES,
      type: type || 'TEST',
      title: title || 'Test Notification',
      message: message || 'This is a test notification',
      deepLink: deepLink || '/crm',
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Create test notification error:', error);
    res.status(500).json({ error: error.message || 'Failed to create test notification' });
  }
});

export default router;
