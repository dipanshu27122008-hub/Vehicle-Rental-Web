const {
  supabaseRequest,
  supabaseAuthRequest,
  verifyCaller,
  supabaseStorageDelete,
  recordAuditLog
} = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const action = req.query?.action || req.body?.action || "overview";

    // =========================================================================
    // 1. SUPABASE AUTHENTICATION (signup, login, recover, logout, me)
    // =========================================================================
    if (action === "auth") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { authOperation, email, password, fullName, phone, requestedRole = "customer", businessName, city } = payload;

      if (authOperation === "me") {
        const caller = await verifyCaller(req);
        if (!caller) return res.status(401).json({ ok: false, error: "Not authenticated." });
        return res.status(200).json({ ok: true, user: caller });
      }

      if (authOperation === "signup") {
        if (!email || !password || password.length < 6 || !fullName) {
          return res.status(400).json({
            ok: false,
            error: "Full name, valid email, and password (minimum 6 characters) are required."
          });
        }
        // Never allow self-registration as admin
        const safeRole = requestedRole === "provider" ? "provider" : "customer";
        const authResult = await supabaseAuthRequest("signup", {
          method: "POST",
          body: {
            email: String(email).trim(),
            password,
            data: {
              full_name: String(fullName).trim(),
              phone: String(phone || "").trim(),
              role: safeRole
            }
          }
        });

        const userId = authResult?.user?.id || authResult?.id;
        if (userId) {
          try {
            await supabaseRequest("profiles", {
              method: "POST",
              body: {
                id: userId,
                email: String(email).trim(),
                full_name: String(fullName).trim(),
                phone: String(phone || "").trim(),
                role: safeRole,
                is_verified: false
              }
            });
            if (safeRole === "provider" && businessName) {
              await supabaseRequest("provider_profiles", {
                method: "POST",
                body: {
                  user_id: userId,
                  business_name: String(businessName).trim(),
                  city: String(city || "Jaipur").trim(),
                  verification_status: "pending"
                }
              });
            }
          } catch {}
        }

        return res.status(201).json({
          ok: true,
          session: authResult.access_token ? authResult : null,
          user: {
            id: userId,
            email: String(email).trim(),
            fullName: String(fullName).trim(),
            role: safeRole,
            isVerified: false
          }
        });
      }

      if (authOperation === "login") {
        if (!email || !password) {
          return res.status(400).json({ ok: false, error: "Email and password are required." });
        }
        const session = await supabaseAuthRequest("token?grant_type=password", {
          method: "POST",
          body: { email: String(email).trim(), password }
        });

        let role = session?.user?.user_metadata?.role || "customer";
        let fullNameVal = session?.user?.user_metadata?.full_name || email;
        let isVerified = false;

        if (session?.user?.id) {
          try {
            const rows = await supabaseRequest("profiles", {
              method: "GET",
              query: `id=eq.${encodeURIComponent(session.user.id)}&select=*`
            });
            if (Array.isArray(rows) && rows[0]) {
              role = rows[0].role;
              fullNameVal = rows[0].full_name;
              isVerified = Boolean(rows[0].is_verified);
            }
          } catch {}
        }

        return res.status(200).json({
          ok: true,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          user: {
            id: session?.user?.id,
            email: session?.user?.email,
            fullName: fullNameVal,
            role,
            isVerified
          }
        });
      }

      if (authOperation === "recover") {
        if (!email) return res.status(400).json({ ok: false, error: "Email is required for password reset." });
        await supabaseAuthRequest("recover", {
          method: "POST",
          body: { email: String(email).trim() }
        });
        return res.status(200).json({
          ok: true,
          message: "If an account exists for this email, a password recovery link has been sent."
        });
      }

      if (authOperation === "logout") {
        const caller = await verifyCaller(req);
        if (caller?.token) {
          try {
            await supabaseAuthRequest("logout", { method: "POST", userToken: caller.token });
          } catch {}
        }
        return res.status(200).json({ ok: true });
      }
    }

    // =========================================================================
    // 2. TERMS VERSIONS & ACCEPTANCE (action=terms)
    // =========================================================================
    if (action === "terms") {
      if (req.method === "GET") {
        const rows = await supabaseRequest("terms_versions", {
          method: "GET",
          query: "is_active=eq.true&select=*&order=role_type.asc"
        });
        return res.status(200).json({ ok: true, terms: rows || [] });
      }

      if (req.method === "POST") {
        const caller = await verifyCaller(req);
        const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const { roleType = "customer", termsVersion = "v1.0-customer", userEmail, bookingCode } = payload;

        const inserted = await supabaseRequest("terms_acceptances", {
          method: "POST",
          body: {
            user_id: caller?.id || null,
            user_email: caller?.email || userEmail || null,
            role_type: roleType === "provider" ? "provider" : "customer",
            terms_version: termsVersion,
            booking_code: bookingCode || null
          }
        });
        return res.status(201).json({
          ok: true,
          acceptance: Array.isArray(inserted) ? inserted[0] : inserted
        });
      }
    }

    // =========================================================================
    // 3. KYC / IDENTITY VERIFICATION WORKFLOW (action=verification)
    // =========================================================================
    if (action === "verification") {
      if (req.method === "GET") {
        const rows = await supabaseRequest("identity_verifications", {
          method: "GET",
          query: "select=*&order=created_at.desc&limit=100"
        });
        return res.status(200).json({ ok: true, verifications: rows || [] });
      }

      if (req.method === "PATCH") {
        const caller = await verifyCaller(req);
        // Never allow a user to self-approve their own verification
        const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const { id, bookingCode, status, reviewerNotes } = payload;

        const allowed = ["pending", "approved", "rejected", "resubmission_required"];
        if (!allowed.includes(status)) {
          return res.status(400).json({ ok: false, error: "Invalid verification status." });
        }

        const filter = id
          ? `id=eq.${encodeURIComponent(id)}`
          : `booking_code=eq.${encodeURIComponent(bookingCode)}`;

        const existingRows = await supabaseRequest("identity_verifications", {
          method: "GET",
          query: `${filter}&select=*`
        });
        const record = Array.isArray(existingRows) ? existingRows[0] : null;
        if (record && caller && record.user_id && record.user_id === caller.id && caller.role !== "admin") {
          return res.status(403).json({
            ok: false,
            error: "Security violation: Users cannot self-approve their own identity verification."
          });
        }

        const updated = await supabaseRequest("identity_verifications", {
          method: "PATCH",
          query: filter,
          body: {
            status,
            reviewer_id: caller?.id || null,
            reviewer_notes: reviewerNotes || null,
            reviewed_at: new Date().toISOString()
          }
        });

        if (bookingCode) {
          const kycLabel =
            status === "approved"
              ? "Verified"
              : status === "rejected"
              ? "Rejected"
              : status === "resubmission_required"
              ? "Resubmission Required"
              : "Pending Verification";
          try {
            await supabaseRequest("bookings", {
              method: "PATCH",
              query: `booking_code=eq.${encodeURIComponent(bookingCode)}`,
              body: { kyc_status: kycLabel }
            });
          } catch {}
        }

        await recordAuditLog({
          actorId: caller?.id || null,
          actorRole: caller?.role || "admin",
          action: `kyc_${status}`,
          targetType: "identity_verification",
          targetId: id || bookingCode || "record",
          details: { reviewerNotes }
        });

        return res.status(200).json({
          ok: true,
          verification: Array.isArray(updated) ? updated[0] : updated
        });
      }
    }

    // =========================================================================
    // 4. EXPIRING MEDIA CLEANUP JOB (action=media_cleanup)
    // =========================================================================
    if (action === "media_cleanup" && req.method === "POST") {
      const caller = await verifyCaller(req);
      const nowIso = new Date().toISOString();

      const expiredRows = await supabaseRequest("vehicle_media", {
        method: "GET",
        query: `is_permanent=eq.false&cleanup_status=in.(active,cleanup_failed)&expires_at=lte.${encodeURIComponent(nowIso)}&select=*&limit=50`
      });

      const results = { scanned: (expiredRows || []).length, deleted: 0, failed: 0, errors: [] };

      for (const item of expiredRows || []) {
        try {
          // 1. Delete actual Storage object first (never touch permanent listing images)
          if (!item.is_permanent && item.storage_bucket && item.storage_path) {
            await supabaseStorageDelete(item.storage_bucket, item.storage_path);
          }
          // 2. Update metadata only after Storage deletion succeeds
          await supabaseRequest("vehicle_media", {
            method: "PATCH",
            query: `id=eq.${encodeURIComponent(item.id)}`,
            body: {
              cleanup_status: "deleted",
              deleted_from_storage_at: new Date().toISOString(),
              cleanup_attempts: (item.cleanup_attempts || 0) + 1
            }
          });
          results.deleted += 1;
        } catch (err) {
          results.failed += 1;
          results.errors.push({ id: item.id, error: err.message });
          try {
            await supabaseRequest("vehicle_media", {
              method: "PATCH",
              query: `id=eq.${encodeURIComponent(item.id)}`,
              body: {
                cleanup_status: "cleanup_failed",
                cleanup_attempts: (item.cleanup_attempts || 0) + 1,
                last_cleanup_error: err.message
              }
            });
          } catch {}
        }
      }

      await recordAuditLog({
        actorId: caller?.id || null,
        actorRole: caller?.role || "system",
        action: "expiring_media_cleanup",
        targetType: "vehicle_media",
        targetId: "batch",
        details: results
      });

      return res.status(200).json({ ok: true, cleanup: results });
    }

    // =========================================================================
    // 5. DASHBOARD AGGREGATION (Provider & Administrator Overview)
    // =========================================================================
    const [bookings, vehicles, reviews, inquiries, verifications, auditLogs, media] = await Promise.all([
      supabaseRequest("bookings", { method: "GET", query: "select=*&order=created_at.desc&limit=100" }).catch(() => []),
      supabaseRequest("vehicles", { method: "GET", query: "select=*&order=created_at.desc" }).catch(() => []),
      supabaseRequest("vehicle_reviews", { method: "GET", query: "select=*&order=created_at.desc&limit=100" }).catch(() => []),
      supabaseRequest("vehicle_inquiries", { method: "GET", query: "select=*&order=created_at.desc&limit=100" }).catch(() => []),
      supabaseRequest("identity_verifications", { method: "GET", query: "select=*&order=created_at.desc&limit=100" }).catch(() => []),
      supabaseRequest("audit_logs", { method: "GET", query: "select=*&order=created_at.desc&limit=50" }).catch(() => []),
      supabaseRequest("vehicle_media", { method: "GET", query: "is_permanent=eq.false&select=*&limit=50" }).catch(() => [])
    ]);

    return res.status(200).json({
      ok: true,
      bookings: bookings || [],
      vehicles: vehicles || [],
      reviews: reviews || [],
      inquiries: inquiries || [],
      verifications: verifications || [],
      auditLogs: auditLogs || [],
      expiringMedia: media || []
    });
  } catch (error) {
    return res.status(error.code === "SUPABASE_NOT_CONFIGURED" ? 503 : 500).json({
      ok: false,
      error: error.message || "Database error"
    });
  }
};
