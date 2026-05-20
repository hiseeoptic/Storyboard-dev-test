import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  createDialogOpen: boolean;
  generateDialogOpen: boolean;
  deleteConfirmId: string | null;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setGenerateDialogOpen: (open: boolean) => void;
  setDeleteConfirmId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  createDialogOpen: false,
  generateDialogOpen: false,
  deleteConfirmId: null,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setCreateDialogOpen: (createDialogOpen) => set({ createDialogOpen }),
  setGenerateDialogOpen: (generateDialogOpen) => set({ generateDialogOpen }),
  setDeleteConfirmId: (deleteConfirmId) => set({ deleteConfirmId }),
}));
