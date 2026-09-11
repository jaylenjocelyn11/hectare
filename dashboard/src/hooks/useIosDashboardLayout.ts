import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseFirestore } from "../lib/firebase";
import { orgDoc, writeMessage } from "../lib/orgWrite";
import {
  IOS_LAYOUT_COLLECTION,
  cloneLayout,
  defaultLayout,
  layoutToPayload,
  normalizeLayout,
  type IosDashboardLayout,
  type IosDeviceKind,
} from "../lib/iosDashboardLayout";

type SaveState = "idle" | "saving" | "saved" | "error";

export function useIosDashboardLayout(organizationId: string | null) {
  const [iphone, setIphone] = useState<IosDashboardLayout>(() => defaultLayout("iphone"));
  const [ipad, setIpad] = useState<IosDashboardLayout>(() => defaultLayout("ipad"));
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState({ iphone: false, ipad: false });
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const skipRemote = useRef({ iphone: 0, ipad: 0 });
  const timers = useRef<Partial<Record<IosDeviceKind, number>>>({});

  useEffect(() => {
    if (!organizationId) {
      setIphone(defaultLayout("iphone"));
      setIpad(defaultLayout("ipad"));
      setHydrated({ iphone: false, ipad: false });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const db = getFirebaseFirestore();
    const unsubs = (["iphone", "ipad"] as IosDeviceKind[]).map((device) =>
      onSnapshot(
        doc(db, "organizations", organizationId, IOS_LAYOUT_COLLECTION, device),
        (snap) => {
          if (skipRemote.current[device] > 0) {
            skipRemote.current[device] -= 1;
            return;
          }
          const next = normalizeLayout(snap.exists() ? snap.data() : null, device);
          if (device === "iphone") setIphone(next);
          else setIpad(next);
          setHydrated((prev) => ({ ...prev, [device]: true }));
          setLoading(false);
          setError(null);
        },
        (err) => {
          setLoading(false);
          setError(err.message);
        }
      )
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
      (Object.values(timers.current) as number[]).forEach((id) => window.clearTimeout(id));
    };
  }, [organizationId]);

  const layouts = useMemo(
    () => ({ iphone, ipad }) satisfies Record<IosDeviceKind, IosDashboardLayout>,
    [iphone, ipad]
  );

  const setLayout = useCallback(
    (device: IosDeviceKind, next: IosDashboardLayout, persist = true) => {
      const normalized = normalizeLayout(next, device);
      if (device === "iphone") setIphone(cloneLayout(normalized));
      else setIpad(cloneLayout(normalized));
      if (!persist || !organizationId) return;

      setSaveState("saving");
      const existing = timers.current[device];
      if (existing) window.clearTimeout(existing);
      timers.current[device] = window.setTimeout(async () => {
        try {
          skipRemote.current[device] += 1;
          await setDoc(
            orgDoc(organizationId, IOS_LAYOUT_COLLECTION, device),
            {
              ...layoutToPayload(normalized),
              updatedAt: serverTimestamp(),
            },
            { merge: false }
          );
          setSaveState("saved");
          setError(null);
        } catch (err) {
          skipRemote.current[device] = Math.max(0, skipRemote.current[device] - 1);
          setSaveState("error");
          setError(writeMessage(err));
        }
      }, 420);
    },
    [organizationId]
  );

  return {
    layouts,
    loading,
    hydrated,
    error,
    saveState,
    setLayout,
  };
}
