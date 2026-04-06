import type { ReactNode } from "react";
import { Link } from "./nav";
import { useAuth } from "./services/auth-context";

function AccessGate({
  title,
  description,
  accent,
}: {
  title: string;
  description: string;
  accent: "green" | "red";
}) {
  const styles =
    accent === "red"
      ? {
          ring: "bg-red-500/10 border-red-500/20",
          title: "text-red-300",
        }
      : {
          ring: "bg-[#C6E36C]/10 border-[#C6E36C]/20",
          title: "text-[#C6E36C]",
        };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm">
        <div
          className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${styles.ring}`}
        >
          <span className="text-2xl">🔒</span>
        </div>
        <div className="space-y-2">
          <h2 className={`text-lg font-semibold ${styles.title}`}>{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex justify-center gap-3">
          <Link
            to="/"
            className="px-4 py-2 rounded-lg border border-[rgba(168,187,238,0.12)] text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AuthGuard({
  children,
  title = "Zona privada",
  description = "Inicia sesión para acceder a esta sección y proteger tus datos personales.",
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) {
    return <AccessGate title={title} description={description} accent="green" />;
  }
  return <>{children}</>;
}

export function RoleGuard({
  children,
  role,
}: {
  children: ReactNode;
  role: "superadmin";
}) {
  const { isLoggedIn, isSuperAdmin } = useAuth();
  const allowed = role === "superadmin" ? isSuperAdmin : false;

  if (!isLoggedIn || !allowed) {
    return (
      <AccessGate
        title="Acceso restringido"
        description={
          !isLoggedIn
            ? "Inicia sesión con una cuenta autorizada para ver esta sección."
            : "Esta área está reservada para superadministradores."
        }
        accent="red"
      />
    );
  }
  return <>{children}</>;
}
