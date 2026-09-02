import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

import { ROOT_DOMAIN, dashboardPublicUrl, isValidSlug } from "./lib/dashboards";

const hash = window.location.hash;
if (hash.startsWith("#/")) {
  const path = hash.slice(2);
  const [first, ...rest] = path.split("/").filter(Boolean);
  const host = window.location.hostname.toLowerCase();
  const onApex = host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`;
  if (onApex && first && isValidSlug(first)) {
    const tail = rest.length ? `/${rest.join("/")}` : "/";
    window.location.replace(`${dashboardPublicUrl(first)}${tail === "/" ? "/" : tail}`);
  } else {
    const next = `/${path}${window.location.search}`;
    window.history.replaceState(null, "", next);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
