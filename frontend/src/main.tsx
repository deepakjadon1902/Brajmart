import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { BrowserRouter } from "react-router-dom";
import App, { preloadRouteForPath } from "./App.tsx";
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

const render = async () => {
  if (root.hasChildNodes() && initialData) {
    await preloadRouteForPath(window.location.pathname);
    hydrateRoot(root, application);
  } else {
    createRoot(root).render(application);
  }
};

void render();
