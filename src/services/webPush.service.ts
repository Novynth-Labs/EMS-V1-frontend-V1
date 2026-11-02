import { getVapidPublicKey, subscribeWebPush, unsubscribeWebPush, testWebPush } from '../api/notifications.api';

// Helper to convert base64 VAPID public key to Uint8Array required by pushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface WebPushStatus {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  subscriptionEndpoint?: string;
}

class WebPushService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isInitializing: boolean = false;

  /**
   * Check if Web Push, Service Worker and Notification APIs are supported.
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Get current notification permission state.
   */
  public getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Register the Service Worker (public/sw.js).
   */
  public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      return null;
    }

    if (this.swRegistration) {
      return this.swRegistration;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[WebPush] Service Worker registered with scope:', this.swRegistration.scope);

      // Listen for background service worker navigation and action broadcasts
      this.setupServiceWorkerListeners();

      return this.swRegistration;
    } catch (error) {
      console.warn('[WebPush] Service Worker registration failed:', error);
      return null;
    }
  }

  /**
   * Setup bi-directional communication between Service Worker and open tab.
   */
  private setupServiceWorkerListeners(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || !data.type) return;

      console.log('[WebPush] Message received from Service Worker:', data);

      if (data.type === 'NOTIFICATION_NAVIGATE') {
        const rawUrl = data.url || '/#/dashboard';
        const normalizedHash = rawUrl.startsWith('/#') 
          ? rawUrl.replace(/^\//, '') 
          : (rawUrl.startsWith('#') ? rawUrl : `#${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`);
        
        window.location.hash = normalizedHash;
      } else if (data.type === 'CALL_DECLINED_FROM_NOTIFICATION') {
        window.dispatchEvent(new CustomEvent('ems_call_declined', { detail: { meetingId: data.meetingId } }));
      } else if (data.type === 'PUSH_NOTIFICATION_RECEIVED') {
        window.dispatchEvent(new CustomEvent('ems_push_received', { detail: data.payload }));
      }
    });
  }

  /**
   * Inspect current Web Push registration and subscription status.
   */
  public async getStatus(): Promise<WebPushStatus> {
    if (!this.isSupported()) {
      return {
        isSupported: false,
        permission: 'unsupported',
        isSubscribed: false
      };
    }

    const permission = Notification.permission;
    try {
      const registration = await this.registerServiceWorker();
      if (!registration) {
        return { isSupported: true, permission, isSubscribed: false };
      }

      const subscription = await registration.pushManager.getSubscription();
      return {
        isSupported: true,
        permission,
        isSubscribed: Boolean(subscription),
        subscriptionEndpoint: subscription?.endpoint
      };
    } catch (e) {
      return { isSupported: true, permission, isSubscribed: false };
    }
  }

  /**
   * Request Notification permission and subscribe to Web Push Protocol.
   */
  public async subscribe(): Promise<PushSubscription | null> {
    if (!this.isSupported()) {
      throw new Error('Web Push notifications are not supported on this browser or platform');
    }

    if (this.isInitializing) return null;
    this.isInitializing = true;

    try {
      // 1. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[WebPush] Notification permission was not granted:', permission);
        return null;
      }

      // 2. Ensure Service Worker is ready
      const registration = await this.registerServiceWorker();
      if (!registration) {
        throw new Error('Failed to register service worker for push notifications');
      }

      // Wait until active if pending
      await navigator.serviceWorker.ready;

      // 3. Obtain VAPID Public Key from backend (or env fallback)
      let vapidPublicKey = '';
      try {
        vapidPublicKey = await getVapidPublicKey();
      } catch (err) {
        vapidPublicKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || 'BE20Iq2joqccajyVaam2y8o1RjiCPZCwDe26cFST_pStWWIELJOqV7Kc7wD6LArairMlsLAv6XBSXjd9O0Gnm60';
      }

      if (!vapidPublicKey) {
        throw new Error('VAPID public key could not be resolved from server or environment');
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 4. Check for existing subscription or create a new one
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      // 5. Securely persist push subscription in backend database
      await subscribeWebPush(subscription.toJSON(), navigator.userAgent);
      console.log('[WebPush] Successfully subscribed and synchronized with backend');

      return subscription;
    } catch (err) {
      console.error('[WebPush] Failed to complete Web Push subscription:', err);
      throw err;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Unsubscribe from Web Push.
   */
  public async unsubscribe(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const registration = await this.registerServiceWorker();
      if (!registration) return false;

      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        try {
          await unsubscribeWebPush(endpoint);
        } catch (_) {}
      }
      return true;
    } catch (err) {
      console.warn('[WebPush] Error during unsubscribe:', err);
      return false;
    }
  }

  /**
   * Send a test push notification to verify background delivery.
   */
  public async sendTestNotification(): Promise<void> {
    await testWebPush();
  }
}

export const webPushService = new WebPushService();

