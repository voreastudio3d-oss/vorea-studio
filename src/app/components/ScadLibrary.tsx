/**
 * ScadLibrary – Browse and use extracted MakerWorld SCAD models.
 * Reads catalog from /scad-library/catalog.json at runtime.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useNavigate } from "../nav";
import {
  Search,
  Star,
  Download,
  Heart,
  Code2,
  ArrowRight,
  Loader2,
  Package,
  Filter,
  SortAsc,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

interface CatalogModel {
  id: string;
  title: string;
  author: string;
  category: string;
  cover: string;
  popularity: number;
  popularityStars: string;
  hasScad: boolean;
  scadFile: string | null;
  downloads: number;
  likes: number;
  paramCount?: number;
  compatibility?: 'full' | 'partial' | 'limited';
  unsupportedFeatures?: string[];
}

type SortMode = "popular" | "downloads" | "likes" | "name";

export function ScadLibrary() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("popular");
  const [filterScad, setFilterScad] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Load catalog
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/scad-library/catalog.json");
        if (res.ok) {
          const data = await res.json();
          setCatalog(data);
        }
      } catch (e) {
        console.error("Failed to load SCAD catalog:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filter and sort
  const filtered = useMemo(() => {
    let items = [...catalog];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.author.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    if (filterScad) items = items.filter((m) => m.hasScad);
    switch (sort) {
      case "popular":
        items.sort((a, b) => b.popularity - a.popularity || b.downloads - a.downloads);
        break;
      case "downloads":
        items.sort((a, b) => b.downloads - a.downloads);
        break;
      case "likes":
        items.sort((a, b) => b.likes - a.likes);
        break;
      case "name":
        items.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return items;
  }, [catalog, search, sort, filterScad]);

  const scadCount = catalog.filter((m) => m.hasScad).length;

  // Use model in editor
  const handleUseModel = useCallback(
    async (model: CatalogModel) => {
      if (!model.hasScad || !model.scadFile) {
        toast.error("Este modelo no tiene código SCAD disponible");
        return;
      }
      setLoadingId(model.id);
      try {
        const res = await fetch(`/scad-library/models/${model.scadFile}`);
        if (!res.ok) throw new Error("fetch failed");
        const scadCode = await res.text();

        // Store in sessionStorage for the editor to pick up
        sessionStorage.setItem(
          "vorea_import_scad",
          JSON.stringify({
            name: model.title,
            code: scadCode,
            source: "makerworld",
            sourceId: model.id,
          })
        );

        toast.success(`"${model.title}" cargado — abriendo editor...`);
        setTimeout(() => navigate("/studio?mode=parametric"), 400);
      } catch (e) {
        toast.error("Error al cargar el modelo");
      } finally {
        setLoadingId(null);
      }
    },
    [navigate]
  );

  // Format large numbers
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#C6E36C]" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Package className="w-5 h-5 text-[#C6E36C]" />
            <h2 className="text-xl font-bold">Biblioteca SCAD</h2>
            <Badge className="bg-[#C6E36C]/15 text-[#C6E36C] border-[#C6E36C]/30 text-[10px]">
              {catalog.length} modelos
            </Badge>
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">
              {scadCount} con código
            </Badge>
          </div>
          <p className="text-xs text-gray-500">
            Modelos paramétricos de MakerWorld — listos para personalizar en el editor
          </p>
        </div>

        {/* Search + filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar modelos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.4)] text-white placeholder-gray-600 outline-none focus:border-[#C6E36C]/40 transition-colors w-48"
            />
          </div>
          <button
            onClick={() => setFilterScad(!filterScad)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] rounded-lg border transition-all ${
              filterScad
                ? "bg-[#C6E36C]/15 border-[#C6E36C]/40 text-[#C6E36C]"
                : "border-[rgba(168,187,238,0.12)] text-gray-500 hover:border-gray-600"
            }`}
          >
            <Code2 className="w-3 h-3" />
            Solo con SCAD
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="px-2.5 py-1.5 text-[10px] rounded-lg border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.4)] text-gray-400 outline-none"
          >
            <option value="popular">★ Popularidad</option>
            <option value="downloads">↓ Descargas</option>
            <option value="likes">♥ Likes</option>
            <option value="name">A-Z Nombre</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[rgba(26,31,54,0.3)] p-12 text-center">
          <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No se encontraron modelos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((model, i) => (
            <Card
              key={model.id}
              className="group bg-[rgba(26,31,54,0.4)] border-[rgba(168,187,238,0.08)] hover:border-[#C6E36C]/30 transition-all duration-200 overflow-hidden"
              style={{
                animation: `vsCardIn 0.35s cubic-bezier(.22,1,.36,1) ${Math.min(i, 8) * 0.04}s both`,
              }}
            >
              {/* Cover image */}
              <div className="relative aspect-[4/3] overflow-hidden bg-[#0d1117]">
                {model.cover ? (
                  <img
                    src={model.cover}
                    alt={model.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-10 h-10 text-gray-800" />
                  </div>
                )}

                {/* Popularity badge */}
                <div className="absolute top-2 left-2">
                  <Badge
                    className={`text-[9px] backdrop-blur-md ${
                      model.popularity >= 4
                        ? "bg-amber-500/30 text-amber-300 border-amber-500/40"
                        : model.popularity >= 2
                        ? "bg-gray-600/40 text-gray-300 border-gray-500/30"
                        : "bg-gray-700/40 text-gray-400 border-gray-600/30"
                    }`}
                  >
                    {model.popularityStars}
                  </Badge>
                </div>

                {/* SCAD + compatibility badge */}
                {model.hasScad && (
                  <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                    <Badge className="bg-green-500/30 text-green-300 border-green-500/40 text-[9px] backdrop-blur-md gap-1">
                      <Code2 className="w-2.5 h-2.5" />
                      SCAD
                    </Badge>
                    {model.compatibility && model.compatibility !== 'full' && (
                      <Badge
                        className={`text-[8px] backdrop-blur-md gap-0.5 cursor-help ${
                          model.compatibility === 'partial'
                            ? 'bg-amber-500/25 text-amber-300 border-amber-500/35'
                            : 'bg-red-500/25 text-red-300 border-red-500/35'
                        }`}
                        title={`Features no soportadas: ${model.unsupportedFeatures?.join(', ') || 'N/A'}`}
                      >
                        <AlertTriangle className="w-2 h-2" />
                        {model.compatibility === 'partial' ? 'Parcial' : 'Limitado'}
                      </Badge>
                    )}
                    {model.compatibility === 'full' && (
                      <Badge className="text-[8px] backdrop-blur-md gap-0.5 bg-green-500/20 text-green-300 border-green-500/30">
                        <CheckCircle2 className="w-2 h-2" />
                        Compatible
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <CardContent className="p-3">
                {/* Title */}
                <h3 className="text-xs font-semibold text-white mb-1.5 line-clamp-2 leading-tight min-h-[2rem]">
                  {model.title}
                </h3>

                {/* Author + params */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-gray-500">{model.author}</p>
                  {model.paramCount != null && model.paramCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-gray-600">
                      <Settings2 className="w-2.5 h-2.5" />
                      {model.paramCount} params
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {fmt(model.downloads)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {fmt(model.likes)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5">
                  {model.hasScad ? (
                    <Button
                      size="sm"
                      onClick={() => handleUseModel(model)}
                      disabled={loadingId === model.id}
                      className="flex-1 text-[10px] h-7 gap-1 bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/30 hover:bg-[#C6E36C]/25"
                    >
                      {loadingId === model.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Usar en Editor
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled
                      className="flex-1 text-[10px] h-7 opacity-50"
                    >
                      Código protegido
                    </Button>
                  )}
                  <a
                    href={`https://makerworld.com/es/models/${model.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-7 h-7 rounded-md border border-[rgba(168,187,238,0.12)] hover:border-gray-500 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 text-gray-500" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
