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
      const filter = vehicleId
        ? `vehicle_id=eq.${encodeURIComponent(vehicleId)}&order=created_at.desc`
        : "select=*&order=created_at.desc&limit=100";

      const rows = await supabaseRequest("vehicle_reviews", {
        method: "GET",
        query: filter
      });

      const visible = (rows || []).filter((r) => r.moderation_status !== "removed");
      return res.status(200).json({ ok: true, reviews: visible });
    }

    if (req.method === "POST") {
      const caller = await verifyCaller(req);
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { vehicleId, name, rating, comment, bookingCode } = payload;

      const numericRating = Number(rating);
      if (!vehicleId || !name || !comment || Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({
          ok: false,
          error: "vehicleId, name, valid rating (1-5), and comment are required."
        });
      }

      // Check if bookingCode corresponds to a real completed/confirmed booking
      let isVerifiedRental = false;
      if (bookingCode) {
        try {
          const bRows = await supabaseRequest("bookings", {
            method: "GET",
            query: `booking_code=eq.${encodeURIComponent(bookingCode)}&select=booking_code,booking_status`
          });
          if (Array.isArray(bRows) && bRows[0]) {
            isVerifiedRental = true;
          }
        } catch {}
      }

      const baseRecord = {
        vehicle_id: String(vehicleId).trim(),
        reviewer_name: String(name).trim(),
        rating: Math.round(numericRating),
        comment: String(comment).trim()
      };

      let inserted;
      try {
        inserted = await supabaseRequest("vehicle_reviews", {
          method: "POST",
          body: {
            ...baseRecord,
            user_id: caller?.id || null,
            booking_code: bookingCode || null,
            is_verified_rental: isVerifiedRental,
            moderation_status: "approved"
          }
        });
      } catch {
        inserted = await supabaseRequest("vehicle_reviews", {
          method: "POST",
          body: baseRecord
        });
      }

      return res.status(201).json({
        ok: true,
        review: Array.isArray(inserted) ? inserted[0] : inserted
      });
    }

    if (req.method === "PATCH") {
      const caller = await verifyCaller(req);
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { id, isReported, reportReason, moderationStatus } = payload;

      if (!id) return res.status(400).json({ ok: false, error: "Review id is required." });

      const patchBody = {};
      if (isReported !== undefined) patchBody.is_reported = Boolean(isReported);
      if (reportReason !== undefined) patchBody.report_reason = String(reportReason).trim();
      if (moderationStatus && (!caller || caller.role === "admin")) {
        patchBody.moderation_status = moderationStatus;
      }

      const updated = await supabaseRequest("vehicle_reviews", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: patchBody
      });

      await recordAuditLog({
        actorId: caller?.id || null,
        actorRole: caller?.role || "customer",
        action: moderationStatus ? `review_${moderationStatus}` : "review_reported",
        targetType: "vehicle_review",
        targetId: String(id),
        details: { reportReason, moderationStatus }
      });

      return res.status(200).json({
        ok: true,
        review: Array.isArray(updated) ? updated[0] : updated
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
