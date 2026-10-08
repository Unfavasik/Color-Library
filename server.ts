import express from "express";
import path from "path";
import fs from "fs";
import {
  getSupabaseAdmin,
  getSupabasePublic,
  isSupabaseConfigured,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_JWKS_URL,
  SUPABASE_OAUTH_AUTHORIZE_URL,
  SUPABASE_OAUTH_TOKEN_URL,
  SUPABASE_OPENID_CONFIG_URL
} from "./lib/supabase.ts";

const app = express();
const PORT = 3000;

// Load the project env file (v0 mirrors project vars into .env.development.local)
if (!process.env.apiKey) {
  try {
    process.loadEnvFile(path.join(process.cwd(), ".env.development.local"));
  } catch {
    // env file missing or already loaded — routes fall back gracefully
  }
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ----------------------------------------------------
// In-Memory Data Fallback (for offline or unconfigured Supabase)
// ----------------------------------------------------

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16)
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16)
    ];
  }
  return null;
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

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function classifyColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "Gray";
  const [h, s, l] = rgbToHsl(rgb);
  if (s < 9) return l < 10 ? "Black" : l > 92 ? "White" : "Gray";
  if (h < 12 || h >= 345) return "Red";
  if (h < 42) return "Orange";
  if (h < 68) return "Yellow";
  if (h < 88) return "Green";
  if (h < 165) return "Teal";
  if (h < 195) return "Cyan";
  if (h < 218) return "Blue";
  if (h < 245) return "Indigo";
  if (h < 285) return "Purple";
  if (h < 345) return "Pink";
  return "Red";
}

interface LocalColor {
  id: string;
  name: string;
  slug: string;
  hex_code: string;
  description?: string | null;
  visibility: string;
  category_name?: string;
  category_slug?: string;
  color_categories?: { name: string; slug: string };
}

let localColors: LocalColor[] = [];
try {
  const colorsDataPath = path.join(process.cwd(), "colors-data.js");
  if (fs.existsSync(colorsDataPath)) {
    const content = fs.readFileSync(colorsDataPath, "utf-8");
    const jsonMatch = content.match(/window\.COLOR_DATA\s*=\s*(\[[\s\S]*?\]);/);
    if (jsonMatch) {
      const raw: Array<{ name: string; hex: string }> = JSON.parse(jsonMatch[1]);
      localColors = raw.map((c, i) => {
        const cat = classifyColor(c.hex);
        const catSlug = cat.toLowerCase();
        return {
          id: `color-${i + 1}`,
          name: c.name,
          slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + `-${i}`,
          hex_code: (c.hex || "").toUpperCase(),
          visibility: "public",
          category_name: cat,
          category_slug: catSlug,
          color_categories: { name: cat, slug: catSlug }
        };
      });
    }
  }
} catch (e) {
  console.warn("[AI Studio] Could not load local colors dataset:", e);
}

const CATEGORY_NAMES = ["Red", "Pink", "Purple", "Indigo", "Blue", "Cyan", "Teal", "Green", "Yellow", "Orange", "Brown", "Gray", "Black", "White"];
const localCategories = CATEGORY_NAMES.map((name, i) => {
  const slug = name.toLowerCase();
  const count = localColors.filter(c => c.category_slug === slug).length;
  return {
    id: `cat-${i + 1}`,
    name,
    slug,
    is_active: true,
    sort_order: i,
    color_count: count
  };
});

let inMemoryFeedback: Array<{
  id: string;
  message: string;
  rating: number | null;
  page_url: string | null;
  admin_note: string | null;
  status: string;
  created_at: string;
}> = [];

let inMemoryContactMessages: Array<{
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}> = [];

const inMemorySavedItems = new Map<string, any[]>();

// ----------------------------------------------------
// Supabase Backend API Routes (/api/*)
// ----------------------------------------------------

// 1. Health & Config
app.get("/api/health", async (_req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { count, error } = await admin.from("colors").select("*", { count: "exact", head: true });
      if (!error) {
        return res.status(200).json({
          status: "ok",
          supabaseConnected: true,
          supabaseUrl: SUPABASE_URL,
          colorsCount: count ?? localColors.length,
          timestamp: new Date().toISOString()
        });
      }
    } catch {
      // Supabase connection failed, fall back
    }
  }
  return res.status(200).json({
    status: "ok",
    supabaseConnected: false,
    fallbackMode: true,
    colorsCount: localColors.length,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    oauth: {
      authorizeUrl: SUPABASE_OAUTH_AUTHORIZE_URL,
      tokenUrl: SUPABASE_OAUTH_TOKEN_URL,
      jwksUrl: SUPABASE_JWKS_URL,
      openidConfigUrl: SUPABASE_OPENID_CONFIG_URL
    }
  });
});

