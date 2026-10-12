const { supabaseRequest } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const fullName = payload["full-name"] || payload.fullName || payload.name;
    const vehicleType = payload["vehicle-type"] || payload.vehicleType;
    const { email, phone, message } = payload;

    if (!fullName || !email || !phone || !vehicleType || !message) {
      return res.status(400).json({
        ok: false,
        error: "All contact form fields are required."
      });
    }

    const record = {
      full_name: String(fullName).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      vehicle_type: String(vehicleType).trim(),
      message: String(message).trim()
    };

    const inserted = await supabaseRequest("contact_messages", {
      method: "POST",
      body: record
    });

    return res.status(201).json({
      ok: true,
      contact: Array.isArray(inserted) ? inserted[0] : inserted
    });
  } catch (error) {
    return res.status(error.code === "SUPABASE_NOT_CONFIGURED" ? 503 : 500).json({
      ok: false,
      error: error.message || "Database error"
    });
  }
};
