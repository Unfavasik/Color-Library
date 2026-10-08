// ColorNest Supabase backend.
// Initializes the Supabase client (Auth + saved-colors store) and exposes
// everything as window.cnSupabase for the pages. Replaces the old external
// module with the same API surface so page code keeps working:
//   auth.currentUser, onAuth, signIn, signUp, updateProfile, signOut,
//   socialSignIn, ensureUser, saveItem, removeItem, getSaved, itemId,
//   friendlyError, getCurrentProfile, refreshCurrentUser, renderCurrentUserName
// If initialization fails (missing config, blocked network) window.cnSupabase
// stays unset and pages fall back to the legacy server API.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let cfg;
try {
  const res = await fetch("/api/config");
  cfg = await res.json();
  if (!cfg.supabaseUrl || !cfg.publishableKey) throw new Error("Supabase config is not available");
} catch (e) {
  console.log("[v0] Supabase init skipped:", e && e.message);
  throw e;
}

const supabase = createClient(cfg.supabaseUrl, cfg.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "cn-supabase-auth"
  }
});

// ---------- Saved-colors store (server-backed, per Supabase user) ----------
// Items live in the user's profile row as preferences.saved_items:
//   [{ id, name, type, value, ts }]

function itemId(name, value) {
  var slug = String(name || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug + "-" + String(value || "").replace("#", "").toLowerCase();
}

function normalizeUser(session, profile) {
  if (!session || !session.user) return null;
  var u = session.user;
  var meta = u.user_metadata || {};
  var token = session.access_token;

  // Name priority:
  // 1. profile.display_name (primary source of truth)
  // 2. auth user metadata display_name
  // 3. auth user metadata full_name
  // 4. auth user metadata name
  // 5. email prefix
  var displayName =
    (profile && profile.display_name && profile.display_name.trim()) ||
    (meta.display_name && meta.display_name.trim()) ||
    (meta.full_name && meta.full_name.trim()) ||
    (meta.name && meta.name.trim()) ||
    (u.email ? u.email.split("@")[0] : "User");

  var avatarUrl =
    (profile && profile.avatar_url) ||
    meta.avatar_url ||
    meta.picture ||
    null;

  var role = (profile && profile.role) || "user";
  var isActive = profile ? profile.is_active !== false : true;

  return {
    uid: u.id,
    id: u.id,
    email: u.email || "",
    displayName: displayName,
    avatarUrl: avatarUrl,
    role: role,
    isActive: isActive,
    profile: profile || null,
    getIdToken: function () { return Promise.resolve(token); }
  };
}

var cachedUser = null;
var currentProfileChannel = null;

async function loadCurrentProfile(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select('id, "Gmail", display_name, avatar_url, role, is_active')
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[ColorNest] Could not load profile:", error.message || error);
      return null;
    }
    return data || null;
  } catch (err) {
    console.warn("[ColorNest] Profile fetch failed:", err);
    return null;
  }
}

function renderCurrentUserName(user) {
  if (!user) return;
  var name = (user.displayName && user.displayName.trim()) || (user.email ? user.email.split("@")[0] : "User");

  document.querySelectorAll("[data-user-name]").forEach(function (el) {
    el.textContent = name;
  });

  try {
    var stored = JSON.parse(localStorage.getItem("cn_user") || "null");
    if (stored && (stored.id === user.uid || stored.id === user.id)) {
      stored.name = name;
      stored.role = user.role || stored.role || "user";
      stored.updatedAt = Date.now();
      localStorage.setItem("cn_user", JSON.stringify(stored));
    }
  } catch (e) {}
}

