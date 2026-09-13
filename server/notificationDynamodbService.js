import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import { dispatchPushForNotification } from './services/push/pushService.js';
import { sendEmail } from './emailService.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables from server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const NOTIFICATIONS_TABLE_NAME = process.env.NOTIFICATIONS_TABLE_NAME || 'cloudberry-real-estate-notifications';

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: NOTIFICATIONS_TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Notification DynamoDB Single Table Design (Multi-Tenant):
 * 
 * PK Pattern:
 * - TENANT#{tenantId}#NOTIFICATIONS (for inbox notifications)
 * - TENANT#{tenantId}#SCHEDULED (for scheduled reminders)
 * 
 * SK Pattern:
 * - NOTIF#{createdAt}#{notificationId} (for inbox, sorted by time)
 * - DUE#{dueAt}#{scheduledId} (for scheduled, sorted by due time)
 * 
 * GSI1: unread-index
 * - GSI1PK = TENANT#{tenantId}#UNREAD
 * - GSI1SK = NOTIF#{createdAt}#{notificationId}
 * 
 * Categories: ENQUIRIES, OWNERS, TENANTS, PROPERTIES, KHATABOOK
 * Types: 
 *   - RENT_EXPIRY_SOON
 *   - MEETING_REMINDER_15M
 *   - KHATA_REMINDER
 *   - NEW_ENQUIRY
 */

// ============== Notification Categories & Types ==============
export const NotificationCategory = {
  ENQUIRIES: 'ENQUIRIES',
  OWNERS: 'OWNERS',
  TENANTS: 'TENANTS',
  PROPERTIES: 'PROPERTIES',
  KHATABOOK: 'KHATABOOK',
  LEADS: 'LEADS',
};

export const NotificationType = {
  RENT_EXPIRY_SOON: 'RENT_EXPIRY_SOON',
  MEETING_REMINDER_15M: 'MEETING_REMINDER_15M',
  KHATA_REMINDER: 'KHATA_REMINDER',
  NEW_ENQUIRY: 'NEW_ENQUIRY',
  NEW_LEAD: 'NEW_LEAD',
  LEAD_ASSIGNED: 'LEAD_ASSIGNED',
  LEAD_HOT: 'LEAD_HOT',
  SITE_VISIT_BOOKED: 'SITE_VISIT_BOOKED',
};

// ============== Inbox Notification Operations ==============

/**
 * Create a new inbox notification
 */
export async function createNotification(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const notificationId = uuidv4();
  const createdAt = new Date().toISOString();

  const notification = {
    PK: `TENANT#${tenantId}#NOTIFICATIONS`,
    SK: `NOTIF#${createdAt}#${notificationId}`,
    EntityType: 'NOTIFICATION',
    tenantId,
    notificationId,
    category: data.category, // ENQUIRIES, OWNERS, TENANTS, PROPERTIES, KHATABOOK
    type: data.type, // RENT_EXPIRY_SOON, MEETING_REMINDER_15M, KHATA_REMINDER, etc.
    title: data.title,
    message: data.message,
    deepLink: data.deepLink || null, // e.g., /crm/properties/123
    entityRef: data.entityRef || null, // { entityType: 'property', entityId: '...' }
    dedupeKey: data.dedupeKey || null, // For preventing duplicate notifications
    // Optional: narrows the push audience to one team member. The inbox itself
    // stays tenant-wide, so this only affects who gets buzzed on their phone.
    targetUserId: data.targetUserId || null,
    // Optional: narrows the push audience to a specific set of team members
    // (e.g. a lead's assignee + the agency owner, never the customer) rather
    // than either "one person" or "the whole tenant". Takes priority over
    // targetUserId when present — see dispatchPushForNotification.
    targetUserIds: Array.isArray(data.targetUserIds) && data.targetUserIds.length ? data.targetUserIds : null,
    readAt: null,
    createdAt,
    // GSI for unread notifications
    GSI1PK: `TENANT#${tenantId}#UNREAD`,
    GSI1SK: `NOTIF#${createdAt}#${notificationId}`,
  };

  // Check for duplicate if dedupeKey is provided
  if (data.dedupeKey) {
    const existing = await getNotificationByDedupeKey(tenantId, data.dedupeKey);
    if (existing) {
      logger.info('notification.create.duplicate', { tenantId, dedupeKey: data.dedupeKey });
      return existing;
    }
  }

  await docClient.send(new PutCommand({
    TableName: NOTIFICATIONS_TABLE_NAME,
    Item: notification,
  }));

  logger.info('notification.create.success', { tenantId, notificationId, type: data.type });

  // Mirror to the user's phones. Every in-app notification funnels through this
  // function, so hooking here is what makes push work for the whole feature
  // rather than the handful of call sites that exist today. dispatchPush never
  // throws and returns immediately while Firebase is unconfigured, so the
  // notification write above is not put at risk by it.
  await dispatchPushForNotification(tenantId, notification);

  return notification;
}

