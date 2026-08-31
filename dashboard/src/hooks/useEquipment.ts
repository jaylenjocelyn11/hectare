import { useMemo } from "react";
import { mergeEquipmentCatalog, type EquipmentFields } from "../lib/equipment";
import { useOrgCollection } from "./useOrgCollection";

export function useEquipment(organizationId: string | null) {
  const canonical = useOrgCollection<EquipmentFields>(organizationId, "equipment");
  const legacy = useOrgCollection<EquipmentFields>(organizationId, "equipments");

  const { list, lookup } = useMemo(
    () => mergeEquipmentCatalog(canonical.docs, legacy.error ? [] : legacy.docs),
    [canonical.docs, legacy.docs, legacy.error]
  );

  return {
    list,
    lookup,
    loading: canonical.loading || (!legacy.error && legacy.loading),
    error: canonical.error,
  };
}
