// Sanity checks for the environment library (veoflow environmentValidator
// equivalent). Run in dev/tests to catch physically-implausible specs early —
// a wrong Kelvin/Lux is exactly the kind of silent bug that makes clips drift.

import type { EnvironmentArchetype } from "./types";
import { environmentArchetypes } from "./library";

export interface EnvironmentIssue {
  archetype_id: string;
  problem: string;
}

const KELVIN_MIN = 1000; // candle ≈ 1850K; nothing below burning ember
const KELVIN_MAX = 12000; // deep blue sky dome upper bound
const LUX_MIN = 10; // moonlit/campfire scenes bottom out around here
const LUX_MAX = 120000; // direct summer sun

export function validateArchetype(env: EnvironmentArchetype): EnvironmentIssue[] {
  const issues: EnvironmentIssue[] = [];
  const bad = (problem: string) => issues.push({ archetype_id: env.archetype_id, problem });

  if (env.lighting.key_kelvin < KELVIN_MIN || env.lighting.key_kelvin > KELVIN_MAX)
    bad(`key_kelvin ${env.lighting.key_kelvin} outside plausible ${KELVIN_MIN}-${KELVIN_MAX}K`);
  if (
    env.lighting.ambient_kelvin !== undefined &&
    (env.lighting.ambient_kelvin < KELVIN_MIN || env.lighting.ambient_kelvin > KELVIN_MAX)
  )
    bad(`ambient_kelvin ${env.lighting.ambient_kelvin} outside plausible range`);
  if (env.lighting.ambient_lux < LUX_MIN || env.lighting.ambient_lux > LUX_MAX)
    bad(`ambient_lux ${env.lighting.ambient_lux} outside plausible ${LUX_MIN}-${LUX_MAX}`);
  if (env.materials.length === 0) bad("no materials — realism payload missing");
  if (env.materials.some((m) => !m.physics.trim())) bad("material without physics description");
  if (env.micro_details.length === 0) bad("no micro_details");
  if (env.imperfections.length === 0) bad("no imperfections — set will look CGI-clean");
  if (env.forbidden_variation.length === 0) bad("no forbidden_variation locks");
  if (env.keywords.length < 3) bad("fewer than 3 match keywords — auto-matching will miss");

  return issues;
}

/** Validate the whole library; returns all issues (empty = healthy). */
export function validateEnvironmentLibrary(): EnvironmentIssue[] {
  return Object.values(environmentArchetypes).flatMap(validateArchetype);
}
