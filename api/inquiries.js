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
    const { vehicleId, vehicle, name, email, phone, question } = payload;

    if (!vehicleId || !name || !email || !phone || !question) {
      return res.status(400).json({
        ok: false,
        error: "All inquiry fields are required."
      });
    }

    const record = {
      vehicle_id: String(vehicleId).trim(),
      vehicle_name: String(vehicle || vehicleId).trim(),
      customer_name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      question: String(question).trim()
    };

    const inserted = await supabaseRequest("vehicle_inquiries", {
      method: "POST",
      body: record
    });

    return res.status(201).json({
      ok: true,
      inquiry: Array.isArray(inserted) ? inserted[0] : inserted
    });
  } catch (error) {
    return res.status(error.code === "SUPABASE_NOT_CONFIGURED" ? 503 : 500).json({
      ok: false,
      error: error.message || "Database error"
    });
  }
};
