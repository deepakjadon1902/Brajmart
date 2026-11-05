import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { BrowserRouter } from "react-router-dom";
import App, { preloadRouteForPath } from "./App.tsx";
import "./index.css";
import ErrorBoundary, { AppErrorFallback } from "./components/ErrorBoundary";
import { applyInitialData, readInitialData } from "./lib/initialData";
import { installModuleLoadRecovery, recoverFromModuleLoadError } from './lib/moduleLoadRecovery';

installModuleLoadRecovery();
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
    try {
      await preloadRouteForPath(window.location.pathname);
    } catch (error) {
      const loadError = error instanceof Error ? error : new Error(String(error));
      console.error('Page startup failed:', loadError);
      createRoot(root).render(<AppErrorFallback error={loadError} recovering={recoverFromModuleLoadError(loadError)} />);
      return;
    }
    hydrateRoot(root, application);
  } else {
    createRoot(root).render(application);
  }
};

void render();
