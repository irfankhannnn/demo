import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Building2,
  Calendar,
  BookOpen,
  MessageSquare,
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Notification,
  NotificationCounts,
  NotificationCategory,
  NOTIFICATION_CATEGORY_LABELS,
} from '../types/notification';

interface NotificationCenterProps {
  className?: string;
}

const getCategoryIcon = (category: NotificationCategory) => {
  switch (category) {
    case 'ENQUIRIES':
      return <MessageSquare className="w-4 h-4" />;
    case 'OWNERS':
      return <Users className="w-4 h-4" />;
    case 'TENANTS':
      return <UserCheck className="w-4 h-4" />;
    case 'PROPERTIES':
      return <Building2 className="w-4 h-4" />;
    case 'KHATABOOK':
      return <BookOpen className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'RENT_EXPIRY_SOON':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case 'MEETING_REMINDER_15M':
      return <Calendar className="w-4 h-4 text-blue-500" />;
    case 'KHATA_REMINDER':
      return <Clock className="w-4 h-4 text-purple-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

const formatTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'ALL'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasRun = useRef(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const [notifResponse, countsResponse] = await Promise.all([
        api.getNotifications({ limit: 50 }),
        api.getNotificationCounts(),
      ]);
      setNotifications(notifResponse);
      setCounts(countsResponse);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const processNotifications = async () => {
    try {
      setProcessing(true);
      await api.processAllNotifications();
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to process notifications:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.notificationId === notificationId
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      );
      setCounts(prev =>
        prev ? { ...prev, total: Math.max(0, prev.total - 1) } : null
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setCounts(prev =>
        prev
          ? {
              ...prev,
              total: 0,
              byCategory: {
                ENQUIRIES: 0,
                OWNERS: 0,
                TENANTS: 0,
                PROPERTIES: 0,
                KHATABOOK: 0,
              },
            }
          : null
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.deepLink) {
      navigate(notification.deepLink);
      setIsOpen(false);
    }
    if (!notification.readAt) {
      api.markNotificationAsRead(notification.notificationId).catch(console.error);
    }
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    fetchNotifications();
    // Poll for new notifications every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredNotifications =
    selectedCategory === 'ALL'
      ? notifications
      : notifications.filter(n => n.category === selectedCategory);

  const unreadCount = counts?.total || 0;

  const categories: Array<NotificationCategory | 'ALL'> = [
    'ALL',
    'PROPERTIES',
    'OWNERS',
    'TENANTS',
    'KHATABOOK',
    'ENQUIRIES',
  ];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-1.5rem)] max-h-[80vh] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={processNotifications}
                  disabled={processing}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
                  title="Refresh notifications"
                 aria-label="Refresh data">
                  <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {cat === 'ALL' ? 'All' : NOTIFICATION_CATEGORY_LABELS[cat]}
                  {cat !== 'ALL' && counts?.byCategory[cat] ? (
                    <span className="ml-1">({counts.byCategory[cat]})</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[calc(80vh-120px)] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p>Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No notifications</p>
                <p className="text-sm mt-1">
                  {selectedCategory === 'ALL'
                    ? "You're all caught up!"
                    : `No ${NOTIFICATION_CATEGORY_LABELS[selectedCategory as NotificationCategory].toLowerCase()} notifications`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredNotifications.map(notification => (
                  <div
                    key={notification.notificationId}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.readAt ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 p-2 rounded-full ${
                          !notification.readAt ? 'bg-blue-100' : 'bg-gray-100'
                        }`}
                      >
                        {getTypeIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm ${
                              !notification.readAt ? 'font-semibold text-gray-900' : 'text-gray-700'
                            }`}
                          >
                            {notification.title}
                          </p>
                          {!notification.readAt && (
                            <button
                              onClick={e => handleMarkAsRead(notification.notificationId, e)}
                              className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            {getCategoryIcon(notification.category)}
                            {NOTIFICATION_CATEGORY_LABELS[notification.category]}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-400">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
