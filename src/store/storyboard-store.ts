import { create } from "zustand";
import type {
  Scene,
  Storyboard,
  GenerationProgress,
  StoryboardGenerationOutput,
} from "@/types";

interface StoryboardState {
  storyboard: Storyboard | null;
  scenes: Scene[];
  breakdown: StoryboardGenerationOutput | null;
  progress: GenerationProgress | null;
  isGenerating: boolean;
  selectedSceneId: string | null;
  error: string | null;

  setStoryboard: (storyboard: Storyboard) => void;
  setScenes: (scenes: Scene[]) => void;
  setBreakdown: (breakdown: StoryboardGenerationOutput) => void;
  setProgress: (progress: GenerationProgress | null) => void;
  setIsGenerating: (value: boolean) => void;
  selectScene: (id: string | null) => void;
  setError: (error: string | null) => void;

  updateScene: (id: string, updates: Partial<Scene>) => void;
  removeScene: (id: string) => void;
  addScenes: (scenes: Scene[]) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;

  reset: () => void;
}

const initialState = {
  storyboard: null,
  scenes: [],
  breakdown: null,
  progress: null,
  isGenerating: false,
  selectedSceneId: null,
  error: null,
};

export const useStoryboardStore = create<StoryboardState>((set) => ({
  ...initialState,

  setStoryboard: (storyboard) => set({ storyboard }),
  setScenes: (scenes) => set({ scenes }),
  setBreakdown: (breakdown) => set({ breakdown }),
  setProgress: (progress) => set({ progress }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  selectScene: (selectedSceneId) => set({ selectedSceneId }),
  setError: (error) => set({ error }),

  updateScene: (id, updates) =>
    set((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  removeScene: (id) =>
    set((state) => ({
      scenes: state.scenes
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order_index: i })),
      selectedSceneId:
        state.selectedSceneId === id ? null : state.selectedSceneId,
    })),

  addScenes: (newScenes) =>
    set((state) => ({
      scenes: [...state.scenes, ...newScenes],
    })),

  reorderScenes: (fromIndex, toIndex) =>
    set((state) => {
      const scenes = [...state.scenes];
      const [moved] = scenes.splice(fromIndex, 1);
      if (!moved) return state;
      scenes.splice(toIndex, 0, moved);
      return {
        scenes: scenes.map((s, i) => ({ ...s, order_index: i })),
      };
    }),

  reset: () => set(initialState),
}));
