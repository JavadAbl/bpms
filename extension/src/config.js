/**
 * config.js — all constants in one place.
 * ----------------------------------------
 * Target pages, API settings, element IDs, storage keys, the icon SVG and
 * every user-visible (Persian) string. This is the file to edit for
 * customization.
 */

export const VERSION = '1.9.2';

// The exact pages this extension activates on. The same page is served
// from both domains — add more hosts here (and in manifest.json matches)
// if needed.
export const TARGET = {
  hosts: ['oa.atie-sazan.ir', 'oa.dayins.com'],
  path: '/OA/workspace/itemlist',
  queryKey: 'objectListMode',
  queryValue: 'Current',
};

// The BPMS backend is a SEPARATE service from the OA host site (NestJS,
// APP_PORT=3001 in its .env). Point baseUrl at wherever the BPMS API is
// actually deployed. Cross-origin calls from the content script also need
// the origin listed in manifest.json → "host_permissions".
export const API = {
  baseUrl: 'http://localhost:3001',
  loginPath: '/api/auth/login',
  // "List the RECEIVED (PENDING) tasks of the current user" — the BPMS
  // کارتابل (process-tasks inbox) shown by the «جریان کار» sidebar item.
  tasksMinePath: '/api/tasks/mine',
  // Base for the task actions used by the «انجام کار» dialog (v1.6):
  //   GET  /api/tasks/:id          — detail incl. form.fields +
  //                                   instanceVariables (read-only prefill)
  //   POST /api/tasks/:id/complete — submit the filled form; the BPMN engine
  //                                   advances the flow to the next user
  //   POST /api/tasks/:id/claim    — required before completing self-service
  //                                   position tasks
  tasksPath: '/api/tasks',
  // ----- files (v1.7 — file attachments) -----
  //   POST /api/files                 (multipart field "file") → FileMetaDto
  //                                    {id, name, size, mimeType}; the meta
  //                                    array is stored in the form value and
  //                                    stamped with taskId/instanceId when the
  //                                    owning task completes
  //   GET  /api/files/by-instance/:id  → FileDto[] (with uploader info)
  //   GET  /api/files/:id              → authenticated download
  filesPath: '/api/files',
  // 10 MB per file — mirror of the backend MAX_FILE_SIZE (PayloadTooLarge
  // 413 otherwise); checked client-side first for a friendlier message.
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxFileSizeMb: 10,
  // ----- process-instances (v1.7 — سوابق کارتابل, v1.8 — start case) -----
  //   GET  /api/process-instances/cases → the user's cases (موارد): every
  //                                       instance they participate in, any
  //                                       status, each with its task timeline
  //   GET  /api/process-instances/:id   → one instance (participant-gated)
  //                                       with the rich task timeline
  //   POST /api/process-instances       → legacy immediate start (kept for
  //                                       compatibility; the UI now uses drafts)
  casesPath: '/api/process-instances/cases',
  caseDetailPath: '/api/process-instances',
  instancesPath: '/api/process-instances',
  // ----- process drafts (v1.9 — draft-first start) -----
  //   GET    /api/process-drafts
  //   POST   /api/process-drafts           { processId }
  //   GET    /api/process-drafts/:id
  //   PATCH  /api/process-drafts/:id       { data }
  //   POST   /api/process-drafts/:id/submit { data? }
  //   DELETE /api/process-drafts/:id
  draftsPath: '/api/process-drafts',
  draftsPageSize: 10,
  draftsSortBy: 'updatedAt',
  draftsSortOrder: 'desc',
  // ----- process definitions (v1.8 — the start dialog lists ACTIVE ones) --
  //   GET /api/processes → GetManyReply<ProcessDto> (paged, any user)
  processesPath: '/api/processes',
  casesPageSize: 10,
  casesSortBy: 'startedAt',
  casesSortOrder: 'desc',
  timeoutMs: 20000,
  tasksPageSize: 10,
  tasksSortBy: 'createdAt',
  tasksSortOrder: 'desc',
};

// sessionStorage key holding the login response
// ({ accessToken, userId, username, email, name, role }) for future API calls.
export const AUTH_SESSION_KEY = 'oaProcessActivationAuth';

