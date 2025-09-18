// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

console.log("main.tsx loaded");

const rootElement = document.getElementById("root");
console.log("Root element:", rootElement);

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
