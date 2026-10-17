const { supabaseRequest, verifyCaller, recordAuditLog } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const resource = req.query?.resource || "vehicles";

    // =========================================================================
    // FAVOURITES (GET, POST, DELETE /api/vehicles?resource=favourites)
    // =========================================================================
    if (resource === "favourites") {
      const caller = await verifyCaller(req);
      if (!caller) {
        return res.status(401).json({ ok: false, error: "Authentication required to sync favourites." });
      }

      if (req.method === "GET") {
        const rows = await supabaseRequest("favourites", {
          method: "GET",
          query: `user_id=eq.${encodeURIComponent(caller.id)}&select=vehicle_id,created_at`
        });
        return res.status(200).json({
          ok: true,
          favourites: (rows || []).map((r) => r.vehicle_id)
        });
      }

      if (req.method === "POST") {
        const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const ids = Array.isArray(payload.vehicleIds)
          ? payload.vehicleIds
          : payload.vehicleId
          ? [payload.vehicleId]
          : [];

        const existingRows = await supabaseRequest("favourites", {
          method: "GET",
          query: `user_id=eq.${encodeURIComponent(caller.id)}&select=vehicle_id`
        });
        const existingSet = new Set((existingRows || []).map((r) => r.vehicle_id));

        const toInsert = [...new Set(ids)]
          .filter((id) => id && !existingSet.has(id))
          .map((vehicleId) => ({ user_id: caller.id, vehicle_id: String(vehicleId) }));

        if (toInsert.length > 0) {
          await supabaseRequest("favourites", { method: "POST", body: toInsert });
        }

        const finalRows = await supabaseRequest("favourites", {
          method: "GET",
          query: `user_id=eq.${encodeURIComponent(caller.id)}&select=vehicle_id`
        });
        return res.status(200).json({
          ok: true,
          favourites: (finalRows || []).map((r) => r.vehicle_id)
        });
      }

      if (req.method === "DELETE") {
        const vehicleId = req.query?.vehicleId;
        if (!vehicleId) return res.status(400).json({ ok: false, error: "vehicleId is required." });
        await supabaseRequest("favourites", {
          method: "DELETE",
          query: `user_id=eq.${encodeURIComponent(caller.id)}&vehicle_id=eq.${encodeURIComponent(vehicleId)}`
        });
        return res.status(200).json({ ok: true, removed: vehicleId });
      }
    }

    // =========================================================================
    // VEHICLE MEDIA & 360 SEQUENCES (/api/vehicles?resource=media)
    // =========================================================================
    if (resource === "media") {
      if (req.method === "GET") {
        const vehicleId = req.query?.vehicleId;
        const query = vehicleId
          ? `vehicle_id=eq.${encodeURIComponent(vehicleId)}&cleanup_status=eq.active&order=frame_order.asc`
          : "cleanup_status=eq.active&order=frame_order.asc&limit=100";
        const rows = await supabaseRequest("vehicle_media", { method: "GET", query });
        return res.status(200).json({ ok: true, media: rows || [] });
      }

      if (req.method === "POST") {
        const caller = await verifyCaller(req);
        const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const {
          vehicleId,
          mediaType = "photo",
          storageBucket = "vehicle-media",
          storagePath,
          publicUrl,
          frameOrder = 0,
          fileSizeBytes = 0,
          mimeType = "image/jpeg",
          isPermanent = true,
          retentionHours = 24
        } = payload;

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(mimeType)) {
          return res.status(400).json({ ok: false, error: "Only JPEG, PNG, and WebP images are permitted." });
        }
        if (Number(fileSizeBytes) > 10 * 1024 * 1024) {
          return res.status(400).json({ ok: false, error: "File size exceeds 10 MB limit." });
        }
        if (!storagePath) {
          return res.status(400).json({ ok: false, error: "storagePath is required." });
        }

        const expiresAt = isPermanent
          ? null
          : new Date(Date.now() + Math.max(1, Number(retentionHours)) * 3600000).toISOString();

        const record = {
          vehicle_id: vehicleId || null,
          owner_id: caller?.id || null,
          media_type: mediaType,
          storage_bucket: isPermanent ? storageBucket : "temp-uploads",
          storage_path: storagePath,
          public_url: isPermanent ? publicUrl : null,
          frame_order: Number(frameOrder) || 0,
          file_size_bytes: Number(fileSizeBytes) || 0,
          mime_type: mimeType,
          is_permanent: Boolean(isPermanent),
          expires_at: expiresAt,
          cleanup_status: "active"
        };

        const inserted = await supabaseRequest("vehicle_media", { method: "POST", body: record });
        return res.status(201).json({ ok: true, media: Array.isArray(inserted) ? inserted[0] : inserted });
      }
    }

    // =========================================================================
    // VEHICLES LISTINGS & PROVIDER MANAGEMENT (/api/vehicles)
    // =========================================================================
    if (req.method === "GET") {
      const includeUnpublished = req.query?.includeUnpublished === "1";
      const query = includeUnpublished
        ? "select=*&order=created_at.desc"
        : "is_published=eq.true&moderation_status=eq.approved&select=*&order=created_at.asc";
      const rows = await supabaseRequest("vehicles", { method: "GET", query });
      return res.status(200).json({ ok: true, vehicles: rows || [] });
    }

    if (req.method === "POST") {
      const caller = await verifyCaller(req);
      if (!caller) {
        return res.status(401).json({
          ok: false,
          error: "Authentication required to add a vehicle listing."
        });
      }
      if (caller.role !== "provider" && caller.role !== "admin") {
        return res.status(403).json({
          ok: false,
          error: "Only registered Vehicle Providers or Administrators can add vehicle listings."
        });
      }

      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const {
        id,
        name,
        modelYear,
        category,
        transmission = "Automatic",
        fuel = "Petrol",
        seats = 5,
        dailyPrice,
        extraHourRate,
        lateFeePerHour,
        securityDeposit = 5000,
        city = "Jaipur",
        publicPickupHub = "Central Rental Hub",
        latitude = 26.9124,
        longitude = 75.7873,
        primaryImage = "./assets/vehicles/bmw x5.jpg",
        availabilityStatus = "available",
        rentalRules,
        cancellationPolicy
      } = payload;

      if (!name || !modelYear || !category || !dailyPrice || Number(dailyPrice) <= 0) {
        return res.status(400).json({
          ok: false,
          error: "Vehicle name, model year, category, and positive daily price are required."
        });
      }

      const slug =
        id ||
        `${String(name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 5)}`;

      const price = Number(dailyPrice);
      const record = {
        id: slug,
        provider_id: caller?.id || null,
        name: String(name).trim(),
        model_year: Number(modelYear),
        category: String(category).trim(),
        transmission: String(transmission).trim(),
        fuel: String(fuel).trim(),
        seats: Math.min(20, Math.max(1, Number(seats) || 5)),
        daily_price: price,
        extra_hour_rate: Number(extraHourRate) || Math.round(price / 8),
        late_fee_per_hour: Number(lateFeePerHour) || Math.round(price / 6),
        security_deposit: Number(securityDeposit) || 5000,
        city: String(city).trim(),
        public_pickup_hub: String(publicPickupHub).trim(),
        latitude: Number(latitude) || 26.9124,
        longitude: Number(longitude) || 75.7873,
        primary_image: String(primaryImage).trim(),
        availability_status: availabilityStatus,
        is_published: true,
        moderation_status: "approved",
        provider_verified: Boolean(caller?.isVerified),
        rental_rules:
          rentalRules ||
          "Valid driving licence and government ID required at pickup. No smoking or track racing.",
        cancellation_policy:
          cancellationPolicy ||
          "Free cancellation up to 24 hours before pickup. 15% of 1-day rental fee applies within 24 hours."
      };

      const inserted = await supabaseRequest("vehicles", { method: "POST", body: record });
      await recordAuditLog({
        actorId: caller?.id || null,
        actorRole: caller?.role || "provider",
        action: "vehicle_created",
        targetType: "vehicle",
        targetId: slug,
        details: { name: record.name, city: record.city, dailyPrice: record.daily_price }
      });

      return res.status(201).json({
        ok: true,
        vehicle: Array.isArray(inserted) ? inserted[0] : inserted
      });
    }

    if (req.method === "PATCH") {
      const caller = await verifyCaller(req);
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { id, ...updates } = payload;
      if (!id) return res.status(400).json({ ok: false, error: "Vehicle id is required." });

      // Ownership check: Provider can only edit their own vehicles unless Admin
      const existingRows = await supabaseRequest("vehicles", {
        method: "GET",
        query: `id=eq.${encodeURIComponent(id)}&select=*`
      });
      const existing = Array.isArray(existingRows) ? existingRows[0] : null;
      if (!existing) return res.status(404).json({ ok: false, error: "Vehicle not found." });

      if (
        existing.provider_id &&
        caller &&
        caller.role !== "admin" &&
        existing.provider_id !== caller.id
      ) {
        return res.status(403).json({
          ok: false,
          error: "Unauthorized: Providers cannot modify another provider's vehicle listing."
        });
      }

      const patchBody = {};
      if (updates.name !== undefined) patchBody.name = String(updates.name).trim();
      if (updates.modelYear !== undefined) patchBody.model_year = Number(updates.modelYear);
      if (updates.dailyPrice !== undefined) patchBody.daily_price = Number(updates.dailyPrice);
      if (updates.extraHourRate !== undefined) patchBody.extra_hour_rate = Number(updates.extraHourRate);
      if (updates.lateFeePerHour !== undefined) patchBody.late_fee_per_hour = Number(updates.lateFeePerHour);
      if (updates.securityDeposit !== undefined) patchBody.security_deposit = Number(updates.securityDeposit);
      if (updates.availabilityStatus !== undefined) patchBody.availability_status = updates.availabilityStatus;
      if (updates.isPublished !== undefined) patchBody.is_published = Boolean(updates.isPublished);
      if (updates.moderationStatus !== undefined && (!caller || caller.role === "admin")) {
        patchBody.moderation_status = updates.moderationStatus;
      }

      const updated = await supabaseRequest("vehicles", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: patchBody
      });

      return res.status(200).json({
        ok: true,
        vehicle: Array.isArray(updated) ? updated[0] : updated
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
