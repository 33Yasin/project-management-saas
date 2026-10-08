import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from './use-notifications';
import type { Notification, NotificationType } from '@/types/api';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CheckCheck,
  UserCheck,
  MessageSquare,
  Shield,
  ArrowRightLeft,
  Mail,
  HelpCircle,
  Loader2,
} from 'lucide-react';

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'TASK_ASSIGNED':
      return <UserCheck className="size-4 text-purple-500" />;
    case 'COMMENT_ADDED':
      return <MessageSquare className="size-4 text-blue-500" />;
    case 'TASK_STATUS_CHANGED':
      return <ArrowRightLeft className="size-4 text-amber-500" />;
    case 'ROLE_UPDATED':
    case 'OWNERSHIP_TRANSFERRED':
      return <Shield className="size-4 text-emerald-500" />;
    case 'WORKSPACE_INVITATION':
      return <Mail className="size-4 text-cyan-500" />;
    default:
      return <HelpCircle className="size-4 text-muted-foreground" />;
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    isMarkingAllRead,
  } = useNotifications({ unreadOnly, limit: 30 });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      await markAsRead(notification.id);
    }

    setIsOpen(false);

    if (notification.entityType === 'TASK' && notification.entityId) {
      navigate(`/tasks/${notification.entityId}`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        aria-label="Open notifications"
        aria-expanded={isOpen}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-destructive-foreground bg-destructive rounded-full animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-2">
          {/* Header */}
          <div className="p-3 border-b border-border/80 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs tracking-wide">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsRead()}
                  disabled={isMarkingAllRead}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                >
                  <CheckCheck className="size-3" />
                  <span>Mark all read</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-3 py-1.5 border-b border-border/60 flex items-center gap-1 bg-muted/10 text-[11px]">
            <button
              type="button"
              onClick={() => setUnreadOnly(false)}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                !unreadOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(true)}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                unreadOnly
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Unread only
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 flex items-start gap-3 transition-colors cursor-pointer text-xs ${
                    !item.readAt
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : 'hover:bg-muted/40 opacity-80'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-full bg-background border border-border">
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`font-semibold truncate ${!item.readAt ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                  {!item.readAt && (
                    <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default NotificationBell;
