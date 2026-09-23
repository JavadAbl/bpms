/**
 * OA Process Activation — content script bootstrap (v1.3.0)
 * ----------------------------------------------------------
 * Manifest V3 content scripts CANNOT be declared as ES modules
 * ("type": "module" is not supported for content_scripts). The officially
 * supported pattern is exactly this: a tiny CLASSIC script that dynamically
 * import()s real ES module files, which are exposed to matching pages via
 * "web_accessible_resources" in manifest.json.
 *
 * The imported modules run in the content script's isolated world (same
 * DOM access, same limited chrome.* APIs — including chrome.storage).
 *
 * This bootstrap resolves the module base URL for both contexts:
 *   - real extension  → chrome.runtime.getURL('src/')
 *   - local plain-HTTP testing (mock server, no extension host)
 *                      → the folder this script was loaded from
 *
 * Everything else lives in src/ — see src/main.js (composition root).
 */

(() => {
  'use strict';

  let base = null;

  // Real extension context.
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      base = chrome.runtime.getURL('src/');
    }
  } catch (e) {
    /* chrome object unavailable — fall through to the plain-HTTP path */
  }

  // Local testing context (script served over plain HTTP).
  if (!base) {
    const here = (document.currentScript && document.currentScript.src) || location.href;
    base = new URL('src/', here).href;
  }

  import(base + 'main.js').catch((err) => {
    console.error('[OA Process Activation] failed to load ES modules from', base, err);
  });
})();
