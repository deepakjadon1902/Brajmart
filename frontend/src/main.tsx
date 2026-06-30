import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { applyInitialData, readInitialData } from "./lib/initialData";

const root = document.getElementById("root")!;
const initialData = readInitialData();
applyInitialData(initialData);

const application = (
  <ErrorBoundary>
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

if (root.hasChildNodes() && initialData) {
  hydrateRoot(root, application);
} else {
  createRoot(root).render(application);
}