/**
 * Get notifications for a tenant with optional filters
 */
export async function getNotifications(tenantId, options = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const { category, unreadOnly, limit = 50 } = options;

  let params;

  if (unreadOnly) {
    // Query GSI for unread notifications
    params = {
      TableName: NOTIFICATIONS_TABLE_NAME,
      IndexName: 'unread-index',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}#UNREAD`,
      },
      ScanIndexForward: false, // Newest first
      Limit: limit,
    };
  } else {
    // Query all notifications
    params = {
      TableName: NOTIFICATIONS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}#NOTIFICATIONS`,
        ':sk': 'NOTIF#',
      },
      ScanIndexForward: false, // Newest first
      Limit: limit,
    };
  }

  const result = await docClient.send(new QueryCommand(params));
  let notifications = result.Items || [];

  // Filter by category if specified
  if (category) {
    notifications = notifications.filter(n => n.category === category);
  }

  return notifications;
}

/**
 * Get a notification by its dedupeKey
 */
export async function getNotificationByDedupeKey(tenantId, dedupeKey) {
  if (!tenantId || !dedupeKey) {
    return null;
  }

  const params = {
    TableName: NOTIFICATIONS_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    FilterExpression: 'dedupeKey = :dedupeKey',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#NOTIFICATIONS`,
      ':sk': 'NOTIF#',
      ':dedupeKey': dedupeKey,
    },
  };

  const result = await docClient.send(new QueryCommand(params));
  return result.Items?.[0] || null;
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(tenantId, notificationId) {
  if (!tenantId || !notificationId) {
    throw new Error('Tenant ID and Notification ID are required');
  }

  // First, find the notification to get its SK
  const notifications = await getNotifications(tenantId, { limit: 200 });
  const notification = notifications.find(n => n.notificationId === notificationId);

  if (!notification) {
    throw new Error('Notification not found');
  }

  const now = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: NOTIFICATIONS_TABLE_NAME,
    Key: {
      PK: notification.PK,
      SK: notification.SK,
    },
    UpdateExpression: 'SET readAt = :readAt REMOVE GSI1PK, GSI1SK',
    ExpressionAttributeValues: {
      ':readAt': now,
    },
  }));

  return { ...notification, readAt: now };
}

/**
 * Mark all notifications as read for a tenant
 */
export async function markAllNotificationsAsRead(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const unreadNotifications = await getNotifications(tenantId, { unreadOnly: true, limit: 200 });

  if (unreadNotifications.length === 0) {
    return { updated: 0 };
  }

  const now = new Date().toISOString();

  // Update each notification
  const updatePromises = unreadNotifications.map(notification =>
    docClient.send(new UpdateCommand({
      TableName: NOTIFICATIONS_TABLE_NAME,
      Key: {
        PK: notification.PK,
        SK: notification.SK,
      },
      UpdateExpression: 'SET readAt = :readAt REMOVE GSI1PK, GSI1SK',
      ExpressionAttributeValues: {
        ':readAt': now,
      },
    }))
  );

  await Promise.all(updatePromises);

  return { updated: unreadNotifications.length };
}

/**
 * Get notification counts by category
 */
export async function getNotificationCounts(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Get unread notifications
  const unreadNotifications = await getNotifications(tenantId, { unreadOnly: true, limit: 500 });

  const counts = {
    total: unreadNotifications.length,
    byCategory: {
      [NotificationCategory.ENQUIRIES]: 0,
      [NotificationCategory.OWNERS]: 0,
      [NotificationCategory.TENANTS]: 0,
      [NotificationCategory.PROPERTIES]: 0,
      [NotificationCategory.KHATABOOK]: 0,
    },
  };

  unreadNotifications.forEach(n => {
    if (counts.byCategory[n.category] !== undefined) {
      counts.byCategory[n.category]++;
    }
  });

  return counts;
}

