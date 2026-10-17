const { supabaseRequest, verifyCaller, recordAuditLog } = require("./_lib/supabase");
const { calculatePricing, calculateCancellationFee } = require("./_lib/pricing");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // GET /api/bookings (?vehicle=... or ?bookingCode=... or ?inspections=1)
    if (req.method === "GET") {
      const { vehicle, bookingCode, inspections } = req.query || {};

      if (inspections && bookingCode) {
        const rows = await supabaseRequest("pickup_return_inspections", {
          method: "GET",
          query: `booking_code=eq.${encodeURIComponent(bookingCode)}&order=recorded_at.asc`
        });
        return res.status(200).json({ ok: true, inspections: rows || [] });
      }

      let query = "select=*&order=created_at.desc&limit=100";
      if (bookingCode) {
        query = `booking_code=eq.${encodeURIComponent(bookingCode)}&select=*`;
      } else if (vehicle) {
        query = `vehicle=eq.${encodeURIComponent(vehicle)}&select=*&order=pickup_date.asc`;
      }

      const rows = await supabaseRequest("bookings", { method: "GET", query });
      return res.status(200).json({ ok: true, bookings: rows || [] });
    }

    // POST /api/bookings (Create booking with authoritative pricing & overlap check, or record inspection)
    if (req.method === "POST") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

      // Action: Record Pickup or Return Inspection Report
      if (payload.action === "record_inspection") {
        const caller = await verifyCaller(req);
        const {
          bookingCode,
          inspectionType,
          fuelOrBatteryPercent,
          odometerKm,
          conditionNotes,
          existingDamage,
          newDamageObserved,
          photoPaths,
          customerAcknowledged,
          disputeFlag
        } = payload;

        if (!bookingCode || !inspectionType || !conditionNotes) {
          return res.status(400).json({
            ok: false,
            error: "bookingCode, inspectionType (pickup/return), and conditionNotes are required."
          });
        }

        const inspectionRecord = {
          booking_code: String(bookingCode).trim(),
          inspection_type: inspectionType === "return" ? "return" : "pickup",
          recorded_by: caller?.id || null,
          fuel_or_battery_percent: Math.min(100, Math.max(0, Number(fuelOrBatteryPercent ?? 100))),
          odometer_km: Math.max(0, Number(odometerKm || 0)),
          condition_notes: String(conditionNotes).trim(),
          existing_damage: String(existingDamage || "None").trim(),
          new_damage_observed: String(newDamageObserved || "None").trim(),
          photo_paths: Array.isArray(photoPaths) ? photoPaths : [],
          customer_acknowledged: Boolean(customerAcknowledged),
          provider_acknowledged: true,
          dispute_flag: Boolean(disputeFlag),
          dispute_status: disputeFlag ? "open" : "none"
        };

        const inserted = await supabaseRequest("pickup_return_inspections", {
          method: "POST",
          body: inspectionRecord
        });

        await recordAuditLog({
          actorId: caller?.id || null,
          actorRole: caller?.role || "provider",
          action: `inspection_${inspectionRecord.inspection_type}`,
          targetType: "booking",
          targetId: bookingCode,
          details: { disputeFlag: inspectionRecord.dispute_flag }
        });

        return res.status(201).json({
          ok: true,
          inspection: Array.isArray(inserted) ? inserted[0] : inserted
        });
      }

      // Standard Booking Creation
      const caller = await verifyCaller(req);
      const {
        id,
        vehicle,
        vehicleId,
        modelYear,
        name,
        phone,
        email,
        pickup,
        returnDate,
        pickupTime = "10:00",
        returnTime = "10:00",
        dailyPrice,
        extraHourRate,
        lateFeePerHour,
        securityDeposit = 5000,
        customerType,
        governmentIdType,
        documentLast4,
        country,
        address,
        acceptedTermsVersion = "v1.0-customer"
      } = payload;

      if (!vehicle || !name || !phone || !email || !pickup || !returnDate) {
        return res.status(400).json({
          ok: false,
          error: "Missing required booking fields."
        });
      }

      if (returnDate <= pickup) {
        return res.status(400).json({
          ok: false,
          error: "Return date must be after pickup date."
        });
      }

      // 1. Check authoritative database for overlapping Confirmed or Active bookings
      const existingBookings = await supabaseRequest("bookings", {
        method: "GET",
        query: `vehicle=eq.${encodeURIComponent(vehicle)}&select=booking_code,pickup_date,return_date,booking_status`
      });

      const hasOverlap = (existingBookings || []).some((b) => {
        const status = b.booking_status || "Pending";
        if (status !== "Confirmed" && status !== "Active") return false;
        return pickup < b.return_date && returnDate > b.pickup_date;
      });

      if (hasOverlap) {
        return res.status(409).json({
          ok: false,
          error: `${vehicle} is already reserved for overlapping dates. Please choose different dates.`
        });
      }

      // 2. Authoritative backend pricing calculation
      const pricing = calculatePricing({
        dailyPrice: Number(dailyPrice) || 3500,
        extraHourRate: extraHourRate ? Number(extraHourRate) : null,
        lateFeePerHour: lateFeePerHour ? Number(lateFeePerHour) : null,
        securityDeposit: Number(securityDeposit) || 5000,
        pickupDate: pickup,
        returnDate,
        pickupTime,
        returnTime
      });

      if (!pricing.valid) {
        return res.status(400).json({
          ok: false,
          error: pricing.error || "Invalid booking dates."
        });
      }

      const bookingCode = id || `DRV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      // Build record compatible with both initial bookings table and full marketplace bookings table
      const record = {
        booking_code: bookingCode,
        vehicle: String(vehicle).trim(),
        model_year: modelYear ? Number(modelYear) : null,
        customer_name: String(name).trim(),
        phone: String(phone).trim(),
        email: String(email).trim(),
        pickup_date: pickup,
        return_date: returnDate,
        days: pricing.days,
        daily_price: pricing.dailyPrice,
        total_amount: pricing.rentalSubtotal,
        customer_type: customerType || "indian",
        government_id_type: governmentIdType || null,
        document_last4: documentLast4 || null,
        country: country || null,
        address: address || null,
        kyc_status: "Pending Verification"
      };

      // Attach extended marketplace columns if supported by schema
      const extendedRecord = {
        ...record,
        user_id: caller?.id || null,
        vehicle_id: vehicleId || null,
        pickup_time: pickupTime,
        return_time: returnTime,
        extra_hours: pricing.extraHours,
        extra_hour_rate: pricing.extraHourRate,
        late_fee_per_hour: pricing.lateFeePerHour,
        base_rental_amount: pricing.baseRentalAmount,
        extra_hour_amount: pricing.extraHourAmount,
        security_deposit: pricing.securityDeposit,
        pricing_snapshot: pricing,
        booking_status: "Pending",
        payment_status: "unpaid",
        accepted_terms_version: acceptedTermsVersion
      };

      let inserted;
      try {
        inserted = await supabaseRequest("bookings", {
          method: "POST",
          body: extendedRecord
        });
      } catch {
        // Fallback if user has only run the basic 4-table schema so far
        inserted = await supabaseRequest("bookings", {
          method: "POST",
          body: record
        });
      }

      // Record KYC verification & Terms Acceptance non-blockingly
      try {
        await supabaseRequest("identity_verifications", {
          method: "POST",
          body: {
            user_id: caller?.id || null,
            booking_code: bookingCode,
            customer_type: customerType || "indian",
            full_name: String(name).trim(),
            email: String(email).trim(),
            phone: String(phone).trim(),
            government_id_type: governmentIdType || (customerType === "nri" ? "Passport" : "Aadhaar"),
            document_last4: String(documentLast4 || "0000").slice(-4),
            residence_country: country || (customerType === "nri" ? "Overseas" : "India"),
            status: "pending"
          }
        });
        await supabaseRequest("terms_acceptances", {
          method: "POST",
          body: {
            user_id: caller?.id || null,
            user_email: String(email).trim(),
            role_type: "customer",
            terms_version: acceptedTermsVersion,
            booking_code: bookingCode
          }
        });
      } catch {
        // Ignore if extended tables aren't migrated yet
      }

      return res.status(201).json({
        ok: true,
        booking: Array.isArray(inserted) ? inserted[0] : inserted,
        pricing
      });
    }

    // PATCH /api/bookings (Update booking status: Confirm, Reject, Active/Pickup, Completed/Return, Cancel)
    if (req.method === "PATCH") {
      const caller = await verifyCaller(req);
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { bookingCode, newStatus, reason, actualReturnIso } = payload;

      const allowedStatuses = ["Pending", "Confirmed", "Active", "Completed", "Rejected", "Cancelled", "Expired"];
      if (!bookingCode || !allowedStatuses.includes(newStatus)) {
        return res.status(400).json({ ok: false, error: "Valid bookingCode and newStatus are required." });
      }

      // Fetch current booking
      const existingRows = await supabaseRequest("bookings", {
        method: "GET",
        query: `booking_code=eq.${encodeURIComponent(bookingCode)}&select=*`
      });
      const current = Array.isArray(existingRows) ? existingRows[0] : null;
      if (!current) {
        return res.status(404).json({ ok: false, error: "Booking not found." });
      }

      // Re-verify no overlapping Confirmed/Active bookings when confirming
      if (newStatus === "Confirmed" || newStatus === "Active") {
        const vehicleBookings = await supabaseRequest("bookings", {
          method: "GET",
          query: `vehicle=eq.${encodeURIComponent(current.vehicle)}&select=booking_code,pickup_date,return_date,booking_status`
        });
        const conflict = (vehicleBookings || []).find((b) => {
          if (b.booking_code === bookingCode) return false;
          if (b.booking_status !== "Confirmed" && b.booking_status !== "Active") return false;
          return current.pickup_date < b.return_date && current.return_date > b.pickup_date;
        });
        if (conflict) {
          return res.status(409).json({
            ok: false,
            error: `Cannot confirm: ${current.vehicle} has a conflicting ${conflict.booking_status} booking (${conflict.booking_code}) for ${conflict.pickup_date} to ${conflict.return_date}.`
          });
        }
      }

      const updateFields = {
        booking_status: newStatus,
        adjustment_reason: reason || null
      };

      // Apply cancellation rules if Cancelled
      if (newStatus === "Cancelled") {
        const cancelResult = calculateCancellationFee({
          dailyPrice: current.daily_price,
          pickupDate: current.pickup_date,
          pickupTime: current.pickup_time || "10:00"
        });
        updateFields.cancellation_fee = cancelResult.fee;
        updateFields.adjustment_reason = reason || cancelResult.policyApplied;
      }

      // Recalculate late fees if Completed with actualReturnIso
      if (newStatus === "Completed" && actualReturnIso) {
        const finalCalc = calculatePricing({
          dailyPrice: current.daily_price,
          extraHourRate: current.extra_hour_rate,
          lateFeePerHour: current.late_fee_per_hour,
          securityDeposit: current.security_deposit,
          pickupDate: current.pickup_date,
          returnDate: current.return_date,
          pickupTime: current.pickup_time || "10:00",
          returnTime: current.return_time || "10:00",
          actualReturnIso
        });
        updateFields.late_hours = finalCalc.billableLateHours;
        updateFields.late_fee_amount = finalCalc.lateFeeAmount;
        updateFields.total_amount = finalCalc.rentalSubtotal;
        updateFields.pricing_snapshot = finalCalc;
      }

      const updated = await supabaseRequest("bookings", {
        method: "PATCH",
        query: `booking_code=eq.${encodeURIComponent(bookingCode)}`,
        body: updateFields
      });

      try {
        await supabaseRequest("booking_status_history", {
          method: "POST",
          body: {
            booking_code: bookingCode,
            previous_status: current.booking_status || "Pending",
            new_status: newStatus,
            changed_by: caller?.id || null,
            reason: updateFields.adjustment_reason
          }
        });
      } catch {}

      return res.status(200).json({
        ok: true,
        booking: Array.isArray(updated) ? updated[0] : updated
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
