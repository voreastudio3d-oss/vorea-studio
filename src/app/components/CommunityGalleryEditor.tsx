import { useRef } from "react";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { useI18n } from "../services/i18n-context";
import type { EditableGalleryItem } from "../services/community-gallery";
import { Button } from "./ui/button";

interface CommunityGalleryEditorProps {
  items: EditableGalleryItem[];
  coverIndex: number;
  previewUrl: string | null;
  onFilesSelected: (files: FileList | null) => void;
  onSetCover: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onCapture?: () => void;
}

export function CommunityGalleryEditor({
  items,
  coverIndex,
  previewUrl,
  onFilesSelected,
  onSetCover,
  onMove,
  onRemove,
  onCapture,
}: CommunityGalleryEditorProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">{t("publish.thumbnail")}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          onFilesSelected(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex items-center gap-4">
        <div className="w-40 aspect-[4/3] rounded-xl overflow-hidden border border-[rgba(168,187,238,0.12)] bg-[#0d1117]">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <Camera className="w-6 h-6" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {onCapture && (
            <Button size="sm" variant="secondary" className="gap-1.5 text-xs" onClick={onCapture}>
              <Camera className="w-3.5 h-3.5" /> {t("publish.recapture")}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5 text-xs"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="w-3.5 h-3.5" />
            {t("publish.addImages")}
          </Button>
          {onCapture && <p className="text-[10px] text-gray-600">{t("publish.autoCapture")}</p>}
          <p className="text-[10px] text-gray-600">{t("publish.galleryLimit")}</p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t("publish.gallery")}</p>
            <p className="text-[10px] text-gray-600">{items.length}/10</p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`relative rounded-lg overflow-hidden border ${index === coverIndex ? "border-[#C6E36C]/60" : "border-[rgba(168,187,238,0.12)]"}`}
              >
                <button
                  type="button"
                  className="w-full aspect-square bg-[#0d1117] block"
                  onClick={() => onSetCover(index)}
                  title={t("publish.setAsCover")}
                >
                  <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                </button>

                <div className="absolute bottom-1 right-1 flex items-center gap-1">
                  <button
                    type="button"
                    className="w-5 h-5 rounded-full bg-black/60 text-gray-300 hover:text-white disabled:opacity-30 flex items-center justify-center"
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                    title={t("publish.moveLeft")}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    className="w-5 h-5 rounded-full bg-black/60 text-gray-300 hover:text-white disabled:opacity-30 flex items-center justify-center"
                    onClick={() => onMove(index, 1)}
                    disabled={index === items.length - 1}
                    title={t("publish.moveRight")}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-gray-300 hover:text-white flex items-center justify-center"
                  onClick={() => onRemove(index)}
                  title={t("common.delete")}
                >
                  <X className="w-3 h-3" />
                </button>

                {index === coverIndex && (
                  <span className="absolute bottom-1 left-1 text-[8px] px-1.5 py-0.5 rounded bg-[#C6E36C] text-black font-semibold">
                    {t("publish.coverLabel")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
