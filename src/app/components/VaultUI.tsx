import { useState, useEffect } from "react";
import { useAuth } from "../services/auth-context";
import { VaultApi, type VaultKeyEntry } from "../services/api-client";
import { useUserProfile } from "../services/hooks";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Activity,
  Lock,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { useNavigate } from "../nav";

export function VaultUI() {
  const { isLoggedIn } = useAuth();
  const { user } = useUserProfile();
  const navigate = useNavigate();

  const [keys, setKeys] = useState<VaultKeyEntry[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  const [adding, setAdding] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isLoggedIn) return;
    loadVault();
  }, [isLoggedIn]);

  const loadVault = async () => {
    setLoading(true);
    try {
      const data = await VaultApi.listKeys();
      if (!data) {
        setUpgradeRequired(true);
      } else {
        setKeys(data.keys || []);
        setProviders(data.supportedProviders || []);
        // default selected to first available if not all used
        const used = new Set((data.keys || []).map(k => k.provider));
        const avail = (data.supportedProviders || []).find(p => !used.has(p));
        if (avail) setSelectedProvider(avail);
      }
    } catch (e: any) {
      toast.error("Error al cargar Bóveda de Keys");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider || newKey.length < 8) return;

    setSaving(true);
    try {
      await VaultApi.saveKey(selectedProvider, newKey, newLabel || selectedProvider);
      toast.success(`Key para ${selectedProvider} guardada de forma segura`);
      setAdding(false);
      setNewKey("");
      setNewLabel("");
      loadVault();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar Key");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: string) => {
    if (!confirm(`¿Eliminar la key de ${provider}?`)) return;
    try {
      await VaultApi.deleteKey(provider);
      toast.success(`Key de ${provider} eliminada`);
      setKeys(keys.filter(k => k.provider !== provider));
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar");
    }
  };

  const handleTest = async (provider: string) => {
    setTestingMap(prev => ({ ...prev, [provider]: true }));
    try {
      const res = await VaultApi.testKey(provider);
      if (res.valid) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      loadVault(); // refreshes lastUsedAt
    } catch (e: any) {
      toast.error(e.message || "Error de conexión");
    } finally {
      setTestingMap(prev => ({ ...prev, [provider]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  // Tier Gating UI
  if (upgradeRequired) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center glass rounded-2xl border border-[rgba(168,187,238,0.12)] max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1a1f36] to-[#0d1117] flex items-center justify-center border border-[rgba(168,187,238,0.1)] mb-4 shadow-lg shadow-[#C6E36C]/5">
          <Lock className="w-7 h-7 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold mb-2 text-white">Bóveda de API Keys (BYOK)</h3>
        <p className="text-gray-400 max-w-md mx-auto mb-6">
          Integra tus propias API keys de Tripo AI, Meshy AI, Gemini y más para generar modelos ilimitados sin consumir créditos de Vorea.
        </p>
        <div className="flex flex-col items-center gap-2">
          <Badge className="bg-[#C6E36C]/20 text-[#C6E36C] border-[#C6E36C]/30 mb-2">Exclusivo PRO & STUDIO PRO</Badge>
          <Button onClick={() => navigate("/planes")} className="gap-2">
            Obtener Plan PRO
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Key className="w-5 h-5 text-[#C6E36C]" />
            Bóveda BYOK (Bring Your Own Key)
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Tus keys se encriptan (AES-256-GCM) y nunca se exponen al cliente.
          </p>
        </div>
        {!adding && providers.length > keys.length && (
          <Button onClick={() => setAdding(true)} size="sm" className="gap-1">
            <Plus className="w-4 h-4" /> Agregar Key
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleSave} className="glass p-5 rounded-xl border border-[#C6E36C]/30 mb-6 bg-[rgba(198,227,108,0.02)]">
          <h3 className="font-semibold mb-4">Nueva API Key</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Proveedor IA</label>
              <select
                className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                required
              >
                <option value="" disabled>Selecciona un proveedor...</option>
                {providers.filter(p => !keys.find(k => k.provider === p)).map(p => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Etiqueta (opcional)</label>
              <input
                type="text"
                placeholder="Ej. Mi Workspace de Tripo"
                className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">API Key (secreta)</label>
              <input
                type="password"
                placeholder="sk-..."
                required
                minLength={8}
                className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar Key Segura"}
            </Button>
          </div>
        </form>
      )}

      {keys.length === 0 && !adding ? (
        <div className="py-12 flex flex-col items-center justify-center text-center glass rounded-2xl border border-[rgba(168,187,238,0.12)]">
          <Key className="w-10 h-10 text-gray-600 mb-3" />
          <p className="text-gray-400">No tienes ninguna API Key configurada.</p>
          <Button variant="secondary" className="mt-4" onClick={() => setAdding(true)}>Configurar mi primera Key</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {keys.map((k) => (
            <div key={k.provider} className="glass border border-[rgba(168,187,238,0.12)] rounded-xl p-5 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.1)] flex items-center justify-center">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white leading-tight">{k.label || k.provider}</h4>
                    <span className="text-xs text-gray-500 uppercase">{k.provider}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                    title="Testear Conexión"
                    onClick={() => handleTest(k.provider)}
                    disabled={testingMap[k.provider]}
                  >
                    {testingMap[k.provider] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                    title="Eliminar"
                    onClick={() => handleDelete(k.provider)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-[#121620] rounded border border-[rgba(168,187,238,0.05)] px-3 py-2 flex items-center justify-between mt-auto">
                <code className="text-sm font-mono text-gray-300 tracking-widest">{k.maskedKey}</code>
                <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400 bg-green-500/10">Active</Badge>
              </div>

              {k.lastUsedAt && (
                <p className="text-[10px] text-gray-500 mt-3 text-right">
                  Último uso: {new Date(k.lastUsedAt).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