/**
 * Delete old notifications (cleanup job)
 */
export async function deleteOldNotifications(tenantId, daysOld = 30) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffIso = cutoffDate.toISOString();

  const params = {
    TableName: NOTIFICATIONS_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND SK < :sk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#NOTIFICATIONS`,
      ':sk': `NOTIF#${cutoffIso}`,
    },
  };

  const result = await docClient.send(new QueryCommand(params));
  const oldNotifications = result.Items || [];

  if (oldNotifications.length === 0) {
    return { deleted: 0 };
  }

  // Delete in batches of 25
  const batches = [];
  for (let i = 0; i < oldNotifications.length; i += 25) {
    batches.push(oldNotifications.slice(i, i + 25));
  }

  for (const batch of batches) {
    const deleteRequests = batch.map(n => ({
      DeleteRequest: {
        Key: { PK: n.PK, SK: n.SK },
      },
    }));

    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [NOTIFICATIONS_TABLE_NAME]: deleteRequests,
      },
    }));
  }

  return { deleted: oldNotifications.length };
}

// ============== Scheduled Notification Operations ==============

/**
 * Create a scheduled notification (for future delivery)
 */
export async function createScheduledNotification(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (!data.dueAt) {
    throw new Error('dueAt is required for scheduled notifications');
  }

  const scheduledId = uuidv4();
  const createdAt = new Date().toISOString();

  const scheduled = {
    PK: `TENANT#${tenantId}#SCHEDULED`,
    SK: `DUE#${data.dueAt}#${scheduledId}`,
    EntityType: 'SCHEDULED_NOTIFICATION',
    tenantId,
    scheduledId,
    dueAt: data.dueAt,
    status: 'pending', // pending, fired, cancelled
    dedupeKey: data.dedupeKey || null,
    payload: {
      category: data.category,
      type: data.type,
      title: data.title,
      message: data.message,
      deepLink: data.deepLink,
      entityRef: data.entityRef,
    },
    createdAt,
    updatedAt: createdAt,
  };

  // Check for duplicate if dedupeKey is provided
  if (data.dedupeKey) {
    const existing = await getScheduledNotificationByDedupeKey(tenantId, data.dedupeKey);
    if (existing && existing.status === 'pending') {
      // Update existing instead of creating new
      return await updateScheduledNotification(tenantId, existing.scheduledId, {
        dueAt: data.dueAt,
        payload: scheduled.payload,
      });
    }
  }

  await docClient.send(new PutCommand({
    TableName: NOTIFICATIONS_TABLE_NAME,
    Item: scheduled,
  }));

  logger.info('scheduledNotification.create.success', { tenantId, scheduledId, dueAt: data.dueAt });
  return scheduled;
}

/**
 * Get scheduled notifications that are due
 */
export async function getDueScheduledNotifications(tenantId, beforeTime) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const cutoff = beforeTime || new Date().toISOString();

  const params = {
    TableName: NOTIFICATIONS_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND SK <= :sk',
    FilterExpression: '#status = :pending',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#SCHEDULED`,
      ':sk': `DUE#${cutoff}`,
      ':pending': 'pending',
    },
  };

  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Get all pending scheduled notifications for a tenant
 */
export async function getPendingScheduledNotifications(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const params = {
    TableName: NOTIFICATIONS_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    FilterExpression: '#status = :pending',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#SCHEDULED`,
      ':sk': 'DUE#',
      ':pending': 'pending',
    },
  };

  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * Get the current PENDING scheduled notification for a dedupeKey. A
 * dedupeKey accumulates one row per reschedule (cancel+recreate, never an
 * in-place update), so old fired/cancelled rows for the same dedupeKey stay
 * in the table indefinitely. Without the status filter and descending sort
 * below, this query's default ascending-by-SK order returns whichever row
 * has the EARLIEST dueAt — almost always a stale fired/cancelled one once a
 * meeting's been rescheduled even once — silently starving every caller
 * (attachMeetingReminderRecipients, cancelScheduledNotificationByDedupeKey)
 * of the actually-pending row they're looking for.
 */
