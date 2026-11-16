import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <main>
      <h1>Simple Audio Cutter</h1>
    </main>
  </StrictMode>,
);
