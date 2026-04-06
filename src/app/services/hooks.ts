/**
 * React hooks wrapping the localStorage services.
 * Provides reactive state that auto-syncs with storage.
 */

import { useState, useCallback, useEffect } from "react";
import type { UserProfile, ModelProject, SceneParams, ModelStatus } from "./types";
import { UserService, ModelService } from "./storage";

// ─── useUserProfile ───────────────────────────────────────────────────────────

export function useUserProfile() {
  const [user, setUser] = useState<UserProfile>(UserService.get);

  const updateUser = useCallback(
    (patch: Partial<Omit<UserProfile, "id" | "createdAt">>) => {
      const updated = UserService.update(patch);
      setUser(updated);
    },
    []
  );

  const resetUser = useCallback(() => {
    UserService.reset();
    setUser(UserService.get());
  }, []);

  return { user, updateUser, resetUser };
}

// ─── useModels ────────────────────────────────────────────────────────────────

export function useModels() {
  const [models, setModels] = useState<ModelProject[]>(() => ModelService.list());
  const [stats, setStats] = useState(() => ModelService.stats());

  const refresh = useCallback(() => {
    setModels(ModelService.list());
    setStats(ModelService.stats());
  }, []);

  const createModel = useCallback(
    (data: {
      title: string;
      params: SceneParams;
      wireframe?: boolean;
      status?: ModelStatus;
    }) => {
      const model = ModelService.create(data);
      refresh();
      return model;
    },
    [refresh]
  );

  const updateModel = useCallback(
    (id: string, patch: Partial<Omit<ModelProject, "id" | "createdAt">>) => {
      const updated = ModelService.update(id, patch);
      refresh();
      return updated;
    },
    [refresh]
  );

  const deleteModel = useCallback(
    (id: string) => {
      const ok = ModelService.delete(id);
      refresh();
      return ok;
    },
    [refresh]
  );

  return { models, stats, createModel, updateModel, deleteModel, refresh };
}

// ─── useCurrentModel ──────────────────────────────────────────────────────────
// Manages "active project" id in session, so Editor can load/save a specific model.

const SESSION_KEY = "vorea_current_model";

export function useCurrentModel() {
  const [currentId, _setCurrentId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });

  const setCurrentId = useCallback((id: string | null) => {
    _setCurrentId(id);
    try {
      if (id) sessionStorage.setItem(SESSION_KEY, id);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* silent */
    }
  }, []);

  const currentModel = currentId ? ModelService.getById(currentId) ?? null : null;

  return { currentId, currentModel, setCurrentId };
}
