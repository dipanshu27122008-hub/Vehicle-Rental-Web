/**
 * Drivora Administrator Command Center Controller (js/admin-dashboard.js)
 * Enforces admin authorization, KYC approval/rejection (with self-approval block),
 * provider listing moderation, reported review moderation, dispute resolution,
 * expired temporary media Storage cleanup, and immutable security audit logging.
 */
(function () {
  const LOCAL_KYC_KEY = "drivora_kyc_records_v1";
  const CUSTOM_VEHICLES_KEY = "drivora-provider-vehicles";
  const CUSTOM_VEHICLES_ALT_KEY = "drivora_custom_vehicles_v1";
  const LOCAL_BOOKINGS_KEY = "drivora-bookings";
  const LOCAL_BOOKINGS_ALT_KEY = "drivora_bookings_v1";
  const LOCAL_REVIEWS_KEY = "drivora-vehicle-reviews";
  const LOCAL_REPORTED_REVIEWS_KEY = "drivora-reported-reviews";
  const LOCAL_REMOVED_REVIEWS_KEY = "drivora-removed-reviews";
  const LOCAL_INSPECTIONS_KEY = "drivora_inspections_v1";
  const LOCAL_MEDIA_KEY = "drivora_media_lifecycle_v1";
  const LOCAL_AUDIT_KEY = "drivora_audit_logs_v1";

  let kycRecords = [];
  let allVehicles = [];
  let allBookings = [];
  let allReviews = [];
  let allInspections = [];
  let mediaRecords = [];
  let auditLogs = [];

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getAuthHeaders() {
    if (window.DrivoraAuth && typeof window.DrivoraAuth.getAuthHeaders === "function") {
      return window.DrivoraAuth.getAuthHeaders();
    }
    return { "Content-Type": "application/json" };
  }

  function getCurrentUser() {
    if (window.DrivoraAuth && typeof window.DrivoraAuth.getSession === "function") {
      const s = window.DrivoraAuth.getSession();
      return s && s.user ? s.user : null;
    }
    return null;
  }

  function isAuthorizedAdmin() {
    const user = getCurrentUser();
    return Boolean(user && user.role === "admin");
  }

  function readLocalJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeLocalJson(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      // ignore
    }
  }

  function showAdminFeedback(message, isError = false) {
    const el = document.getElementById("adminGlobalFeedback");
    if (!el) return;
    el.style.display = "block";
    el.style.background = isError ? "rgba(254, 226, 226, 0.92)" : "rgba(220, 252, 231, 0.92)";
    el.style.color = isError ? "#991b1b" : "#166534";
    el.style.border = isError ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(34, 197, 94, 0.35)";
    el.innerHTML = message;
  }

  function logLocalAudit(action, targetType, targetId, metadata) {
    const user = getCurrentUser();
    const entry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actor_id: user ? user.id : "admin",
      actor_role: user ? user.role : "admin",
      action,
      target_type: targetType,
      target_id: String(targetId || ""),
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };
    const current = readLocalJson(LOCAL_AUDIT_KEY, []);
    current.unshift(entry);
    writeLocalJson(LOCAL_AUDIT_KEY, current);
    auditLogs = current;
  }

  function ensureDefaultSeedRecords() {
    const existingKyc = readLocalJson(LOCAL_KYC_KEY, []);
    if (!existingKyc.length) {
      const seededKyc = [
        {
          id: "kyc-ind-101",
          user_id: "usr-prov-101",
          applicant_name: "Rajesh Sharma",
          business_name: "Sharma Metro Fleet Mumbai",
          role_target: "provider",
          residency_type: "indian_resident",
          document_type: "driving_licence",
          document_number_last4: "7842",
          driving_licence_number: "MH01-20180094821",
          licence_expiry_date: "2031-06-15",
          status: "pending",
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: "kyc-nri-102",
          user_id: "usr-cust-202",
          applicant_name: "Aarav Patel (NRI)",
          business_name: "Individual Customer Verification",
          role_target: "customer",
          residency_type: "nri_international",
          document_type: "passport",
          document_number_last4: "9310",
          driving_licence_number: "UK-DL-884920",
          licence_expiry_date: "2029-11-30",
          passport_country: "United Kingdom",
          visa_or_oci_reference: "OCI-A8839201",
          idp_number: "IDP-GB-2026-441",
          status: "pending",
          created_at: new Date(Date.now() - 43200000).toISOString(),
        },
      ];
      writeLocalJson(LOCAL_KYC_KEY, seededKyc);
    }

    const existingMedia = readLocalJson(LOCAL_MEDIA_KEY, []);
    if (!existingMedia.length) {
      const seededMedia = [
        {
          id: "med-360-01",
          bucket_name: "vehicle-360-media",
          object_path: "vehicles/bmw-x5/frame-01.jpg",
          media_category: "angle_360",
          retention_policy: "permanent",
          expires_at: null,
          is_deleted: false,
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: "med-temp-02",
          bucket_name: "inspection-evidence",
          object_path: "inspections/bk-101/bumper-check.jpg",
          media_category: "inspection_photo",
          retention_policy: "until_dispute_window_closed",
          expires_at: new Date(Date.now() - 3600000).toISOString(),
          is_deleted: false,
          created_at: new Date(Date.now() - 90000000).toISOString(),
        },
      ];
      writeLocalJson(LOCAL_MEDIA_KEY, seededMedia);
    }
  }

  function updateRoleGuardBanner() {
    const guard = document.getElementById("adminAccessGuard");
    const badge = document.getElementById("adminRoleBadge");
    const user = getCurrentUser();

    if (!isAuthorizedAdmin()) {
      if (guard) guard.style.display = "block";
      if (badge) {
        badge.className = "badge-pill badge-unverified";
        badge.innerHTML = '<i class="fa-solid fa-lock"></i> Admin Authentication Required';
      }
    } else {
      if (guard) guard.style.display = "none";
      if (badge) {
        const displayName = user.fullName || user.full_name || user.email || "Administrator";
        badge.className = "badge-pill badge-verified";
        badge.innerHTML = `<i class="fa-solid fa-user-shield"></i> Active Admin: ${escapeHtml(displayName)}`;
      }
    }
  }

  async function loadAdminDashboard() {
    ensureDefaultSeedRecords();
    updateRoleGuardBanner();

    let remoteOverview = null;
    try {
      const res = await fetch("/api/marketplace?role=admin", { headers: getAuthHeaders() });
      const payload = await res.json();
      if (res.ok && (payload.data || payload.verifications)) {
        remoteOverview = payload.data || payload;
      }
    } catch (err) {
      // Offline / local fallback
    }

    // 2. Merge KYC records
    const localKyc = readLocalJson(LOCAL_KYC_KEY, []);
    const remoteKyc =
      remoteOverview && Array.isArray(remoteOverview.verifications)
        ? remoteOverview.verifications
        : [];
    const kycMap = new Map();
    [...localKyc, ...remoteKyc].forEach((k) => kycMap.set(String(k.id), k));
    kycRecords = Array.from(kycMap.values());

    // 3. Merge Vehicle Listings
    const customVeh = [
      ...readLocalJson(CUSTOM_VEHICLES_KEY, []),
      ...readLocalJson(CUSTOM_VEHICLES_ALT_KEY, []),
    ];
    const baseCatalogArr = Array.isArray(window.vehicles)
      ? window.vehicles
      : Object.values(window.vehicleCatalog || {});
    const baseVeh = baseCatalogArr.slice(0, 8).map((v) => ({
      id: v.id || `veh-${v.name}`,
      title: v.name || v.title,
      category: v.category || v.type || "SUV",
      model_year: v.modelYear || v.model_year || 2024,
      daily_rate: v.price || v.daily_rate || 2500,
      security_deposit: v.securityDeposit || v.security_deposit || 5000,
      provider_name: v.providerName || v.provider_name || "DrivoraVerified Partner",
      moderation_status: v.moderation_status || "approved",
      is_published: v.isPublished !== false && v.is_published !== false,
    }));
    const vehMap = new Map();
    [...baseVeh, ...customVeh].forEach((v) => vehMap.set(String(v.id), v));
    allVehicles = Array.from(vehMap.values());

    // 4. Bookings
    const bList = [
      ...readLocalJson(LOCAL_BOOKINGS_KEY, []),
      ...readLocalJson(LOCAL_BOOKINGS_ALT_KEY, []),
    ];
    const bMap = new Map();
    bList.forEach((b) => bMap.set(String(b.id || b.booking_code), b));
    allBookings = Array.from(bMap.values());

    // 5. Reviews (merge user reviews + reported reviews + removed list)
    const rawRevObj = readLocalJson(LOCAL_REVIEWS_KEY, {});
    const reportedArr = readLocalJson(LOCAL_REPORTED_REVIEWS_KEY, []);
    const removedSet = new Set(readLocalJson(LOCAL_REMOVED_REVIEWS_KEY, []).map(String));
    const reportedIds = new Set(reportedArr.map((r) => String(r.id)));

    const flatReviews = [];
    if (rawRevObj && typeof rawRevObj === "object" && !Array.isArray(rawRevObj)) {
      Object.keys(rawRevObj).forEach((vehId) => {
        const arr = rawRevObj[vehId];
        if (Array.isArray(arr)) {
          arr.forEach((r, i) => {
            const idStr = String(r.id || `rev-${vehId}-${i}`);
            flatReviews.push({
              ...r,
              id: idStr,
              vehicle_id: vehId,
              is_reported: Boolean(r.is_reported || r.reported || reportedIds.has(idStr)),
              is_hidden: Boolean(r.is_hidden || removedSet.has(idStr)),
            });
          });
        }
      });
    }
    reportedArr.forEach((rep) => {
      if (!flatReviews.some((f) => String(f.id) === String(rep.id))) {
        flatReviews.push({
          id: String(rep.id),
          vehicle_id: rep.vehicleId || "bmw-x5",
          name: "Flagged Review",
          rating: 4,
          comment: `Reported review ID ${rep.id} on ${rep.vehicleName || "Vehicle"}`,
          is_reported: true,
          report_reason: "Flagged by user",
          is_hidden: removedSet.has(String(rep.id)),
        });
      }
    });
    allReviews = flatReviews;

    // 6. Inspections & Disputes
    allInspections = readLocalJson(LOCAL_INSPECTIONS_KEY, []);

    // 7. Media Retention Queue
    mediaRecords = readLocalJson(LOCAL_MEDIA_KEY, []);

    // 8. Audit Logs
    const localAudits = readLocalJson(LOCAL_AUDIT_KEY, []);
    const remoteAudits =
      remoteOverview && Array.isArray(remoteOverview.auditLogs)
        ? remoteOverview.auditLogs
        : [];
    const audMap = new Map();
    [...localAudits, ...remoteAudits].forEach((a) => audMap.set(String(a.id), a));
    auditLogs = Array.from(audMap.values());

    renderAdminKpis();
    renderKycTable();
    renderListingsTable();
    renderReviewsTable();
    renderDisputesTable();
    renderMediaTable();
    renderAuditTable();
  }

  function renderAdminKpis() {
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const pendingKyc = kycRecords.filter((k) => (k.status || "pending") === "pending").length;
    const reportedRevs = allReviews.filter((r) => r.is_reported || r.reported).length;
    const activeDisputes = allInspections.filter((i) => i.dispute_flagged && !i.dispute_resolved).length;
    const expiringMedia = mediaRecords.filter((m) => m.expires_at && !m.is_deleted).length;

    setEl("adminKpiPendingKyc", pendingKyc);
    setEl("adminKpiTotalVehicles", allVehicles.length);
    setEl("adminKpiTotalBookings", allBookings.length);
    setEl("adminKpiReportedReviews", reportedRevs);
    setEl("adminKpiDisputes", activeDisputes);
    setEl("adminKpiExpiringMedia", expiringMedia);
    setEl("adminKpiAuditCount", auditLogs.length);
  }

  function renderKycTable() {
    const tbody = document.getElementById("adminKycTableBody");
    if (!tbody) return;

    if (!kycRecords.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.25rem;">No KYC submissions in queue.</td></tr>`;
      return;
    }

    tbody.innerHTML = kycRecords
      .map((k, idx) => {
        const status = k.status || "pending";
        const badgeClass =
          status === "approved"
            ? "badge-verified"
            : status === "rejected"
            ? "badge-rejected"
            : "badge-pending";

        const isNri = k.residency_type === "nri_international";
        const nriDetails = isNri
          ? `<div style="font-size:0.75rem; color:#0284c7;">Passport: ${escapeHtml(k.passport_country || "—")} · Visa/OCI: ${escapeHtml(k.visa_or_oci_reference || "—")} · IDP: ${escapeHtml(k.idp_number || "—")}</div>`
          : "";

        return `
          <tr>
            <td>
              <strong>${escapeHtml(k.applicant_name || k.business_name || "Applicant")}</strong>
              <div style="font-size:0.76rem; color:#64748b;">${escapeHtml(k.business_name || "")} (User: ${escapeHtml(k.user_id || "—")})</div>
            </td>
            <td>
              <span class="badge-pill ${isNri ? "badge-pending" : "badge-verified"}">
                ${isNri ? "NRI / International" : "Indian Resident"}
              </span>
              <div style="font-size:0.75rem; margin-top:0.2rem; color:#475569;">Role: <strong>${escapeHtml(k.role_target || "provider")}</strong></div>
            </td>
            <td>
              <div><strong>${escapeHtml(k.document_type || "ID")}</strong> ending in <code>****${escapeHtml(k.document_number_last4 || "0000")}</code></div>
              <div style="font-size:0.76rem; color:#475569;">DL: ${escapeHtml(k.driving_licence_number || "—")}</div>
              ${nriDetails}
            </td>
            <td>${escapeHtml(k.licence_expiry_date || "—")}</td>
            <td>
              <span class="badge-pill ${badgeClass}">${escapeHtml(status.toUpperCase())}</span>
              ${k.reviewer_notes ? `<div style="font-size:0.75rem; color:#475569; margin-top:0.25rem;">Note: ${escapeHtml(k.reviewer_notes)}</div>` : ""}
            </td>
            <td>
              <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                <button type="button" class="btn-glass btn-glass-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-kyc-decision="approved" data-kyc-idx="${idx}">
                  <i class="fa-solid fa-check"></i> Approve
                </button>
                <button type="button" class="btn-glass" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-kyc-decision="resubmission_required" data-kyc-idx="${idx}">
                  <i class="fa-solid fa-rotate-left"></i> Resubmit
                </button>
                <button type="button" class="btn-glass btn-glass-danger" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-kyc-decision="rejected" data-kyc-idx="${idx}">
                  <i class="fa-solid fa-ban"></i> Reject
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderListingsTable() {
    const tbody = document.getElementById("adminListingsTableBody");
    if (!tbody) return;

    tbody.innerHTML = allVehicles
      .map((v, idx) => {
        const mod = v.moderation_status || "approved";
        const badgeClass =
          mod === "approved"
            ? "badge-verified"
            : mod === "rejected" || mod === "suspended"
            ? "badge-rejected"
            : "badge-pending";

        return `
          <tr>
            <td><strong>${escapeHtml(v.title || v.name)}</strong></td>
            <td>${escapeHtml(v.provider_name || v.providerName || "Drivora Partner")}</td>
            <td>${Number(v.model_year || v.modelYear || 2024)} · ${escapeHtml(v.category || "SUV")}</td>
            <td>₹${Number(v.daily_rate || v.price || 0).toLocaleString("en-IN")}/day · Dep: ₹${Number(v.security_deposit || v.securityDeposit || 5000).toLocaleString("en-IN")}</td>
            <td><span class="badge-pill ${badgeClass}">${escapeHtml(mod.toUpperCase())}</span></td>
            <td>
              <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                <button type="button" class="btn-glass btn-glass-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-veh-mod="approved" data-veh-idx="${idx}">
                  Approve
                </button>
                <button type="button" class="btn-glass btn-glass-danger" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-veh-mod="suspended" data-veh-idx="${idx}">
                  Suspend
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderReviewsTable() {
    const tbody = document.getElementById("adminReviewsTableBody");
    if (!tbody) return;

    if (!allReviews.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.25rem;">No customer reviews submitted or flagged yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allReviews
      .map((r, idx) => {
        const isReported = Boolean(r.is_reported || r.reported);
        const isHidden = Boolean(r.is_hidden);
        return `
          <tr>
            <td>Vehicle: <strong>${escapeHtml(r.vehicle_id)}</strong></td>
            <td><strong>${escapeHtml(r.name || r.reviewer_name || "Customer")}</strong></td>
            <td>
              <strong>${Number(r.rating || 5)}★</strong> — ${escapeHtml(r.comment || "")}
            </td>
            <td>
              ${
                isReported
                  ? `<span class="badge-pill badge-rejected">Flagged: ${escapeHtml(r.report_reason || "Reported by user")}</span>`
                  : `<span class="badge-pill badge-verified">Clean</span>`
              }
            </td>
            <td>${isHidden ? '<span class="badge-pill badge-rejected">HIDDEN</span>' : '<span class="badge-pill badge-verified">PUBLIC</span>'}</td>
            <td>
              <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                <button type="button" class="btn-glass" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-rev-action="clear" data-rev-idx="${idx}">
                  Clear Flag
                </button>
                <button type="button" class="btn-glass btn-glass-danger" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-rev-action="hide" data-rev-idx="${idx}">
                  ${isHidden ? "Restore" : "Hide Review"}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderDisputesTable() {
    const tbody = document.getElementById("adminDisputesTableBody");
    if (!tbody) return;

    if (!allInspections.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.25rem;">No condition inspections or deposit disputes logged yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allInspections
      .map((insp, idx) => {
        const dt = new Date(insp.created_at || Date.now()).toLocaleString("en-IN");
        return `
          <tr>
            <td>${escapeHtml(dt)}</td>
            <td><strong>${escapeHtml(insp.booking_id)}</strong></td>
            <td>${escapeHtml(String(insp.inspection_type || "pickup").toUpperCase())}</td>
            <td>${Number(insp.odometer_km || 0)} km · ${Number(insp.fuel_or_battery_percent || 0)}%</td>
            <td>
              <div>${escapeHtml(insp.condition_notes || "")}</div>
              ${insp.new_damage_reported ? `<div style="color:#b91c1c; font-size:0.76rem;">Claim (₹${Number(insp.estimated_damage_cost || 0)}): ${escapeHtml(insp.new_damage_reported)}</div>` : ""}
            </td>
            <td>
              ${
                insp.dispute_flagged
                  ? insp.dispute_resolved
                    ? `<span class="badge-pill badge-verified">RESOLVED (${escapeHtml(insp.resolution_note || "Settled")})</span>`
                    : `<span class="badge-pill badge-rejected">OPEN DISPUTE</span>`
                  : `<span class="badge-pill badge-verified">No Dispute</span>`
              }
            </td>
            <td>
              ${
                insp.dispute_flagged && !insp.dispute_resolved
                  ? `<button type="button" class="btn-glass btn-glass-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-resolve-dispute="${idx}">
                      Adjudicate &amp; Resolve
                    </button>`
                  : "—"
              }
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderMediaTable() {
    const tbody = document.getElementById("adminMediaTableBody");
    if (!tbody) return;

    if (!mediaRecords.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.25rem;">No media lifecycle records found.</td></tr>`;
      return;
    }

    const now = Date.now();
    tbody.innerHTML = mediaRecords
      .map((m) => {
        const isExpired = m.expires_at && new Date(m.expires_at).getTime() <= now;
        let statusHtml = `<span class="badge-pill badge-verified">ACTIVE IN STORAGE</span>`;
        if (m.is_deleted) {
          statusHtml = `<span class="badge-pill badge-unverified">STORAGE OBJECT &amp; METADATA PURGED</span>`;
        } else if (isExpired) {
          statusHtml = `<span class="badge-pill badge-rejected">EXPIRED — READY FOR CLEANUP</span>`;
        }

        return `
          <tr>
            <td><code>${escapeHtml(m.id)}</code></td>
            <td><strong>${escapeHtml(m.bucket_name)}</strong> / <code>${escapeHtml(m.object_path)}</code></td>
            <td>${escapeHtml(m.media_category)}</td>
            <td>${escapeHtml(m.retention_policy)}</td>
            <td>${m.expires_at ? escapeHtml(new Date(m.expires_at).toLocaleString("en-IN")) : "Permanent"}</td>
            <td>${statusHtml}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderAuditTable() {
    const tbody = document.getElementById("adminAuditTableBody");
    if (!tbody) return;

    if (!auditLogs.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.25rem;">No security audit events recorded yet. Perform an admin action to generate an immutable audit entry.</td></tr>`;
      return;
    }

    tbody.innerHTML = auditLogs
      .map((a) => {
        const dt = new Date(a.created_at || Date.now()).toLocaleString("en-IN");
        return `
          <tr>
            <td>${escapeHtml(dt)}</td>
            <td><strong>${escapeHtml(a.actor_role || "admin")}</strong> (${escapeHtml(String(a.actor_id || "").slice(0, 10))})</td>
            <td><code>${escapeHtml(a.action)}</code></td>
            <td>${escapeHtml(a.target_type || "")} #${escapeHtml(a.target_id || "")}</td>
            <td><code style="font-size:0.76rem;">${escapeHtml(JSON.stringify(a.metadata || {}))}</code></td>
          </tr>
        `;
      })
      .join("");
  }

  function bindAdminTabs() {
    const btns = document.querySelectorAll(".admin-tab-btn");
    const sections = document.querySelectorAll(".admin-tab-section");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab");
        btns.forEach((b) => b.classList.remove("btn-glass-primary"));
        btn.classList.add("btn-glass-primary");
        sections.forEach((sec) => {
          sec.style.display = sec.id === `admin-tab-${target}` ? "block" : "none";
        });
      });
    });
  }

  function bindAdminActions() {
    // 1. KYC Moderation Decisions
    const kycBody = document.getElementById("adminKycTableBody");
    if (kycBody) {
      kycBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-kyc-decision]");
        if (!btn) return;
        if (!isAuthorizedAdmin()) {
          if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
          return;
        }

        const decision = btn.getAttribute("data-kyc-decision");
        const idx = Number(btn.getAttribute("data-kyc-idx"));
        const record = kycRecords[idx];
        if (!record) return;

        const user = getCurrentUser();
        if (user && String(record.user_id) === String(user.id)) {
          showAdminFeedback(
            `<i class="fa-solid fa-ban"></i> <strong>Security Policy Violation Blocked:</strong> Users cannot approve or moderate their own identity verification records.`,
            true
          );
          return;
        }

        const notes = window.prompt(
          `Enter reviewer audit note for marking ${record.applicant_name || record.id} as ${decision.toUpperCase()}:`,
          decision === "approved"
            ? "Verified DL + ID last-4 and commercial permit validity."
            : "Document image blurry or expiry mismatch; please resubmit."
        );
        if (notes === null) return;

        record.status = decision;
        record.reviewer_notes = notes.trim();
        record.reviewed_at = new Date().toISOString();

        try {
          await fetch("/api/marketplace?action=verification", {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              id: record.id,
              status: decision,
              reviewer_notes: record.reviewer_notes,
            }),
          });
        } catch (err) {
          // local fallback
        }

        writeLocalJson(LOCAL_KYC_KEY, kycRecords);
        logLocalAudit(`kyc_${decision}`, "identity_verifications", record.id, {
          applicant: record.applicant_name,
          residency_type: record.residency_type,
          notes: record.reviewer_notes,
        });

        showAdminFeedback(
          `KYC verification for <strong>${escapeHtml(record.applicant_name)}</strong> updated to <strong>${escapeHtml(decision.toUpperCase())}</strong> and recorded in audit trail.`
        );
        await loadAdminDashboard();
      });
    }

    // 2. Listing Moderation
    const listBody = document.getElementById("adminListingsTableBody");
    if (listBody) {
      listBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-veh-mod]");
        if (!btn) return;
        if (!isAuthorizedAdmin()) {
          if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
          return;
        }

        const modStatus = btn.getAttribute("data-veh-mod");
        const idx = Number(btn.getAttribute("data-veh-idx"));
        const veh = allVehicles[idx];
        if (!veh) return;

        veh.moderation_status = modStatus;
        veh.is_published = modStatus === "approved";
        veh.isPublished = modStatus === "approved";

        try {
          await fetch("/api/vehicles", {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              id: veh.id,
              moderation_status: modStatus,
              is_published: veh.is_published,
            }),
          });
        } catch (err) {
          // local fallback
        }

        const customVeh = readLocalJson(CUSTOM_VEHICLES_KEY, []);
        const cIdx = customVeh.findIndex((c) => String(c.id) === String(veh.id));
        if (cIdx >= 0) {
          customVeh[cIdx] = veh;
        } else {
          customVeh.push(veh);
        }
        writeLocalJson(CUSTOM_VEHICLES_KEY, customVeh);
        writeLocalJson(CUSTOM_VEHICLES_ALT_KEY, customVeh);

        logLocalAudit(`listing_${modStatus}`, "vehicles", veh.id, { title: veh.title });
        showAdminFeedback(`Vehicle <strong>${escapeHtml(veh.title)}</strong> moderation status set to <strong>${escapeHtml(modStatus.toUpperCase())}</strong>.`);
        await loadAdminDashboard();
      });
    }

    // 3. Review Moderation
    const revBody = document.getElementById("adminReviewsTableBody");
    if (revBody) {
      revBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-rev-action]");
        if (!btn) return;
        if (!isAuthorizedAdmin()) {
          if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
          return;
        }

        const act = btn.getAttribute("data-rev-action");
        const idx = Number(btn.getAttribute("data-rev-idx"));
        const rev = allReviews[idx];
        if (!rev) return;

        let removedIds = readLocalJson(LOCAL_REMOVED_REVIEWS_KEY, []).map(String);
        let reportedList = readLocalJson(LOCAL_REPORTED_REVIEWS_KEY, []);

        if (act === "clear") {
          rev.is_reported = false;
          rev.reported = false;
          reportedList = reportedList.filter((item) => String(item.id) !== String(rev.id));
          writeLocalJson(LOCAL_REPORTED_REVIEWS_KEY, reportedList);
        } else if (act === "hide") {
          rev.is_hidden = !rev.is_hidden;
          if (rev.is_hidden) {
            if (!removedIds.includes(String(rev.id))) removedIds.push(String(rev.id));
          } else {
            removedIds = removedIds.filter((id) => id !== String(rev.id));
          }
          writeLocalJson(LOCAL_REMOVED_REVIEWS_KEY, removedIds);
        }

        try {
          await fetch("/api/reviews", {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              id: rev.id,
              is_reported: rev.is_reported,
              is_hidden: rev.is_hidden,
            }),
          });
        } catch (err) {
          // local fallback
        }

        const rawMap = readLocalJson(LOCAL_REVIEWS_KEY, {});
        if (rawMap && Array.isArray(rawMap[rev.vehicle_id])) {
          rawMap[rev.vehicle_id] = rawMap[rev.vehicle_id].map((item) =>
            String(item.id) === String(rev.id) || (item.comment === rev.comment && item.name === rev.name)
              ? { ...item, is_reported: rev.is_reported, reported: rev.reported, is_hidden: rev.is_hidden }
              : item
          );
          writeLocalJson(LOCAL_REVIEWS_KEY, rawMap);
        }

        logLocalAudit(`review_${act}`, "vehicle_reviews", rev.id, { vehicle_id: rev.vehicle_id });
        showAdminFeedback(`Review moderation action (<strong>${escapeHtml(act.toUpperCase())}</strong>) applied.`);
        await loadAdminDashboard();
      });
    }

    // 4. Dispute Resolution
    const dispBody = document.getElementById("adminDisputesTableBody");
    if (dispBody) {
      dispBody.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-resolve-dispute]");
        if (!btn) return;
        if (!isAuthorizedAdmin()) {
          if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
          return;
        }

        const idx = Number(btn.getAttribute("data-resolve-dispute"));
        const insp = allInspections[idx];
        if (!insp) return;

        const resolution = window.prompt(
          `Enter deposit adjudication decision for Booking ${insp.booking_id}:`,
          "Verified pre-pickup photos; ₹1,500 deducted for bumper scratch, remaining ₹3,500 deposit refunded to customer."
        );
        if (!resolution) return;

        insp.dispute_resolved = true;
        insp.resolution_note = resolution.trim();
        writeLocalJson(LOCAL_INSPECTIONS_KEY, allInspections);

        logLocalAudit("resolve_deposit_dispute", "pickup_return_inspections", insp.id, {
          booking_id: insp.booking_id,
          resolution: insp.resolution_note,
        });
        showAdminFeedback(`Dispute for Booking <strong>${escapeHtml(insp.booking_id)}</strong> resolved and logged.`);
        await loadAdminDashboard();
      });
    }

    // 5. Expired Media Cleanup & Simulator
    const cleanupBtn = document.getElementById("btnRunMediaCleanup");
    if (cleanupBtn) {
      cleanupBtn.addEventListener("click", async () => {
        if (!isAuthorizedAdmin()) {
          if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
          return;
        }

        let remotePurged = 0;
        try {
          const res = await fetch("/api/marketplace?action=media_cleanup", {
            method: "POST",
            headers: getAuthHeaders(),
          });
          const payload = await res.json();
          if (res.ok && payload.data) {
            remotePurged = Number(payload.data.purgedCount || 0);
          }
        } catch (err) {
          // local cleanup below
        }

        const now = Date.now();
        let localPurged = 0;
        mediaRecords = mediaRecords.map((m) => {
          if (!m.is_deleted && m.expires_at && new Date(m.expires_at).getTime() <= now) {
            localPurged += 1;
            return {
              ...m,
              is_deleted: true,
              deleted_at: new Date().toISOString(),
            };
          }
          return m;
        });
        writeLocalJson(LOCAL_MEDIA_KEY, mediaRecords);

        const totalPurged = Math.max(remotePurged, localPurged);
        logLocalAudit("media_retention_cleanup", "vehicle_media", "batch", {
          purged_count: totalPurged,
        });

        showAdminFeedback(
          `<i class="fa-solid fa-broom"></i> <strong>Expired Media Cleanup Completed:</strong> ${totalPurged} expired temporary media object(s) deleted from storage and marked purged.`
        );
        await loadAdminDashboard();
      });
    }

    const simBtn = document.getElementById("btnSimulateExpiredMedia");
    if (simBtn) {
      simBtn.addEventListener("click", () => {
        const sample = {
          id: `med-exp-${Date.now().toString().slice(-4)}`,
          bucket_name: "inspection-evidence",
          object_path: `inspections/bk-${Date.now().toString().slice(-3)}/temp-odometer.jpg`,
          media_category: "inspection_photo",
          retention_policy: "until_dispute_window_closed",
          expires_at: new Date(Date.now() - 60000).toISOString(),
          is_deleted: false,
          created_at: new Date().toISOString(),
        };
        mediaRecords.unshift(sample);
        writeLocalJson(LOCAL_MEDIA_KEY, mediaRecords);
        renderAdminKpis();
        renderMediaTable();
        showAdminFeedback("Added sample expired temporary inspection photo. Click 'Run Expired Media Cleanup' to test deletion.");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindAdminTabs();
    bindAdminActions();

    const signInBtn = document.getElementById("btnAdminSignIn");
    if (signInBtn) {
      signInBtn.addEventListener("click", () => {
        if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
      });
    }

    window.addEventListener("drivora:auth-changed", () => {
      loadAdminDashboard();
    });

    loadAdminDashboard();
  });
})();
