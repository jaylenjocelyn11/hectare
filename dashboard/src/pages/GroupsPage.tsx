import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime } from "../lib/dates";
import { asText } from "../lib/text";
import type { OrgContext } from "./orgContext";
import { PageShell } from "./PageShell";
import styles from "./DashboardPage.module.css";

type ChatGroup = {
  name?: string;
  lastMessageAt?: unknown;
  memberIds?: unknown;
};

type ChatMessage = {
  groupId?: string;
  senderName?: string;
  text?: string;
  createdAt?: unknown;
  isDeleted?: boolean;
  imageUrl?: string;
};

export function GroupsPage() {
  const { organizationId } = useOutletContext<OrgContext>();
  const groups = useOrgCollection<ChatGroup>(organizationId, "chatGroups");
  const messages = useOrgCollection<ChatMessage>(organizationId, "chatMessages");
  const [groupId, setGroupId] = useState<string | "all">("all");

  const groupRows = [...groups.docs].sort((a, b) => {
    const da = asDate(a.lastMessageAt);
    const db = asDate(b.lastMessageAt);
    return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
  });

  const visible = useMemo(() => {
    return [...messages.docs]
      .filter((m) => !m.isDeleted)
      .filter((m) => (groupId === "all" ? true : m.groupId === groupId))
      .sort((a, b) => {
        const da = asDate(a.createdAt);
        const db = asDate(b.createdAt);
        return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
      });
  }, [messages.docs, groupId]);

  const groupName = (id?: string) =>
    groups.docs.find((g) => g.id === id)?.name ?? "Groupe";

  return (
    <PageShell errors={[groups.error, messages.error]}>
      <h1 className={styles.h1}>Groupe</h1>
      <p className={styles.meta}>Messages d’équipe (sans les photos lourdes).</p>

      <label className={styles.filter}>
        Conversation
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value as string | "all")}
        >
          <option value="all">Toutes</option>
          {groupRows.map((g) => (
            <option key={g.id} value={g.id}>
              {asText(g.name)}
            </option>
          ))}
        </select>
      </label>

      {groups.loading || messages.loading ? <p className="muted">Chargement…</p> : null}

      {groupRows.length === 0 ? (
        <p className="muted">Aucun groupe de discussion.</p>
      ) : null}

      {visible.length === 0 ? (
        <p className="muted">Aucun message à afficher.</p>
      ) : (
        <div className={styles.stack}>
          {visible.map((m) => (
            <article key={m.id} className={styles.card}>
              <div className={styles.cardHead}>
                <strong>{asText(m.senderName)}</strong>
                <span className="muted">{formatDateTime(m.createdAt)}</span>
              </div>
              {groupId === "all" ? (
                <p className={styles.meta}>{groupName(typeof m.groupId === "string" ? m.groupId : undefined)}</p>
              ) : null}
              <p className={styles.wrap}>{asText(m.text, m.imageUrl ? "(image)" : "—")}</p>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
