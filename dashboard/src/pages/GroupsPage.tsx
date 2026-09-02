import { FormEvent, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  DeleteControl,
  GhostButton,
  ManageNotice,
  RowActions,
  useManageState,
} from "../components/ManageControls";
import { useOrgCollection } from "../hooks/useOrgCollection";
import { asDate, formatDateTime } from "../lib/dates";
import { createOrgDoc, patchOrgDoc, writeMessage } from "../lib/orgWrite";
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
  const manage = useManageState();
  const [groupNameInput, setGroupNameInput] = useState("");
  const [messageText, setMessageText] = useState("");
  const [rename, setRename] = useState("");

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

  async function addGroup(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !groupNameInput.trim()) return;
    manage.setBusyId("create");
    try {
      const now = new Date();
      await createOrgDoc(organizationId, "chatGroups", {
        name: groupNameInput.trim(),
        memberIds: [],
        lastMessageAt: now,
      });
      setGroupNameInput("");
      manage.setCreating(false);
      manage.setOk("Groupe créé.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || groupId === "all" || !messageText.trim()) {
      manage.setError("Choisis une conversation, puis écris un message.");
      return;
    }
    manage.setBusyId("msg");
    try {
      const now = new Date();
      await createOrgDoc(organizationId, "chatMessages", {
        groupId,
        senderName: "Manager",
        text: messageText.trim(),
        createdAt: now,
        isDeleted: false,
      });
      await patchOrgDoc(organizationId, "chatGroups", groupId, { lastMessageAt: now });
      setMessageText("");
      manage.setOk("Message envoyé.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  async function saveGroupName(id: string) {
    if (!organizationId || !rename.trim()) return;
    manage.setBusyId(id);
    try {
      await patchOrgDoc(organizationId, "chatGroups", id, { name: rename.trim() });
      manage.setEditingId(null);
      manage.setOk("Groupe renommé.");
    } catch (err) {
      manage.setError(writeMessage(err));
    } finally {
      manage.setBusyId(null);
    }
  }

  return (
    <PageShell errors={[groups.error, messages.error]}>
      <h1 className={styles.h1}>Groupe</h1>
      <p className={styles.meta}>Messages d’équipe (sans les photos lourdes).</p>
      <GhostButton onClick={() => manage.setCreating((v) => !v)}>
        {manage.creating ? "Fermer" : "Nouveau groupe"}
      </GhostButton>
      <ManageNotice error={manage.error} ok={manage.ok} />
      {manage.creating ? (
        <form className={styles.manageForm} onSubmit={addGroup}>
          <label className={styles.field}>
            Nom du groupe
            <input
              className={styles.fieldInput}
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              required
            />
          </label>
          <div className={styles.manageActions}>
            <button className="btnGold" type="submit" disabled={manage.busyId === "create"}>
              Créer
            </button>
          </div>
        </form>
      ) : null}

      <label className={styles.filter}>
        Conversation
        <select value={groupId} onChange={(e) => setGroupId(e.target.value as string | "all")}>
          <option value="all">Toutes</option>
          {groupRows.map((g) => (
            <option key={g.id} value={g.id}>
              {asText(g.name)}
            </option>
          ))}
        </select>
      </label>

      {organizationId && groupId !== "all" ? (
        <form className={styles.manageForm} onSubmit={sendMessage}>
          <label className={styles.field}>
            Message
            <input
              className={styles.fieldInput}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Écrire à l’équipe…"
            />
          </label>
          <div className={styles.manageActions}>
            <button className="btnGold" type="submit" disabled={manage.busyId === "msg"}>
              Envoyer
            </button>
            {manage.editingId === groupId ? (
              <>
                <input className={styles.fieldInput} value={rename} onChange={(e) => setRename(e.target.value)} />
                <GhostButton onClick={() => void saveGroupName(groupId)}>Sauver le nom</GhostButton>
              </>
            ) : (
              <GhostButton
                onClick={() => {
                  manage.setEditingId(groupId);
                  const g = groups.docs.find((x) => x.id === groupId);
                  setRename(asText(g?.name, ""));
                }}
              >
                Renommer
              </GhostButton>
            )}
            <DeleteControl
              organizationId={organizationId}
              collectionName="chatGroups"
              id={groupId}
              label="ce groupe"
              busy={manage.busy(groupId)}
              onBusy={(id) => {
                manage.setBusyId(id);
                if (!id) setGroupId("all");
              }}
              onError={manage.setError}
            />
          </div>
        </form>
      ) : null}

      {groups.loading || messages.loading ? <p className="muted">Chargement…</p> : null}

      {groupRows.length === 0 ? <p className="muted">Aucun groupe de discussion.</p> : null}

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
                <p className={styles.meta}>
                  {groupName(typeof m.groupId === "string" ? m.groupId : undefined)}
                </p>
              ) : null}
              <p className={styles.wrap}>{asText(m.text, m.imageUrl ? "(image)" : "—")}</p>
              {organizationId ? (
                <RowActions>
                  <DeleteControl
                    organizationId={organizationId}
                    collectionName="chatMessages"
                    id={m.id}
                    label="ce message"
                    busy={manage.busy(m.id)}
                    onBusy={manage.setBusyId}
                    onError={manage.setError}
                  />
                </RowActions>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
