import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const hash = window.location.hash;
if (hash.startsWith("#/")) {
  const path = hash.slice(2);
  window.history.replaceState(null, "", `/${path}${window.location.search}`);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
