// ColorNest guest limits: 7 free copies without login; saving requires login.
// Logged-in users (localStorage "cn_user") have no limits.
(function () {
  var KEY_COPIES = "cn_copies";
  var KEY_USER = "cn_user";
  var FREE_LIMIT = 7;

  function getUser() {
    try { return JSON.parse(localStorage.getItem(KEY_USER) || "null"); } catch (e) { return null; }
  }
  function getCopies() {
    return parseInt(localStorage.getItem(KEY_COPIES) || "0", 10) || 0;
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25);";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  function goToLogin(reason) {
    toast(reason);
    setTimeout(function () {
      window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
    }, 700);
  }

  window.CNAuth = {
    getUser: getUser,
    isLoggedIn: function () { return !!getUser(); },
    remainingCopies: function () {
      if (this.isLoggedIn()) return Infinity;
      return Math.max(0, FREE_LIMIT - getCopies());
    },
    // Gate any save/like action: guests must log in first.
    gateSave: function () {
      if (this.isLoggedIn()) return true;
      goToLogin("Login to save colors and palettes");
      return false;
    },
    logout: function () {
      localStorage.removeItem(KEY_USER);
      window.location.href = "/";
    }
  };

  // Wrap clipboard writes so every copy on every page counts against the guest limit.
  if (navigator.clipboard && navigator.clipboard.writeText) {
    var origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (text) {
      if (!CNAuth.isLoggedIn()) {
        var used = getCopies();
        if (used >= FREE_LIMIT) {
          goToLogin("Free limit reached — " + FREE_LIMIT + " copies. Login to keep copying!");
          return Promise.reject(new Error("login required"));
        }
        try { localStorage.setItem(KEY_COPIES, String(used + 1)); } catch (e) {}
        var left = FREE_LIMIT - (used + 1);
        if (left > 0 && left <= 2) toast(left + " free " + (left === 1 ? "copy" : "copies") + " left — login for unlimited");
      }
      return origWrite(text);
    };
  }
})();
