/**
 * Persian translations for the BPMS UI
 */
export const t = {
  // App
  appName: 'سامانه مدیریت فرآیندها',
  appShort: 'BPMS',
  
  // Navigation
  myTasks: 'کارتابل',
  drafts: 'پیش‌نویس‌ها',
  draftDetail: 'جزئیات پیش‌نویس',
  noDrafts: 'پیش‌نویسی یافت نشد',
  saveDraft: 'ذخیره پیش‌نویس',
  submitDraft: 'ارسال و شروع',
  discardDraft: 'حذف پیش‌نویس',
  draftSaved: 'پیش‌نویس ذخیره شد',
  draftSubmitted: 'فرآیند با موفقیت شروع شد',
  draftDiscarded: 'پیش‌نویس حذف شد',
  draftFormHint: 'فرم را تکمیل کنید؛ فرآیند پس از ارسال شروع می‌شود.',
  myCases: 'پرونده‌های من',
  instances: 'گزارش فرآیندها',
  processes: 'تعریف فرآیندها',
  departments: 'دپارتمان‌ها',
  users: 'کاربران',
  
  // Login
  login: 'ورود',
  logout: 'خروج',
  username: 'نام کاربری',
  email: 'ایمیل',
  password: 'رمز عبور',
  loginTitle: 'ورود به سامانه',
  loginSubtitle: 'برای ادامه وارد شوید',
  loginError: 'نام کاربری یا رمز عبور اشتباه است',
  
  // Tasks
  taskName: 'عنوان وظیفه',
  processName: 'فرآیند',
  status: 'وضعیت',
  assignee: 'مسئول',
  position: 'موقعیت',
  createdAt: 'تاریخ ایجاد',
  completedAt: 'تاریخ تکمیل',
  view: 'مشاهده',
  claim: 'ادعا',
  release: 'رها کردن',
  complete: 'تکمیل',
  noTasks: 'وظیفه‌ای یافت نشد',
  selfService: 'خودخدمت',
  
  // Task statuses
  PENDING: 'در انتظار',
  COMPLETED: 'تکمیل شده',
  CANCELLED: 'لغو شده',
  SKIPPED: 'نادیده گرفته شده',
  
  // Instance statuses
  RUNNING: 'در حال اجرا',
  FAILED: 'خطا',
  TERMINATED: 'خاتمه یافته',
  
  // Process
  startInstance: 'شروع نمونه',
  startProcess: 'شروع فرآیند',
  terminate: 'خاتمه',
  version: 'نسخه',
  assignments: 'تخصیص‌ها',
  draft: 'پیش‌نویس',
  updatedAt: 'آخرین ویرایش',
  active: 'فعال',
  currentStep: 'مرحله فعلی',
  
  // Departments
  addDepartment: 'افزودن دپارتمان',
  addPosition: 'افزودن موقعیت',
  
  // Users
  userName: 'نام',
  role: 'نقش',
  addUser: 'افزودن کاربر',
  editUser: 'ویرایش کاربر',
  
  // Roles
  ADMIN: 'مدیر',
  SENIOR_EXPERT: 'کارشناس ارشد',
  USER: 'کارشناس',
  
  // Common
  save: 'ذخیره',
  cancel: 'انصراف',
  delete: 'حذف',
  edit: 'ویرایش',
  search: 'جستجو',
  loading: 'در حال بارگذاری...',
  back: 'بازگشت',
  actions: 'عملیات',
  all: 'همه',
  success: 'موفقیت',
  error: 'خطا',
  
  // Extra UI
  name: 'نام',
  startedBy: 'شروع‌کننده',
  startedAt: 'تاریخ شروع',
  assigneeUser: 'کاربر مسئول',
  noForm: 'بدون فرم',
  selectProcess: 'انتخاب فرآیند',
  noOptions: 'بدون گزینه',
  moveUp: 'بالا',
  moveDown: 'پایین',
  noProcesses: 'فرآیندی یافت نشد',
  noInstances: 'پرونده‌ای یافت نشد',
  noUsers: 'کاربری یافت نشد',
  noTasksInInstance: 'وظیفه‌ای برای این پرونده ثبت نشده است',
  timeline: 'زمان‌بندی وظایف',
  instanceInfo: 'اطلاعات پرونده',
  confirmTerminate: 'آیا از خاتمه این پرونده اطمینان دارید؟',
  updatedDate: 'تاریخ بروزرسانی',
  welcome: 'خوش آمدید',
  refresh: 'به‌روزرسانی',
  requiredField: 'این فیلد اجباری است',
  taskClaimed: 'وظیفه ادعا شد',
  taskReleased: 'وظیفه رها شد',
  taskCompleted: 'وظیفه تکمیل شد',
  unknown: 'نامشخص',

  // Categories (global reusable option lists)
  categories: 'دسته‌بندی‌ها',
  categoriesHint: 'لیست‌های گزینه قابل استفاده مجدد برای لیست‌های انتخاب فرم‌ها',
  addCategory: 'افزودن دسته‌بندی',
  editCategory: 'ویرایش دسته‌بندی',
  categoryName: 'نام دسته‌بندی',
  categoryKey: 'کلید یکتا',
  categoryKeyHint: 'شناسه یکتا (حروف انگلیسی، رقم و _)',
  categoryDesc: 'توضیحات دسته‌بندی',
  categoryItems: 'موارد (value / label)',
  addItem: 'افزودن مورد',
  noCategories: 'دسته‌بندی‌ای یافت نشد',
  categorySaved: 'دسته‌بندی ذخیره شد',
  categoryDeleted: 'دسته‌بندی حذف شد',
  confirmDeleteCategory: 'با حذف این دسته‌بندی، فرم‌هایی که از آن استفاده می‌کنند به گزینه‌های دستی خود برمی‌گردند. ادامه می‌دهید؟',
  itemCount: 'تعداد موارد',
  noItems: 'موردی ثبت نشده',

  // Select field options source
  optionsSource: 'منبع گزینه‌ها',
  sourceInline: 'گزینه‌های دستی',

  // Read-only fields (display data filled in previous tasks)
  readOnlyField: 'فقط‌خواندنی',
  readOnlyHint: 'این فیلد از داده‌های وظایف قبلی همین فرآیند پر می‌شود و قابل ویرایش نیست',
  readOnlySourceHint: 'مقدار واردشده در وظیفه قبلی',
  invalidFormTitle: 'تکمیل فرم نامعتبر است',

  // Theme (UI redesign Phase 1)
  toggleTheme: 'تغییر پوسته روشن/تاریک',
  themeLight: 'روشن',
  themeDark: 'تاریک',

  // Shell, routing & command palette (UI redesign Phase 2)
  dashboard: 'داشبورد',
  taskDetail: 'جزئیات وظیفه',
  instanceDetail: 'جزئیات پرونده',
  searchPlaceholder: 'جستجو در سامانه…',
  noResults: 'نتیجه‌ای یافت نشد',
  navigationGroup: 'ناوبری',
  myPendingTasksGroup: 'وظایف در انتظار من',
  startInstanceGroup: 'شروع پرونده جدید',
  actionsGroup: 'عملیات',
  commandPaletteTitle: 'منوی دستورات',
  commandPaletteDesc: 'دستور یا صفحه مورد نظر را جستجو کنید',
  openMenu: 'باز کردن منو',
  expandSidebar: 'نمایش منو',
  collapseSidebar: 'جمع کردن منو',
  quickActions: 'دسترسی سریع',
  quickActionsHint: 'از این‌جا شروع کنید یا از منوی کناری استفاده کنید',
  toggleThemeAction: 'تغییر پوسته',
  logoutAction: 'خروج از حساب',

  // KPI dashboard (UI redesign Phase 3)
  kpiPendingTasks: 'وظایف در انتظار من',
  kpiRunningInstances: 'پرونده‌های در حال اجرا',
  kpiActiveProcesses: 'فرآیندهای فعال',
  kpiCompleted7d: 'تکمیل‌شده در ۷ روز اخیر',
  chartCompletedTrend: 'روند تکمیل پرونده‌ها',
  chartCompletedTrendHint: '۷ روز اخیر',
  chartInstancesByStatus: 'پرونده‌ها بر اساس وضعیت',
  recentTasks: 'آخرین وظایف',
  recentInstances: 'آخرین پرونده‌ها',
  viewAll: 'مشاهده همه',
  newProcess: 'فرآیند جدید',
  noRecentTasks: 'وظیفه‌ای برای نمایش نیست',
  noRecentInstances: 'پرونده‌ای برای نمایش نیست',
  dashboardLoadError: 'بارگذاری داشبورد ناموفق بود — دوباره تلاش کنید',
  total: 'مجموع',

  // Detail views + attachments (UI redesign Phase 5)
  attachments: 'پیوست‌ها',
  attachmentsHint: 'فایل‌های بارگذاری‌شده در وظایف این پرونده',
  noAttachments: 'پیوستی برای این پرونده ثبت نشده است',
  uploadedBy: 'بارگذار',
  previousSubmissions: 'ارسال‌های قبلی',
  claimFirstHint: 'برای تکمیل این وظیفه، ابتدا آن را ادعا کنید',

  // کارتابل privacy + process report (report upgrade)
  allProcesses: 'همه فرآیندها',
  kpiAllInstances: 'کل پرونده‌ها',
  kpiEndedInstances: 'خاتمه‌یافته / ناکام',
  accessDeniedTitle: 'دسترسی غیرمجاز',
  accessDeniedTask: 'این وظیفه به شما اختصاص ندارد و در کارتابل شما قابل مشاهده نیست.',
  accessDeniedInstance: 'این پرونده متعلق به شما نیست و به آن دسترسی ندارید.',

  // Report builder (v6)
  reportBuilder: 'گزارش‌ساز',
  reportBuilderHint: 'ساخت گزارش‌های سفارشی از داده‌ها و متغیرهای هر فرآیند',
  reportName: 'نام گزارش',
  reportProcess: 'فرآیند مرتبط',
  reportColumns: 'ستون‌های گزارش',
  reportFilters: 'فیلترها (اختیاری)',
  runReport: 'گزارش‌گیری',
  exportCsv: 'خروجی CSV',
  csvExported: 'فایل CSV دانلود شد',
  deleteReport: 'حذف گزارش',
  confirmDeleteReport: 'آیا از حذف این گزارش اطمینان دارید؟',
  reportDeleted: 'گزارش حذف شد',
  noReports: 'گزارشی یافت نشد',
  reportRows: 'تعداد ردیف‌ها',
  generatedAt: 'تاریخ تولید',
  days: 'روز',
  filesCount: 'فایل',
  viewInstanceFromReport: 'مشاهده پرونده',
};