export async function getScheduledNotificationByDedupeKey(tenantId, dedupeKey) {
  if (!tenantId || !dedupeKey) {
    return null;
  }

  const params = {
    TableName: NOTIFICATIONS_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    FilterExpression: 'dedupeKey = :dedupeKey AND #status = :pending',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#SCHEDULED`,
      ':sk': 'DUE#',
      ':dedupeKey': dedupeKey,
      ':pending': 'pending',
    },
    ScanIndexForward: false,
  };

  const result = await docClient.send(new QueryCommand(params));
  return result.Items?.[0] || null;
}

/**
 * Update a scheduled notification
 */
export async function updateScheduledNotification(tenantId, scheduledId, data) {
  if (!tenantId || !scheduledId) {
    throw new Error('Tenant ID and Scheduled ID are required');
  }

  // Find the scheduled notification
  const pending = await getPendingScheduledNotifications(tenantId);
  const scheduled = pending.find(s => s.scheduledId === scheduledId);

  if (!scheduled) {
    throw new Error('Scheduled notification not found');
  }

  const updateExpressions = [];
  const attributeValues = {};

  if (data.dueAt !== undefined) {
    // Need to recreate with new SK since dueAt is in SK
    const newScheduled = {
      ...scheduled,
      dueAt: data.dueAt,
      SK: `DUE#${data.dueAt}#${scheduledId}`,
      payload: data.payload || scheduled.payload,
      updatedAt: new Date().toISOString(),
    };

    // Delete old and create new
    await docClient.send(new DeleteCommand({
      TableName: NOTIFICATIONS_TABLE_NAME,
      Key: { PK: scheduled.PK, SK: scheduled.SK },
    }));

    await docClient.send(new PutCommand({
      TableName: NOTIFICATIONS_TABLE_NAME,
      Item: newScheduled,
    }));

    return newScheduled;
  }

  const attributeNames = {};

  if (data.status !== undefined) {
    updateExpressions.push('#status = :status');
    attributeValues[':status'] = data.status;
    attributeNames['#status'] = 'status';
  }

  if (data.payload !== undefined) {
    updateExpressions.push('payload = :payload');
    attributeValues[':payload'] = data.payload;
  }

  updateExpressions.push('updatedAt = :updatedAt');
  attributeValues[':updatedAt'] = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: NOTIFICATIONS_TABLE_NAME,
    Key: { PK: scheduled.PK, SK: scheduled.SK },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    // Only pass #status when the update expression actually references it —
    // DynamoDB rejects declared-but-unused ExpressionAttributeNames, and a
    // payload-only update (attachMeetingReminderRecipients's call, which
    // never touches status) previously always hit that error unconditionally.
    ExpressionAttributeNames: Object.keys(attributeNames).length ? attributeNames : undefined,
    ExpressionAttributeValues: attributeValues,
  }));

  return { ...scheduled, ...data };
}

/**
 * Cancel a scheduled notification
 */
export async function cancelScheduledNotification(tenantId, scheduledId) {
  return await updateScheduledNotification(tenantId, scheduledId, { status: 'cancelled' });
}

/**
 * Cancel scheduled notification by dedupeKey
 */
export async function cancelScheduledNotificationByDedupeKey(tenantId, dedupeKey) {
  const scheduled = await getScheduledNotificationByDedupeKey(tenantId, dedupeKey);
  if (scheduled && scheduled.status === 'pending') {
    return await cancelScheduledNotification(tenantId, scheduled.scheduledId);
  }
  return null;
}

/**
 * Email the resolved recipients for a fired meeting reminder. Never throws —
 * push can be silently unconfigured (Firebase not set up yet), so email is
 * currently the one channel guaranteed to actually reach the assignee and
 * agency owner, and one bad address must not stop the others from being sent.
 */
async function sendMeetingReminderEmails(recipientEmails, payload) {
  const results = await Promise.allSettled(
    recipientEmails.map((to) =>
      sendEmail({
        to,
        subject: payload.title || 'Meeting reminder',
        html: `<p>${payload.message}</p>`,
        text: payload.message,
      })
    )
  );
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.warn('meetingReminder.email.failed', { to: recipientEmails[index], error: result.reason?.message });
    }
  });
}

/**
 * Mark scheduled notification as fired and create inbox notification
 */
