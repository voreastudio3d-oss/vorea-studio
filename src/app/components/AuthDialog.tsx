import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "../services/auth-context";
import { useI18n } from "../services/i18n-context";
import { toast } from "sonner";
import { LogIn, UserPlus, Eye, EyeOff, Mail, User, Lock, Chrome, KeyRound } from "lucide-react";
import { AuthApi } from "../services/api-client";
import { trackAnalyticsEvent } from "../services/analytics";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

export function AuthDialog({
  open,
  onOpenChange,
  defaultTab = "login",
}: AuthDialogProps) {
  const { login, register, socialLogin } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<"login" | "register" | "forgot-password" | "reset-password">(defaultTab);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register fields
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // Reset fields
  const [resetEmail, setResetEmail] = useState("");
  const [resetPin, setResetPin] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  useEffect(() => {
    if (open && tab === "register") {
      trackAnalyticsEvent("sign_up_start", { source: "auth_dialog" });
    }
  }, [open, tab]);

  const resetFields = () => {
    setLoginEmail("");
    setLoginPassword("");
    setRegName("");
    setRegUsername("");
    setRegEmail("");
    setRegPassword("");
    setRegConfirm("");
    setResetEmail("");
    setResetPin("");
    setResetNewPassword("");
    setShowPassword(false);
  };

  const handleLogin = () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error("Completa todos los campos");
      return;
    }
    setLoading(true);
    login(loginEmail.trim(), loginPassword)
      .then(() => {
        toast.success(t("auth.loginSuccess"));
        resetFields();
        onOpenChange(false);
      })
      .catch((e: any) => {
        toast.error(e?.message || t("auth.loginError"));
      })
      .finally(() => setLoading(false));
  };

  const handleRegister = () => {
    if (
      !regName.trim() ||
      !regUsername.trim() ||
      !regEmail.trim() ||
      !regPassword.trim()
    ) {
      toast.error(t("auth.fillAllFields"));
      return;
    }
    if (regPassword !== regConfirm) {
      toast.error(t("auth.passwordsMismatch"));
      return;
    }
    // Must match server-side rules: 8+ chars, 1 upper, 1 digit, 1 special
    if (regPassword.length < 8) {
      toast.error(t("auth.pwRuleMinLength") || "La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (!/[A-Z]/.test(regPassword)) {
      toast.error(t("auth.pwRuleUppercase") || "La contraseña debe contener al menos una mayúscula");
      return;
    }
    if (!/[0-9]/.test(regPassword)) {
      toast.error(t("auth.pwRuleDigit") || "La contraseña debe contener al menos un número");
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':",./<>?]/.test(regPassword)) {
      toast.error(t("auth.pwRuleSpecial") || "La contraseña debe contener al menos un carácter especial");
      return;
    }
    setLoading(true);
    register({
      displayName: regName.trim(),
      username: regUsername.trim(),
      email: regEmail.trim(),
      password: regPassword,
    })
      .then(() => {
        trackAnalyticsEvent("sign_up_complete", { source: "email" });
        toast.success(t("auth.registerSuccess"));
        resetFields();
        onOpenChange(false);
      })
      .catch((e: any) => {
        toast.error(e?.message || t("auth.registerError"));
      })
      .finally(() => setLoading(false));
  };

  const handleRequestReset = async () => {
    if (!resetEmail.trim()) {
      toast.error(t("auth.emailPlaceholder") || "Ingresa tu email");
      return;
    }
    setLoading(true);
    try {
      const res = await AuthApi.requestPasswordReset(resetEmail.trim());
      toast.success(res.message || "Email de recuperación enviado");
      if (res.pinDev) {
        toast.info(`[DEV ONLY] PIN es: ${res.pinDev}`, { duration: 10000 });
      }
      setTab("reset-password");
    } catch (e: any) {
      toast.error(e?.message || "Error al solicitar reseteo");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPin.trim() || !resetNewPassword.trim()) {
      toast.error("Completa el PIN y la nueva contraseña");
      return;
    }
    setLoading(true);
    try {
      const res = await AuthApi.resetPassword(resetEmail.trim(), resetPin.trim(), resetNewPassword);
      toast.success(res.message || "Contraseña actualizada exitosamente");
      setTab("login");
      setLoginEmail(resetEmail.trim());
      setLoginPassword("");
    } catch (e: any) {
      toast.error(e?.message || "Error al resetear contraseña");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "instagram") => {
    if (provider === "google") {
      setSocialLoading("google");
      try {
        // Fetch Client ID from our backend
        const { AuthApi: Api } = await import("../services/api-client");
        const config = await Api.getGoogleConfig();
        if (!config.configured || !config.clientId) {
          toast.error(t("auth.googleNotConfigured"));
          return;
        }
        // Load Google Identity Services script
        await new Promise<void>((resolve, reject) => {
          if ((window as any).google?.accounts) return resolve();
          const script = document.createElement("script");
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Google GSI"));
          document.head.appendChild(script);
        });
        // Initialize and prompt One Tap
        (window as any).google.accounts.id.initialize({
          client_id: config.clientId,
          callback: async (response: { credential: string }) => {
            try {
              await socialLogin("google", response.credential);
              toast.success(t("auth.googleLoginSuccess"));
              resetFields();
              onOpenChange(false);
            } catch (e: any) {
              toast.error(e?.message || t("auth.googleError"));
            } finally {
              setSocialLoading(null);
            }
          },
          use_fedcm_for_prompt: true,
        });
        (window as any).google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback: render button if One Tap is blocked
            (window as any).google.accounts.id.renderButton(
              document.getElementById("google-btn-container"),
              { theme: "outline", size: "large", text: "continue_with", width: 300 }
            );
            setSocialLoading(null);
          }
        });
      } catch (e: any) {
        toast.error(e?.message || t("auth.googleError"));
        setSocialLoading(null);
      }
      return;
    }
    // Other providers
    toast.info(`${provider} login próximamente`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1f36] border-[rgba(168,187,238,0.12)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {tab === "login"
              ? t("auth.loginTitle")
              : tab === "register"
              ? t("auth.registerTitle")
              : tab === "forgot-password"
              ? "Recuperar contraseña"
              : "Cambiar contraseña"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {tab === "login"
              ? t("auth.loginDesc")
              : tab === "register"
              ? t("auth.registerDesc")
              : tab === "forgot-password"
              ? "Ingresa tu email y te enviaremos un PIN para crear una nueva contraseña."
              : "Ingresa el PIN que enviamos a tu email y la nueva contraseña."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-[#0d1117] p-1 mb-4">
          <button
            className={`flex-1 py-2 text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
              tab === "login"
                ? "bg-[#C6E36C]/15 text-[#C6E36C]"
                : "text-gray-400 hover:text-gray-200"
            }`}
            onClick={() => setTab("login")}
          >
            <LogIn className="w-3.5 h-3.5" /> {t("auth.tabLogin")}
          </button>
          <button
            className={`flex-1 py-2 text-sm rounded-lg transition-all flex items-center justify-center gap-2 ${
              tab === "register"
                ? "bg-[#C6E36C]/15 text-[#C6E36C]"
                : "text-gray-400 hover:text-gray-200"
            }`}
            onClick={() => setTab("register")}
          >
            <UserPlus className="w-3.5 h-3.5" /> {t("auth.tabRegister")}
          </button>
        </div>

        {tab === "login" ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                {t("auth.email")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                {t("auth.password")}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="pl-10 pr-10"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {t("auth.loginButton")}
            </Button>
            <div className="flex justify-between items-center text-xs">
              <button
                className="text-gray-500 hover:text-white hover:underline transition-colors"
                onClick={() => setTab("forgot-password")}
              >
                {t("auth.forgotPassword") || "¿Olvidaste tu contraseña?"}
              </button>
              <button
                className="text-[#C6E36C] hover:underline"
                onClick={() => setTab("register")}
              >
                {t("auth.tabRegister")}
              </button>
            </div>
          </div>
        ) : tab === "register" ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                {t("auth.name")}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder={t("auth.namePlaceholder")}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                {t("auth.username")}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  @
                </span>
                <Input
                  placeholder={t("auth.usernamePlaceholder")}
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                {t("auth.email")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">
                  {t("auth.password")}
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.pwPlaceholderStrong") || "Mín. 8 chars"}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">
                  {t("auth.confirmPassword")}
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.confirmPasswordPlaceholder") || "Repetir"}
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                />
              </div>
            </div>
            {/* Password strength checklist */}
            {regPassword.length > 0 && (
              <div className="rounded-lg bg-[#0d1117] border border-[rgba(168,187,238,0.08)] p-3 space-y-1">
                {[
                  { ok: regPassword.length >= 8, label: t("auth.pwRuleMinLength") || "8+ caracteres" },
                  { ok: /[A-Z]/.test(regPassword), label: t("auth.pwRuleUppercase") || "1 mayúscula" },
                  { ok: /[0-9]/.test(regPassword), label: t("auth.pwRuleDigit") || "1 número" },
                  { ok: /[!@#$%^&*()_+\-=\[\]{};':",./<>?]/.test(regPassword), label: t("auth.pwRuleSpecial") || "1 carácter especial" },
                ].map((rule) => (
                  <div key={rule.label} className={`flex items-center gap-2 text-[11px] transition-colors ${rule.ok ? "text-emerald-400" : "text-gray-600"}`}>
                    <span className={`w-3 h-3 rounded-full border flex items-center justify-center flex-shrink-0 ${rule.ok ? "border-emerald-400 bg-emerald-400/15" : "border-gray-700"}`}>
                      {rule.ok && <span className="block w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </span>
                    {rule.label}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={() => setShowPassword(!showPassword)}
                className="accent-[#C6E36C]"
                id="show-pw"
              />
              <label
                htmlFor="show-pw"
                className="text-xs text-gray-500 cursor-pointer"
              >
                {t("auth.password")}
              </label>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {t("auth.registerButton")}
            </Button>
            <p className="text-center text-xs text-gray-500">
              <button
                className="text-[#C6E36C] hover:underline"
                onClick={() => setTab("login")}
              >
                {t("auth.tabLogin")}
              </button>
            </p>
          </div>
        ) : tab === "forgot-password" ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                {t("auth.email")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === "Enter" && handleRequestReset()}
                />
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleRequestReset}
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              Recuperar
            </Button>
            <p className="text-center text-xs text-gray-500">
              <button
                className="hover:text-white transition-colors"
                onClick={() => setTab("login")}
              >
                Volver a Iniciar Sesión
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                PIN de Restauración
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="PIN enviado a tu correo"
                  value={resetPin}
                  onChange={(e) => setResetPin(e.target.value)}
                  className="tracking-widest"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                Nueva Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres, 1 número, 1 símbolo"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Cambiar Contraseña
            </Button>
            <p className="text-center text-xs text-gray-500">
              <button
                className="hover:text-white transition-colors"
                onClick={() => setTab("login")}
              >
                Volver a Iniciar Sesión
              </button>
            </p>
          </div>
        )}

        {/* Social Login Divider & Buttons */}
        <div className="mt-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[rgba(168,187,238,0.1)]" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{t("auth.orContinueWith")}</span>
            <div className="flex-1 h-px bg-[rgba(168,187,238,0.1)]" />
          </div>
          <div className="flex gap-3">
            <button
              id="google-btn-container"
              onClick={() => handleSocialLogin("google")}
              disabled={!!socialLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0d1117] border border-[rgba(168,187,238,0.12)] hover:border-[rgba(168,187,238,0.25)] text-sm text-gray-300 hover:text-white transition-all disabled:opacity-50"
            >
              {socialLoading === "google" ? (
                <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Google
            </button>
            {false && (
              <button
                onClick={() => handleSocialLogin("instagram")}
                disabled={!!socialLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0d1117] border border-[rgba(168,187,238,0.12)] hover:border-[rgba(168,187,238,0.25)] text-sm text-gray-300 hover:text-white transition-all disabled:opacity-50"
              >
                {socialLoading === "instagram" ? (
                  <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <defs>
                      <linearGradient id="ig-grad" x1="0" y1="24" x2="24" y2="0">
                        <stop offset="0%" stopColor="#feda75" />
                        <stop offset="25%" stopColor="#fa7e1e" />
                        <stop offset="50%" stopColor="#d62976" />
                        <stop offset="75%" stopColor="#962fbf" />
                        <stop offset="100%" stopColor="#4f5bd5" />
                      </linearGradient>
                    </defs>
                    <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="2" />
                    <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="2" />
                    <circle cx="17.5" cy="6.5" r="1.25" fill="url(#ig-grad)" />
                  </svg>
                )}
                Instagram
              </button>
            )}
          </div>
          <p className="text-[9px] text-gray-600 text-center mt-3">
            Al continuar aceptas los Términos de Servicio de Vorea Studio
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
