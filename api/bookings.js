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
      const rows = await supabaseRequest("bookings", {
        method: "GET",
        query: "select=*&order=created_at.desc&limit=50"
      });
      return res.status(200).json({ ok: true, bookings: rows || [] });
    }

    if (req.method === "POST") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const {
        id,
        vehicle,
        modelYear,
        name,
        phone,
        email,
        pickup,
        returnDate,
        days,
        dailyPrice,
        totalAmount,
        customerType,
        governmentIdType,
        documentLast4,
        country,
        address,
        kycStatus
      } = payload;

      if (!vehicle || !name || !phone || !email || !pickup || !returnDate) {
        return res.status(400).json({
          ok: false,
          error: "Missing required booking fields."
        });
      }

      const record = {
        booking_code: id || `DRV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        vehicle: String(vehicle).trim(),
        model_year: modelYear ? Number(modelYear) : null,
        customer_name: String(name).trim(),
        phone: String(phone).trim(),
        email: String(email).trim(),
        pickup_date: pickup,
        return_date: returnDate,
        days: Number(days) || 1,
        daily_price: Number(dailyPrice) || 0,
        total_amount: Number(totalAmount) || 0,
        customer_type: customerType || "indian",
        government_id_type: governmentIdType || null,
        document_last4: documentLast4 || null,
        country: country || null,
        address: address || null,
        kyc_status: kycStatus || "Pending Verification"
      };

      const inserted = await supabaseRequest("bookings", {
        method: "POST",
        body: record
      });

      return res.status(201).json({
        ok: true,
        booking: Array.isArray(inserted) ? inserted[0] : inserted
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
