import { GRIDFINITY_BASE_SCAD } from "../models/gridfinity-base";
import { CABLE_CLIP_SCAD } from "../models/cable-clip";
import { ROUNDED_BOX_SCAD } from "../models/rounded-box";
import { PHONE_STAND_SCAD } from "../models/phone-stand";
import { DRAWER_ORGANIZER_TRAY_SCAD } from "../models/drawer-organizer-tray";
import { PLANTER_DRIP_SYSTEM_SCAD } from "../models/planter-drip-system";
import { LAMP_SHADE_KIT_SCAD } from "../models/lamp-shade-kit";
import { TEXT_KEYCHAIN_TAG_SCAD } from "../models/text-keychain-tag";
import { NAMEPLATE_PRO_SCAD } from "../models/nameplate-pro";
import { PEG_LABEL_SYSTEM_SCAD } from "../models/peg-label-system";
import { THREADED_JAR_SCAD } from "../models/threaded-jar";

export type ScadTemplateLocale = "es" | "en" | "pt";

export interface ScadTemplateItem {
  id: string;
  code: string;
  imageUrl: string;
  localeTitles: Record<ScadTemplateLocale, string>;
}

function buildTemplate(
  id: string,
  titles: Record<ScadTemplateLocale, string>,
  code: string,
  imageUrl = ""
): ScadTemplateItem {
  return {
    id,
    code,
    imageUrl,
    localeTitles: { ...titles },
  };
}

const DEFAULT_SCAD_TEMPLATES: ScadTemplateItem[] = [
  buildTemplate(
    "gridfinity",
    { es: "Base Gridfinity", en: "Gridfinity Base", pt: "Base Gridfinity" },
    GRIDFINITY_BASE_SCAD,
    "/scad-templates/gridfinity.svg"
  ),
  buildTemplate(
    "cable",
    { es: "Clip para Cables", en: "Cable Clip", pt: "Clipe de Cabos" },
    CABLE_CLIP_SCAD,
    "/scad-templates/cable.svg"
  ),
  buildTemplate(
    "box",
    { es: "Caja Redondeada", en: "Rounded Box", pt: "Caixa Arredondada" },
    ROUNDED_BOX_SCAD,
    "/scad-templates/box.svg"
  ),
  buildTemplate(
    "drawer-tray",
    { es: "Bandeja Organizadora", en: "Drawer Organizer Tray", pt: "Bandeja Organizadora" },
    DRAWER_ORGANIZER_TRAY_SCAD,
    "/scad-templates/drawer-tray.svg"
  ),
  buildTemplate(
    "planter-drip",
    { es: "Maceta con Bandeja", en: "Planter Drip System", pt: "Vaso com Bandeja" },
    PLANTER_DRIP_SYSTEM_SCAD,
    "/scad-templates/planter-drip.svg"
  ),
  buildTemplate(
    "lamp-shade-kit",
    { es: "Kit Pantalla de Lampara", en: "Lamp Shade Kit", pt: "Kit Cupula de Lampada" },
    LAMP_SHADE_KIT_SCAD,
    "/scad-templates/lamp-shade-kit.svg"
  ),
  buildTemplate(
    "text-keychain-tag",
    { es: "Llavero de Texto", en: "Text Keychain Tag", pt: "Chaveiro de Texto" },
    TEXT_KEYCHAIN_TAG_SCAD,
    "/scad-templates/text-keychain-tag.svg"
  ),
  buildTemplate(
    "nameplate-pro",
    { es: "Placa Identificatoria Pro", en: "Nameplate Pro", pt: "Placa de Nome Pro" },
    NAMEPLATE_PRO_SCAD,
    "/scad-templates/nameplate-pro.svg"
  ),
  buildTemplate(
    "peg-label-system",
    { es: "Sistema de Etiquetas para Pegboard", en: "Peg Label System", pt: "Sistema de Etiquetas para Pegboard" },
    PEG_LABEL_SYSTEM_SCAD,
    "/scad-templates/peg-label-system.svg"
  ),
  buildTemplate(
    "threaded-jar",
    { es: "Frasco Roscado", en: "Threaded Jar", pt: "Pote Rosqueado" },
    THREADED_JAR_SCAD,
    "/scad-templates/threaded-jar.svg"
  ),
  buildTemplate(
    "phone",
    { es: "Soporte para Telefono", en: "Phone Stand", pt: "Suporte para Celular" },
    PHONE_STAND_SCAD,
    "/scad-templates/phone.svg"
  ),
];

function normalizeLocale(raw: string): ScadTemplateLocale {
  if (raw === "en") return "en";
  if (raw === "pt") return "pt";
  return "es";
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeTemplateItem(raw: unknown): ScadTemplateItem | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = safeText(obj.id).trim();
  const code = safeText(obj.code);
  if (!id || !code.trim()) return null;

  const rawTitles = (obj.localeTitles && typeof obj.localeTitles === "object")
    ? (obj.localeTitles as Record<string, unknown>)
    : {};

  const fallbackName = safeText(obj.name).trim() || id;
  const esTitle = safeText(rawTitles.es).trim() || fallbackName;
  const enTitle = safeText(rawTitles.en).trim() || esTitle;
  const ptTitle = safeText(rawTitles.pt).trim() || esTitle;

  return {
    id,
    code,
    imageUrl: safeText(obj.imageUrl).trim(),
    localeTitles: {
      es: esTitle,
      en: enTitle,
      pt: ptTitle,
    },
  };
}

export function getDefaultScadTemplates(): ScadTemplateItem[] {
  return DEFAULT_SCAD_TEMPLATES.map((item) => ({
    ...item,
    localeTitles: { ...item.localeTitles },
  }));
}

export function normalizeScadTemplatesConfig(raw: unknown): ScadTemplateItem[] | null {
  if (!raw) return null;

  if (Array.isArray(raw)) {
    const normalized = raw
      .map(normalizeTemplateItem)
      .filter((item): item is ScadTemplateItem => !!item);
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof raw === "object") {
    const templates = (raw as Record<string, unknown>).templates;
    if (Array.isArray(templates)) {
      return normalizeScadTemplatesConfig(templates);
    }
  }

  return null;
}

export function toBaseTemplateLocale(locale: string): ScadTemplateLocale {
  return normalizeLocale(locale.split("-")[0]?.toLowerCase() || "es");
}

export function getTemplateTitle(template: ScadTemplateItem, locale: string): string {
  const base = toBaseTemplateLocale(locale);
  return template.localeTitles[base] || template.localeTitles.es || template.id;
}
