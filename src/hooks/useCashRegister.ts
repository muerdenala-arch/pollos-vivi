import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { CashRegister } from "@shared/types";

/**
 * Estado de caja obtenido siempre desde el servidor (Neon), no de localStorage.
 * Corrige el hallazgo de la auditoría: antes vivía solo en el navegador.
 */
export function useCashRegister() {
  const [register, setRegister] = useState<CashRegister | null | undefined>(undefined); // undefined = cargando
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<CashRegister | null>("/cash-registers");
      setRegister(data);
    } catch {
      setError("No se pudo consultar el estado de caja");
      setRegister(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = useCallback(
    async (opening_amount: number) => {
      const data = await api.post<CashRegister>("/cash-registers", { opening_amount });
      setRegister(data);
      return data;
    },
    []
  );

  const close = useCallback(async (id: number, closing_amount: number) => {
    const data = await api.patch<{ register: CashRegister; resumen: Record<string, number> }>(
      `/cash-registers`,
      { id, closing_amount }
    );
    setRegister(null);
    return data;
  }, []);

  return { register, error, refresh, open, close };
}
