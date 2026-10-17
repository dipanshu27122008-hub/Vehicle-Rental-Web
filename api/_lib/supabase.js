/**
 * Shared Supabase Backend Helper for Vercel Serverless Functions.
 * Supports:
 * - PostgREST Table queries (GET, POST, PATCH, DELETE)
 * - Real Supabase Auth (/auth/v1/signup, /auth/v1/token, /auth/v1/user, /auth/v1/recover, /auth/v1/logout)
 * - Backend Role Verification (fetches authoritative role from public.profiles)
 * - Supabase Storage Object Deletion (/storage/v1/object/...) for expiring media retention cleanup
 */
function getSupabaseConfig() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/+$/, "");

  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    ""
  ).trim();

  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  ).trim();

  const key = serviceKey || anonKey;
  return { url, key, anonKey: anonKey || key, serviceKey, isConfigured: Boolean(url && key) };
}

function buildAuthHeaders(apiKey, userBearerToken = null) {
  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };

  if (userBearerToken) {
    headers.Authorization = `Bearer ${userBearerToken}`;
  } else if (apiKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function supabaseRequest(table, { method = "GET", query = "", body, userToken = null } = {}) {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    const error = new Error(
      "Supabase environment variables (SUPABASE_URL and SUPABASE_ANON_KEY) are not configured."
    );
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }

  const endpoint = `${url}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const headers = buildAuthHeaders(key, userToken);

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      (data && (data.message || data.error || data.details || data.hint)) ||
      `Supabase request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

async function supabaseAuthRequest(path, { method = "POST", body, userToken = null } = {}) {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    const error = new Error(
      "Supabase environment variables (SUPABASE_URL and SUPABASE_ANON_KEY) are not configured."
    );
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }

  const endpoint = `${url}/auth/v1/${path.replace(/^\/+/, "")}`;
  const headers = {
    apikey: anonKey,
    "Content-Type": "application/json"
  };
  if (userToken) {
    headers.Authorization = `Bearer ${userToken}`;
  } else if (anonKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${anonKey}`;
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      (data && (data.msg || data.error_description || data.message || data.error)) ||
      `Supabase Auth request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

/**
 * Verifies the caller's Bearer JWT against Supabase Auth and looks up their authoritative role
 * from public.profiles. Never trusts role claims sent in request bodies.
 */
async function verifyCaller(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  try {
    const authUser = await supabaseAuthRequest("user", {
      method: "GET",
      userToken: token
    });
    if (!authUser || !authUser.id) return null;

    let profile = null;
    try {
      const rows = await supabaseRequest("profiles", {
        method: "GET",
        query: `id=eq.${encodeURIComponent(authUser.id)}&select=*`,
        userToken: token
      });
      profile = Array.isArray(rows) ? rows[0] : null;
    } catch {
      profile = null;
    }

    return {
      id: authUser.id,
      email: authUser.email,
      role: profile?.role || authUser.user_metadata?.role || "customer",
      fullName: profile?.full_name || authUser.user_metadata?.full_name || authUser.email,
      isVerified: Boolean(profile?.is_verified),
      token
    };
  } catch {
    return null;
  }
}

/**
 * Deletes an actual file from a Supabase Storage bucket before marking metadata deleted.
 */
async function supabaseStorageDelete(bucket, storagePath) {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    const error = new Error("Supabase is not configured.");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }

  const cleanBucket = encodeURIComponent(bucket);
  const cleanPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const endpoint = `${url}/storage/v1/object/${cleanBucket}/${cleanPath}`;
  const headers = buildAuthHeaders(key);

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`Storage delete failed (${response.status}): ${text}`);
  }

  return { deleted: true, bucket, storagePath };
}

async function recordAuditLog({ actorId = null, actorRole = "system", action, targetType, targetId, details = {} }) {
  try {
    await supabaseRequest("audit_logs", {
      method: "POST",
      body: {
        actor_id: actorId,
        actor_role: actorRole,
        action,
        target_type: targetType,
        target_id: String(targetId),
        details
      }
    });
  } catch {
    // Non-blocking if audit_logs table is not yet migrated
  }
}

module.exports = {
  getSupabaseConfig,
  supabaseRequest,
  supabaseAuthRequest,
  verifyCaller,
  supabaseStorageDelete,
  recordAuditLog
};