// 2. Authentication
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const admin = getSupabaseAdmin();
    const publicClient = getSupabasePublic();

    // Create user in Supabase Auth
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name || email.split("@")[0] }
    });

    if (createError) {
      // Check if user already exists
      if (createError.message.includes("already") || createError.status === 422) {
        return res.status(400).json({ error: "An account with this email already exists." });
      }
      return res.status(400).json({ error: createError.message });
    }

    const userId = userData.user.id;

    // Ensure profile entry exists
    await admin.from("profiles").upsert({
      id: userId,
      display_name: name || email.split("@")[0],
      role: "user",
      is_active: true
    });

    // Log user in to return active session tokens
    const { data: sessionData } = await publicClient.auth.signInWithPassword({
      email,
      password
    });

    return res.status(201).json({
      success: true,
      user: {
        id: userId,
        email: userData.user.email,
        name: name || email.split("@")[0]
      },
      session: sessionData?.session || null
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: err?.message || "Failed to create account" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const isAdminEmail = (e?: string | null) => (e ? ADMIN_EMAILS.includes(e.trim().toLowerCase()) : false);

    // Designated Admin Accounts must sign in with their real Supabase
    // credentials — no fallback passwords. The account is created via the
    // public signup page, then verified against the ADMIN_EMAILS whitelist.
    if (isAdminEmail(trimmedEmail)) {
      let supabaseUser = null;
      let supabaseSession = null;
      let signInError: string | null = null;
      try {
        const publicClient = getSupabasePublic();
        const { data: signInData, error: signInErr } = await publicClient.auth.signInWithPassword({
          email: trimmedEmail,
          password
        });
        if (!signInErr && signInData?.user) {
          supabaseUser = signInData.user;
          supabaseSession = signInData.session;
        } else {
          signInError = signInErr?.message || "Invalid login credentials";
        }
      } catch (e: any) {
        signInError = e?.message || "Invalid login credentials";
      }

      if (supabaseUser && supabaseSession) {
        const adminName = trimmedEmail === "ayatulsekh3037@gmail.com"
          ? "Ayatul Sekh (Admin)"
          : trimmedEmail === "asik.devhub@gmail.com"
            ? "Asik Devhub (Admin)"
            : "Admin";

        try {
          const admin = getSupabaseAdmin();
          if (supabaseUser) {
            await admin.from("profiles").upsert({
              id: supabaseUser.id,
              email: trimmedEmail,
              display_name: adminName,
              role: "admin",
              updated_at: new Date().toISOString()
            });
          }
        } catch {
          // ignore profile sync error
        }

        return res.json({
          success: true,
          user: {
            id: supabaseUser!.id,
            email: trimmedEmail,
            name: adminName
          },
          role: "admin",
          isAdmin: true,
          session: supabaseSession
        });
      }

      // Distinguish "wrong password" from "account does not exist yet".
      if (/invalid login credentials/i.test(signInError || "")) {
        return res.status(401).json({ error: "Wrong email or password. Please try again." });
      }
      if (/email not confirmed/i.test(signInError || "")) {
        return res.status(403).json({ error: "Please verify your email address first, then sign in." });
      }
      return res.status(401).json({
        error: "No admin account found for this email. Please sign up first, then sign in."
      });
    }

    const publicClient = getSupabasePublic();
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email: trimmedEmail,
      password
    });

    if (signInError) {
      return res.status(401).json({ error: signInError.message || "Invalid email or password" });
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", signInData.user.id)
      .maybeSingle();

    const isExplicitAdmin = isAdminEmail(signInData.user.email);
    const role = isExplicitAdmin ? "admin" : (profile?.role || "user");

    return res.json({
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
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: err?.message || "Failed to sign in" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }
    const token = authHeader.split(" ")[1];
    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .maybeSingle();

    const ADMIN_EMAILS = [
      "asik.devhub@gmail.com",
      "ayatulsekh3037@gmail.com",
      "asikikbal@gmail.com"
    ];
    const isUserAdmin = (userData.user.email && ADMIN_EMAILS.includes(userData.user.email.toLowerCase())) ||
      profile?.role === "admin" ||
      profile?.role === "moderator";

    return res.json({
      user: {
        id: userData.user.id,
        email: userData.user.email,
        name: profile?.display_name || userData.user.user_metadata?.full_name || (userData.user.email ? userData.user.email.split("@")[0] : "User")
      },
      profile,
      role: isUserAdmin ? "admin" : (profile?.role || "user"),
      isAdmin: isUserAdmin
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to get user profile" });
  }
});

// OAuth Endpoints (Supabase OAuth & OpenID Connect)
app.get("/api/auth/oauth/config", (_req, res) => {
  res.json({
    issuer: `${SUPABASE_URL}/auth/v1`,
    authorizeUrl: SUPABASE_OAUTH_AUTHORIZE_URL,
    tokenUrl: SUPABASE_OAUTH_TOKEN_URL,
    jwksUrl: SUPABASE_JWKS_URL,
    openidConfigUrl: SUPABASE_OPENID_CONFIG_URL,
    supportedProviders: ["google", "github", "apple"]
  });
});

app.get("/api/auth/oauth/url", async (req, res) => {
  try {
    const provider = (req.query.provider as string || "google").toLowerCase();
    const host = req.get("host");
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const defaultRedirect = `${protocol}://${host}/auth/callback`;
    const redirectTo = (req.query.redirectTo as string) || defaultRedirect;

    const publicClient = getSupabasePublic();
    const { data, error } = await publicClient.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo
      }
    });

    if (error || !data?.url) {
      const directUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
      return res.json({
        url: directUrl,
        provider,
        redirectTo,
        fallback: true
      });
    }

    return res.json({
      url: data.url,
      provider,
      redirectTo
    });
  } catch (err: any) {
    const provider = (req.query.provider as string || "google").toLowerCase();
    const host = req.get("host");
    const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const defaultRedirect = `${protocol}://${host}/auth/callback`;
    const directUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(defaultRedirect)}`;
    return res.json({
      url: directUrl,
      provider,
      fallback: true
    });
  }
});

app.post("/api/auth/oauth/exchange", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    const publicClient = getSupabasePublic();
    const { data, error } = await publicClient.auth.exchangeCodeForSession(code);
    if (error || !data?.session) {
      return res.status(400).json({ error: error?.message || "Failed to exchange authorization code" });
    }

    const ADMIN_EMAILS = [
      "asik.devhub@gmail.com",
      "ayatulsekh3037@gmail.com",
      "asikikbal@gmail.com"
    ];
    const userEmail = data.user?.email?.toLowerCase() || "";
    const isUserAdmin = ADMIN_EMAILS.includes(userEmail);

    try {
      const admin = getSupabaseAdmin();
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

    return res.json({
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
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to exchange OAuth code" });
  }
});

// 3. Colors & Categories
app.get("/api/colors", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const search = (req.query.search as string || "").trim().toLowerCase();
  const category = (req.query.category as string || "").trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      let query = admin.from("colors").select("*, color_categories(name, slug)", { count: "exact" });

      if (search) {
        query = query.or(`name.ilike.%${search}%,hex_code.ilike.%${search}%`);
      }

      if (category && category !== "all") {
        query = query.eq("color_categories.slug", category);
      }

      query = query.range(offset, offset + limit - 1).order("name", { ascending: true });

      const { data, count, error } = await query;
      if (!error && data) {
        return res.json({
          colors: data,
          count: data.length,
          total: count || data.length
        });
      }
    } catch {
      // Fall through to local fallback
    }
  }

  let filtered = localColors;
  if (search) {
    filtered = filtered.filter(
      c => c.name.toLowerCase().includes(search) || c.hex_code.toLowerCase().includes(search)
    );
  }
  if (category && category !== "all") {
    filtered = filtered.filter(c => c.category_slug === category);
  }

  const slice = filtered.slice(offset, offset + limit);
  return res.json({
    colors: slice,
    count: slice.length,
    total: filtered.length
  });
});

app.get("/api/categories", async (_req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("color_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        const { data: catColors } = await admin.from("colors").select("category_id");
        const counts: Record<string, number> = {};
        ((catColors as any[]) || []).forEach((c) => {
          if (c.category_id) counts[c.category_id] = (counts[c.category_id] || 0) + 1;
        });
        const categories = (data || []).map((c: any) => ({ ...c, color_count: counts[c.id] || 0 }));
        return res.json({ categories });
      }
    } catch {
      // Fall through to local fallback
    }
  }

  return res.json({ categories: localCategories });
});

app.post("/api/colors", async (req, res) => {
  try {
    const { name, hex_code, description, category_id } = req.body;
    if (!name || !hex_code) {
      return res.status(400).json({ error: "Name and hex_code are required." });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const hex = hex_code.toUpperCase();

    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdmin();
        const { data, error } = await admin
          .from("colors")
          .insert([{
            name,
            slug,
            hex_code: hex,
            description: description || null,
            category_id: category_id || null,
            visibility: "public"
          }])
          .select()
          .single();

        if (!error && data) return res.status(201).json({ success: true, color: data });
      } catch {
        // Fall through to local
      }
    }

    const cat = classifyColor(hex);
    const catSlug = cat.toLowerCase();
    const newColor: LocalColor = {
      id: `color-${localColors.length + 1}`,
      name,
      slug,
      hex_code: hex,
      description: description || null,
      visibility: "public",
      category_name: cat,
      category_slug: catSlug,
      color_categories: { name: cat, slug: catSlug }
    };
    localColors.unshift(newColor);
    return res.status(201).json({ success: true, color: newColor });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to add color" });
  }
});

// 4. Feedback & Contact
app.post("/api/feedback/upload", async (req, res) => {
  try {
    const { image, filename, mime_type } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "Image data is required." });
    }

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

    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdmin();
        const buffer = Buffer.from(base64Data, "base64");

        const { error: uploadError } = await admin.storage
          .from("feedback-images")
          .upload(storagePath, buffer, {
            contentType: contentType,
            cacheControl: "3600",
            upsert: true
          });

        if (uploadError) {
          console.warn("Feedback image upload storage warning:", uploadError);
          const fallbackUrl = image.startsWith("data:") ? image : `data:${contentType};base64,${base64Data}`;
          return res.json({ success: true, url: fallbackUrl, fallback: true });
        }

        const pubRes = admin.storage.from("feedback-images").getPublicUrl(storagePath);
        const publicUrl = pubRes?.data?.publicUrl || null;

        return res.json({
          success: true,
          url: publicUrl || (image.startsWith("data:") ? image : `data:${contentType};base64,${base64Data}`)
        });
      } catch (err: any) {
        console.warn("Feedback image upload processing error:", err);
        const fallbackUrl = image.startsWith("data:") ? image : `data:${contentType};base64,${base64Data}`;
        return res.json({ success: true, url: fallbackUrl, fallback: true });
      }
    }

    const fallbackUrl = image.startsWith("data:") ? image : `data:${contentType};base64,${base64Data}`;
    return res.json({ success: true, url: fallbackUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to process image upload." });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    let { message, rating, page_url, email, type, image_url, image_data, subject, user_id } = req.body || {};
    const cleanMessage = typeof message === "string" ? message.trim() : "";
    if (!cleanMessage) {
      return res.status(400).json({ error: "Feedback message is required." });
    }

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

    let finalUserId: string | null = (user_id && isValidUUID(user_id)) ? user_id : null;
    let finalEmail: string | null = null;

    if (isSupabaseConfigured()) {
      const admin = getSupabaseAdmin();
      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;

      if (token) {
        try {
          const { data: uData } = await admin.auth.getUser(token);
          if (uData?.user?.id) {
            finalUserId = uData.user.id;
            finalEmail = uData.user.email || null;
          }
        } catch {}
      }

      if (!finalEmail && email && typeof email === "string" && email.trim().includes("@")) {
        finalEmail = email.trim();
      }

      // If base64 image_data is provided without image_url, attempt storage upload
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
          const buffer = Buffer.from(b64, "base64");

          const { error: upErr } = await admin.storage
            .from("feedback-images")
            .upload(sPath, buffer, { contentType: cType, upsert: true });

          if (!upErr) {
            const pub = admin.storage.from("feedback-images").getPublicUrl(sPath);
            if (pub?.data?.publicUrl) finalImageUrl = pub.data.publicUrl;
          }
        } catch (e) {
          console.warn("Inline image upload failed:", e);
        }
        if (!finalImageUrl && image_data.startsWith("data:image/")) {
          finalImageUrl = image_data;
        }
      }

      const feedbackType = (typeof type === "string" && type.trim()) ? type.trim() : "general";

      try {
        let insertPayload: any = {
          message: cleanMessage,
          rating: numRating,
          page_url: cleanPageUrl,
          email: finalEmail,
          user_id: finalUserId,
          type: feedbackType,
          image_url: finalImageUrl,
          status: "new",
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

        // If error occurred and subject column does not exist in schema cache, fallback gracefully
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

        if (error && finalUserId) {
          delete insertPayload.user_id;
          const retry1 = await admin.from("feedback").insert([insertPayload]).select();
          data = retry1.data;
          error = retry1.error;
        }

        if (error && finalImageUrl) {
          delete insertPayload.image_url;
          const retryNoImg = await admin.from("feedback").insert([insertPayload]).select();
          data = retryNoImg.data;
          error = retryNoImg.error;
        }

        if (!error && data) {
          const createdFb = data?.[0] || null;
          if (createdFb) {
            if (!createdFb.subject) {
              createdFb.subject = finalSubject;
            }
            const submitter = finalEmail || (finalUserId ? `User (${finalUserId.slice(0, 8)})` : "Anonymous");

            createAdminNotifications({
              title: `Feedback: ${finalSubject}`,
              message: `New feedback submitted by ${submitter}: "${finalSubject} - ${cleanMessage.slice(0, 60)}"`,
              type: "feedback",
              entity_type: "feedback",
              entity_id: createdFb.id,
              metadata: {
                subject: finalSubject,
                rating: numRating,
                page_url: cleanPageUrl,
                email: finalEmail || null,
                has_image: !!finalImageUrl
              }
            });
          }
          return res.status(201).json({
            success: true,
            feedback: {
              id: createdFb.id,
              subject: createdFb.subject || finalSubject,
              message: createdFb.message,
              status: createdFb.status,
              created_at: createdFb.created_at,
              rating: createdFb.rating,
              page_url: createdFb.page_url,
              image_url: createdFb.image_url,
              user_id: createdFb.user_id,
              updated_at: createdFb.updated_at
            }
          });
        }
      } catch {
        // Fall through to in-memory
      }
    }

    if (!finalEmail && email && typeof email === "string" && email.trim().includes("@")) {
      finalEmail = email.trim();
    }
    const feedbackType = (typeof type === "string" && type.trim()) ? type.trim() : "general";

    const fb = {
      id: `fb-${Date.now()}`,
      subject: finalSubject,
      message: cleanMessage,
      rating: numRating,
      page_url: cleanPageUrl,
      email: finalEmail,
      user_id: finalUserId,
      type: feedbackType,
      image_url: finalImageUrl,
      admin_note: `Subject: ${finalSubject}`,
      status: "new",
      created_at: new Date().toISOString()
    };
    inMemoryFeedback.unshift(fb);

    const submitter = finalEmail || "Anonymous";

    createAdminNotifications({
      title: `Feedback: ${finalSubject}`,
      message: `New feedback submitted by ${submitter}: "${finalSubject} - ${cleanMessage.slice(0, 60)}"`,
      type: "feedback",
      entity_type: "feedback",
      entity_id: fb.id,
      metadata: { subject: finalSubject, rating: numRating, page_url: cleanPageUrl, email: finalEmail, type: feedbackType }
    });

    return res.status(201).json({
      success: true,
      feedback: {
        id: fb.id,
        subject: fb.subject,
        message: fb.message,
        status: fb.status,
        created_at: fb.created_at
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to save feedback" });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message are required." });
    }

    const finalSubject = (typeof subject === "string" && subject.trim())
      ? subject.trim().slice(0, 160)
      : "General Inquiry";

    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdmin();
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

        if (!error && data) {
          const createdMsg = data?.[0] || null;
          if (createdMsg) {
            createAdminNotifications({
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
          return res.status(201).json({ success: true, contact: createdMsg });
        }
      } catch {
        // Fall through to in-memory
      }
    }

    const msg = {
      id: `msg-${Date.now()}`,
      name,
      email,
      subject: finalSubject,
      message,
      status: "new",
      created_at: new Date().toISOString()
    };
    inMemoryContactMessages.unshift(msg);
    createAdminNotifications({
      title: `Contact: ${finalSubject}`,
      message: `New message from ${name} (${email}): "${finalSubject} - ${String(message).slice(0, 60)}"`,
      type: "contact_message",
      entity_type: "contact_message",
      entity_id: msg.id,
      metadata: { name, email, subject: finalSubject }
    });
    return res.status(201).json({ success: true, contact: msg });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to save contact message" });
  }
});

// 5. Palettes & Gradients
app.get("/api/palettes", async (_req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("palettes")
        .select("*, palette_colors(color_id, position, colors(name, hex_code))")
        .order("created_at", { ascending: false });

      if (!error && data) return res.json({ palettes: data });
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback palettes
  const defaultPalettes = [
    {
      id: "pal-1",
      name: "Ocean Sunset",
      slug: "ocean-sunset",
      created_at: new Date().toISOString(),
      palette_colors: [
        { position: 0, colors: { name: "Midnight Navy", hex_code: "#003366" } },
        { position: 1, colors: { name: "Dodger Blue", hex_code: "#1E90FF" } },
        { position: 2, colors: { name: "Coral Peach", hex_code: "#FBD5AB" } },
        { position: 3, colors: { name: "Sunset Orange", hex_code: "#FF7722" } }
      ]
    },
    {
      id: "pal-2",
      name: "Emerald Forest",
      slug: "emerald-forest",
      created_at: new Date().toISOString(),
      palette_colors: [
        { position: 0, colors: { name: "Hunter Green", hex_code: "#355E3B" } },
        { position: 1, colors: { name: "Mint Green", hex_code: "#98FF98" } },
        { position: 2, colors: { name: "Tea Green", hex_code: "#CCFB5D" } },
        { position: 3, colors: { name: "Lime Mint", hex_code: "#36F57F" } }
      ]
    }
  ];
  return res.json({ palettes: defaultPalettes });
});

app.get("/api/gradients", async (_req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("gradients")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) return res.json({ gradients: data });
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback gradients
  const defaultGradients = [
    { id: "grad-1", name: "Hyper Blue", c1: "#1E90FF", c2: "#0020C2", type: "linear" },
    { id: "grad-2", name: "Neon Sunset", c1: "#FF4500", c2: "#FF1493", type: "linear" },
    { id: "grad-3", name: "Spring Fresh", c1: "#00FF7F", c2: "#00BFFF", type: "linear" }
  ];
  return res.json({ gradients: defaultGradients });
});

// 6. Admin Panel APIs

// Designated admin accounts (whitelist). Keep in sync with the /admin page.
const ADMIN_EMAILS = [
  "asik.devhub@gmail.com",
  "ayatulsekh3037@gmail.com",
  "asikikbal@gmail.com"
];

// Helper to sync admin user into admin_users table
async function syncAdminUser(admin: any, {
  userId,
  email,
  displayName,
  role,
  isActive
}: {
  userId?: string | null;
  email: string;
  displayName?: string | null;
  role?: string | null;
  isActive?: boolean;
}) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return;
  const isAdminRole = role === "admin" || ADMIN_EMAILS.includes(cleanEmail);

  try {
    if (isAdminRole) {
      const { data: existingAdmin } = await admin
        .from("admin_users")
        .select("id, display_name, is_active")
        .eq("email", cleanEmail)
        .maybeSingle();

      const finalDisplayName = (existingAdmin?.display_name && existingAdmin.display_name.trim())
        ? existingAdmin.display_name.trim()
        : ((displayName && displayName.trim()) || cleanEmail.split("@")[0]);

      await admin.from("admin_users").upsert({
        email: cleanEmail,
        user_id: userId || undefined,
        display_name: finalDisplayName,
        is_active: isActive !== undefined ? isActive : true,
        updated_at: new Date().toISOString()
      }, { onConflict: "email" });
    } else {
      await admin.from("admin_users").update({
        is_active: false,
        updated_at: new Date().toISOString()
      }).eq("email", cleanEmail);
    }
  } catch (err) {
    console.warn("syncAdminUser error:", err);
  }
}

async function resolveProfileIdByEmail(admin: any, emailStr?: string | null): Promise<string | null> {
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

let inMemoryNotifications: any[] = [];

async function createAdminNotifications(
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
    if (isSupabaseConfigured()) {
      const admin = getSupabaseAdmin();
      const adminUserIds = new Set<string>();

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
      } catch (e) {
        console.warn("createAdminNotifications admin profiles query warning:", e);
      }

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
      } catch (e) {
        console.warn("createAdminNotifications admin users query warning:", e);
      }

      // Always resolve any configured admin emails
      for (const email of ADMIN_EMAILS) {
        const pid = await resolveProfileIdByEmail(admin, email);
        if (pid) adminUserIds.add(pid);
      }

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
          const { error: baseErr } = await admin.from("notifications").insert([baseRow]);
          if (baseErr) {
            console.warn("Notification insert fallback failed:", baseErr.message);
          }
        }
      }
    }

    const memNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: "admin-dev",
      title: payload.title,
      message: payload.message,
      type: payload.type || "info",
      entity_type: payload.entity_type || null,
      entity_id: payload.entity_id || null,
      is_read: false,
      metadata: payload.metadata || {},
      created_at: new Date().toISOString()
    };
    inMemoryNotifications.unshift(memNotif);
    if (inMemoryNotifications.length > 200) inMemoryNotifications.splice(200);
  } catch (err) {
    console.warn("createAdminNotifications server error:", err);
  }
}

// Server-side authorization: every admin API call must carry a valid
// Supabase session token belonging to an active admin.
async function requireAdmin(req: any, res: any, next: any) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      if (!isSupabaseConfigured()) {
        req.adminUser = { email: "ayatulsekh3037@gmail.com", display_name: "Ayatul Sekh", id: "admin-dev", user_id: "admin-dev", is_active: true, role: "admin" };
        return next();
      }
      return res.status(401).json({ error: "Admin authentication required." });
    }
    const admin = getSupabaseAdmin();
    const { data, error: authError } = await admin.auth.getUser(token);
    const user = data?.user;
    if (authError || !user) {
      if (!isSupabaseConfigured()) {
        req.adminUser = { email: "ayatulsekh3037@gmail.com", display_name: "Ayatul Sekh", id: "admin-dev", user_id: "admin-dev", is_active: true, role: "admin" };
        return next();
      }
      return res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
    }
    const email = (user.email || "").trim().toLowerCase();

    let isAdmin = false;
    let adminDisplayName = "";
    let adminAvatarUrl: string | null = null;
    let adminRecordId = user.id;

    // 1. Check admin_users table (Primary source for admin name and status)
    try {
      const { data: adminRow } = await admin
        .from("admin_users")
        .select("id, email, display_name, avatar_url, is_active")
        .eq("email", email)
        .maybeSingle();

      if (adminRow && adminRow.is_active !== false) {
        isAdmin = true;
        adminRecordId = adminRow.id;
        if (adminRow.display_name && adminRow.display_name.trim()) {
          adminDisplayName = adminRow.display_name.trim();
        }
        if (adminRow.avatar_url) {
          adminAvatarUrl = adminRow.avatar_url;
        }
      }
    } catch {}

    // 2. Check profiles table
    try {
      const { data: profRow } = await admin
        .from("profiles")
        .select("id, display_name, avatar_url, role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (profRow) {
        if (profRow.role === "admin" && profRow.is_active !== false) {
          isAdmin = true;
        }
        if (!adminDisplayName && profRow.display_name && profRow.display_name.trim()) {
          adminDisplayName = profRow.display_name.trim();
        }
        if (!adminAvatarUrl && profRow.avatar_url) {
          adminAvatarUrl = profRow.avatar_url;
        }
      }
    } catch {}

    // 3. Fallback to ADMIN_EMAILS
    if (ADMIN_EMAILS.includes(email)) {
      isAdmin = true;
    }

    if (!isAdmin) {
      return res.status(403).json({ error: "This account does not have admin privileges.", email });
    }

    // Name priority: admin_users.display_name -> profiles.display_name -> metadata -> email prefix
    if (!adminDisplayName) {
      adminDisplayName = (user.user_metadata?.display_name && user.user_metadata.display_name.trim()) ||
        (user.user_metadata?.full_name && user.user_metadata.full_name.trim()) ||
        (user.user_metadata?.name && user.user_metadata.name.trim()) ||
        email.split("@")[0];
    }

    if (!adminAvatarUrl) {
      adminAvatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
    }

    req.adminUser = {
      id: adminRecordId,
      user_id: user.id,
      email,
      display_name: adminDisplayName,
      avatar_url: adminAvatarUrl,
      role: "admin",
      is_active: true
    };
    return next();
  } catch (err) {
    if (!isSupabaseConfigured()) {
      req.adminUser = { email: "ayatulsekh3037@gmail.com", display_name: "Ayatul Sekh", avatar_url: null, id: "admin-dev", user_id: "admin-dev", is_active: true, role: "admin" };
      return next();
    }
    return res.status(500).json({ error: "Authorization check failed." });
  }
}

// Session verification for the admin UI
app.all("/api/admin/verify", requireAdmin, (req, res) => {
  const user = req.adminUser;
  return res.json({
    admin: true,
    email: user.email,
    name: user.display_name,
    avatar_url: user.avatar_url || null,
    id: user.id
  });
});

// Admin self information endpoint
app.get("/api/admin/me", requireAdmin, (req, res) => {
  const user = req.adminUser;
  return res.json({
    success: true,
    admin: {
      id: user.id,
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url || null,
      is_active: user.is_active !== false,
      created_at: user.created_at || new Date().toISOString(),
      updated_at: user.updated_at || new Date().toISOString()
    }
  });
});

// Admin self profile update endpoint
app.patch("/api/admin/me", requireAdmin, async (req, res) => {
  const user = req.adminUser;
  const { display_name, avatar_url } = req.body || {};

  if (display_name === undefined && avatar_url === undefined) {
    return res.status(400).json({ error: "Nothing to update. Provide display_name or avatar_url." });
  }

  const updateData: any = { updated_at: new Date().toISOString() };

  if (display_name !== undefined) {
    if (typeof display_name !== "string" || !display_name.trim()) {
      return res.status(400).json({ error: "Admin display name cannot be empty." });
    }
    updateData.display_name = display_name.trim();
  }

  if (avatar_url !== undefined) {
    if (avatar_url === null || avatar_url === "") {
      updateData.avatar_url = null;
    } else if (typeof avatar_url !== "string" || !/^(https?:\/\/|data:image\/[a-zA-Z0-9.+_-]+;base64,)/i.test(avatar_url.trim())) {
      return res.status(400).json({ error: "Avatar must be a valid image URL or image data." });
    } else {
      updateData.avatar_url = avatar_url.trim();
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      let updatedRow: any = null;

      if (user.id) {
        const { data, error } = await admin
          .from("admin_users")
          .update(updateData)
          .eq("id", user.id)
          .select("id, user_id, email, display_name, avatar_url, is_active, created_at, updated_at")
          .maybeSingle();
        if (!error && data) updatedRow = data;
      }

      if (!updatedRow && user.user_id) {
        const { data, error } = await admin
          .from("admin_users")
          .update(updateData)
          .eq("user_id", user.user_id)
          .select("id, user_id, email, display_name, avatar_url, is_active, created_at, updated_at")
          .maybeSingle();
        if (!error && data) updatedRow = data;
      }

      if (!updatedRow && user.email) {
        const { data, error } = await admin
          .from("admin_users")
          .update(updateData)
          .eq("email", user.email.toLowerCase())
          .select("id, user_id, email, display_name, avatar_url, is_active, created_at, updated_at")
          .maybeSingle();
        if (!error && data) updatedRow = data;
      }

      if (!updatedRow) {
        return res.status(404).json({ error: "Admin profile record not found." });
      }

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

      return res.json({ success: true, admin: updatedRow });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to update profile." });
    }
  }

  const fallbackAdmin = {
    id: user.id,
    user_id: user.user_id,
    email: user.email,
    display_name: updateData.display_name !== undefined ? updateData.display_name : user.display_name,
    avatar_url: updateData.avatar_url !== undefined ? updateData.avatar_url : user.avatar_url,
    is_active: true
  };
  return res.json({ success: true, admin: fallbackAdmin });
});

// Admin users list endpoint
app.get("/api/admin/admin-users", requireAdmin, async (_req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("admin_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return res.json({ admins: data });
      }
    } catch {}
  }

  // Fallback admins list
  const fallbackAdmins = ADMIN_EMAILS.map((email, i) => ({
    id: `admin-${i + 1}`,
    email,
    display_name: email.split("@")[0],
    avatar_url: null,
    is_active: true,
    role: "admin",
    created_at: new Date().toISOString()
  }));
  return res.json({ admins: fallbackAdmins });
});

// Admin update endpoint
app.patch("/api/admin/admin-users/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { display_name, avatar_url, is_active } = req.body || {};

  if (display_name !== undefined && (!display_name || !String(display_name).trim())) {
    return res.status(400).json({ error: "Display name cannot be empty." });
  }

  const cleanName = display_name !== undefined ? String(display_name).trim() : undefined;
  let cleanAvatar = avatar_url;
  if (avatar_url !== undefined) {
    if (avatar_url === null || avatar_url === "") {
      cleanAvatar = null;
    } else if (typeof avatar_url !== "string" || !/^(https?:\/\/|data:image\/[a-zA-Z0-9.+_-]+;base64,)/i.test(avatar_url.trim())) {
      return res.status(400).json({ error: "Avatar must be a valid image URL or image data." });
    } else {
      cleanAvatar = avatar_url.trim();
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const updateData: any = { updated_at: new Date().toISOString() };
      if (cleanName !== undefined) updateData.display_name = cleanName;
      if (cleanAvatar !== undefined) updateData.avatar_url = cleanAvatar;
      if (is_active !== undefined) updateData.is_active = Boolean(is_active);

      const { data, error } = await admin
        .from("admin_users")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        // Try finding by email if ID wasn't uuid
        const { data: retryData, error: retryErr } = await admin
          .from("admin_users")
          .update(updateData)
          .eq("email", id.toLowerCase())
          .select()
          .single();

        if (retryErr) return res.status(500).json({ error: retryErr.message });
        if (retryData?.user_id) {
          try {
            const profUp: any = { updated_at: new Date().toISOString() };
            if (cleanName) profUp.display_name = cleanName;
            if (cleanAvatar !== undefined) profUp.avatar_url = cleanAvatar;
            if (is_active !== undefined) profUp.role = is_active ? "admin" : "user";
            await admin.from("profiles").update(profUp).eq("id", retryData.user_id);
          } catch {}
        }
        return res.json({ success: true, admin: retryData });
      }

      if (data?.user_id) {
        try {
          const profUp: any = { updated_at: new Date().toISOString() };
          if (cleanName) profUp.display_name = cleanName;
          if (cleanAvatar !== undefined) profUp.avatar_url = cleanAvatar;
          if (is_active !== undefined) profUp.role = is_active ? "admin" : "user";
          await admin.from("profiles").update(profUp).eq("id", data.user_id);
        } catch {}
      }

      return res.json({ success: true, admin: data });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to update admin user" });
    }
  }

  return res.json({
    success: true,
    admin: {
      id,
      display_name: cleanName || "Admin",
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString()
    }
  });
});

// Everything under /api/admin now requires a verified admin session.
app.use("/api/admin", requireAdmin);

app.get("/api/admin/stats", async (_req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();

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

      return res.json({
        counts: {
          colors: colorsRes.count ?? localColors.length,
          palettes: palettesRes.count ?? 0,
          users: profilesRes.count ?? 1,
          feedback: feedbackRes.count ?? inMemoryFeedback.length,
          contactMessages: contactRes.count ?? inMemoryContactMessages.length,
          gradients: gradientsRes.count ?? 2000
        },
        recentFeedback: recentFeedback || [],
        recentMessages: recentMessages || []
      });
    } catch {
      // Fall through to in-memory stats
    }
  }

  return res.json({
    counts: {
      colors: localColors.length,
      palettes: 2,
      users: 1,
      feedback: inMemoryFeedback.length,
      contactMessages: inMemoryContactMessages.length,
      gradients: 2000
    },
    recentFeedback: inMemoryFeedback.slice(0, 5),
    recentMessages: inMemoryContactMessages.slice(0, 5)
  });
});

app.get("/api/admin/feedback", async (_req, res) => {
  let list: any[] = [];
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
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

      if (!error && Array.isArray(data)) {
        list = data;
      }
    } catch {
      // Fall through
    }
  }

  // Merge in-memory feedback items so submitted items never vanish
  if (inMemoryFeedback.length > 0) {
    const existingIds = new Set(list.map((f: any) => String(f.id)));
    for (const mem of inMemoryFeedback) {
      if (!existingIds.has(String(mem.id))) {
        list.unshift(mem);
      }
    }
  }

  list = list.map((f: any) => {
    let sub = (f.subject || "").trim();
    if (!sub && f.admin_note) {
      const sMatch = f.admin_note.match(/Subject:\s*([^|\n]+)/i);
      if (sMatch && sMatch[1]) sub = sMatch[1].trim();
    }
    return { ...f, subject: sub || "General Feedback" };
  });

  return res.json({ success: true, feedback: list });
});

app.get("/api/admin/contact-messages", async (_req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
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

      if (!error && data) return res.json({ success: true, messages: data });
    } catch {
      // Fall through
    }
  }
  return res.json({ success: true, messages: inMemoryContactMessages });
});

app.get("/api/admin/users", async (_req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) return res.json({ users: data });
    } catch {
      // Fall through
    }
  }
  return res.json({
    users: [
      { id: "admin-1", display_name: "Ayatul Sekh (Admin)", email: "ayatulsekh3037@gmail.com", role: "admin", created_at: new Date().toISOString() }
    ]
  });
});

// ---------- Admin Notifications Endpoints ----------
app.get("/api/admin/notifications/unread-count", async (req: any, res) => {
  const currentAdmin = req.adminUser;
  let unreadCount = 0;
  let foundInDb = false;

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      let targetUserId = currentAdmin.user_id || currentAdmin.id;
      if (!isValidUUID(targetUserId) && currentAdmin.email) {
        const pid = await resolveProfileIdByEmail(admin, currentAdmin.email);
        if (pid) targetUserId = pid;
      }

      if (isValidUUID(targetUserId)) {
        const { count, error } = await admin
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .eq("is_read", false);

        if (!error && typeof count === "number") {
          unreadCount = count;
          foundInDb = true;
        }
      }
    } catch (e) {
      console.warn("unread-count supabase query error:", e);
    }
  }

  const unreadMem = inMemoryNotifications.filter(n => !n.is_read).length;
  if (!foundInDb && unreadMem > 0) {
    unreadCount = unreadMem;
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  return res.json({ success: true, unreadCount: Number(unreadCount || 0) });
});

app.patch("/api/admin/notifications/mark-all-read", async (req: any, res) => {
  const currentAdmin = req.adminUser;
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      let targetUserId = currentAdmin.user_id || currentAdmin.id;
      if (!isValidUUID(targetUserId) && currentAdmin.email) {
        const pid = await resolveProfileIdByEmail(admin, currentAdmin.email);
        if (pid) targetUserId = pid;
      }

      if (isValidUUID(targetUserId)) {
        const { data, error } = await admin
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", targetUserId)
          .eq("is_read", false)
          .select("id");

        if (!error) {
          inMemoryNotifications.forEach(n => { n.is_read = true; });
          return res.json({ success: true, updatedCount: data?.length || 0 });
        }
      }
    } catch {}
  }
  inMemoryNotifications.forEach(n => { n.is_read = true; });
  return res.json({ success: true, updatedCount: inMemoryNotifications.length });
});

app.get("/api/admin/notifications", async (req: any, res) => {
  const currentAdmin = req.adminUser;
  const limit = Math.min(parseInt(req.query.limit || "30") || 30, 100);
  const offset = parseInt(req.query.offset || "0") || 0;
  const unreadOnly = req.query.unreadOnly === "true";

  let list: any[] = [];
  let unreadCount = 0;
  let total = 0;

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      let targetUserId = currentAdmin.user_id || currentAdmin.id;
      if (!isValidUUID(targetUserId) && currentAdmin.email) {
        const pid = await resolveProfileIdByEmail(admin, currentAdmin.email);
        if (pid) targetUserId = pid;
      }

      if (isValidUUID(targetUserId)) {
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

        const [{ data, count, error }, { count: uCount }] = await Promise.all([
          query,
          admin
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", targetUserId)
            .eq("is_read", false)
        ]);

        if (!error && Array.isArray(data)) {
          list = data;
          total = count || data.length;
          unreadCount = uCount || 0;
        }
      }
    } catch {}
  }

  if (list.length === 0 && inMemoryNotifications.length > 0) {
    let filtered = inMemoryNotifications;
    if (unreadOnly) filtered = filtered.filter(n => !n.is_read);
    unreadCount = inMemoryNotifications.filter(n => !n.is_read).length;
    total = filtered.length;
    list = filtered.slice(offset, offset + limit);
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  return res.json({
    success: true,
    notifications: list,
    unreadCount: Number(unreadCount || 0),
    total: Number(total || 0)
  });
});

app.patch("/api/admin/notifications/:id/read", async (req: any, res) => {
  const notifId = req.params.id;
  const currentAdmin = req.adminUser;

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      let targetUserId = currentAdmin.user_id || currentAdmin.id;
      if (!isValidUUID(targetUserId) && currentAdmin.email) {
        const pid = await resolveProfileIdByEmail(admin, currentAdmin.email);
        if (pid) targetUserId = pid;
      }

      let updateQuery = admin.from("notifications").update({ is_read: true }).eq("id", notifId);
      if (isValidUUID(targetUserId)) {
        updateQuery = updateQuery.eq("user_id", targetUserId);
      }

      const { data, error } = await updateQuery.select().maybeSingle();
      if (!error && data) {
        const mem = inMemoryNotifications.find(n => n.id === notifId);
        if (mem) mem.is_read = true;
        return res.json({ success: true, notification: data });
      }
    } catch {}
  }

  const mem = inMemoryNotifications.find(n => n.id === notifId);
  if (mem) mem.is_read = true;
  return res.json({ success: true, notification: { id: notifId, is_read: true } });
});

app.delete("/api/admin/notifications/:id", async (req: any, res) => {
  const notifId = req.params.id;
  const currentAdmin = req.adminUser;

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      let targetUserId = currentAdmin.user_id || currentAdmin.id;
      if (!isValidUUID(targetUserId) && currentAdmin.email) {
        const pid = await resolveProfileIdByEmail(admin, currentAdmin.email);
        if (pid) targetUserId = pid;
      }

      let deleteQuery = admin.from("notifications").delete().eq("id", notifId);
      if (isValidUUID(targetUserId)) {
        deleteQuery = deleteQuery.eq("user_id", targetUserId);
      }
      await deleteQuery;
    } catch {}
  }

  inMemoryNotifications = inMemoryNotifications.filter(n => n.id !== notifId);
  return res.json({ success: true, deletedId: notifId });
});

app.delete("/api/admin/notifications", async (req: any, res) => {
  const currentAdmin = req.adminUser;
  const clearAll = req.query.clearAll === "true";

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      let targetUserId = currentAdmin.user_id || currentAdmin.id;
      if (!isValidUUID(targetUserId) && currentAdmin.email) {
        const pid = await resolveProfileIdByEmail(admin, currentAdmin.email);
        if (pid) targetUserId = pid;
      }

      if (isValidUUID(targetUserId)) {
        let deleteQuery = admin.from("notifications").delete().eq("user_id", targetUserId);
        if (!clearAll) {
          deleteQuery = deleteQuery.eq("is_read", true);
        }
        await deleteQuery;
      }
    } catch {}
  }

  if (clearAll) {
    inMemoryNotifications = [];
  } else {
    inMemoryNotifications = inMemoryNotifications.filter(n => !n.is_read);
  }
  return res.json({ success: true });
});

const handleAdminDeleteFeedback = async (req: any, res: any) => {
  const currentAdmin = req.adminUser;
  const rawId = req.params.id || req.query.id;
  const id = String(rawId || "").trim();

  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Feedback id is required."
    });
  }

  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      error: "Invalid feedback ID format (must be UUID)."
    });
  }

  if (!isSupabaseConfigured()) {
    const idx = inMemoryFeedback.findIndex(f => f.id === id);
    if (idx < 0) {
      return res.status(404).json({
        success: false,
        error: "Feedback not found."
      });
    }
    inMemoryFeedback.splice(idx, 1);
    inMemoryNotifications = inMemoryNotifications.filter(n => !(n.entity_type === "feedback" && n.entity_id === id));
    return res.json({
      success: true,
      message: "Feedback deleted successfully.",
      deletedId: id
    });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: existing, error: findError } = await admin
      .from("feedback")
      .select("id, image_url, admin_note")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      console.error("[ColorNest] Feedback lookup failed:", findError);
      return res.status(500).json({
        success: false,
        error: findError.message
      });
    }

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Feedback not found."
      });
    }

    const { error: deleteError } = await admin
      .from("feedback")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[ColorNest] Supabase feedback delete failed:", deleteError);
      return res.status(500).json({
        success: false,
        error: deleteError.message
      });
    }

    // Storage image cleanup
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
        console.warn("Feedback storage image delete warning:", imgErr);
      }
    }

    // Notification cleanup
    try {
      await admin
        .from("notifications")
        .delete()
        .eq("entity_type", "feedback")
        .eq("entity_id", id);
    } catch {}

    // Activity log
    try {
      const actorUserId = currentAdmin?.user_id || currentAdmin?.id;
      await admin.from("activity_logs").insert({
        user_id: isValidUUID(actorUserId) ? actorUserId : null,
        action: "delete_feedback",
        entity_type: "feedback",
        entity_id: id,
        metadata: {
          source: "admin_dashboard",
          deleted_by_email: currentAdmin?.email || "admin"
        }
      });
    } catch (logErr) {
      console.warn("Feedback delete activity log warning:", logErr);
    }

    inMemoryFeedback = inMemoryFeedback.filter(f => f.id !== id);
    inMemoryNotifications = inMemoryNotifications.filter(n => !(n.entity_type === "feedback" && n.entity_id === id));

    return res.json({
      success: true,
      message: "Feedback deleted successfully.",
      deletedId: id
    });
  } catch (err: any) {
    console.error("[ColorNest] Server error deleting feedback:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Server error deleting feedback"
    });
  }
};

app.delete("/api/admin/feedback/:id", requireAdmin, handleAdminDeleteFeedback);
app.delete("/api/admin/feedback", requireAdmin, handleAdminDeleteFeedback);

app.patch("/api/admin/feedback/:id/read", requireAdmin, async (req: any, res) => {
  const rawId = req.params.id;
  const id = String(rawId || "").trim();
  if (!id) {
    return res.status(400).json({ success: false, error: "Feedback id is required." });
  }

  const memFb = inMemoryFeedback.find(f => String(f.id) === id);
  if (memFb) {
    memFb.status = "read";
    inMemoryNotifications.forEach(n => {
      if (n.entity_type === "feedback" && String(n.entity_id) === id) {
        n.is_read = true;
      }
    });
  }

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("feedback")
        .update({ status: "read" })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (!error && data) {
        if (memFb) memFb.status = "read";
        try {
          await admin.from("notifications").update({ is_read: true }).eq("entity_id", id).eq("entity_type", "feedback");
        } catch {}
        return res.json({ success: true, feedback: data });
      }
    } catch {}
  }

  if (memFb) {
    return res.json({ success: true, feedback: memFb });
  }

  const fallbackItem = { id, status: "read" };
  inMemoryFeedback.push(fallbackItem);
  return res.json({ success: true, feedback: fallbackItem });
});

const handleAdminDeleteContactMessage = async (req: any, res: any) => {
  const currentAdmin = req.adminUser;
  const rawId = req.params.id || req.query.id;
  const id = String(rawId || "").trim();

  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Contact message id is required."
    });
  }

  if (!isValidUUID(id)) {
    return res.status(400).json({
      success: false,
      error: "Invalid contact message ID format (must be UUID)."
    });
  }

  if (!isSupabaseConfigured()) {
    const idx = inMemoryContactMessages.findIndex(m => m.id === id);
    if (idx < 0) {
      return res.status(404).json({
        success: false,
        error: "Contact message not found."
      });
    }
    inMemoryContactMessages.splice(idx, 1);
    inMemoryNotifications = inMemoryNotifications.filter(n => !(n.entity_type === "contact_message" && n.entity_id === id));
    return res.json({
      success: true,
      message: "Contact message deleted successfully.",
      deletedId: id
    });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: existing, error: findError } = await admin
      .from("contact_messages")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      console.error("[ColorNest] Contact message lookup failed:", findError);
      return res.status(500).json({
        success: false,
        error: findError.message
      });
    }

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Contact message not found."
      });
    }

    const { error: deleteError } = await admin
      .from("contact_messages")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[ColorNest] Supabase contact message delete failed:", deleteError);
      return res.status(500).json({
        success: false,
        error: deleteError.message
      });
    }

    // Notification cleanup
    try {
      await admin
        .from("notifications")
        .delete()
        .eq("entity_type", "contact_message")
        .eq("entity_id", id);
    } catch {}

    // Activity log
    try {
      const actorUserId = currentAdmin?.user_id || currentAdmin?.id;
      await admin.from("activity_logs").insert({
        user_id: isValidUUID(actorUserId) ? actorUserId : null,
        action: "delete_contact_message",
        entity_type: "contact_message",
        entity_id: id,
        metadata: {
          source: "admin_dashboard",
          deleted_by_email: currentAdmin?.email || "admin"
        }
      });
    } catch (logErr) {
      console.warn("Contact message delete activity log warning:", logErr);
    }

    inMemoryContactMessages = inMemoryContactMessages.filter(m => m.id !== id);
    inMemoryNotifications = inMemoryNotifications.filter(n => !(n.entity_type === "contact_message" && n.entity_id === id));

    return res.json({
      success: true,
      message: "Contact message deleted successfully.",
      deletedId: id
    });
  } catch (err: any) {
    console.error("[ColorNest] Server error deleting contact message:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Server error deleting contact message"
    });
  }
};

app.delete("/api/admin/contact-messages/:id", requireAdmin, handleAdminDeleteContactMessage);
app.delete("/api/admin/contact-messages", requireAdmin, handleAdminDeleteContactMessage);

app.delete("/api/admin/colors", async (req, res) => {
  const id = (req.query.id as string || "").trim();
  if (!id) return res.status(400).json({ error: "Color id is required." });
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      await admin.from("colors").delete().eq("id", id);
    } catch {}
  }
  return res.json({ success: true });
});

app.delete("/api/admin/gradients", async (req, res) => {
  const id = (req.query.id as string || "").trim();
  if (!id) return res.status(400).json({ error: "Gradient id is required." });
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      await admin.from("gradients").delete().eq("id", id);
    } catch {}
  }
  return res.json({ success: true });
});

app.delete("/api/admin/palettes", async (req, res) => {
  const id = (req.query.id as string || "").trim();
  if (!id) return res.status(400).json({ error: "Palette id is required." });
  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      await admin.from("palette_colors").delete().eq("palette_id", id);
      await admin.from("palettes").delete().eq("id", id);
    } catch {}
  }
  return res.json({ success: true });
});

app.post("/api/users/sync", async (req, res) => {
  try {
    const { uid, email, name } = (req.body || {}) as { uid?: string; email?: string; name?: string };
    if (!uid || !email) return res.status(400).json({ error: "uid and email are required." });

    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdmin();
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
          return res.json({ success: true, id: uid, profile: { ...existingProfile, ...updatePayload } });
        }

        const newPayload: any = {
          id: uid,
          "Gmail": email,
          display_name: name || email.split("@")[0],
          role: "user",
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

        return res.json({ success: true, id: uid, profile: inserted || newPayload });
      } catch {
        // Fall through
      }
    }

    return res.json({ success: true, id: uid });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to sync user" });
  }
});

// ---------- Saved colors & items (per Supabase user, stored in Supabase tables and profile row) ----------

function isValidUUID(str: any): boolean {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

async function getAuthUserId(req: any): Promise<string | null> {
  const header = req.headers.authorization || req.headers["x-access-token"] || req.headers["x-auth-token"] || "";
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7).trim() : (typeof header === "string" ? header.trim() : null);

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdmin();

    if (token) {
      try {
        const { data } = await admin.auth.getUser(token);
        if (data?.user?.id && isValidUUID(data.user.id)) return data.user.id;
      } catch {
        // Continue to other headers
      }
    }

    const xUserId = req.headers["x-user-id"] || req.query?.userId || req.body?.userId;
    if (xUserId && typeof xUserId === "string" && isValidUUID(xUserId.trim())) {
      return xUserId.trim();
    }

    const xEmail = req.headers["x-user-email"] || req.query?.email || req.body?.email;
    if (xEmail && typeof xEmail === "string" && xEmail.includes("@")) {
      try {
        const { data: usersData } = await admin.auth.admin.listUsers();
        const found = usersData?.users?.find((u: any) => u.email?.toLowerCase() === xEmail.trim().toLowerCase());
        if (found?.id && isValidUUID(found.id)) return found.id;
      } catch {}
    }
  }

  const fallbackId = req.headers["x-user-id"] || req.body?.userId || (token ? "guest-user" : "guest");
  return typeof fallbackId === "string" ? fallbackId : "guest";
}

async function ensureProfileRow(admin: any, userId: string, email?: string, suppliedName?: string) {
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
    const { data: created, error } = await admin
      .from("profiles")
      .insert({
        id: userId,
        "Gmail": email || null,
        display_name: initialName,
        role: "user",
        is_active: true,
        preferences: {}
      })
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

async function ensureColorInSupabase(admin: any, hex: string, name?: string): Promise<string | null> {
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

app.get("/api/saved-items", async (req, res) => {
  try {
    const userId = (await getAuthUserId(req)) || "guest";
    if (isSupabaseConfigured() && isValidUUID(userId)) {
      try {
        const admin = getSupabaseAdmin();
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

        return res.json({ success: true, items });
      } catch (e) {
        console.warn("Supabase saved-items GET error:", e);
      }
    }
    const items = inMemorySavedItems.get(userId) || [];
    return res.json({ success: true, items });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to load saved items" });
  }
});

app.post("/api/saved-items", async (req, res) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId || !isValidUUID(userId)) {
      return res.status(401).json({ error: "Login required to save" });
    }
    const { id, name, type, value, hex, c1, c2, css, stops, gradType, colors } = (req.body || {}) as any;
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
      colors: colors || undefined,
      ts: Date.now()
    };

    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdmin();
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

        return res.json({ success: true, id: itemId, item: itemEntry });
      } catch (e) {
        console.warn("Supabase saved-items POST error:", e);
      }
    }

    return res.json({ success: true, id: itemId, item: itemEntry });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to save item" });
  }
});

app.post("/api/saved-items/sync", async (req, res) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId || !isValidUUID(userId)) {
      return res.status(401).json({ error: "Login required to save" });
    }
    const clientItems: any[] = Array.isArray(req.body?.items) ? req.body.items : [];

    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdmin();
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

        return res.json({ success: true, items: merged });
      } catch (e) {
        console.warn("Supabase batch sync error:", e);
      }
    }

    return res.json({ success: true, items: clientItems });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to sync saved items" });
  }
});

app.delete("/api/saved-items", async (req, res) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId || !isValidUUID(userId)) {
      return res.status(401).json({ error: "Login required to save" });
    }
    const id = (req.query.id as string || req.body?.id || "").trim();
    const value = (req.query.value as string || req.body?.value || req.query.hex as string || "").trim();
    if (!id && !value) return res.status(400).json({ error: "Item id or value is required." });

    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdmin();
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

        return res.json({ success: true });
      } catch (e) {
        console.warn("Supabase saved-items DELETE error:", e);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to remove item" });
  }
});

app.delete("/api/admin/feedback", async (req, res) => {
  try {
    const id = (req.query.id as string || "").trim();
    if (!id) return res.status(400).json({ error: "Feedback id is required." });

    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdmin();
        const { error } = await admin.from("feedback").delete().eq("id", id);
        if (!error) return res.json({ success: true });
      } catch {
        // Fall through
      }
    }

    const idx = inMemoryFeedback.findIndex(f => f.id === id);
    if (idx >= 0) inMemoryFeedback.splice(idx, 1);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to delete feedback" });
  }
});

app.delete("/api/admin/contact-messages", async (req, res) => {
  try {
    const id = (req.query.id as string || "").trim();
    if (!id) return res.status(400).json({ error: "Message id is required." });

    if (isSupabaseConfigured()) {
      try {
        const admin = getSupabaseAdmin();
        const { error } = await admin.from("contact_messages").delete().eq("id", id);
        if (!error) return res.json({ success: true });
      } catch {
        // Fall through
      }
    }

    const idx = inMemoryContactMessages.findIndex(m => m.id === id);
    if (idx >= 0) inMemoryContactMessages.splice(idx, 1);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to delete contact message" });
  }
});

app.delete("/api/admin/colors", async (req, res) => {
  try {
    const id = (req.query.id as string || "").trim();
    if (!id) return res.status(400).json({ error: "Color id is required." });
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("colors").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to delete color" });
  }
});

app.delete("/api/admin/gradients", async (req, res) => {
  try {
    const id = (req.query.id as string || "").trim();
    if (!id) return res.status(400).json({ error: "Gradient id is required." });
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("gradients").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to delete gradient" });
  }
});

app.delete("/api/admin/palettes", async (req, res) => {
  try {
    const id = (req.query.id as string || "").trim();
    if (!id) return res.status(400).json({ error: "Palette id is required." });
    const admin = getSupabaseAdmin();
    await admin.from("palette_colors").delete().eq("palette_id", id);
    const { error } = await admin.from("palettes").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to delete palette" });
  }
});

// Seed endpoint to populate Supabase colors table if needed
app.post("/api/admin/seed-colors", async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const colorsDataPath = path.join(process.cwd(), "colors-data.js");
    if (!fs.existsSync(colorsDataPath)) {
      return res.status(404).json({ error: "colors-data.js not found" });
    }

    const content = fs.readFileSync(colorsDataPath, "utf-8");
    const jsonMatch = content.match(/window\.COLOR_DATA\s*=\s*(\[[\s\S]*?\]);/);
    if (!jsonMatch) {
      return res.status(400).json({ error: "Failed to parse COLOR_DATA" });
    }

    const colors: Array<{ name: string; hex: string }> = JSON.parse(jsonMatch[1]);
    const limit = Math.min(parseInt(req.body.limit as string) || 100, colors.length);
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

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      success: true,
      seeded: data?.length || 0,
      totalInDataset: colors.length
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to seed colors" });
  }
});

// ----------------------------------------------------
// Static Routing & HTML Clean URLs
// ----------------------------------------------------

const distDir = path.join(process.cwd(), "dist");
const publicDir = path.join(process.cwd(), "public");

const cleanRoutes: Record<string, string> = {
  "/home": "index.html",
  "/privacy-policy": "privacy-policy/index.html",
  "/terms-of-service": "terms-of-service/index.html",
  "/contact": "contact/index.html",
  "/about": "about/index.html",
  "/team": "team/index.html",
  "/admin": "admin/index.html",
  "/admin/dashboard": "admin/dashboard/index.html",
  "/login": "login/index.html",
  "/signup": "signup/index.html",
  "/feedback": "feedback/index.html",
  "/color-mix": "color-mix/index.html",
  "/color-preview": "color-preview/index.html",
  "/gradient-preview": "gradient-preview/index.html",
  "/gradients": "gradients/index.html",
  "/saved": "saved/index.html",
  "/colors": "colors/index.html",
  "/404": "404/index.html"
};

for (const [routePath, relativeFilePath] of Object.entries(cleanRoutes)) {
  app.get([routePath, `${routePath}/`], (_req, res) => {
    const inDist = path.join(distDir, relativeFilePath);
    if (fs.existsSync(inDist)) {
      return res.sendFile(inDist);
    }
    const inRoot = path.join(process.cwd(), relativeFilePath);
    if (fs.existsSync(inRoot)) {
      return res.sendFile(inRoot);
    }
    const fallback = path.join(distDir, "index.html");
    res.sendFile(fs.existsSync(fallback) ? fallback : path.join(process.cwd(), "index.html"));
  });
}

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.use("/public", express.static(publicDir));
}
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  const distPublic = path.join(distDir, "public");
  if (fs.existsSync(distPublic)) {
    app.use("/public", express.static(distPublic));
  }
}
app.use(
  express.static(path.join(process.cwd()), {
    redirect: false,
    setHeaders: (res, filePath) => {
      // HTML must always revalidate so cache-busted asset URLs are picked up
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

app.get("*", (req, res) => {
  // Never serve HTML for missing assets with file extensions (prevents "Unexpected token <" syntax errors)
  if (/\.(js|css|json|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|map)$/i.test(req.path)) {
    if (req.path.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript");
      return res.status(404).send("// Asset not found: " + req.path);
    }
    if (req.path.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css");
      return res.status(404).send("/* Asset not found: " + req.path + " */");
    }
    return res.status(404).end();
  }

  const indexInDist = path.join(distDir, "index.html");
  if (fs.existsSync(indexInDist)) {
    res.sendFile(indexInDist);
  } else {
    res.sendFile(path.join(process.cwd(), "index.html"));
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Color Library server running on http://0.0.0.0:${PORT}`);
});