/**
 * Status → chip classes, remapped to MD3 semantic tokens (Phase 1).
 * RUNNING/ACTIVE = primary, COMPLETED = success, FAILED = destructive,
 * PENDING = warning, neutral states = muted. Token-based classes adapt
 * to both light and dark themes automatically.
 */
export const statusColors: Record<string, string> = {
  PENDING: 'bg-warning/12 text-warning border-warning/25',
  RUNNING: 'bg-primary/10 text-primary border-primary/30',
  COMPLETED: 'bg-success/12 text-success border-success/30',
  FAILED: 'bg-destructive/10 text-destructive border-destructive/30',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
  TERMINATED: 'bg-muted text-muted-foreground border-border',
  SKIPPED: 'bg-muted text-muted-foreground border-border',
  DRAFT: 'bg-muted text-muted-foreground border-border',
  ACTIVE: 'bg-success/12 text-success border-success/30',
  ADMIN: 'bg-primary-container text-on-primary-container border-transparent',
  SENIOR_EXPERT: 'bg-primary/10 text-primary border-primary/30',
  USER: 'bg-secondary text-secondary-foreground border-transparent',
};

/**
 * Persian label for a user role value (ADMIN / SENIOR_EXPERT / USER).
 * Falls back to the plain expert label for unknown/legacy values.
 */
export const roleLabels: Record<string, string> = {
  ADMIN: t.ADMIN,
  SENIOR_EXPERT: t.SENIOR_EXPERT,
  USER: t.USER,
};

export const roleLabel = (role?: string | null): string =>
  (role && roleLabels[role]) || t.USER;
