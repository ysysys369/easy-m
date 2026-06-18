import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type DevUiState = 'real' | 'visitor' | 'free' | 'premium';

type DevUiOverrideContextType = {
  uiOverride: DevUiState;
  setUiOverride: (s: DevUiState) => void;
};

const DevUiOverrideContext = createContext<DevUiOverrideContextType>({
  uiOverride: 'real',
  setUiOverride: () => {},
});

export function DevUiOverrideProvider({ children }: { children: ReactNode }) {
  const [uiOverride, setUiOverride] = useState<DevUiState>('real');
  return (
    <DevUiOverrideContext.Provider value={{ uiOverride, setUiOverride }}>
      {children}
    </DevUiOverrideContext.Provider>
  );
}

export function useDevUiOverride(): DevUiOverrideContextType {
  return useContext(DevUiOverrideContext);
}
