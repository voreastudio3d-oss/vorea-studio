const LOCAL_STORAGE_KEYS = {
  user: "vorea_user",
  auth: "vorea_auth",
  models: "vorea_models",
  gcodeCollection: "vorea_gcode_collection",
  compilationLogs: "vorea_compilation_logs",
};

const SESSION_STORAGE_KEYS = {
  currentModel: "vorea_current_model",
  creditOrder: "vorea_credit_order",
};

function removeMatchingLocalStorageKeys(prefixes: string[]) {
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Browser storage unavailable.
  }
}

export function clearSensitiveLocalStateOnLogout() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.user);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.auth);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.models);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.gcodeCollection);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.compilationLogs);
  } catch {
    // Browser storage unavailable.
  }

  removeMatchingLocalStorageKeys([
    "vorea_ai_studio_recipes:",
    "vorea_ai_studio_history:",
  ]);

  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEYS.currentModel);
    sessionStorage.removeItem(SESSION_STORAGE_KEYS.creditOrder);
  } catch {
    // Browser storage unavailable.
  }
}
