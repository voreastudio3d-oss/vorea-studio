import { type ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate, pathStartsWith } from "./nav";
import { User, Globe, Menu, X, ChevronDown, LogIn, LogOut, Crown, Shield, Check, Coins, Newspaper } from "lucide-react";
import logoSrc from "../imports/logo-voreaStudio-h.svg";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { Footer } from "./components/Footer";
import { useAuth } from "./services/auth-context";
import { AuthDialog } from "./components/AuthDialog";
import { useI18n } from "./services/i18n-context";
import { getVisibleToolNavItems, isToolRouteActive } from "./route-access";

export function Root({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t, locale, setLocale, availableLocales, displayCode } = useI18n();
  const isEditor = pathname === "/studio";
  const isFullscreen = pathname === "/studio" || pathname === "/relief";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsDropdown, setToolsDropdown] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [localeDropdown, setLocaleDropdown] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const localeRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const { isLoggedIn, user, logout, isSuperAdmin, creditBalance } = useAuth();
  const userTier = user?.tier ?? "FREE";
  const visibleToolPages = getVisibleToolNavItems({ isLoggedIn, isSuperAdmin });

  const isToolPage = visibleToolPages.some((p) => isToolRouteActive(p, pathname));
  const showAdminNav = isSuperAdmin;

  // Close locale dropdown on outside click
  useEffect(() => {
    if (!localeDropdown) return;
    const handler = (e: MouseEvent) => {
      if (localeRef.current && !localeRef.current.contains(e.target as Node)) {
        setLocaleDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [localeDropdown]);

  useEffect(() => {
    if (!toolsDropdown) return;
    const handler = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [toolsDropdown]);

  useEffect(() => {
    if (!userDropdown) return;
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userDropdown]);

  return (
    <div
      className={`${
        isFullscreen ? "h-screen overflow-hidden" : "min-h-screen"
      } bg-background text-white flex flex-col font-sans`}
    >
      <header className="sticky top-0 z-50 h-12 shrink-0 glass border-b border-border flex items-center justify-between px-6 backdrop-blur-md">
        <div className="flex items-center gap-8">
          <Link to="/">
            <img src={logoSrc} alt="Vorea Studio" className="h-6 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link
              to="/"
              className={`hover:text-primary transition-colors ${
                pathname === "/" ? "text-primary" : "text-gray-300"
              }`}
            >
              {t("nav.home")}
            </Link>
            <Link
              to="/studio"
              className={`hover:text-primary transition-colors ${
                pathname === "/studio" ? "text-primary" : "text-gray-300"
              }`}
            >
              {t("nav.studio")}
            </Link>

            {/* Tools dropdown */}
            <div className="relative" ref={toolsRef}>
              <button
                className={`flex items-center gap-1 hover:text-primary transition-colors ${
                  isToolPage ? "text-primary" : "text-gray-300"
                }`}
                onClick={() => setToolsDropdown(!toolsDropdown)}
              >
                {t("nav.tools")}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolsDropdown ? "rotate-180" : ""}`} />
              </button>
              {toolsDropdown && (
                <div className="absolute top-full left-0 mt-2 w-[520px] bg-surface-raised/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl z-50 p-4 grid grid-cols-2 gap-2">
                  {visibleToolPages.map((p) => {
                    const Icon = p.icon;
                    const isActive = isToolRouteActive(p, pathname);
                    return (
                      <Link
                        key={p.route}
                        to={p.route}
                        className={`flex items-start gap-4 p-3 rounded-xl transition-all duration-200 border border-transparent ${
                          isActive
                            ? "bg-primary/10 border-primary/20 text-primary"
                            : "hover:bg-white/5 hover:border-white/10 text-gray-300 hover:text-white"
                        }`}
                        onClick={() => setToolsDropdown(false)}
                      >
                        <div className={`mt-0.5 w-10 h-10 shrink-0 rounded-lg flex items-center justify-center bg-black/30 border border-white/5 shadow-inner ${isActive ? p.color : "text-gray-400"}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className={`text-sm font-semibold mb-1 ${isActive ? "text-primary" : "text-white"}`}>
                            {t(p.key)}
                          </div>
                          <div className="text-xs text-gray-500 font-normal leading-snug">
                            {p.desc}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <Link
              to="/community"
              className={`hover:text-primary transition-colors ${
                pathStartsWith(pathname, "/community") ? "text-primary" : "text-gray-300"
              }`}
            >
              {t("nav.community")}
            </Link>

            <Link
              to="/leaderboard"
              className={`hover:text-primary transition-colors flex items-center gap-1 ${
                pathStartsWith(pathname, "/leaderboard") ? "text-primary" : "text-gray-300"
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              {t("nav.leaderboard")}
            </Link>

            <Link
              to="/news"
              className={`hover:text-primary transition-colors flex items-center gap-1 ${
                pathStartsWith(pathname, "/news") ? "text-primary" : "text-gray-300"
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              {t("nav.news")}
            </Link>

            <Link
              to="/plans"
              className={`hover:text-primary transition-colors flex items-center gap-1 ${
                pathname === "/plans" ? "text-primary" : "text-gray-300"
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              {t("nav.plans")}
            </Link>

            {/* Admin link – desktop (superadmin only) */}
            {showAdminNav && (
              <Link
                to="/admin"
                className={`hover:text-primary transition-colors flex items-center gap-1 ${
                  pathname === "/admin" ? "text-primary" : "text-red-400"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                {t("nav.admin")}
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {/* ── Locale picker (desktop) ── */}
          <div className="hidden md:block relative" ref={localeRef}>
            <button
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white cursor-pointer transition-colors"
              onClick={() => setLocaleDropdown(!localeDropdown)}
            >
              <Globe size={14} />
              <span>{displayCode}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${localeDropdown ? "rotate-180" : ""}`} />
            </button>
            {localeDropdown && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-surface-raised border border-border rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                {availableLocales.map((l) => (
                  <button
                    key={l.code}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-white/5 transition-colors ${
                      locale === l.code ? "text-primary bg-primary/5" : "text-gray-300"
                    }`}
                    onClick={() => { setLocale(l.code); setLocaleDropdown(false); }}
                  >
                    <span className="text-base">{l.flag}</span>
                    <span className="flex-1">{l.label}</span>
                    {locale === l.code && <Check className="w-3.5 h-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auth area */}
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              {/* Credit Balance Display (Desktop) */}
              {creditBalance !== null && (
                <div className="hidden md:flex items-center">
                  {creditBalance < 50 ? (
                    <Link
                      to="/plans"
                      className="group flex items-center gap-1.5 px-1.5 py-1 pr-2 rounded-full border border-red-500/30 bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-all relative overflow-hidden shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                    >
                      <div className="absolute inset-0 bg-red-500/10 animate-pulse"></div>
                      <Coins className="w-3.5 h-3.5 ml-1 z-10 relative" />
                      <span className="z-10 relative">{creditBalance} <span className="hidden xl:inline">{t("nav.credits")}</span></span>
                      <span className="z-10 relative ml-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-[0_0_10px_rgba(239,68,68,0.5)] group-hover:bg-red-600 transition-colors">{t("nav.buy")}</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-raised border border-border text-gray-300 text-xs font-medium cursor-default">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>{creditBalance} <span className="hidden xl:inline">{t("nav.credits")}</span></span>
                    </div>
                  )}
                </div>
              )}

	              <div className="relative" ref={userRef}>
	                <button
	                  className="flex items-center gap-2 cursor-pointer"
	                  onClick={() => setUserDropdown(!userDropdown)}
	              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-blue-500 p-[2px]">
                  <div className="w-full h-full rounded-full bg-surface-raised flex items-center justify-center">
                    <User size={14} className="text-gray-300" />
                  </div>
                </div>
                <span className="hidden md:block text-xs text-gray-300 max-w-[100px] truncate">
                  {user?.displayName}
                </span>
              </button>
              {userDropdown && (
                <div className="absolute top-full right-0 mt-2 w-52 bg-surface-raised border border-border rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-border-subtle">
                    <p className="text-sm text-white truncate">{user?.displayName}</p>
                    <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                      {user?.tier}
                    </span>
                    {/* Credit Balance Badge */}
                    {creditBalance !== null && (
                      <span className={`inline-flex items-center gap-1 mt-1 ml-1 text-[9px] px-1.5 py-0.5 rounded ${
                        creditBalance >= 100
                          ? "bg-primary/10 text-primary"
                          : creditBalance >= 50
                          ? "bg-green-500/15 text-green-400"
                          : creditBalance > 0
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400"
                      }`}>
                        <Coins className="w-2.5 h-2.5" />
                        {creditBalance}
                      </span>
                    )}
                  </div>
                  <Link
                    to="/profile"
                    className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                    onClick={() => setUserDropdown(false)}
                  >
                    {t("nav.myProfile")}
                  </Link>
                  <Link
                    to="/plans"
                    className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                    onClick={() => setUserDropdown(false)}
                  >
                    <span className="flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-primary" />
                      {t("nav.membership")}
                    </span>
                  </Link>
                  {isSuperAdmin && (
                    <Link
                      to="/admin"
                      className="block px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/5 transition-colors"
                      onClick={() => setUserDropdown(false)}
                    >
                      <span className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5" />
                        {t("nav.admin")}
                      </span>
                    </Link>
                  )}
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 border-t border-border-subtle"
                    onClick={() => {
                      logout();
                      setUserDropdown(false);
                      navigate("/");
                    }}
                  >
                    <LogOut className="w-3.5 h-3.5" /> {t("nav.logout")}
                  </button>
                </div>
              )}
              </div>
            </div>
          ) : (
            <button
              className="hidden md:flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
              onClick={() => setAuthOpen(true)}
            >
              <LogIn size={14} />
              {t("nav.login")}
            </button>
          )}

          {/* Hamburger button – mobile only */}
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile nav overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 top-12 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <nav
        className={`fixed top-12 left-0 right-0 z-50 md:hidden flex flex-col glass border-b border-border backdrop-blur-md overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        <Link
          to="/"
          className={`px-6 py-3 text-sm border-b border-border-subtle hover:bg-white/5 transition-colors ${
            pathname === "/" ? "text-primary" : "text-gray-300"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          {t("nav.home")}
        </Link>
        <Link
          to="/studio"
          className={`px-6 py-3 text-sm border-b border-border-subtle hover:bg-white/5 transition-colors ${
            pathname === "/studio" ? "text-primary" : "text-gray-300"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          {t("nav.studio")}
        </Link>

        {/* Tool pages in mobile */}
        <div className="px-6 py-2 text-[10px] text-gray-500 uppercase tracking-widest border-b border-border-subtle bg-black/20">
          {t("nav.tools")}
        </div>
        {visibleToolPages.map((p) => {
          const Icon = p.icon;
          return (
            <Link
              key={p.route}
              to={p.route}
              className={`px-8 py-3 text-sm border-b border-border-faint hover:bg-white/5 transition-colors flex items-center gap-3 ${
                isToolRouteActive(p, pathname) ? "text-primary" : "text-gray-400"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon className="w-4 h-4" />
              {t(p.key)}
            </Link>
          );
        })}

        <Link
          to="/community"
          className={`px-6 py-3 text-sm border-b border-border-subtle hover:bg-white/5 transition-colors ${
            pathStartsWith(pathname, "/community") ? "text-primary" : "text-gray-300"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          {t("nav.community")}
        </Link>
        <Link
          to="/leaderboard"
          className={`px-6 py-3 text-sm border-b border-border-subtle hover:bg-white/5 transition-colors flex items-center gap-2 ${
            pathStartsWith(pathname, "/leaderboard") ? "text-primary" : "text-gray-300"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          <Crown className="w-3.5 h-3.5" /> {t("nav.leaderboard")}
        </Link>
        <Link
          to="/news"
          className={`px-6 py-3 text-sm border-b border-border-subtle hover:bg-white/5 transition-colors flex items-center gap-2 ${
            pathStartsWith(pathname, "/news") ? "text-primary" : "text-gray-300"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          <Newspaper className="w-3.5 h-3.5" /> {t("nav.news")}
        </Link>
        <Link
          to="/plans"
          className={`px-6 py-3 text-sm border-b border-border-subtle hover:bg-white/5 transition-colors flex items-center gap-2 ${
            pathname === "/plans" ? "text-primary" : "text-gray-300"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          <Crown className="w-3.5 h-3.5" /> {t("nav.plans")}
        </Link>

        {/* Admin link – mobile (superadmin only) */}
        {showAdminNav && (
          <Link
            to="/admin"
            className={`px-6 py-3 text-sm border-b border-border-subtle hover:bg-red-500/5 transition-colors flex items-center gap-2 ${
              pathname === "/admin" ? "text-primary" : "text-red-400"
            }`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <Shield className="w-3.5 h-3.5" /> {t("nav.admin")}
          </Link>
        )}

        {/* Mobile auth */}
        {isLoggedIn ? (
          <button
            className="px-6 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left flex items-center gap-2 border-b border-border-subtle"
            onClick={() => {
              logout();
              setMobileMenuOpen(false);
              navigate("/");
            }}
          >
            <LogOut className="w-3.5 h-3.5" /> {t("nav.logout")}
          </button>
        ) : (
          <button
            className="px-6 py-3 text-sm text-primary hover:bg-primary/10 transition-colors text-left flex items-center gap-2 border-b border-border-subtle"
            onClick={() => {
              setMobileMenuOpen(false);
              setAuthOpen(true);
            }}
          >
            <LogIn className="w-3.5 h-3.5" /> {t("nav.loginRegister")}
          </button>
        )}

        {/* Mobile locale picker */}
        <div className="px-6 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <Globe size={14} />
            <span>{displayCode}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableLocales.map((l) => (
              <button
                key={l.code}
                className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                  locale === l.code
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-white/5 text-gray-400 border border-border-subtle hover:text-white"
                }`}
                onClick={() => { setLocale(l.code); setMobileMenuOpen(false); }}
              >
                {l.flag} {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      {!isFullscreen && <Breadcrumbs />}

      <main className="flex-1 flex flex-col min-h-0">{children}</main>

      {/* Footer */}
      {!isFullscreen && <Footer />}

      {/* Auth Dialog */}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
