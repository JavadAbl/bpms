/**
 * url-gate.js — exact-page activation check.
 * -------------------------------------------
 * The extension activates ONLY on the pages described by TARGET
 * (host + path + query parameter). The precise query check lives here in
 * JavaScript because Chrome match patterns cannot express query params.
 */

import { TARGET } from './config.js';

export function isTargetPage() {
  if (TARGET.hosts.indexOf(location.host) === -1) return false;
  // Tolerate an optional trailing slash (".../itemlist/" vs ".../itemlist").
  const pathname = location.pathname.replace(/\/+$/, '');
  if (pathname !== TARGET.path) return false;
  const params = new URLSearchParams(location.search);
  return params.get(TARGET.queryKey) === TARGET.queryValue;
}
