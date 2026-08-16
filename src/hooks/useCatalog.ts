import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { buildVariantes, type Categoria, type Producto, type Presa, type Variante } from "@shared/catalog";

interface CatalogResponse {
  categorias: Categoria[];
  productos: Producto[];
  presas: Presa[];
}

/** Catálogo administrable: se trae de /api/catalog (BD), ya no es fijo en código. */
export function useCatalog() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<CatalogResponse>("/catalog");
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const variantes: Variante[] = useMemo(
    () => (data ? buildVariantes(data.productos, data.presas) : []),
    [data]
  );

  return {
    categorias: data?.categorias ?? [],
    productos: data?.productos ?? [],
    presas: data?.presas ?? [],
    variantes,
    loading,
    refresh,
  };
}
