import { useState, type ReactNode } from "react";
import { removeOrgDoc, writeMessage } from "../lib/orgWrite";
import styles from "../pages/DashboardPage.module.css";

export function ManageNotice({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p className={styles.warn}>{error}</p>;
  if (ok) return <p className={styles.ok}>{ok}</p>;
  return null;
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={styles.linkButton} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={styles.dangerButton} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className={styles.rowActions}>{children}</div>;
}

export function DeleteControl({
  organizationId,
  collectionName,
  id,
  label,
  busy,
  onBusy,
  onError,
}: {
  organizationId: string;
  collectionName: string;
  id: string;
  label: string;
  busy: boolean;
  onBusy: (id: string | null) => void;
  onError: (message: string | null) => void;
}) {
  return (
    <DangerButton
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Supprimer ${label} ? L’iPad se mettra à jour tout seul.`)) return;
        onBusy(id);
        onError(null);
        try {
          await removeOrgDoc(organizationId, collectionName, id);
        } catch (err) {
          onError(writeMessage(err));
        } finally {
          onBusy(null);
        }
      }}
    >
      {busy ? "…" : "Supprimer"}
    </DangerButton>
  );
}

export function useManageState() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return {
    busyId,
    setBusyId,
    error,
    setError,
    ok,
    setOk,
    editingId,
    setEditingId,
    creating,
    setCreating,
    busy: (id: string) => busyId === id,
  };
}
