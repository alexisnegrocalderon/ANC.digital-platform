import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "anc-active-business-id";

type SelectedBusinessContextValue = {
  selectedBusinessId: number | null;
  setSelectedBusinessId: (id: number | null) => void;
};

const SelectedBusinessContext = createContext<SelectedBusinessContextValue | null>(null);

function readStoredBusinessId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SelectedBusinessProvider({ children }: { children: ReactNode }) {
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(() => readStoredBusinessId());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedBusinessId !== null) {
      window.localStorage.setItem(STORAGE_KEY, String(selectedBusinessId));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedBusinessId]);

  return (
    <SelectedBusinessContext.Provider value={{ selectedBusinessId, setSelectedBusinessId }}>
      {children}
    </SelectedBusinessContext.Provider>
  );
}

export function useSelectedBusiness(): SelectedBusinessContextValue {
  const context = useContext(SelectedBusinessContext);
  if (!context) {
    throw new Error("useSelectedBusiness must be used within a SelectedBusinessProvider");
  }
  return context;
}
