// Cloudflare Pages Function: catch-all handler for /api/*
// Mirrors the Express routes from server.ts using Web-standard APIs.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = [
  "asik.devhub@gmail.com",
  "ayatulsekh3037@gmail.com",
  "asikikbal@gmail.com"
];

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function getAdmin(env: Env): SupabaseClient {
  const url = env.SUPABASE_URL || "";
  const key = env.SUPABASE_SECRET_KEY || "";
  if (!url || !key) throw new Error("Supabase server environment variables are not configured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function getPublic(env: Env): SupabaseClient {
  const url = env.SUPABASE_URL || "";
  const key = env.SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) throw new Error("Supabase public environment variables are not configured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function isAdminEmail(e?: string | null): boolean {
  return e ? ADMIN_EMAILS.includes(e.trim().toLowerCase()) : false;
}

async function readBody(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

const inMemorySavedItems = new Map<string, any[]>();

function isValidUUID(str: any): boolean {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

function extractFeedbackStoragePath(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const trimmed = imageUrl.trim();
  const match = trimmed.match(/\/feedback-images\/(.+)$/i);
  if (match && match[1]) {
    return decodeURIComponent(match[1].split("?")[0].split("#")[0]);
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2; const d = max - min;
  if (d) { s = l > .5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; default: h = (r - g) / d + 4; } h /= 6; }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

async function getAuthUserId(request: Request, env: Env, body?: any): Promise<string | null> {
  const authHeader = request.headers.get("authorization") || request.headers.get("x-access-token") || request.headers.get("x-auth-token") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : (authHeader.trim() || null);

  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    try {
      const admin = getAdmin(env);
      if (token) {
        try {
          const { data } = await admin.auth.getUser(token);
          if (data?.user?.id && isValidUUID(data.user.id)) return data.user.id;
        } catch {
          // Continue to other headers
        }
      }

      const url = new URL(request.url);
      const xUserId = request.headers.get("x-user-id") || url.searchParams.get("userId") || body?.userId;
      if (xUserId && typeof xUserId === "string" && isValidUUID(xUserId.trim())) {
        return xUserId.trim();
      }

      const xEmail = request.headers.get("x-user-email") || url.searchParams.get("email") || body?.email;
      if (xEmail && typeof xEmail === "string" && xEmail.includes("@")) {
        try {
          const { data: usersData } = await admin.auth.admin.listUsers();
          const found = usersData?.users?.find((u: any) => u.email?.toLowerCase() === xEmail.trim().toLowerCase());
          if (found?.id && isValidUUID(found.id)) return found.id;
        } catch {}
      }
    } catch {}
  }

  const url = new URL(request.url);
  const fallbackId = request.headers.get("x-user-id") || body?.userId || url.searchParams.get("userId") || (token ? "guest-user" : "guest");
  return typeof fallbackId === "string" ? fallbackId : "guest";
}

async function syncAdminUser(
  admin: SupabaseClient,
  userId: string | null,
  email: string,
  suppliedName?: string,
  role?: string,
  isActive?: boolean
) {
  if (!email || !email.includes("@")) return null;
  const lowerEmail = email.trim().toLowerCase();
  const isAdminRole = role === "admin" || lowerEmail === "asik.devhub@gmail.com" || lowerEmail === "ayatulsekh3037@gmail.com" || lowerEmail === "asikikbal@gmail.com";

  try {
    const { data: existingAdmin } = await admin
      .from("admin_users")
      .select("*")
      .eq("email", lowerEmail)
      .maybeSingle();

    if (isAdminRole) {
      const activeState = isActive !== false;
      if (existingAdmin) {
        const updatePayload: any = {
          is_active: activeState,
          updated_at: new Date().toISOString()
        };
        if (userId && !existingAdmin.user_id) {
          updatePayload.user_id = userId;
        }
        if (suppliedName && !existingAdmin.display_name) {
          updatePayload.display_name = suppliedName.trim();
        }
        const { data: updated } = await admin
          .from("admin_users")
          .update(updatePayload)
          .eq("id", existingAdmin.id)
          .select()
          .single();
        return updated || existingAdmin;
      } else {
        const initialName = (suppliedName && suppliedName.trim()) || lowerEmail.split("@")[0];
        const newPayload: any = {
          email: lowerEmail,
          display_name: initialName,
          is_active: activeState
        };
        if (userId) newPayload.user_id = userId;
        const { data: inserted } = await admin
          .from("admin_users")
          .insert([newPayload])
          .select()
          .single();
        return inserted || newPayload;
      }
    } else if (existingAdmin) {
      // Deactivate admin if no longer admin
      await admin
        .from("admin_users")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", existingAdmin.id);
    }
  } catch (err) {
    console.warn("syncAdminUser error:", err);
  }
  return null;
}

async function verifyAdminAuth(request: Request, env: Env): Promise<{ ok: boolean; admin?: any; error?: string; status?: number }> {
  const admin = getAdmin(env);
  const authHeader = request.headers.get("authorization") || request.headers.get("x-access-token") || request.headers.get("x-auth-token") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : (authHeader.trim() || null);

  let userId: string | null = null;
  let userEmail: string | null = null;

  if (token) {
    try {
      const { data } = await admin.auth.getUser(token);
      if (data?.user) {
        userId = data.user.id;
        userEmail = data.user.email ? data.user.email.toLowerCase() : null;
      }
    } catch {}
  }

  if (!userEmail) {
    const headerEmail = request.headers.get("x-user-email");
    if (headerEmail && headerEmail.includes("@")) {
      userEmail = headerEmail.trim().toLowerCase();
    }
  }

  if (!userId) {
    const headerUserId = request.headers.get("x-user-id");
    if (headerUserId && isValidUUID(headerUserId)) {
      userId = headerUserId.trim();
    }
  }

  if (!userEmail && !userId) {
    return { ok: false, error: "Authentication required.", status: 401 };
  }

  try {
    // 1. Check admin_users table
    let adminRecord: any = null;
    if (userEmail) {
      const { data } = await admin
        .from("admin_users")
        .select("*")
        .eq("email", userEmail)
        .maybeSingle();
      if (data) adminRecord = data;
    }
    if (!adminRecord && userId) {
      const { data } = await admin
        .from("admin_users")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) adminRecord = data;
    }

    // 2. Check profile role
    let profileRecord: any = null;
    if (userId) {
      const { data } = await admin
        .from("profiles")
        .select('id, "Gmail", display_name, role, is_active')
        .eq("id", userId)
        .maybeSingle();
      if (data) profileRecord = data;
    }

    const isDesignatedEmail = userEmail && (
      userEmail === "asik.devhub@gmail.com" ||
      userEmail === "ayatulsekh3037@gmail.com" ||
      userEmail === "asikikbal@gmail.com"
    );

    const isProfileAdmin = (profileRecord?.role === "admin" || isDesignatedEmail) && profileRecord?.is_active !== false;
    const isAdminActive = adminRecord ? adminRecord.is_active === true : isProfileAdmin;

    if (!isAdminActive && !isProfileAdmin) {
      return { ok: false, error: "Access denied. Admin authorization required.", status: 403 };
    }

    // Sync admin record if missing or needs user_id linking
    if (!adminRecord && userEmail) {
      const fallbackName = profileRecord?.display_name || userEmail.split("@")[0];
      adminRecord = await syncAdminUser(admin, userId, userEmail, fallbackName, "admin", true);
    } else if (adminRecord && userId && !adminRecord.user_id) {
      await admin.from("admin_users").update({ user_id: userId }).eq("id", adminRecord.id);
      adminRecord.user_id = userId;
    }

    return {
      ok: true,
      userId: userId || adminRecord?.user_id || profileRecord?.id,
      admin: adminRecord || {
        id: profileRecord?.id || userId,
        user_id: userId || profileRecord?.id,
        email: userEmail,
        display_name: profileRecord?.display_name || (userEmail ? userEmail.split("@")[0] : "Admin"),
        is_active: true
      }
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Admin authorization failed.", status: 500 };
  }
}

async function resolveProfileIdByEmail(admin: SupabaseClient, emailStr?: string | null): Promise<string | null> {
  if (!emailStr) return null;
  const clean = String(emailStr).trim().toLowerCase();
  if (!clean) return null;
  try {
    const { data: p1 } = await admin.from("profiles").select("id").eq("Gmail", clean).maybeSingle();
    if (p1?.id && isValidUUID(p1.id)) return p1.id;
  } catch {}
  try {
    const { data: p2 } = await admin.from("profiles").select("id").eq("email", clean).maybeSingle();
    if (p2?.id && isValidUUID(p2.id)) return p2.id;
  } catch {}
  return null;
}

async function createAdminNotifications(
  admin: SupabaseClient,
  payload: {
    title: string;
    message: string;
    type: string;
    entity_type?: string;
    entity_id?: string;
    metadata?: Record<string, any>;
  }
) {
  try {
    const adminUserIds = new Set<string>();

    // 1. Get active admins from profiles
    try {
      const { data: adminProfiles } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("is_active", true);

      if (Array.isArray(adminProfiles)) {
        for (const p of adminProfiles) {
          if (p?.id && isValidUUID(p.id)) adminUserIds.add(p.id);
        }
      }
    } catch {}

    // 2. Get active admins from admin_users
    try {
      const { data: adminUsers } = await admin
        .from("admin_users")
        .select("user_id, email")
        .eq("is_active", true);

      if (Array.isArray(adminUsers)) {
        for (const a of adminUsers) {
          if (a?.user_id && isValidUUID(a.user_id)) {
            adminUserIds.add(a.user_id);
          } else if (a?.email) {
            const pid = await resolveProfileIdByEmail(admin, a.email);
            if (pid) adminUserIds.add(pid);
          }
        }
      }
    } catch {}

    const designatedEmails = ["asik.devhub@gmail.com", "ayatulsekh3037@gmail.com", "asikikbal@gmail.com"];
    for (const em of designatedEmails) {
      const pid = await resolveProfileIdByEmail(admin, em);
      if (pid) adminUserIds.add(pid);
    }

    if (adminUserIds.size === 0) return;

    for (const targetUserId of adminUserIds) {
      const baseRow: any = {
        user_id: targetUserId,
        title: payload.title,
        message: payload.message,
        type: payload.type || "info",
        is_read: false
      };

      const fullRow: any = {
        ...baseRow,
        entity_type: payload.entity_type || null,
        entity_id: payload.entity_id || null,
        metadata: payload.metadata || {}
      };

      const { error: fullErr } = await admin.from("notifications").insert([fullRow]);
      if (fullErr) {
        await admin.from("notifications").insert([baseRow]);
      }
    }
  } catch (err) {
    console.warn("createAdminNotifications error:", err);
  }
}

async function ensureProfileRow(
  admin: SupabaseClient,
  userId: string,
  email?: string,
  suppliedName?: string
): Promise<any> {
  if (!isValidUUID(userId)) return null;
  try {
    const { data: existing } = await admin
      .from("profiles")
      .select('id, "Gmail", display_name, avatar_url, role, is_active, preferences')
      .eq("id", userId)
      .maybeSingle();

    if (existing) {
      const updateData: any = {};
      if (email && !existing.Gmail && !existing.email) {
        updateData.Gmail = email;
      }
      if (suppliedName && !existing.display_name) {
        updateData.display_name = suppliedName;
      }
      if (Object.keys(updateData).length > 0) {
        await admin.from("profiles").update(updateData).eq("id", userId);
      }
      return existing;
    }

    const initialName = suppliedName || (email ? email.split("@")[0] : "Member");
    const payload: any = {
      id: userId,
      "Gmail": email || null,
      display_name: initialName,
      role: "user",
      is_active: true,
      preferences: {}
    };

    const { data: created, error } = await admin
      .from("profiles")
      .insert(payload)
      .select('id, "Gmail", display_name, avatar_url, role, is_active, preferences')
      .single();

    if (!error && created) return created;
    const { data: fallback } = await admin
      .from("profiles")
      .select('id, "Gmail", display_name, avatar_url, role, is_active, preferences')
      .eq("id", userId)
      .maybeSingle();
    return fallback || null;
  } catch (err) {
    console.warn("ensureProfileRow error:", err);
    return null;
  }
}

async function ensureColorInSupabase(admin: SupabaseClient, hex: string, name?: string): Promise<string | null> {
  const normHex = String(hex || "").trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normHex)) return null;
  try {
    const { data: existing } = await admin
      .from("colors")
      .select("id, name, hex_code")
      .ilike("hex_code", normHex)
      .limit(1);
    if (existing && existing.length > 0) return existing[0].id;

    const rgb = hexToRgb(normHex);
    const hsl = rgb ? rgbToHsl(rgb) : null;
    const cleanName = (name && name !== normHex) ? name.trim() : normHex;
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + normHex.replace("#", "").toLowerCase();

    const { data: created, error } = await admin
      .from("colors")
      .insert({
        name: cleanName,
        slug: slug,
        hex_code: normHex,
        rgb: rgb ? { r: rgb[0], g: rgb[1], b: rgb[2] } : {},
        hsl: hsl ? { h: hsl[0], s: hsl[1], l: hsl[2] } : {},
        visibility: "public",
        is_active: true
      })
      .select("id")
      .single();

    if (created?.id) return created.id;
    if (error) {
      const { data: retry } = await admin.from("colors").select("id").eq("slug", slug).maybeSingle();
      if (retry?.id) return retry.id;
    }
  } catch (e) {
    console.warn("ensureColorInSupabase warning:", e);
  }
  return null;
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, "");
  const method = request.method;

  try {
    // ---------- Health & Config ----------
    if (route === "health" && method === "GET") {
      try {
        const admin = getAdmin(env);
        const { count, error } = await admin.from("colors").select("*", { count: "exact", head: true });
        if (error) {
          return json({ status: "connected_with_warning", supabaseUrl: env.SUPABASE_URL || "", message: error.message });
        }
        return json({
          status: "ok",
          supabaseConnected: true,
          supabaseUrl: env.SUPABASE_URL || "",
          colorsCount: count ?? 0,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        return json({ status: "error", supabaseConnected: false, error: err?.message || "Unknown error connecting to Supabase" }, 500);
      }
    }

    if (route === "config" && method === "GET") {
      const base = env.SUPABASE_URL || "";
      return json({
        supabaseUrl: base,
        publishableKey: env.SUPABASE_PUBLISHABLE_KEY || "",
        oauth: {
          authorizeUrl: `${base}/auth/v1/oauth/authorize`,
          tokenUrl: `${base}/auth/v1/oauth/token`,
          jwksUrl: `${base}/auth/v1/.well-known/jwks.json`,
          openidConfigUrl: `${base}/auth/v1/.well-known/openid-configuration`
        }
      });
    }

    // ---------- Auth ----------
    if (route === "auth/signup" && method === "POST") {
      const { email, password, name } = await readBody(request);
      if (!email || !password) return json({ error: "Email and password are required." }, 400);

      const admin = getAdmin(env);
      const publicClient = getPublic(env);

      const { data: userData, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name || email.split("@")[0] }
      });

      if (createError) {
        if (createError.message.includes("already") || createError.status === 422) {
          return json({ error: "An account with this email already exists." }, 400);
        }
        return json({ error: createError.message }, 400);
      }

      const userId = userData.user.id;
      await admin.from("profiles").upsert({
        id: userId,
        display_name: name || email.split("@")[0],
        role: "user",
        is_active: true
      });

      const { data: sessionData } = await publicClient.auth.signInWithPassword({ email, password });

      return json({
        success: true,
        user: { id: userId, email: userData.user.email, name: name || email.split("@")[0] },
        session: sessionData?.session || null
      }, 201);
    }

    if (route === "auth/login" && method === "POST") {
      const { email, password } = await readBody(request);
      if (!email || !password) return json({ error: "Email and password are required." }, 400);

      const trimmedEmail = email.trim().toLowerCase();

      const publicClient = getPublic(env);
      const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
        email: trimmedEmail,
        password
      });

      if (signInError) {
        return json({ error: signInError.message || "Invalid email or password" }, 401);
      }

      const admin = getAdmin(env);
      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("id", signInData.user.id)
        .maybeSingle();

      const isExplicitAdmin = isAdminEmail(signInData.user.email);
      const role = isExplicitAdmin ? "admin" : (profile?.role || "user");

      return json({
        success: true,
        user: {
          id: signInData.user.id,
          email: signInData.user.email,
          name: profile?.display_name || signInData.user.user_metadata?.full_name || trimmedEmail.split("@")[0]
        },
        profile,
        role,
        isAdmin: role === "admin" || role === "moderator",
        session: signInData.session
      });
    }

    if (route === "auth/me" && method === "GET") {
      const authHeader = request.headers.get("authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return json({ error: "Missing or invalid authorization header" }, 401);
      }
      const token = authHeader.split(" ")[1];
      const admin = getAdmin(env);
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData?.user) {
        return json({ error: "Invalid or expired session" }, 401);
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();

      const isUserAdmin = (userData.user.email && ADMIN_EMAILS.includes(userData.user.email.toLowerCase())) ||
        profile?.role === "admin" ||
        profile?.role === "moderator";

      return json({
        user: {
          id: userData.user.id,
          email: userData.user.email,
          name: profile?.display_name || userData.user.user_metadata?.full_name || (userData.user.email ? userData.user.email.split("@")[0] : "User")
        },
        profile,
        role: isUserAdmin ? "admin" : (profile?.role || "user"),
        isAdmin: isUserAdmin
      });
    }

    // ---------- Users Sync ----------
    if (route === "users/sync" && method === "POST") {
      const { uid, email, name } = await readBody(request);
      if (!uid || !email) return json({ error: "uid and email are required." }, 400);

      try {
        const admin = getAdmin(env);
        const { data: existingProfile } = await admin
          .from("profiles")
          .select('id, "Gmail", display_name, avatar_url, role, is_active, preferences')
          .eq("id", uid)
          .maybeSingle();

        if (existingProfile) {
          const updatePayload: any = {};
          if (email && !existingProfile.Gmail && !existingProfile.email) {
            updatePayload.Gmail = email;
          }
          if (name && !existingProfile.display_name) {
            updatePayload.display_name = name;
          }
          if (Object.keys(updatePayload).length > 0) {
            await admin.from("profiles").update(updatePayload).eq("id", uid);
          }
          const finalRole = existingProfile.role;
          if (finalRole === "admin") {
            await syncAdminUser(admin, uid, email, existingProfile.display_name || name, "admin", existingProfile.is_active !== false);
          }
          return json({ success: true, id: uid, profile: { ...existingProfile, ...updatePayload } });
        }

        const isInitAdmin = isAdminEmail(email);
        const newPayload: any = {
          id: uid,
          "Gmail": email,
          display_name: name || email.split("@")[0],
          role: isInitAdmin ? "admin" : "user",
          is_active: true,
          preferences: { uid, email }
        };

        const { data: inserted, error: insertError } = await admin
          .from("profiles")
          .insert(newPayload)
          .select('id, "Gmail", display_name, avatar_url, role, is_active, preferences')
          .single();

        if (insertError) {
          await admin.from("profiles").upsert({
            id: uid,
            display_name: name || email.split("@")[0],
            preferences: { uid, email }
          });
        }

        if (isInitAdmin) {
          await syncAdminUser(admin, uid, email, name || email.split("@")[0], "admin", true);
        }

        return json({ success: true, id: uid, profile: inserted || newPayload });
      } catch (err: any) {
        return json({ error: err?.message || "Failed to sync user" }, 500);
      }
    }

    // ---------- OAuth ----------
    if (route === "auth/oauth/config" && method === "GET") {
      const base = env.SUPABASE_URL || "";
      return json({
        issuer: `${base}/auth/v1`,
        authorizeUrl: `${base}/auth/v1/oauth/authorize`,
        tokenUrl: `${base}/auth/v1/oauth/token`,
        jwksUrl: `${base}/auth/v1/.well-known/jwks.json`,
        openidConfigUrl: `${base}/auth/v1/.well-known/openid-configuration`,
        supportedProviders: ["google", "github", "apple"]
      });
    }

    if (route === "auth/oauth/url" && method === "GET") {
      const provider = (url.searchParams.get("provider") || "google").toLowerCase();
      const defaultRedirect = `${url.protocol}//${url.host}/auth/callback`;
      const redirectTo = url.searchParams.get("redirectTo") || defaultRedirect;

      try {
        const publicClient = getPublic(env);
        const { data, error } = await publicClient.auth.signInWithOAuth({
          provider: provider as any,
          options: { redirectTo }
        });

        if (error || !data?.url) {
          const directUrl = `${env.SUPABASE_URL || ""}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
          return json({ url: directUrl, provider, redirectTo, fallback: true });
        }
        return json({ url: data.url, provider, redirectTo });
      } catch {
        const directUrl = `${env.SUPABASE_URL || ""}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(defaultRedirect)}`;
        return json({ url: directUrl, provider, fallback: true });
      }
    }

    if (route === "auth/oauth/exchange" && method === "POST") {
      const { code } = await readBody(request);
      if (!code) return json({ error: "Authorization code is required" }, 400);

      const publicClient = getPublic(env);
      const { data, error } = await publicClient.auth.exchangeCodeForSession(code);
      if (error || !data?.session) {
        return json({ error: error?.message || "Failed to exchange authorization code" }, 400);
      }

      const userEmail = data.user?.email?.toLowerCase() || "";
      const isUserAdmin = ADMIN_EMAILS.includes(userEmail);

      try {
        const admin = getAdmin(env);
        if (data.user) {
          const { data: existingProfile } = await admin
            .from("profiles")
            .select('id, "Gmail", display_name, avatar_url, role, is_active, preferences')
            .eq("id", data.user.id)
            .maybeSingle();

          const targetDisplayName = existingProfile?.display_name || data.user.user_metadata?.full_name || data.user.user_metadata?.name || userEmail.split("@")[0];

          await admin.from("profiles").upsert({
            id: data.user.id,
            "Gmail": data.user.email,
            display_name: targetDisplayName,
            role: isUserAdmin ? "admin" : (existingProfile?.role || "user"),
            avatar_url: existingProfile?.avatar_url || data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null,
            preferences: existingProfile?.preferences || {},
            updated_at: new Date().toISOString()
          });
        }
      } catch {
        // Ignore profile sync errors
      }

      return json({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || userEmail.split("@")[0]
        },
        session: data.session,
        role: isUserAdmin ? "admin" : "user",
        isAdmin: isUserAdmin
      });
    }

    // ---------- Colors & Categories ----------
    if (route === "colors" && method === "GET") {
      const admin = getAdmin(env);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
      const offset = parseInt(url.searchParams.get("offset") || "0") || 0;
      const search = (url.searchParams.get("search") || "").trim();
      const category = (url.searchParams.get("category") || "").trim();

      let query = admin.from("colors").select("*, color_categories(name, slug)", { count: "exact" });

      if (search) {
        query = query.or(`name.ilike.%${search}%,hex_code.ilike.%${search}%`);
      }
      if (category && category !== "all") {
        query = query.eq("color_categories.slug", category);
      }

      query = query.range(offset, offset + limit - 1).order("name", { ascending: true });

      const { data, count, error } = await query;
      if (error) return json({ error: error.message }, 500);

      return json({ colors: data || [], count: data?.length || 0, total: count || 0 });
    }

    if (route === "colors" && method === "POST") {
      const { name, hex_code, description, category_id } = await readBody(request);
      if (!name || !hex_code) return json({ error: "Name and hex_code are required." }, 400);

      const admin = getAdmin(env);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const { data, error } = await admin
        .from("colors")
        .insert([{
          name,
          slug,
          hex_code: hex_code.toUpperCase(),
          description: description || null,
          category_id: category_id || null,
          visibility: "public"
        }])
        .select()
        .single();

      if (error) return json({ error: error.message }, 400);
      return json({ success: true, color: data }, 201);
    }

    if (route === "categories" && method === "GET") {
      const admin = getAdmin(env);
      const { data, error } = await admin
        .from("color_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) return json({ error: error.message }, 500);
      return json({ categories: data || [] });
    }

    // ---------- Feedback & Contact ----------
    if (route === "feedback/upload" && method === "POST") {
      const body = await readBody(request);
      const { image, filename, mime_type } = (body || {}) as any;
      if (!image || typeof image !== "string") {
        return json({ error: "Image data is required." }, 400);
      }

      const admin = getAdmin(env);
      let base64Data = image;
      let contentType = mime_type || "image/jpeg";

      if (image.startsWith("data:")) {
        const matches = image.match(/^data:([a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
        if (matches) {
          contentType = matches[1];
          base64Data = matches[2];
        } else {
          const idx = image.indexOf(",");
          if (idx !== -1) base64Data = image.slice(idx + 1);
        }
      }

      let ext = "jpg";
      if (contentType.includes("png")) ext = "png";
      else if (contentType.includes("webp")) ext = "webp";
      else if (contentType.includes("gif")) ext = "gif";
      else if (contentType.includes("svg")) ext = "svg";

      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const storagePath = `uploads/${uniqueId}.${ext}`;

      try {
        const binStr = atob(base64Data);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }

        const { error: uploadError } = await admin.storage
          .from("feedback-images")
          .upload(storagePath, bytes, {
            contentType: contentType,
            cacheControl: "3600",
            upsert: true
          });

        if (uploadError) {
          console.warn("Feedback image upload storage warning:", uploadError);
          // If storage bucket is not configured or failed, return data URL as fallback
          const fallbackUrl = image.startsWith("data:") ? image : `data:${contentType};base64,${base64Data}`;
          return json({ success: true, url: fallbackUrl, fallback: true });
        }

        const pubRes = admin.storage.from("feedback-images").getPublicUrl(storagePath);
        const publicUrl = pubRes?.data?.publicUrl || null;

        return json({
          success: true,
          url: publicUrl || (image.startsWith("data:") ? image : `data:${contentType};base64,${base64Data}`)
        });
      } catch (err: any) {
        console.warn("Feedback image processing error:", err);
        const fallbackUrl = image.startsWith("data:") ? image : `data:${contentType};base64,${base64Data}`;
        return json({ success: true, url: fallbackUrl, fallback: true });
      }
    }

    if (route === "feedback" && method === "POST") {
      const body = await readBody(request);
      let { message, rating, page_url, email, type, image_url, image_data, subject, user_id } = (body || {}) as any;

      const cleanMessage = typeof message === "string" ? message.trim() : "";
      if (!cleanMessage) return json({ error: "Feedback message is required." }, 400);

      const finalSubject = (typeof subject === "string" && subject.trim())
        ? subject.trim().slice(0, 160)
        : "General Feedback";

      const numRating = typeof rating === "number"
        ? Math.max(1, Math.min(5, rating))
        : (rating && !isNaN(parseInt(rating, 10)) ? Math.max(1, Math.min(5, parseInt(rating, 10))) : null);

      let finalImageUrl = (typeof image_url === "string" && (image_url.trim().startsWith("http") || image_url.trim().startsWith("data:image/")))
        ? image_url.trim()
        : null;

      const cleanPageUrl = page_url ? String(page_url).trim() : null;

      const admin = getAdmin(env);

      // If image_data (base64) was provided without image_url, upload it now
      if (!finalImageUrl && image_data && typeof image_data === "string") {
        try {
          let b64 = image_data;
          let cType = "image/jpeg";
          if (image_data.startsWith("data:")) {
            const m = image_data.match(/^data:([a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
            if (m) {
              cType = m[1];
              b64 = m[2];
            } else {
              const idx = image_data.indexOf(",");
              if (idx !== -1) b64 = image_data.slice(idx + 1);
            }
          }
          let ext = "jpg";
          if (cType.includes("png")) ext = "png";
          else if (cType.includes("webp")) ext = "webp";

          const sPath = `uploads/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
          const binStr = atob(b64);
          const bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);

          const { error: upErr } = await admin.storage
            .from("feedback-images")
            .upload(sPath, bytes, { contentType: cType, upsert: true });

          if (!upErr) {
            const pub = admin.storage.from("feedback-images").getPublicUrl(sPath);
            if (pub?.data?.publicUrl) finalImageUrl = pub.data.publicUrl;
          }
        } catch (e) {
          console.warn("Inline image upload failed, falling back:", e);
        }
        if (!finalImageUrl && image_data.startsWith("data:image/")) {
          finalImageUrl = image_data;
        }
      }

      // Resolve identity authoritatively server-side
      const resolvedUserId = await getAuthUserId(request, env, body);
      let finalUserId: string | null = (resolvedUserId && isValidUUID(resolvedUserId))
        ? resolvedUserId
        : (user_id && isValidUUID(user_id) ? user_id : null);
      let finalEmail: string | null = null;

      if (finalUserId) {
        try {
          const { data: uData } = await admin.auth.admin.getUserById(finalUserId);
          if (uData?.user?.email) {
            finalEmail = uData.user.email;
          }
        } catch {}

        if (!finalEmail) {
          try {
            const { data: prof } = await admin.from("profiles").select('"Gmail", display_name').eq("id", finalUserId).maybeSingle();
            if (prof?.Gmail) finalEmail = prof.Gmail;
          } catch {}
        }
      }

      // If no valid session email resolved, fall back to client-submitted email (optional, for genuinely anonymous submitters)
      if (!finalEmail && email && typeof email === "string" && email.trim().includes("@")) {
        finalEmail = email.trim();
      }

      const feedbackType = (typeof type === "string" && type.trim()) ? type.trim() : "general";

      let insertPayload: any = {
        message: cleanMessage,
        rating: numRating,
        page_url: cleanPageUrl,
        status: "new",
        user_id: finalUserId,
        email: finalEmail,
        type: feedbackType,
        image_url: finalImageUrl,
        subject: finalSubject
      };

      let { data, error } = await admin
        .from("feedback")
        .insert([insertPayload])
        .select(`
          id,
          user_id,
          subject,
          message,
          rating,
          page_url,
          image_url,
          status,
          created_at,
          updated_at
        `);

      // Fallbacks if optional columns are absent in older schemas
      if (error && (insertPayload.email || insertPayload.type)) {
        delete insertPayload.email;
        delete insertPayload.type;
        const retryCols = await admin.from("feedback").insert([insertPayload]).select(`
          id,
          user_id,
          subject,
          message,
          rating,
          page_url,
          image_url,
          status,
          created_at,
          updated_at
        `);
        data = retryCols.data;
        error = retryCols.error;
      }

      // If failed due to subject column missing, retry without subject column
      if (error && insertPayload.subject) {
        delete insertPayload.subject;
        insertPayload.admin_note = [
          `Subject: ${finalSubject}`,
          finalEmail ? `Submitted by: ${finalEmail}` : "",
          `Type: ${feedbackType}`
        ].filter(Boolean).join(" | ");
        const retrySub = await admin.from("feedback").insert([insertPayload]).select();
        data = retrySub.data;
        error = retrySub.error;
      }

      // If failed (e.g. FK constraint on user_id or column missing), retry without user_id
      if (error && finalUserId) {
        delete insertPayload.user_id;
        const retry1 = await admin.from("feedback").insert([insertPayload]).select();
        data = retry1.data;
        error = retry1.error;
      }

      // If failed due to image_url column not existing on remote DB, retry without image_url
      if (error && finalImageUrl) {
        delete insertPayload.image_url;
        const retryNoImg = await admin.from("feedback").insert([insertPayload]).select();
        data = retryNoImg.data;
        error = retryNoImg.error;
      }

      if (error) return json({ error: error.message }, 500);

      const createdFeedback = data?.[0] || null;
      if (!createdFeedback) return json({ error: "Failed to create feedback" }, 500);

      if (!createdFeedback.subject) {
        createdFeedback.subject = finalSubject;
      }

      const submitter = finalEmail || (finalUserId ? `User (${finalUserId.slice(0, 8)})` : "Anonymous");

      await createAdminNotifications(admin, {
        title: `Feedback: ${finalSubject}`,
        message: `New feedback submitted by ${submitter}: "${finalSubject} - ${cleanMessage.slice(0, 60)}"`,
        type: "feedback",
        entity_type: "feedback",
        entity_id: createdFeedback.id,
        metadata: {
          subject: finalSubject,
          rating: numRating,
          page_url: cleanPageUrl,
          email: finalEmail || null,
          has_image: !!finalImageUrl
        }
      });

      return json({
        success: true,
        feedback: {
          id: createdFeedback.id,
          subject: createdFeedback.subject || finalSubject,
          message: createdFeedback.message,
          status: createdFeedback.status,
          created_at: createdFeedback.created_at,
          rating: createdFeedback.rating,
          page_url: createdFeedback.page_url,
          image_url: createdFeedback.image_url,
          user_id: createdFeedback.user_id,
          updated_at: createdFeedback.updated_at
        }
      }, 201);
    }

    if (route === "contact" && method === "POST") {
      const { name, email, subject, message } = await readBody(request);
      if (!name || !email || !message) return json({ error: "Name, email, and message are required." }, 400);

      const finalSubject = (typeof subject === "string" && subject.trim())
        ? subject.trim().slice(0, 160)
        : "General Inquiry";

      const admin = getAdmin(env);
      const { data, error } = await admin
        .from("contact_messages")
        .insert([{
          name,
          email,
          subject: finalSubject,
          message: String(message).trim(),
          status: "new"
        }])
        .select(`
          id,
          user_id,
          name,
          email,
          subject,
          message,
          status,
          created_at,
          updated_at
        `);

      if (error) return json({ error: error.message }, 500);

      const createdMsg = data?.[0] || null;
      if (createdMsg) {
        await createAdminNotifications(admin, {
          title: `Contact: ${finalSubject}`,
          message: `New message from ${name} (${email}): "${finalSubject} - ${String(message).slice(0, 60)}"`,
          type: "contact_message",
          entity_type: "contact_message",
          entity_id: createdMsg.id,
          metadata: {
            name,
            email,
            subject: finalSubject
          }
        });
      }

      return json({ success: true, contact: createdMsg }, 201);
    }

    // ---------- Palettes & Gradients ----------
    if (route === "palettes" && method === "GET") {
      const admin = getAdmin(env);
      const { data, error } = await admin
        .from("palettes")
        .select("*, palette_colors(color_id, position, colors(name, hex_code))")
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 500);
      return json({ palettes: data || [] });
    }

    if (route === "gradients" && method === "GET") {
      const admin = getAdmin(env);
      const { data, error } = await admin
        .from("gradients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 500);
      return json({ gradients: data || [] });
    }

    // ---------- Admin ----------
    if (route === "admin/me" && method === "GET") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      return json({
        success: true,
        admin: {
          id: authResult.admin?.id,
          user_id: authResult.admin?.user_id,
          email: authResult.admin?.email,
          display_name: authResult.admin?.display_name,
          avatar_url: authResult.admin?.avatar_url || null,
          is_active: authResult.admin?.is_active !== false,
          created_at: authResult.admin?.created_at,
          updated_at: authResult.admin?.updated_at
        }
      });
    }

    if (route === "admin/me" && method === "PATCH") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }

      const body = await readBody(request);
      const { display_name, avatar_url } = (body || {}) as any;

      if (display_name === undefined && avatar_url === undefined) {
        return json({ error: "Nothing to update. Provide display_name or avatar_url." }, 400);
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (display_name !== undefined) {
        if (typeof display_name !== "string" || !display_name.trim()) {
          return json({ error: "Admin display name cannot be empty." }, 400);
        }
        updateData.display_name = display_name.trim();
      }

      if (avatar_url !== undefined) {
        if (avatar_url === null || avatar_url === "") {
          updateData.avatar_url = null;
        } else if (typeof avatar_url !== "string" || !/^(https?:\/\/|data:image\/[a-zA-Z0-9.+_-]+;base64,)/i.test(avatar_url.trim())) {
          return json({ error: "Avatar must be a valid image URL or image data." }, 400);
        } else {
          updateData.avatar_url = avatar_url.trim();
        }
      }

      const admin = getAdmin(env);
      const currentAdmin = authResult.admin;
      let targetId = currentAdmin?.id;

      let updatedRow: any = null;
      if (targetId) {
        const { data, error } = await admin
          .from("admin_users")
          .update(updateData)
          .eq("id", targetId)
          .select("id, user_id, email, display_name, avatar_url, is_active, created_at, updated_at")
          .maybeSingle();
        if (!error && data) updatedRow = data;
      }

      if (!updatedRow && currentAdmin?.user_id) {
        const { data, error } = await admin
          .from("admin_users")
          .update(updateData)
          .eq("user_id", currentAdmin.user_id)
          .select("id, user_id, email, display_name, avatar_url, is_active, created_at, updated_at")
          .maybeSingle();
        if (!error && data) updatedRow = data;
      }

      if (!updatedRow && currentAdmin?.email) {
        const { data, error } = await admin
          .from("admin_users")
          .update(updateData)
          .eq("email", currentAdmin.email.toLowerCase())
          .select("id, user_id, email, display_name, avatar_url, is_active, created_at, updated_at")
          .maybeSingle();
        if (!error && data) updatedRow = data;
      }

      if (!updatedRow) {
        return json({ error: "Could not locate admin row to update." }, 404);
      }

      // Sync display_name & avatar_url to profiles table if user_id is present
      if (updatedRow.user_id) {
        try {
          const profileUpdate: any = { updated_at: new Date().toISOString() };
          if (updateData.display_name !== undefined) profileUpdate.display_name = updateData.display_name;
          if (updateData.avatar_url !== undefined) profileUpdate.avatar_url = updateData.avatar_url;
          await admin.from("profiles").update(profileUpdate).eq("id", updatedRow.user_id);
        } catch (err) {
          console.warn("Could not sync profile row:", err);
        }
      }

      return json({ success: true, admin: updatedRow });
    }

    if (route === "admin/admin-users" && method === "GET") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const admin = getAdmin(env);
      const { data, error } = await admin
        .from("admin_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 500);
      return json({ admins: data || [] });
    }

    if (route.startsWith("admin/admin-users/") && method === "PATCH") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }

      const adminId = route.replace("admin/admin-users/", "").trim();
      if (!adminId) return json({ error: "Admin ID is required." }, 400);

      const body = await readBody(request);
      const { display_name, avatar_url, is_active } = (body || {}) as any;

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (display_name !== undefined) {
        if (typeof display_name !== "string" || !display_name.trim()) {
          return json({ error: "Admin display name cannot be empty." }, 400);
        }
        updateData.display_name = display_name.trim();
      }

      if (avatar_url !== undefined) {
        if (avatar_url === null || avatar_url === "") {
          updateData.avatar_url = null;
        } else if (typeof avatar_url !== "string" || !/^(https?:\/\/|data:image\/[a-zA-Z0-9.+_-]+;base64,)/i.test(avatar_url.trim())) {
          return json({ error: "Avatar must be a valid image URL or image data." }, 400);
        } else {
          updateData.avatar_url = avatar_url.trim();
        }
      }

      if (is_active !== undefined) {
        updateData.is_active = Boolean(is_active);
      }

      const admin = getAdmin(env);
      const { data, error } = await admin
        .from("admin_users")
        .update(updateData)
        .eq("id", adminId)
        .select()
        .single();

      if (error) return json({ error: error.message }, 400);

      // If profile info changed, sync corresponding profile row
      if (data && data.user_id) {
        try {
          const profUpdates: any = { updated_at: new Date().toISOString() };
          if (is_active !== undefined) profUpdates.role = is_active ? "admin" : "user";
          if (updateData.display_name !== undefined) profUpdates.display_name = updateData.display_name;
          if (updateData.avatar_url !== undefined) profUpdates.avatar_url = updateData.avatar_url;
          await admin
            .from("profiles")
            .update(profUpdates)
            .eq("id", data.user_id);
        } catch {}
      }

      return json({ success: true, admin: data });
    }

    if (route === "admin/stats" && method === "GET") {
      const admin = getAdmin(env);
      const [
        colorsRes,
        palettesRes,
        profilesRes,
        feedbackRes,
        contactRes,
        gradientsRes
      ] = await Promise.all([
        admin.from("colors").select("*", { count: "exact", head: true }),
        admin.from("palettes").select("*", { count: "exact", head: true }),
        admin.from("profiles").select("*", { count: "exact", head: true }),
        admin.from("feedback").select("*", { count: "exact", head: true }),
        admin.from("contact_messages").select("*", { count: "exact", head: true }),
        admin.from("gradients").select("*", { count: "exact", head: true })
      ]);

      const { data: recentFeedback } = await admin
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: recentMessages } = await admin
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      return json({
        counts: {
          colors: colorsRes.count ?? 0,
          palettes: palettesRes.count ?? 0,
          users: profilesRes.count ?? 0,
          feedback: feedbackRes.count ?? 0,
          contactMessages: contactRes.count ?? 0,
          gradients: gradientsRes.count ?? 0
        },
        recentFeedback: recentFeedback || [],
        recentMessages: recentMessages || []
      });
    }

    if (route === "admin/feedback" && method === "GET") {
      const admin = getAdmin(env);
      const { data, error } = await admin
        .from("feedback")
        .select(`
          id,
          user_id,
          subject,
          message,
          rating,
          page_url,
          image_url,
          status,
          admin_note,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 500);
      const list = (data || []).map((f: any) => {
        let sub = (f.subject || "").trim();
        if (!sub && f.admin_note) {
          const sMatch = f.admin_note.match(/Subject:\s*([^|\n]+)/i);
          if (sMatch && sMatch[1]) sub = sMatch[1].trim();
        }
        return { ...f, subject: sub || "General Feedback" };
      });
      return json({ success: true, feedback: list });
    }

    if (route === "admin/contact-messages" && method === "GET") {
      const admin = getAdmin(env);
      const { data, error } = await admin
        .from("contact_messages")
        .select(`
          id,
          user_id,
          name,
          email,
          subject,
          message,
          status,
          admin_note,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 500);
      return json({ success: true, messages: data || [] });
    }

    if (route === "admin/users" && method === "GET") {
      const admin = getAdmin(env);
      const [{ data: profiles, error: pErr }, { data: adminList }] = await Promise.all([
        admin.from("profiles").select("*").order("created_at", { ascending: false }),
        admin.from("admin_users").select("*")
      ]);

      if (pErr) return json({ error: pErr.message }, 500);

      const adminMap = new Map<string, any>();
      if (adminList) {
        for (const a of adminList) {
          if (a.user_id) adminMap.set(a.user_id, a);
          if (a.email) adminMap.set(a.email.toLowerCase(), a);
        }
      }

      const mergedUsers = (profiles || []).map((p: any) => {
        const matchingAdmin = adminMap.get(p.id) || (p.Gmail && adminMap.get(p.Gmail.toLowerCase())) || (p.email && adminMap.get(p.email.toLowerCase()));
        if (p.role === "admin" && matchingAdmin && matchingAdmin.display_name) {
          return { ...p, display_name: matchingAdmin.display_name };
        }
        return p;
      });

      return json({ users: mergedUsers });
    }

    if (route === "admin/seed-colors" && method === "POST") {
      const admin = getAdmin(env);
      // colors-data.js is a static asset on the same site
      const origin = url.origin;
      const res = await fetch(`${origin}/colors-data.js`);
      if (!res.ok) return json({ error: "colors-data.js not found" }, 404);

      const content = await res.text();
      const jsonMatch = content.match(/window\.COLOR_DATA\s*=\s*([\s\S]*?]);/);
      if (!jsonMatch) return json({ error: "Failed to parse COLOR_DATA" }, 400);

      const colors: Array<{ name: string; hex: string }> = JSON.parse(jsonMatch[1]);
      const body = await readBody(request);
      const limit = Math.min(parseInt(body.limit) || 100, colors.length);
      const toInsert = [];

      for (let i = 0; i < limit; i++) {
        const item = colors[i];
        if (!item || !item.name || !item.hex) continue;
        const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + `-${i}`;
        toInsert.push({
          name: item.name,
          slug,
          hex_code: item.hex.toUpperCase(),
          visibility: "public"
        });
      }

      const { data, error } = await admin
        .from("colors")
        .upsert(toInsert, { onConflict: "slug" })
        .select("id");

      if (error) return json({ error: error.message }, 500);

      return json({ success: true, seeded: data?.length || 0, totalInDataset: colors.length });
    }

    // ---------- Admin Notifications ----------
    if (route === "admin/notifications/unread-count" && method === "GET") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const admin = getAdmin(env);
      let targetUserId = authResult.userId || authResult.admin?.user_id;
      if (!targetUserId && authResult.admin?.email) {
        const pid = await resolveProfileIdByEmail(admin, authResult.admin.email);
        if (pid) targetUserId = pid;
      }

      if (!targetUserId) {
        return new Response(JSON.stringify({ success: true, unreadCount: 0 }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store, no-cache, must-revalidate"
          }
        });
      }

      const { count, error } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId)
        .eq("is_read", false);

      if (error) return json({ error: error.message }, 500);

      return new Response(JSON.stringify({
        success: true,
        unreadCount: Number(count || 0)
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });
    }

    if (route === "admin/notifications/mark-all-read" && method === "PATCH") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const admin = getAdmin(env);
      let targetUserId = authResult.userId || authResult.admin?.user_id;
      if (!targetUserId && authResult.admin?.email) {
        const pid = await resolveProfileIdByEmail(admin, authResult.admin.email);
        if (pid) targetUserId = pid;
      }

      if (!targetUserId) {
        return json({ success: true, updatedCount: 0 });
      }

      const { data, error } = await admin
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", targetUserId)
        .eq("is_read", false)
        .select("id");

      if (error) return json({ error: error.message }, 400);
      return json({ success: true, updatedCount: data?.length || 0 });
    }

    if (route === "admin/notifications" && method === "GET") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const admin = getAdmin(env);
      let targetUserId = authResult.userId || authResult.admin?.user_id;
      if (!targetUserId && authResult.admin?.email) {
        const pid = await resolveProfileIdByEmail(admin, authResult.admin.email);
        if (pid) targetUserId = pid;
      }

      if (!targetUserId) {
        return json({ success: true, notifications: [], unreadCount: 0, total: 0 });
      }

      const limit = Math.min(parseInt(url.searchParams.get("limit") || "30") || 30, 100);
      const offset = parseInt(url.searchParams.get("offset") || "0") || 0;
      const unreadOnly = url.searchParams.get("unreadOnly") === "true";

      let query = admin
        .from("notifications")
        .select(`
          id,
          user_id,
          title,
          message,
          type,
          entity_type,
          entity_id,
          metadata,
          is_read,
          created_at
        `, { count: "exact" })
        .eq("user_id", targetUserId);

      if (unreadOnly) {
        query = query.eq("is_read", false);
      }

      query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

      const [{ data, count, error }, { count: unreadCount }] = await Promise.all([
        query,
        admin
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .eq("is_read", false)
      ]);

      if (error) return json({ error: error.message }, 500);

      return new Response(JSON.stringify({
        success: true,
        notifications: data || [],
        unreadCount: Number(unreadCount || 0),
        total: Number(count || (data ? data.length : 0))
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });
    }

    if (route.startsWith("admin/notifications/") && route.endsWith("/read") && method === "PATCH") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const parts = route.split("/");
      const notifId = parts[2]; // admin/notifications/:id/read
      if (!notifId) return json({ error: "Notification ID is required." }, 400);

      const admin = getAdmin(env);
      let targetUserId = authResult.userId || authResult.admin?.user_id;
      if (!targetUserId && authResult.admin?.email) {
        const pid = await resolveProfileIdByEmail(admin, authResult.admin.email);
        if (pid) targetUserId = pid;
      }

      let updateQuery = admin.from("notifications").update({ is_read: true }).eq("id", notifId);
      if (targetUserId) {
        updateQuery = updateQuery.eq("user_id", targetUserId);
      }

      const { data, error } = await updateQuery.select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, notification: data || { id: notifId, is_read: true } });
    }

    if (route.startsWith("admin/notifications/") && method === "DELETE") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const notifId = route.replace("admin/notifications/", "").trim();
      if (!notifId) return json({ error: "Notification ID is required." }, 400);

      const admin = getAdmin(env);
      let targetUserId = authResult.userId || authResult.admin?.user_id;
      if (!targetUserId && authResult.admin?.email) {
        const pid = await resolveProfileIdByEmail(admin, authResult.admin.email);
        if (pid) targetUserId = pid;
      }

      let deleteQuery = admin.from("notifications").delete().eq("id", notifId);
      if (targetUserId) {
        deleteQuery = deleteQuery.eq("user_id", targetUserId);
      }

      const { error } = await deleteQuery;
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, deletedId: notifId });
    }

    if (route === "admin/notifications" && method === "DELETE") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const admin = getAdmin(env);
      let targetUserId = authResult.userId || authResult.admin?.user_id;
      if (!targetUserId && authResult.admin?.email) {
        const pid = await resolveProfileIdByEmail(admin, authResult.admin.email);
        if (pid) targetUserId = pid;
      }

      if (!targetUserId) {
        return json({ success: true });
      }

      const clearAll = url.searchParams.get("clearAll") === "true";
      let deleteQuery = admin.from("notifications").delete().eq("user_id", targetUserId);
      if (!clearAll) {
        deleteQuery = deleteQuery.eq("is_read", true);
      }

      const { error } = await deleteQuery;
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if ((route === "admin/feedback" || route.startsWith("admin/feedback/")) && method === "DELETE") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      let feedbackId = "";
      if (route.startsWith("admin/feedback/")) {
        feedbackId = decodeURIComponent(route.replace("admin/feedback/", "")).trim();
      } else {
        feedbackId = (url.searchParams.get("id") || "").trim();
      }

      if (!feedbackId) {
        return json({ error: "Feedback id is required." }, 400);
      }

      if (!isValidUUID(feedbackId)) {
        return json({ error: "Invalid feedback ID format (must be UUID)." }, 400);
      }

      const admin = getAdmin(env);
      const { data: existing, error: findError } = await admin
        .from("feedback")
        .select("id, image_url, admin_note")
        .eq("id", feedbackId)
        .maybeSingle();

      if (findError) {
        return json({ error: "Could not query feedback: " + findError.message }, 500);
      }

      if (!existing) {
        return json({ error: "Feedback not found." }, 404);
      }

      // 1. Delete database record
      const { error: deleteError } = await admin
        .from("feedback")
        .delete()
        .eq("id", feedbackId);

      if (deleteError) {
        return json({ error: "Could not delete feedback: " + deleteError.message }, 500);
      }

      // 2. Storage image cleanup
      let imageUrl = existing.image_url;
      if (!imageUrl && existing.admin_note) {
        const iMatch = existing.admin_note.match(/Image:\s*(https?:\/\/[^\s|]+)/i);
        if (iMatch && iMatch[1]) imageUrl = iMatch[1];
      }

      const storagePath = extractFeedbackStoragePath(imageUrl);
      if (storagePath) {
        try {
          await admin.storage.from("feedback-images").remove([storagePath]);
        } catch (imgErr) {
          console.warn("Feedback storage image delete error (non-fatal):", imgErr);
        }
      }

      // 3. Clean up associated notifications
      try {
        await admin
          .from("notifications")
          .delete()
          .eq("entity_type", "feedback")
          .eq("entity_id", feedbackId);
      } catch {}

      // 4. Record activity log
      try {
        const actorUserId = authResult.userId || authResult.admin?.user_id;
        await admin.from("activity_logs").insert({
          user_id: isValidUUID(actorUserId) ? actorUserId : null,
          action: "delete_feedback",
          entity_type: "feedback",
          entity_id: feedbackId,
          metadata: {
            source: "admin_dashboard",
            deleted_by_email: authResult.admin?.email || authResult.userEmail || "admin"
          }
        });
      } catch (logErr) {
        console.warn("Feedback delete activity log error (non-fatal):", logErr);
      }

      return json({
        success: true,
        message: "Feedback deleted successfully",
        deletedId: feedbackId
      });
    }

    if ((route === "admin/contact-messages" || route.startsWith("admin/contact-messages/")) && method === "DELETE") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      let messageId = "";
      if (route.startsWith("admin/contact-messages/")) {
        messageId = decodeURIComponent(route.replace("admin/contact-messages/", "")).trim();
      } else {
        messageId = (url.searchParams.get("id") || "").trim();
      }

      if (!messageId) {
        return json({ error: "Contact message id is required." }, 400);
      }

      if (!isValidUUID(messageId)) {
        return json({ error: "Invalid contact message ID format (must be UUID)." }, 400);
      }

      const admin = getAdmin(env);
      const { data: existing, error: findError } = await admin
        .from("contact_messages")
        .select("id")
        .eq("id", messageId)
        .maybeSingle();

      if (findError) {
        return json({ error: "Could not query contact message: " + findError.message }, 500);
      }

      if (!existing) {
        return json({ error: "Contact message not found." }, 404);
      }

      // 1. Delete database record
      const { error: deleteError } = await admin
        .from("contact_messages")
        .delete()
        .eq("id", messageId);

      if (deleteError) {
        return json({ error: "Could not delete contact message: " + deleteError.message }, 500);
      }

      // 2. Clean up associated notifications
      try {
        await admin
          .from("notifications")
          .delete()
          .eq("entity_type", "contact_message")
          .eq("entity_id", messageId);
      } catch {}

      // 3. Record activity log
      try {
        const actorUserId = authResult.userId || authResult.admin?.user_id;
        await admin.from("activity_logs").insert({
          user_id: isValidUUID(actorUserId) ? actorUserId : null,
          action: "delete_contact_message",
          entity_type: "contact_message",
          entity_id: messageId,
          metadata: {
            source: "admin_dashboard",
            deleted_by_email: authResult.admin?.email || authResult.userEmail || "admin"
          }
        });
      } catch (logErr) {
        console.warn("Contact message delete activity log error (non-fatal):", logErr);
      }

      return json({
        success: true,
        message: "Contact message deleted successfully",
        deletedId: messageId
      });
    }

    if (route === "admin/colors" && method === "DELETE") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const id = (url.searchParams.get("id") || "").trim();
      if (!id) return json({ error: "Color id is required." }, 400);

      const admin = getAdmin(env);
      const { error } = await admin.from("colors").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (route === "admin/gradients" && method === "DELETE") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const id = (url.searchParams.get("id") || "").trim();
      if (!id) return json({ error: "Gradient id is required." }, 400);

      const admin = getAdmin(env);
      const { error } = await admin.from("gradients").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    if (route === "admin/palettes" && method === "DELETE") {
      const authResult = await verifyAdminAuth(request, env);
      if (!authResult.ok) {
        return json({ error: authResult.error }, authResult.status || 403);
      }
      const id = (url.searchParams.get("id") || "").trim();
      if (!id) return json({ error: "Palette id is required." }, 400);

      const admin = getAdmin(env);
      await admin.from("palette_colors").delete().eq("palette_id", id);
      const { error } = await admin.from("palettes").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ---------- Saved Items (Supabase Persistence & Sync) ----------
    if (route === "saved-items" && method === "GET") {
      const userId = (await getAuthUserId(request, env)) || "guest";
      if (isValidUUID(userId)) {
        try {
          const admin = getAdmin(env);
          const profile = await ensureProfileRow(admin, userId);
          const prefs = (profile && profile.preferences) || {};
          let items: any[] = Array.isArray(prefs.saved_items) ? prefs.saved_items.slice() : [];

          // Also fetch from saved_colors table in Supabase
          try {
            const { data: scData } = await admin
              .from("saved_colors")
              .select("id, created_at, color:colors(id, name, hex_code)")
              .eq("user_id", userId);

            if (scData && scData.length > 0) {
              for (const row of scData) {
                const c = row.color as any;
                if (c && c.hex_code) {
                  const h = c.hex_code.toUpperCase();
                  const exists = items.some(it => (it.value && it.value.toUpperCase() === h) || (it.hex && it.hex.toUpperCase() === h));
                  if (!exists) {
                    items.unshift({
                      id: "color-" + (c.name ? c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "saved") + "-" + h.replace("#", "").toLowerCase(),
                      name: c.name || h,
                      type: "color",
                      value: h,
                      hex: h,
                      ts: new Date(row.created_at || Date.now()).getTime()
                    });
                  }
                }
              }
            }
          } catch (scErr) {
            console.warn("Saved colors table query error:", scErr);
          }

          return json({ success: true, items });
        } catch (e) {
          console.warn("Supabase saved-items GET error:", e);
        }
      }
      const items = inMemorySavedItems.get(userId) || [];
      return json({ success: true, items });
    }

    if (route === "saved-items" && method === "POST") {
      const body = await readBody(request);
      const userId = await getAuthUserId(request, env, body);
      if (!userId || !isValidUUID(userId)) {
        return json({ error: "Login required to save" }, 401);
      }
      const { id, name, type, value, hex, c1, c2, css, stops, gradType, colors: inputColors } = body as any;
      const itemVal = value || hex || (c1 && c2 ? `${c1} -> ${c2}` : "");
      const itemId = id || (name ? `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${String(itemVal).replace("#", "").toLowerCase()}` : `item-${Date.now()}`);

      const itemEntry = {
        id: itemId,
        name: name || itemVal || "Saved Item",
        type: type || "color",
        value: itemVal,
        hex: hex || (type === "color" && /^#[0-9A-F]{6}$/i.test(itemVal) ? itemVal.toUpperCase() : undefined),
        c1: c1 || undefined,
        c2: c2 || undefined,
        css: css || undefined,
        stops: stops || undefined,
        gradType: gradType || undefined,
        colors: inputColors || undefined,
        ts: Date.now()
      };

      try {
        const admin = getAdmin(env);
        const profile = await ensureProfileRow(admin, userId);
        const prefs = { ...((profile && profile.preferences) || {}) };
        const items: any[] = Array.isArray(prefs.saved_items) ? prefs.saved_items.slice() : [];
        const existingIdx = items.findIndex((it) => it.id === itemId || (it.value && it.value.toUpperCase() === String(itemVal).toUpperCase()));
        if (existingIdx >= 0) items[existingIdx] = itemEntry;
        else items.unshift(itemEntry);
        if (items.length > 500) items.splice(500);
        prefs.saved_items = items;
        await admin.from("profiles").update({ preferences: prefs }).eq("id", userId);

        // Also save directly into dedicated Supabase tables
        if (type === "color" || /^#[0-9A-F]{6}$/i.test(itemVal)) {
          const colorHex = String(itemVal).trim().toUpperCase();
          if (/^#[0-9A-F]{6}$/.test(colorHex)) {
            const colorId = await ensureColorInSupabase(admin, colorHex, name);
            if (colorId) {
              await admin.from("saved_colors").upsert({
                user_id: userId,
                color_id: colorId
              }, { onConflict: "user_id,color_id" });
            }
          }
        } else if (type === "gradient" && c1 && c2) {
          try {
            await admin.from("gradients").insert({
              user_id: userId,
              name: name || `${c1} to ${c2}`,
              type: gradType || "linear",
              color_stops: stops || [{ color: c1, pos: 0 }, { color: c2, pos: 100 }],
              css_value: css || `linear-gradient(120deg, ${c1} 0%, ${c2} 100%)`,
              visibility: "private"
            });
          } catch {}
        } else if (type === "mix") {
          try {
            await admin.from("color_mix_sessions").insert({
              user_id: userId,
              name: name || "Custom Mix",
              input_colors: stops || [c1, c2].filter(Boolean),
              output_color: { hex: itemVal, css }
            });
          } catch {}
        }

        return json({ success: true, id: itemId, item: itemEntry });
      } catch (e: any) {
        console.warn("Supabase saved-items POST error:", e);
        return json({ error: e?.message || "Failed to save item" }, 500);
      }
    }

    if (route === "saved-items/sync" && method === "POST") {
      const body = await readBody(request);
      const userId = await getAuthUserId(request, env, body);
      if (!userId || !isValidUUID(userId)) {
        return json({ error: "Login required to save" }, 401);
      }
      const clientItems: any[] = Array.isArray(body?.items) ? body.items : [];

      try {
        const admin = getAdmin(env);
        const profile = await ensureProfileRow(admin, userId);
        const prefs = { ...((profile && profile.preferences) || {}) };
        const serverItems: any[] = Array.isArray(prefs.saved_items) ? prefs.saved_items.slice() : [];

        const map = new Map<string, any>();
        for (const it of serverItems) {
          if (!it) continue;
          const k = String(it.id || it.value || it.hex || it.name).toLowerCase();
          map.set(k, it);
        }
        for (const it of clientItems) {
          if (!it) continue;
          const k = String(it.id || it.value || it.hex || it.name).toLowerCase();
          if (!map.has(k)) {
            map.set(k, { ...it, ts: it.ts || Date.now() });
          }
        }

        const merged = Array.from(map.values());
        if (merged.length > 500) merged.splice(500);
        prefs.saved_items = merged;
        await admin.from("profiles").update({ preferences: prefs }).eq("id", userId);

        // Sync colors to saved_colors table
        for (const it of merged) {
          if (it.type === "color" || /^#[0-9A-F]{6}$/i.test(it.value || it.hex || "")) {
            const h = (it.value || it.hex || "").trim().toUpperCase();
            if (/^#[0-9A-F]{6}$/.test(h)) {
              const colorId = await ensureColorInSupabase(admin, h, it.name);
              if (colorId) {
                await admin.from("saved_colors").upsert({
                  user_id: userId,
                  color_id: colorId
                }, { onConflict: "user_id,color_id" });
              }
            }
          }
        }

        return json({ success: true, items: merged });
      } catch (e: any) {
        console.warn("Supabase batch sync error:", e);
        return json({ error: e?.message || "Failed to sync items" }, 500);
      }
    }

    if (route === "saved-items" && method === "DELETE") {
      let body: any = {};
      try { body = await readBody(request); } catch {}
      const userId = await getAuthUserId(request, env, body);
      if (!userId || !isValidUUID(userId)) {
        return json({ error: "Login required to save" }, 401);
      }
      const id = (url.searchParams.get("id") || body?.id || "").trim();
      const value = (url.searchParams.get("value") || body?.value || url.searchParams.get("hex") || "").trim();
      if (!id && !value) return json({ error: "Item id or value is required." }, 400);

      try {
        const admin = getAdmin(env);
        const profile = await ensureProfileRow(admin, userId);
        const prefs = { ...((profile && profile.preferences) || {}) };
        prefs.saved_items = ((prefs.saved_items as any[]) || []).filter((it) => {
          const itId = String(it.id || "").trim().toLowerCase();
          const itVal = String(it.value || it.hex || "").trim().toUpperCase();
          const targetId = id.toLowerCase();
          const targetVal = value.toUpperCase();
          return itId !== targetId && (!targetVal || itVal !== targetVal);
        });
        await admin.from("profiles").update({ preferences: prefs }).eq("id", userId);

        // Delete from saved_colors table if color
        const hexVal = (value || id).trim().toUpperCase();
        if (/^#[0-9A-F]{6}$/.test(hexVal)) {
          const { data: cData } = await admin.from("colors").select("id").ilike("hex_code", hexVal).limit(1);
          if (cData && cData[0]) {
            await admin.from("saved_colors").delete().eq("user_id", userId).eq("color_id", cData[0].id);
          }
        }

        return json({ success: true });
      } catch (e: any) {
        console.warn("Supabase saved-items DELETE error:", e);
        return json({ error: e?.message || "Failed to delete item" }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (err: any) {
    return json({ error: err?.message || "Internal server error" }, 500);
  }
};
