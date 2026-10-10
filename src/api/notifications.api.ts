// Interface removed as it's defined below

import api from './axios';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'Approval' | 'Rejection' | 'Alert' | 'System';
  timestamp: string;
  isRead: boolean;
  link: string;
}

export const getNotifications = async () => {
  const response = await api.get('/notifications');
  return response.data.data.map((n: any) => ({
    ...n,
    timestamp: n.createdAt
  }));
};

export const markAsRead = async (id: string) => {
  await api.patch(`/notifications/${id}/read`);
};

export const markAllAsRead = async () => {
  await api.patch('/notifications/read-all');
};
