// Cost-safe production mode: one project is active at a time. Keeping the
// storage abstraction lets us restore multi-project work later without
// reintroducing any automatic API orchestration.
export const PROJECT_WORKSPACE_LIMIT = 1;
const DB_NAME = "storyboard-project-workspace-v1";
const STORE_NAME = "workspace";
const ACTIVE_KEY = "active";

export type ProjectSlotStatus =
  | "draft"
  | "queued"
  | "building"
  | "needs_repair"
  | "completed";

export interface ProjectSlot<T = unknown, R = unknown> {
  id: string;
  name: string;
  status: ProjectSlotStatus;
  snapshot: T;
  /** Immutable copy captured when the user adds this project to the queue. */
  queued_snapshot?: T;
  queued_at?: string;
  /** Script, storyboard, manifest inputs and findings owned only by this slot. */
  workflow?: R;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWorkspace<T = unknown, R = unknown> {
  version: 1;
  active_project_id: string;
  projects: ProjectSlot<T, R>[];
}

export function newProjectId(): string {
  return `project_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeProjectSlot<T, R = unknown>(snapshot: T, index = 0): ProjectSlot<T, R> {
  const now = new Date().toISOString();
  return {
    id: newProjectId(),
    name: `Dự án ${index + 1}`,
    status: "draft",
    snapshot,
    created_at: now,
    updated_at: now,
  };
}

export function normalizeProjectWorkspace<T, R = unknown>(
  value: ProjectWorkspace<T, R> | null | undefined,
  fallbackSnapshot: T
): ProjectWorkspace<T, R> {
  const projects = Array.isArray(value?.projects)
    ? value!.projects.slice(0, PROJECT_WORKSPACE_LIMIT).map((project) =>
        // A page reload cannot have a live server request. Therefore a stored
        // "building" status is stale by definition and must be recoverable.
        project.status === "building"
          ? {
              ...project,
              status: "needs_repair" as const,
              last_error: project.last_error || "Lượt dựng trước đã bị gián đoạn. Hãy chạy lại riêng dự án này.",
            }
          : project
      )
    : [];
  if (projects.length === 0) projects.push(makeProjectSlot(fallbackSnapshot, 0));
  const active = projects.some((project) => project.id === value?.active_project_id)
    ? value!.active_project_id
    : projects[0]!.id;
  return { version: 1, active_project_id: active, projects };
}

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Không mở được bộ nhớ dự án."));
  });
}

export async function loadProjectWorkspace<T, R = unknown>(): Promise<ProjectWorkspace<T, R> | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openWorkspaceDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(ACTIVE_KEY);
      request.onsuccess = () => resolve((request.result as ProjectWorkspace<T, R> | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Không đọc được danh sách dự án."));
    });
  } finally {
    db.close();
  }
}

export async function saveProjectWorkspace<T, R = unknown>(workspace: ProjectWorkspace<T, R>): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openWorkspaceDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(workspace, ACTIVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Không lưu được danh sách dự án."));
      tx.onabort = () => reject(tx.error ?? new Error("Lưu danh sách dự án bị hủy."));
    });
  } finally {
    db.close();
  }
}
