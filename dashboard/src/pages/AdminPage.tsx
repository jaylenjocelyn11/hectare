import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { BrandLogo } from "../components/BrandLogo";
import { useAuth } from "../contexts/AuthContext";
import { useDashboardProfile } from "../hooks/useDashboardSession";
import {
  DEFAULT_ACCENT,
  dashboardPublicUrl,
  isValidSlug,
  slugifyPrefix,
  uniquePrefix,
} from "../lib/dashboards";
import { createOrgAuthUser, getFirebaseFirestore } from "../lib/firebase";
import { asOrgId, asText } from "../lib/text";
import styles from "./DashboardPage.module.css";

type DashRow = {
  slug: string;
  name: string;
  organizationId: string;
};

function withLinkedOrg(
  rows: DashRow[],
  profile: { organizationId: string | null; dashboardSlug: string | null } | null
): DashRow[] {
  const orgId = profile?.organizationId;
  if (!orgId) return rows;
  const slug = profile.dashboardSlug || orgId;
  if (rows.some((r) => r.slug === slug || r.organizationId === orgId)) return rows;
  return [{ slug, name: "Restaurant lié", organizationId: orgId }, ...rows];
}

export function AdminPage() {
  const { user, signOutUser } = useAuth();
  const { resolving, error, isPlatformAdmin, profile } = useDashboardProfile(user);
  const [rows, setRows] = useState<DashRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  useEffect(() => {
    if (resolving) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(getFirebaseFirestore(), "dashboards"));
        if (cancelled) return;
        const fromFs = snap.docs.map((d) => {
          const data = d.data();
          return {
            slug: d.id,
            name: asText(data.name, d.id),
            organizationId: asOrgId(data.organizationId) || d.id,
          };
        });
        setRows(withLinkedOrg(fromFs, profile));
      } catch {
        if (!cancelled) {
          setRows(withLinkedOrg([], profile));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolving, formOk, profile]);

  const canManage = isPlatformAdmin;

  useEffect(() => {
    if (resolving || !canManage || !user) return;
    void setDoc(
      doc(getFirebaseFirestore(), "dashboardUsers", user.uid),
      { platformAdmin: true },
      { merge: true }
    ).catch(() => {});
  }, [resolving, canManage, user]);

  if (resolving) {
    return (
      <div className="centered">
        <p className="muted">Vérification des accès…</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className={styles.adminPage}>
        <h1 className={styles.h1}>Accès réservé</h1>
        <p className={styles.meta}>
          Seul le compte qui crée les tableaux de bord peut ouvrir cette page. Dans Firestore, document{" "}
          <code className={styles.inlineCode}>dashboardUsers/{user?.uid}</code>, ajoute le champ{" "}
          <code className={styles.inlineCode}>platformAdmin</code> (booléen) à{" "}
          <code className={styles.inlineCode}>true</code>, puis recharge.
        </p>
        <Link to="/">Retour</Link>
      </div>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);

    const taken = [...rows.map((r) => r.slug)];
    let prefix = uniquePrefix(slug || name, taken);
    if (!isValidSlug(prefix)) {
      setFormError("Le préfixe d’URL doit contenir 2 à 40 lettres, chiffres ou tirets (ex. hectare).");
      return;
    }

    const db = getFirebaseFirestore();
    try {
      for (let i = 0; i < 50; i++) {
        const exists = await getDoc(doc(db, "dashboards", prefix));
        if (!exists.exists()) break;
        taken.push(prefix);
        prefix = uniquePrefix(slug || name, taken);
      }
    } catch {
      // Liste Firestore parfois illisible ; on garde le préfixe calculé.
    }

    const orgId = (organizationId.trim() || prefix).replace(/^\/+|\/+$/g, "");
    if (!orgId) {
      setFormError("Indique l’identifiant Firestore de l’organisation (celui de l’iPad).");
      return;
    }

    const email = managerEmail.trim();
    if (email && managerPassword.length < 6) {
      setFormError("Le mot de passe du compte resto doit faire au moins 6 caractères.");
      return;
    }

    setSaving(true);
    try {
      let savedDashboard = false;
      try {
        await setDoc(doc(db, "dashboards", prefix), {
          slug: prefix,
          name: name.trim() || prefix,
          organizationId: orgId,
          tagline: "Contrôle HACCP",
          accent: DEFAULT_ACCENT,
          nav: {},
          createdAt: serverTimestamp(),
          createdBy: user?.uid ?? "",
          createdByEmail: user?.email ?? "",
        });
        savedDashboard = true;
      } catch {
        savedDashboard = false;
      }

      if (email) {
        const uid = await createOrgAuthUser(email, managerPassword);
        try {
          await setDoc(
            doc(db, "dashboardUsers", uid),
            {
              organizationId: orgId,
              dashboardSlug: prefix,
              email,
              platformAdmin: false,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          setFormError(
            "Compte créé, mais Firestore refuse d’écrire dashboardUsers. Publie les règles (fichier dashboard/firestore.rules) puis réessaie."
          );
          return;
        }
      }

      if (user) {
        try {
          await setDoc(
            doc(db, "dashboardUsers", user.uid),
            { platformAdmin: true },
            { merge: true }
          );
        } catch {
          // Lecture de son propre profil reste possible ; le lien org iPad suffit.
        }
      }

      const openSlug = savedDashboard ? prefix : orgId;
      setRows((prev) => {
        if (prev.some((r) => r.slug === openSlug)) return prev;
        return [...prev, { slug: openSlug, name: name.trim() || prefix, organizationId: orgId }];
      });
      setFormOk(`Tableau de bord prêt : ${dashboardPublicUrl(openSlug)}`);
      setName("");
      setSlug("");
      setOrganizationId("");
      setManagerEmail("");
      setManagerPassword("");
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/email-already-in-use") {
        setFormError("Cet e-mail a déjà un compte. Lie-le à la main dans dashboardUsers, ou choisis un autre e-mail.");
      } else if (code === "permission-denied") {
        setFormError(
          "Firestore refuse l’écriture. Dans Firebase → Firestore (base hectarecafe) → Règles, publie le contenu de dashboard/firestore.rules."
        );
      } else {
        setFormError(err instanceof Error ? err.message : "Création impossible");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.adminPage}>
      <header className={styles.adminTop}>
        <BrandLogo size="sm" className={styles.brandLogo} />
        <div className={styles.adminTopActions}>
          <span className={styles.email}>{user?.email}</span>
          <button type="button" className={styles.linkButton} onClick={() => signOutUser()}>
            Déconnexion
          </button>
        </div>
      </header>

      <p className={styles.kicker}>Rustiq</p>
      <h1 className={styles.h1}>Tableaux de bord</h1>
      <p className={styles.meta}>
        Toi seul peux en créer. Chaque resto reçoit un préfixe unique : Hectare →{" "}
        <code className={styles.inlineCode}>{dashboardPublicUrl("hectare")}</code>
        , un autre resto → <code className={styles.inlineCode}>{dashboardPublicUrl("bistro")}</code>
        . Le DNS joker <code className={styles.inlineCode}>*</code> couvre tous les nouveaux préfixes, tu n’ajoutes rien à IONOS.
      </p>
      {error ? <p className={styles.warn}>{error}</p> : null}

      {profile?.organizationId ? (
        <p className={styles.ok}>
          <a href={dashboardPublicUrl(profile.dashboardSlug || profile.organizationId)}>
            Ouvrir le tableau de bord ({profile.organizationId})
          </a>
        </p>
      ) : null}

      <h2 className={styles.h2}>Existants</h2>
      {rows.length === 0 ? (
        <p className="muted">Aucun pour l’instant. Crée celui de Hectare Café ci-dessous (préfixe hectare, org hectare-cafe-bdd).</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Préfixe</th>
                <th>Organisation</th>
                <th>Lien</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug}>
                  <td>{row.name}</td>
                  <td>
                    <code className={styles.inlineCode}>{row.slug}</code>
                  </td>
                  <td>{row.organizationId}</td>
                  <td>
                    <a href={dashboardPublicUrl(row.slug)}>Ouvrir</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={styles.h2}>Nouveau tableau de bord</h2>
      <form className={styles.formStack} onSubmit={onCreate}>
        <label className={styles.field}>
          Nom du restaurant
          <input
            className={styles.fieldInput}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(slugifyPrefix(e.target.value));
            }}
            placeholder="Hectare Café"
            required
          />
        </label>
        <label className={styles.field}>
          Préfixe d’URL
          <input
            className={styles.fieldInput}
            value={slug}
            onChange={(e) => setSlug(slugifyPrefix(e.target.value))}
            placeholder="hectare-cafe"
            required
          />
        </label>
        <p className={styles.hint}>
          Adresse : {slug ? dashboardPublicUrl(slugifyPrefix(slug)) : "—"}. Si le préfixe existe déjà,
          un numéro est ajouté (hectare-2, hectare-3…).
        </p>
        <label className={styles.field}>
          ID organisation Firestore (iPad)
          <input
            className={styles.fieldInput}
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="hectare-cafe-bdd"
          />
        </label>
        <p className={styles.hint}>Laisse vide pour réutiliser le préfixe. Pour Hectare Café actuel : hectare-cafe-bdd.</p>

        <label className={styles.field}>
          E-mail du gérant (optionnel)
          <input
            className={styles.fieldInput}
            type="email"
            value={managerEmail}
            onChange={(e) => setManagerEmail(e.target.value)}
            placeholder="resto@exemple.com"
          />
        </label>
        <label className={styles.field}>
          Mot de passe du gérant
          <input
            className={styles.fieldInput}
            type="password"
            value={managerPassword}
            onChange={(e) => setManagerPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        {formError ? <p className={styles.warn}>{formError}</p> : null}
        {formOk ? <p className={styles.ok}>{formOk}</p> : null}
        <button className="btnGold" type="submit" disabled={saving}>
          {saving ? "Création…" : "Créer le tableau de bord"}
        </button>
      </form>
    </div>
  );
}
