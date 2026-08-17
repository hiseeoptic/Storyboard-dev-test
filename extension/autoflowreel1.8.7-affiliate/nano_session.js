/* Nano Flow project/run isolation.
 * Pure helpers are exported for Node regression tests and attached to window
 * for the Chrome side panel. No network or storage side effects live here. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NanoSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    Object.keys(value).sort().forEach((key) => {
      if (!/^generated$|^video$|^status$|^runtime$/i.test(key)) out[key] = stable(value[key]);
    });
    return out;
  }

  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function fingerprintManifest(manifest) {
    const m = manifest || {};
    const signature = {
      manifest_version: m.manifest_version || '',
      generated_at: m.generated_at || '',
      project: m.project || {},
      assets: m.assets || {},
      shots: Array.isArray(m.shots) ? m.shots.map((shot) => ({
        shot_id: shot && shot.shot_id,
        index: shot && shot.index,
        storyboard_prompt: shot && shot.storyboard_prompt,
        video_prompt: shot && shot.video_prompt,
      })) : [],
    };
    return 'nfp_' + hash(JSON.stringify(stable(signature)));
  }

  function newId(prefix) {
    const raw = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    return prefix + '_' + raw;
  }

  function createRunContext(input) {
    return Object.freeze({
      projectFingerprint: String(input.projectFingerprint || ''),
      runId: newId('nfr'),
      generationEpoch: Number(input.generationEpoch) || 0,
      flowProjectId: String(input.flowProjectId || '').replace(/^projects\//, ''),
    });
  }

  function envelope(context) {
    return context ? {
      projectFingerprint: context.projectFingerprint,
      runId: context.runId,
      generationEpoch: context.generationEpoch,
      flowProjectId: context.flowProjectId,
    } : {};
  }

  function matches(candidate, expected) {
    if (!candidate || !expected) return false;
    return String(candidate.projectFingerprint || '') === String(expected.projectFingerprint || '')
      && String(candidate.runId || '') === String(expected.runId || '')
      && Number(candidate.generationEpoch) === Number(expected.generationEpoch)
      && String(candidate.flowProjectId || '').replace(/^projects\//, '')
        === String(expected.flowProjectId || '').replace(/^projects\//, '');
  }

  function resultKey(context, shotId, index) {
    return [
      context && context.projectFingerprint,
      context && context.runId,
      context && context.generationEpoch,
      context && context.flowProjectId,
      shotId || ('INDEX_' + index),
    ].map((part) => String(part == null ? '' : part)).join(':');
  }

  function stampItem(item, context) {
    return Object.assign({}, item, envelope(context), {
      resultKey: resultKey(context, item && item.shotId, item && item.index),
    });
  }

  return { fingerprintManifest, createRunContext, envelope, matches, resultKey, stampItem };
});
