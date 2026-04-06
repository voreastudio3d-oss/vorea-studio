import React, { Suspense } from "react";
import { NavProvider, useLocation, useNavigate, useRawSearch, pathStartsWith } from "./nav";
import { Root } from "./Root";
import { Landing } from "./pages/Landing";
import { MakerLanding } from "./pages/MakerLanding";
import EducationLanding from "./pages/EducationLanding";
import AICreatorsLanding from "./pages/AICreatorsLanding";
import BenchmarkPage from "./pages/BenchmarkPage";
import { Editor } from "./pages/Editor";
import { Explore } from "./pages/Explore";
import { Leaderboard } from "./pages/Leaderboard";
import { Profile } from "./pages/Profile";
import { Organic } from "./pages/Organic";
import { AIStudio } from "./pages/AIStudio";
import { MakerWorld } from "./pages/MakerWorld";
import { NewsList } from "./pages/NewsList";
import { NewsDetail } from "./pages/NewsDetail";
import { Membership } from "./pages/Membership";
import { GCodeCollection } from "./pages/GCodeCollection";
import { Relief } from "./pages/Relief";
import { SuperAdmin } from "./pages/SuperAdmin";
import { ModelDetail } from "./pages/ModelDetail";
import { UserPublic } from "./pages/UserPublic";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { Contact } from "./pages/Contact";
import { Contributors } from "./pages/Contributors";
import { AuthProvider, useAuth } from "./services/auth-context";
import { ModelProvider } from "./services/model-context";
import { I18nProvider, useI18n } from "./services/i18n-context";
import { FeedbackPanel } from "./components/FeedbackPanel";
import { Toaster } from "sonner";
import { getRouteAccessLevel } from "./route-access";
import { AuthGuard, RoleGuard } from "./route-guards";
import { initAnalytics, trackAnalyticsEvent, trackPageView, isInternalRoute } from "./services/analytics";
import { syncRouteHead } from "./route-head";

// ─── Error boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown) {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#0d1117",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "monospace",
            gap: "1rem",
            padding: "2rem",
          }}
        >
          <span style={{ color: "#C6E36C", fontSize: "1.1rem" }}>
            Vorea Studio
          </span>
          <span style={{ color: "#ef4444", fontSize: "0.8rem" }}>
            {this.state.message}
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Route Helpers ─────────────────────────────────────────────────────────────

function RedirectPath({ to }: { to: string }) {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
}

// ─── Page router ──────────────────────────────────────────────────────────────

function Pages() {
  const { pathname } = useLocation();
  const search = useRawSearch();
  const { isLoggedIn } = useAuth();
  const { locale } = useI18n();

  React.useEffect(() => {
    initAnalytics();
  }, []);

  React.useEffect(() => {
    const fullPath = `${pathname}${search || ""}`;
    syncRouteHead(pathname, locale);
    trackPageView(fullPath);

    // ── Normalized open_tool events ──
    const TOOL_ROUTES: Record<string, { tool: string; surface: string; legacyEvent?: string }> = {
      "/studio":           { tool: "studio",     surface: "editor",      legacyEvent: "open_editor" },
      "/organic":          { tool: "organic",    surface: "editor" },
      "/ai-studio":        { tool: "ai_studio",  surface: "editor",      legacyEvent: "open_ai_studio" },
      "/relief":           { tool: "relief",     surface: "editor" },
      "/makerworld":       { tool: "makerworld", surface: "editor" },
      "/community":        { tool: "community",  surface: "explore" },
      "/gcode-collection": { tool: "gcode",      surface: "collection" },
      "/plans":            { tool: "pricing",    surface: "conversion",  legacyEvent: "view_pricing" },
      "/profile":          { tool: "profile",    surface: "account" },
      "/news":             { tool: "news",       surface: "content" },
    };

    const route = TOOL_ROUTES[pathname];
    if (route) {
      const params = {
        tool: route.tool,
        surface: route.surface,
        auth_state: isLoggedIn ? "authenticated" : "anonymous",
        route: fullPath,
      };
      trackAnalyticsEvent("open_tool", params);
      // Keep legacy event names for GA4 historical continuity
      if (route.legacyEvent) {
        trackAnalyticsEvent(route.legacyEvent, params);
      }
    }
  }, [pathname, search, isLoggedIn, locale]);

  const routeAccess = getRouteAccessLevel(pathname);
  return (
    <Root>
      {pathname === "/studio" && <Editor />}
      {pathname === "/community" && <Explore />}
      {pathname === "/leaderboard" && <Leaderboard />}
      {pathname === "/profile" && (
        <AuthGuard title="Tu perfil es privado">
          <Profile />
        </AuthGuard>
      )}
      {pathname === "/parametric" && <RedirectPath to="/studio?mode=parametric" />}
      {pathname === "/organic" && <Organic />}
      {pathname === "/ai-studio" && <AIStudio />}
      {pathname === "/makerworld" && <MakerWorld />}
      {pathname === "/news" && <NewsList />}
      {pathname === "/plans" && <Membership />}
      {pathname === "/gcode-collection" && (
        <AuthGuard
          title="Tu colección GCode es privada"
          description="Inicia sesión para ver, sincronizar y proteger tus archivos listos para imprimir."
        >
          <GCodeCollection />
        </AuthGuard>
      )}
      {pathStartsWith(pathname, "/news") && pathname !== "/news" && <NewsDetail />}
      {pathname === "/relief" && <Relief />}
      {pathname === "/admin" && <RoleGuard role="superadmin"><SuperAdmin /></RoleGuard>}
      {pathStartsWith(pathname, "/model") && <ModelDetail />}
      {pathStartsWith(pathname, "/user") && <UserPublic />}
      {pathname === "/terms" && <Terms />}
      {pathname === "/privacy" && <Privacy />}
      {pathname === "/contact" && <Contact />}
      {pathname === "/contributors" && <Contributors />}
      {pathStartsWith(pathname, "/for/makers") && <MakerLanding />}
      {pathStartsWith(pathname, "/for/education") && <EducationLanding />}
      {pathStartsWith(pathname, "/for/ai-creators") && <AICreatorsLanding />}
      {pathname === "/benchmark" && <BenchmarkPage />}
      {pathname === "/" && <Landing />}
      {![
        "/",
        "/studio",
        "/community",
        "/leaderboard",
        "/profile",

        "/organic",
        "/ai-studio",
        "/makerworld",
        "/news",
        "/plans",
        "/gcode-collection",
        "/relief",
        "/admin",
        "/terms",
        "/privacy",
        "/contact",
        "/contributors",
        "/benchmark",
      ].includes(pathname) &&
        !pathStartsWith(pathname, "/news") &&
        !pathStartsWith(pathname, "/model") &&
        !pathStartsWith(pathname, "/user") &&
        !pathStartsWith(pathname, "/for") &&
        routeAccess === "public" && <Landing />}
    </Root>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              background: "#0d1117",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        }
      >
        <I18nProvider>
        <AuthProvider>
          <ModelProvider>
            <NavProvider>
              <Pages />
              <FeedbackPanel />
              <Toaster
                theme="dark"
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: "#1a1f36",
                    border: "1px solid rgba(168,187,238,0.12)",
                    color: "#fff",
                  },
                }}
              />
            </NavProvider>
          </ModelProvider>
        </AuthProvider>
        </I18nProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
