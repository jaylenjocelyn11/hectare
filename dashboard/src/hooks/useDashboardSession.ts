import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import {
  defaultDashboard,
  isPlatformAdmin,
  parseDashboardNav,
  resolveAccent,
  type DashboardConfig,
  type DashboardUserProfile,
} from "../lib/dashboards";
import { getFirebaseFirestore } from "../lib/firebase";
import { asOrgId, asText } from "../lib/text";
import type { OrgContext } from "../pages/orgContext";

export type DashboardSession = OrgContext & {
  slug: string | null;
  dashboard: DashboardConfig | null;
  profile: DashboardUserProfile | null;
  isPlatformAdmin: boolean;
};

function readProfile(
  data: Record<string, unknown> | undefined,
  exists: boolean
): DashboardUserProfile {
  if (!exists || !data) {
    return { organizationId: null, dashboardSlug: null, platformAdmin: false };
  }
  return {
    organizationId: asOrgId(data.organizationId),
    dashboardSlug: slugOrNull(data.dashboardSlug),
    // Pas de champ = toi (le premier compte web). false = gérant d’un resto.
    platformAdmin: data.platformAdmin !== false,
  };
}

function slugOrNull(value: unknown): string | null {
  const s = asText(value, "").trim().toLowerCase();
  return s || null;
}

export function useDashboardProfile(user: User | null): {
  profile: DashboardUserProfile | null;
  resolving: boolean;
  error: string | null;
  isPlatformAdmin: boolean;
} {
  const [profile, setProfile] = useState<DashboardUserProfile | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setError(null);
      setResolving(false);
      return;
    }

    let cancelled = false;
    setResolving(true);

    (async () => {
      try {
        const snap = await getDoc(doc(getFirebaseFirestore(), "dashboardUsers", user.uid));
        if (cancelled) return;
        const next = readProfile(
          snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
          snap.exists()
        );
        setProfile(next);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur Firestore");
          setProfile(null);
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    profile,
    resolving,
    error,
    isPlatformAdmin: isPlatformAdmin(user, profile),
  };
}

export function useDashboardSession(user: User | null, urlSlug: string | undefined): DashboardSession {
  const { profile, resolving: profileLoading, error: profileError, isPlatformAdmin: admin } =
    useDashboardProfile(user);
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  const slug = (urlSlug || "").trim().toLowerCase() || null;

  useEffect(() => {
    if (!user || !slug || profileLoading) {
      setDashboard(null);
      setDashError(null);
      setLoadingDash(false);
      return;
    }

    let cancelled = false;
    setLoadingDash(true);

    (async () => {
      try {
        const snap = await getDoc(doc(getFirebaseFirestore(), "dashboards", slug));
        if (cancelled) return;

        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const organizationId = asOrgId(data.organizationId);
          if (!organizationId) {
            setDashError("Ce tableau de bord n’a pas d’organisation liée.");
            setDashboard(null);
            return;
          }
          const allowed =
            admin ||
            profile?.organizationId === organizationId ||
            profile?.dashboardSlug === slug;
          if (!allowed) {
            setDashError("Tu n’as pas accès à ce tableau de bord.");
            setDashboard(null);
            return;
          }
          setDashboard({
            slug,
            organizationId,
            name: asText(data.name, slug),
            tagline: asText(data.tagline, "Contrôle HACCP"),
            accent: resolveAccent(asText(data.accent)),
            nav: parseDashboardNav(data.nav),
            persisted: true,
          });
          setDashError(null);
          return;
        }

        const fallbackOrg =
          profile?.dashboardSlug === slug
            ? profile.organizationId
            : profile?.organizationId === slug
              ? profile.organizationId
              : admin
                ? slug
                : null;

        if (!fallbackOrg) {
          setDashError("Aucun tableau de bord à cette adresse.");
          setDashboard(null);
          return;
        }

        setDashboard(defaultDashboard({ slug, organizationId: fallbackOrg, persisted: false }));
        setDashError(null);
      } catch (e) {
        if (!cancelled) {
          setDashError(e instanceof Error ? e.message : "Erreur Firestore");
          setDashboard(null);
        }
      } finally {
        if (!cancelled) setLoadingDash(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, slug, profile, profileLoading, admin]);

  const resolving = profileLoading || loadingDash;
  const error = profileError || dashError;
  const fromEnv = (import.meta.env.VITE_DEV_ORG_ID as string | undefined)?.trim() || null;

  return {
    slug,
    dashboard,
    profile,
    isPlatformAdmin: admin,
    organizationId: dashboard?.organizationId || (!slug && fromEnv) || null,
    resolving,
    error: error || null,
  };
}
