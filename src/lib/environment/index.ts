export type {
  EnvironmentArchetype,
  LightingProfile,
  MaterialSpec,
  AtmosphereProfile,
  NguHanhElement,
  EnvironmentClass,
} from "./types";
export { environmentArchetypes, elementToArchetypes, environmentLibrary } from "./library";
export {
  resolveEnvironment,
  renderEnvironmentBlock,
  environmentToJson,
  environmentCatalogForPrompt,
} from "./render";
export { validateArchetype, validateEnvironmentLibrary } from "./validator";
export type { EnvironmentIssue } from "./validator";
