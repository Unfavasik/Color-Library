// ColorNest guest limits: 7 free copies per day without login; saving requires login.
// Logged-in users (localStorage "cn_user") have no limits.
(function () {
  var KEY_COPIES = "cn_copies";
  var KEY_COPIES_DATE = "cn_copies_date";
  var KEY_USER = "cn_user";
  var FREE_LIMIT = 7;

  function getTodayDateString() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function getUser() {
    try {
      var u = JSON.parse(localStorage.getItem(KEY_USER) || "null");
      if (u && (u.id || u.email || u.user_metadata)) return u;
      return null;
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getUser();
  }

  function getCopies() {
    var today = getTodayDateString();
    var storedDate = localStorage.getItem(KEY_COPIES_DATE);
    if (storedDate !== today) {
      try {
        localStorage.setItem(KEY_COPIES_DATE, today);
        localStorage.setItem(KEY_COPIES, "0");
      } catch (e) {}
      return 0;
    }
    var count = parseInt(localStorage.getItem(KEY_COPIES) || "0", 10);
    return isNaN(count) ? 0 : count;
  }

  function incrementCopies() {
    var count = getCopies() + 1;
    try {
      localStorage.setItem(KEY_COPIES_DATE, getTodayDateString());
      localStorage.setItem(KEY_COPIES, String(count));
    } catch (e) {}
    return count;
  }

  function syncAuthClass() {
    if (isLoggedIn()) {
      document.documentElement.classList.add("cn-logged-in");
      if (document.body) document.body.classList.add("cn-logged-in");
    } else {
      document.documentElement.classList.remove("cn-logged-in");
      if (document.body) document.body.classList.remove("cn-logged-in");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncAuthClass);
  } else {
    syncAuthClass();
  }

  // Inject Styles
  function injectStyles() {
    if (document.getElementById("cn-copy-limit-styles")) return;
    var style = document.createElement("style");
    style.id = "cn-copy-limit-styles";
    style.textContent = [
      "/* Hide default simple toast for non-logged in users so only rich copy-limit toast shows */",
      "html:not(.cn-logged-in) #toast, body:not(.cn-logged-in) #toast { display: none !important; }",
      "",
      "/* Rich Copy Limit Toast */",
      ".cn-copy-toast {",
      "  position: fixed;",
      "  left: 50%;",
      "  bottom: 84px;",
      "  transform: translateX(-50%) translateY(20px);",
      "  background: #0f172a;",
      "  color: #f8fafc;",
      "  border: 1px solid rgba(255, 255, 255, 0.14);",
      "  border-radius: 999px;",
      "  padding: 8px 16px 8px 10px;",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 10px;",
      "  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.38), 0 2px 8px rgba(0, 0, 0, 0.2);",
      "  z-index: 100001;",
      "  opacity: 0;",
      "  pointer-events: none;",
      "  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);",
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;",
      "  white-space: nowrap;",
      "  max-width: calc(100vw - 32px);",
      "  box-sizing: border-box;",
      "}",
      "@media (max-width: 520px) {",
      "  .cn-copy-toast {",
      "    bottom: calc(76px + env(safe-area-inset-bottom, 0px));",
      "    border-radius: 16px;",
      "    padding: 10px 14px;",
      "    white-space: normal;",
      "  }",
      "}",
      ".cn-copy-toast.is-show {",
      "  opacity: 1;",
      "  transform: translateX(-50%) translateY(0);",
      "  pointer-events: auto;",
      "}",
      ".cn-copy-pill {",
      "  background: #f59e0b;",
      "  color: #0f172a;",
      "  font-weight: 800;",
      "  font-size: 13px;",
      "  padding: 4px 10px;",
      "  border-radius: 999px;",
      "  letter-spacing: 0.02em;",
      "  flex-shrink: 0;",
      "  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);",
      "}",
      ".cn-copy-pill.is-limit {",
      "  background: #ef4444;",
      "  color: #ffffff;",
      "  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);",
      "}",
      ".cn-copy-text {",
      "  display: flex;",
      "  flex-direction: column;",
      "  line-height: 1.25;",
      "}",
      ".cn-copy-title {",
      "  font-size: 13px;",
      "  font-weight: 700;",
      "  color: #ffffff;",
      "}",
      ".cn-copy-sub {",
      "  font-size: 11.5px;",
      "  font-weight: 500;",
      "  color: #cbd5e1;",
      "}",
      ".cn-copy-login-link {",
      "  background: linear-gradient(135deg, #7c3aed, #9333ea);",
      "  color: #ffffff !important;",
      "  font-size: 12px;",
      "  font-weight: 800;",
      "  padding: 6px 14px;",
      "  border-radius: 999px;",
      "  text-decoration: none;",
      "  margin-left: 4px;",
      "  flex-shrink: 0;",
      "  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);",
      "  transition: transform 0.15s ease;",
      "  display: inline-flex;",
      "  align-items: center;",
      "}",
      ".cn-copy-login-link:hover {",
      "  transform: scale(1.05);",
      "}",
      "",
      "/* Limit Reached Modal - ColourNest Creator Edition */",
      ".cn-limit-modal-backdrop {",
      "  position: fixed;",
      "  inset: 0;",
      "  background: rgba(15, 23, 42, 0.68);",
      "  backdrop-filter: blur(10px);",
      "  -webkit-backdrop-filter: blur(10px);",
      "  z-index: 100005;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  padding: 16px;",
      "  opacity: 0;",
      "  pointer-events: none;",
      "  transition: opacity 0.25s ease;",
      "  box-sizing: border-box;",
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;",
      "}",
      ".cn-limit-modal-backdrop.is-open {",
      "  opacity: 1;",
      "  pointer-events: auto;",
      "}",
      ".cn-limit-modal-card {",
      "  background: #ffffff;",
      "  background-image: radial-gradient(circle at 8% 8%, rgba(244, 114, 182, 0.12), transparent 35%), radial-gradient(circle at 92% 12%, rgba(56, 189, 248, 0.12), transparent 35%);",
      "  color: #0f172a;",
      "  border-radius: 32px;",
      "  max-width: 440px;",
      "  width: 100%;",
      "  max-height: 92vh;",
      "  overflow-y: auto;",
      "  padding: 24px 24px 20px;",
      "  box-shadow: 0 30px 60px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;",
      "  text-align: center;",
      "  position: relative;",
      "  transform: scale(0.92);",
      "  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);",
      "  box-sizing: border-box;",
      "}",
      "html.dark .cn-limit-modal-card {",
      "  background: #0f172a;",
      "  background-image: radial-gradient(circle at 8% 8%, rgba(244, 114, 182, 0.15), transparent 35%), radial-gradient(circle at 92% 12%, rgba(56, 189, 248, 0.15), transparent 35%);",
      "  color: #f8fafc;",
      "  border: 1px solid rgba(255, 255, 255, 0.1);",
      "  box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.6);",
      "}",
      ".cn-limit-modal-backdrop.is-open .cn-limit-modal-card {",
      "  transform: scale(1);",
      "}",
      "",
      "/* Top Brand Bar */",
      ".cn-limit-brand-row {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  margin-bottom: 8px;",
      "}",
      ".cn-limit-brand {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 10px;",
      "  text-align: left;",
      "}",
      ".cn-limit-brand-sphere {",
      "  width: 34px;",
      "  height: 34px;",
      "  border-radius: 50%;",
      "  background: linear-gradient(135deg, #a855f7 0%, #ec4899 45%, #3b82f6 100%);",
      "  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.35);",
      "  flex-shrink: 0;",
      "}",
      ".cn-limit-brand-text {",
      "  display: flex;",
      "  flex-direction: column;",
      "  line-height: 1.15;",
      "}",
      ".cn-limit-brand-title {",
      "  font-size: 17px;",
      "  font-weight: 900;",
      "  color: #0f172a;",
      "  letter-spacing: -0.02em;",
      "}",
      "html.dark .cn-limit-brand-title {",
      "  color: #ffffff;",
      "}",
      ".cn-brand-nest {",
      "  color: #0284c7;",
      "}",
      ".cn-limit-brand-tagline {",
      "  font-size: 11px;",
      "  font-weight: 600;",
      "  color: #64748b;",
      "}",
      "html.dark .cn-limit-brand-tagline {",
      "  color: #94a3b8;",
      "}",
      ".cn-limit-modal-close {",
      "  width: 34px;",
      "  height: 34px;",
      "  border-radius: 50%;",
      "  border: none;",
      "  background: #f1f5f9;",
      "  color: #64748b;",
      "  cursor: pointer;",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  transition: background 0.15s ease, transform 0.15s ease;",
      "}",
      "html.dark .cn-limit-modal-close {",
      "  background: rgba(255, 255, 255, 0.08);",
      "  color: #cbd5e1;",
      "}",
      ".cn-limit-modal-close:hover {",
      "  background: #e2e8f0;",
      "  transform: scale(1.05);",
      "}",
      "",
      "/* 3D Visual Art */",
      ".cn-limit-art-wrap {",
      "  margin: 6px auto 10px;",
      "  display: flex;",
      "  justify-content: center;",
      "  align-items: center;",
      "  position: relative;",
      "}",
      ".cn-limit-art-svg {",
      "  width: 100%;",
      "  max-width: 290px;",
      "  height: auto;",
      "  display: block;",
      "}",
      "",
      "/* Headings */",
      ".cn-limit-modal-title {",
      "  font-size: 26px;",
      "  font-weight: 900;",
      "  line-height: 1.2;",
      "  margin: 0 0 10px;",
      "  letter-spacing: -0.02em;",
      "  color: #0f172a;",
      "}",
      "html.dark .cn-limit-modal-title {",
      "  color: #ffffff;",
      "}",
      ".cn-gradient-word {",
      "  background: linear-gradient(135deg, #a855f7 0%, #ec4899 45%, #2563eb 100%);",
      "  -webkit-background-clip: text;",
      "  -webkit-text-fill-color: transparent;",
      "  display: inline-block;",
      "}",
      ".cn-limit-modal-desc {",
      "  font-size: 13.5px;",
      "  color: #64748b;",
      "  line-height: 1.55;",
      "  margin: 0 auto 18px;",
      "  max-width: 380px;",
      "}",
      "html.dark .cn-limit-modal-desc {",
      "  color: #94a3b8;",
      "}",
      "",
      "/* 4 Perks Grid */",
      ".cn-limit-perks {",
      "  background: #f8fafc;",
      "  border: 1px solid #f1f5f9;",
      "  border-radius: 20px;",
      "  padding: 12px 6px;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  margin-bottom: 18px;",
      "}",
      "html.dark .cn-limit-perks {",
      "  background: rgba(255, 255, 255, 0.03);",
      "  border-color: rgba(255, 255, 255, 0.08);",
      "}",
      ".cn-perk-item {",
      "  flex: 1;",
      "  display: flex;",
      "  flex-direction: column;",
      "  align-items: center;",
      "  text-align: center;",
      "  padding: 0 2px;",
      "}",
      ".cn-perk-icon-wrap {",
      "  width: 36px;",
      "  height: 36px;",
      "  border-radius: 50%;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  margin-bottom: 6px;",
      "}",
      ".cn-perk-purple {",
      "  background: #f3e8ff;",
      "  color: #7c3aed;",
      "}",
      ".cn-perk-pink {",
      "  background: #fce7f3;",
      "  color: #ec4899;",
      "}",
      ".cn-perk-blue {",
      "  background: #e0f2fe;",
      "  color: #0284c7;",
      "}",
      ".cn-perk-amber {",
      "  background: #fef3c7;",
      "  color: #d97706;",
      "}",
      "html.dark .cn-perk-purple { background: rgba(124, 58, 237, 0.2); }",
      "html.dark .cn-perk-pink { background: rgba(236, 72, 153, 0.2); }",
      "html.dark .cn-perk-blue { background: rgba(2, 132, 199, 0.2); }",
      "html.dark .cn-perk-amber { background: rgba(217, 119, 6, 0.2); }",
      ".cn-perk-divider {",
      "  width: 1px;",
      "  height: 34px;",
      "  background: #e2e8f0;",
      "  flex-shrink: 0;",
      "}",
      "html.dark .cn-perk-divider {",
      "  background: rgba(255, 255, 255, 0.08);",
      "}",
      ".cn-perk-label {",
      "  font-size: 10.5px;",
      "  font-weight: 700;",
      "  color: #334155;",
      "  line-height: 1.25;",
      "}",
      "html.dark .cn-perk-label {",
      "  color: #cbd5e1;",
      "}",
      "",
      "/* Buttons */",
      ".cn-limit-modal-actions {",
      "  display: flex;",
      "  flex-direction: column;",
      "  gap: 10px;",
      "  margin-bottom: 18px;",
      "}",
      ".cn-limit-btn-primary {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  gap: 10px;",
      "  background: linear-gradient(90deg, #3b82f6 0%, #7c3aed 45%, #ec4899 100%);",
      "  color: #ffffff !important;",
      "  font-size: 14.5px;",
      "  font-weight: 800;",
      "  padding: 14px 22px;",
      "  border-radius: 999px;",
      "  text-decoration: none;",
      "  box-shadow: 0 8px 24px -4px rgba(124, 58, 237, 0.45);",
      "  transition: transform 0.15s ease, box-shadow 0.15s ease;",
      "}",
      ".cn-limit-btn-primary:hover {",
      "  transform: translateY(-1px);",
      "  box-shadow: 0 12px 28px -4px rgba(124, 58, 237, 0.55);",
      "}",
      ".cn-limit-btn-secondary {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  gap: 8px;",
      "  background: #ffffff;",
      "  color: #0f172a !important;",
      "  font-size: 14px;",
      "  font-weight: 800;",
      "  padding: 12px 20px;",
      "  border-radius: 999px;",
      "  text-decoration: none;",
      "  border: 1.5px solid #e2e8f0;",
      "  transition: background 0.15s ease, border-color 0.15s ease;",
      "}",
      "html.dark .cn-limit-btn-secondary {",
      "  background: rgba(255, 255, 255, 0.05);",
      "  border-color: rgba(255, 255, 255, 0.12);",
      "  color: #f8fafc !important;",
      "}",
      ".cn-limit-btn-secondary:hover {",
      "  background: #f8fafc;",
      "  border-color: #cbd5e1;",
      "}",
      "html.dark .cn-limit-btn-secondary:hover {",
      "  background: rgba(255, 255, 255, 0.1);",
      "}",
      "",
      "/* Social Proof */",
      ".cn-limit-social-proof {",
      "  display: flex;",
      "  flex-direction: column;",
      "  align-items: center;",
      "  gap: 10px;",
      "}",
      ".cn-limit-divider-wrap {",
      "  display: flex;",
      "  align-items: center;",
      "  width: 100%;",
      "  gap: 12px;",
      "}",
      ".cn-limit-divider-line {",
      "  flex: 1;",
      "  height: 1px;",
      "  background: #e2e8f0;",
      "}",
      "html.dark .cn-limit-divider-line {",
      "  background: rgba(255, 255, 255, 0.08);",
      "}",
      ".cn-limit-divider-text {",
      "  font-size: 9.5px;",
      "  font-weight: 800;",
      "  letter-spacing: 0.14em;",
      "  color: #94a3b8;",
      "  text-transform: uppercase;",
      "  white-space: nowrap;",
      "}",
      ".cn-limit-creators-row {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  gap: 8px;",
      "}",
      ".cn-avatar-stack {",
      "  display: flex;",
      "  align-items: center;",
      "}",
      ".cn-avatar-img {",
      "  width: 26px;",
      "  height: 26px;",
      "  border-radius: 50%;",
      "  border: 2px solid #ffffff;",
      "  margin-left: -7px;",
      "  object-fit: cover;",
      "  box-shadow: 0 1px 3px rgba(0,0,0,0.12);",
      "  background: #cbd5e1;",
      "}",
      "html.dark .cn-avatar-img {",
      "  border-color: #0f172a;",
      "}",
      ".cn-avatar-img:first-child {",
      "  margin-left: 0;",
      "}",
      ".cn-pill-10k {",
      "  background: #e0e7ff;",
      "  color: #4338ca;",
      "  font-size: 11px;",
      "  font-weight: 800;",
      "  padding: 3px 8px;",
      "  border-radius: 999px;",
      "}",
      "html.dark .cn-pill-10k {",
      "  background: rgba(99, 102, 241, 0.25);",
      "  color: #c7d2fe;",
      "}",
      ".cn-creators-text {",
      "  font-size: 11px;",
      "  font-weight: 600;",
      "  color: #64748b;",
      "  line-height: 1.2;",
      "  text-align: left;",
      "}",
      "html.dark .cn-creators-text {",
      "  color: #94a3b8;",
      "}",
      ".cn-heart-pill {",
      "  width: 22px;",
      "  height: 22px;",
      "  border-radius: 50%;",
      "  background: #fdf2f8;",
      "  border: 1px solid #fbcfe8;",
      "  color: #ec4899;",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  flex-shrink: 0;",
      "}",
      "html.dark .cn-heart-pill {",
      "  background: rgba(236, 72, 153, 0.15);",
      "  border-color: rgba(236, 72, 153, 0.3);",
      "}",
      ".cn-limit-footer-tagline {",
      "  font-size: 9.5px;",
      "  font-weight: 800;",
      "  letter-spacing: 0.16em;",
      "  color: #94a3b8;",
      "  text-transform: uppercase;",
      "  margin-top: 4px;",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  // Create or Get Toast Container
  var toastEl = null;
  var toastTimer = null;

  function ensureToast() {
    if (toastEl && document.body.contains(toastEl)) return toastEl;
    injectStyles();
    toastEl = document.createElement("div");
    toastEl.id = "cn-copy-toast";
    toastEl.className = "cn-copy-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.innerHTML = [
      '<span class="cn-copy-pill" id="cn-copy-pill">1/7</span>',
      '<div class="cn-copy-text">',
      '  <span class="cn-copy-title" id="cn-copy-title">Copied to clipboard!</span>',
      '  <span class="cn-copy-sub" id="cn-copy-sub">6 free copies left today without login</span>',
      '</div>',
      '<a href="/login" class="cn-copy-login-link" id="cn-copy-login-btn" style="display:none">Login</a>'
    ].join("");
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function showCopyToast(usedCount, copiedText, isBlocked, customMsg) {
    var t = ensureToast();
    var pill = document.getElementById("cn-copy-pill");
    var title = document.getElementById("cn-copy-title");
    var sub = document.getElementById("cn-copy-sub");
    var loginBtn = document.getElementById("cn-copy-login-btn");

    var nextUrl = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
    if (loginBtn) loginBtn.href = nextUrl;

    if (customMsg) {
      if (pill) {
        pill.textContent = (usedCount || 0) + "/" + FREE_LIMIT;
        pill.classList.remove("is-limit");
      }
      if (title) title.textContent = customMsg;
      if (sub) sub.textContent = "Login to get unlimited copies & access all features";
      if (loginBtn) loginBtn.style.display = "inline-flex";
    } else if (isBlocked || usedCount >= FREE_LIMIT) {
      if (pill) {
        pill.textContent = FREE_LIMIT + "/" + FREE_LIMIT;
        pill.classList.add("is-limit");
      }
      if (title) {
        title.textContent = isBlocked ? "Daily Limit Reached!" : "Color copied! (" + FREE_LIMIT + "/" + FREE_LIMIT + ")";
      }
      if (sub) {
        sub.textContent = "Daily limit reached (7/7). Log in for unlimited copies.";
      }
      if (loginBtn) loginBtn.style.display = "inline-flex";
    } else {
      var remaining = Math.max(0, FREE_LIMIT - usedCount);
      if (pill) {
        pill.textContent = usedCount + "/" + FREE_LIMIT;
        pill.classList.remove("is-limit");
      }
      if (title) {
        var cleanSnippet = (typeof copiedText === "string" && copiedText.length > 0 && copiedText.length <= 16)
          ? copiedText + " copied!"
          : "Color code copied!";
        title.textContent = cleanSnippet;
      }
      if (sub) {
        sub.textContent = remaining + " free " + (remaining === 1 ? "copy" : "copies") + " left today without login";
      }
      if (loginBtn) loginBtn.style.display = "none";
    }

    t.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove("is-show");
    }, 2800);
  }

  // Create or Get Limit Modal
  var modalEl = null;

  function ensureModal() {
    if (modalEl && document.body.contains(modalEl)) return modalEl;
    injectStyles();
    modalEl = document.createElement("div");
    modalEl.id = "cn-limit-modal-backdrop";
    modalEl.className = "cn-limit-modal-backdrop";
    modalEl.innerHTML = [
      '<div class="cn-limit-modal-card" role="dialog" aria-modal="true" aria-labelledby="cn-limit-modal-title">',
      '  <!-- Top Brand Row -->',
      '  <div class="cn-limit-brand-row">',
      '    <div class="cn-limit-brand">',
      '      <div class="cn-limit-brand-sphere"></div>',
      '      <div class="cn-limit-brand-text">',
      '        <div class="cn-limit-brand-title">Colour<span class="cn-brand-nest">Nest</span></div>',
      '        <div class="cn-limit-brand-tagline">Colors for Creators</div>',
      '      </div>',
      '    </div>',
      '    <button type="button" class="cn-limit-modal-close" id="cn-limit-close-btn" aria-label="Close modal">',
      '      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      '    </button>',
      '  </div>',
      '',
      '  <!-- 3D Art Illustration -->',
      '  <div class="cn-limit-art-wrap">',
      '    <svg class="cn-limit-art-svg" viewBox="0 0 320 185" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '      <defs>',
      '        <radialGradient id="cn-glow-bg" cx="50%" cy="50%" r="50%">',
      '          <stop offset="0%" stop-color="#fdf2f8" stop-opacity="0.9"/>',
      '          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>',
      '        </radialGradient>',
      '        <linearGradient id="cn-cube-grad" x1="0" y1="0" x2="1" y2="1">',
      '          <stop offset="0%" stop-color="#d8b4fe"/>',
      '          <stop offset="100%" stop-color="#a855f7"/>',
      '        </linearGradient>',
      '        <linearGradient id="cn-pebble-grad" x1="0" y1="0" x2="1" y2="1">',
      '          <stop offset="0%" stop-color="#bae6fd"/>',
      '          <stop offset="100%" stop-color="#38bdf8"/>',
      '        </linearGradient>',
      '        <linearGradient id="cn-sheet-grad" x1="0" y1="0" x2="0" y2="1">',
      '          <stop offset="0%" stop-color="#ffffff"/>',
      '          <stop offset="100%" stop-color="#f1f5f9"/>',
      '        </linearGradient>',
      '        <linearGradient id="cn-pill-grad" x1="0%" y1="0%" x2="100%" y2="100%">',
      '          <stop offset="0%" stop-color="#f43f5e"/>',
      '          <stop offset="45%" stop-color="#e11d48"/>',
      '          <stop offset="100%" stop-color="#c026d3"/>',
      '        </linearGradient>',
      '        <filter id="cn-sheet-shadow" x="-20%" y="-20%" width="140%" height="150%" filterUnits="userSpaceOnUse">',
      '          <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#6366f1" flood-opacity="0.16"/>',
      '          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.08"/>',
      '        </filter>',
      '        <filter id="cn-pill-shadow" x="-25%" y="-35%" width="150%" height="190%" filterUnits="userSpaceOnUse">',
      '          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#e11d48" flood-opacity="0.45"/>',
      '        </filter>',
      '      </defs>',
      '',
      '      <!-- Aura glow -->',
      '      <circle cx="160" cy="85" r="85" fill="url(#cn-glow-bg)"/>',
      '',
      '      <!-- Left floating 3D cube -->',
      '      <g transform="translate(86, 32) rotate(-15)">',
      '        <rect x="0" y="0" width="46" height="46" rx="14" fill="url(#cn-cube-grad)" opacity="0.8" filter="drop-shadow(0 6px 12px rgba(168,85,247,0.25))"/>',
      '        <rect x="3" y="3" width="40" height="40" rx="11" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.45"/>',
      '      </g>',
      '',
      '      <!-- Right floating 3D droplet -->',
      '      <g transform="translate(206, 24)">',
      '        <path d="M12 4 C24 -2, 36 6, 36 18 C36 30, 22 36, 12 30 C2 24, 0 10, 12 4 Z" fill="url(#cn-pebble-grad)" opacity="0.85" filter="drop-shadow(0 6px 12px rgba(56,189,248,0.3))"/>',
      '      </g>',
      '',
      '      <!-- Speed streaks on top right -->',
      '      <line x1="212" y1="40" x2="226" y2="33" stroke="#f43f5e" stroke-width="3" stroke-linecap="round"/>',
      '      <line x1="214" y1="48" x2="230" y2="45" stroke="#fb7185" stroke-width="3" stroke-linecap="round"/>',
      '      <!-- Sparkles -->',
      '      <path d="M98 94 Q98 87 91 87 Q98 87 98 80 Q98 87 105 87 Q98 87 98 94 Z" fill="#f472b6" filter="drop-shadow(0 2px 4px rgba(244,114,182,0.4))"/>',
      '      <path d="M228 86 Q228 81 223 81 Q228 81 228 76 Q228 81 233 81 Q228 81 228 86 Z" fill="#f472b6" opacity="0.8"/>',
      '',
      '      <!-- Main Document Card -->',
      '      <g transform="translate(160, 88) rotate(-4) translate(-160, -88)">',
      '        <rect x="114" y="24" width="94" height="116" rx="20" fill="url(#cn-sheet-grad)" stroke="#ffffff" stroke-width="2" filter="url(#cn-sheet-shadow)"/>',
      '        <text x="134" y="52" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="24" font-weight="900" fill="#818cf8" text-anchor="middle">#</text>',
      '        <rect x="146" y="38" width="30" height="4" rx="2" fill="#c7d2fe"/>',
      '        <rect x="146" y="46" width="22" height="4" rx="2" fill="#e0e7ff"/>',
      '        <rect x="126" y="64" width="58" height="4.5" rx="2.2" fill="#c7d2fe"/>',
      '        <rect x="126" y="73" width="46" height="4.5" rx="2.2" fill="#e0e7ff"/>',
      '        <rect x="126" y="82" width="52" height="4.5" rx="2.2" fill="#e0e7ff"/>',
      '        <!-- Copy button badge -->',
      '        <g transform="translate(168, 36)">',
      '          <rect x="0" y="0" width="28" height="28" rx="8" fill="#ffffff" stroke="#ede9fe" stroke-width="1.5" filter="drop-shadow(0 2px 6px rgba(124,58,237,0.15))"/>',
      '          <rect x="8" y="7" width="10" height="11" rx="2.5" fill="none" stroke="#7c3aed" stroke-width="1.6"/>',
      '          <path d="M11 7V5.5A1.5 1.5 0 0 1 12.5 4h5A1.5 1.5 0 0 1 19 5.5v7a1.5 1.5 0 0 1-1.5 1.5H16" fill="none" stroke="#a78bfa" stroke-width="1.4"/>',
      '        </g>',
      '      </g>',
      '',
      '      <!-- Floating 7 / 7 Pill Badge -->',
      '      <g transform="translate(160, 134)">',
      '        <rect x="-66" y="-18" width="132" height="40" rx="20" fill="url(#cn-pill-grad)" filter="url(#cn-pill-shadow)" stroke="#ffffff" stroke-width="1.5"/>',
      '        <text x="0" y="2" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" letter-spacing="2px">7 / 7</text>',
      '      </g>',
      '    </svg>',
      '  </div>',
      '',
      '  <!-- Title & Subtitle -->',
      '  <h3 class="cn-limit-modal-title" id="cn-limit-modal-title">Daily Limit <span class="cn-gradient-word">Reached!</span></h3>',
      '  <p class="cn-limit-modal-desc">',
      '    You have reached the free daily limit of 7 color code copies without login. Sign in or create a free account to enjoy unlimited copying and save your favorites!',
      '  </p>',
      '',
      '  <!-- 4 Perks Grid -->',
      '  <div class="cn-limit-perks">',
      '    <div class="cn-perk-item">',
      '      <div class="cn-perk-icon-wrap cn-perk-purple">',
      '        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18.178 8c5.096 0 5.096 8 0 8-2.67 0-4.49-3.23-6.178-5.33C10.31 8.57 8.49 8 5.822 8 0.726 8 0.726 16 5.822 16c2.67 0 4.49-3.23 6.178-5.33C13.69 12.57 15.51 16 18.178 16z"></path></svg>',
      '      </div>',
      '      <span class="cn-perk-label">Unlimited<br>Copies</span>',
      '    </div>',
      '    <div class="cn-perk-divider"></div>',
      '    <div class="cn-perk-item">',
      '      <div class="cn-perk-icon-wrap cn-perk-pink">',
      '        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
      '      </div>',
      '      <span class="cn-perk-label">Save<br>Favorites</span>',
      '    </div>',
      '    <div class="cn-perk-divider"></div>',
      '    <div class="cn-perk-item">',
      '      <div class="cn-perk-icon-wrap cn-perk-blue">',
      '        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><polyline points="10 12 13 15 10 18"></polyline></svg>',
      '      </div>',
      '      <span class="cn-perk-label">Sync<br>Across Devices</span>',
      '    </div>',
      '    <div class="cn-perk-divider"></div>',
      '    <div class="cn-perk-item">',
      '      <div class="cn-perk-icon-wrap cn-perk-amber">',
      '        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
      '      </div>',
      '      <span class="cn-perk-label">Get Early<br>Access</span>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- Actions -->',
      '  <div class="cn-limit-modal-actions">',
      '    <a href="/login" class="cn-limit-btn-primary" id="cn-limit-login-btn">',
      '      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      '      <span>Log In for Unlimited Copies</span>',
      '      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
      '    </a>',
      '    <a href="/signup" class="cn-limit-btn-secondary" id="cn-limit-signup-btn">',
      '      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
      '      <span>Create Free Account</span>',
      '    </a>',
      '  </div>',
      '',
      '  <!-- Social Proof -->',
      '  <div class="cn-limit-social-proof">',
      '    <div class="cn-limit-divider-wrap">',
      '      <span class="cn-limit-divider-line"></span>',
      '      <span class="cn-limit-divider-text">JOIN THOUSANDS OF CREATORS</span>',
      '      <span class="cn-limit-divider-line"></span>',
      '    </div>',
      '    <div class="cn-limit-creators-row">',
      '      <div class="cn-avatar-stack">',
      '        <img class="cn-avatar-img" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&auto=format&fit=crop&q=80" alt="Creator" />',
      '        <img class="cn-avatar-img" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&auto=format&fit=crop&q=80" alt="Creator" />',
      '        <img class="cn-avatar-img" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&auto=format&fit=crop&q=80" alt="Creator" />',
      '        <img class="cn-avatar-img" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&auto=format&fit=crop&q=80" alt="Creator" />',
      '        <img class="cn-avatar-img" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=64&auto=format&fit=crop&q=80" alt="Creator" />',
      '      </div>',
      '      <span class="cn-pill-10k">10K+</span>',
      '      <span class="cn-creators-text">already creating<br>with ColourNest</span>',
      '      <span class="cn-heart-pill">',
      '        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
      '      </span>',
      '    </div>',
      '    <div class="cn-limit-footer-tagline">SAME COLORS &bull; BIGGER POSSIBILITIES</div>',
      '  </div>',
      '</div>'
    ].join("\n");

    document.body.appendChild(modalEl);

    // Event listeners
    var closeBtn = modalEl.querySelector("#cn-limit-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        modalEl.classList.remove("is-open");
      });
    }
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) {
        modalEl.classList.remove("is-open");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalEl && modalEl.classList.contains("is-open")) {
        modalEl.classList.remove("is-open");
      }
    });

    return modalEl;
  }

  function showLimitModal() {
    var m = ensureModal();
    var nextParam = encodeURIComponent(window.location.pathname + window.location.search);
    var loginBtn = m.querySelector("#cn-limit-login-btn");
    var signupBtn = m.querySelector("#cn-limit-signup-btn");
    if (loginBtn) loginBtn.href = "/login?next=" + nextParam;
    if (signupBtn) signupBtn.href = "/signup?next=" + nextParam;
    m.classList.add("is-open");
  }

  function getAuthToken() {
    try {
      var tok = localStorage.getItem("cn_token") || sessionStorage.getItem("cn_token");
      if (tok) return tok;
      // Also check Supabase local storage key if present
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k === "cn-supabase-auth" || k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1)) {
          var parsed = JSON.parse(localStorage.getItem(k) || "null");
          if (parsed && parsed.access_token) return parsed.access_token;
          if (parsed && parsed.session && parsed.session.access_token) return parsed.session.access_token;
        }
      }
    } catch (e) {}
    return null;
  }

  function getAuthHeaders() {
    var headers = { "Content-Type": "application/json" };
    var token = getAuthToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    var u = getUser();
    if (u && u.id) headers["x-user-id"] = u.id;
    if (u && u.email) headers["x-user-email"] = u.email;
    return headers;
  }

  function saveColorToSupabase(item) {
    if (!item) return Promise.resolve(null);
    var u = getUser();
    var val = typeof item === "string" ? item : (item.value || item.hex || (item.c1 && item.c2 ? (item.c1 + " -> " + item.c2) : ""));
    var name = typeof item === "string" ? item : (item.name || val || "Saved Item");
    var type = typeof item === "string" ? "color" : (item.type || "color");
    var id = (item && item.id) ? item.id : (name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + String(val).replace("#", "").toLowerCase());

    var payload = {
      id: id,
      name: name,
      type: type,
      value: val,
      hex: (item && item.hex) || (/^#[0-9A-F]{6}$/i.test(val) ? val.toUpperCase() : undefined),
      c1: item && item.c1,
      c2: item && item.c2,
      css: item && item.css,
      stops: item && item.stops,
      gradType: item && item.gradType,
      colors: item && item.colors,
      userId: u ? u.id : undefined,
      email: u ? u.email : undefined
    };

    // Ensure local persistence
    try {
      if (type === "color" || /^#[0-9A-F]{6}$/i.test(val)) {
        var normHex = String(val).trim().toUpperCase();
        var favs = JSON.parse(localStorage.getItem("colorLibraryFavorites") || "[]");
        if (!Array.isArray(favs)) favs = [];
        if (!favs.includes(normHex)) {
          favs.unshift(normHex);
          localStorage.setItem("colorLibraryFavorites", JSON.stringify(favs));
        }
      } else if (type === "gradient" && item.c1 && item.c2) {
        var grads = JSON.parse(localStorage.getItem("colorLibrarySavedGradients") || "[]");
        if (!Array.isArray(grads)) grads = [];
        if (!grads.some(function(g) { return g.c1 === item.c1 && g.c2 === item.c2; })) {
          grads.unshift({ name: name, c1: item.c1, c2: item.c2, type: item.gradType || "linear", ts: Date.now() });
          localStorage.setItem("colorLibrarySavedGradients", JSON.stringify(grads));
        }
      }
    } catch (e) {}

    // Send to server API to save in Supabase
    return fetch("/api/saved-items", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    }).then(function(res) {
      return res.json();
    }).catch(function(err) {
      console.warn("Save to Supabase error:", err);
      return { success: false, error: err.message };
    });
  }

  function removeColorFromSupabase(idOrValue) {
    if (!idOrValue) return Promise.resolve(null);
    var target = String(idOrValue).trim();
    var u = getUser();

    // Remove from local storage
    try {
      var normHex = target.toUpperCase();
      var favs = JSON.parse(localStorage.getItem("colorLibraryFavorites") || "[]");
      if (Array.isArray(favs)) {
        var filteredFavs = favs.filter(function(h) { return String(h).trim().toUpperCase() !== normHex; });
        localStorage.setItem("colorLibraryFavorites", JSON.stringify(filteredFavs));
      }
      var grads = JSON.parse(localStorage.getItem("colorLibrarySavedGradients") || "[]");
      if (Array.isArray(grads)) {
        var filteredGrads = grads.filter(function(g) {
          return g.name !== target && (g.c1 + "-" + g.c2) !== target && (g.c1 + " -> " + g.c2) !== target;
        });
        localStorage.setItem("colorLibrarySavedGradients", JSON.stringify(filteredGrads));
      }
    } catch (e) {}

    var url = "/api/saved-items?id=" + encodeURIComponent(target) + "&value=" + encodeURIComponent(target) + "&userId=" + encodeURIComponent(u ? u.id : "");
    return fetch(url, {
      method: "DELETE",
      headers: getAuthHeaders()
    }).then(function(res) {
      return res.json();
    }).catch(function(err) {
      console.warn("Remove from Supabase error:", err);
      return { success: false, error: err.message };
    });
  }

  function syncWithSupabase() {
    if (!isLoggedIn()) {
      return Promise.resolve({ items: [] });
    }
    var u = getUser();
    var localItems = [];

    try {
      var favs = JSON.parse(localStorage.getItem("colorLibraryFavorites") || "[]");
      if (Array.isArray(favs)) {
        favs.forEach(function(h) {
          var hex = String(h || "").trim().toUpperCase();
          if (/^#[0-9A-F]{6}$/.test(hex)) {
            localItems.push({ id: "color-" + hex.replace("#", "").toLowerCase(), name: hex, type: "color", value: hex, hex: hex });
          }
        });
      }
      var grads = JSON.parse(localStorage.getItem("colorLibrarySavedGradients") || "[]");
      if (Array.isArray(grads)) {
        grads.forEach(function(g) {
          if (g && g.c1 && g.c2) {
            localItems.push({ id: "grad-" + (g.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + g.c1.replace("#", "") + "-" + g.c2.replace("#", ""), name: g.name || (g.c1 + " -> " + g.c2), type: "gradient", c1: g.c1, c2: g.c2, gradType: g.type || "linear", value: g.c1 + " -> " + g.c2 });
          }
        });
      }
      var mixes = JSON.parse(localStorage.getItem("colorLibrarySavedMixes") || "[]");
      if (Array.isArray(mixes)) {
        mixes.forEach(function(m) {
          if (m && m.css) {
            localItems.push({ id: "mix-" + (m.id || Date.now()), name: m.name || "Custom Mix", type: "mix", value: m.hex || "", css: m.css, stops: m.stops });
          }
        });
      }
    } catch (e) {}

    return fetch("/api/saved-items/sync", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ items: localItems, userId: u ? u.id : undefined, email: u ? u.email : undefined })
    }).then(function(res) {
      return res.json();
    }).then(function(data) {
      if (data && Array.isArray(data.items)) {
        var syncedFavs = [];
        var syncedGrads = [];
        var syncedMixes = [];

        data.items.forEach(function(it) {
          if (!it) return;
          if (it.type === "color" || /^#[0-9A-F]{6}$/i.test(it.value || it.hex || "")) {
            var h = String(it.value || it.hex || "").trim().toUpperCase();
            if (/^#[0-9A-F]{6}$/.test(h) && !syncedFavs.includes(h)) syncedFavs.push(h);
          } else if (it.type === "gradient" && (it.c1 && it.c2)) {
            syncedGrads.push({ name: it.name || (it.c1 + " -> " + it.c2), c1: it.c1, c2: it.c2, type: it.gradType || "linear", ts: it.ts || Date.now() });
          } else if (it.type === "mix") {
            syncedMixes.push(it);
          }
        });

        if (syncedFavs.length) localStorage.setItem("colorLibraryFavorites", JSON.stringify(syncedFavs));
        if (syncedGrads.length) localStorage.setItem("colorLibrarySavedGradients", JSON.stringify(syncedGrads));
        if (syncedMixes.length) localStorage.setItem("colorLibrarySavedMixes", JSON.stringify(syncedMixes));

        window.dispatchEvent(new CustomEvent("cn:favorites-synced", { detail: { items: data.items, colors: syncedFavs, gradients: syncedGrads } }));
      }
      return data;
    }).catch(function(err) {
      console.warn("Supabase sync warning:", err);
      return null;
    });
  }

  // Auto-sync when user is logged in
  if (isLoggedIn()) {
    setTimeout(syncWithSupabase, 300);
  }
  window.addEventListener("cn:supabase-ready", function() {
    if (isLoggedIn()) syncWithSupabase();
  });

  // Public API
  window.CNAuth = {
    getUser: getUser,
    getAuthToken: getAuthToken,
    isLoggedIn: isLoggedIn,
    getCopies: getCopies,
    FREE_LIMIT: FREE_LIMIT,
    remainingCopies: function () {
      if (this.isLoggedIn()) return Infinity;
      return Math.max(0, FREE_LIMIT - getCopies());
    },
    gateSave: function () {
      if (!isLoggedIn()) {
        showLimitModal();
        return false;
      }
      return true;
    },
    saveColorToSupabase: saveColorToSupabase,
    removeColorFromSupabase: removeColorFromSupabase,
    syncWithSupabase: syncWithSupabase,
    showLimitModal: showLimitModal,
    showToast: showCopyToast,
    logout: function () {
      var done = function () {
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem("cn_token");
        sessionStorage.removeItem("cn_token");
        localStorage.removeItem("colorLibraryFavorites");
        localStorage.removeItem("colorLibrarySavedGradients");
        localStorage.removeItem("colorLibrarySavedMixes");
        localStorage.removeItem("cl-mix-history");
        localStorage.removeItem("cl-palettes");
        localStorage.removeItem("cn_saved_items");
        localStorage.removeItem("cn_is_admin");
        sessionStorage.removeItem("cn-admin-auth");
        sessionStorage.removeItem("cn-admin-email");
        try {
          for (var i = localStorage.length - 1; i >= 0; i--) {
            var k = localStorage.key(i);
            if (k === "cn-supabase-auth" || (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1)) {
              localStorage.removeItem(k);
            }
          }
        } catch (e) {}
        window.location.href = "/";
      };
      if (window.cnSupabase && window.cnSupabase.signOut) {
        window.cnSupabase.signOut().then(done).catch(done);
      } else {
        done();
      }
    }
  };

  // Wrap clipboard writes so every copy on every page counts against the guest limit.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    var origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (text) {
      if (isLoggedIn()) {
        return origWrite(text);
      }
      var used = getCopies();
      if (used >= FREE_LIMIT) {
        showLimitModal();
        showCopyToast(FREE_LIMIT, text, true);
        // Do not call origWrite(text) so content is not copied.
        // Return resolved Promise so caller doesn't throw an unhandled rejection error.
        return Promise.resolve();
      }

      var newCount = incrementCopies();
      showCopyToast(newCount, text, false);
      return origWrite(text);
    };
  }

  // Wrap document.execCommand for fallback environments
  if (document.execCommand) {
    var origExec = document.execCommand.bind(document);
    document.execCommand = function (command) {
      if (typeof command === "string" && command.toLowerCase() === "copy" && !isLoggedIn()) {
        var used = getCopies();
        if (used >= FREE_LIMIT) {
          showLimitModal();
          showCopyToast(FREE_LIMIT, "", true);
          return false;
        }
      }
      return origExec.apply(document, arguments);
    };
  }
})();
