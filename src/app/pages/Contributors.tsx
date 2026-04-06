import { useEffect, useMemo, useState } from "react";
import {
  HeartHandshake,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Link } from "../nav";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { AuthDialog } from "../components/AuthDialog";
import { useI18n } from "../services/i18n-context";
import { useAuth } from "../services/auth-context";
import {
  ContributorsApi,
  DonationsApi,
  type DonationSummaryRecord,
  type DonationTierId,
  type DonationTierRecord,
  type PublicContributorRecord,
} from "../services/api-client";
import { trackAnalyticsEvent } from "../services/analytics";
import { toast } from "sonner";

const FALLBACK_TIERS: DonationTierRecord[] = [
  { id: "impulsor", suggestedAmountUsd: 5, minimumTotalUsd: 5, badgeId: "contributor_impulsor" },
  { id: "aliado", suggestedAmountUsd: 15, minimumTotalUsd: 15, badgeId: "contributor_aliado" },
  { id: "patrono", suggestedAmountUsd: 35, minimumTotalUsd: 35, badgeId: "contributor_patrono" },
  { id: "mecenas", suggestedAmountUsd: 75, minimumTotalUsd: 75, badgeId: "contributor_mecenas" },
];

function getTierMeta(locale: string) {
  const isEnglish = locale.toLowerCase().startsWith("en");
  const isPortuguese = locale.toLowerCase().startsWith("pt");

  return {
    impulsor: {
      name: isEnglish ? "Booster" : isPortuguese ? "Impulsor" : "Impulsor",
      description: isEnglish
        ? "Helps us ship concrete fixes and visible product polish."
        : isPortuguese
        ? "Ajuda a liberar correções concretas e melhorias visíveis do produto."
        : "Ayuda a liberar correcciones concretas y mejoras visibles del producto.",
    },
    aliado: {
      name: isEnglish ? "Ally" : isPortuguese ? "Aliado" : "Aliado",
      description: isEnglish
        ? "Sustains continuous iteration across community, UX and core tools."
        : isPortuguese
        ? "Sustenta iteração contínua em comunidade, UX e ferramentas centrais."
        : "Sostiene iteración continua en comunidad, UX y herramientas centrales.",
    },
    patrono: {
      name: isEnglish ? "Patron" : isPortuguese ? "Patrono" : "Patrono",
      description: isEnglish
        ? "Makes deeper work in quality, experimentation and platform foundations possible."
        : isPortuguese
        ? "Viabiliza trabalho mais profundo em qualidade, experimentação e base da plataforma."
        : "Hace posible trabajo más profundo en calidad, experimentación y base de plataforma.",
    },
    mecenas: {
      name: isEnglish ? "Mecenas" : isPortuguese ? "Mecenas" : "Mecenas",
      description: isEnglish
        ? "Pushes the long-term vision of Vorea Studio as an open maker platform."
        : isPortuguese
        ? "Empurra a visão de longo prazo da Vorea Studio como plataforma maker aberta."
        : "Empuja la visión de largo plazo de Vorea Studio como plataforma maker abierta.",
    },
  } satisfies Record<DonationTierId, { name: string; description: string }>;
}

