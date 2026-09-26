/**
 * styles.js — namespaced CSS injection.
 * ---------------------------------------
 * All rules are namespaced "oa-pa-" and prefixed with our element IDs so
 * the OA page's own CSS (Site.css, _Layout.css, ...) can never bleed into
 * (or override) these rules.
 */

import { IDS } from './config.js';

const CSS = `
  /* ===== OA Process Activation — injected styles ===== */
  /* Outer header-section / floating only — inline items override below. */
  #${IDS.section}:not(.oa-pa-inline-item),
  #${IDS.startSection}:not(.oa-pa-inline-item) {
    display: flex !important;
    align-items: center;
    align-self: center;
    direction: rtl;
  }

  /* ===== Inline into #header-userinfo-inner (_Layout.css) =====
     Host: #header-userinfo is a fixed-width (320px) table-cell whose inner
     div is overflow:hidden; #header-userinfo-inner is inline-table with
     table-cell children. We keep table-cell here, and header-button.js
     widens #header-userinfo to fit the row so nothing gets clipped. */
  #${IDS.section}.oa-pa-inline-item,
  #${IDS.startSection}.oa-pa-inline-item {
    display: table-cell !important;
    vertical-align: middle;
    padding: 0 4px;
    margin: 0;
    direction: rtl;
    white-space: nowrap;
  }
  #${IDS.startSection}.oa-pa-inline-item.oa-pa-hidden {
    display: none !important;
  }
  /* Match host header items: table-cell + vertical-align middle centers
     content like #setting-button / #notifications (no fixed height). */
  #${IDS.section}.oa-pa-inline-item #${IDS.button},
  #${IDS.startSection}.oa-pa-inline-item #${IDS.startButton} {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    height: auto;
    margin: 0;
    padding: 0 8px;
    gap: 6px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    color: inherit;
    font-family: inherit;
    font-size: inherit;
    font-weight: 500;
    line-height: 1;
  }
  #${IDS.section}.oa-pa-inline-item #${IDS.button}:hover,
  #${IDS.startSection}.oa-pa-inline-item #${IDS.startButton}:hover {
    filter: none;
    background: rgba(255, 255, 255, 0.12);
  }
  body.light #${IDS.section}.oa-pa-inline-item #${IDS.button},
  body.light #${IDS.startSection}.oa-pa-inline-item #${IDS.startButton} {
    color: #303030;
  }
  body.light #${IDS.section}.oa-pa-inline-item #${IDS.button}:hover,
  body.light #${IDS.startSection}.oa-pa-inline-item #${IDS.startButton}:hover {
    background: rgba(0, 0, 0, 0.06);
  }
  body.dark #${IDS.section}.oa-pa-inline-item #${IDS.button},
  body.dark #${IDS.startSection}.oa-pa-inline-item #${IDS.startButton} {
    color: #fff;
  }
  #${IDS.section}.oa-pa-inline-item .oa-pa-btn-icon,
  #${IDS.startSection}.oa-pa-inline-item .oa-pa-btn-icon {
    display: inline-flex;
    align-items: center;
    line-height: 0;
  }
  #${IDS.section}.oa-pa-inline-item .oa-pa-btn-icon svg,
  #${IDS.startSection}.oa-pa-inline-item .oa-pa-btn-icon svg {
    width: 18px;
    height: 18px;
    display: block;
  }
  #${IDS.startSection}.oa-pa-inline-item .oa-pa-btn-icon {
    color: #10b981;
  }
  #${IDS.section}.oa-pa-inline-item .oa-pa-label,
  #${IDS.startSection}.oa-pa-inline-item .oa-pa-label {
    line-height: 1;
  }
  #${IDS.section}.oa-pa-floating {
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 2147483646;
  }
  #${IDS.button} {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    direction: rtl;
    padding: 5px 11px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 7px;
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
    color: #ffffff;
    font-family: "Iran Sans Web", Tahoma, "Segoe UI", FreeSerif, Arial, sans-serif;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
    transition: filter 0.15s ease, transform 0.15s ease;
  }
  #${IDS.button}:hover  { filter: brightness(1.12); }
  #${IDS.button}:active { transform: scale(0.97); }
  #${IDS.button} .oa-pa-btn-icon { flex: none; display: inline-flex; }

  /* ===== v1.8 — «جریان کار جدید» header button (session-gated) =====
     Same shape as the login button; green accent to distinguish it.
     Hidden entirely while logged out (oa-pa-hidden, like the sidebar). */
  #${IDS.startSection}.oa-pa-floating {
    position: fixed;
    top: 52px;
    left: 10px;
    z-index: 2147483646;
  }
  #${IDS.startButton} {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    direction: rtl;
    padding: 5px 11px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 7px;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    color: #ffffff;
    font-family: "Iran Sans Web", Tahoma, "Segoe UI", FreeSerif, Arial, sans-serif;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
    transition: filter 0.15s ease, transform 0.15s ease;
  }
  #${IDS.startButton}:hover  { filter: brightness(1.12); }
  #${IDS.startButton}:active { transform: scale(0.97); }
  #${IDS.startButton} .oa-pa-btn-icon { flex: none; display: inline-flex; }
  #${IDS.startSection}.oa-pa-hidden { display: none !important; }

  /* ===== Modal ===== */
  .oa-pa-hidden { display: none !important; }
  #${IDS.overlay} {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    direction: rtl;
    font-family: "Iran Sans Web", Tahoma, "Segoe UI", FreeSerif, Arial, sans-serif;
  }
  #${IDS.modal},
  #${IDS.modal} *,
  #${IDS.modal} *::before,
  #${IDS.modal} *::after {
    box-sizing: border-box;
  }
  #${IDS.modal} {
    width: 480px;
    max-width: calc(100vw - 32px);
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 24px 60px rgba(2, 6, 23, 0.4);
    overflow: hidden;
    text-align: right;
    color: #1e293b;
  }
  .oa-pa-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 18px;
    border-bottom: 1px solid #eef0f4;
    background: #f8fafc;
  }
  .oa-pa-modal-title { font-size: 14px; font-weight: 700; color: #0f172a; }
  .oa-pa-close {
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 6px;
    flex: none;
  }
  .oa-pa-close:hover { background: #e2e8f0; color: #0f172a; }
  .oa-pa-modal-body {
    padding: 16px 18px 6px;
    overflow-x: hidden;
    max-width: 100%;
  }
  .oa-pa-hint { margin: 0 0 6px; font-size: 12px; color: #64748b; line-height: 1.9; }
  .oa-pa-saved-note {
    margin: 0 0 10px;
    padding: 8px 12px;
    font-size: 12px;
    color: #065f46;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 8px;
  }
  #${IDS.modal} #oa-pa-form {
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 0;
  }
  /* Modal field labels — keep separate from header .oa-pa-label text. */
  #${IDS.modal} .oa-pa-label {
    display: block;
    font-size: 12.5px;
    font-weight: 600;
    color: #334155;
    margin: 10px 0 6px;
  }
  #${IDS.modal} .oa-pa-input {
    display: block;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    height: auto !important;
    margin: 0 !important;
    padding: 9px 12px !important;
    border: 1px solid #d1d5db !important;
    border-radius: 8px !important;
    font-size: 13px !important;
    line-height: 1.4 !important;
    direction: ltr;
    text-align: left;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
    color: #0f172a !important;
    background: #ffffff !important;
    box-shadow: none !important;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  #${IDS.modal} .oa-pa-input:focus {
    outline: none !important;
    border-color: #7c3aed !important;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.16) !important;
  }
  .oa-pa-label {
    display: block;
    font-size: 12.5px;
    font-weight: 600;
    margin: 0;
  }
  .oa-pa-input {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 9px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 13px;
    direction: ltr;
    text-align: left;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .oa-pa-input:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.16);
  }
  .oa-pa-error {
    margin: 12px 0 0;
    padding: 8px 12px;
    font-size: 12px;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
  }
  .oa-pa-success {
    margin: 12px 0 0;
    padding: 10px 12px;
    font-size: 12.5px;
    font-weight: 600;
    color: #065f46;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 8px;
    text-align: center;
  }
  .oa-pa-storage-note {
    margin: 10px 0 8px;
    font-size: 11px;
    color: #94a3b8;
    text-align: center;
  }
  .oa-pa-modal-footer {
    display: flex;
    gap: 10px;
    padding: 14px 18px;
    border-top: 1px solid #eef0f4;
  }
  .oa-pa-btn-primary,
  .oa-pa-btn-secondary {
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    padding: 9px 22px;
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.15s ease;
  }
  .oa-pa-btn-primary {
    border: none;
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.35);
  }
  .oa-pa-btn-secondary {
    border: 1px solid #e2e8f0;
    background: #f1f5f9;
    color: #334155;
  }
  .oa-pa-btn-primary:hover,
  .oa-pa-btn-secondary:hover { filter: brightness(1.08); }
  .oa-pa-btn-primary:active,
  .oa-pa-btn-secondary:active { transform: scale(0.97); }
  .oa-pa-btn-primary:disabled,
  .oa-pa-btn-secondary:disabled { opacity: 0.65; cursor: default; }

  /* ===== BPMS sidebar section + items =====
     Section divider («جریان کار») separates host OA items from BPMS ones.
     Items reuse host classes; unread-count look comes from _NavigationPanel.css. */
  .oa-pa-sidebar-section {
    display: block !important;
    margin: 10px 8px 4px;
    padding: 8px 10px 4px;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    cursor: default;
    pointer-events: none;
    list-style: none;
  }
  body.dark .oa-pa-sidebar-section {
    border-top-color: rgba(255, 255, 255, 0.18);
  }

  .oa-pa-sidebar-section .oa-pa-sidebar-section-title {
    display: block;
    font-family: "Iran Sans Web", Tahoma, FreeSerif, Arial, sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #6b7280;
    text-align: right;
  }

  .oa-pa-sidebar-section-title{
   padding:16px;
   font-weight: bold;
   color:black !important;
  }

  body.dark .oa-pa-sidebar-section .oa-pa-sidebar-section-title {
    color: #c4c7d0;
  }
  body.light .oa-pa-sidebar-section .oa-pa-sidebar-section-title {
    color: #6b7280;
  }
  #oa-nav .oa-pa-sidebar-section .arrow-holder,
  .oa-pa-sidebar-section .arrow-holder {
    display: none !important;
  }
  .oa-pa-sidebar-item .oa-pa-sidebar-link { cursor: pointer; }
  /* کارتابل count — hide when empty; compact gray pill when > 0
     (host _NavigationPanel uses a fixed 50px box; we size to the digit). */
  .oa-pa-sidebar-item .oa-pa-sidebar-badge:empty {
    display: none !important;
  }
  .oa-pa-sidebar-item .oa-pa-sidebar-badge:not(:empty) {
    display: inline-block !important;
    float: left;
    box-sizing: border-box;
    min-width: 22px;
    width: auto !important;
    height: auto;
    padding: 2px 8px !important;
    margin-top: 4px;
    margin-inline-start: 6px;
    font-size: 11px !important;
    font-weight: 600;
    line-height: 1.45;
    text-align: center !important;
    color: #414141 !important;
    background: #e7e7e7 !important;
    border-radius: 999px !important;
    font-family: "Iran Sans Web", Tahoma, FreeSerif, Arial, sans-serif;
    vertical-align: middle;
  }
  body.dark .oa-pa-sidebar-item .oa-pa-sidebar-badge:not(:empty) {
    background: #3a3a3a !important;
    color: #f3f4f6 !important;
  }
  body.light .oa-pa-sidebar-item:hover .oa-pa-sidebar-badge:not(:empty) {
    background: #ffffff !important;
    color: #2555ff !important;
  }
  body.dark .oa-pa-sidebar-item:hover .oa-pa-sidebar-badge:not(:empty) {
    background: #1c4ca4 !important;
    color: #ffffff !important;
  }

  /* ===== Tasks / cases grids (jqGrid-style light theme, RTL) —
     both grids share the .oa-pa-grid class on their root. ===== */
  .oa-pa-grid {
    direction: rtl;
    text-align: right;
    font-family: "Iran Sans Web", Tahoma, "Segoe UI", FreeSerif, Arial, sans-serif;
    color: #1f2937;
    background: #ffffff;
    border: 1px solid #c9d3dd;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
  }
  .oa-pa-grid * { box-sizing: border-box; }
  .oa-pa-grid-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    padding: 10px 14px;
    background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
    border-bottom: 1px solid #d8e0e8;
  }
  .oa-pa-grid-title-wrap {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }
  .oa-pa-grid-title { font-size: 14px; font-weight: 700; color: #0f172a; }
  .oa-pa-grid-subtitle { font-size: 11.5px; color: #64748b; margin-inline-start: 8px; }
  .oa-pa-grid-count {
    display: inline-block;
    margin-inline-start: 8px;
    padding: 1px 9px;
    background: #ede9fe;
    color: #5b21b6;
    border: 1px solid #ddd6fe;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }
  .oa-pa-grid-actions { display: flex; align-items: center; gap: 8px; }
  .oa-pa-grid-search {
    width: 210px;
    max-width: 60vw;
    padding: 6px 10px;
    font-size: 12.5px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    direction: rtl;
    text-align: right;
    font-family: inherit;
    color: #0f172a;
    background: #ffffff;
  }
  .oa-pa-grid-search:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.14);
  }
  .oa-pa-grid-refresh {
    padding: 6px 14px;
    font-size: 12.5px;
    font-weight: 600;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #ffffff;
    color: #334155;
    cursor: pointer;
    font-family: inherit;
  }
  .oa-pa-grid-refresh:hover { background: #f1f5f9; }

  .oa-pa-grid-tablewrap { overflow-x: auto; }
  .oa-pa-grid table.oa-pa-grid-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  .oa-pa-grid-table th {
    text-align: right;
    padding: 8px 12px;
    white-space: nowrap;
    background: linear-gradient(180deg, #f2f6fa 0%, #e6ecf3 100%);
    color: #33475c;
    border-bottom: 2px solid #d3dce6;
    font-weight: 700;
  }
  .oa-pa-grid-table td {
    padding: 8px 12px;
    border-bottom: 1px solid #edf1f5;
    vertical-align: top;
    color: #1f2937;
  }
  .oa-pa-grid-table tbody tr:nth-child(even) { background: #f8fafc; }
  .oa-pa-grid-table tbody tr:hover { background: #eef4fb; }
  .oa-pa-td-row { color: #64748b; white-space: nowrap; }
  .oa-pa-task-title { font-weight: 600; color: #0f172a; }
  /* Rows open the «انجام کار» dialog on double-click → pointer cursor. */
  .oa-pa-grid-table tbody tr { cursor: pointer; }
  .oa-pa-grid-table tbody tr.oa-pa-row-selected { background: #e4e1f7 !important; }
  .oa-pa-grid-table tbody tr:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px rgba(124, 58, 237, 0.35);
  }
  .oa-pa-grid-hint {
    flex-basis: 100%;
    font-size: 11px;
    color: #94a3b8;
  }
  .oa-pa-badge-status {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
    white-space: nowrap;
  }
  .oa-pa-badge-self {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    background: #e0f2fe;
    color: #075985;
    border: 1px solid #bae6fd;
    margin-inline-start: 5px;
    white-space: nowrap;
  }

  .oa-pa-grid-pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 14px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .oa-pa-pager-info,
  .oa-pa-pager-page { font-size: 11.5px; color: #64748b; }
  .oa-pa-pager-btns { display: flex; gap: 6px; }
  .oa-pa-pager-prev,
  .oa-pa-pager-next {
    padding: 4px 14px;
    font-size: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #ffffff;
    color: #334155;
    cursor: pointer;
    font-family: inherit;
  }
  .oa-pa-pager-prev:hover:not(:disabled),
  .oa-pa-pager-next:hover:not(:disabled) { background: #f1f5f9; }
  .oa-pa-pager-prev:disabled,
  .oa-pa-pager-next:disabled { opacity: 0.5; cursor: default; }

  /* Grid message area: loading / empty / error / session-expired */
  .oa-pa-grid-message {
    padding: 28px 16px;
    text-align: center;
    color: #475569;
    font-size: 13px;
    line-height: 2;
  }
  .oa-pa-grid-message.oa-pa-msg-error { color: #b91c1c; }
  .oa-pa-grid-message .oa-pa-msg-actions { margin-top: 10px; }
  .oa-pa-msg-btn {
    padding: 6px 18px;
    font-size: 12.5px;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
    color: #ffffff;
    cursor: pointer;
    font-family: inherit;
  }
  .oa-pa-msg-btn:hover { filter: brightness(1.1); }
  .oa-pa-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    vertical-align: -4px;
    border: 2px solid #cbd5e1;
    border-top-color: #7c3aed;
    border-radius: 50%;
    margin-inline-end: 8px;
    animation: oa-pa-spin 0.8s linear infinite;
  }
  @keyframes oa-pa-spin { to { transform: rotate(360deg); } }

  /* ===== «انجام کار» task dialog (double-click a grid row) ===== */
  #${IDS.taskOverlay} {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    direction: rtl;
    font-family: "Iran Sans Web", Tahoma, "Segoe UI", FreeSerif, Arial, sans-serif;
  }
  #${IDS.taskDialog} {
    width: 680px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 24px 60px rgba(2, 6, 23, 0.4);
    overflow: hidden;
    text-align: right;
    color: #1e293b;
  }
  #${IDS.taskDialog} * { box-sizing: border-box; }
  .oa-pa-task-body { padding: 14px 18px 6px; overflow-y: auto; }
  .oa-pa-task-subtitle {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 8px;
    line-height: 1.7;
  }
  .oa-pa-task-meta { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 4px; }
  .oa-pa-meta-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    font-size: 11px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    color: #334155;
    white-space: nowrap;
  }
  .oa-pa-meta-chip b { font-weight: 700; color: #475569; }
  .oa-pa-task-desc {
    margin: 8px 0 4px;
    font-size: 12px;
    color: #64748b;
    line-height: 1.9;
  }
  .oa-pa-dialog-note {
    margin: 4px 0 10px;
    padding: 10px 12px;
    font-size: 12px;
    color: #075985;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    line-height: 1.9;
  }
  .oa-pa-field-row { margin: 10px 0 4px; }
  .oa-pa-field-label-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 5px;
  }
  .oa-pa-field-label { font-size: 12.5px; font-weight: 600; color: #334155; }
  .oa-pa-req { color: #dc2626; font-weight: 700; }
  .oa-pa-ro-chip {
    font-size: 10px;
    padding: 1px 8px;
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
  }
  .oa-pa-textarea { resize: vertical; font-family: inherit; }
  select.oa-pa-input { direction: rtl; text-align: right; font-family: inherit; }
  .oa-pa-input:disabled,
  .oa-pa-input-readonly { background: #f1f5f9; color: #475569; cursor: not-allowed; }
  .oa-pa-options { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 4px 2px; }
  .oa-pa-opt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: #334155;
    cursor: pointer;
    padding: 4px 2px;
  }
  .oa-pa-opt input { cursor: pointer; accent-color: #7c3aed; }
  .oa-pa-checkbox { width: 17px; height: 17px; cursor: pointer; accent-color: #7c3aed; }
  .oa-pa-unsupported-note { font-size: 10.5px; color: #b45309; margin-top: 3px; }
  .oa-pa-claim-note {
    margin: 0 0 12px;
    padding: 10px 12px;
    font-size: 12px;
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 8px;
    line-height: 1.9;
  }
  .oa-pa-claim-done {
    margin: 0 0 12px;
    padding: 10px 12px;
    font-size: 12px;
    color: #065f46;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 8px;
    line-height: 1.9;
  }
  .oa-pa-btn-claim {
    margin-top: 8px;
    padding: 8px 20px;
    font-size: 12.5px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(217, 119, 6, 0.35);
    cursor: pointer;
    font-family: inherit;
    transition: filter 0.15s ease, transform 0.15s ease;
  }
  .oa-pa-btn-claim:hover { filter: brightness(1.08); }
  .oa-pa-btn-claim:active { transform: scale(0.97); }
  .oa-pa-btn-claim:disabled { opacity: 0.65; cursor: default; }

  /* ===== v1.7 — «file» form fields ===== */
  .oa-pa-file-input {
    direction: rtl;
    text-align: right;
    font-family: inherit;
    cursor: pointer;
  }
  .oa-pa-file-input::file-selector-button {
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    margin-inline-end: 10px;
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
    color: #ffffff;
    cursor: pointer;
  }
  .oa-pa-file-input:disabled { cursor: not-allowed; }
  .oa-pa-file-hint {
    margin-top: 4px;
    font-size: 10.5px;
    color: #94a3b8;
  }
  .oa-pa-file-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 7px;
  }
  .oa-pa-file-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 4px 6px 4px 10px;
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
    border-radius: 8px;
    font-size: 11.5px;
    color: #5b21b6;
    direction: rtl;
    max-width: 100%;
  }
  .oa-pa-file-chip-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }
  .oa-pa-file-chip-size { color: #7c3aed; font-size: 10.5px; white-space: nowrap; }
  .oa-pa-file-chip-remove {
    flex: none;
    width: 18px;
    height: 18px;
    line-height: 1;
    border: none;
    border-radius: 50%;
    background: #ede9fe;
    color: #5b21b6;
    font-size: 13px;
    cursor: pointer;
    padding: 0;
  }
  .oa-pa-file-chip-remove:hover { background: #ddd6fe; }
  .oa-pa-file-links { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 2px; }
  .oa-pa-file-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    font-size: 12px;
    color: #075985;
    cursor: pointer;
    font-family: inherit;
    direction: rtl;
    transition: filter 0.15s ease;
  }
  .oa-pa-file-link:hover { filter: brightness(0.96); background: #e0f2fe; }
  .oa-pa-file-link-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 260px;
  }
  .oa-pa-file-link-size { font-size: 10.5px; color: #0284c7; white-space: nowrap; }
  .oa-pa-file-none { font-size: 11.5px; color: #94a3b8; }

  /* ===== v1.7 — collapsible sections («سوابق کارتابل» / «پیوست‌های پرونده») ===== */
  .oa-pa-section {
    margin: 14px 0 6px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    background: #ffffff;
  }
  .oa-pa-section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 12px;
    border: none;
    background: #f8fafc;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    color: #334155;
    cursor: pointer;
    text-align: right;
  }
  .oa-pa-section-head:hover { background: #f1f5f9; }
  .oa-pa-section-chevron {
    display: inline-block;
    font-size: 15px;
    line-height: 1;
    color: #7c3aed;
    transition: transform 0.18s ease;
  }
  .oa-pa-section.oa-pa-section-open .oa-pa-section-chevron {
    transform: rotate(-90deg);
  }
  .oa-pa-section-body { display: none; padding: 4px 12px 12px; }
  .oa-pa-section.oa-pa-section-open .oa-pa-section-body { display: block; }

  /* ===== v1.7 — steps timeline table (سوابق کارتابل) ===== */
  table.oa-pa-steps-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
    margin-top: 6px;
  }
  .oa-pa-steps-table th {
    text-align: right;
    padding: 6px 9px;
    white-space: nowrap;
    background: #f2f6fa;
    color: #33475c;
    border-bottom: 1px solid #d3dce6;
    font-weight: 700;
  }
  .oa-pa-steps-table td {
    padding: 6px 9px;
    border-bottom: 1px solid #edf1f5;
    vertical-align: top;
    color: #1f2937;
  }
  .oa-pa-steps-table tr:last-child td { border-bottom: none; }
  .oa-pa-step-name { font-weight: 600; color: #0f172a; }
  .oa-pa-step-pill {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
    white-space: nowrap;
  }
  .oa-pa-step-pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .oa-pa-step-completed { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
  .oa-pa-step-muted { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

  /* ===== v1.7 — cases grid extras ===== */
  .oa-pa-case-badge {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .oa-pa-case-running { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .oa-pa-case-completed { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
  .oa-pa-case-failed { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
  .oa-pa-case-terminated { background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; }
  .oa-pa-steps-chip {
    display: inline-block;
    padding: 2px 9px;
    background: #ede9fe;
    color: #5b21b6;
    border: 1px solid #ddd6fe;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .oa-pa-steps-current {
    margin-top: 3px;
    font-size: 11px;
    color: #475569;
  }
  .oa-pa-steps-current b { color: #0f172a; font-weight: 700; }
  .oa-pa-grid-table tr.oa-pa-case-row { cursor: pointer; }
  .oa-pa-grid-table tr.oa-pa-row-expanded {
    background: #e4e1f7 !important;
    box-shadow: inset 0 0 0 2px rgba(124, 58, 237, 0.25);
  }
  .oa-pa-grid-table tr.oa-pa-case-detail { cursor: default; }
  .oa-pa-grid-table tr.oa-pa-case-detail:hover { background: #ffffff !important; }
  .oa-pa-grid-table tr.oa-pa-case-detail > td { padding: 10px 14px; background: #fbfafe; }
  .oa-pa-case-steps {
    border: 1px solid #eef0f4;
    border-radius: 8px;
    padding: 8px 10px;
    background: #ffffff;
  }
  .oa-pa-case-steps-title {
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 2px;
  }
  .oa-pa-case-attachments {
    border: 1px solid #eef0f4;
    border-radius: 8px;
    padding: 8px 10px;
    background: #ffffff;
    margin-top: 9px;
  }
  .oa-pa-case-empty { font-size: 11.5px; color: #94a3b8; padding: 4px 2px; }

  /* ===== v1.7 — attachment rows (dialog + case expansion) ===== */
  .oa-pa-attachment-list { display: flex; flex-direction: column; gap: 6px; }
  .oa-pa-attachment-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 10px;
    padding: 6px 9px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    direction: rtl;
  }
  .oa-pa-attachment-name {
    border: none;
    background: transparent;
    padding: 2px 6px;
    margin-inline-end: 2px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    color: #075985;
    cursor: pointer;
    border-radius: 6px;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .oa-pa-attachment-name:hover { background: #e0f2fe; text-decoration: underline; }
  .oa-pa-attachment-meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
  }
  .oa-pa-attachment-dot { color: #cbd5e1; }

  /* ===== v1.8 — «جریان کار جدید» start dialog ===== */
  #${IDS.startOverlay} {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    direction: rtl;
    font-family: "Iran Sans Web", Tahoma, "Segoe UI", FreeSerif, Arial, sans-serif;
  }
  #${IDS.startDialog} {
    width: 600px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 24px 60px rgba(2, 6, 23, 0.4);
    overflow: hidden;
    text-align: right;
    color: #1e293b;
  }
  #${IDS.startDialog} * { box-sizing: border-box; }
  #${IDS.startDialog} .oa-pa-task-body {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding-bottom: 12px;
  }
  #${IDS.startDialog} .oa-pa-grid-search { width: 100%; margin-bottom: 10px; }
  .oa-pa-start-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-top: 4px;
  }
  .oa-pa-start-list.oa-pa-hidden { display: none !important; }
  .oa-pa-start-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #ffffff;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .oa-pa-start-row:hover { background: #f8fafc; border-color: #cbd5e1; }
  .oa-pa-start-row:focus {
    outline: none;
    border-color: #7c3aed;
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.16);
  }
  .oa-pa-start-row.oa-pa-start-selected {
    background: #f5f3ff;
    border-color: #7c3aed;
    box-shadow: inset 0 0 0 1px rgba(124, 58, 237, 0.35);
  }
  .oa-pa-start-row-main { min-width: 0; flex: 1; }
  .oa-pa-start-row-name {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }
  .oa-pa-start-row-desc {
    font-size: 11.5px;
    color: #64748b;
    line-height: 1.8;
    margin-top: 1px;
    overflow-wrap: anywhere;
  }
  .oa-pa-start-row-side { flex: none; }

  /* ===== v1.9 — draft form dialog (same chrome as «انجام کار») =====
     Without these rules the overlay is a bare <div> dropped into <body>
     and flows into the OA host layout (host-index.html). */
  #${IDS.draftOverlay} {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    direction: rtl;
    font-family: "Iran Sans Web", Tahoma, "Segoe UI", FreeSerif, Arial, sans-serif;
  }
  #${IDS.draftOverlay}.oa-pa-hidden { display: none !important; }
  #${IDS.draftDialog} {
    width: 680px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 24px 60px rgba(2, 6, 23, 0.4);
    overflow: hidden;
    text-align: right;
    color: #1e293b;
  }
  #${IDS.draftDialog} * { box-sizing: border-box; }
  #${IDS.draftDialog} .oa-pa-task-body {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding-bottom: 12px;
  }
  .oa-pa-meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 6px 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .oa-pa-meta-label {
    font-size: 10.5px;
    color: #64748b;
  }
  .oa-pa-meta-value {
    font-size: 12.5px;
    font-weight: 600;
    color: #0f172a;
    overflow-wrap: anywhere;
  }
`;

/** Inject the stylesheet once (idempotent). */
export function ensureStyles() {
  if (document.getElementById(IDS.style)) return;
  const style = document.createElement('style');
  style.id = IDS.style;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
}