// chrome.storage.local key remembering just the last username (for prefill).
export const REMEMBERED_USERNAME_KEY = 'oaProcessActivationLastUsername';
/** @deprecated removed after username login; kept for one-time migration/cleanup */
export const REMEMBERED_EMAIL_KEY = 'oaProcessActivationLastEmail';

// Obsolete key from v1.3 — credentials are no longer stored; cleaned up once.
export const LEGACY_CREDENTIALS_KEY = 'oaProcessActivationCredentials';

// Permissive username format check (the API owns the final validation).
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,}$/;

// Unique element IDs, prefixed so they never clash with the OA page's own
// elements.
export const IDS = {
  section: 'oa-pa-header-section',
  button: 'oa-pa-header-btn',
  overlay: 'oa-pa-overlay',
  modal: 'oa-pa-modal',
  style: 'oa-pa-styles',
  // «کارتابل» sidebar item — desktop <dt> + mobile <div> twins.
  sidebarItem: 'oa-pa-sidebar-item',
  sidebarItemMobile: 'oa-pa-sidebar-item-mobile',
  // «سوابق کارتابل» sidebar item (v1.7) — same twins.
  sidebarCasesItem: 'oa-pa-sidebar-cases-item',
  sidebarCasesItemMobile: 'oa-pa-sidebar-cases-item-mobile',
  // «پیش‌نویس» sidebar item (v1.9)
  sidebarDraftsItem: 'oa-pa-sidebar-drafts-item',
  sidebarDraftsItemMobile: 'oa-pa-sidebar-drafts-item-mobile',
  // Section divider between host OA items and BPMS items.
  sidebarSection: 'oa-pa-sidebar-section',
  sidebarSectionMobile: 'oa-pa-sidebar-section-mobile',
  // «جریان کار جدید» header button (v1.8) — starts a new case; visible
  // only while a login session exists.
  startSection: 'oa-pa-header-start-section',
  startButton: 'oa-pa-header-start-btn',
  // The tasks grid rendered inside #bodyContainer (like host «جاری»).
  grid: 'oa-pa-tasks-grid',
  // The سوابق کارتابل cases grid rendered inside #bodyContainer (v1.7).
  casesGrid: 'oa-pa-cases-grid',
  // The پیش‌نویس‌ها drafts grid (v1.9).
  draftsGrid: 'oa-pa-drafts-grid',
  // «انجام کار» dialog — opened by double-clicking a grid row.
  taskOverlay: 'oa-pa-task-overlay',
  taskDialog: 'oa-pa-task-dialog',
  // «شروع پرونده جدید» dialog (v1.8) — opened from the third sidebar item.
  startOverlay: 'oa-pa-start-overlay',
  startDialog: 'oa-pa-start-dialog',
  // Draft form dialog (v1.9) — fill/save/submit a process draft.
  draftOverlay: 'oa-pa-draft-overlay',
  draftDialog: 'oa-pa-draft-dialog',
};

export const BOLT_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">' +
  '<path d="M7 2v11h3v9l7-12h-4l4-8H7z"/></svg>';

