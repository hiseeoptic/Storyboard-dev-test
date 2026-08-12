export const PROJECT_INPUT_SLOT_LIMIT = 5;
const DB_NAME = "storyboard-input-slots-v1";
const STORE_NAME = "slots";
const ACTIVE_KEY = "active";

export interface ProjectInputSlot<T> {
  id: string;
  name: string;
  snapshot: T;
  created_at: string;
  updated_at: string;
}

export interface ProjectInputWorkspace<T> {
  version: 1;
  active_project_id: string;
  projects: ProjectInputSlot<T>[];
}

export function makeProjectInputSlot<T>(snapshot: T, index = 0): ProjectInputSlot<T> {
  const now = new Date().toISOString();
  return {
    id: `input_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Dự án ${index + 1}`,
    snapshot,
    created_at: now,
    updated_at: now,
  };
}

export function normalizeProjectInputWorkspace<T>(
  value: ProjectInputWorkspace<T> | null | undefined,
  fallbackSnapshot: T
): ProjectInputWorkspace<T> {
  const projects = Array.isArray(value?.projects)
    ? value.projects.slice(0, PROJECT_INPUT_SLOT_LIMIT)
    : [];
  if (projects.length === 0) projects.push(makeProjectInputSlot(fallbackSnapshot));
  const activeProjectId = projects.some((project) => project.id === value?.active_project_id)
    ? value!.active_project_id
    : projects[0]!.id;
  return { version: 1, active_project_id: activeProjectId, projects };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Không mở được bộ nhớ dữ liệu dự án."));
  });
}

export async function loadProjectInputWorkspace<T>(): Promise<ProjectInputWorkspace<T> | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(ACTIVE_KEY);
      request.onsuccess = () => resolve((request.result as ProjectInputWorkspace<T> | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Không đọc được dữ liệu dự án."));
    });
  } finally {
    db.close();
  }
}

export async function saveProjectInputWorkspace<T>(workspace: ProjectInputWorkspace<T>): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(workspace, ACTIVE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Không lưu được dữ liệu dự án."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Lưu dữ liệu dự án bị hủy."));
    });
  } finally {
    db.close();
  }
}
