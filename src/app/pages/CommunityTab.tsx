import { useState, useEffect, useCallback } from "react";
import { AdminApi, CommunityApi } from "../services/api-client";
import type { CommunityModelResponse } from "../services/api-client";
import { Search, RefreshCw, Box, Globe, Loader2, Star, Trash2, ExternalLink, Image as ImageIcon, Check, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function CommunityTab() {
  const [models, setModels] = useState<CommunityModelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedModel, setSelectedModel] = useState<CommunityModelResponse | null>(null);

  // Moderation Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState("published");
  const [isSaving, setIsSaving] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await AdminApi.listCommunityModels({ 
        q: search, 
        status: statusFilter === "all" ? undefined : (statusFilter as any),
        limit: 100 
      });
      setModels(data.models || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const toggleFeatured = async (model: CommunityModelResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await CommunityApi.toggleFeatured(model.id);
      toast.success(model.featured ? "Modelo des-destacado" : "Modelo destacado");
      fetchModels();
      if (selectedModel?.id === model.id) {
        setSelectedModel(prev => prev ? { ...prev, featured: !prev.featured } : null);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteModel = async (model: CommunityModelResponse) => {
    if (!confirm(`¿Eliminar definitivamente el modelo "${model.title}"?`)) return;
    try {
      await CommunityApi.deleteModel(model.id);
      toast.success("Modelo eliminado");
      setSelectedModel(null);
      fetchModels();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openModeration = (model: CommunityModelResponse) => {
    setSelectedModel(model);
    setEditTitle(model.title);
    setEditStatus(model.status);
    setIsEditing(false);
  };

  const handleSaveChanges = async () => {
    if (!selectedModel) return;
    if (!editTitle.trim()) {
      toast.error("El título no puede estar vacío");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await CommunityApi.updateModel(selectedModel.id, {
        title: editTitle,
        status: editStatus
      });
      toast.success("Modelo actualizado correctamente");
      setSelectedModel(updated);
      setIsEditing(false);
      fetchModels();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar modelos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchModels()}
            className="w-full pl-9 pr-4 py-2 bg-[#131829] border border-[rgba(168,187,238,0.12)] rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C6E36C]/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto bg-[#131829] border border-[rgba(168,187,238,0.12)] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[#C6E36C]/30"
        >
          <option value="all">Todos los estados</option>
          <option value="published">Publicados</option>
          <option value="draft">Borradores</option>
          <option value="archived">Archivados</option>
        </select>
        <button onClick={fetchModels} className="p-2 shrink-0 rounded-lg bg-[#131829] border border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#C6E36C]" /></div>
      ) : models.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No se encontraron modelos.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {models.map(m => (
            <div
              key={m.id}
              onClick={() => openModeration(m)}
              className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl overflow-hidden cursor-pointer hover:border-[#C6E36C]/30 transition-all group"
            >
              <div className="aspect-video bg-[#0d1117] relative">
                {m.thumbnailUrl ? (
                  <img src={m.thumbnailUrl} alt={m.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-700">
                    <Box className="w-8 h-8 opacity-20" />
                  </div>
                )}
                {m.featured && (
                  <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-500 p-1 rounded-full backdrop-blur-sm border border-yellow-500/30">
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </div>
                )}
                {m.media && m.media.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> {m.media.length}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-200 line-clamp-1" title={m.title}>{m.title}</h4>
                  <button onClick={(e) => toggleFeatured(m, e)} className="shrink-0 text-gray-500 hover:text-yellow-400 transition-colors">
                    <Star className={`w-4 h-4 ${m.featured ? "fill-yellow-500 text-yellow-500" : ""}`} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Por {m.authorUsername || "Anónimo"} · {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: es })}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${m.modelType === "relief" ? "text-purple-400 border-purple-500/20 bg-purple-500/10" : "text-[#C6E36C] border-[#C6E36C]/20 bg-[#C6E36C]/10"}`}>
                    {m.modelType?.toUpperCase() || "UNKNOWN"}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${m.status === "published" ? "text-green-400 border-green-500/20 bg-green-500/10" : "text-gray-400 border-gray-500/20 bg-gray-500/10"}`}>
                    {m.status?.toUpperCase() || "UNKNOWN"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-over Preview Panel (Moderation UI) */}
      {selectedModel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedModel(null)} />
          <div className="relative w-full max-w-md bg-[#0d1117] border-l border-[rgba(168,187,238,0.12)] h-full flex flex-col shadow-2xl overflow-y-auto hide-scrollbar">
            
            <div className="p-4 border-b border-[rgba(168,187,238,0.08)] flex justify-between items-center sticky top-0 bg-[#0d1117]/90 backdrop-blur-md z-10">
              <h3 className="font-bold text-gray-200 flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#C6E36C]" />
                Moderación de Modelo
              </h3>
              <button onClick={() => setSelectedModel(null)} className="text-gray-500 hover:text-white p-1 rounded-md hover:bg-white/5">
                ✕
              </button>
            </div>

            <div className="flex-1 flex flex-col">
               {/* MEDIA VIEWER */}
               <div className="bg-[#131829] w-full border-b border-[rgba(168,187,238,0.08)] relative">
                 {selectedModel.media && selectedModel.media.length > 0 ? (
                   <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
                     {selectedModel.media.map((m, idx) => (
                       <div key={m.id || idx} className="w-full shrink-0 snap-center aspect-video flex items-center justify-center bg-[#0d1117]">
                         <img src={m.url} className="max-w-full max-h-full object-contain" alt={`media-${idx}`} />
                       </div>
                     ))}
                   </div>
                 ) : selectedModel.thumbnailUrl ? (
                   <div className="aspect-video w-full bg-[#0d1117] flex items-center justify-center">
                     <img src={selectedModel.thumbnailUrl} className="max-w-full max-h-full object-contain" alt="thumbnail" />
                   </div>
                 ) : (
                   <div className="aspect-video w-full flex items-center justify-center text-gray-700 bg-[#0d1117]">Sin Media</div>
                 )}
                 {selectedModel.media && selectedModel.media.length > 1 && (
                   <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm shadow px-2 py-1 rounded-full text-[10px] text-gray-300 flex items-center gap-1">
                     <ImageIcon className="w-3 h-3" /> {selectedModel.media.length} archivos (desliza)
                   </div>
                 )}
               </div>

               <div className="p-5 flex-1 space-y-6">
                 
                 {/* TITLE & METADATA */}
                 <div>
                   <div className="flex justify-between items-start gap-4 mb-2">
                     {isEditing ? (
                       <input 
                         value={editTitle} 
                         onChange={e => setEditTitle(e.target.value)}
                         className="flex-1 bg-black/40 border border-[#C6E36C]/30 px-2 py-1 rounded text-white text-lg font-bold outline-none"
                         autoFocus
                       />
                     ) : (
                       <h2 className="text-xl font-bold text-white leading-tight">{selectedModel.title}</h2>
                     )}
                     <div className="flex items-center gap-1 shrink-0">
                       {!isEditing && (
                         <button onClick={() => setIsEditing(true)} className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Editar Metadatos">
                           <Edit2 className="w-4 h-4" />
                         </button>
                       )}
                       {selectedModel.slug && (
                         <a 
                           href={`/modelo/${selectedModel.id}/${selectedModel.slug}`}
                           target="_blank"
                           rel="noreferrer"
                           className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors"
                           title="Ver Página Pública"
                         >
                           <ExternalLink className="w-4 h-4" />
                         </a>
                       )}
                     </div>
                   </div>

                   <div className="flex flex-wrap gap-2 mb-4">
                     <span className="text-[10px] px-2 py-1 rounded bg-gray-800 text-gray-300">ID: {selectedModel.id}</span>
                     <span className="text-[10px] px-2 py-1 rounded bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/20">{selectedModel.modelType}</span>
                     <span className={`text-[10px] px-2 py-1 rounded border ${selectedModel.status === 'published' ? 'bg-green-500/10 text-green-400 border-green-500/20' : selectedModel.status === 'draft' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>{selectedModel.status}</span>
                   </div>

                   <p className="text-sm text-gray-400 mb-4">Autor: <span className="text-gray-200">{selectedModel.authorUsername || selectedModel.authorId}</span></p>
                 </div>

                 {/* MODERATION TOOLS */}
                 <div className="p-4 bg-[#131829] border border-[rgba(168,187,238,0.1)] rounded-xl space-y-4">
                    <h4 className="text-sm font-semibold text-[#8B9DD5]">Herramientas de Moderación</h4>
                    
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Estado del Modelo</label>
                          <select 
                            value={editStatus} 
                            onChange={e => setEditStatus(e.target.value)}
                            className="w-full bg-black/40 border border-[rgba(168,187,238,0.12)] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C6E36C]/30"
                          >
                            <option value="published">Publicado</option>
                            <option value="draft">Borrador</option>
                            <option value="archived">Archivado / Oculto</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <button 
                            onClick={handleSaveChanges} 
                            disabled={isSaving}
                            className="flex-1 bg-[#C6E36C] hover:bg-[#b5d15a] text-[#131829] font-medium py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Guardar Cambios
                          </button>
                          <button 
                            onClick={() => {
                              setIsEditing(false);
                              setEditTitle(selectedModel.title);
                              setEditStatus(selectedModel.status);
                            }} 
                            disabled={isSaving}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2 rounded transition-colors disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="w-full py-2 bg-white/5 hover:bg-white/10 text-sm text-white rounded transition-colors"
                        >
                          Cambiar Estado / Título
                        </button>
                        <button 
                          onClick={(e) => toggleFeatured(selectedModel, e)}
                          className={`w-full py-2 border text-sm rounded transition-colors flex items-center justify-center gap-2 ${selectedModel.featured ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20' : 'bg-white/5 border-transparent text-gray-300 hover:bg-white/10'}`}
                        >
                          <Star className={`w-3.5 h-3.5 ${selectedModel.featured ? "fill-current" : ""}`} />
                          {selectedModel.featured ? "Destacado" : "Destacar"}
                        </button>
                      </div>
                    )}
                 </div>

                 {/* STATS */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="bg-[#131829] p-3 rounded-lg border border-[rgba(168,187,238,0.05)] text-center">
                     <p className="text-[10px] text-gray-500 uppercase tracking-wide">Likes</p>
                     <p className="text-xl font-bold text-white mt-1">{selectedModel.likes || 0}</p>
                   </div>
                   <div className="bg-[#131829] p-3 rounded-lg border border-[rgba(168,187,238,0.05)] text-center">
                     <p className="text-[10px] text-gray-500 uppercase tracking-wide">Descargas</p>
                     <p className="text-xl font-bold text-white mt-1">{selectedModel.downloads || 0}</p>
                   </div>
                 </div>

                 {/* DANGER ZONE */}
                 <div className="pt-6 mt-auto">
                    <h4 className="text-xs font-semibold text-red-500/70 mb-3 flex items-center gap-2 uppercase tracking-wide">
                       <Trash2 className="w-3.5 h-3.5" /> Zona de Peligro
                    </h4>
                    <button
                      onClick={() => deleteModel(selectedModel)}
                      className="w-full py-2.5 rounded-lg border border-red-500/20 text-red-400 text-sm hover:bg-red-500/10 hover:border-red-500/40 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Eliminar Permanentemente
                    </button>
                 </div>

               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
