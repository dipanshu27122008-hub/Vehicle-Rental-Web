const { supabaseRequest, verifyCaller, recordAuditLog } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const vehicleId = req.query?.vehicleId;
      const query = vehicleId
        ? `vehicle_id=eq.${encodeURIComponent(vehicleId)}&order=created_at.desc`
        : "select=*&order=created_at.desc&limit=100";
      const rows = await supabaseRequest("vehicle_inquiries", { method: "GET", query });
      return res.status(200).json({ ok: true, inquiries: rows || [] });
    }

    if (req.method === "POST") {
      const caller = await verifyCaller(req);
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { vehicleId, vehicle, name, email, phone, question } = payload;

      if (!vehicleId || !name || !email || !phone || !question) {
        return res.status(400).json({
          ok: false,
          error: "All inquiry fields (name, email, 10-digit phone, and question) are required."
        });
      }

      const baseRecord = {
        vehicle_id: String(vehicleId).trim(),
        vehicle_name: String(vehicle || vehicleId).trim(),
        customer_name: String(name).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
        question: String(question).trim()
      };

      let inserted;
      try {
        inserted = await supabaseRequest("vehicle_inquiries", {
          method: "POST",
          body: {
            ...baseRecord,
            user_id: caller?.id || null,
            inquiry_status: "open"
          }
        });
      } catch {
        inserted = await supabaseRequest("vehicle_inquiries", {
          method: "POST",
          body: baseRecord
        });
      }

      return res.status(201).json({
        ok: true,
        inquiry: Array.isArray(inserted) ? inserted[0] : inserted
      });
    }

    if (req.method === "PATCH") {
      const caller = await verifyCaller(req);
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { id, providerResponse, inquiryStatus = "answered" } = payload;

      if (!id || !providerResponse || !String(providerResponse).trim()) {
        return res.status(400).json({
          ok: false,
          error: "Inquiry id and providerResponse are required."
        });
      }

      const updated = await supabaseRequest("vehicle_inquiries", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: {
          provider_response: String(providerResponse).trim(),
          inquiry_status: inquiryStatus,
          responded_by: caller?.id || null,
          responded_at: new Date().toISOString()
        }
      });

      await recordAuditLog({
        actorId: caller?.id || null,
        actorRole: caller?.role || "provider",
        action: "inquiry_responded",
        targetType: "vehicle_inquiry",
        targetId: String(id),
        details: { inquiryStatus }
      });

      return res.status(200).json({
        ok: true,
        inquiry: Array.isArray(updated) ? updated[0] : updated
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
