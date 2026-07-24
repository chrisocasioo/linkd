import React, { createContext, useCallback, useContext, useState } from 'react';
import { getEntitlements, purchasePro as purchaseProFn, restorePurchases as restorePurchasesFn } from './revenuecat';

interface RevenueCatContextValue {
  isPro: boolean;
  refresh: () => Promise<void>;
  purchasePro: (type: 'monthly' | 'annual') => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  seedIsPro: (value: boolean) => void;
}

const RevenueCatContext = createContext<RevenueCatContextValue>({
  isPro: false,
  refresh: async () => {},
  purchasePro: async () => false,
  restorePurchases: async () => false,
  seedIsPro: () => {},
});

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);

  const refresh = useCallback(async () => {
    const result = await getEntitlements();
    setIsPro(result.isPro);
  }, []);

  const purchasePro = useCallback(
    async (type: 'monthly' | 'annual') => {
      const success = await purchaseProFn(type);
      if (success) await refresh();
      return success;
    },
    [refresh]
  );

  const restorePurchases = useCallback(async () => {
    const success = await restorePurchasesFn();
    if (success) await refresh();
    return success;
  }, [refresh]);

  const seedIsPro = useCallback((value: boolean) => {
    setIsPro((current) => current || value);
  }, []);

  return (
    <RevenueCatContext.Provider value={{ isPro, refresh, purchasePro, restorePurchases, seedIsPro }}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export const useRevenueCat = () => useContext(RevenueCatContext);