function subscribeToProfileChanges(userId) {
  if (!userId) return;
  if (currentProfileChannel) {
    try { supabase.removeChannel(currentProfileChannel); } catch (e) {}
    currentProfileChannel = null;
  }

  try {
    currentProfileChannel = supabase
      .channel("current-profile-" + userId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: "id=eq." + userId
        },
        function (payload) {
          var updatedProfile = payload && payload.new;
          if (!updatedProfile) return;

          if (cachedUser && (cachedUser.uid === userId || cachedUser.id === userId)) {
            cachedUser.profile = Object.assign({}, cachedUser.profile || {}, updatedProfile);
            if (updatedProfile.display_name && updatedProfile.display_name.trim()) {
              cachedUser.displayName = updatedProfile.display_name.trim();
            }
            if (updatedProfile.avatar_url) {
              cachedUser.avatarUrl = updatedProfile.avatar_url;
            }
            if (updatedProfile.role) {
              cachedUser.role = updatedProfile.role;
            }
            if (updatedProfile.is_active !== undefined) {
              cachedUser.isActive = updatedProfile.is_active !== false;
            }

            try {
              localStorage.setItem("cn_user", JSON.stringify({
                name: cachedUser.displayName,
                email: cachedUser.email,
                id: cachedUser.uid,
                role: cachedUser.role,
                updatedAt: Date.now()
              }));
            } catch (e) {}

            renderCurrentUserName(cachedUser);
            window.dispatchEvent(new CustomEvent("cn:user-updated", {
              detail: cachedUser
            }));
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("[ColorNest] Realtime profile subscription failed:", err);
  }
}

async function refreshCurrentUser() {
  try {
    var sessionRes = await supabase.auth.getSession();
    var session = sessionRes && sessionRes.data && sessionRes.data.session;
    if (!session || !session.user) {
      cachedUser = null;
      return null;
    }

    var profile = await loadCurrentProfile(session.user.id);
    var normalized = normalizeUser(session, profile);
    cachedUser = normalized;

    try {
      localStorage.setItem("cn_user", JSON.stringify({
        name: normalized.displayName,
        email: normalized.email,
        id: normalized.uid,
        role: normalized.role,
        updatedAt: Date.now()
      }));
    } catch (e) {}

    renderCurrentUserName(normalized);

    window.dispatchEvent(new CustomEvent("cn:user-updated", {
      detail: normalized
    }));

    return normalized;
  } catch (e) {
    console.warn("[ColorNest] refreshCurrentUser failed:", e);
    return cachedUser;
  }
}

async function getAccessToken() {
  var data = await supabase.auth.getSession();
  var session = data && data.data && data.data.session;
  return (session && session.access_token) || null;
}

async function ensureUser(user) {
  try {
    await fetch("/api/users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.uid || user.id,
        email: user.email,
        name: user.displayName || (user.email || "").split("@")[0]
      })
    });
  } catch (e) {}
}

async function getSaved(user) {
  var token = await getAccessToken();
  var res = await fetch("/api/saved-items", {
    headers: token ? { Authorization: "Bearer " + token } : {}
  });
  if (!res.ok) throw new Error("Could not load saved items");
  var data = await res.json();
  return data.items || [];
}

async function saveItem(user, item) {
  var token = await getAccessToken();
  var id = itemId(item.name, item.value || (item.c1 && item.c2) || "");
  var res = await fetch("/api/saved-items", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}),
    body: JSON.stringify({ id: id, name: item.name || "", type: item.type || "color", value: item.value || "" })
  });
  if (!res.ok) throw new Error("Could not save item");
  return id;
}

async function removeItem(user, id) {
  var token = await getAccessToken();
  var res = await fetch("/api/saved-items?id=" + encodeURIComponent(id), {
    method: "DELETE",
    headers: token ? { Authorization: "Bearer " + token } : {}
  });
  if (!res.ok) throw new Error("Could not remove item");
  return true;
}

// ---------- Auth ----------

function friendlyError(err) {
  var msg = (err && (err.message || err.error_description || err.msg)) || "";
  var map = [
    [/invalid login credentials/i, "Wrong email or password. Try again."],
    [/email not confirmed/i, "Please verify your email first, then sign in."],
    [/already registered|already exists/i, "An account with this email already exists. Please sign in."],
    [/password.*at least|weak password/i, "Password must be at least 6 characters."],
    [/rate limit|too many/i, "Too many attempts. Please try again later."],
    [/signups not allowed/i, "Sign-ups are currently disabled. Please try again later."],
    [/network|fetch/i, "Network problem. Check your connection and try again."]
  ];
  for (var i = 0; i < map.length; i++) {
    if (map[i][0].test(msg)) return map[i][1];
  }
  return msg || "Something went wrong. Please try again.";
}

var ADMIN_EMAILS = ["asik.devhub@gmail.com", "ayatulsekh3037@gmail.com", "asikikbal@gmail.com"];
var lastFinalizedUid = null;

function finalizeSession(user, accessToken) {
  if (!user || user.uid === lastFinalizedUid) return;
  lastFinalizedUid = user.uid;
  try {
    localStorage.setItem("cn_user", JSON.stringify({
      name: user.displayName || (user.email || "").split("@")[0],
      email: user.email,
      id: user.uid,
      role: user.role || "user"
    }));
    localStorage.removeItem("cn_copies");
  } catch (e) {}
  ensureUser(user);
  var next = null;
  try { next = localStorage.getItem("cn_oauth_next"); localStorage.removeItem("cn_oauth_next"); } catch (e2) {}
  var onAuthPage = window.location.pathname === "/login" || window.location.pathname === "/signup";
  var onAdminGate = window.location.pathname === "/admin";
  if (ADMIN_EMAILS.indexOf((user.email || "").toLowerCase()) !== -1 || user.role === "admin") {
    try {
      sessionStorage.setItem("cn-admin-auth", "1");
      sessionStorage.setItem("cn-admin-email", user.email);
      if (accessToken) sessionStorage.setItem("cn_token", accessToken);
    } catch (a) {}
    if (onAuthPage || onAdminGate || next) window.location.href = "/admin/dashboard";
    return;
  }
  if (onAuthPage) {
    window.location.href = next && next.charAt(0) === "/" ? next : "/";
  }
}