/* All visible strings (Persian / RTL). */
export const TEXT = {
  buttonLabel: 'فعال سازی فرآیند',
  buttonTitle: 'فعال سازی فرآیند — ورود به سرویس فرآیند',
  buttonLogoutLabel: 'خروج',
  buttonLogoutTitle: 'خروج از سرویس فرآیند',
  buttonTitleSession: (name, username) =>
    'خروج — نشست فعال: ' + name + ' (' + username + ')',
  modalTitle: 'فعال سازی فرآیند',
  hint: 'برای فعال‌سازی فرآیند، نام کاربری و رمز عبور خود را وارد کنید. پس از ورود، اطلاعات نشست به‌صورت موقت در همین برگه ذخیره می‌شود و در فراخوانی‌های آتی سرویس استفاده خواهد شد.',
  activeSession: (name, username) => 'نشست فعال: ' + name + ' — ' + username,
  usernameLabel: 'نام کاربری',
  passwordLabel: 'رمز عبور',
  usernamePh: 'مثلاً admin',
  passwordPh: 'رمز عبور خود را وارد کنید',
  errorRequired: 'وارد کردن نام کاربری و رمز عبور الزامی است.',
  errorUsernameFormat: 'نام کاربری فقط می‌تواند شامل حروف، اعداد، نقطه، خط‌زیر و خط تیره باشد.',
  errorInvalidCredentials: 'نام کاربری یا رمز عبور نادرست است.',
  errorNetwork: 'خطا در ارتباط با سرور — لطفاً اتصال شبکه را بررسی کنید.',
  errorUnexpected: (code) =>
    'خطای غیرمنتظره از سرور' + (code ? ' (کد ' + code + ')' : '') + '.',
  loginPending: 'در حال ورود…',
  save: 'ورود',
  cancel: 'انصراف',
  success: 'ورود با موفقیت انجام شد ✓',
  storageNote: 'اطلاعات نشست فقط به‌صورت موقت در همین برگه ذخیره می‌شود.',
  closeAria: 'بستن',

  /* Sidebar section + items (order: کارتابل → پیش‌نویس → سوابق کارتابل) */
  sidebarSectionTitle: 'جریان کار',
  sidebarLabel: 'کارتابل',
  sidebarTitle: 'کارتابل — کارهای در انتظار اقدام شما',
  badgeTitle: (n) => 'تعداد کارهای در انتظار اقدام شما: ' + n,

  /* Tasks grid (rendered like the host «جاری» grid) */
  gridTitle: 'کارتابل',
  gridSubtitle: 'کارهای در انتظار اقدام شما',
  gridCount: (n) => n + ' کار',
  colRow: 'ردیف',
  colTitle: 'عنوان کار',
  colProcess: 'فرآیند',
  colForm: 'فرم',
  colAssignment: 'تخصیص',
  colStatus: 'وضعیت',
  colDate: 'تاریخ ایجاد',
  statusPending: 'در انتظار اقدام',
  assignDirect: 'مستقیم',
  assignPosition: 'سمتی',
  selfService: 'خودخدمتی',
  dash: '—',
  searchPh: 'جستجو در کارها…',
  refresh: 'به‌روزرسانی',
  loading: 'در حال دریافت کارها…',
  empty: 'کاری در کارتابل شما وجود ندارد.',
  errorLoad: 'خطا در دریافت کارها از سرور.',
  retry: 'تلاش دوباره',
  sessionExpired: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
  loginAgain: 'ورود دوباره',
  pagerPrev: 'قبلی',
  pagerNext: 'بعدی',
  pagerInfo: (from, to, total) =>
    'نمایش ' + from + ' تا ' + to + ' از ' + total + ' کار',
  pagerPage: (page, pages) => 'صفحهٔ ' + page + ' از ' + pages,

  /* Task dialog («انجام کار») — double-click a grid row */
  dblClickHint: 'برای باز کردن کار و تکمیل فرم، دو بار کلیک کنید',
  taskDialogTitle: 'انجام کار',
  taskDialogHint:
    'فرم زیر را تکمیل کنید؛ با ارسال، کار برای گام بعدی فرآیند (کاربر بعدی) ثبت می‌شود.',
  taskLoading: 'در حال دریافت اطلاعات کار…',
  taskErrorLoad: 'خطا در دریافت اطلاعات کار از سرور.',
  taskErrorSubmit: 'خطا در ارسال کار به سرور.',
  taskConflict:
    'این کار دیگر قابل انجام نیست — احتمالاً پیش‌تر انجام شده یا توسط کاربر دیگری در اختیار گرفته شده است.',
  taskSuccess: 'کار با موفقیت ثبت شد و برای گام بعدی فرآیند ارسال شد ✓',
  taskSubmit: 'ارسال برای ادامه فرآیند',
  taskSubmitPending: 'در حال ارسال…',
  taskNoForm: 'این کار فرم ندارد؛ با ثبت، کار مستقیماً برای ادامه فرآیند ارسال می‌شود.',
  taskClaimNote: 'این کار «خودخدمتی» است؛ برای انجام آن ابتدا باید در اختیار شما قرار گیرد.',
  taskClaimBtn: 'در اختیار گرفتن کار',
  taskClaimPending: 'در حال اختیار گرفتن…',
  taskClaimDone: 'کار در اختیار شما قرار گرفت — اکنون قابل انجام است ✓',
  readOnlyChip: 'از گام‌های قبلی',
  unsupportedField: 'این نوع فیلد در این نسخه پشتیبانی نمی‌شود.',
  errorFieldRequired: (label) => 'تکمیل «' + label + '» الزامی است.',
  selectPlaceholder: '— انتخاب کنید —',
  metaProcess: 'فرآیند',
  metaForm: 'فرم',
  metaAssignment: 'تخصیص',
  metaDate: 'تاریخ ایجاد',

  /* ===== v1.7 — file attachments (form «file» fields) ===== */
  fileFieldAdd: 'افزودن پیوست…',
  fileFieldMultipleHint: (mb) =>
    'می‌توانید چند فایل انتخاب کنید — حداکثر ' + mb + ' مگابایت برای هر فایل.',
  fileFieldNone: 'فایلی پیوست نشده است.',
  fileFieldRequired: (label) =>
    'پیوست حداقل یک فایل برای «' + label + '» الزامی است.',
  fileFieldTooLarge: (name, mb) =>
    'حجم فایل «' + name + '» بیشتر از حد مجاز (' + mb + ' مگابایت) است.',
  fileUploadPending: 'در حال بارگذاری پیوست‌ها…',
  fileUploadError: 'خطا در بارگذاری پیوست — لطفاً دوباره تلاش کنید.',
  fileDownloadError: 'خطا در دانلود پیوست.',
  fileRemove: 'حذف',
  fileDownload: 'دانلود',

  /* ===== v1.7 — «سوابق کارتابل» sections inside the task dialog ===== */
  historySectionTitle: 'سوابق کارتابل',
  historySectionHint: 'روند گام‌های این پرونده از ابتدا تاکنون',
  attachmentsSectionTitle: 'پیوست‌های پرونده',
  attachmentsSectionHint: 'فایل‌های پیوست‌شده در گام‌های این پرونده',
  attachmentsLoading: 'در حال دریافت پیوست‌ها…',
  attachmentsEmpty: 'پیوستی برای این پرونده ثبت نشده است.',
  attachmentsErrorLoad: 'خطا در دریافت پیوست‌ها.',
  attachmentUploadedBy: (name) => 'بارگذاری توسط ' + name,

  /* ===== v1.7 — «سوابق کارتابل» sidebar item + cases grid ===== */
  sidebarCasesLabel: 'سوابق کارتابل',
  sidebarCasesTitle: 'سوابق کارتابل — پرونده‌های فرآیندی شما',
  casesGridTitle: 'سوابق کارتابل',
  casesGridSubtitle: 'پرونده‌های فرآیندی که شما در آن‌ها نقش دارید',
  casesGridCount: (n) => n + ' پرونده',
  casesColRow: 'ردیف',
  casesColProcess: 'فرآیند',
  casesColStarter: 'شروع‌کننده',
  casesColStatus: 'وضعیت',
  casesColStartedAt: 'تاریخ شروع',
  casesColSteps: 'روند گام‌ها',
  caseRunning: 'در حال اجرا',
  caseCompleted: 'تکمیل شده',
  caseFailed: 'ناموفق',
  caseTerminated: 'خاتمه یافته',
  casesExpandHint:
    'برای مشاهده روند گام‌ها و پیوست‌های هر پرونده، روی ردیف آن کلیک کنید',
  casesLoading: 'در حال دریافت پرونده‌ها…',
  casesEmpty: 'پرونده‌ای یافت نشد.',
  casesErrorLoad: 'خطا در دریافت پرونده‌ها از سرور.',
  stepsSummary: (total, done) =>
    total + ' گام — ' + done + ' انجام‌شده',
  stepsCurrentPrefix: 'گام جاری: ',
  stepsColStep: 'گام',
  stepsColAssignee: 'مسئول',
  stepsColForm: 'فرم',
  stepsColStatus: 'وضعیت',
  stepsColCreatedAt: 'تاریخ ایجاد',
  stepsColCompletedAt: 'تاریخ انجام',
  stepsEmpty: 'گامی برای این پرونده ثبت نشده است.',
  stepPending: 'در انتظار اقدام',
  stepCompleted: 'انجام شد',
  stepCancelled: 'لغو شد',
  stepSkipped: 'رد شد',

  /* ===== v1.8 — «جریان کار جدید» sidebar item + start dialog ===== */
  sidebarStartLabel: 'جریان کار جدید',
  sidebarStartTitle: 'جریان کار جدید — شروع پرونده فرآیندی',
  startDialogTitle: 'شروع پرونده جدید',
  startDialogHint:
    'فرآیند مورد نظر را انتخاب کنید؛ یک پیش‌نویس ساخته می‌شود و فرم شروع برای تکمیل باز می‌شود. فرآیند پس از ارسال فرم شروع می‌شود.',
  startSearchPh: 'جستجوی فرآیند…',
  startLoading: 'در حال دریافت فرآیندها…',
  startEmpty: 'فرآیند فعالی برای شروع وجود ندارد.',
  startNoResult: 'فرآیندی با این عبارت یافت نشد.',
  startErrorLoad: 'خطا در دریافت فرآیندها از سرور.',
  startBtn: 'ادامه و تکمیل فرم',
  startPending: 'در حال ایجاد پیش‌نویس…',
  startVersion: (v) => 'نسخه ' + v,
  startSuccess: (name) =>
    'پیش‌نویس «' + name + '» ایجاد شد — فرم را تکمیل و ارسال کنید ✓',
  startErrorNotActive:
    'این فرآیند فعال نیست — امکان شروع پرونده وجود ندارد.',
  startErrorForbidden:
    'شروع این فرآیند برای شما مجاز نیست — به کاربران مشخصی محدود شده است.',
  startErrorUnexpected: (code) =>
    'خطای غیرمنتظره از سرور' + (code ? ' (کد ' + code + ')' : '') + '.',

  /* ===== v1.9 — پیش‌نویس (avoid colliding with host OA «پیش نویس ها») ===== */
  sidebarDraftsLabel: 'پیش‌نویس',
  sidebarDraftsTitle: 'پیش‌نویس — فرم‌های شروع ذخیره‌شده',
  draftsGridTitle: 'پیش‌نویس',
  draftsGridSubtitle: 'فرم‌های شروع که هنوز ارسال نشده‌اند',
  draftsGridCount: (n) => n + ' پیش‌نویس',
  draftsColRow: 'ردیف',
  draftsColProcess: 'فرآیند',
  draftsColTask: 'گام شروع',
  draftsColUpdated: 'آخرین ویرایش',
  draftsLoading: 'در حال دریافت پیش‌نویس‌ها…',
  draftsEmpty: 'پیش‌نویسی یافت نشد.',
  draftsErrorLoad: 'خطا در دریافت پیش‌نویس‌ها از سرور.',
  draftsSearchPh: 'جستجو در پیش‌نویس‌ها…',
  draftsOpenHint: 'برای تکمیل و ارسال فرم، دو بار کلیک کنید',
  draftDialogTitle: 'تکمیل پیش‌نویس فرآیند',
  draftDialogHint:
    'فرم را تکمیل کنید؛ با ارسال، فرآیند شروع می‌شود. می‌توانید پیش‌نویس را ذخیره کرده و بعداً ادامه دهید.',
  draftLoading: 'در حال دریافت پیش‌نویس…',
  draftErrorLoad: 'خطا در دریافت پیش‌نویس از سرور.',
  draftSave: 'ذخیره پیش‌نویس',
  draftSavePending: 'در حال ذخیره…',
  draftSaveSuccess: 'پیش‌نویس ذخیره شد ✓',
  draftSubmit: 'ارسال و شروع فرآیند',
  draftSubmitPending: 'در حال ارسال…',
  draftSubmitSuccess: 'فرآیند با موفقیت شروع شد ✓',
  draftDiscard: 'حذف پیش‌نویس',
  draftDiscardConfirm: 'آیا از حذف این پیش‌نویس مطمئن هستید؟',
  draftNoForm:
    'این مرحله فرمی ندارد؛ با ارسال، فرآیند مستقیماً شروع می‌شود.',
  draftErrorSubmit: 'خطا در ارسال پیش‌نویس به سرور.',
  draftErrorSave: 'خطا در ذخیره پیش‌نویس.',
};
