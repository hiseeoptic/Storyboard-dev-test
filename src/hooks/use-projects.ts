"use client";

import { useEffect, useState, useCallback } from "react";
import type { Project } from "@/types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setProjects(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (
    data: Pick<Project, "title" | "description" | "genre">
  ): Promise<Project> => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    setProjects((prev) => [json.data, ...prev]);
    return json.data;
  };

  return { projects, loading, error, refetch: fetchProjects, createProject };
}