function formatDate(dateValue: string, locale: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function Contributors() {
  const { locale } = useI18n();
  const { isLoggedIn } = useAuth();
  const tierMeta = useMemo(() => getTierMeta(locale), [locale]);
  const isEnglish = locale.toLowerCase().startsWith("en");
  const isPortuguese = locale.toLowerCase().startsWith("pt");

  const [tiers, setTiers] = useState<DonationTierRecord[]>(FALLBACK_TIERS);
  const [contributors, setContributors] = useState<PublicContributorRecord[]>([]);
  const [stats, setStats] = useState({ publicContributors: 0 });
  const [mySummary, setMySummary] = useState<DonationSummaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingTier, setSubmittingTier] = useState<DonationTierId | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [savingRecognition, setSavingRecognition] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [publicRecognition, setPublicRecognition] = useState(true);
  const [publicMessage, setPublicMessage] = useState("");

  const refresh = async () => {
    const publicData = await ContributorsApi.list();
    setTiers(publicData.tiers.length > 0 ? publicData.tiers : FALLBACK_TIERS);
    setContributors(publicData.contributors);
    setStats(publicData.stats);

    if (isLoggedIn) {
      const mine = await DonationsApi.getMine();
      setMySummary(mine.summary);
    } else {
      setMySummary(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((error: any) => {
        console.error("contributors page load error:", error);
      })
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  useEffect(() => {
    if (!mySummary) return;
    setPublicRecognition(Boolean(mySummary.publicContributor));
    setPublicMessage(mySummary.message || "");
  }, [mySummary]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const donationStatus = searchParams.get("donation");
    if (!donationStatus) return;

    const cleanPath = "/contributors";
    if (donationStatus === "cancelled") {
      sessionStorage.removeItem("vorea_donation_order");
      toast(isEnglish ? "Donation cancelled. No charge was made." : isPortuguese ? "Aporte cancelado. Nenhuma cobrança foi feita." : "Aporte cancelado. No se realizó ningún cobro.", { icon: "ℹ️" });
      window.history.replaceState(null, "", cleanPath);
      return;
    }

    if (donationStatus !== "success") {
      window.history.replaceState(null, "", cleanPath);
      return;
    }

    const stored = sessionStorage.getItem("vorea_donation_order");
    if (!stored) {
      window.history.replaceState(null, "", cleanPath);
      return;
    }

    if (!isLoggedIn) {
      toast.error(isEnglish ? "Sign in again to confirm your contribution." : isPortuguese ? "Entre novamente para confirmar seu apoio." : "Vuelve a iniciar sesión para confirmar tu aporte.");
      window.history.replaceState(null, "", cleanPath);
      return;
    }

    setCapturing(true);
    (async () => {
      try {
        const { orderId } = JSON.parse(stored) as { orderId: string };
        const result = await DonationsApi.captureOrder(orderId);
        trackAnalyticsEvent("donation_complete", {
          tierId: result.tierId,
          publicContributor: result.publicContributor,
        });
        toast.success(result.message || (isEnglish ? "Thanks for supporting Vorea Studio." : isPortuguese ? "Obrigado por apoiar a Vorea Studio." : "Gracias por apoyar a Vorea Studio."));
        sessionStorage.removeItem("vorea_donation_order");
        await refresh();
      } catch (error: any) {
        toast.error(error?.message || (isEnglish ? "Could not confirm your contribution." : isPortuguese ? "Não foi possível confirmar seu apoio." : "No se pudo confirmar tu aporte."));
      } finally {
        setCapturing(false);
        window.history.replaceState(null, "", cleanPath);
      }
    })();
  }, [isLoggedIn, isEnglish, isPortuguese]);

  const handleDonate = async (tierId: DonationTierId) => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }

    try {
      setSubmittingTier(tierId);
      trackAnalyticsEvent("donation_start", {
        tierId,
        visibility: publicRecognition ? "public" : "anonymous",
      });
      const order = await DonationsApi.createOrder({
        tierId,
        isPublic: publicRecognition,
        message: publicMessage,
      });
      sessionStorage.setItem(
        "vorea_donation_order",
        JSON.stringify({ orderId: order.orderId, tierId: order.tierId })
      );

      if (!order.approveUrl) {
        throw new Error(
          isEnglish
            ? "PayPal did not return an approval URL."
            : isPortuguese
            ? "O PayPal não devolveu uma URL de aprovação."
            : "PayPal no devolvió una URL de aprobación."
        );
      }

      window.location.assign(order.approveUrl);
    } catch (error: any) {
      toast.error(error?.message || (isEnglish ? "Could not start the contribution." : isPortuguese ? "Não foi possível iniciar o apoio." : "No se pudo iniciar el aporte."));
      setSubmittingTier(null);
    }
  };

  const handleSaveRecognition = async () => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    if (!mySummary) return;

    try {
      setSavingRecognition(true);
      const result = await DonationsApi.updateMine({
        publicContributor: publicRecognition,
        message: publicRecognition ? publicMessage : null,
      });
      setMySummary(result.summary);
      await refresh();
      toast.success(
        isEnglish
          ? "Your contributor recognition was updated."
          : isPortuguese
          ? "Seu reconhecimento de colaborador foi atualizado."
          : "Tu reconocimiento de colaborador fue actualizado."
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          (isEnglish
            ? "Could not update your contributor recognition."
            : isPortuguese
            ? "Não foi possível atualizar seu reconhecimento."
            : "No se pudo actualizar tu reconocimiento.")
      );
    } finally {
      setSavingRecognition(false);
    }
  };

  const recognitionDirty =
    Boolean(mySummary) &&
    (publicRecognition !== Boolean(mySummary?.publicContributor) ||
      publicMessage !== (mySummary?.message || ""));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-[rgba(168,187,238,0.12)] bg-[radial-gradient(circle_at_top,rgba(198,227,108,0.12),transparent_35%),linear-gradient(180deg,rgba(26,31,54,0.94),rgba(13,17,23,1))]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#C6E36C]/20 bg-[#C6E36C]/10 text-[#C6E36C] text-xs uppercase tracking-[0.22em]">
              <HeartHandshake className="w-3.5 h-3.5" />
              {isEnglish ? "Community support" : isPortuguese ? "Apoio da comunidade" : "Apoyo de comunidad"}
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">
              {isEnglish
                ? "Contributors helping Vorea grow"
                : isPortuguese
                ? "Colaboradores que ajudam a Vorea a crescer"
                : "Colaboradores que están ayudando a crecer a Vorea"}
            </h1>
            <p className="mt-5 text-lg text-gray-300 leading-8">
              {isEnglish
                ? "Support is voluntary and transparent. Public collaborators appear here only with explicit consent."
                : isPortuguese
                ? "O apoio é voluntário e transparente. Colaboradores públicos aparecem aqui apenas com consentimento explícito."
                : "El apoyo es voluntario y transparente. Los colaboradores públicos aparecen aquí solo con consentimiento explícito."}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
          {tiers.map((tier) => {
            const meta = tierMeta[tier.id];
            return (
              <div
                key={tier.id}
                className="glass rounded-3xl border border-[rgba(168,187,238,0.12)] p-6"
              >
                <div className="w-11 h-11 rounded-2xl border border-[#C6E36C]/20 bg-[#C6E36C]/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#C6E36C]" />
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold">{meta.name}</h2>
                  <Badge variant="secondary" className="font-mono text-xs">
                    USD {tier.suggestedAmountUsd}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-gray-400">{meta.description}</p>
                <Button
                  className="mt-5 w-full"
                  disabled={submittingTier === tier.id || capturing}
                  onClick={() => void handleDonate(tier.id)}
                >
                  {submittingTier === tier.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isEnglish ? "Opening PayPal" : isPortuguese ? "Abrindo PayPal" : "Abriendo PayPal"}
                    </>
                  ) : isEnglish ? (
                    `Support with USD ${tier.suggestedAmountUsd}`
                  ) : isPortuguese ? (
                    `Apoiar com USD ${tier.suggestedAmountUsd}`
                  ) : (
                    `Aportar USD ${tier.suggestedAmountUsd}`
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[1.3fr,0.7fr] gap-6">
          <div className="glass rounded-3xl border border-[rgba(168,187,238,0.12)] p-8 md:p-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl border border-blue-500/20 bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
              </div>
              <div className="w-full">
                <h2 className="text-2xl font-semibold">
                  {isEnglish
                    ? "Recognition options"
                    : isPortuguese
                    ? "Opções de reconhecimento"
                    : "Opciones de reconocimiento"}
                </h2>
                <p className="mt-3 text-sm leading-7 text-gray-300">
                  {isEnglish
                    ? "Choose whether your support should appear publicly and optionally leave a short message for the community."
                    : isPortuguese
                    ? "Escolha se o seu apoio aparece publicamente e, se quiser, deixe uma mensagem curta para a comunidade."
                    : "Elegí si tu apoyo aparece públicamente y, si querés, dejá un mensaje corto para la comunidad."}
                </p>

                <label className="mt-5 flex items-center gap-3 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={publicRecognition}
                    onChange={(event) => setPublicRecognition(event.target.checked)}
                    className="rounded border-gray-600 bg-[#0e1225]"
                  />
                  <span>
                    {isEnglish
                      ? "Show my name on the contributors page"
                      : isPortuguese
                      ? "Mostrar meu nome na página de colaboradores"
                      : "Mostrar mi nombre en la página de colaboradores"}
                  </span>
                </label>

                <textarea
                  value={publicMessage}
                  onChange={(event) => setPublicMessage(event.target.value.slice(0, 240))}
                  placeholder={
                    isEnglish
                      ? "Optional public message"
                      : isPortuguese
                      ? "Mensagem pública opcional"
                      : "Mensaje público opcional"
                  }
                  className="mt-4 w-full min-h-[110px] rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[#0e1225]/70 px-4 py-3 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C6E36C]/30"
                />
                <p className="mt-2 text-xs text-gray-500">
                  {publicMessage.length}/240
                </p>

                {mySummary ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      {isEnglish
                        ? "This updates your current public recognition without creating a new donation."
                        : isPortuguese
                        ? "Isto atualiza o seu reconhecimento público atual sem criar uma nova doação."
                        : "Esto actualiza tu reconocimiento público actual sin crear una nueva donación."}
                    </p>
                    <Button
                      type="button"
                      disabled={!recognitionDirty || savingRecognition || capturing}
                      onClick={() => void handleSaveRecognition()}
                    >
                      {savingRecognition ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {isEnglish ? "Saving" : isPortuguese ? "Salvando" : "Guardando"}
                        </>
                      ) : isEnglish ? (
                        "Update recognition"
                      ) : isPortuguese ? (
                        "Atualizar reconhecimento"
                      ) : (
                        "Actualizar reconocimiento"
                      )}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl border border-[rgba(168,187,238,0.12)] p-8">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[#C6E36C]" />
              <h2 className="text-xl font-semibold">
                {isEnglish ? "Current status" : isPortuguese ? "Estado atual" : "Estado actual"}
              </h2>
            </div>

            {loading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEnglish ? "Loading contributor data..." : isPortuguese ? "Carregando dados..." : "Cargando datos..."}
              </div>
            ) : mySummary ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[#0e1225]/60 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                    {isEnglish ? "Your contributor tier" : isPortuguese ? "Seu nível de colaborador" : "Tu nivel de colaborador"}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {tierMeta[mySummary.tierId]?.name || mySummary.tierId}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    {isEnglish
                      ? `${mySummary.donationCount} verified contribution(s)`
                      : isPortuguese
                      ? `${mySummary.donationCount} contribuição(ões) verificadas`
                      : `${mySummary.donationCount} aporte(s) verificado(s)`}
                  </p>
                </div>
                <div className="text-sm text-gray-400 leading-7">
                  {isEnglish
                    ? `Your cumulative support totals USD ${mySummary.totalDonatedUsd.toFixed(2)}.`
                    : isPortuguese
                    ? `Seu apoio acumulado soma USD ${mySummary.totalDonatedUsd.toFixed(2)}.`
                    : `Tu apoyo acumulado suma USD ${mySummary.totalDonatedUsd.toFixed(2)}.`}
                </div>
              </div>
            ) : (
              <div className="mt-6 text-sm leading-7 text-gray-400">
                {isEnglish
                  ? "You can support the project anonymously or publicly. Once a contribution is verified, your tier will appear here."
                  : isPortuguese
                  ? "Você pode apoiar o projeto de forma anônima ou pública. Quando um aporte for verificado, seu nível aparecerá aqui."
                  : "Podés apoyar el proyecto de forma anónima o pública. Cuando un aporte quede verificado, tu nivel aparecerá acá."}
              </div>
            )}
          </div>
        </div>

        <div className="glass rounded-3xl border border-[rgba(168,187,238,0.12)] p-8 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-[#C6E36C]" />
                <h2 className="text-2xl font-semibold">
                  {isEnglish ? "Public contributors" : isPortuguese ? "Colaboradores públicos" : "Colaboradores públicos"}
                </h2>
              </div>
              <p className="mt-3 text-sm text-gray-400">
                {isEnglish
                  ? `${stats.publicContributors} public supporter(s) currently visible.`
                  : isPortuguese
                  ? `${stats.publicContributors} apoiador(es) públicos visíveis no momento.`
                  : `${stats.publicContributors} colaborador(es) públicos visibles en este momento.`}
              </p>
            </div>
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
              {capturing
                ? isEnglish
                  ? "Confirming contribution..."
                  : isPortuguese
                  ? "Confirmando apoio..."
                  : "Confirmando aporte..."
                : isEnglish
                ? "Voluntary support"
                : isPortuguese
                ? "Apoio voluntário"
                : "Apoyo voluntario"}
            </div>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              {isEnglish ? "Loading public wall..." : isPortuguese ? "Carregando mural público..." : "Cargando mural público..."}
            </div>
          ) : contributors.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[rgba(168,187,238,0.14)] p-8 text-sm leading-7 text-gray-400">
              {isEnglish
                ? "No public contributors are visible yet. The first verified supporter who opts in will open this wall."
                : isPortuguese
                ? "Ainda não há colaboradores públicos visíveis. O primeiro apoiador verificado que optar por aparecer inaugura este mural."
                : "Todavía no hay colaboradores públicos visibles. El primer colaborador verificado que decida aparecer inaugura este mural."}
            </div>
          ) : (
            <div className="mt-8 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {contributors.map((contributor) => {
                const meta = tierMeta[contributor.tierId];
                return (
                  <div
                    key={`${contributor.userId}-${contributor.lastDonatedAt}`}
                    className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[#0e1225]/60 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{contributor.displayName}</p>
                        <p className="text-sm text-gray-500">{contributor.username}</p>
                      </div>
                      <Badge className="bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/20">
                        {meta?.name || contributor.tierId}
                      </Badge>
                    </div>
                    {contributor.message ? (
                      <p className="mt-4 text-sm leading-7 text-gray-300">
                        “{contributor.message}”
                      </p>
                    ) : (
                      <p className="mt-4 text-sm leading-7 text-gray-500">
                        {isEnglish
                          ? "Public recognition enabled without message."
                          : isPortuguese
                          ? "Reconhecimento público ativado sem mensagem."
                          : "Reconocimiento público activado sin mensaje."}
                      </p>
                    )}
                    <p className="mt-4 text-xs uppercase tracking-[0.16em] text-gray-600">
                      {isEnglish
                        ? `Visible since ${formatDate(contributor.joinedAt, locale)}`
                        : isPortuguese
                        ? `Visível desde ${formatDate(contributor.joinedAt, locale)}`
                        : `Visible desde ${formatDate(contributor.joinedAt, locale)}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass rounded-3xl border border-[rgba(168,187,238,0.12)] p-8 md:p-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl border border-blue-500/20 bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">
                {isEnglish ? "Why this exists" : isPortuguese ? "Por que isso existe" : "Por qué existe esto"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                {isEnglish
                  ? "This support line exists to help fund improvements, infrastructure and experimentation. It does not replace subscriptions and it does not unlock hidden functionality."
                  : isPortuguese
                  ? "Esta linha de apoio existe para financiar melhorias, infraestrutura e experimentação. Ela não substitui assinaturas nem libera funcionalidades ocultas."
                  : "Esta vía de apoyo existe para financiar mejoras, infraestructura y experimentación. No reemplaza suscripciones ni desbloquea funcionalidades ocultas."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/contact">
                    {isEnglish ? "Talk to the team" : isPortuguese ? "Falar com a equipe" : "Hablar con el equipo"}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/plans">
                    {isEnglish ? "See plans and credits" : isPortuguese ? "Ver planos e créditos" : "Ver planes y créditos"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl border border-[rgba(168,187,238,0.12)] p-8 md:p-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl border border-amber-500/20 bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-amber-300" />
            </div>
            <div className="w-full">
              <h2 className="text-2xl font-semibold">
                {isEnglish
                  ? "Program terms and support"
                  : isPortuguese
                  ? "Condições do programa e suporte"
                  : "Condiciones del programa y soporte"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                {isEnglish
                  ? "We want this support program to stay simple and honest. Contributions are voluntary, visible only with consent, and handled with the same transparency as the rest of the product."
                  : isPortuguese
                  ? "Queremos que este programa de apoio seja simples e honesto. As contribuições são voluntárias, visíveis apenas com consentimento e tratadas com a mesma transparência do resto do produto."
                  : "Queremos que este programa de apoyo sea simple y honesto. Los aportes son voluntarios, visibles solo con consentimiento y tratados con la misma transparencia que el resto del producto."}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[#0e1225]/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">
                    {isEnglish ? "Voluntary support" : isPortuguese ? "Apoio voluntário" : "Apoyo voluntario"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-gray-300">
                    {isEnglish
                      ? "A donation does not replace subscriptions, does not unlock hidden features and does not change plan limits."
                      : isPortuguese
                      ? "Uma doação não substitui assinaturas, não libera funções ocultas e não altera limites de plano."
                      : "Una donación no reemplaza suscripciones, no desbloquea funciones ocultas ni cambia límites del plan."}
                  </p>
                </div>

                <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[#0e1225]/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">
                    {isEnglish ? "Visibility and privacy" : isPortuguese ? "Visibilidade e privacidade" : "Visibilidad y privacidad"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-gray-300">
                    {isEnglish
                      ? "You can support anonymously or publicly, and if you already contributed you can update your wall visibility and message later."
                      : isPortuguese
                      ? "Você pode apoiar de forma anônima ou pública, e se já contribuiu pode atualizar depois sua visibilidade e mensagem no mural."
                      : "Podés apoyar de forma anónima o pública, y si ya contribuiste podés actualizar después tu visibilidad y mensaje en el mural."}
                  </p>
                </div>

                <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[#0e1225]/60 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-gray-500">
                    {isEnglish ? "Support and charge review" : isPortuguese ? "Suporte e revisão de cobranças" : "Soporte y revisión de cobros"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-gray-300">
                    {isEnglish
                      ? "Cancelled PayPal flows are not charged. If you see a duplicate or incorrect charge, contact us with the order ID and we will review it case by case."
                      : isPortuguese
                      ? "Fluxos cancelados no PayPal não são cobrados. Se você vir uma cobrança duplicada ou incorreta, fale conosco com o order ID para revisão caso a caso."
                      : "Los flujos cancelados en PayPal no se cobran. Si ves un cargo duplicado o incorrecto, escribinos con el order ID para revisarlo caso a caso."}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-dashed border-[rgba(168,187,238,0.16)] px-4 py-4 text-sm text-gray-300 leading-7">
                {isEnglish ? (
                  <>
                    We do not promise roadmap features in exchange for support. This program exists to sustain improvements, infrastructure and experimentation. For help, billing review or program questions, use the contact page and include your PayPal order ID if available.
                  </>
                ) : isPortuguese ? (
                  <>
                    Não prometemos funcionalidades futuras em troca do apoio. Este programa existe para sustentar melhorias, infraestrutura e experimentação. Para ajuda, revisão de cobrança ou dúvidas do programa, use a página de contato e inclua o order ID do PayPal se possível.
                  </>
                ) : (
                  <>
                    No prometemos funcionalidades futuras a cambio del apoyo. Este programa existe para sostener mejoras, infraestructura y experimentación. Para ayuda, revisión de cobros o dudas del programa, usá la página de contacto e incluí el order ID de PayPal si lo tenés.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab="register" />
    </div>
  );
}
