/**
 * Shared Supabase database helper for Vercel Serverless Functions.
 * Supports both classic JWT keys (anon public: eyJ...) and new Supabase Publishable/Secret keys (sb_publishable_... / sb_secret_...).
 */
function getSupabaseConfig() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/+$/, "");

  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    ""
  ).trim();

  return { url, key, isConfigured: Boolean(url && key) };
}

async function supabaseRequest(table, { method = "GET", query = "", body } = {}) {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    const error = new Error(
      "Supabase environment variables (SUPABASE_URL and SUPABASE_ANON_KEY) are not configured."
    );
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }

  const endpoint = `${url}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };

  // Classic JWT keys start with "eyJ" and use the Authorization Bearer header.
  // Newer sb_publishable_ / sb_secret_ keys authenticate via the apikey header.
  if (key.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${key}`;
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
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
      (data && (data.message || data.error || data.details)) ||
      `Supabase request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

module.exports = {
  getSupabaseConfig,
  supabaseRequest
};
