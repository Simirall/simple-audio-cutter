import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@knadh/oat/oat.min.css";
import "@knadh/oat/oat.min.js";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <main>
      <h1>Simple Audio Cutter</h1>
    </main>
  </StrictMode>,
);
