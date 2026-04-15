/**
 * ModelContext – Shared state for the active 3D model across all pages.
 * Holds SCAD source, compiled mesh, parameter values, and model metadata.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { SerializedMesh } from "../engine/mesh-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelContextValue {
  /** Current SCAD source code */
  scadSource: string;
  /** Model name */
  modelName: string;
  /** Compiled mesh (null if not compiled yet) */
  compiledMesh: SerializedMesh | null;
  /** Current parameter overrides */
  paramValues: Record<string, number | boolean | string | number[]>;
  /** Whether the model has been modified since last compile */
  isDirty: boolean;
  /** Fork metadata (set when opening a community model) */
  forkMeta: { forkedFromId: string; forkedFromTitle: string; forkedFromAuthor: string } | null;

  /** Set new SCAD source (optionally with name and fork metadata) */
  setScadSource: (source: string, name?: string, fork?: { forkedFromId: string; forkedFromTitle: string; forkedFromAuthor: string } | null) => void;
  /** Update compiled mesh */
  setCompiledMesh: (mesh: SerializedMesh | null) => void;
  /** Update parameter values */
  setParamValues: (values: Record<string, number | boolean | string | number[]>) => void;
  /** Update a single parameter */
  setParam: (name: string, value: number | boolean | string | number[]) => void;
  /** Set model name */
  setModelName: (name: string) => void;
  /** Mark as clean (after compile) */
  markClean: () => void;
  /** Clear fork metadata */
  clearForkMeta: () => void;
}

// ─── Default SCAD source ──────────────────────────────────────────────────────

const DEFAULT_SOURCE = `// VOREA Text Generator Test
$fn = 32;

module text_test() {
  difference() {
    cylinder(h=5, r=30, center=true);
    translate([0, 0, 1])
      linear_extrude(height=10)
        text("A B C O U", size=8, halign="center", valign="center", $fn=100);
  }
}

text_test();
`;

// ─── Context ──────────────────────────────────────────────────────────────────

const ModelContext = createContext<ModelContextValue>({
  scadSource: DEFAULT_SOURCE,
  modelName: "Nuevo Modelo",
  compiledMesh: null,
  paramValues: {},
  isDirty: false,
  forkMeta: null,
  setScadSource: () => {},
  setCompiledMesh: () => {},
  setParamValues: () => {},
  setParam: () => {},
  setModelName: () => {},
  markClean: () => {},
  clearForkMeta: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ModelProvider({ children }: { children: ReactNode }) {
  const [scadSource, _setScadSource] = useState(DEFAULT_SOURCE);
  const [modelName, _setModelName] = useState("Nuevo Modelo");
  const [compiledMesh, _setCompiledMesh] = useState<SerializedMesh | null>(null);
  const [paramValues, _setParamValues] = useState<
    Record<string, number | boolean | string | number[]>
  >({});
  const [isDirty, setIsDirty] = useState(false);
  const [forkMeta, setForkMeta] = useState<{ forkedFromId: string; forkedFromTitle: string; forkedFromAuthor: string } | null>(null);

  const setScadSource = useCallback((source: string, name?: string, fork?: { forkedFromId: string; forkedFromTitle: string; forkedFromAuthor: string } | null) => {
    _setScadSource(source);
    if (name) _setModelName(name);
    _setCompiledMesh(null);
    _setParamValues({});
    setIsDirty(true);
    setForkMeta(fork ?? null);
  }, []);

  const clearForkMeta = useCallback(() => setForkMeta(null), []);

  const setCompiledMesh = useCallback((mesh: SerializedMesh | null) => {
    _setCompiledMesh(mesh);
  }, []);

  const setParamValues = useCallback(
    (values: Record<string, number | boolean | string | number[]>) => {
      _setParamValues(values);
      setIsDirty(true);
    },
    []
  );

  const setParam = useCallback(
    (name: string, value: number | boolean | string | number[]) => {
      _setParamValues((prev) => ({ ...prev, [name]: value }));
      setIsDirty(true);
    },
    []
  );

  const setModelName = useCallback((name: string) => {
    _setModelName(name);
  }, []);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  return (
    <ModelContext.Provider
      value={{
        scadSource,
        modelName,
        compiledMesh,
        paramValues,
        isDirty,
        forkMeta,
        setScadSource,
        setCompiledMesh,
        setParamValues,
        setParam,
        setModelName,
        markClean,
        clearForkMeta,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useModel(): ModelContextValue {
  return useContext(ModelContext);
}

export { DEFAULT_SOURCE };
