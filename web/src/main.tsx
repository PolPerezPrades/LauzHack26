import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { sound } from "./sound";
import "./styles.css";

// sounds unlock on the first user gesture (browser autoplay rules)
sound.install();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
