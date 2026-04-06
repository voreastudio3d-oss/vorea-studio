import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DollarSign,
  Eye,
  EyeOff,
  HeartHandshake,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminApi,
  type AdminContributorRecord,
  type AdminDonationRecord,
  type AdminDonationStats,
} from "../services/api-client";

type DonationStatusFilter = "all" | "completed" | "created" | "capturing" | "failed";

type ContributorDraft = {
  publicContributor: boolean;
  message: string;
};

const DEFAULT_STATS: AdminDonationStats = {
  totalOrders: 0,
  completedOrders: 0,
  failedOrders: 0,
  publicContributors: 0,
  uniqueContributors: 0,
  totalCapturedUsd: 0,
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completada",
  CREATED: "Creada",
  CAPTURING: "Capturando",
  FAILED: "Fallida",
};

function formatUsd(amount: number | null) {
  if (!Number.isFinite(amount ?? NaN)) return "—";
  return `USD ${(amount || 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildDrafts(contributors: AdminContributorRecord[]) {
  return contributors.reduce<Record<string, ContributorDraft>>((acc, contributor) => {
    acc[contributor.userId] = {
      publicContributor: Boolean(contributor.publicContributor),
      message: contributor.message || "",
    };
    return acc;
  }, {});
}

export function DonationsAdminTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [status, setStatus] = useState<DonationStatusFilter>("all");
  const [donations, setDonations] = useState<AdminDonationRecord[]>([]);
  const [contributors, setContributors] = useState<AdminContributorRecord[]>([]);
  const [stats, setStats] = useState<AdminDonationStats>(DEFAULT_STATS);
  const [drafts, setDrafts] = useState<Record<string, ContributorDraft>>({});

  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await AdminApi.listDonations({
        q: query || undefined,
        status,
        limit: 60,
      });
      setDonations(result.donations);
      setContributors(result.contributors);
      setStats(result.stats);
      setDrafts(buildDrafts(result.contributors));
    } catch (error: any) {
      toast.error(error?.message || "Error al cargar donaciones");
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [query, status]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const contributorsByUserId = useMemo(
    () => new Map(contributors.map((contributor) => [contributor.userId, contributor] as const)),
    [contributors]
  );

  const handleSearchSubmit = () => {
    setQuery(searchValue.trim());
  };

  const handleDraftChange = (userId: string, patch: Partial<ContributorDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: {
        publicContributor: prev[userId]?.publicContributor ?? false,
        message: prev[userId]?.message ?? "",
        ...patch,
      },
    }));
  };

  const handleSaveContributor = async (userId: string) => {
    const draft = drafts[userId];
    if (!draft) return;
    setSavingUserId(userId);
    try {
      await AdminApi.updateContributorVisibility(userId, {
        publicContributor: draft.publicContributor,
        message: draft.publicContributor ? draft.message : null,
      });
      toast.success("Visibilidad de colaborador actualizada");
      await fetchData({ silent: true });
    } catch (error: any) {
      toast.error(error?.message || "No se pudo actualizar el colaborador");
    } finally {
      setSavingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#C6E36C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <SummaryCard icon={<HeartHandshake className="w-4 h-4 text-[#C6E36C]" />} label="Órdenes" value={String(stats.totalOrders)} />
        <SummaryCard icon={<ShieldCheck className="w-4 h-4 text-blue-400" />} label="Completadas" value={String(stats.completedOrders)} />
        <SummaryCard icon={<Eye className="w-4 h-4 text-purple-400" />} label="Colaboradores públicos" value={String(stats.publicContributors)} />
        <SummaryCard icon={<UserRound className="w-4 h-4 text-amber-400" />} label="Colaboradores únicos" value={String(stats.uniqueContributors)} />
        <SummaryCard icon={<DollarSign className="w-4 h-4 text-green-400" />} label="Capturado" value={formatUsd(stats.totalCapturedUsd)} />
      </div>

      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearchSubmit();
                  }
                }}
                placeholder="Buscar por usuario, orden o donationId"
                className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C6E36C]/30"
              />
            </div>
            <button
              onClick={handleSearchSubmit}
              className="px-3 py-2 rounded-lg border border-[rgba(168,187,238,0.12)] text-xs text-gray-300 hover:border-[#C6E36C]/30 hover:text-white transition-colors"
            >
              Aplicar
            </button>
          </div>

          <div className="flex gap-2">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as DonationStatusFilter)}
              className="bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-xs text-gray-300"
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completadas</option>
              <option value="created">Creadas</option>
              <option value="capturing">Capturando</option>
              <option value="failed">Fallidas</option>
            </select>
            <button
              onClick={() => void fetchData({ silent: true })}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgba(168,187,238,0.12)] text-xs text-gray-300 hover:border-[#C6E36C]/30 hover:text-white transition-colors disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refrescar
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1.05fr,0.95fr] gap-6">
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#C6E36C]" />
            <h3 className="text-sm font-semibold text-gray-300">Moderación de colaboradores</h3>
          </div>

          {contributors.length === 0 ? (
            <p className="text-sm text-gray-500">Todavía no hay colaboradores verificados para moderar.</p>
          ) : (
            <div className="space-y-3">
              {contributors.map((contributor) => {
                const draft = drafts[contributor.userId] || {
                  publicContributor: Boolean(contributor.publicContributor),
                  message: contributor.message || "",
                };
                const hasChanges =
                  draft.publicContributor !== Boolean(contributor.publicContributor) ||
                  draft.message !== (contributor.message || "");

                return (
                  <div
                    key={contributor.userId}
                    className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1117]/80 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{contributor.displayName}</p>
                        <p className="text-xs text-gray-500">{contributor.username}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                          {contributor.tierId}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatUsd(contributor.totalDonatedUsd)} · {contributor.donationCount} aporte(s)
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={draft.publicContributor}
                        onChange={(event) =>
                          handleDraftChange(contributor.userId, {
                            publicContributor: event.target.checked,
                            message: event.target.checked ? draft.message : "",
                          })
                        }
                        className="accent-[#C6E36C]"
                      />
                      Mostrar en `/colaboradores`
                    </label>

                    <textarea
                      value={draft.message}
                      onChange={(event) =>
                        handleDraftChange(contributor.userId, {
                          message: event.target.value.slice(0, 240),
                        })
                      }
                      disabled={!draft.publicContributor}
                      placeholder="Mensaje público opcional"
                      className="w-full min-h-[86px] rounded-xl border border-[rgba(168,187,238,0.12)] bg-[#0b0f1d] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-[#C6E36C]/30"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-gray-500">
                        Último aporte: {formatDate(contributor.lastDonatedAt)}
                      </div>
                      <button
                        onClick={() => void handleSaveContributor(contributor.userId)}
                        disabled={!hasChanges || savingUserId === contributor.userId}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/20 text-xs hover:bg-[#C6E36C]/20 transition-colors disabled:opacity-50"
                      >
                        {savingUserId === contributor.userId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : draft.publicContributor ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                        Guardar visibilidad
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-[#C6E36C]" />
            <h3 className="text-sm font-semibold text-gray-300">Órdenes y capturas recientes</h3>
          </div>

          {donations.length === 0 ? (
            <p className="text-sm text-gray-500">No hay órdenes de aporte para los filtros actuales.</p>
          ) : (
            <div className="space-y-3">
              {donations.map((donation) => {
                const contributor = contributorsByUserId.get(donation.userId);
                return (
                  <div
                    key={donation.orderId}
                    className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1117]/80 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{donation.displayName}</p>
                        <p className="text-[11px] text-gray-500">{donation.username} · {donation.orderId}</p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full border ${
                        donation.status === "COMPLETED"
                          ? "border-green-500/20 text-green-400 bg-green-500/10"
                          : donation.status === "FAILED"
                          ? "border-red-500/20 text-red-400 bg-red-500/10"
                          : "border-amber-500/20 text-amber-300 bg-amber-500/10"
                      }`}>
                        {STATUS_LABELS[donation.status] || donation.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <InfoLine label="Importe" value={formatUsd(donation.amountUsd)} />
                      <InfoLine label="Moneda" value={donation.currency} />
                      <InfoLine label="Tier pedido" value={donation.tierId} />
                      <InfoLine label="Tier otorgado" value={donation.awardedTierId} />
                      <InfoLine label="Visibilidad original" value={donation.visibility === "public" ? "Pública" : "Anónima"} />
                      <InfoLine label="Visible actualmente" value={donation.publicContributor ? "Sí" : "No"} />
                      <InfoLine label="Creada" value={formatDate(donation.createdAt)} />
                      <InfoLine label="Completada" value={formatDate(donation.completedAt)} />
                    </div>

                    {contributor?.message ? (
                      <p className="mt-3 text-xs text-gray-300 leading-6">
                        Mensaje actual: “{contributor.message}”
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard(props: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4 text-center">
      <div className="flex justify-center mb-2">{props.icon}</div>
      <p className="text-lg font-bold text-white">{props.value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-[0.16em] mt-1">{props.label}</p>
    </div>
  );
}

function InfoLine(props: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-gray-600">{props.label}</p>
      <p className="text-gray-300 mt-1">{props.value}</p>
    </div>
  );
}
