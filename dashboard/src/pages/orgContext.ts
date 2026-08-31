export type OrgContext = {
  organizationId: string | null;
  resolving: boolean;
  error: string | null;
  slug: string | null;
  isPlatformAdmin: boolean;
  dashboard: import("../lib/dashboards").DashboardConfig | null;
};
