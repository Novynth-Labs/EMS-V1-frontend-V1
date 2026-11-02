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

// ── Web Push Protocol Client API ────────────────────────────────────────────
export const getVapidPublicKey = async (): Promise<string> => {
  const response = await api.get('/notifications/vapid-public-key');
  return response.data.data.publicKey;
};

export const subscribeWebPush = async (subscription: PushSubscriptionJSON, userAgent?: string) => {
  const response = await api.post('/notifications/push-subscribe', {
    subscription,
    userAgent: userAgent || navigator.userAgent
  });
  return response.data;
};

export const unsubscribeWebPush = async (endpoint: string) => {
  const response = await api.post('/notifications/push-unsubscribe', { endpoint });
  return response.data;
};

export const testWebPush = async () => {
  const response = await api.post('/notifications/test-push');
  return response.data;
};