export async function fireScheduledNotification(tenantId, scheduledId) {
  if (!tenantId || !scheduledId) {
    throw new Error('Tenant ID and Scheduled ID are required');
  }

  // Find the scheduled notification
  const pending = await getPendingScheduledNotifications(tenantId);
  const scheduled = pending.find(s => s.scheduledId === scheduledId);

  if (!scheduled) {
    throw new Error('Scheduled notification not found');
  }

  // Create inbox notification from payload
  const notification = await createNotification(tenantId, {
    ...scheduled.payload,
    dedupeKey: scheduled.dedupeKey,
  });

  // Mark as fired
  await updateScheduledNotification(tenantId, scheduledId, { status: 'fired' });

  // Meeting reminders also go out by email, to whatever recipients were
  // resolved at schedule time (see meetingReminderRecipients.js) — the
  // assignee + agency owner, never the customer/lead.
  if (scheduled.payload.type === NotificationType.MEETING_REMINDER_15M && scheduled.payload.recipientEmails?.length) {
    await sendMeetingReminderEmails(scheduled.payload.recipientEmails, scheduled.payload);
  }

  logger.info('scheduledNotification.fired', { tenantId, scheduledId, notificationId: notification.notificationId });
  return notification;
}

/**
 * Process all due scheduled notifications for a tenant
 */
export async function processDueNotifications(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const dueNotifications = await getDueScheduledNotifications(tenantId);
  const results = [];

  for (const scheduled of dueNotifications) {
    try {
      const notification = await fireScheduledNotification(tenantId, scheduled.scheduledId);
      results.push({ success: true, scheduledId: scheduled.scheduledId, notificationId: notification.notificationId });
    } catch (error) {
      logger.error('scheduledNotification.fire.error', { tenantId, scheduledId: scheduled.scheduledId, error: error.message });
      results.push({ success: false, scheduledId: scheduled.scheduledId, error: error.message });
    }
  }

  return { processed: results.length, results };
}

// ============== Rent Expiry Notification Generation ==============

/**
 * Generate rent expiry notifications for properties expiring soon
 */
export async function generateRentExpiryNotifications(tenantId, properties, thresholdDays = 30) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const results = [];

  // Define notification thresholds (notify at these specific day marks)
  const notifyAtDays = [30, 15, 7, 3, 1, 0];

  for (const property of properties) {
    if (property.status !== 'rented') continue;
    if (!property.tenantMoveInDate || !property.tenureMonths) continue;

    // Calculate expiry date
    const moveInDate = new Date(property.tenantMoveInDate);
    const expiryDate = new Date(moveInDate);
    expiryDate.setMonth(expiryDate.getMonth() + property.tenureMonths);

    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Skip if not within threshold
    if (daysUntilExpiry > thresholdDays || daysUntilExpiry < 0) continue;

    // Determine which threshold bucket this falls into
    let thresholdBucket = null;
    for (const days of notifyAtDays) {
      if (daysUntilExpiry <= days) {
        thresholdBucket = days;
      }
    }

    if (thresholdBucket === null) continue;

    const dedupeKey = `RENT_EXPIRY#${property.propertyId}#${thresholdBucket}d`;
    const propertyTitle = property.flatNumber || property.title || 'Property';
    const expiryDateStr = expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    let title, message;
    if (daysUntilExpiry === 0) {
      title = `Agreement expires today!`;
      message = `${propertyTitle} (${property.buildingName || property.area}) agreement expires today.`;
    } else if (daysUntilExpiry < 0) {
      title = `Agreement expired`;
      message = `${propertyTitle} (${property.buildingName || property.area}) agreement expired ${Math.abs(daysUntilExpiry)} days ago.`;
    } else {
      title = `Agreement expiring in ${daysUntilExpiry} days`;
      message = `${propertyTitle} (${property.buildingName || property.area}) expires on ${expiryDateStr}.`;
    }

    try {
      const notification = await createNotification(tenantId, {
        category: NotificationCategory.PROPERTIES,
        type: NotificationType.RENT_EXPIRY_SOON,
        title,
        message,
        deepLink: `/crm/properties/${property.propertyId}`,
        entityRef: { entityType: 'property', entityId: property.propertyId },
        dedupeKey,
      });
      results.push({ success: true, propertyId: property.propertyId, notificationId: notification.notificationId });
    } catch (error) {
      results.push({ success: false, propertyId: property.propertyId, error: error.message });
    }
  }

  return { processed: results.length, results };
}

// ============== Meeting Reminder Scheduling ==============

/**
 * Schedule a meeting reminder (15 minutes before)
 */
