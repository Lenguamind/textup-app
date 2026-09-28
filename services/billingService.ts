import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { verifyAndroidPurchase } from './apiService';

const getPurchaseStore = () => {
  if (typeof (window as any).CdvPurchase !== 'undefined') {
    return (window as any).CdvPurchase.store;
  }
  if (typeof (window as any).store !== 'undefined') {
    return (window as any).store;
  }
  return undefined;
};

export enum ProductId {
  MONTHLY = 'premium_mensual',
  YEARLY = 'premium_anual'
}

const PREMIUM_STORAGE_KEY = 'is_premium_active';

class BillingService {
  private initialized = false;

  async initialize() {
    if (!Capacitor.isNativePlatform() || this.initialized) {
      return;
    }

    const initStore = () => {
      const store = getPurchaseStore();
      if (!store) {
        console.error('BillingService: Store plugin not found.');
        return;
      }

      store.verbosity = store.INFO || 3;

      const CdvPurchase = (window as any).CdvPurchase;
      const subType = CdvPurchase?.ProductType?.PAID_SUBSCRIPTION || 'paid subscription';
      const platform = CdvPurchase?.Platform?.GOOGLE_PLAY;

      store.register([
        { id: ProductId.MONTHLY, type: subType, platform: platform },
        { id: ProductId.YEARLY, type: subType, platform: platform }
      ]);

      store.when().approved(async (transaction: any) => {
        console.log('Purchase approved!', transaction);
        if (transaction.finish) {
          transaction.finish();
        }
        await this.setLocalPremiumStatus(true);
        window.dispatchEvent(new CustomEvent('user-premium-updated', { detail: true }));

        const purchaseToken = transaction.purchaseToken || transaction.id;
        let productId = transaction.products ? transaction.products[0]?.id : null;
        if (!productId && transaction.id) productId = transaction.id;

        if (purchaseToken) {
          try {
            await verifyAndroidPurchase(purchaseToken, productId);
          } catch (error) {
            console.error('Error verifying purchase:', error);
          }
        }
      });

      store.when().receiptsReady(async () => {
        const isMonthlyOwned = store.owned(ProductId.MONTHLY);
        const isYearlyOwned = store.owned(ProductId.YEARLY);
        if (isMonthlyOwned || isYearlyOwned) {
          console.log('User owns premium subscription.');
          await this.setLocalPremiumStatus(true);
          window.dispatchEvent(new CustomEvent('user-premium-updated', { detail: true }));
        } else {
          console.log('User does not own any premium subscription.');
          await this.setLocalPremiumStatus(false);
          window.dispatchEvent(new CustomEvent('user-premium-updated', { detail: false }));
        }
      });

      store.when().receiptUpdated(async (receipt: any) => {
        const isMonthlyOwned = store.owned(ProductId.MONTHLY);
        const isYearlyOwned = store.owned(ProductId.YEARLY);
        if (isMonthlyOwned || isYearlyOwned) {
          console.log('User owns premium subscription (receiptUpdated).');
          await this.setLocalPremiumStatus(true);
          window.dispatchEvent(new CustomEvent('user-premium-updated', { detail: true }));
        } else {
          console.log('User does not own any premium subscription (receiptUpdated).');
          await this.setLocalPremiumStatus(false);
          window.dispatchEvent(new CustomEvent('user-premium-updated', { detail: false }));
        }
      });

      store.error((error: any) => {
        console.error('Store Error: ' + JSON.stringify(error));
      });

      if (store.initialize) {
        let platformEnum = undefined;
        if (CdvPurchase && CdvPurchase.Platform && CdvPurchase.Platform.GOOGLE_PLAY) {
          platformEnum = CdvPurchase.Platform.GOOGLE_PLAY;
        }
        store.initialize(platformEnum ? [platformEnum] : []);
      } else if (store.update) {
        store.update();
      } else {
        store.refresh();
      }
      this.initialized = true;
    };

    if (typeof (window as any).CdvPurchase !== 'undefined' || typeof (window as any).store !== 'undefined') {
      initStore();
    } else {
      document.addEventListener('deviceready', initStore, false);
    }
  }

  private async setLocalPremiumStatus(isActive: boolean) {
    await Preferences.set({
      key: PREMIUM_STORAGE_KEY,
      value: isActive ? 'true' : 'false'
    });
  }

  async isPremiumOffline(): Promise<boolean> {
    const { value } = await Preferences.get({ key: PREMIUM_STORAGE_KEY });
    return value === 'true';
  }

  async purchase(productId: ProductId) {
    const store = getPurchaseStore();
    if (Capacitor.isNativePlatform() && store) {
      console.log('BillingService: Triggering REAL native purchase for:', productId);

      const product = store.get(productId);
      if (!product) {
        console.error('BillingService: Product not found:', productId);
        return { status: 'error', message: 'Product not found' };
      }

      const offer = product.offers?.[0];
      if (!offer) {
        console.error('BillingService: No offer found for product:', productId);
        return { status: 'error', message: 'No offer found' };
      }

      console.log('BillingService: Ordering offer:', offer.id);
      return store.order(offer);
    }

    console.log('BillingService: purchase() called on web. No action taken.');
    return { status: 'web_mode' };
  }

  async restore() {
    if (!Capacitor.isNativePlatform()) return;
    const store = getPurchaseStore();
    if (store) {
      if (store.update) {
        store.update();
      } else if (store.refresh) {
        store.refresh();
      }
    }
  }

  getProduct(productId: ProductId) {
    if (!Capacitor.isNativePlatform()) return null;
    const store = getPurchaseStore();
    return store ? store.get(productId) : null;
  }
}

export const billingService = new BillingService();
