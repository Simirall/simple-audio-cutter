import { Provider } from "jotai";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@knadh/oat/css/00-base.css";
import "@knadh/oat/css/01-theme.css";
import "@knadh/oat/css/button.css";
import "@knadh/oat/css/form.css";
import "@knadh/oat/css/progress.css";
import { App } from "./app";
import "./style.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <Provider>
      <App />
    </Provider>
  </StrictMode>,
);
