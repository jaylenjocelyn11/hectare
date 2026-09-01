import type { User } from "firebase/auth";

export const RESERVED_SLUGS = new Set(["login", "admin", ""]);

export const NAV_ITEMS = [
  { key: "overview", path: "", label: "Tableau de bord" },
  { key: "temperatures", path: "temperatures", label: "Températures" },
  { key: "procedures", path: "procedures", label: "Procédures" },
  { key: "recipes", path: "recipes", label: "Recettes" },
  { key: "inventory", path: "inventory", label: "Inventaire" },
  { key: "groups", path: "groups", label: "Groupe" },
  { key: "reports", path: "reports", label: "Rapports" },
  { key: "settings", path: "settings", label: "Paramètres" },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]["key"];

export type DashboardNav = Partial<Record<NavKey, boolean>>;

export type DashboardConfig = {
  slug: string;
  name: string;
  organizationId: string;
  tagline: string;
  accent: string;
  nav: DashboardNav;
  persisted: boolean;
};

export type DashboardUserProfile = {
  organizationId: string | null;
  dashboardSlug: string | null;
  platformAdmin: boolean;
};

/** Teal sampled from the Rustiq wordmark (#506868). */
export const DEFAULT_ACCENT = "#506868";
const LEGACY_GOLD = "#c4a35a";

export function resolveAccent(accent?: string | null): string {
  const raw = (accent || "").trim();
  if (!raw || raw.toLowerCase() === LEGACY_GOLD) return DEFAULT_ACCENT;
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : DEFAULT_ACCENT;
}

export function slugifyPrefix(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function isPlatformAdmin(user: User | null, profile: DashboardUserProfile | null): boolean {
  if (!user) return false;
  const allow = (import.meta.env.VITE_PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
  if (allow && (user.email || "").toLowerCase() === allow) return true;
  if (profile?.platformAdmin === false) return false;
  return !!profile?.platformAdmin;
}

export function parseDashboardNav(value: unknown): DashboardNav {
  if (!value || typeof value !== "object") return {};
  const rec = value as Record<string, unknown>;
  const nav: DashboardNav = {};
  for (const item of NAV_ITEMS) {
    if (typeof rec[item.key] === "boolean") nav[item.key] = rec[item.key] as boolean;
  }
  return nav;
}

export function navVisible(nav: DashboardNav, key: NavKey): boolean {
  if (key === "overview" || key === "settings") return true;
  return nav[key] !== false;
}

export function dashboardPublicUrl(slug: string): string {
  if (typeof window === "undefined") return `#/${slug}`;
  const base = import.meta.env.BASE_URL || "/";
  const path = `${window.location.origin}${base}`.replace(/\/+$/, "/");
  return `${path}#/${slug}`;
}

export function defaultDashboard(partial: {
  slug: string;
  organizationId: string;
  name?: string;
  persisted?: boolean;
}): DashboardConfig {
  return {
    slug: partial.slug,
    organizationId: partial.organizationId,
    name: partial.name?.trim() || partial.slug,
    tagline: "Contrôle HACCP",
    accent: DEFAULT_ACCENT,
    nav: {},
    persisted: partial.persisted ?? false,
  };
}

export function themeFromAccent(accent: string): Record<string, string> {
  const color = resolveAccent(accent);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const sr = Math.min(255, Math.round(r + (255 - r) * 0.32));
  const sg = Math.min(255, Math.round(g + (255 - g) * 0.32));
  const sb = Math.min(255, Math.round(b + (255 - b) * 0.32));
  const soft = `#${sr.toString(16).padStart(2, "0")}${sg.toString(16).padStart(2, "0")}${sb.toString(16).padStart(2, "0")}`;
  return {
    "--gold": color,
    "--gold-soft": soft,
    "--accent": color,
    "--gold-dim": `rgba(${r}, ${g}, ${b}, 0.16)`,
    "--border": `rgba(${r}, ${g}, ${b}, 0.18)`,
  };
}
