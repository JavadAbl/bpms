/**
 * background.js — MV3 service worker that owns BPMS API fetches.
 * --------------------------------------------------------------
 * Content scripts run in the OA page (https://oa.atie-sazan.ir). A
 * fetch() from there to http://localhost:3001 is a public-site → local
 * network request. Chrome reports that as CORS / Local Network Access
 * even when host_permissions lists localhost.
 *
 * Fetching from this worker uses the extension's host_permissions, so
 * CORS and the page's local-network checks do not apply.
 */

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'OA_PA_FETCH') return;
  (async () => {
    try {
      const headers = Object.assign({}, msg.headers || {});
      const init = { method: msg.method || 'GET', headers };

      if (msg.bodyKind === 'form' && Array.isArray(msg.formFiles)) {
        const fd = new FormData();
        for (const f of msg.formFiles) {
          const bin = base64ToBytes(f.data);
          fd.append(
            f.key,
            new Blob([bin], { type: f.type || '' }),
            f.filename || 'file',
          );
        }
        init.body = fd;
        delete headers['Content-Type'];
        delete headers['content-type'];
      } else if (msg.bodyKind === 'text' && msg.body != null) {
        init.body = msg.body;
      }

      const res = await fetch(msg.url, init);
      const buf = new Uint8Array(await res.arrayBuffer());
      const respHeaders = {};
      res.headers.forEach((value, key) => {
        respHeaders[key] = value;
      });
      sendResponse({
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        headers: respHeaders,
        bodyBase64: bytesToBase64(buf),
      });
    } catch (err) {
      sendResponse({
        error: String(err && err.message ? err.message : err),
        status: 0,
      });
    }
  })();
  return true; // keep the message channel open for the async reply
});
