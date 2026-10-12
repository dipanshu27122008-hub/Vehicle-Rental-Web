const { supabaseRequest } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const vehicleId = req.query?.vehicleId;
      const filter = vehicleId
        ? `vehicle_id=eq.${encodeURIComponent(vehicleId)}&order=created_at.desc`
        : "select=*&order=created_at.desc&limit=100";

      const rows = await supabaseRequest("vehicle_reviews", {
        method: "GET",
        query: filter
      });

      return res.status(200).json({ ok: true, reviews: rows || [] });
    }

    if (req.method === "POST") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { vehicleId, name, rating, comment } = payload;

      if (!vehicleId || !name || !rating || !comment) {
        return res.status(400).json({
          ok: false,
          error: "vehicleId, name, rating, and comment are required."
        });
      }

      const record = {
        vehicle_id: String(vehicleId).trim(),
        reviewer_name: String(name).trim(),
        rating: Math.min(5, Math.max(1, Number(rating))),
        comment: String(comment).trim()
      };

      const inserted = await supabaseRequest("vehicle_reviews", {
        method: "POST",
        body: record
      });

      return res.status(201).json({
        ok: true,
        review: Array.isArray(inserted) ? inserted[0] : inserted
      });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    return res.status(error.code === "SUPABASE_NOT_CONFIGURED" ? 503 : 500).json({
      ok: false,
      error: error.message || "Database error"
    });
  }
};
