import React, { createContext, useCallback, useContext, useState } from 'react';
import { getEntitlements, purchasePro as purchaseProFn } from './revenuecat';

interface RevenueCatContextValue {
  isPro: boolean;
  refresh: () => Promise<void>;
  purchasePro: (type: 'monthly' | 'annual') => Promise<boolean>;
}

const RevenueCatContext = createContext<RevenueCatContextValue>({
  isPro: false,
  refresh: async () => {},
  purchasePro: async () => false,
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

  return (
    <RevenueCatContext.Provider value={{ isPro, refresh, purchasePro }}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export const useRevenueCat = () => useContext(RevenueCatContext);