supabase.auth.onAuthStateChange(async function (event, session) {
  if (event === "SIGNED_OUT" || !session || !session.user) {
    if (currentProfileChannel) {
      try { supabase.removeChannel(currentProfileChannel); } catch (e) {}
      currentProfileChannel = null;
    }
    lastFinalizedUid = null;
    cachedUser = null;
    try {
      localStorage.removeItem("cn_user");
    } catch (e) {}
    window.dispatchEvent(new CustomEvent("cn:user-updated", { detail: null }));
    return;
  }

  if (
    event === "INITIAL_SESSION" ||
    event === "SIGNED_IN" ||
    event === "TOKEN_REFRESHED" ||
    event === "USER_UPDATED"
  ) {
    await refreshCurrentUser();
    subscribeToProfileChanges(session.user.id);
  } else {
    await refreshCurrentUser();
  }

  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
    finalizeSession(cachedUser, session && session.access_token);
  }
});

// Sync on page focus and tab visibility change
window.addEventListener("focus", function () {
  if (cachedUser && (cachedUser.uid || cachedUser.id)) {
    refreshCurrentUser();
  }
});

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && cachedUser && (cachedUser.uid || cachedUser.id)) {
    refreshCurrentUser();
  }
});

// Periodic fallback refresh every 60s while logged in
setInterval(function () {
  if (cachedUser && (cachedUser.uid || cachedUser.id) && document.visibilityState === "visible") {
    refreshCurrentUser();
  }
}, 60000);

window.cnSupabase = {
  supabase: supabase,
  config: cfg,
  auth: {
    get currentUser() { return cachedUser; }
  },
  getCurrentProfile: function () {
    var uid = cachedUser && (cachedUser.uid || cachedUser.id);
    return loadCurrentProfile(uid);
  },
  refreshCurrentUser: refreshCurrentUser,
  renderCurrentUserName: renderCurrentUserName,
  loadCurrentProfile: loadCurrentProfile,
  normalizeUser: normalizeUser,
  ensureUser: ensureUser,
  saveItem: saveItem,
  removeItem: removeItem,
  getSaved: getSaved,
  itemId: itemId,
  onAuth: function (cb) {
    var sub = supabase.auth.onAuthStateChange(async function (_event, session) {
      if (!session) {
        cb(null);
        return;
      }
      var profile = await loadCurrentProfile(session.user.id);
      cb(normalizeUser(session, profile));
    });
    return function () { sub.data.subscription.unsubscribe(); };
  },
  signIn: function (_auth, email, pass) {
    return supabase.auth.signInWithPassword({ email: email, password: pass }).then(async function (data) {
      if (data.error) throw data.error;
      var profile = await loadCurrentProfile(data.session && data.session.user && data.session.user.id);
      var normalized = normalizeUser(data.session, profile);
      cachedUser = normalized;
      renderCurrentUserName(normalized);
      return { user: normalized };
    });
  },
  signUp: function (_auth, email, pass, name) {
    return fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: pass, name: name })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || !data.success) throw new Error(data.error || "Failed to create account. Please try again.");
        if (!data.session) throw new Error("Account created. Please sign in.");
        return supabase.auth.setSession(data.session).then(async function () {
          var profile = await loadCurrentProfile(data.session.user.id);
          var normalized = normalizeUser(data.session, profile);
          cachedUser = normalized;
          renderCurrentUserName(normalized);
          return { user: normalized };
        });
      });
    });
  },
  updateProfile: async function (user, opts) {
    var data = {};
    if (opts && opts.displayName) {
      data.full_name = opts.displayName;
      data.display_name = opts.displayName;
    }
    const updateAuth = await supabase.auth.updateUser({ data: data });
    var uid = (user && (user.uid || user.id)) || (cachedUser && cachedUser.uid);
    if (uid && opts && opts.displayName) {
      try {
        await supabase.from("profiles").update({ display_name: opts.displayName }).eq("id", uid);
        await refreshCurrentUser();
      } catch (e) {}
    }
    return updateAuth;
  },
  signOut: function () {
    if (currentProfileChannel) {
      supabase.removeChannel(currentProfileChannel);
      currentProfileChannel = null;
    }
    lastFinalizedUid = null;
    cachedUser = null;
    return supabase.auth.signOut();
  },
  socialSignIn: function (name) {
    var providers = { Google: "google", GitHub: "github", Apple: "apple" };
    var provider = providers[name];
    if (!provider) return Promise.reject(new Error("Unsupported provider"));
    try {
      var next = new URLSearchParams(window.location.search).get("next");
      localStorage.setItem("cn_oauth_next", next && next.charAt(0) === "/" ? next : "/");
    } catch (e) {}
    return supabase.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: window.location.origin + "/login" }
    });
  },
  friendlyError: friendlyError
};

window.dispatchEvent(new Event("cn:supabase-ready"));
