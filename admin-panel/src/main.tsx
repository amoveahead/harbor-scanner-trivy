import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, savedTheme } from "./App";
import "./hospital/index.css";
import "./panel.css";

// Set the theme before the first paint, so the page does not fade from light.
document.body.setAttribute("data-theme", savedTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
