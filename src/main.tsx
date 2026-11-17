import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@knadh/oat/oat.min.css";
import { App } from "./app";
import "./style.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
