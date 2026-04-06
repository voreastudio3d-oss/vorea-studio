/**
 * i18n Context — Zero-dependency internationalization for Vorea Studio.
 *
 * Hierarchical locale inheritance:
 *   ES → ES-UY, ES-AR, ES-MX
 *   EN → EN-GB
 *   PT → PT-BR
 *
 * Locale priority: URL prefix > localStorage > navigator.language
 *
 * Base locale files contain ALL keys. Override files only contain
 * the keys that differ (regional modismos/terms).
 *
 * Vorea Studio — voreastudio.com
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ─── Locale Registry ──────────────────────────────────────────────────────────

import es from "../locales/es.json";
import esUY from "../locales/es-UY.json";
import esAR from "../locales/es-AR.json";
import esMX from "../locales/es-MX.json";
import en from "../locales/en.json";
import enGB from "../locales/en-GB.json";
import pt from "../locales/pt.json";
import ptBR from "../locales/pt-BR.json";

type LocaleValue = string | string[];
type LocaleDict = Record<string, LocaleValue>;

interface LocaleEntry {
  code: string;
  label: string;
  flag: string;
  base: LocaleDict;
  overrides?: LocaleDict;
}

const LOCALES: LocaleEntry[] = [
  { code: "es",    label: "Español",               flag: "🌎", base: es },
  { code: "es-UY", label: "Español (Uruguay)",     flag: "🇺🇾", base: es, overrides: esUY },
  { code: "es-AR", label: "Español (Argentina)",   flag: "🇦🇷", base: es, overrides: esAR },
  { code: "es-MX", label: "Español (México)",      flag: "🇲🇽", base: es, overrides: esMX },
  { code: "en",    label: "English",               flag: "🌍", base: en },
  { code: "en-GB", label: "English (UK)",          flag: "🇬🇧", base: en, overrides: enGB },
  { code: "pt",    label: "Português",             flag: "🌍", base: pt },
  { code: "pt-BR", label: "Português (Brasil)",   flag: "🇧🇷", base: pt, overrides: ptBR },
];

const STORAGE_KEY = "vorea-locale";
const DEFAULT_LOCALE = "es";

// ─── Merge helper ─────────────────────────────────────────────────────────────

function buildDict(entry: LocaleEntry): LocaleDict {
  if (!entry.overrides) return entry.base;
  return { ...entry.base, ...entry.overrides };
}

// ─── Auto-detect from browser ─────────────────────────────────────────────────

function detectLocale(): string {
  const nav = navigator.language || (navigator as any).userLanguage || "";
  // Try exact match first: "es-UY"
  const exact = LOCALES.find(
    (l) => l.code.toLowerCase() === nav.toLowerCase()
  );
  if (exact) return exact.code;

  // Try base match: "es" from "es-UY"
  const base = nav.split("-")[0].toLowerCase();
  const baseMatch = LOCALES.find((l) => l.code.toLowerCase() === base);
  if (baseMatch) return baseMatch.code;

  return DEFAULT_LOCALE;
}

function extractUrlLang(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/([a-z]{2})(\/|$)/);
  return match ? match[1] : null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface I18nContextValue {
  /** Current locale code, e.g. "es-UY" */
  locale: string;
  /** Change the active locale */
  setLocale: (code: string) => void;
  /** Translate a key. Returns the key itself if not found. */
  t: (key: string, replacements?: Record<string, string | number>) => string;
  /** All available locales for the picker */
  availableLocales: readonly LocaleEntry[];
  /** Short display code, e.g. "ES-UY" */
  displayCode: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(() => {
    // Priority: URL prefix > localStorage > browser detection
    const urlLang = extractUrlLang();
    if (urlLang) {
      const match = LOCALES.find(l => l.code === urlLang || l.code.startsWith(urlLang + "-"));
      if (match) return match.code;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LOCALES.some((l) => l.code === stored)) return stored;
    return detectLocale();
  });

  const [dict, setDict] = useState<LocaleDict>(() => {
    const entry = LOCALES.find((l) => l.code === locale) || LOCALES[0];
    return buildDict(entry);
  });

  const setLocale = useCallback((code: string) => {
    const entry = LOCALES.find((l) => l.code === code);
    if (!entry) return;
    localStorage.setItem(STORAGE_KEY, code);
    setLocaleState(code);
    setDict(buildDict(entry));
  }, []);

  // Rebuild dict if locale changes externally
  useEffect(() => {
    const entry = LOCALES.find((l) => l.code === locale);
    if (entry) setDict(buildDict(entry));
  }, [locale]);

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>): string => {
      const rawValue = dict[key];
      let value = Array.isArray(rawValue)
        ? rawValue.join("\n")
        : rawValue ?? key;
      if (replacements) {
        for (const [k, v] of Object.entries(replacements)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return value;
    },
    [dict]
  );

  const displayCode = locale.toUpperCase();

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t, availableLocales: LOCALES, displayCode }}
    >
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

export type { LocaleEntry };