export async function scheduleMeetingReminder(tenantId, meeting, reminderMinutes = 15) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (!meeting.meetingDate || !meeting.meetingTime) {
    throw new Error('Meeting date and time are required');
  }

  // Calculate reminder time (15 minutes before meeting). meetingDate/meetingTime
  // are naive wall-clock values with no timezone of their own — every agency
  // using this product is in India, so they mean IST. Without the explicit
  // +05:30 offset, Date() parses them in the Lambda's own local timezone
  // (UTC), which silently shifts every reminder 5.5 hours late.
  const meetingDateTime = new Date(`${meeting.meetingDate}T${meeting.meetingTime}:00+05:30`);
  const reminderTime = new Date(meetingDateTime.getTime() - (reminderMinutes * 60 * 1000));

  // Don't schedule if reminder time is in the past
  if (reminderTime <= new Date()) {
    logger.info('meetingReminder.skip.past', { tenantId, meetingId: meeting.meetingId });
    return null;
  }

  const dedupeKey = `MEETING_REMINDER#${meeting.meetingId}`;
  const attendeeInfo = meeting.attendeeName || meeting.relatedEntityName || 'Unknown';
  const timeStr = meeting.meetingTime;
  const dateStr = new Date(meeting.meetingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  const scheduled = await createScheduledNotification(tenantId, {
    dueAt: reminderTime.toISOString(),
    category: NotificationCategory.OWNERS, // Most meetings are with owners/tenants
    type: NotificationType.MEETING_REMINDER_15M,
    title: `Meeting in ${reminderMinutes} minutes`,
    message: `${meeting.title} with ${attendeeInfo} at ${timeStr} on ${dateStr}${meeting.location ? ` • ${meeting.location}` : ''}`,
    deepLink: `/crm/calendar`,
    entityRef: { entityType: 'meeting', entityId: meeting.meetingId },
    dedupeKey,
  });

  return scheduled;
}

/**
 * Cancel meeting reminder when meeting is cancelled or completed
 */
export async function cancelMeetingReminder(tenantId, meetingId) {
  const dedupeKey = `MEETING_REMINDER#${meetingId}`;
  return await cancelScheduledNotificationByDedupeKey(tenantId, dedupeKey);
}

// ============== Khata Reminder Scheduling ==============

/**
 * Schedule a khata reminder
 */
export async function scheduleKhataReminder(tenantId, khataEntry) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (!khataEntry.reminderAt) {
    return null;
  }

  const reminderTime = new Date(khataEntry.reminderAt);

  // Don't schedule if reminder time is in the past
  if (reminderTime <= new Date()) {
    logger.info('khataReminder.skip.past', { tenantId, entryId: khataEntry.entryId });
    return null;
  }

  const dedupeKey = `KHATA_REMINDER#${khataEntry.entryId}`;
  const transactionLabel = khataEntry.transactionType === 'TO_GIVE' ? 'To Pay' : 'To Receive';
  const amountStr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(khataEntry.amount);

  const scheduled = await createScheduledNotification(tenantId, {
    dueAt: khataEntry.reminderAt,
    category: NotificationCategory.KHATABOOK,
    type: NotificationType.KHATA_REMINDER,
    title: `Khata Reminder: ${khataEntry.partyName}`,
    message: `${transactionLabel} ${amountStr} • ${khataEntry.categoryName}${khataEntry.reminderNote ? ` • ${khataEntry.reminderNote}` : ''}`,
    deepLink: `/crm/khata/${khataEntry.entryId}`,
    entityRef: { entityType: 'khata', entityId: khataEntry.entryId },
    dedupeKey,
  });

  return scheduled;
}

/**
 * Cancel khata reminder
 */
export async function cancelKhataReminder(tenantId, entryId) {
  const dedupeKey = `KHATA_REMINDER#${entryId}`;
  return await cancelScheduledNotificationByDedupeKey(tenantId, dedupeKey);
}

// ============== Utility Functions ==============

/**
 * Get all tenants with notifications (for batch processing)
 */
export async function getAllTenantsWithScheduledNotifications() {
  const params = {
    TableName: NOTIFICATIONS_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND #status = :pending',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':type': 'SCHEDULED_NOTIFICATION',
      ':pending': 'pending',
    },
    ProjectionExpression: 'tenantId',
  };

  const result = await docClient.send(new ScanCommand(params));
  const tenantIds = [...new Set((result.Items || []).map(item => item.tenantId))];
  return tenantIds;
}
