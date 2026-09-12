/* Shared drawer extras: Settings, Give Feedback, About, Share App.
   Injects nav items into .drawer-nav and manages the modals. */
(function () {
  var ICONS = {
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    feedback: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>'
  };

  var MODALS =
    '<div class="me-backdrop" id="me-settings-backdrop" aria-hidden="true">' +
      '<div class="me-sheet" role="dialog" aria-modal="true" aria-label="Settings">' +
        '<div class="me-head"><span class="me-title">Settings</span><button class="me-close" type="button" data-me-close="me-settings-backdrop" aria-label="Close settings">' + ICONS.x + '</button></div>' +
        '<p class="me-section-label">Appearance</p>' +
        '<div class="me-seg" id="me-theme-seg">' +
          '<button type="button" data-me-theme="light">' + ICONS.sun + 'Light</button>' +
          '<button type="button" data-me-theme="dark">' + ICONS.moon + 'Dark</button>' +
        '</div>' +
        '<p class="me-section-label">Data</p>' +
        '<div class="me-row">' +
          '<div class="me-row-text"><div class="me-row-title">Clear saved data</div><div class="me-row-sub">Removes saved items and mix history</div></div>' +
          '<button class="me-btn" type="button" id="me-clear-data">Clear</button>' +
        '</div>' +
        '<p class="me-version">ColorNest \u00B7 Version 1.0.0</p>' +
      '</div>' +
    '</div>' +
    '<div class="me-backdrop" id="me-feedback-backdrop" aria-hidden="true">' +
      '<div class="me-sheet" role="dialog" aria-modal="true" aria-label="Give feedback">' +
        '<div class="me-head"><span class="me-title">Give Feedback</span><button class="me-close" type="button" data-me-close="me-feedback-backdrop" aria-label="Close feedback">' + ICONS.x + '</button></div>' +
        '<p class="me-section-label">Tell us what you think</p>' +
        '<textarea class="me-textarea" id="me-feedback-text" placeholder="Share ideas, report a bug, or request a feature..." maxlength="1000"></textarea>' +
        '<button class="me-send" type="button" id="me-feedback-send">Send Feedback</button>' +
        '<a class="me-link-row" href="/feedback">Open full feedback page ' + ICONS.chevron + '</a>' +
      '</div>' +
    '</div>' +
    '<div class="me-backdrop" id="me-about-backdrop" aria-hidden="true">' +
      '<div class="me-sheet" role="dialog" aria-modal="true" aria-label="About">' +
        '<div class="me-head"><span class="me-title">About</span><button class="me-close" type="button" data-me-close="me-about-backdrop" aria-label="Close about">' + ICONS.x + '</button></div>' +
        '<div class="me-about-hero">' +
          '<span class="me-logo" aria-hidden="true"></span>' +
          '<span class="me-about-name">ColorNest</span>' +
          '<span class="me-about-tag">Colors for Creators \u2014 pick, mix and save beautiful colors.</span>' +
        '</div>' +
        '<div class="me-stats">' +
          '<div class="me-stat"><b>2,765</b><span>Colors</span></div>' +
          '<div class="me-stat"><b>2,000+</b><span>Gradients</span></div>' +
          '<div class="me-stat"><b>100%</b><span>Free</span></div>' +
        '</div>' +
        '<div class="me-links">' +
          '<a href="/about">About ColorNest ' + ICONS.chevron + '</a>' +
          '<a href="/contact">Contact Us ' + ICONS.chevron + '</a>' +
          '<a href="/privacy-policy">Privacy Policy ' + ICONS.chevron + '</a>' +
          '<a href="/terms-of-service">Terms of Service ' + ICONS.chevron + '</a>' +
        '</div>' +
        '<p class="me-version">Version 1.0.0 \u00B7 Made with love for creators</p>' +
      '</div>' +
    '</div>' +
    '<div class="me-backdrop" id="me-logout-backdrop" aria-hidden="true">' +
      '<div class="me-sheet me-confirm" role="dialog" aria-modal="true" aria-label="Log out confirmation">' +
        '<span class="me-confirm-icon" aria-hidden="true">' + ICONS.user + "</span>" +
        '<span class="me-confirm-title">Log Out?</span>' +
        '<p class="me-confirm-text">Are you sure you want to log out of your account? Your saved items will stay on this device.</p>' +
        '<div class="me-confirm-btns">' +
          '<button type="button" class="me-confirm-cancel" id="me-logout-cancel">Cancel</button>' +
          '<button type="button" class="me-confirm-ok" id="me-logout-ok">Log Out</button>' +
        "</div>" +
      "</div>" +
    "</div>" +
    '<div id="me-toast" role="status" aria-live="polite"></div>';

  function toast(msg) {
    var el = document.getElementById("me-toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  function openModal(id) {
    var m = document.getElementById(id);
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  }
  function closeModal(id) {
    var m = document.getElementById(id);
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
  }

  function confirmLogout(cb) {
    var backdrop = document.getElementById("me-logout-backdrop");
    if (!backdrop) { cb(true); return; }
    openModal("me-logout-backdrop");
    var ok = document.getElementById("me-logout-ok");
    var cancel = document.getElementById("me-logout-cancel");
    function done(answer) {
      closeModal("me-logout-backdrop");
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      backdrop.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onEsc);
      cb(answer);
    }
    function onOk() { done(true); }
    function onCancel() { done(false); }
    function onBackdrop(e) { if (e.target === backdrop) done(false); }
    function onEsc(e) { if (e.key === "Escape") done(false); }
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    backdrop.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onEsc);
  }

  function applyTheme(mode) {
    document.documentElement.classList.toggle("dark", mode === "dark");
    try { localStorage.setItem("cl-theme", mode); } catch (e) {}
    syncThemeSeg();
  }
  function syncThemeSeg() {
    var dark = document.documentElement.classList.contains("dark");
    document.querySelectorAll("[data-me-theme]").forEach(function (b) {
      b.classList.toggle("active", (b.dataset.meTheme === "dark") === dark);
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast("App link copied \u2014 share it anywhere");
      }, function () { legacyCopy(text); });
      return true;
    }
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    if (ok) toast("App link copied \u2014 share it anywhere");
    return ok;
  }

  function shareApp() {
    var data = {
      title: "ColorNest",
      text: "Colors for Creators \u2014 2,765 colors, gradients and mix tools.",
      url: location.origin
    };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
    } else if (copyText(data.url)) {
      toast("App link copied \u2014 share it anywhere");
    } else {
      toast("Sharing is not supported here");
    }
  }

  /* ---------- Kinetic fullscreen menu (GSAP port of sterling-gate navigation) ---------- */
  var KINETIC_BG =
    '<div class="kinetic-bg" aria-hidden="true">' +
      '<div class="backdrop-layer first"></div>' +
      '<div class="backdrop-layer second"></div>' +
      '<div class="backdrop-layer"></div>' +
      '<div class="ambient-background-shapes">' +
        '<svg class="bg-shape bg-shape-1" viewBox="0 0 400 400" fill="none" preserveAspectRatio="xMidYMid slice">' +
          '<circle class="shape-element" cx="80" cy="120" r="40" fill="rgba(124,58,237,.14)"/>' +
          '<circle class="shape-element" cx="300" cy="80" r="60" fill="rgba(79,70,229,.12)"/>' +
          '<circle class="shape-element" cx="200" cy="300" r="80" fill="rgba(217,70,239,.10)"/>' +
          '<circle class="shape-element" cx="350" cy="280" r="30" fill="rgba(124,58,237,.15)"/>' +
        '</svg>' +
        '<svg class="bg-shape bg-shape-2" viewBox="0 0 400 400" fill="none" preserveAspectRatio="xMidYMid slice">' +
          '<path class="shape-element" d="M0 200 Q100 100, 200 200 T 400 200" stroke="rgba(124,58,237,.18)" stroke-width="60" fill="none"/>' +
          '<path class="shape-element" d="M0 280 Q100 180, 200 280 T 400 280" stroke="rgba(217,70,239,.14)" stroke-width="40" fill="none"/>' +
        '</svg>' +
        '<svg class="bg-shape bg-shape-3" viewBox="0 0 400 400" fill="none" preserveAspectRatio="xMidYMid slice">' +
          '<circle class="shape-element" cx="50" cy="50" r="8" fill="rgba(124,58,237,.3)"/>' +
          '<circle class="shape-element" cx="150" cy="50" r="8" fill="rgba(79,70,229,.3)"/>' +
          '<circle class="shape-element" cx="250" cy="50" r="8" fill="rgba(217,70,239,.3)"/>' +
          '<circle class="shape-element" cx="350" cy="50" r="8" fill="rgba(124,58,237,.3)"/>' +
          '<circle class="shape-element" cx="100" cy="150" r="12" fill="rgba(79,70,229,.25)"/>' +
          '<circle class="shape-element" cx="200" cy="150" r="12" fill="rgba(217,70,239,.25)"/>' +
          '<circle class="shape-element" cx="300" cy="150" r="12" fill="rgba(124,58,237,.25)"/>' +
          '<circle class="shape-element" cx="50" cy="250" r="10" fill="rgba(217,70,239,.3)"/>' +
          '<circle class="shape-element" cx="150" cy="250" r="10" fill="rgba(124,58,237,.3)"/>' +
          '<circle class="shape-element" cx="250" cy="250" r="10" fill="rgba(79,70,229,.3)"/>' +
          '<circle class="shape-element" cx="350" cy="250" r="10" fill="rgba(217,70,239,.3)"/>' +
          '<circle class="shape-element" cx="100" cy="350" r="6" fill="rgba(124,58,237,.3)"/>' +
          '<circle class="shape-element" cx="200" cy="350" r="6" fill="rgba(79,70,229,.3)"/>' +
          '<circle class="shape-element" cx="300" cy="350" r="6" fill="rgba(217,70,239,.3)"/>' +
        '</svg>' +
        '<svg class="bg-shape bg-shape-4" viewBox="0 0 400 400" fill="none" preserveAspectRatio="xMidYMid slice">' +
          '<path class="shape-element" d="M100 100 Q150 50, 200 100 Q250 150, 200 200 Q150 250, 100 200 Q50 150, 100 100" fill="rgba(124,58,237,.12)"/>' +
          '<path class="shape-element" d="M250 200 Q300 150, 350 200 Q400 250, 350 300 Q300 350, 250 300 Q200 250, 250 200" fill="rgba(217,70,239,.10)"/>' +
        '</svg>' +
        '<svg class="bg-shape bg-shape-5" viewBox="0 0 400 400" fill="none" preserveAspectRatio="xMidYMid slice">' +
          '<line class="shape-element" x1="0" y1="100" x2="300" y2="400" stroke="rgba(124,58,237,.15)" stroke-width="30"/>' +
          '<line class="shape-element" x1="100" y1="0" x2="400" y2="300" stroke="rgba(79,70,229,.12)" stroke-width="25"/>' +
          '<line class="shape-element" x1="200" y1="0" x2="400" y2="200" stroke="rgba(217,70,239,.10)" stroke-width="20"/>' +
        '</svg>' +
      '</div>' +
    '</div>';

  function loadGsap(cb) {
    if (window.gsap && window.CustomEase) { cb(); return; }
    var s = document.createElement("script");
    s.src = "/vendor/gsap.min.js";
    s.onload = function () {
      var c = document.createElement("script");
      c.src = "/vendor/CustomEase.min.js";
      c.onload = cb;
      c.onerror = cb;
      document.head.appendChild(c);
    };
    s.onerror = cb;
    document.head.appendChild(s);
  }

  function initKinetic() {
    var drawer = document.getElementById("drawer");
    var backdrop = document.getElementById("drawer-backdrop");
    if (!drawer || !backdrop || !window.gsap || drawer.dataset.kineticBound) return;
    drawer.dataset.kineticBound = "1";

    drawer.insertAdjacentHTML("afterbegin", KINETIC_BG);
    var links = drawer.querySelectorAll(".drawer-nav a");
    links.forEach(function (a, i) { a.setAttribute("data-shape", String((i % 5) + 1)); });

    var ease = "power3.out";
    try {
      gsap.registerPlugin(window.CustomEase);
      if (!gsap.parseEase("main")) window.CustomEase.create("main", "0.65, 0.01, 0.05, 0.99");
      ease = "main";
    } catch (e) {}

    var open = false;
    // x: 0 clears the stylesheet's translateX(120%) which GSAP would otherwise
    // bake in as a pixel offset, then xPercent takes over the hide/show.
    gsap.set(drawer, { x: 0, xPercent: 120 });
    gsap.set(backdrop, { autoAlpha: 0 });

    function openMenu() {
      if (open) return;
      open = true;
      drawer.setAttribute("aria-hidden", "false");
      gsap.timeline()
        .set(drawer, { xPercent: 0 })
        .to(backdrop, { autoAlpha: 1, duration: 0.4 }, "<")
        .fromTo(drawer.querySelectorAll(".backdrop-layer"),
          { xPercent: 101 },
          { xPercent: 0, stagger: 0.12, duration: 0.575, ease: ease }, "<")
        .fromTo(drawer.querySelectorAll(".drawer-nav a"),
          { yPercent: 140, rotate: 10, opacity: 0 },
          { yPercent: 0, rotate: 0, opacity: 1, stagger: 0.05, duration: 0.6, ease: ease }, "<+=0.3")
        .fromTo(drawer.querySelector(".drawer-head"),
          { autoAlpha: 0, y: -12 },
          { autoAlpha: 1, y: 0, duration: 0.4 }, "<+=0.1");
    }

    function closeMenu() {
      if (!open) return;
      open = false;
      drawer.setAttribute("aria-hidden", "true");
      gsap.timeline()
        .to(backdrop, { autoAlpha: 0, duration: 0.35 })
        .to(drawer, { xPercent: 120, duration: 0.5, ease: "power2.in" }, "<");
    }

    // Take over the inline page handlers: capture phase fires before their
    // target-phase listeners, so stopPropagation cleanly replaces them.
    document.addEventListener("click", function (e) {
      var el = e.target instanceof Element ? e.target : null;
      if (!el) return;
      if (el.closest("#drawer-close")) { e.stopPropagation(); closeMenu(); return; }
      if (el.closest('[aria-label="Open menu"], [aria-label="Menu"]')) { e.stopPropagation(); openMenu(); return; }
      if (open && el === backdrop) { e.stopPropagation(); closeMenu(); return; }
      if (open && el.closest(".drawer-nav a")) closeMenu();
    }, true);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) { e.stopPropagation(); closeMenu(); }
    }, true);

    // Ambient shape reveal on link hover
    var shapesWrap = drawer.querySelector(".ambient-background-shapes");
    links.forEach(function (item) {
      var shape = shapesWrap.querySelector(".bg-shape-" + item.getAttribute("data-shape"));
      if (!shape) return;
      var els = shape.querySelectorAll(".shape-element");
      item.addEventListener("mouseenter", function () {
        shapesWrap.querySelectorAll(".bg-shape").forEach(function (s) { s.classList.remove("active"); });
        shape.classList.add("active");
        gsap.fromTo(els,
          { scale: 0.5, opacity: 0, rotation: -10 },
          { scale: 1, opacity: 1, rotation: 0, duration: 0.6, stagger: 0.08, ease: "back.out(1.7)", overwrite: "auto" });
      });
      item.addEventListener("mouseleave", function () {
        gsap.to(els, {
          scale: 0.8, opacity: 0, duration: 0.3, ease: "power2.in",
          onComplete: function () { shape.classList.remove("active"); },
          overwrite: "auto"
        });
      });
    });
  }

  function init() {
    // Nav items inside the existing drawer
    var nav = document.querySelector(".drawer-nav");
    if (nav) {
      var user = null;
      try { user = JSON.parse(localStorage.getItem("cn_user") || "null"); } catch (e) {}

      var items = [
        { id: "me-nav-settings", label: "Settings", icon: ICONS.settings },
        { id: "me-nav-feedback", label: "Give Feedback", icon: ICONS.feedback },
        { id: "me-nav-about", label: "About", icon: ICONS.about },
        { id: "me-nav-share", label: "Share App", icon: ICONS.share }
      ];
      var html = '<div class="me-divider"></div>';
      items.forEach(function (it) {
        html += '<a href="#" class="me-nav-item" id="' + it.id + '">' + it.icon + it.label + "</a>";
      });

      // Compact profile row pinned under Share App
      html += '<div class="me-profile" id="me-profile">';
      if (user && user.name) {
        var initial = (user.name || "U").trim().charAt(0).toUpperCase();
        html +=
          '<span class="me-avatar" aria-hidden="true">' + initial + "</span>" +
          '<span class="me-profile-meta"><b></b><small></small></span>' +
          '<button type="button" class="me-logout" aria-label="Log Out">' + ICONS.logout + "</button>";
      } else {
        html +=
          '<span class="me-avatar me-avatar-guest" aria-hidden="true">' + ICONS.user + "</span>" +
          '<span class="me-profile-meta"><b>Guest</b><small>Sign in to save &amp; sync</small></span>' +
          '<span class="me-auth-btns">' +
            '<a class="me-auth-btn me-auth-login" href="/login">Sign In</a>' +
            '<a class="me-auth-btn me-auth-signup" href="/signup">Sign Up</a>' +
          "</span>";
      }
      html += "</div>";
      nav.insertAdjacentHTML("beforeend", html);

      var profile = document.getElementById("me-profile");
      if (user && user.name) {
        profile.querySelector("b").textContent = user.name;
        profile.querySelector("small").textContent = user.email || "";
        profile.querySelector(".me-logout").addEventListener("click", function () {
          confirmLogout(function (ok) {
            if (!ok) return;
            try { localStorage.removeItem("cn_user"); } catch (e2) {}
            window.location.href = "/";
          });
        });
      }

      document.getElementById("me-nav-settings").addEventListener("click", function (e) { e.preventDefault(); openModal("me-settings-backdrop"); });
      document.getElementById("me-nav-feedback").addEventListener("click", function (e) { e.preventDefault(); openModal("me-feedback-backdrop"); });
      document.getElementById("me-nav-about").addEventListener("click", function (e) { e.preventDefault(); window.location.href = "/about"; });
      document.getElementById("me-nav-share").addEventListener("click", function (e) { e.preventDefault(); shareApp(); });
    }

    document.body.insertAdjacentHTML("beforeend", MODALS);
    syncThemeSeg();

    // Close buttons + backdrop click + Escape
    document.querySelectorAll("[data-me-close]").forEach(function (b) {
      b.addEventListener("click", function () { closeModal(b.dataset.meClose); });
    });
    ["me-settings-backdrop", "me-feedback-backdrop", "me-about-backdrop"].forEach(function (id) {
      var m = document.getElementById(id);
      m.addEventListener("click", function (e) { if (e.target === m) closeModal(id); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        ["me-settings-backdrop", "me-feedback-backdrop", "me-about-backdrop"].forEach(closeModal);
      }
    });

    // Settings actions
    document.querySelectorAll("[data-me-theme]").forEach(function (b) {
      b.addEventListener("click", function () { applyTheme(b.dataset.meTheme); });
    });
    document.getElementById("me-clear-data").addEventListener("click", function () {
      var removed = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k.indexOf("cl-") === 0 && k !== "cl-theme") removed.push(k);
        }
        removed.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
      toast(removed.length ? "Cleared " + removed.length + " saved item type(s)" : "Nothing saved yet");
    });

    // Feedback
    document.getElementById("me-feedback-send").addEventListener("click", function () {
      var ta = document.getElementById("me-feedback-text");
      var msg = ta.value.trim();
      if (msg.length < 3) { toast("Please write a little more first"); ta.focus(); return; }
      var list = [];
      try { list = JSON.parse(localStorage.getItem("cl-feedback")) || []; } catch (e) {}
      list.unshift({ msg: msg, page: location.pathname, ts: Date.now() });
      try { localStorage.setItem("cl-feedback", JSON.stringify(list.slice(0, 50))); } catch (e) {}
      ta.value = "";
      closeModal("me-feedback-backdrop");
      toast("Thanks for your feedback!");
    });

    loadGsap(initKinetic);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
