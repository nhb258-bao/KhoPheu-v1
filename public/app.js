(() => {
  "use strict";

  const API = {
    bootstrap: "/api/bootstrap",
    session: "/api/session",
    login: "/api/login",
    logout: "/api/logout",
    config: "/api/config",
    stockBalance: "/api/stock-balance",
    counts: (date) => `/api/counts/${encodeURIComponent(date)}`,
  };

  const UNASSIGNED_AREA = "__UNASSIGNED__";
  const UNASSIGNED_LABEL = "Chưa phân khu";
  const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
  const LOOKUP_MAX_FILE_SIZE = 8 * 1024 * 1024;
  const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const TAB_ORDER = ["overview", "count", "lookup", "admin"];
  const TAB_NAMES = new Set(TAB_ORDER);
  const DEFAULT_SALES_COPY_TEMPLATE = [
    "{{date}} - {{phone}} - Dạ em bán:",
    "{{products}}",
    "Dạ em đã xuất File và CRM.",
  ].join("\n");
  const SALES_COPY_TEMPLATE_MAX_LENGTH = 4000;
  const SALES_COPY_TEMPLATE_TOKENS = new Set(["date", "phone", "customer", "staff", "products"]);
  const DEFAULT_INVENTORY_REPORT_TEMPLATE = [
    "Báo cáo kho PTS ngày {{date}}",
    "Số lượng bán PTS: {{ptsSold}}",
    "{{ptsSoldProducts}}",
    "=> SL PTS còn lại: PTS: {{ptsRemaining}}",
    "",
    "Số lượng bán Chân thoát: {{drainSold}}",
    "{{drainSoldProducts}}",
    "=> SL Chân thoát còn lại:",
    "{{drainRemaining}}",
    "",
    "Số lượng bán VX: {{vxSold}}",
    "{{vxSoldProducts}}",
    "=> SL VX còn lại:",
    "{{vxRemaining}}",
    "",
    "Số lượng bán Van Chia Nước: {{valveSold}}",
    "{{valveSoldProducts}}",
    "=> SL Van chia nước còn lại:",
    "{{valveRemaining}}",
    "",
    "=> Số lượng ĐỦ",
  ].join("\n");
  const INVENTORY_REPORT_TEMPLATE_MAX_LENGTH = 8000;
  const INVENTORY_REPORT_TEMPLATE_TOKENS = [
    "date",
    "ptsSold",
    "ptsSoldProducts",
    "ptsRemaining",
    "drainSold",
    "drainSoldProducts",
    "drainRemaining",
    "vxSold",
    "vxSoldProducts",
    "vxRemaining",
    "valveSold",
    "valveSoldProducts",
    "valveRemaining",
  ];
  const INVENTORY_REPORT_TEMPLATE_TOKEN_SET = new Set(INVENTORY_REPORT_TEMPLATE_TOKENS);
  const TAB_SWIPE_INTERACTIVE_SELECTOR =
    "a, button, dialog, input, label, select, textarea, [contenteditable], [role='button'], [role='slider'], [role='tab']";
  const INVENTORY_REPORT_REMAINING = {
    drain: [
      ["Cổ Vịt", "Chân Thoát PTS Cổ Vịt"],
      ["Lò Xo", "Chân Thoát PTS Lò Xo"],
    ],
    vx: [
      ["VX ABS Inox Mới", "VX ABS Inox Mới"],
      ["VX ABS Inox", "VX ABS Inox"],
      ["VX ABS Xám", "VX ABS Xám"],
      ["VX SS304 Xám", "VX SS304 Xám"],
      ["VX SS304 Xám T1", "VX SS304 Xám T1"],
      ["VX SS304 Inox", "VX SS304 Inox"],
      ["VX SS304 Inox T1", "VX SS304 Inox T1"],
      ["VX SS304 Inox Nguyên Bản", "VX SS304 Inox Nguyên Bản"],
      ["VX SS304 Inox Nguyên Bản T1", "VX SS304 Inox Nguyên Bản T1"],
    ],
    valve: [
      ["Van Chia Nước S3 Inox", "Van Chia Nước S3 Inox"],
      ["Van Chia Nước S3 Inox T1", "Van Chia Nước S3 Inox T1"],
      ["Van Chia Nước S3 Xám", "Van Chia Nước S3 Xám"],
      ["Van Chia Nước S3 Xám T1", "Van Chia Nước S3 Xám T1"],
      ["Van Chia Nước D3 Inox", "Van Chia Nước D3 Inox"],
      ["Van Chia Nước D3 Inox Nguyên Bản", "Van Chia Nước D3 Inox Nguyên Bản"],
    ],
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const elements = {
    tabs: $$(".tab-button"),
    mainContent: $("#main-content"),
    overviewPanel: $("#overview-panel"),
    countPanel: $("#count-panel"),
    lookupPanel: $("#lookup-panel"),
    lookupUploadCard: $("#lookup-upload-card"),
    lookupDropzone: $("#lookup-dropzone"),
    lookupFileInput: $("#lookup-file-input"),
    lookupFilePicker: $("#lookup-file-picker"),
    lookupFileSelected: $("#lookup-file-selected"),
    lookupFileName: $("#lookup-file-name"),
    lookupFileMeta: $("#lookup-file-meta"),
    lookupFileReplace: $("#lookup-file-replace"),
    lookupFileError: $("#lookup-file-error"),
    lookupBalanceButton: $("#lookup-balance-button"),
    lookupBalanceDialog: $("#lookup-balance-dialog"),
    lookupBalanceBody: $("#lookup-balance-body"),
    lookupBalanceLoading: $("#lookup-balance-loading"),
    lookupBalanceError: $("#lookup-balance-error"),
    lookupBalanceErrorMessage: $("#lookup-balance-error-message"),
    lookupBalanceRetry: $("#lookup-balance-retry"),
    lookupBalanceResults: $("#lookup-balance-results"),
    lookupBalanceAnnouncement: $("#lookup-balance-announcement"),
    lookupBalanceTotal: $("#lookup-balance-total"),
    lookupBalanceBalanced: $("#lookup-balance-balanced"),
    lookupBalanceExcess: $("#lookup-balance-excess"),
    lookupBalanceShortage: $("#lookup-balance-shortage"),
    lookupBalanceUnmatched: $("#lookup-balance-unmatched"),
    lookupBalanceTableBody: $("#lookup-balance-table-body"),
    lookupBalanceClose: $("#lookup-balance-close"),
    adminPanel: $("#admin-panel"),
    overviewLoading: $("#overview-loading"),
    overviewError: $("#overview-error"),
    overviewErrorMessage: $("#overview-error-message"),
    overviewContent: $("#overview-content"),
    retryOverview: $("#retry-overview"),
    syncIndicator: $("#sync-indicator"),
    syncLabel: $("#sync-label"),
    refreshButton: $("#refresh-button"),
    countLoading: $("#count-loading"),
    countError: $("#count-error"),
    countErrorMessage: $("#count-error-message"),
    countContent: $("#count-content"),
    countToolbar: $("#count-toolbar"),
    countToolbarHome: $("#count-toolbar-home"),
    retryBootstrap: $("#retry-bootstrap"),
    countTabDate: $("#count-tab-date"),
    countDate: $("#count-date"),
    progressLabel: $("#progress-label"),
    progressBlock: $("#progress-block"),
    progressTrack: $("#progress-track"),
    progressFill: $("#progress-fill"),
    progressHint: $("#progress-hint"),
    statEnough: $("#stat-enough"),
    statPending: $("#stat-pending"),
    statPendingCard: $("#stat-pending-card"),
    statSold: $("#stat-sold"),
    exportInventoryReport: $("#export-inventory-report"),
    inventoryReportDialog: $("#inventory-report-dialog"),
    inventoryReportDate: $("#inventory-report-date"),
    inventoryReportScroll: $("#inventory-report-scroll"),
    inventoryReportContent: $("#inventory-report-content"),
    inventoryReportCopy: $("#inventory-report-copy"),
    inventoryReportClose: $("#inventory-report-close"),
    salesDetailList: $("#sales-detail-list"),
    salesDetailEmpty: $("#sales-detail-empty"),
    search: $("#product-search"),
    resultsLine: $("#results-line"),
    areaList: $("#area-list"),
    countEmpty: $("#count-empty"),
    clearFilters: $("#clear-filters"),
    adminLoading: $("#admin-loading"),
    adminGuest: $("#admin-guest"),
    adminApp: $("#admin-app"),
    loginForm: $("#login-form"),
    loginUsername: $("#login-username"),
    loginPassword: $("#login-password"),
    loginError: $("#login-error"),
    loginSubmit: $("#login-submit"),
    togglePassword: $("#toggle-password"),
    adminUser: $("#admin-user"),
    logoutButton: $("#logout-button"),
    saveConfig: $("#save-config"),
    undoConfig: $("#discard-config"),
    salesCopyTemplateCard: $("#sales-copy-template-card"),
    salesCopyTemplate: $("#sales-copy-template"),
    salesCopyTemplateError: $("#sales-copy-template-error"),
    salesCopyTemplatePreview: $("#sales-copy-template-preview"),
    resetSalesCopyTemplate: $("#reset-sales-copy-template"),
    inventoryReportTemplateCard: $("#inventory-report-template-card"),
    inventoryReportTemplate: $("#inventory-report-template"),
    inventoryReportTemplateError: $("#inventory-report-template-error"),
    inventoryReportTemplatePreview: $("#inventory-report-template-preview"),
    resetInventoryReportTemplate: $("#reset-inventory-report-template"),
    adminBoard: $("#admin-board"),
    unsavedDot: $("#unsaved-dot"),
    areaDialog: $("#area-dialog"),
    areaDialogForm: $("#area-dialog-form"),
    areaDialogIcon: $("#area-dialog-icon"),
    areaDialogTitle: $("#area-dialog-title"),
    areaDialogCopy: $("#area-dialog-copy"),
    areaNameField: $("#area-name-field"),
    areaNameInput: $("#area-name-input"),
    areaDestinationField: $("#area-destination-field"),
    areaDestinationSelect: $("#area-destination-select"),
    areaDialogError: $("#area-dialog-error"),
    areaDialogConfirm: $("#area-dialog-confirm"),
    areaDialogCancel: $("#area-dialog-cancel"),
    toastRegion: $("#toast-region"),
  };

  let inventoryReportCopyTimer = null;
  let inventoryReportRenderedLines = [];

  const state = {
    ready: false,
    refreshing: false,
    date: "",
    products: [],
    areas: [],
    sales: [],
    salesCopyTemplate: DEFAULT_SALES_COPY_TEMPLATE,
    inventoryReportTemplate: DEFAULT_INVENTORY_REPORT_TEMPLATE,
    counts: {},
    savedCounts: {},
    source: {},
    search: "",
    selectedCountArea: null,
    activeTab: "overview",
    tabSwipe: null,
    countSave: {},
    countTimers: {},
    countInflight: {},
    countSessionEpoch: 0,
    session: {
      checked: false,
      loading: false,
      authenticated: false,
      username: "",
    },
    adminDraft: null,
    adminHistory: [],
    adminAssignedSearch: "",
    adminUnassignedSearch: "",
    configDirty: false,
    configSaving: false,
    dialog: null,
    drag: null,
    laneDrag: null,
    lookup: {
      file: null,
      error: "",
      balancing: false,
      result: null,
      requestController: null,
    },
  };

  let adminAssignedRevealTimer = null;
  let salesCopyTemplateEditSession = null;
  let inventoryReportTemplateEditSession = null;
  let dateRolloverPromise = null;
  let observedVietnamDate = currentDateInVietnam();

  class ApiError extends Error {
    constructor(message, status, payload) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.payload = payload;
    }
  }

  async function api(path, options = {}) {
    const request = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    };

    if (options.body !== undefined) {
      request.headers["Content-Type"] = "application/json";
      request.body = JSON.stringify(options.body);
    }

    const response = await fetch(path, request);
    const contentType = response.headers.get("content-type") || "";
    let payload = null;

    if (response.status !== 204) {
      if (contentType.includes("application/json")) {
        payload = await response.json().catch(() => null);
      } else {
        const text = await response.text().catch(() => "");
        payload = text ? { message: text } : null;
      }
    }

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        (typeof payload?.error === "string" ? payload.error : `Yêu cầu thất bại (${response.status})`);
      throw new ApiError(message, response.status, payload);
    }

    return payload;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("vi-VN")
      .replace(/đ/g, "d")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniqueStrings(values) {
    const seen = new Set();
    return values.reduce((result, raw) => {
      const value = String(raw ?? "").replace(/\s+/g, " ").trim();
      const key = value.toLocaleLowerCase("vi-VN");
      if (value && !seen.has(key)) {
        seen.add(key);
        result.push(value);
      }
      return result;
    }, []);
  }

  function areaLabel(area) {
    return area === UNASSIGNED_AREA ? UNASSIGNED_LABEL : area;
  }

  function adminLanes() {
    if (!state.adminDraft) return [UNASSIGNED_AREA];
    return [...state.adminDraft.areas, UNASSIGNED_AREA];
  }

  function asFiniteNumber(value, fallback = null) {
    if (value === "" || value === null || value === undefined) return fallback;
    const parsed = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeCount(value) {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = asFiniteNumber(value, null);
    if (parsed === null) return null;
    return Math.min(999999, Math.max(0, Math.round(parsed)));
  }

  function formatQuantity(value) {
    const number = asFiniteNumber(value, null);
    return number === null ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(number);
  }

  function parseLocalDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function currentDateInVietnam() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: VIETNAM_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function formatLongDate(value) {
    const date = parseLocalDate(value);
    if (!date || Number.isNaN(date.getTime())) return value || "Hôm nay";
    const formatted = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
    return formatted.charAt(0).toLocaleUpperCase("vi-VN") + formatted.slice(1);
  }

  function formatCountTabDate(value) {
    const date = parseLocalDate(value);
    if (!date || Number.isNaN(date.getTime())) return "Hôm nay";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `Hôm nay, ngày ${day} tháng ${month} năm ${date.getFullYear()}`;
  }

  function formatNumericDate(value) {
    const date = parseLocalDate(value);
    if (!date || Number.isNaN(date.getTime())) return value || "Hôm nay";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
  }

  function validateSalesCopyTemplate(value) {
    if (typeof value !== "string") {
      return { value: "", error: "Mẫu copy phải là nội dung dạng chữ." };
    }
    const template = value.replace(/\r\n?/g, "\n").trim();
    if (!template) return { value: template, error: "Vui lòng nhập nội dung mẫu copy." };
    if (template.length > SALES_COPY_TEMPLATE_MAX_LENGTH) {
      return { value: template, error: `Mẫu copy không được vượt quá ${SALES_COPY_TEMPLATE_MAX_LENGTH} ký tự.` };
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(template)) {
      return { value: template, error: "Mẫu copy có ký tự điều khiển không hợp lệ." };
    }

    const tokens = Array.from(template.matchAll(/{{([^{}]+)}}/g), (match) => match[1]);
    const unknownToken = tokens.find((token) => !SALES_COPY_TEMPLATE_TOKENS.has(token));
    const remainder = template.replace(/{{[^{}]+}}/g, "");
    if (unknownToken || remainder.includes("{{") || remainder.includes("}}")) {
      return {
        value: template,
        error: unknownToken ? `Biến {{${unknownToken}}} không được hỗ trợ.` : "Cú pháp biến trong mẫu copy không hợp lệ.",
      };
    }
    if (tokens.filter((token) => token === "products").length !== 1) {
      return { value: template, error: "Mẫu copy cần có đúng một biến {{products}}." };
    }
    return { value: template, error: "" };
  }

  function normalizeSalesCopyTemplate(value) {
    const validated = validateSalesCopyTemplate(value);
    return validated.error ? DEFAULT_SALES_COPY_TEMPLATE : validated.value;
  }

  function fillSalesCopyTemplate(template, values) {
    return template.replace(/{{(date|phone|customer|staff|products)}}/g, (_match, token) => values[token] ?? "");
  }

  function validateInventoryReportTemplate(value) {
    if (typeof value !== "string") {
      return { value: "", error: "Mẫu báo cáo kho phải là nội dung dạng chữ." };
    }
    const template = value.replace(/\r\n?/g, "\n").trim();
    if (!template) return { value: template, error: "Vui lòng nhập nội dung mẫu báo cáo kho." };
    if (template.length > INVENTORY_REPORT_TEMPLATE_MAX_LENGTH) {
      return {
        value: template,
        error: `Mẫu báo cáo kho không được vượt quá ${INVENTORY_REPORT_TEMPLATE_MAX_LENGTH} ký tự.`,
      };
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(template)) {
      return { value: template, error: "Mẫu báo cáo kho có ký tự điều khiển không hợp lệ." };
    }

    const tokens = Array.from(template.matchAll(/{{([^{}]+)}}/g), (match) => match[1]);
    const unknownToken = tokens.find((token) => !INVENTORY_REPORT_TEMPLATE_TOKEN_SET.has(token));
    const remainder = template.replace(/{{[^{}]+}}/g, "");
    if (unknownToken || remainder.includes("{{") || remainder.includes("}}")) {
      return {
        value: template,
        error: unknownToken ? `Biến {{${unknownToken}}} không được hỗ trợ.` : "Cú pháp biến trong mẫu báo cáo kho không hợp lệ.",
      };
    }
    const invalidRequiredToken = INVENTORY_REPORT_TEMPLATE_TOKENS.find(
      (token) => tokens.filter((candidate) => candidate === token).length !== 1,
    );
    if (invalidRequiredToken) {
      return {
        value: template,
        error: `Mẫu báo cáo kho cần có đúng một biến {{${invalidRequiredToken}}}.`,
      };
    }
    return { value: template, error: "" };
  }

  function normalizeInventoryReportTemplate(value) {
    const validated = validateInventoryReportTemplate(value);
    return validated.error ? DEFAULT_INVENTORY_REPORT_TEMPLATE : validated.value;
  }

  function fillInventoryReportTemplate(template, values) {
    const tokenPattern = /{{(date|ptsSold|ptsSoldProducts|ptsRemaining|drainSold|drainSoldProducts|drainRemaining|vxSold|vxSoldProducts|vxRemaining|valveSold|valveSoldProducts|valveRemaining)}}/g;
    return template
      .split("\n")
      .flatMap((line) => {
        const standaloneToken = /^([ \t]*){{([^{}]+)}}[ \t]*$/.exec(line);
        if (standaloneToken && INVENTORY_REPORT_TEMPLATE_TOKEN_SET.has(standaloneToken[2])) {
          const replacement = String(values[standaloneToken[2]] ?? "");
          if (!replacement) return [];
          return replacement.split("\n").map((replacementLine) => `${standaloneToken[1]}${replacementLine}`);
        }
        return [line.replace(tokenPattern, (_match, token) => values[token] ?? "")];
      })
      .join("\n");
  }

  function formatFetchedAt(value) {
    if (!value) return "Đã đồng bộ";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Đã đồng bộ";
    return `Cập nhật ${new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)}`;
  }

  function icon(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function setSyncStatus(type, label) {
    elements.syncIndicator.classList.remove("is-online", "is-loading", "is-error");
    if (type) elements.syncIndicator.classList.add(`is-${type}`);
    elements.syncLabel.textContent = label;
  }

  function setButtonBusy(button, busy, busyText) {
    if (!button) return;
    const label = $("span", button);
    if (busy) {
      button.dataset.originalLabel = label?.textContent || button.textContent;
      button.disabled = true;
      button.classList.add("is-busy");
      if (label && busyText) label.textContent = busyText;
    } else {
      button.classList.remove("is-busy");
      if (label && button.dataset.originalLabel) label.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
      button.disabled = false;
    }
  }

  function showToast(message, type = "success", timeout = 3200) {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " is-error" : ""}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `${icon(type === "error" ? "alert" : "check")}<span></span>`;
    $("span", toast).textContent = message;
    elements.toastRegion.append(toast);

    const dismiss = () => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 190);
    };
    window.setTimeout(dismiss, timeout);
  }

  function getErrorMessage(error, fallback) {
    if (error instanceof ApiError && error.message) return error.message;
    if (!navigator.onLine) return "Thiết bị đang mất kết nối mạng.";
    return fallback;
  }

  function normalizeBootstrap(payload) {
    const rawProducts = Array.isArray(payload?.products) ? payload.products : [];
    const products = rawProducts
      .map((product, index) => {
        const sku = String(product?.sku ?? "").trim();
        return {
          name: String(product?.name ?? "").trim() || "Sản phẩm chưa đặt tên",
          sku,
          standardQty: asFiniteNumber(product?.standardQty, null),
          area: String(product?.area ?? "").replace(/\s+/g, " ").trim(),
          order: asFiniteNumber(product?.order, index),
          soldToday: Boolean(product?.soldToday) || asFiniteNumber(product?.soldQty, 0) > 0,
          soldQty: Math.max(0, asFiniteNumber(product?.soldQty, 0)),
        };
      })
      .filter((product) => product.name || product.sku);

    let areas = uniqueStrings([
      ...(Array.isArray(payload?.areas) ? payload.areas : []),
      ...products.map((product) => product.area),
    ]).filter((area) => area !== UNASSIGNED_AREA);
    if (!areas.length) areas = ["Khu A"];

    products.forEach((product) => {
      if (!product.area) product.area = UNASSIGNED_AREA;
    });

    const sales = (Array.isArray(payload?.sales) ? payload.sales : [])
      .map((sale) => ({
        dateTime: String(sale?.dateTime ?? "").trim(),
        productName: String(sale?.productName ?? "").replace(/\s+/g, " ").trim(),
        quantity: Math.max(0, asFiniteNumber(sale?.quantity, 0)),
        customer: String(sale?.customer ?? "").replace(/\s+/g, " ").trim(),
        phone: String(sale?.phone ?? "").replace(/\s+/g, " ").trim(),
        staff: String(sale?.staff ?? "").replace(/\s+/g, " ").trim(),
        matchedSku: String(sale?.matchedSku ?? "").trim(),
      }))
      .filter((sale) => sale.productName);

    const rawCounts = payload?.counts && typeof payload.counts === "object" ? payload.counts : {};
    const counts = {};
    products.forEach((product) => {
      const value = Object.prototype.hasOwnProperty.call(rawCounts, product.sku) ? rawCounts[product.sku] : null;
      counts[product.sku] = normalizeCount(value);
    });

    return {
      date: String(payload?.date ?? "").trim(),
      products,
      areas,
      sales,
      salesCopyTemplate: normalizeSalesCopyTemplate(payload?.salesCopyTemplate),
      inventoryReportTemplate: normalizeInventoryReportTemplate(payload?.inventoryReportTemplate),
      counts,
      source: payload?.source && typeof payload.source === "object" ? payload.source : {},
    };
  }

  async function loadBootstrap({ silent = false, force = false, bypassGuards = false, newDay = false } = {}) {
    if (state.refreshing) return false;
    if (!bypassGuards && state.ready && state.configDirty) {
      showToast("Hãy lưu hoặc chọn ‘Hoàn tác’ trước khi làm mới.", "error", 4800);
      return false;
    }
    if (!bypassGuards && state.ready && hasPendingCountSaves()) {
      showToast("Hãy đợi các số lượng đang lưu xong hoặc chạm ‘Thử lại’ trước khi làm mới.", "error", 4800);
      return false;
    }
    state.refreshing = true;
    setCountInteractionDisabled(true);
    elements.refreshButton.classList.add("is-spinning");
    setSyncStatus("loading", state.ready ? "Đang làm mới" : "Đang kết nối");

    if (!silent && !state.ready) {
      elements.overviewLoading.hidden = false;
      elements.overviewError.hidden = true;
      elements.overviewContent.hidden = true;
      elements.countLoading.hidden = false;
      elements.countError.hidden = true;
      elements.countContent.hidden = true;
    }

    try {
      const payload = await api(force ? `${API.bootstrap}?refresh=1` : API.bootstrap);
      const normalized = normalizeBootstrap(payload);
      const preserveDirtyAdminDraft = Boolean(state.adminDraft && state.configDirty);
      state.date = normalized.date;
      state.products = normalized.products;
      state.areas = normalized.areas;
      state.sales = normalized.sales;
      state.salesCopyTemplate = normalized.salesCopyTemplate;
      state.inventoryReportTemplate = normalized.inventoryReportTemplate;
      state.counts = normalized.counts;
      state.savedCounts = { ...normalized.counts };
      state.source = normalized.source;
      state.ready = true;

      if (!preserveDirtyAdminDraft) {
        state.adminDraft = null;
        state.adminHistory = [];
      }
      syncAdminDraftWithProducts();
      renderCount();
      if (state.session.authenticated) renderAdminBoard();

      elements.countLoading.hidden = true;
      elements.countError.hidden = true;
      elements.countContent.hidden = false;
      elements.overviewLoading.hidden = true;
      elements.overviewError.hidden = true;
      elements.overviewContent.hidden = false;
      setSyncStatus("online", formatFetchedAt(state.source.fetchedAt));
      if (silent) showToast(newDay ? "Đã bắt đầu phiên kiểm kho ngày mới." : "Dữ liệu đã được làm mới.");
      return true;
    } catch (error) {
      const message = getErrorMessage(error, "Không thể đọc dữ liệu từ máy chủ.");
      setSyncStatus("error", "Chưa đồng bộ");
      if (!state.ready) {
        elements.overviewLoading.hidden = true;
        elements.overviewContent.hidden = true;
        elements.overviewError.hidden = false;
        elements.overviewErrorMessage.textContent = message;
        elements.countLoading.hidden = true;
        elements.countContent.hidden = true;
        elements.countError.hidden = false;
        elements.countErrorMessage.textContent = message;
      } else {
        showToast(message, "error");
      }
      return false;
    } finally {
      state.refreshing = false;
      setCountInteractionDisabled(false);
      elements.refreshButton.classList.remove("is-spinning");
    }
  }

  function hasPendingCountSaves() {
    return state.products.some((product) => {
      const sku = product.sku;
      return Boolean(state.countInflight[sku] || state.countSave[sku]) || !valuesEqual(state.savedCounts[sku], state.counts[sku]);
    });
  }

  function setCountInteractionDisabled(disabled) {
    elements.areaList.inert = disabled;
    elements.areaList.classList.toggle("is-refreshing", disabled);
    elements.areaList.setAttribute("aria-busy", String(disabled));
  }

  function clearPreviousCountSessionWork() {
    Object.values(state.countTimers).forEach((timer) => window.clearTimeout(timer));
    state.countSessionEpoch += 1;
    state.countTimers = {};
    state.countInflight = {};
    state.countSave = {};
  }

  async function startNewCountDay(expectedDate) {
    if (!state.ready || !state.date || state.date === expectedDate || state.refreshing) return false;
    if (dateRolloverPromise) return dateRolloverPromise;

    const task = (async () => {
      clearPreviousCountSessionWork();
      return loadBootstrap({ silent: true, bypassGuards: true, newDay: true });
    })();
    dateRolloverPromise = task;

    try {
      return await task;
    } finally {
      if (dateRolloverPromise === task) dateRolloverPromise = null;
    }
  }

  async function ensureCurrentCountDate(serverDate = "") {
    const detectedDate = serverDate || currentDateInVietnam();
    if (!state.ready || !state.date) {
      observedVietnamDate = detectedDate;
      return false;
    }
    if (state.refreshing || (!serverDate && detectedDate === observedVietnamDate)) return false;

    const previousObservedDate = observedVietnamDate;
    observedVietnamDate = detectedDate;
    if (state.date === detectedDate) return false;

    const switched = await startNewCountDay(detectedDate);
    if (!switched && state.date !== detectedDate) observedVietnamDate = previousObservedDate;
    return switched;
  }

  function getProductStatus(product) {
    const actual = state.counts[product.sku];
    const standard = product.standardQty;

    if (actual === null || actual === undefined) {
      return { key: "pending", label: "Chưa đếm", detail: "" };
    }
    if (standard === null || !Number.isFinite(standard)) {
      return { key: "unknown", label: "Thiếu SL", detail: "Kiểm tra lại SL tại SR" };
    }
    if (actual >= standard) {
      return {
        key: "enough",
        label: "Đã đếm",
        detail: "",
      };
    }
    return {
      key: "short",
      label: "Thiếu",
      detail: "",
    };
  }

  function getAllStats() {
    const stats = getCountProducts().reduce(
      (stats, product) => {
        const status = getProductStatus(product);
        const actual = state.counts[product.sku];
        stats.total += 1;
        if (actual !== null && actual !== undefined) stats.done += 1;
        if (status.key === "enough") stats.enough += 1;
        else if (status.key === "short") stats.short += 1;
        else stats.pending += 1;
        return stats;
      },
      { total: 0, done: 0, enough: 0, short: 0, pending: 0, sold: 0 },
    );
    stats.sold = state.sales.reduce((total, sale) => total + Math.max(0, asFiniteNumber(sale.quantity, 0)), 0);
    return stats;
  }

  function isEligibleUnassignedProduct(product) {
    return (
      product.area === UNASSIGNED_AREA &&
      Number.isFinite(product.standardQty) &&
      product.standardQty > 0
    );
  }

  function getCountProducts() {
    const assignedAreas = new Set(state.areas);
    return state.products.filter(
      (product) => assignedAreas.has(product.area) || isEligibleUnassignedProduct(product),
    );
  }

  function getCountAreas(products = getCountProducts()) {
    const hasEligibleUnassigned = products.some(isEligibleUnassignedProduct);
    return hasEligibleUnassigned ? [...state.areas, UNASSIGNED_AREA] : [...state.areas];
  }

  function firstPendingProduct() {
    const countProducts = getCountProducts();
    const pendingProducts = countProducts.filter((product) => {
      const status = getProductStatus(product);
      return status.key === "pending" || status.key === "unknown";
    });
    for (const area of getCountAreas(countProducts)) {
      const product = sortedProductsForArea(area, pendingProducts)[0];
      if (product) return product;
    }
    return null;
  }

  function sortedProductsForArea(area, products = state.products) {
    return products
      .filter((product) => product.area === area)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "vi"));
  }

  function productMatchesSearch(product) {
    if (!state.search) return true;
    const haystack = normalizeText(`${product.name} ${product.sku}`);
    return haystack.includes(normalizeText(state.search));
  }

  function placeCountToolbarAtHome() {
    if (elements.countToolbarHome.nextElementSibling !== elements.countToolbar) {
      elements.countToolbarHome.after(elements.countToolbar);
    }
    elements.countToolbar.classList.remove("is-in-detail");
  }

  function placeCountToolbarInDetail() {
    const slot = $("[data-count-search-slot]", elements.areaList);
    if (!slot) return;
    slot.replaceWith(elements.countToolbar);
    elements.countToolbar.classList.add("is-in-detail");
  }

  function groupTodaySales() {
    const staffGroups = new Map();

    state.sales.forEach((sale) => {
      const quantity = Math.max(0, asFiniteNumber(sale.quantity, 0));
      if (!sale.productName || quantity <= 0) return;

      const staff = sale.staff || "Nhân viên chưa xác định";
      const staffKey = normalizeText(staff) || "__unknown_staff__";
      if (!staffGroups.has(staffKey)) {
        staffGroups.set(staffKey, { staff, customers: new Map() });
      }
      const staffGroup = staffGroups.get(staffKey);

      const customer = sale.customer || "chưa xác định";
      const phone = sale.phone || "";
      const customerKey = JSON.stringify([normalizeText(customer), normalizeText(phone)]);
      if (!staffGroup.customers.has(customerKey)) {
        staffGroup.customers.set(customerKey, { customer, phone, products: new Map() });
      }
      const customerGroup = staffGroup.customers.get(customerKey);

      const productKey = sale.matchedSku
        ? `sku:${normalizeText(sale.matchedSku)}`
        : `name:${normalizeText(sale.productName)}`;
      const existingProduct = customerGroup.products.get(productKey);
      if (existingProduct) {
        existingProduct.quantity += quantity;
      } else {
        customerGroup.products.set(productKey, {
          name: sale.productName,
          sku: String(sale.matchedSku || "").trim(),
          quantity,
        });
      }
    });

    return Array.from(staffGroups.values(), (staffGroup) => ({
      staff: staffGroup.staff,
      customers: Array.from(staffGroup.customers.values(), (customerGroup) => ({
        customer: customerGroup.customer,
        phone: customerGroup.phone,
        products: Array.from(customerGroup.products.values()),
      })),
    }));
  }

  function renderSalesDetails() {
    const staffGroups = groupTodaySales();
    elements.salesDetailList.innerHTML = staffGroups
      .map(
        (staffGroup, staffIndex) => `
          <article class="sales-staff-card">
            <h3>${escapeHtml(staffGroup.staff)} đã bán:</h3>
            <div class="sales-customer-list">
              ${staffGroup.customers
                .map(
                  (customerGroup, customerIndex) => `
                    <section class="sales-customer-group">
                      <button
                        class="sales-copy-button"
                        type="button"
                        data-copy-staff="${staffIndex}"
                        data-copy-customer="${customerIndex}"
                        aria-label="Sao chép thông tin khách hàng ${escapeHtml(customerGroup.customer)}"
                        title="Sao chép thông tin khách hàng"
                      >${icon("copy")}</button>
                      <h4>Khách hàng ${escapeHtml(customerGroup.customer)}${customerGroup.phone ? ` - ${escapeHtml(customerGroup.phone)}` : ""}:</h4>
                      <ul class="sales-product-list">
                        ${customerGroup.products
                          .map(
                            (product) => `
                              <li>
                                <span class="sales-product-plus" aria-hidden="true">+</span>
                                <span class="sales-product-name">${escapeHtml(product.name)}${product.sku ? ` <span class="sales-product-sku">( SKU: ${escapeHtml(product.sku)} )</span>` : ""}</span>
                                <strong class="sales-product-quantity">x ${formatQuantity(product.quantity)}</strong>
                              </li>`,
                          )
                          .join("")}
                      </ul>
                    </section>`,
                )
                .join("")}
            </div>
          </article>`,
      )
      .join("");
    elements.salesDetailList.hidden = staffGroups.length === 0;
    elements.salesDetailEmpty.hidden = staffGroups.length > 0;
  }

  function customerSalesCopyText(customerGroup, staff = "", template = state.salesCopyTemplate) {
    const products = customerGroup.products
      .map((product) => `    + ${product.name} x ${formatQuantity(product.quantity)}`)
      .join("\n");
    return fillSalesCopyTemplate(normalizeSalesCopyTemplate(template), {
      date: formatNumericDate(state.date),
      phone: customerGroup.phone || "Không có SĐT",
      customer: customerGroup.customer || "Không rõ khách hàng",
      staff: staff || "Không rõ nhân viên",
      products,
    });
  }

  async function writeClipboardText(value) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Một số trình duyệt chỉ cho phép Clipboard API trên kết nối bảo mật.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }
    if (!copied) throw new Error("Không thể sao chép");
  }

  async function handleSalesCopy(event) {
    const button = event.target.closest(".sales-copy-button");
    if (!button || button.disabled) return;
    const staffIndex = Number(button.dataset.copyStaff);
    const customerIndex = Number(button.dataset.copyCustomer);
    const staffGroup = groupTodaySales()[staffIndex];
    const customerGroup = staffGroup?.customers[customerIndex];
    if (!customerGroup) return;

    button.disabled = true;
    try {
      await writeClipboardText(customerSalesCopyText(customerGroup, staffGroup.staff));
      button.classList.add("is-copied");
      button.innerHTML = icon("check");
      showToast("Đã sao chép thông tin khách hàng.");
      window.setTimeout(() => {
        if (!button.isConnected) return;
        button.classList.remove("is-copied");
        button.innerHTML = icon("copy");
        button.disabled = false;
      }, 1400);
    } catch {
      button.disabled = false;
      showToast("Không thể sao chép. Vui lòng thử lại.", "error");
    }
  }

  function renderSummary(stats) {
    const percentage = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
    const isFullyCounted = stats.total > 0 && stats.done === stats.total;
    const isComplete = stats.total > 0 && stats.enough === stats.total;
    const canExportReport = canExportInventoryReport(stats);
    elements.countTabDate.textContent = formatCountTabDate(state.date);
    elements.countDate.textContent = formatLongDate(state.date);
    elements.progressLabel.textContent = `${stats.done} / ${stats.total}`;
    elements.progressTrack.setAttribute("aria-valuenow", String(percentage));
    elements.progressTrack.setAttribute("aria-valuetext", `${stats.done} trên ${stats.total} sản phẩm đã đếm`);
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressBlock.classList.toggle("is-complete", isComplete);
    elements.progressBlock.classList.toggle("is-incomplete", !isComplete);
    elements.progressHint.textContent =
      isFullyCounted
        ? stats.pending > 0
          ? "Chưa hoàn tất - Bạn kiểm tra lại số lượng SR không đủ so với số lượng đã bán"
          : stats.short
            ? `Đã đếm xong, còn ${stats.short} sản phẩm thiếu.`
            : "Hoàn tất - Bạn đã đếm đủ tất cả sản phẩm"
        : stats.done
          ? `Chưa hoàn tất - Còn ${stats.total - stats.done} sản phẩm chưa đếm`
          : "Hãy kiểm tra kho SR trước khi kết ca";
    elements.statEnough.textContent = stats.done;
    elements.statPending.textContent = stats.pending;
    elements.statPendingCard.classList.toggle("is-actionable", stats.pending > 0);
    elements.statPendingCard.tabIndex = stats.pending > 0 ? 0 : -1;
    elements.statPendingCard.setAttribute("aria-disabled", String(stats.pending <= 0));
    elements.statPendingCard.setAttribute(
      "aria-label",
      stats.pending > 0
        ? `${stats.pending} sản phẩm chưa đếm. Mở sản phẩm đầu tiên.`
        : "Không còn sản phẩm chưa đếm.",
    );
    elements.statSold.textContent = formatQuantity(stats.sold);
    elements.exportInventoryReport.disabled = !canExportReport;
    elements.exportInventoryReport.setAttribute("aria-disabled", String(!canExportReport));
    elements.exportInventoryReport.title = canExportReport
      ? "Mở báo kho"
      : "Chỉ xuất được khi đã đếm đủ và không còn sản phẩm chưa đếm";
    renderSalesDetails();
  }

  function canExportInventoryReport(stats) {
    return stats.total > 0 && stats.pending === 0 && stats.done === stats.total;
  }

  function inventoryReportCategory(name) {
    const normalized = normalizeText(name);
    if (/^chan thoat(?:\s|$)/.test(normalized)) return "drain";
    if (/^van chia nuoc(?:\s|$)/.test(normalized)) return "valve";
    if (/^vx(?:\s|$)/.test(normalized)) return "vx";
    if (/^pts(?:\s|$)/.test(normalized)) return "pts";
    return null;
  }

  function inventoryReportSales() {
    const groups = {
      pts: { total: 0, items: new Map() },
      drain: { total: 0, items: new Map() },
      vx: { total: 0, items: new Map() },
      valve: { total: 0, items: new Map() },
    };
    const productNamesBySku = new Map(
      state.products.map((product) => [normalizeText(product.sku), product.name]),
    );

    state.sales.forEach((sale) => {
      const quantity = Math.max(0, asFiniteNumber(sale.quantity, 0));
      if (!sale.productName || quantity <= 0) return;

      const matchedProductName = productNamesBySku.get(normalizeText(sale.matchedSku)) || "";
      const category = inventoryReportCategory(sale.productName) || inventoryReportCategory(matchedProductName);
      if (!category) return;

      const group = groups[category];
      const itemKey = sale.matchedSku
        ? `sku:${normalizeText(sale.matchedSku)}`
        : `name:${normalizeText(sale.productName)}`;
      const existingItem = group.items.get(itemKey);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        group.items.set(itemKey, { name: sale.productName, quantity });
      }
      group.total += quantity;
    });

    return groups;
  }

  function inventoryReportQuantityByName(name) {
    const normalizedName = normalizeText(name);
    return state.products.reduce(
      (total, product) =>
        normalizeText(product.name) === normalizedName
          ? total + Math.max(0, asFiniteNumber(product.standardQty, 0))
          : total,
      0,
    );
  }

  function inventoryReportCategoryQuantity(category) {
    return state.products.reduce(
      (total, product) =>
        inventoryReportCategory(product.name) === category
          ? total + Math.max(0, asFiniteNumber(product.standardQty, 0))
          : total,
      0,
    );
  }

  function inventoryReportSoldLines(group) {
    return Array.from(
      group.items.values(),
      (item) => `   + ${item.name} x ${formatQuantity(item.quantity)}`,
    );
  }

  function inventoryReportRemainingLines(definitions) {
    return definitions.map(
      ([label, productName]) => `${label}: ${formatQuantity(inventoryReportQuantityByName(productName))}`,
    );
  }

  function inventoryReportTemplateValues() {
    const sales = inventoryReportSales();
    return {
      date: formatNumericDate(state.date),
      ptsSold: formatQuantity(sales.pts.total),
      ptsSoldProducts: inventoryReportSoldLines(sales.pts).join("\n"),
      ptsRemaining: formatQuantity(inventoryReportCategoryQuantity("pts")),
      drainSold: formatQuantity(sales.drain.total),
      drainSoldProducts: inventoryReportSoldLines(sales.drain).join("\n"),
      drainRemaining: inventoryReportRemainingLines(INVENTORY_REPORT_REMAINING.drain).join("\n"),
      vxSold: formatQuantity(sales.vx.total),
      vxSoldProducts: inventoryReportSoldLines(sales.vx).join("\n"),
      vxRemaining: inventoryReportRemainingLines(INVENTORY_REPORT_REMAINING.vx).join("\n"),
      valveSold: formatQuantity(sales.valve.total),
      valveSoldProducts: inventoryReportSoldLines(sales.valve).join("\n"),
      valveRemaining: inventoryReportRemainingLines(INVENTORY_REPORT_REMAINING.valve).join("\n"),
    };
  }

  function buildInventoryReportLines(template = state.inventoryReportTemplate) {
    const reportText = fillInventoryReportTemplate(
      normalizeInventoryReportTemplate(template),
      inventoryReportTemplateValues(),
    );
    const line = (text, style = "normal") => ({ text, style });
    return reportText.split("\n").map((text, index) => {
      if (/^=>\s*Số lượng\b/i.test(text)) return line(text, "final");
      if (index === 0 || /^Số lượng bán\b/i.test(text)) return line(text, "heading");
      return line(text);
    });
  }

  function inventoryReportPlainText(lines) {
    return lines.map(({ text }) => text).join("\n");
  }

  function renderInventoryReport(lines) {
    const fragment = document.createDocumentFragment();
    lines.forEach((reportLine, index) => {
      const lineElement = document.createElement("span");
      lineElement.className = `inventory-report-line is-${reportLine.style}`;
      lineElement.textContent = reportLine.text;
      fragment.append(lineElement);
      if (index < lines.length - 1) fragment.append(document.createTextNode("\n"));
    });
    elements.inventoryReportContent.replaceChildren(fragment);
  }

  function inventoryReportClipboardHtml(lines) {
    const htmlLines = lines.map(({ text, style }) => {
      if (!text) return "<div><br></div>";
      const safeText = escapeHtml(text).replace(/^ {3}/, "&nbsp;&nbsp;&nbsp;");
      if (style === "heading") {
        return `<div><strong style="color:#000000;font-weight:700">${safeText}</strong></div>`;
      }
      if (style === "final") {
        return `<div style="color:#ff3b30"><font color="#ff3b30"><strong style="color:#ff3b30;font-weight:700">${safeText}</strong></font></div>`;
      }
      return `<div>${safeText}</div>`;
    });
    return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#17251f">${htmlLines.join("")}</div>`;
  }

  async function writeInventoryReportClipboard(lines) {
    const plainText = inventoryReportPlainText(lines);
    const ClipboardItemConstructor = window.ClipboardItem;
    if (navigator.clipboard?.write && ClipboardItemConstructor) {
      try {
        const item = new ClipboardItemConstructor({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([inventoryReportClipboardHtml(lines)], { type: "text/html" }),
        });
        await navigator.clipboard.write([item]);
        return true;
      } catch {
        // Một số trình duyệt hoặc ứng dụng chỉ chấp nhận văn bản thuần từ clipboard.
      }
    }
    await writeClipboardText(plainText);
    return false;
  }

  function resetInventoryReportCopyButton() {
    if (inventoryReportCopyTimer) {
      window.clearTimeout(inventoryReportCopyTimer);
      inventoryReportCopyTimer = null;
    }
    elements.inventoryReportCopy.disabled = false;
    elements.inventoryReportCopy.classList.remove("is-copied");
    elements.inventoryReportCopy.innerHTML = icon("copy");
    elements.inventoryReportCopy.setAttribute("aria-label", "Sao chép nội dung báo kho");
    elements.inventoryReportCopy.title = "Sao chép nội dung báo kho";
  }

  function openInventoryReportDialog() {
    const stats = getAllStats();
    if (!canExportInventoryReport(stats)) return;

    elements.inventoryReportDate.textContent = formatLongDate(state.date);
    inventoryReportRenderedLines = buildInventoryReportLines();
    renderInventoryReport(inventoryReportRenderedLines);
    elements.inventoryReportScroll.scrollTop = 0;
    resetInventoryReportCopyButton();

    if (elements.inventoryReportDialog.open) return;
    if (typeof elements.inventoryReportDialog.showModal === "function") {
      elements.inventoryReportDialog.showModal();
    } else {
      elements.inventoryReportDialog.setAttribute("open", "");
    }
    window.setTimeout(() => elements.inventoryReportClose.focus({ preventScroll: true }), 20);
  }

  function closeInventoryReportDialog() {
    if (typeof elements.inventoryReportDialog.close === "function") {
      elements.inventoryReportDialog.close();
    } else {
      elements.inventoryReportDialog.removeAttribute("open");
    }
  }

  async function handleInventoryReportCopy() {
    if (!inventoryReportRenderedLines.length || elements.inventoryReportCopy.disabled) return;

    elements.inventoryReportCopy.disabled = true;
    try {
      const copiedWithFormatting = await writeInventoryReportClipboard(inventoryReportRenderedLines);
      elements.inventoryReportCopy.classList.add("is-copied");
      elements.inventoryReportCopy.innerHTML = icon("check");
      elements.inventoryReportCopy.setAttribute("aria-label", "Đã sao chép báo cáo kho");
      elements.inventoryReportCopy.title = "Đã sao chép báo cáo kho";
      showToast(
        copiedWithFormatting
          ? "Đã sao chép báo cáo kèm định dạng."
          : "Đã sao chép nội dung; ứng dụng nhận có thể không giữ định dạng.",
      );
      inventoryReportCopyTimer = window.setTimeout(resetInventoryReportCopyButton, 1400);
    } catch {
      resetInventoryReportCopyButton();
      showToast("Không thể sao chép báo cáo. Vui lòng thử lại.", "error");
    }
  }

  function navigateToFirstPendingProduct() {
    const product = firstPendingProduct();
    if (!product) return;

    state.search = "";
    elements.search.value = "";
    state.selectedCountArea = product.area;
    activateTab("count");
    renderCount();

    window.requestAnimationFrame(() => {
      const card = $$('[data-product-sku]', elements.areaList).find(
        (item) => item.dataset.productSku === product.sku,
      );
      if (!card) return;
      card.classList.add("is-targeted");
      card.setAttribute("tabindex", "-1");
      card.focus({ preventScroll: true });
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => card.classList.remove("is-targeted"), 2400);
    });
  }

  function handlePendingStatNavigation(event) {
    if (!elements.statPendingCard.classList.contains("is-actionable")) return;
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    if (event.type === "keydown") event.preventDefault();
    navigateToFirstPendingProduct();
  }

  function renderProductCard(product) {
    const status = getProductStatus(product);
    const standardKnown = Number.isFinite(product.standardQty);
    const saveStatus = state.countSave[product.sku];
    const soldBadge = product.soldToday
      ? `<span class="sold-badge">Đã bán${product.soldQty ? ` ${formatQuantity(product.soldQty)}` : ""}</span>`
      : "";
    const saveLine =
      saveStatus === "error"
        ? `<button class="save-state save-retry is-error" type="button" data-action="retry" data-sku="${escapeHtml(product.sku)}">Chưa lưu · Thử lại</button>`
        : "";

    const checkboxChecked = status.key === "enough" ? " checked" : "";
    const checkboxDisabled = product.sku && standardKnown ? "" : " disabled";
    const checkboxLabel = status.key === "enough" ? `Bỏ đánh dấu đã đếm ${product.name}` : `Đánh dấu ${product.name} đã đủ`;

    return `
      <article class="product-card status-${status.key}" data-product-sku="${escapeHtml(product.sku)}">
        <div class="product-info">
          <div>
            <div class="product-title-row">
              <h3 class="product-name" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</h3>
              ${soldBadge}
            </div>
            <div class="product-meta">
              <span class="product-sku">Mã SKU: ${escapeHtml(product.sku || "Chưa có SKU")}</span>
            </div>
            <p class="product-standard">Số lượng: <strong>${formatQuantity(product.standardQty)}</strong></p>
          </div>
        </div>
        <div class="product-side">
          <div class="product-status-line">
            <span class="status-badge status-${status.key}">${status.key === "enough" ? icon("check") : ""}${status.label}</span>
            ${status.detail ? `<span class="status-detail">${escapeHtml(status.detail)}</span>` : ""}
            ${saveLine}
          </div>
          <div class="count-check-control">
            <label class="enough-check" title="${escapeHtml(checkboxLabel)}">
              <input class="enough-checkbox" type="checkbox" data-sku="${escapeHtml(product.sku)}" aria-label="${escapeHtml(checkboxLabel)}"${checkboxChecked}${checkboxDisabled} />
              <span class="enough-check-box" aria-hidden="true">${icon("check")}</span>
            </label>
          </div>
        </div>
      </article>`;
  }

  function detailProductContent(area, visibleProducts) {
    const products = sortedProductsForArea(area, visibleProducts);
    const emptyCopy = state.search
      ? "Không có sản phẩm phù hợp với từ khóa tìm kiếm."
      : "Khu này chưa có sản phẩm.";
    return products.length
      ? `<div class="product-grid">${products.map(renderProductCard).join("")}</div>`
      : `<p class="area-empty">${emptyCopy}</p>`;
  }

  function renderDetailProductsForSearch() {
    const container = $("[data-count-detail-products]", elements.areaList);
    if (!state.selectedCountArea || !container) return false;
    const countProducts = getCountProducts();
    const visibleProducts = countProducts.filter(productMatchesSearch);
    container.innerHTML = detailProductContent(state.selectedCountArea, visibleProducts);
    return true;
  }

  function renderCount() {
    if (!state.ready) return;
    placeCountToolbarAtHome();
    const countProducts = getCountProducts();
    const countAreas = getCountAreas(countProducts);
    if (state.selectedCountArea && !countAreas.includes(state.selectedCountArea)) state.selectedCountArea = null;
    elements.countPanel.classList.toggle("is-detail-view", Boolean(state.selectedCountArea));

    const stats = getAllStats();
    renderSummary(stats);

    const visibleProducts = countProducts.filter(productMatchesSearch);
    const hasActiveQuery = Boolean(state.search);
    const badgeForArea = (area) =>
      area === UNASSIGNED_AREA
        ? "?"
        : area.replace(/^khu\s+/i, "").trim().slice(0, 3).toLocaleUpperCase("vi-VN") || "•";

    if (state.selectedCountArea) {
      const area = state.selectedCountArea;
      const areaAll = sortedProductsForArea(area, countProducts);
      const areaDone = areaAll.filter(
        (product) => state.counts[product.sku] !== null && state.counts[product.sku] !== undefined,
      ).length;
      const label = areaLabel(area);

      elements.areaList.innerHTML = `
        <section class="count-area-detail${area === UNASSIGNED_AREA ? " is-unassigned" : ""}" data-area="${escapeHtml(area)}">
          <button class="count-detail-back" type="button" data-count-back>
            ${icon("chevron")}<span>Quay lại danh sách khu</span>
          </button>
          <div class="count-detail-search-slot" data-count-search-slot></div>
          <header class="count-detail-header">
            <div class="area-identity">
              <span class="area-badge">${escapeHtml(badgeForArea(area))}</span>
              <div>
                <p class="count-detail-eyebrow">Chi tiết khu</p>
                <h2>${escapeHtml(label)}</h2>
              </div>
            </div>
            <p class="area-progress"><strong>${areaDone}/${areaAll.length}</strong> đã đếm</p>
          </header>
          <div data-count-detail-products>${detailProductContent(area, visibleProducts)}</div>
        </section>`;
      placeCountToolbarInDetail();
      elements.resultsLine.textContent = "";
      elements.resultsLine.hidden = true;
      elements.countEmpty.hidden = true;
    } else {
      const visibleAreas = hasActiveQuery
        ? countAreas.filter((area) => visibleProducts.some((product) => product.area === area))
        : countAreas;

      elements.resultsLine.textContent = "";
      elements.resultsLine.hidden = true;

      elements.areaList.innerHTML = visibleAreas
        .map((area) => {
          const products = sortedProductsForArea(area, visibleProducts);
          const areaAll = sortedProductsForArea(area, countProducts);
          const areaDone = areaAll.filter(
            (product) => state.counts[product.sku] !== null && state.counts[product.sku] !== undefined,
          ).length;
          const label = areaLabel(area);
          const productCopy = hasActiveQuery ? `${products.length}/${areaAll.length} sản phẩm` : `${areaAll.length} sản phẩm`;
          const areaStatusClass = areaAll.length > 0 && areaDone === areaAll.length ? " is-complete" : " is-incomplete";
          return `
            <button
              class="count-area-card${area === UNASSIGNED_AREA ? " is-unassigned" : ""}${areaStatusClass}"
              type="button"
              data-count-area="${escapeHtml(area)}"
            >
              <span class="area-identity">
                <span class="area-badge">${escapeHtml(badgeForArea(area))}</span>
                <span class="area-title-copy">
                  <span class="area-title">${escapeHtml(label)}</span>
                  <span class="area-product-count">${productCopy}</span>
                </span>
              </span>
              <span class="area-toggle-end">
                <span class="area-progress"><strong>${areaDone}/${areaAll.length}</strong> đã đếm</span>
                <span class="area-open-icon">${icon("chevron")}</span>
              </span>
            </button>`;
        })
        .join("");

      elements.countEmpty.hidden = visibleAreas.length > 0;
    }

  }

  function valuesEqual(a, b) {
    return (a === null || a === undefined) && (b === null || b === undefined) ? true : a === b;
  }

  function setCount(sku, value, { immediate = false, render = true } = {}) {
    if (!sku) return;
    const normalized = normalizeCount(value);
    const unchanged = valuesEqual(state.counts[sku], normalized);
    state.counts[sku] = normalized;
    state.countSave[sku] = "saving";
    if (render) renderCount();

    if (state.countTimers[sku]) window.clearTimeout(state.countTimers[sku]);
    state.countTimers[sku] = window.setTimeout(() => flushCount(sku), immediate ? 0 : 260);

    if (unchanged && state.countSave[sku] !== "error" && valuesEqual(state.savedCounts[sku], normalized)) {
      state.countSave[sku] = null;
      if (render) renderCount();
    }
  }

  async function flushCount(sku) {
    if (!state.date || !sku || state.countInflight[sku]) return;
    const countSessionEpoch = state.countSessionEpoch;
    const countDate = state.date;
    state.countInflight[sku] = true;
    let attemptedValue = state.counts[sku] ?? null;

    try {
      while (countSessionEpoch === state.countSessionEpoch && !valuesEqual(state.savedCounts[sku], state.counts[sku])) {
        const valueToSave = state.counts[sku] ?? null;
        attemptedValue = valueToSave;
        const expectedActual = state.savedCounts[sku] ?? null;
        state.countSave[sku] = "saving";
        renderCount();
        await api(API.counts(countDate), {
          method: "PATCH",
          body: { sku, actual: valueToSave, expectedActual },
        });
        if (countSessionEpoch !== state.countSessionEpoch) return;
        state.savedCounts[sku] = valueToSave;
      }
      state.countSave[sku] = null;
    } catch (error) {
      if (countSessionEpoch !== state.countSessionEpoch) return;
      state.countSave[sku] = "error";
      if (error instanceof ApiError && error.status === 409) {
        const details = error.payload?.error?.details;
        const errorCode = error.payload?.error?.code;
        if (errorCode === "COUNT_DATE_CONFLICT" && details?.currentDate) {
          state.countSave[sku] = null;
          await ensureCurrentCountDate(details.currentDate);
          return;
        }
        if (details && Object.prototype.hasOwnProperty.call(details, "currentActual")) {
          const currentActual = normalizeCount(details.currentActual);
          state.savedCounts[sku] = currentActual;
          if (valuesEqual(state.counts[sku], attemptedValue)) {
            state.counts[sku] = currentActual;
            state.countSave[sku] = null;
            showToast("Số lượng vừa được sửa trên thiết bị khác. Đã hiển thị giá trị mới nhất.", "error", 5500);
          } else {
            state.countSave[sku] = "saving";
            showToast("Có thay đổi từ thiết bị khác; đang lưu lại số bạn vừa nhập.", "error", 5000);
          }
        } else {
          showToast("Phiên đếm đã thay đổi. Hãy làm mới dữ liệu rồi thử lại.", "error", 5000);
        }
      } else {
        showToast(getErrorMessage(error, "Không thể lưu số lượng. Chạm ‘Thử lại’ để lưu lại."), "error", 4500);
      }
    } finally {
      if (countSessionEpoch !== state.countSessionEpoch) return;
      state.countInflight[sku] = false;
      renderCount();
      if (state.countSave[sku] !== "error" && !valuesEqual(state.savedCounts[sku], state.counts[sku])) {
        flushCount(sku);
      }
    }
  }

  function handleCountClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || button.disabled) return;
    const { action, sku } = button.dataset;
    if (action !== "retry" || !state.products.some((item) => item.sku === sku)) return;
    state.countSave[sku] = "saving";
    renderCount();
    flushCount(sku);
  }

  function handleEnoughCheckboxChange(event) {
    const checkbox = event.target.closest(".enough-checkbox");
    if (!checkbox || checkbox.disabled) return;
    const product = state.products.find((item) => item.sku === checkbox.dataset.sku);
    if (!product || !Number.isFinite(product.standardQty)) return;
    setCount(product.sku, checkbox.checked ? product.standardQty : null, { immediate: true });
  }

  function handleCountAreaNavigation(event) {
    const areaButton = event.target.closest("button[data-count-area]");
    if (areaButton) {
      const area = areaButton.dataset.countArea;
      if (!getCountAreas().includes(area)) return;
      state.selectedCountArea = area;
      renderCount();
      window.requestAnimationFrame(() => $(".count-detail-back", elements.areaList)?.focus({ preventScroll: true }));
      $(".count-area-detail", elements.areaList)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const backButton = event.target.closest("button[data-count-back]");
    if (!backButton) return;
    const previousArea = state.selectedCountArea;
    state.selectedCountArea = null;
    renderCount();
    window.requestAnimationFrame(() => {
      const replacement = $$("button[data-count-area]", elements.areaList).find(
        (button) => button.dataset.countArea === previousArea,
      );
      (replacement || $("button[data-count-area]", elements.areaList) || elements.search).focus({ preventScroll: true });
    });
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "";
    if (bytes < 1024) return `${bytes} byte`;
    if (bytes < 1024 * 1024) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
  }

  function lookupFileValidationMessage(file) {
    if (!file) return "Vui lòng chọn một file Excel .xlsx.";
    if (!String(file.name || "").toLocaleLowerCase("vi-VN").endsWith(".xlsx")) {
      return "Chỉ hỗ trợ file Excel có đuôi .xlsx.";
    }
    if (!Number.isFinite(file.size) || file.size <= 0) return "File Excel đang trống.";
    if (file.size > LOOKUP_MAX_FILE_SIZE) return "File Excel vượt quá giới hạn 8 MB.";
    return "";
  }

  function renderLookupFile() {
    const file = state.lookup.file;
    const hasFile = Boolean(file);
    elements.lookupUploadCard.setAttribute("aria-busy", String(state.lookup.balancing));
    elements.lookupDropzone.hidden = hasFile;
    elements.lookupFileSelected.hidden = !hasFile;
    elements.lookupBalanceButton.hidden = !hasFile;
    elements.lookupFileError.hidden = !state.lookup.error;
    elements.lookupFileError.textContent = state.lookup.error;

    if (file) {
      elements.lookupFileName.textContent = file.name;
      elements.lookupFileMeta.textContent = `${formatFileSize(file.size)} · File .xlsx`;
    } else {
      elements.lookupFileName.textContent = "";
      elements.lookupFileMeta.textContent = "";
    }

    elements.lookupFilePicker.disabled = state.lookup.balancing;
    elements.lookupFileReplace.disabled = state.lookup.balancing;
    if (!state.lookup.balancing) elements.lookupBalanceButton.disabled = !hasFile;
  }

  function chooseLookupFile() {
    if (state.lookup.balancing) return;
    elements.lookupFileInput.value = "";
    elements.lookupFileInput.click();
  }

  function selectLookupFile(file) {
    const error = lookupFileValidationMessage(file);
    state.lookup.file = error ? null : file;
    state.lookup.error = error;
    state.lookup.result = null;
    elements.lookupBalanceTableBody.replaceChildren();
    renderLookupFile();
    if (!error) showToast(`Đã chọn ${file.name}.`);
  }

  async function uploadLookupFile(file, signal) {
    const response = await fetch(API.stockBalance, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": XLSX_MIME,
      },
      body: file,
      signal,
    });
    const contentType = response.headers.get("content-type") || "";
    let payload = null;
    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => null);
    } else {
      const message = await response.text().catch(() => "");
      payload = message ? { message } : null;
    }
    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        (typeof payload?.error === "string" ? payload.error : `Yêu cầu thất bại (${response.status})`);
      throw new ApiError(message, response.status, payload);
    }
    return payload;
  }

  function formatLookupDifference(value) {
    const number = asFiniteNumber(value, null);
    if (number === null) return "—";
    if (number > 0) return `+${formatQuantity(number)}`;
    return formatQuantity(number);
  }

  function renderLookupBalance(payload) {
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const summary = payload?.summary && typeof payload.summary === "object" ? payload.summary : {};
    const values = {
      total: Math.max(0, asFiniteNumber(summary.total, rows.length)),
      balanced: Math.max(0, asFiniteNumber(summary.balanced, 0)),
      excess: Math.max(0, asFiniteNumber(summary.excess, 0)),
      shortage: Math.max(0, asFiniteNumber(summary.shortage, 0)),
      unmatched: Math.max(0, asFiniteNumber(summary.unmatched, 0)),
    };

    elements.lookupBalanceTotal.textContent = formatQuantity(values.total);
    elements.lookupBalanceBalanced.textContent = formatQuantity(values.balanced);
    elements.lookupBalanceExcess.textContent = formatQuantity(values.excess);
    elements.lookupBalanceShortage.textContent = formatQuantity(values.shortage);
    elements.lookupBalanceUnmatched.textContent = formatQuantity(values.unmatched);
    elements.lookupBalanceTableBody.innerHTML = rows
      .map((row) => {
        const difference = asFiniteNumber(row?.difference, null);
        const differenceClass = difference > 0 ? " is-positive" : difference < 0 ? " is-negative" : "";
        const rowClass = difference !== null && difference !== 0 ? ' class="is-imbalanced"' : "";
        return `
          <tr${rowClass}>
            <td class="lookup-balance-product">${escapeHtml(row?.name || "Sản phẩm chưa đặt tên")}</td>
            <td class="lookup-balance-sku">${escapeHtml(row?.sku || "—")}</td>
            <td>${escapeHtml(formatQuantity(row?.srDnQty ?? row?.sheetQty))}</td>
            <td>${escapeHtml(formatQuantity(row?.crmQty ?? row?.fileQty))}</td>
            <td class="lookup-difference${differenceClass}">${escapeHtml(formatLookupDifference(row?.difference))}</td>
          </tr>`;
      })
      .join("");

    const announcement = `Đã đối chiếu ${formatQuantity(values.total)} SKU: ${formatQuantity(values.balanced)} cân bằng, ${formatQuantity(values.excess)} dư, ${formatQuantity(values.shortage)} thiếu${values.unmatched ? `, ${formatQuantity(values.unmatched)} chưa đối chiếu` : ""}.`;
    elements.lookupBalanceLoading.hidden = true;
    elements.lookupBalanceError.hidden = true;
    elements.lookupBalanceResults.hidden = false;
    elements.lookupBalanceAnnouncement.textContent = "";
    window.requestAnimationFrame(() => {
      elements.lookupBalanceAnnouncement.textContent = announcement;
    });
    state.lookup.result = payload;
  }

  function openLookupBalanceDialog() {
    if (!state.lookup.file || state.lookup.balancing) return;
    elements.lookupBalanceLoading.hidden = false;
    elements.lookupBalanceError.hidden = true;
    elements.lookupBalanceResults.hidden = true;
    if (!elements.lookupBalanceDialog.open) elements.lookupBalanceDialog.showModal();
    handleLookupBalance();
  }

  function closeLookupBalanceDialog() {
    state.lookup.requestController?.abort();
    if (elements.lookupBalanceDialog.open) elements.lookupBalanceDialog.close();
    if (!state.lookup.balancing) elements.lookupBalanceButton.focus({ preventScroll: true });
  }

  async function handleLookupBalance() {
    const file = state.lookup.file;
    if (!file || state.lookup.balancing) return;
    state.lookup.balancing = true;
    const requestController = new AbortController();
    state.lookup.requestController = requestController;
    state.lookup.error = "";
    elements.lookupBalanceBody.setAttribute("aria-busy", "true");
    elements.lookupBalanceAnnouncement.textContent = "";
    elements.lookupBalanceErrorMessage.textContent = "";
    if (!elements.lookupBalanceError.hidden && document.activeElement === elements.lookupBalanceRetry) {
      elements.lookupBalanceClose.focus({ preventScroll: true });
    }
    elements.lookupBalanceLoading.hidden = false;
    elements.lookupBalanceError.hidden = true;
    elements.lookupBalanceResults.hidden = true;
    setButtonBusy(elements.lookupBalanceButton, true, "Đang cân bằng…");
    elements.lookupFileReplace.disabled = true;
    renderLookupFile();

    try {
      const payload = await uploadLookupFile(file, requestController.signal);
      renderLookupBalance(payload);
    } catch (error) {
      if (error?.name === "AbortError") {
        elements.lookupBalanceLoading.hidden = true;
        return;
      }
      elements.lookupBalanceLoading.hidden = true;
      elements.lookupBalanceResults.hidden = true;
      const message = getErrorMessage(
        error,
        "Không thể đọc hoặc cân bằng file Excel. Vui lòng thử lại.",
      );
      elements.lookupBalanceErrorMessage.textContent = "";
      elements.lookupBalanceError.hidden = false;
      window.requestAnimationFrame(() => {
        elements.lookupBalanceErrorMessage.textContent = message;
        elements.lookupBalanceRetry.focus({ preventScroll: true });
      });
    } finally {
      if (state.lookup.requestController === requestController) state.lookup.requestController = null;
      state.lookup.balancing = false;
      elements.lookupBalanceBody.setAttribute("aria-busy", "false");
      setButtonBusy(elements.lookupBalanceButton, false);
      renderLookupFile();
      if (!elements.lookupBalanceDialog.open && state.activeTab === "lookup") {
        elements.lookupBalanceButton.focus({ preventScroll: true });
      }
    }
  }

  function isInsideHorizontalScroller(target) {
    let element = target instanceof Element ? target : target?.parentElement;
    while (element && element !== elements.mainContent) {
      const overflowX = window.getComputedStyle(element).overflowX;
      if (["auto", "scroll", "overlay"].includes(overflowX) && element.scrollWidth > element.clientWidth + 1) return true;
      element = element.parentElement;
    }
    return false;
  }

  function beginTabSwipe(event) {
    state.tabSwipe = null;
    if (!isMobileLayout() || state.drag || state.laneDrag || event.defaultPrevented || event.touches.length !== 1) return;
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target || target.closest(TAB_SWIPE_INTERACTIVE_SELECTOR) || isInsideHorizontalScroller(target)) return;

    const touch = event.touches[0];
    const edgeMargin = 24;
    if (touch.clientX <= edgeMargin || touch.clientX >= window.innerWidth - edgeMargin) return;
    state.tabSwipe = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      startedAt: performance.now(),
      activeTab: state.activeTab,
    };
  }

  function endTabSwipe(event) {
    const swipe = state.tabSwipe;
    state.tabSwipe = null;
    if (!swipe || event.touches.length || swipe.activeTab !== state.activeTab) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === swipe.identifier);
    if (!touch) return;

    const deltaX = touch.clientX - swipe.startX;
    const deltaY = touch.clientY - swipe.startY;
    const elapsed = performance.now() - swipe.startedAt;
    const distanceThreshold = Math.min(96, Math.max(56, window.innerWidth * 0.16));
    if (elapsed > 900 || Math.abs(deltaX) < distanceThreshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

    const currentIndex = TAB_ORDER.indexOf(state.activeTab);
    const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1);
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= TAB_ORDER.length) return;
    activateTab(TAB_ORDER[nextIndex]);
    elements.tabs[nextIndex]?.focus({ preventScroll: true });
  }

  function cancelTabSwipe() {
    state.tabSwipe = null;
  }

  function activateTab(name, { updateHash = true } = {}) {
    const next = TAB_NAMES.has(name) ? name : "overview";
    state.activeTab = next;
    elements.tabs.forEach((tab) => {
      const active = tab.dataset.tab === next;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    elements.overviewPanel.hidden = next !== "overview";
    elements.countPanel.hidden = next !== "count";
    elements.lookupPanel.hidden = next !== "lookup";
    elements.adminPanel.hidden = next !== "admin";

    if (updateHash && location.hash !== `#${next}`) history.replaceState(null, "", `#${next}`);
    if (next === "admin") ensureSession();
  }

  async function ensureSession({ force = false } = {}) {
    if (state.session.loading || (state.session.checked && !force)) {
      renderAdminAuth();
      return;
    }

    state.session.loading = true;
    renderAdminAuth();
    try {
      const payload = await api(API.session);
      state.session.authenticated = Boolean(payload?.authenticated);
      state.session.username = String(payload?.username || "");
    } catch (error) {
      state.session.authenticated = false;
      state.session.username = "";
      if (state.activeTab === "admin") {
        showToast(getErrorMessage(error, "Không thể kiểm tra phiên đăng nhập."), "error");
      }
    } finally {
      state.session.checked = true;
      state.session.loading = false;
      renderAdminAuth();
    }
  }

  function renderAdminAuth() {
    const loading = state.session.loading || (!state.session.checked && state.activeTab === "admin");
    elements.adminLoading.hidden = !loading;
    elements.adminGuest.hidden = loading || state.session.authenticated;
    elements.adminApp.hidden = loading || !state.session.authenticated;

    if (state.session.authenticated && !loading) {
      elements.adminUser.textContent = state.session.username ? `Xin chào, ${state.session.username}` : "Đã đăng nhập";
      elements.inventoryReportTemplateCard.hidden = !state.ready;
      elements.salesCopyTemplateCard.hidden = !state.ready;
      elements.adminBoard.hidden = !state.ready;
      if (!state.ready) {
        elements.saveConfig.disabled = true;
        elements.undoConfig.disabled = true;
        return;
      }
      ensureAdminDraft();
      renderAdminBoard();
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const username = elements.loginUsername.value.trim();
    const password = elements.loginPassword.value;
    elements.loginError.hidden = true;

    if (!username || !password) {
      elements.loginError.textContent = "Vui lòng nhập đủ tên đăng nhập và mật khẩu.";
      elements.loginError.hidden = false;
      (!username ? elements.loginUsername : elements.loginPassword).focus();
      return;
    }

    setButtonBusy(elements.loginSubmit, true, "Đang đăng nhập…");
    try {
      const payload = await api(API.login, { method: "POST", body: { username, password } });
      state.session.checked = true;
      state.session.authenticated = payload?.authenticated !== false;
      state.session.username = String(payload?.username || username);
      state.adminDraft = null;
      state.adminHistory = [];
      elements.loginPassword.value = "";
      renderAdminAuth();
      showToast("Đăng nhập thành công.");
    } catch (error) {
      elements.loginError.textContent =
        error instanceof ApiError && error.status === 401
          ? "Tên đăng nhập hoặc mật khẩu không đúng."
          : getErrorMessage(error, "Không thể đăng nhập lúc này.");
      elements.loginError.hidden = false;
      elements.loginPassword.select();
    } finally {
      setButtonBusy(elements.loginSubmit, false);
    }
  }

  async function handleLogout() {
    if (state.configDirty && !window.confirm("Bạn có thay đổi chưa lưu. Vẫn đăng xuất?")) return;
    elements.logoutButton.disabled = true;
    try {
      await api(API.logout, { method: "POST" });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        showToast(getErrorMessage(error, "Không thể đăng xuất."), "error");
        elements.logoutButton.disabled = false;
        return;
      }
    }
    state.session.authenticated = false;
    state.session.username = "";
    state.adminDraft = null;
    state.adminHistory = [];
    setConfigDirty(false);
    elements.logoutButton.disabled = false;
    renderAdminAuth();
    showToast("Đã đăng xuất.");
  }

  function ensureAdminDraft() {
    if (!state.ready) return;
    if (state.adminDraft) {
      syncAdminDraftWithProducts();
      return;
    }

    const areas = uniqueStrings(state.areas.length ? state.areas : ["Khu A"]);
    const assignments = {};
    state.products.forEach((product, index) => {
      assignments[product.sku] = {
        area: areas.includes(product.area) ? product.area : UNASSIGNED_AREA,
        order: Number.isFinite(product.order) ? product.order : index,
      };
    });
    state.adminDraft = {
      areas,
      assignments,
      salesCopyTemplate: state.salesCopyTemplate || DEFAULT_SALES_COPY_TEMPLATE,
      inventoryReportTemplate: state.inventoryReportTemplate || DEFAULT_INVENTORY_REPORT_TEMPLATE,
    };
    normalizeDraftOrders();
  }

  function syncAdminDraftWithProducts() {
    if (!state.adminDraft) return;
    if (typeof state.adminDraft.salesCopyTemplate !== "string") {
      state.adminDraft.salesCopyTemplate = state.salesCopyTemplate || DEFAULT_SALES_COPY_TEMPLATE;
    }
    if (typeof state.adminDraft.inventoryReportTemplate !== "string") {
      state.adminDraft.inventoryReportTemplate = state.inventoryReportTemplate || DEFAULT_INVENTORY_REPORT_TEMPLATE;
    }
    if (!state.adminDraft.areas.length) state.adminDraft.areas.push(state.areas[0] || "Khu A");

    const productSkus = new Set(state.products.map((product) => product.sku));
    Object.keys(state.adminDraft.assignments).forEach((sku) => {
      if (!productSkus.has(sku)) delete state.adminDraft.assignments[sku];
    });
    state.products.forEach((product, index) => {
      if (!state.adminDraft.assignments[product.sku]) {
        const preferredArea = state.adminDraft.areas.includes(product.area) ? product.area : UNASSIGNED_AREA;
        state.adminDraft.assignments[product.sku] = { area: preferredArea, order: index + 10000 };
      }
    });
    normalizeDraftOrders();
  }

  function draftProductsForArea(area) {
    if (!state.adminDraft) return [];
    return state.products
      .filter((product) => state.adminDraft.assignments[product.sku]?.area === area)
      .sort((a, b) => {
        const assignmentA = state.adminDraft.assignments[a.sku];
        const assignmentB = state.adminDraft.assignments[b.sku];
        return assignmentA.order - assignmentB.order || a.name.localeCompare(b.name, "vi");
      });
  }

  function normalizeDraftOrders() {
    if (!state.adminDraft) return;
    adminLanes().forEach((area) => {
      draftProductsForArea(area).forEach((product, order) => {
        state.adminDraft.assignments[product.sku] = { area, order };
      });
    });
  }

  function cloneAdminDraft(draft = state.adminDraft) {
    if (!draft) return null;
    return {
      areas: [...draft.areas],
      salesCopyTemplate: draft.salesCopyTemplate,
      inventoryReportTemplate: draft.inventoryReportTemplate,
      assignments: Object.fromEntries(
        Object.entries(draft.assignments).map(([sku, assignment]) => [
          sku,
          { area: assignment.area, order: assignment.order },
        ]),
      ),
    };
  }

  function captureAdminState() {
    return { draft: cloneAdminDraft(), dirty: state.configDirty };
  }

  function commitAdminChange(previous) {
    if (!previous?.draft || JSON.stringify(previous.draft) === JSON.stringify(state.adminDraft)) return false;
    state.adminHistory.push(previous);
    setConfigDirty(true);
    return true;
  }

  function renderSalesCopyTemplateEditor({ syncInput = true } = {}) {
    if (!state.adminDraft || !elements.salesCopyTemplate) return;
    const template = state.adminDraft.salesCopyTemplate;
    const validation = validateSalesCopyTemplate(template);
    if (syncInput && document.activeElement !== elements.salesCopyTemplate) {
      elements.salesCopyTemplate.value = template;
    }
    elements.salesCopyTemplate.setAttribute("aria-invalid", String(Boolean(validation.error)));
    elements.salesCopyTemplateError.textContent = validation.error;
    elements.salesCopyTemplateError.hidden = !validation.error;
    elements.resetSalesCopyTemplate.disabled =
      state.configSaving || template === DEFAULT_SALES_COPY_TEMPLATE;

    if (validation.error) {
      elements.salesCopyTemplatePreview.textContent = "Sửa lỗi trong mẫu để xem trước nội dung copy.";
      return;
    }
    elements.salesCopyTemplatePreview.textContent = customerSalesCopyText(
      {
        customer: "Khách hàng mẫu",
        phone: "0797509509",
        products: [{ name: "VX SS304 Xám T1", quantity: 1 }],
      },
      "Nhân viên mẫu",
      validation.value,
    );
  }

  function beginSalesCopyTemplateEdit() {
    if (!state.ready || !state.adminDraft || state.configSaving) return;
    salesCopyTemplateEditSession = { previous: captureAdminState(), committed: false };
  }

  function updateSalesCopyTemplateDraft() {
    if (!state.ready || !state.adminDraft || state.configSaving) return;
    if (!salesCopyTemplateEditSession) beginSalesCopyTemplateEdit();
    state.adminDraft.salesCopyTemplate = elements.salesCopyTemplate.value.replace(/\r\n?/g, "\n");
    const editSession = salesCopyTemplateEditSession;
    if (
      editSession &&
      !editSession.committed &&
      JSON.stringify(editSession.previous.draft) !== JSON.stringify(state.adminDraft)
    ) {
      state.adminHistory.push(editSession.previous);
      editSession.committed = true;
    }
    setConfigDirty(true);
    renderSalesCopyTemplateEditor({ syncInput: false });
  }

  function resetSalesCopyTemplate() {
    if (
      !state.ready ||
      !state.adminDraft ||
      state.configSaving ||
      state.adminDraft.salesCopyTemplate === DEFAULT_SALES_COPY_TEMPLATE
    ) return;
    salesCopyTemplateEditSession = null;
    const previous = captureAdminState();
    state.adminDraft.salesCopyTemplate = DEFAULT_SALES_COPY_TEMPLATE;
    commitAdminChange(previous);
    renderSalesCopyTemplateEditor();
    showToast("Đã khôi phục mẫu copy mặc định. Hãy lưu cấu hình để áp dụng.");
  }

  function renderInventoryReportTemplateEditor({ syncInput = true } = {}) {
    if (!state.adminDraft || !elements.inventoryReportTemplate) return;
    const template = state.adminDraft.inventoryReportTemplate;
    const validation = validateInventoryReportTemplate(template);
    if (syncInput && document.activeElement !== elements.inventoryReportTemplate) {
      elements.inventoryReportTemplate.value = template;
    }
    elements.inventoryReportTemplate.setAttribute("aria-invalid", String(Boolean(validation.error)));
    elements.inventoryReportTemplateError.textContent = validation.error;
    elements.inventoryReportTemplateError.hidden = !validation.error;
    elements.resetInventoryReportTemplate.disabled =
      state.configSaving || template === DEFAULT_INVENTORY_REPORT_TEMPLATE;

    elements.inventoryReportTemplatePreview.textContent = validation.error
      ? "Sửa lỗi trong mẫu để xem trước nội dung báo cáo kho."
      : inventoryReportPlainText(buildInventoryReportLines(validation.value));
  }

  function beginInventoryReportTemplateEdit() {
    if (!state.ready || !state.adminDraft || state.configSaving) return;
    inventoryReportTemplateEditSession = { previous: captureAdminState(), committed: false };
  }

  function updateInventoryReportTemplateDraft() {
    if (!state.ready || !state.adminDraft || state.configSaving) return;
    if (!inventoryReportTemplateEditSession) beginInventoryReportTemplateEdit();
    state.adminDraft.inventoryReportTemplate = elements.inventoryReportTemplate.value.replace(/\r\n?/g, "\n");
    const editSession = inventoryReportTemplateEditSession;
    if (
      editSession &&
      !editSession.committed &&
      JSON.stringify(editSession.previous.draft) !== JSON.stringify(state.adminDraft)
    ) {
      state.adminHistory.push(editSession.previous);
      editSession.committed = true;
    }
    setConfigDirty(true);
    renderInventoryReportTemplateEditor({ syncInput: false });
  }

  function resetInventoryReportTemplate() {
    if (
      !state.ready ||
      !state.adminDraft ||
      state.configSaving ||
      state.adminDraft.inventoryReportTemplate === DEFAULT_INVENTORY_REPORT_TEMPLATE
    ) return;
    inventoryReportTemplateEditSession = null;
    const previous = captureAdminState();
    state.adminDraft.inventoryReportTemplate = DEFAULT_INVENTORY_REPORT_TEMPLATE;
    commitAdminChange(previous);
    renderInventoryReportTemplateEditor();
    showToast("Đã khôi phục mẫu báo cáo kho mặc định. Hãy lưu cấu hình để áp dụng.");
  }

  function setConfigDirty(dirty = true) {
    state.configDirty = dirty;
    const templateInvalid = Boolean(state.adminDraft && (
      validateSalesCopyTemplate(state.adminDraft.salesCopyTemplate).error ||
      validateInventoryReportTemplate(state.adminDraft.inventoryReportTemplate).error
    ));
    elements.unsavedDot.hidden = !dirty;
    elements.saveConfig.disabled = !dirty || state.configSaving || templateInvalid;
    elements.undoConfig.disabled = !state.adminHistory.length || state.configSaving;
  }

  function setAdminConfigBusy(busy) {
    elements.inventoryReportTemplateCard.inert = busy;
    elements.inventoryReportTemplateCard.classList.toggle("is-saving", busy);
    elements.inventoryReportTemplateCard.setAttribute("aria-busy", String(busy));
    elements.salesCopyTemplateCard.inert = busy;
    elements.salesCopyTemplateCard.classList.toggle("is-saving", busy);
    elements.salesCopyTemplateCard.setAttribute("aria-busy", String(busy));
    elements.adminBoard.inert = busy;
    elements.adminBoard.classList.toggle("is-saving", busy);
    elements.adminBoard.setAttribute("aria-busy", String(busy));
    elements.undoConfig.disabled = busy || !state.adminHistory.length;
    elements.logoutButton.disabled = busy;
  }

  function undoAdminConfig() {
    if (!state.adminDraft || !state.adminHistory.length || state.configSaving) return;
    salesCopyTemplateEditSession = null;
    inventoryReportTemplateEditSession = null;
    cancelDrag();
    cancelLaneDrag();
    if (state.dialog) closeAreaDialog();
    const previous = state.adminHistory.pop();
    state.adminDraft = cloneAdminDraft(previous.draft);
    setConfigDirty(previous.dirty);
    renderAdminBoard();
    showToast("Đã hoàn tác 1 bước.");
  }

  function adminAreaLabel(area) {
    return area === UNASSIGNED_AREA ? "CHƯA PHÂN KHU" : area;
  }

  function laneBadge(area) {
    if (area === UNASSIGNED_AREA) return "?";
    return area.replace(/^khu\s+/i, "").trim().slice(0, 3).toLocaleUpperCase("vi-VN") || "•";
  }

  function renderAdminProduct(product, areaOptions, position) {
    const currentArea = state.adminDraft.assignments[product.sku].area;
    const unassigned = currentArea === UNASSIGNED_AREA;
    const options = areaOptions
      .map((area) => `<option value="${escapeHtml(area)}"${area === currentArea ? " selected" : ""}>${escapeHtml(adminAreaLabel(area))}</option>`)
      .join("");

    return `
      <article class="admin-product${unassigned ? "" : " has-remove-action"}" data-admin-sku="${escapeHtml(product.sku)}" data-admin-search="${escapeHtml(normalizeText(`${product.name} ${product.sku}`))}">
        <button class="drag-handle" type="button" aria-label="Sắp xếp ${escapeHtml(product.name)}; dùng phím mũi tên lên xuống hoặc giữ và kéo" title="Giữ và kéo · dùng phím ↑/↓">${icon("grip")}</button>
        ${unassigned ? "" : `<button class="admin-product-remove" type="button" data-admin-action="unassign" data-sku="${escapeHtml(product.sku)}" aria-label="Đưa ${escapeHtml(product.name)} về Chưa phân khu" title="Đưa về Chưa phân khu">${icon("trash")}</button>`}
        <div class="admin-product-body">
          <p class="admin-product-name" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</p>
          <div class="admin-product-meta">
            <span>${escapeHtml(product.sku)}</span>
            <span class="admin-product-quantity">Số lượng: <strong>${formatQuantity(product.standardQty)}</strong></span>
          </div>
          <div class="admin-product-controls">
            <select class="area-select" data-sku="${escapeHtml(product.sku)}" aria-label="Chuyển ${escapeHtml(product.name)} tới khu">${options}</select>
            <button class="reorder-button" type="button" data-admin-action="up" data-sku="${escapeHtml(product.sku)}" aria-label="Đưa ${escapeHtml(product.name)} lên trên" title="Lên trên"${position.index === 0 ? " disabled" : ""}>↑</button>
            <button class="reorder-button" type="button" data-admin-action="down" data-sku="${escapeHtml(product.sku)}" aria-label="Đưa ${escapeHtml(product.name)} xuống dưới" title="Xuống dưới"${position.index === position.total - 1 ? " disabled" : ""}>↓</button>
          </div>
        </div>
      </article>`;
  }

  function renderAdminLane(area, laneOptions) {
    const products = draftProductsForArea(area);
    const unassigned = area === UNASSIGNED_AREA;
    const label = adminAreaLabel(area);
    const areaIndex = unassigned ? -1 : state.adminDraft.areas.indexOf(area);
    const canMoveLeft = areaIndex > 0;
    const canMoveRight = areaIndex >= 0 && areaIndex < state.adminDraft.areas.length - 1;
    const laneReorderControls = unassigned
      ? ""
      : `<div class="lane-reorder-controls" role="group" aria-label="Di chuyển ${escapeHtml(label)}">
          <button class="lane-reorder-button" type="button" data-admin-action="lane-left" data-area="${escapeHtml(area)}" aria-label="Di chuyển ${escapeHtml(label)} sang trái" title="Qua trái"${canMoveLeft ? "" : " disabled"}>←</button>
          <button class="lane-reorder-button" type="button" data-admin-action="lane-right" data-area="${escapeHtml(area)}" aria-label="Di chuyển ${escapeHtml(label)} sang phải" title="Qua phải"${canMoveRight ? "" : " disabled"}>→</button>
        </div>`;
    const unassignedSearch = unassigned
      ? `<label class="admin-unassigned-search" for="admin-unassigned-search">
          ${icon("search")}
          <input id="admin-unassigned-search" type="search" inputmode="search" autocomplete="off" placeholder="Tìm tên sản phẩm hoặc SKU" aria-label="Tìm sản phẩm chưa phân khu theo tên hoặc SKU" value="${escapeHtml(state.adminUnassignedSearch)}" />
        </label>`
      : "";
    const productCards = products
      .map((product, index) => renderAdminProduct(product, laneOptions, { index, total: products.length }))
      .join("");
    const laneContent = unassigned
      ? `${productCards}
          <div class="lane-empty admin-unassigned-empty"${products.length ? " hidden" : ""}>Tất cả sản phẩm đã được phân khu</div>
          <div class="lane-empty admin-search-empty" hidden>Không tìm thấy sản phẩm phù hợp</div>`
      : `${productCards}
          <div class="lane-empty admin-assigned-empty"${products.length ? " hidden" : ""}>Chọn khu trên thẻ sản phẩm để chuyển vào đây</div>
          <div class="lane-empty admin-assigned-search-empty" hidden>Không tìm thấy sản phẩm phù hợp</div>`;
    return `
      <section class="admin-lane${unassigned ? " is-unassigned" : ""}" data-admin-area="${escapeHtml(area)}">
        <header class="lane-heading">
          <div class="lane-heading-start">
            ${unassigned ? "" : `<button class="lane-drag-handle" type="button" aria-label="Sắp xếp khu ${escapeHtml(label)}; giữ và kéo trái phải hoặc dùng phím mũi tên" title="Kéo khu trái/phải · dùng phím ←/→">${icon("grip")}</button>`}
            <div class="lane-title">
              <span class="lane-letter">${escapeHtml(laneBadge(area))}</span>
              <div><strong title="${escapeHtml(label)}">${escapeHtml(label)}</strong><small class="lane-product-count">${products.length} sản phẩm</small></div>
            </div>
          </div>
          ${unassigned ? "" : `<div class="lane-actions">
            <button class="lane-action" type="button" data-admin-action="rename" data-area="${escapeHtml(area)}" aria-label="Đổi tên ${escapeHtml(area)}" title="Đổi tên">${icon("edit")}</button>
            <button class="lane-action is-danger" type="button" data-admin-action="delete" data-area="${escapeHtml(area)}" aria-label="Xóa ${escapeHtml(area)}" title="Xóa khu">${icon("trash")}</button>
          </div>`}
        </header>
        ${laneReorderControls}
        ${unassignedSearch}
        <div class="lane-products">
          ${laneContent}
        </div>
      </section>`;
  }

  function applyAdminUnassignedSearch() {
    const lane = $(`.admin-lane[data-admin-area="${UNASSIGNED_AREA}"]`, elements.adminBoard);
    if (!lane) return;
    const query = normalizeText(state.adminUnassignedSearch);
    const cards = $$(".admin-product", lane);
    let visibleCount = 0;
    cards.forEach((card) => {
      const matches = !query || String(card.dataset.adminSearch || "").includes(query);
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    const defaultEmpty = $(".admin-unassigned-empty", lane);
    const searchEmpty = $(".admin-search-empty", lane);
    if (defaultEmpty) defaultEmpty.hidden = cards.length > 0 || Boolean(query);
    if (searchEmpty) searchEmpty.hidden = !query || visibleCount > 0;
    const count = $(".lane-product-count", lane);
    if (count) count.textContent = query ? `${visibleCount}/${cards.length} sản phẩm` : `${cards.length} sản phẩm`;
  }

  function scheduleAdminAssignedMatchReveal(card, query) {
    window.clearTimeout(adminAssignedRevealTimer);
    adminAssignedRevealTimer = null;
    if (!card || !query) return;

    adminAssignedRevealTimer = window.setTimeout(() => {
      adminAssignedRevealTimer = null;
      if (!card.isConnected || state.activeTab !== "admin" || normalizeText(state.adminAssignedSearch) !== query) return;
      const lane = card.closest(".admin-lane");
      const assignedScroller = card.closest(".assigned-lanes");
      if (!lane || !assignedScroller || !assignedScroller.contains(card)) return;
      const productScroller = $(".lane-products", lane);
      if (!productScroller) return;
      const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
      const scrollerRect = assignedScroller.getBoundingClientRect();
      const laneRect = lane.getBoundingClientRect();
      const maxLeft = Math.max(0, assignedScroller.scrollWidth - assignedScroller.clientWidth);
      const targetLeft = Math.min(
        maxLeft,
        Math.max(0, assignedScroller.scrollLeft + laneRect.left - scrollerRect.left - (assignedScroller.clientWidth - laneRect.width) / 2),
      );

      if (typeof assignedScroller.scrollTo === "function") assignedScroller.scrollTo({ left: targetLeft, behavior });
      else assignedScroller.scrollLeft = targetLeft;

      const productRect = productScroller.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const maxTop = Math.max(0, productScroller.scrollHeight - productScroller.clientHeight);
      const targetTop = Math.min(
        maxTop,
        Math.max(0, productScroller.scrollTop + cardRect.top - productRect.top - (productScroller.clientHeight - cardRect.height) / 2),
      );

      if (typeof productScroller.scrollTo === "function") productScroller.scrollTo({ top: targetTop, behavior });
      else productScroller.scrollTop = targetTop;
    }, 160);
  }

  function applyAdminAssignedSearch() {
    const query = normalizeText(state.adminAssignedSearch);
    let firstMatch = null;
    $$(".assigned-lanes .admin-lane", elements.adminBoard).forEach((lane) => {
      const cards = $$(".admin-product", lane);
      const products = draftProductsForArea(lane.dataset.adminArea);
      let visibleCount = 0;
      cards.forEach((card) => {
        const matches = !query || String(card.dataset.adminSearch || "").includes(query);
        card.classList.remove("is-search-target");
        card.hidden = !matches;
        if (matches) {
          visibleCount += 1;
          if (query && !firstMatch) firstMatch = card;
        }

        const productIndex = products.findIndex((product) => product.sku === card.dataset.adminSku);
        const dragHandle = $(".drag-handle", card);
        const upButton = $('.reorder-button[data-admin-action="up"]', card);
        const downButton = $('.reorder-button[data-admin-action="down"]', card);
        if (dragHandle) {
          dragHandle.disabled = Boolean(query);
          dragHandle.title = query ? "Xóa tìm kiếm để sắp xếp sản phẩm" : "Giữ và kéo · dùng phím ↑/↓";
        }
        if (upButton) upButton.disabled = Boolean(query) || productIndex <= 0;
        if (downButton) downButton.disabled = Boolean(query) || productIndex < 0 || productIndex >= products.length - 1;
      });

      const defaultEmpty = $(".admin-assigned-empty", lane);
      const searchEmpty = $(".admin-assigned-search-empty", lane);
      if (defaultEmpty) defaultEmpty.hidden = cards.length > 0 || Boolean(query);
      if (searchEmpty) searchEmpty.hidden = !query || visibleCount > 0;
      const count = $(".lane-product-count", lane);
      if (count) count.textContent = query ? `${visibleCount}/${cards.length} sản phẩm` : `${cards.length} sản phẩm`;
    });

    if (firstMatch) {
      firstMatch.classList.add("is-search-target");
    }
    return firstMatch;
  }

  function renderAdminBoard() {
    if (!state.session.authenticated || !state.ready) return;
    elements.inventoryReportTemplateCard.hidden = false;
    elements.salesCopyTemplateCard.hidden = false;
    elements.adminBoard.hidden = false;
    ensureAdminDraft();
    renderInventoryReportTemplateEditor();
    renderSalesCopyTemplateEditor();
    const previousHorizontalScroll = $(".assigned-lanes", elements.adminBoard)?.scrollLeft || 0;
    const previousLaneScroll = new Map(
      $$(".admin-lane", elements.adminBoard).map((lane) => [lane.dataset.adminArea, $(".lane-products", lane)?.scrollTop || 0]),
    );
    const { areas } = state.adminDraft;
    const lanes = adminLanes();
    const assignedCount = areas.reduce((total, area) => total + draftProductsForArea(area).length, 0);

    elements.adminBoard.innerHTML = `
      <section class="assigned-lanes-block" aria-labelledby="assigned-lanes-title">
        <header class="board-block-heading">
          <div class="board-block-title">
            <strong id="assigned-lanes-title">KHU ĐÃ PHÂN</strong>
            <small>${assignedCount} sản phẩm</small>
          </div>
          <button class="button button-secondary board-add-area" type="button" data-admin-action="add-area">
            ${icon("plus")}<span>Thêm khu</span>
          </button>
        </header>
        <label class="admin-assigned-search" for="admin-assigned-search">
          ${icon("search")}
          <input id="admin-assigned-search" type="search" inputmode="search" autocomplete="off" placeholder="Tìm tên sản phẩm hoặc SKU" aria-label="Tìm sản phẩm trong các khu đã phân theo tên hoặc SKU" value="${escapeHtml(state.adminAssignedSearch)}" />
        </label>
        <div class="assigned-lanes" data-assigned-lanes>
          ${areas.map((area) => renderAdminLane(area, lanes)).join("")}
        </div>
      </section>
      <aside class="unassigned-lane-block" aria-label="Sản phẩm chưa phân khu">
        ${renderAdminLane(UNASSIGNED_AREA, lanes)}
      </aside>`;
    const assignedScroller = $(".assigned-lanes", elements.adminBoard);
    if (assignedScroller) assignedScroller.scrollLeft = previousHorizontalScroll;
    $$(".admin-lane", elements.adminBoard).forEach((lane) => {
      const products = $(".lane-products", lane);
      if (products) products.scrollTop = previousLaneScroll.get(lane.dataset.adminArea) || 0;
    });
    applyAdminAssignedSearch();
    applyAdminUnassignedSearch();
    setConfigDirty(state.configDirty);
  }

  function moveProduct(sku, targetArea, rawIndex = Infinity) {
    if (!state.adminDraft || state.configSaving || !adminLanes().includes(targetArea)) return false;
    const product = state.products.find((item) => item.sku === sku);
    if (!product) return false;
    const previous = captureAdminState();

    const groups = new Map(adminLanes().map((area) => [area, draftProductsForArea(area).filter((item) => item.sku !== sku)]));
    const target = groups.get(targetArea);
    const index = Math.max(0, Math.min(Number.isFinite(rawIndex) ? rawIndex : target.length, target.length));
    target.splice(index, 0, product);

    groups.forEach((products, area) => {
      products.forEach((item, order) => {
        state.adminDraft.assignments[item.sku] = { area, order };
      });
    });
    if (!commitAdminChange(previous)) return false;
    renderAdminBoard();
    return true;
  }

  function reorderArea(area, rawIndex) {
    if (!state.adminDraft || state.configSaving || area === UNASSIGNED_AREA) return false;
    const currentIndex = state.adminDraft.areas.indexOf(area);
    if (currentIndex < 0) return false;
    const nextAreas = state.adminDraft.areas.filter((item) => item !== area);
    const nextIndex = Math.max(0, Math.min(rawIndex, nextAreas.length));
    nextAreas.splice(nextIndex, 0, area);
    if (nextAreas.every((item, index) => item === state.adminDraft.areas[index])) return false;
    const previous = captureAdminState();
    state.adminDraft.areas = nextAreas;
    commitAdminChange(previous);
    renderAdminBoard();
    return true;
  }

  function clearLaneDropIndicators() {
    $$(".admin-lane.is-lane-drop-before, .admin-lane.is-lane-drop-after", elements.adminBoard).forEach((lane) =>
      lane.classList.remove("is-lane-drop-before", "is-lane-drop-after"),
    );
  }

  function beginLaneDrag(event) {
    const handle = event.target.closest(".lane-drag-handle");
    if (
      !handle ||
      isMobileLayout() ||
      !state.adminDraft ||
      state.configSaving ||
      state.drag ||
      state.laneDrag ||
      (event.button !== undefined && event.button !== 0)
    ) {
      return;
    }
    const lane = handle.closest(".admin-lane");
    const area = lane?.dataset.adminArea;
    if (!lane || !area || area === UNASSIGNED_AREA) return;

    event.preventDefault();
    const laneRect = lane.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "lane-drag-ghost";
    ghost.innerHTML = `${icon("grip")}<span>${escapeHtml(areaLabel(area))}</span>`;
    document.body.append(ghost);

    state.laneDrag = {
      pointerId: event.pointerId,
      area,
      sourceIndex: state.adminDraft.areas.indexOf(area),
      handle,
      lane,
      ghost,
      offsetX: Math.min(Math.max(event.clientX - laneRect.left, 18), 180),
      offsetY: Math.min(Math.max(event.clientY - laneRect.top, 16), 34),
      dropIndex: null,
    };

    lane.classList.add("is-lane-dragging");
    document.body.classList.add("is-dragging");
    positionLaneGhost(event.clientX, event.clientY);
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Global pointer listeners keep the interaction working without capture.
    }
    window.addEventListener("pointermove", handleLaneDragMove, { passive: false });
    window.addEventListener("pointerup", endLaneDrag);
    window.addEventListener("pointercancel", cancelLaneDrag);
  }

  function positionLaneGhost(x, y) {
    if (!state.laneDrag) return;
    state.laneDrag.ghost.style.left = `${x - state.laneDrag.offsetX}px`;
    state.laneDrag.ghost.style.top = `${y - state.laneDrag.offsetY}px`;
  }

  function handleLaneDragMove(event) {
    if (!state.laneDrag || event.pointerId !== state.laneDrag.pointerId) return;
    event.preventDefault();
    positionLaneGhost(event.clientX, event.clientY);
    clearLaneDropIndicators();

    const scroller = $(".assigned-lanes", elements.adminBoard);
    if (!scroller) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const targetLane = hit?.closest?.(".admin-lane:not(.is-unassigned)");
    let index = null;

    if (targetLane && scroller.contains(targetLane)) {
      const targetArea = targetLane.dataset.adminArea;
      const targetIndex = state.adminDraft.areas.indexOf(targetArea);
      const rect = targetLane.getBoundingClientRect();
      const after = event.clientX >= rect.left + rect.width / 2;
      index = targetIndex + (after ? 1 : 0);
      targetLane.classList.add(after ? "is-lane-drop-after" : "is-lane-drop-before");
    } else if (hit?.closest?.(".assigned-lanes") === scroller) {
      const laneElements = $$(".admin-lane:not(.is-unassigned)", scroller);
      if (!laneElements.length) {
        index = 0;
      } else {
        const nextLane = laneElements.find((lane) => {
          const rect = lane.getBoundingClientRect();
          return event.clientX < rect.left + rect.width / 2;
        });
        index = nextLane ? state.adminDraft.areas.indexOf(nextLane.dataset.adminArea) : state.adminDraft.areas.length;
        if (nextLane) nextLane.classList.add("is-lane-drop-before");
        else laneElements.at(-1)?.classList.add("is-lane-drop-after");
      }
    }

    if (index !== null && state.laneDrag.sourceIndex < index) index -= 1;
    state.laneDrag.dropIndex = index === null ? null : Math.max(0, index);

    const rect = scroller.getBoundingClientRect();
    if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
      if (event.clientX < rect.left + 54) scroller.scrollBy({ left: -18 });
      else if (event.clientX > rect.right - 54) scroller.scrollBy({ left: 18 });
    }
  }

  function cleanupLaneDrag() {
    if (!state.laneDrag) return;
    const { handle, pointerId, lane, ghost } = state.laneDrag;
    try {
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    } catch {
      // Capture may already be released by the browser.
    }
    lane.classList.remove("is-lane-dragging");
    ghost.remove();
    clearLaneDropIndicators();
    document.body.classList.remove("is-dragging");
    window.removeEventListener("pointermove", handleLaneDragMove);
    window.removeEventListener("pointerup", endLaneDrag);
    window.removeEventListener("pointercancel", cancelLaneDrag);
  }

  function endLaneDrag(event) {
    if (!state.laneDrag || event.pointerId !== state.laneDrag.pointerId) return;
    const completed = {
      area: state.laneDrag.area,
      dropIndex: state.laneDrag.dropIndex,
    };
    cleanupLaneDrag();
    state.laneDrag = null;
    if (completed.dropIndex !== null && reorderArea(completed.area, completed.dropIndex)) {
      showToast(`Đã đổi vị trí ${areaLabel(completed.area)}. Hãy lưu cấu hình để áp dụng.`);
    }
  }

  function cancelLaneDrag(event) {
    if (!state.laneDrag || (event && event.pointerId !== state.laneDrag.pointerId)) return;
    cleanupLaneDrag();
    state.laneDrag = null;
  }

  function clearDropIndicators() {
    $$(".admin-lane.is-drop-target", elements.adminBoard).forEach((item) => item.classList.remove("is-drop-target"));
    $$(".admin-product.is-drop-before, .admin-product.is-drop-after", elements.adminBoard).forEach((item) =>
      item.classList.remove("is-drop-before", "is-drop-after"),
    );
  }

  function isMobileLayout() {
    return window.matchMedia?.("(max-width: 760px)")?.matches ?? window.innerWidth <= 760;
  }

  function beginDrag(event) {
    const handle = event.target.closest(".drag-handle");
    if (
      !handle ||
      isMobileLayout() ||
      handle.disabled ||
      !state.adminDraft ||
      state.configSaving ||
      state.drag ||
      state.laneDrag ||
      (event.button !== undefined && event.button !== 0)
    ) {
      return;
    }
    const card = handle.closest(".admin-product");
    const lane = handle.closest(".admin-lane");
    if (!card || !lane) return;

    event.preventDefault();
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.classList.remove("is-dragging");
    ghost.removeAttribute("data-admin-sku");
    const select = $("select", ghost);
    if (select) select.remove();
    ghost.style.width = `${Math.min(rect.width, 280)}px`;
    document.body.append(ghost);

    state.drag = {
      pointerId: event.pointerId,
      sku: card.dataset.adminSku,
      name: $(".admin-product-name", card)?.textContent || "Sản phẩm",
      sourceArea: lane.dataset.adminArea,
      sourceIndex: draftProductsForArea(lane.dataset.adminArea).findIndex((product) => product.sku === card.dataset.adminSku),
      card,
      handle,
      ghost,
      offsetX: Math.min(event.clientX - rect.left, Math.min(rect.width, 280) - 10),
      offsetY: Math.min(event.clientY - rect.top, rect.height - 8),
      drop: null,
    };

    card.classList.add("is-dragging");
    document.body.classList.add("is-dragging");
    positionGhost(event.clientX, event.clientY);
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; global listeners still handle the drag.
    }

    window.addEventListener("pointermove", handleDragMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", cancelDrag);
  }

  function positionGhost(x, y) {
    if (!state.drag) return;
    state.drag.ghost.style.left = `${x - state.drag.offsetX}px`;
    state.drag.ghost.style.top = `${y - state.drag.offsetY}px`;
  }

  function handleDragMove(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) return;
    event.preventDefault();
    positionGhost(event.clientX, event.clientY);
    clearDropIndicators();

    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const lane = hit?.closest?.(".admin-lane");
    if (!lane || !elements.adminBoard.contains(lane)) {
      state.drag.drop = null;
      return;
    }

    const targetArea = lane.dataset.adminArea;
    lane.classList.add("is-drop-target");
    const targetCard = hit.closest(".admin-product");
    const products = draftProductsForArea(targetArea);
    let index = products.length;

    if (targetCard && targetCard !== state.drag.card) {
      const targetSku = targetCard.dataset.adminSku;
      const targetIndex = products.findIndex((product) => product.sku === targetSku);
      const rect = targetCard.getBoundingClientRect();
      const after = event.clientY >= rect.top + rect.height / 2;
      index = targetIndex + (after ? 1 : 0);
      targetCard.classList.add(after ? "is-drop-after" : "is-drop-before");
    } else if (targetCard === state.drag.card) {
      index = state.drag.sourceIndex;
    }

    if (targetArea === state.drag.sourceArea && state.drag.sourceIndex < index) index -= 1;
    state.drag.drop = { area: targetArea, index: Math.max(0, index) };

    const scrollBox = $(".lane-products", lane);
    if (scrollBox) {
      const rect = scrollBox.getBoundingClientRect();
      if (event.clientY < rect.top + 42) scrollBox.scrollBy({ top: -14 });
      else if (event.clientY > rect.bottom - 42) scrollBox.scrollBy({ top: 14 });
    }

    const assignedScroller = $(".assigned-lanes", elements.adminBoard);
    if (assignedScroller) {
      const rect = assignedScroller.getBoundingClientRect();
      if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
        if (event.clientX < rect.left + 48) assignedScroller.scrollBy({ left: -16 });
        else if (event.clientX > rect.right - 48) assignedScroller.scrollBy({ left: 16 });
      }
    }

    const pageEdge = 70;
    if (event.clientY < pageEdge) window.scrollBy({ top: -16 });
    else if (event.clientY > window.innerHeight - pageEdge) window.scrollBy({ top: 16 });
  }

  function cleanupDrag() {
    if (!state.drag) return;
    const { handle, pointerId, card, ghost } = state.drag;
    try {
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    } catch {
      // No-op when capture is unavailable or already released.
    }
    card.classList.remove("is-dragging");
    ghost.remove();
    clearDropIndicators();
    document.body.classList.remove("is-dragging");
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", cancelDrag);
  }

  function endDrag(event) {
    if (!state.drag || event.pointerId !== state.drag.pointerId) return;
    const completed = { ...state.drag, drop: state.drag.drop ? { ...state.drag.drop } : null };
    cleanupDrag();
    state.drag = null;
    if (completed.drop && moveProduct(completed.sku, completed.drop.area, completed.drop.index)) {
      showToast(`Đã chuyển ${completed.name} tới ${areaLabel(completed.drop.area)}.`);
    }
  }

  function cancelDrag(event) {
    if (!state.drag || (event && event.pointerId !== state.drag.pointerId)) return;
    cleanupDrag();
    state.drag = null;
  }

  function openAreaDialog(mode, area = "") {
    if (!state.adminDraft) return;
    state.dialog = { mode, area };
    elements.areaDialogError.hidden = true;
    elements.areaDialogIcon.classList.toggle("is-danger", mode === "delete");
    elements.areaDialogConfirm.classList.toggle("button-primary", mode !== "delete");
    elements.areaDialogConfirm.classList.toggle("button-danger", mode === "delete");

    if (mode === "add") {
      elements.areaDialogTitle.textContent = "Thêm khu mới";
      elements.areaDialogCopy.textContent = "Đặt tên ngắn để dễ nhìn khi đếm kho.";
      elements.areaNameField.hidden = false;
      elements.areaDestinationField.hidden = true;
      elements.areaNameInput.value = "";
      elements.areaDialogConfirm.textContent = "Thêm khu";
    } else if (mode === "rename") {
      elements.areaDialogTitle.textContent = `Đổi tên ${area}`;
      elements.areaDialogCopy.textContent = "Tên mới sẽ được áp dụng cho mọi sản phẩm trong khu.";
      elements.areaNameField.hidden = false;
      elements.areaDestinationField.hidden = true;
      elements.areaNameInput.value = area;
      elements.areaDialogConfirm.textContent = "Đổi tên";
    } else {
      const productCount = draftProductsForArea(area).length;
      const destinations = adminLanes().filter((item) => item !== area);
      elements.areaDialogTitle.textContent = `Xóa ${area}?`;
      elements.areaDialogCopy.textContent = productCount
        ? `${productCount} sản phẩm trong khu cần được chuyển sang nơi khác.`
        : "Khu trống sẽ được xóa khỏi danh sách.";
      elements.areaNameField.hidden = true;
      elements.areaDestinationField.hidden = productCount === 0;
      elements.areaDestinationSelect.innerHTML = destinations
        .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(adminAreaLabel(item))}</option>`)
        .join("");
      elements.areaDialogConfirm.textContent = "Xóa khu";
    }

    if (typeof elements.areaDialog.showModal === "function") elements.areaDialog.showModal();
    else elements.areaDialog.setAttribute("open", "");

    window.setTimeout(() => {
      if (mode === "delete" && !elements.areaDestinationField.hidden) elements.areaDestinationSelect.focus();
      else if (mode !== "delete") elements.areaNameInput.focus();
    }, 20);
  }

  function closeAreaDialog() {
    state.dialog = null;
    if (typeof elements.areaDialog.close === "function") elements.areaDialog.close();
    else elements.areaDialog.removeAttribute("open");
  }

  function handleAreaDialogSubmit(event) {
    event.preventDefault();
    if (!state.dialog || !state.adminDraft) return;
    const { mode, area } = state.dialog;
    elements.areaDialogError.hidden = true;

    if (mode === "delete") {
      const products = draftProductsForArea(area);
      const destination = elements.areaDestinationSelect.value;
      if (products.length && !destination) {
        elements.areaDialogError.textContent = "Hãy chọn khu nhận sản phẩm.";
        elements.areaDialogError.hidden = false;
        return;
      }
      const previous = captureAdminState();
      products.forEach((product, index) => {
        const targetLength = draftProductsForArea(destination).length;
        state.adminDraft.assignments[product.sku] = { area: destination, order: targetLength + index };
      });
      state.adminDraft.areas = state.adminDraft.areas.filter((item) => item !== area);
      normalizeDraftOrders();
      commitAdminChange(previous);
      closeAreaDialog();
      renderAdminBoard();
      showToast(`Đã xóa ${area}. Hãy lưu cấu hình để áp dụng.`);
      return;
    }

    const name = elements.areaNameInput.value.replace(/\s+/g, " ").trim();
    if (!name) {
      elements.areaDialogError.textContent = "Tên khu không được để trống.";
      elements.areaDialogError.hidden = false;
      elements.areaNameInput.focus();
      return;
    }
    const duplicate = [...state.adminDraft.areas, UNASSIGNED_LABEL, UNASSIGNED_AREA].some(
      (item) => item !== area && item.toLocaleLowerCase("vi-VN") === name.toLocaleLowerCase("vi-VN"),
    );
    if (duplicate) {
      elements.areaDialogError.textContent = "Tên khu này đã tồn tại.";
      elements.areaDialogError.hidden = false;
      elements.areaNameInput.select();
      return;
    }

    const previous = captureAdminState();
    let message = "";
    if (mode === "add") {
      state.adminDraft.areas.push(name);
      message = `Đã thêm ${name}.`;
    } else {
      const index = state.adminDraft.areas.indexOf(area);
      state.adminDraft.areas[index] = name;
      Object.values(state.adminDraft.assignments).forEach((assignment) => {
        if (assignment.area === area) assignment.area = name;
      });
      message = `Đã đổi tên ${area} thành ${name}.`;
    }
    normalizeDraftOrders();
    const changed = commitAdminChange(previous);
    closeAreaDialog();
    renderAdminBoard();
    if (changed) showToast(message);
  }

  async function saveConfig() {
    if (!state.ready || !state.adminDraft || !state.configDirty || state.configSaving) return;
    cancelDrag();
    cancelLaneDrag();
    normalizeDraftOrders();
    const inventoryTemplateValidation = validateInventoryReportTemplate(state.adminDraft.inventoryReportTemplate);
    if (inventoryTemplateValidation.error) {
      renderInventoryReportTemplateEditor();
      elements.inventoryReportTemplate.focus();
      showToast(inventoryTemplateValidation.error, "error", 4500);
      return;
    }
    const templateValidation = validateSalesCopyTemplate(state.adminDraft.salesCopyTemplate);
    if (templateValidation.error) {
      renderSalesCopyTemplateEditor();
      elements.salesCopyTemplate.focus();
      showToast(templateValidation.error, "error", 4500);
      return;
    }
    state.adminDraft.inventoryReportTemplate = inventoryTemplateValidation.value;
    state.adminDraft.salesCopyTemplate = templateValidation.value;
    state.configSaving = true;
    setAdminConfigBusy(true);
    setConfigDirty(true);
    setButtonBusy(elements.saveConfig, true, "Đang lưu…");

    const body = {
      areas: [...state.adminDraft.areas],
      salesCopyTemplate: state.adminDraft.salesCopyTemplate,
      inventoryReportTemplate: state.adminDraft.inventoryReportTemplate,
      assignments: Object.fromEntries(
        Object.entries(state.adminDraft.assignments)
          .filter(([, assignment]) => assignment.area !== UNASSIGNED_AREA)
          .map(([sku, assignment]) => [sku, { area: assignment.area, order: assignment.order }]),
      ),
    };

    try {
      const payload = await api(API.config, { method: "PUT", body });
      const savedAreas = Array.isArray(payload?.areas) ? uniqueStrings(payload.areas) : body.areas;
      const savedAssignments = payload?.assignments && typeof payload.assignments === "object" ? payload.assignments : body.assignments;
      state.salesCopyTemplate = normalizeSalesCopyTemplate(payload?.salesCopyTemplate ?? body.salesCopyTemplate);
      state.inventoryReportTemplate = normalizeInventoryReportTemplate(
        payload?.inventoryReportTemplate ?? body.inventoryReportTemplate,
      );
      state.areas = savedAreas;
      state.products.forEach((product) => {
        const assignment = savedAssignments[product.sku] || body.assignments[product.sku];
        if (assignment) {
          product.area = String(assignment.area);
          product.order = asFiniteNumber(assignment.order, product.order);
        } else {
          product.area = UNASSIGNED_AREA;
        }
      });
      state.adminDraft = null;
      state.adminHistory = [];
      ensureAdminDraft();
      state.configDirty = false;
      renderCount();
      renderAdminBoard();
      showToast("Đã lưu cấu hình.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        state.session.authenticated = false;
        state.session.username = "";
        state.adminDraft = null;
        state.adminHistory = [];
        state.configDirty = false;
        renderAdminAuth();
        showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "error", 5000);
      } else {
        showToast(getErrorMessage(error, "Không thể lưu cấu hình."), "error", 4500);
      }
    } finally {
      state.configSaving = false;
      setAdminConfigBusy(false);
      setButtonBusy(elements.saveConfig, false);
      setConfigDirty(state.configDirty);
      renderInventoryReportTemplateEditor();
      renderSalesCopyTemplateEditor();
    }
  }

  function bindEvents() {
    elements.tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let targetIndex = index;
        if (event.key === "ArrowLeft") targetIndex = (index - 1 + elements.tabs.length) % elements.tabs.length;
        if (event.key === "ArrowRight") targetIndex = (index + 1) % elements.tabs.length;
        if (event.key === "Home") targetIndex = 0;
        if (event.key === "End") targetIndex = elements.tabs.length - 1;
        const target = elements.tabs[targetIndex];
        activateTab(target.dataset.tab);
        target.focus();
      });
    });
    elements.mainContent.addEventListener("touchstart", beginTabSwipe, { passive: true });
    elements.mainContent.addEventListener("touchend", endTabSwipe, { passive: true });
    elements.mainContent.addEventListener("touchcancel", cancelTabSwipe, { passive: true });
    elements.refreshButton.addEventListener("click", () => loadBootstrap({ silent: state.ready, force: true }));
    elements.retryBootstrap.addEventListener("click", () => loadBootstrap({ force: true }));
    elements.retryOverview.addEventListener("click", () => loadBootstrap({ force: true }));
    elements.statPendingCard.addEventListener("click", handlePendingStatNavigation);
    elements.statPendingCard.addEventListener("keydown", handlePendingStatNavigation);
    elements.exportInventoryReport.addEventListener("click", openInventoryReportDialog);
    elements.inventoryReportCopy.addEventListener("click", handleInventoryReportCopy);
    elements.inventoryReportClose.addEventListener("click", closeInventoryReportDialog);
    elements.inventoryReportDialog.addEventListener("click", (event) => {
      if (event.target === elements.inventoryReportDialog) closeInventoryReportDialog();
    });
    elements.inventoryReportDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeInventoryReportDialog();
    });
    elements.lookupFilePicker.addEventListener("click", chooseLookupFile);
    elements.lookupFileReplace.addEventListener("click", chooseLookupFile);
    elements.lookupFileInput.addEventListener("change", () => {
      selectLookupFile(elements.lookupFileInput.files?.[0] || null);
    });
    ["dragenter", "dragover"].forEach((eventName) => {
      elements.lookupDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (!state.lookup.balancing) elements.lookupDropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      elements.lookupDropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.lookupDropzone.classList.remove("is-dragover");
      });
    });
    elements.lookupDropzone.addEventListener("drop", (event) => {
      if (state.lookup.balancing) return;
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length !== 1) {
        state.lookup.file = null;
        state.lookup.error = "Vui lòng chỉ chọn một file Excel .xlsx.";
        state.lookup.result = null;
        renderLookupFile();
        return;
      }
      selectLookupFile(files[0]);
    });
    elements.lookupBalanceButton.addEventListener("click", openLookupBalanceDialog);
    elements.lookupBalanceRetry.addEventListener("click", handleLookupBalance);
    elements.lookupBalanceClose.addEventListener("click", closeLookupBalanceDialog);
    elements.lookupBalanceDialog.addEventListener("click", (event) => {
      if (event.target === elements.lookupBalanceDialog) closeLookupBalanceDialog();
    });
    elements.lookupBalanceDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeLookupBalanceDialog();
    });
    elements.clearFilters.addEventListener("click", () => {
      state.search = "";
      elements.search.value = "";
      renderCount();
    });

    elements.search.addEventListener("input", () => {
      state.search = elements.search.value;
      if (!renderDetailProductsForSearch()) renderCount();
    });
    elements.areaList.addEventListener("click", handleCountAreaNavigation);
    elements.areaList.addEventListener("click", handleCountClick);
    elements.areaList.addEventListener("change", handleEnoughCheckboxChange);
    elements.salesDetailList.addEventListener("click", handleSalesCopy);

    elements.loginForm.addEventListener("submit", handleLogin);
    elements.togglePassword.addEventListener("click", () => {
      const showing = elements.loginPassword.type === "text";
      elements.loginPassword.type = showing ? "password" : "text";
      elements.togglePassword.setAttribute("aria-label", showing ? "Hiện mật khẩu" : "Ẩn mật khẩu");
      elements.togglePassword.setAttribute("title", showing ? "Hiện mật khẩu" : "Ẩn mật khẩu");
      elements.togglePassword.innerHTML = icon(showing ? "eye" : "eye-off");
      elements.loginPassword.focus();
    });
    elements.logoutButton.addEventListener("click", handleLogout);
    elements.undoConfig.addEventListener("click", undoAdminConfig);
    elements.saveConfig.addEventListener("click", saveConfig);
    elements.salesCopyTemplate.addEventListener("focus", beginSalesCopyTemplateEdit);
    elements.salesCopyTemplate.addEventListener("input", updateSalesCopyTemplateDraft);
    elements.salesCopyTemplate.addEventListener("blur", () => {
      salesCopyTemplateEditSession = null;
    });
    elements.resetSalesCopyTemplate.addEventListener("click", resetSalesCopyTemplate);
    elements.inventoryReportTemplate.addEventListener("focus", beginInventoryReportTemplateEdit);
    elements.inventoryReportTemplate.addEventListener("input", updateInventoryReportTemplateDraft);
    elements.inventoryReportTemplate.addEventListener("blur", () => {
      inventoryReportTemplateEditSession = null;
    });
    elements.resetInventoryReportTemplate.addEventListener("click", resetInventoryReportTemplate);

    elements.adminBoard.addEventListener("click", (event) => {
      const action = event.target.closest("[data-admin-action]");
      if (!action) return;
      const { adminAction, area } = action.dataset;
      if (adminAction === "add-area") {
        openAreaDialog("add");
        return;
      }
      if (adminAction === "unassign") {
        const sku = action.dataset.sku;
        const product = state.products.find((item) => item.sku === sku);
        if (state.adminDraft.assignments[sku]?.area !== UNASSIGNED_AREA) {
          const moved = moveProduct(sku, UNASSIGNED_AREA, Infinity);
          if (moved && product) showToast(`Đã đưa ${product.name} về Chưa phân khu.`);
        }
        return;
      }
      if (["lane-left", "lane-right"].includes(adminAction)) {
        const currentIndex = state.adminDraft.areas.indexOf(area);
        const nextIndex = currentIndex + (adminAction === "lane-left" ? -1 : 1);
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.adminDraft.areas.length) return;
        if (reorderArea(area, nextIndex)) {
          const replacement = $$(".admin-lane", elements.adminBoard).find((lane) => lane.dataset.adminArea === area);
          const focusTarget =
            replacement?.querySelector(`[data-admin-action="${adminAction}"]:not(:disabled)`) ||
            replacement?.querySelector(".lane-reorder-button:not(:disabled)");
          focusTarget?.focus();
          showToast(`Đã đổi vị trí ${areaLabel(area)}. Hãy lưu cấu hình để áp dụng.`);
        }
        return;
      }
      if (adminAction === "rename") openAreaDialog("rename", area);
      if (adminAction === "delete") {
        if (state.adminDraft.areas.length <= 1) {
          showToast("Kho cần có ít nhất một khu.", "error");
          return;
        }
        openAreaDialog("delete", area);
      }
      if (["up", "down"].includes(adminAction)) {
        const sku = action.dataset.sku;
        const currentArea = state.adminDraft.assignments[sku]?.area;
        const products = draftProductsForArea(currentArea);
        const currentIndex = products.findIndex((product) => product.sku === sku);
        if (currentIndex >= 0) moveProduct(sku, currentArea, currentIndex + (adminAction === "up" ? -1 : 1));
      }
    });
    elements.adminBoard.addEventListener("input", (event) => {
      const assignedInput = event.target.closest("#admin-assigned-search");
      if (assignedInput) {
        state.adminAssignedSearch = assignedInput.value;
        const query = normalizeText(state.adminAssignedSearch);
        const firstMatch = applyAdminAssignedSearch();
        scheduleAdminAssignedMatchReveal(firstMatch, query);
        return;
      }
      const unassignedInput = event.target.closest("#admin-unassigned-search");
      if (!unassignedInput) return;
      state.adminUnassignedSearch = unassignedInput.value;
      applyAdminUnassignedSearch();
    });
    elements.adminBoard.addEventListener("change", (event) => {
      const select = event.target.closest(".area-select");
      if (!select) return;
      const product = state.products.find((item) => item.sku === select.dataset.sku);
      const moved = moveProduct(select.dataset.sku, select.value, Infinity);
      if (moved && product) showToast(`Đã chuyển ${product.name} tới ${areaLabel(select.value)}.`);
    });
    elements.adminBoard.addEventListener("keydown", (event) => {
      const laneHandle = event.target.closest(".lane-drag-handle");
      if (laneHandle && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const area = laneHandle.closest(".admin-lane")?.dataset.adminArea;
        const currentIndex = state.adminDraft.areas.indexOf(area);
        const nextIndex = currentIndex + (event.key === "ArrowLeft" ? -1 : 1);
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.adminDraft.areas.length) return;
        if (reorderArea(area, nextIndex)) {
          const replacement = $$(".admin-lane", elements.adminBoard).find((lane) => lane.dataset.adminArea === area);
          replacement?.querySelector(".lane-drag-handle")?.focus();
        }
        return;
      }

      const handle = event.target.closest(".drag-handle");
      if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const sku = handle.closest(".admin-product")?.dataset.adminSku;
      const currentArea = state.adminDraft.assignments[sku]?.area;
      const products = draftProductsForArea(currentArea);
      const currentIndex = products.findIndex((product) => product.sku === sku);
      const nextIndex = currentIndex + (event.key === "ArrowUp" ? -1 : 1);
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= products.length) return;
      moveProduct(sku, currentArea, nextIndex);
      const replacement = $$(".admin-product", elements.adminBoard).find((card) => card.dataset.adminSku === sku);
      replacement?.querySelector(".drag-handle")?.focus();
    });
    elements.adminBoard.addEventListener("pointerdown", beginLaneDrag);
    elements.adminBoard.addEventListener("pointerdown", beginDrag);

    elements.areaDialogForm.addEventListener("submit", handleAreaDialogSubmit);
    elements.areaDialogCancel.addEventListener("click", closeAreaDialog);
    elements.areaDialog.addEventListener("click", (event) => {
      if (event.target === elements.areaDialog) closeAreaDialog();
    });
    elements.areaDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeAreaDialog();
    });

    window.addEventListener("hashchange", () => activateTab(location.hash.slice(1), { updateHash: false }));
    window.addEventListener("online", () => {
      setSyncStatus(state.ready ? "online" : "loading", state.ready ? formatFetchedAt(state.source.fetchedAt) : "Đang kết nối");
    });
    window.addEventListener("offline", () => setSyncStatus("error", "Đang ngoại tuyến"));
    window.addEventListener("focus", () => ensureCurrentCountDate());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) ensureCurrentCountDate();
    });
    window.setInterval(() => ensureCurrentCountDate(), 60_000);
    window.addEventListener("beforeunload", (event) => {
      if (!state.configDirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
    document.addEventListener("keydown", (event) => {
      const tag = document.activeElement?.tagName;
      if (event.key === "/" && state.activeTab === "count" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        event.preventDefault();
        elements.search.focus();
      }
      if (event.key === "Escape" && state.search && document.activeElement === elements.search) {
        elements.search.value = "";
        state.search = "";
        renderCount();
      }
    });
  }

  function init() {
    bindEvents();
    const requestedTab = location.hash.slice(1);
    const initialTab = TAB_NAMES.has(requestedTab) ? requestedTab : "overview";
    activateTab(initialTab, { updateHash: false });
    loadBootstrap();
  }

  init();
})();
