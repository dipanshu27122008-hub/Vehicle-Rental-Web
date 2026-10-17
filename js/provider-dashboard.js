/**
 * Drivora Provider & Shopkeeper Dashboard Controller (js/provider-dashboard.js)
 * Connects to /api/vehicles, /api/bookings, /api/inquiries, and /api/marketplace
 * with role checks, conflict-free booking confirmation, late-return fee calculation,
 * pickup/return condition inspections, and bidirectional localStorage + Supabase sync.
 */
(function () {
  const CUSTOM_VEHICLES_KEY = "drivora-provider-vehicles";
  const CUSTOM_VEHICLES_ALT_KEY = "drivora_custom_vehicles_v1";
  const LOCAL_BOOKINGS_KEY = "drivora-bookings";
  const LOCAL_BOOKINGS_ALT_KEY = "drivora_bookings_v1";
  const LOCAL_INSPECTIONS_KEY = "drivora_inspections_v1";
  const LOCAL_INQUIRIES_KEY = "drivora-vehicle-inquiries";
  const LOCAL_INQUIRIES_ALT_KEY = "drivora_inquiries_v1";
  const LOCAL_KYC_KEY = "drivora_kyc_records_v1";

  const CITY_COORDS = {
    Mumbai: { lat: 19.076, lng: 72.8777 },
    "Delhi NCR": { lat: 28.6139, lng: 77.209 },
    Delhi: { lat: 28.6139, lng: 77.209 },
    Bengaluru: { lat: 12.9716, lng: 77.5946 },
    Pune: { lat: 18.5204, lng: 73.8567 },
    Hyderabad: { lat: 17.385, lng: 78.4867 },
    Chennai: { lat: 13.0827, lng: 80.2707 },
    Ahmedabad: { lat: 23.0225, lng: 72.5714 },
    Jaipur: { lat: 26.9124, lng: 75.7873 },
  };

  let providerVehicles = [];
  let providerBookings = [];
  let providerInspections = [];
  let providerInquiries = [];

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

  function isAuthorizedProvider() {
    const user = getCurrentUser();
    return Boolean(user && (user.role === "provider" || user.role === "admin"));
  }

  function readLocalJson(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : fallback;
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeLocalJson(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      // ignore storage quota errors
    }
  }

  function normalizeBooking(b) {
    const rawStatus = String(b.status || b.bookingStatus || b.booking_status || "pending").toLowerCase();
    return {
      ...b,
      id: b.id || b.booking_code || `DRV-${Date.now()}`,
      vehicle_id: b.vehicle_id || b.vehicleId || b.vehicle || b.vehicle_name,
      vehicle_name: b.vehicle_name || b.vehicle || b.vehicle_title || "Drivora Vehicle",
      vehicle: b.vehicle || b.vehicle_name || b.vehicle_title || "Drivora Vehicle",
      customer_name: b.customer_name || b.name || "Customer",
      name: b.name || b.customer_name || "Customer",
      customer_email: b.customer_email || b.email || "",
      email: b.email || b.customer_email || "",
      customer_phone: b.customer_phone || b.phone || "—",
      phone: b.phone || b.customer_phone || "—",
      pickup_at: b.pickup_at || b.pickup_date || b.pickup || "",
      pickup_date: b.pickup_date || b.pickup || b.pickup_at || "",
      pickup: b.pickup || b.pickup_date || b.pickup_at || "",
      return_at: b.return_at || b.return_date || b.returnDate || "",
      return_date: b.return_date || b.returnDate || b.return_at || "",
      returnDate: b.returnDate || b.return_date || b.return_at || "",
      daily_rate: Number(b.daily_rate || b.dailyPrice || b.daily_price || 2500),
      dailyPrice: Number(b.dailyPrice || b.daily_rate || b.daily_price || 2500),
      security_deposit: Number(b.security_deposit || b.securityDeposit || 5000),
      securityDeposit: Number(b.securityDeposit || b.security_deposit || 5000),
      rental_subtotal: Number(b.rental_subtotal || b.totalAmount || b.base_amount || b.total_price || 0),
      totalAmount: Number(b.totalAmount || b.rental_subtotal || b.base_amount || b.total_price || 0),
      late_return_fee: Number(b.late_return_fee || b.lateFeeAmount || 0),
      lateFeeAmount: Number(b.lateFeeAmount || b.late_return_fee || 0),
      total_payable: Number(
        b.total_payable ||
          b.totalPayableWithDeposit ||
          Number(b.totalAmount || b.rental_subtotal || 0) + Number(b.securityDeposit || b.security_deposit || 5000)
      ),
      status: rawStatus,
      bookingStatus: rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1),
      payment_status: b.payment_status || b.paymentStatus || "unpaid_estimate",
    };
  }

  function showFeedback(elId, message, isError = false) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.style.display = "block";
    el.style.background = isError ? "rgba(254, 226, 226, 0.9)" : "rgba(220, 252, 231, 0.9)";
    el.style.color = isError ? "#991b1b" : "#166534";
    el.style.border = isError ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid rgba(34, 197, 94, 0.35)";
    el.innerHTML = message;
  }

  function checkRoleGuard() {
    const guard = document.getElementById("providerAccessGuard");
    const badge = document.getElementById("providerVerificationBadge");
    const user = getCurrentUser();

    if (!isAuthorizedProvider()) {
      if (guard) guard.style.display = "block";
      if (badge) {
        badge.className = "badge-pill badge-unverified";
        badge.innerHTML = '<i class="fa-solid fa-lock"></i> Sign In as Provider Required';
      }
    } else {
      if (guard) guard.style.display = "none";
      if (badge) {
        const displayName = user.fullName || user.full_name || user.email || "Provider";
        const isVerified = Boolean(user.isVerified || user.is_verified || user.role === "admin");
        badge.className = isVerified ? "badge-pill badge-verified" : "badge-pill badge-pending";
        badge.innerHTML = isVerified
          ? `<i class="fa-solid fa-circle-check"></i> Verified Provider (${escapeHtml(displayName)})`
          : `<i class="fa-solid fa-clock"></i> Provider Unverified — Submit KYC (${escapeHtml(displayName)})`;
      }
    }
  }

  async function loadDashboardData() {
    checkRoleGuard();

    // 1. Load Vehicles (merge default provider vehicles + custom local + API)
    const customLocal = [
      ...readLocalJson(CUSTOM_VEHICLES_KEY, []),
      ...readLocalJson(CUSTOM_VEHICLES_ALT_KEY, []),
    ];
    let remoteVehicles = [];
    try {
      const res = await fetch("/api/vehicles?include_all=true", { headers: getAuthHeaders() });
      const payload = await res.json();
      if (res.ok && Array.isArray(payload.data || payload.vehicles)) {
        remoteVehicles = payload.data || payload.vehicles;
      }
    } catch (err) {
      // Offline / local fallback
    }

    const baseCatalogArr = Array.isArray(window.vehicles)
      ? window.vehicles
      : Object.values(window.vehicleCatalog || {});
    const catalogSeed = baseCatalogArr.slice(0, 6).map((v) => ({
      id: v.id || `veh-${v.name}`,
      legacy_id: v.id,
      title: v.name || v.title,
      name: v.name || v.title,
      category: v.category || v.type || "SUV",
      model_year: v.modelYear || v.model_year || 2024,
      fuel_type: v.fuel || v.fuel_type || "Petrol",
      transmission: v.transmission || "Automatic",
      seating_capacity: v.seats || v.seating_capacity || 5,
      daily_rate: v.price || v.daily_rate || 2500,
      extra_hour_rate: v.extraHourRate || Math.round((v.price || 2500) / 8),
      late_fee_per_hour: v.lateFeePerHour || Math.round((v.price || 2500) / 6),
      security_deposit: v.securityDeposit || v.security_deposit || 5000,
      city: v.city || "Mumbai",
      public_hub: v.publicHub || v.public_hub || v.location || "Central Mobility Hub",
      availability_status: v.availability || "available",
      moderation_status: "approved",
      is_published: v.isPublished !== false && v.is_published !== false,
      primary_image: v.image || v.primary_image || "./assets/vehicles/bmw x5.jpg",
      gallery_images: v.photos || v.gallery_images || [v.image || "./assets/vehicles/bmw x5.jpg"],
      unavailable_dates: v.unavailableDates || [],
      provider_verified: Boolean(v.providerVerified),
    }));

    const byId = new Map();
    [...catalogSeed, ...customLocal, ...remoteVehicles].forEach((item) => {
      const key = String(item.id || item.legacy_id);
      byId.set(key, item);
    });
    providerVehicles = Array.from(byId.values());

    // 2. Load Bookings
    const localBookings = [
      ...readLocalJson(LOCAL_BOOKINGS_KEY, []),
      ...readLocalJson(LOCAL_BOOKINGS_ALT_KEY, []),
    ];
    let remoteBookings = [];
    try {
      const res = await fetch("/api/bookings", { headers: getAuthHeaders() });
      const payload = await res.json();
      if (res.ok && Array.isArray(payload.data || payload.bookings)) {
        remoteBookings = payload.data || payload.bookings;
      }
    } catch (err) {
      // Offline fallback
    }

    const bookingsMap = new Map();
    [...localBookings, ...remoteBookings].forEach((raw) => {
      const b = normalizeBooking(raw);
      const key = String(b.id || `${b.vehicle_name}-${b.pickup_date}`);
      bookingsMap.set(key, b);
    });
    providerBookings = Array.from(bookingsMap.values());

    // 3. Load Inspections
    providerInspections = readLocalJson(LOCAL_INSPECTIONS_KEY, []);

    // 4. Load Inquiries
    const localInquiries = [
      ...readLocalJson(LOCAL_INQUIRIES_KEY, []),
      ...readLocalJson(LOCAL_INQUIRIES_ALT_KEY, []),
    ];
    let remoteInquiries = [];
    try {
      const res = await fetch("/api/inquiries", { headers: getAuthHeaders() });
      const payload = await res.json();
      if (res.ok && Array.isArray(payload.data || payload.inquiries)) {
        remoteInquiries = payload.data || payload.inquiries;
      }
    } catch (err) {
      // Offline fallback
    }
    const inqMap = new Map();
    [...localInquiries, ...remoteInquiries].forEach((inq) => {
      const key = String(inq.id || `${inq.email}-${inq.createdAt || inq.created_at}`);
      inqMap.set(key, {
        ...inq,
        id: key,
        vehicle_name: inq.vehicle_name || inq.vehicle || `Vehicle #${inq.vehicleId || inq.vehicle_id || 1}`,
        customer_name: inq.customer_name || inq.name || "Customer",
        customer_email: inq.customer_email || inq.email || "",
        message: inq.message || inq.question || "",
        provider_response: inq.provider_response || inq.providerResponse || null,
        status: inq.status || inq.inquiryStatus || (inq.provider_response || inq.providerResponse ? "responded" : "open"),
        created_at: inq.created_at || inq.createdAt || new Date().toISOString(),
      });
    });
    providerInquiries = Array.from(inqMap.values());

    renderKpis();
    renderFleetTable();
    renderBookingsTable();
    renderInspectionsTable();
    renderInquiriesTable();
  }

  function renderKpis() {
    const totalListings = providerVehicles.length;
    const publishedCount = providerVehicles.filter((v) => v.is_published !== false && v.isPublished !== false).length;
    const unpublishedCount = totalListings - publishedCount;

    const pendingCount = providerBookings.filter((b) => (b.status || "pending") === "pending").length;
    const confirmedCount = providerBookings.filter((b) => b.status === "confirmed").length;
    const activeCount = providerBookings.filter((b) => b.status === "active").length;
    const completedCount = providerBookings.filter((b) => b.status === "completed").length;
    const cancelledCount = providerBookings.filter(
      (b) => b.status === "cancelled" || b.status === "rejected"
    ).length;

    let estimatedEarnings = 0;
    let finalizedSettlements = 0;

    providerBookings.forEach((b) => {
      const netRental =
        Number(b.rental_subtotal || b.totalAmount || 0) +
        Number(b.late_return_fee || b.lateFeeAmount || 0);

      if (b.status === "confirmed" || b.status === "active" || !b.status || b.status === "pending") {
        estimatedEarnings += netRental;
      } else if (b.status === "completed") {
        finalizedSettlements += netRental;
      } else if (b.status === "cancelled" && Number(b.cancellation_fee || b.cancellationFee || 0) > 0) {
        finalizedSettlements += Number(b.cancellation_fee || b.cancellationFee || 0);
      }
    });

    const openInquiries = providerInquiries.filter((i) => (i.status || "open") === "open").length;

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setEl("kpiTotalListings", totalListings);
    setEl("kpiPublishedCount", publishedCount);
    setEl("kpiUnpublishedCount", unpublishedCount);
    setEl("kpiPendingBookings", pendingCount);
    setEl("kpiConfirmedBookings", confirmedCount);
    setEl("kpiActiveBookings", activeCount);
    setEl("kpiCompletedBookings", completedCount);
    setEl("kpiCancelledBookings", cancelledCount);
    setEl("kpiEstimatedEarnings", `₹${Math.round(estimatedEarnings).toLocaleString("en-IN")}`);
    setEl("kpiFinalizedSettlements", `₹${Math.round(finalizedSettlements).toLocaleString("en-IN")}`);
    setEl("kpiOpenInquiries", openInquiries);
  }

  function renderFleetTable() {
    const tbody = document.getElementById("providerFleetTableBody");
    if (!tbody) return;

    const query = (document.getElementById("fleetSearchInput")?.value || "").trim().toLowerCase();
    const filtered = providerVehicles.filter((v) => {
      if (!query) return true;
      return (
        String(v.title || v.name || "").toLowerCase().includes(query) ||
        String(v.category || v.type || "").toLowerCase().includes(query) ||
        String(v.city || "").toLowerCase().includes(query)
      );
    });

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem;">No matching vehicles in your fleet. Click "Add New Vehicle" to list one.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((v) => {
        const id = escapeHtml(v.id || `veh-${v.legacy_id}`);
        const title = escapeHtml(v.title || v.name);
        const category = escapeHtml(v.category || v.type || "SUV");
        const year = Number(v.model_year || v.modelYear || 2024);
        const fuel = escapeHtml(v.fuel_type || v.fuel || "Petrol");
        const transmission = escapeHtml(v.transmission || "Automatic");
        const seats = Number(v.seating_capacity || v.seats || 5);
        const dailyRate = Number(v.daily_rate || v.price || 1500);
        const deposit = Number(v.security_deposit || v.securityDeposit || 3000);
        const city = escapeHtml(v.city || "Mumbai");
        const hub = escapeHtml(v.public_hub || v.publicHub || v.location || "City Hub");
        const avail = escapeHtml(v.availability_status || v.availability || "available");
        const modStatus = escapeHtml(v.moderation_status || "approved");
        const published = v.is_published !== false && v.isPublished !== false;
        const img = escapeHtml(v.primary_image || v.image || "./assets/vehicles/bmw x5.jpg");

        const modBadgeClass =
          modStatus === "approved"
            ? "badge-verified"
            : modStatus === "rejected"
            ? "badge-rejected"
            : "badge-pending";

        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <img src="${img}" alt="${title}" style="width:64px; height:44px; object-fit:cover; border-radius:8px; border:1px solid rgba(15,23,42,0.12);" />
                <div>
                  <strong style="color:#0f172a;">${title}</strong>
                  <div style="font-size:0.78rem; color:#64748b;">${category} · ID: ${id}</div>
                </div>
              </div>
            </td>
            <td>
              <strong>${year} Model</strong>
              <div style="font-size:0.78rem; color:#475569;">${fuel} · ${transmission} · ${seats} Seats</div>
            </td>
            <td>
              <strong>₹${dailyRate.toLocaleString("en-IN")}/day</strong>
              <div style="font-size:0.78rem; color:#475569;">Deposit: ₹${deposit.toLocaleString("en-IN")}</div>
            </td>
            <td>
              <strong>${city}</strong>
              <div style="font-size:0.78rem; color:#475569;">${hub} (${avail})</div>
            </td>
            <td>
              <span class="badge-pill ${modBadgeClass}">${modStatus.toUpperCase()}</span>
              <div style="font-size:0.76rem; margin-top:0.25rem; color:${published ? "#15803d" : "#b45309"}; font-weight:700;">
                ${published ? "Published" : "Unpublished / Hidden"}
              </div>
            </td>
            <td>
              <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                <button type="button" class="btn-glass" style="padding:0.35rem 0.65rem; font-size:0.78rem;" data-edit-veh="${id}">
                  <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button type="button" class="btn-glass" style="padding:0.35rem 0.65rem; font-size:0.78rem;" data-toggle-pub="${id}">
                  <i class="fa-solid ${published ? "fa-eye-slash" : "fa-eye"}"></i> ${published ? "Hide" : "Publish"}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function hasConflictingBooking(targetBooking) {
    const targetVeh = String(targetBooking.vehicle_name || targetBooking.vehicle_id || "").toLowerCase();
    const targetStart = new Date(targetBooking.pickup_at || targetBooking.pickup_date).getTime();
    const targetEnd = new Date(targetBooking.return_at || targetBooking.return_date).getTime();
    if (!Number.isFinite(targetStart) || !Number.isFinite(targetEnd)) return false;

    return providerBookings.some((other) => {
      if (other === targetBooking || String(other.id) === String(targetBooking.id)) {
        return false;
      }
      if (other.status !== "confirmed" && other.status !== "active") return false;

      const otherVeh = String(other.vehicle_name || other.vehicle_id || "").toLowerCase();
      if (!otherVeh || otherVeh !== targetVeh) return false;

      const otherStart = new Date(other.pickup_at || other.pickup_date).getTime();
      const otherEnd = new Date(other.return_at || other.return_date).getTime();
      if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd)) return false;

      return targetStart < otherEnd && targetEnd > otherStart;
    });
  }

  function renderBookingsTable() {
    const tbody = document.getElementById("providerBookingsTableBody");
    if (!tbody) return;

    const filterVal = document.getElementById("bookingStatusFilter")?.value || "all";
    const list = providerBookings.filter((b) => {
      const st = b.status || "pending";
      if (filterVal === "all") return true;
      if (filterVal === "cancelled") return st === "cancelled" || st === "rejected";
      return st === filterVal;
    });

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem;">No bookings match the selected filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((b, idx) => {
        const bId = escapeHtml(b.id || `BK-${1000 + idx}`);
        const vehName = escapeHtml(b.vehicle_name || "Drivora Vehicle");
        const custName = escapeHtml(b.customer_name || "Customer");
        const custPhone = escapeHtml(b.customer_phone || "—");
        const custEmail = escapeHtml(b.customer_email || "");
        const pickup = escapeHtml(b.pickup_at || b.pickup_date || "—");
        const ret = escapeHtml(b.return_at || b.return_date || "—");
        const actualRet = b.actual_return_at ? `<div style="font-size:0.75rem; color:#0284c7;">Actual: ${escapeHtml(b.actual_return_at)}</div>` : "";
        const status = escapeHtml(b.status || "pending");
        const rentalSub = Number(b.rental_subtotal || b.totalAmount || 0);
        const deposit = Number(b.security_deposit || 5000);
        const lateFee = Number(b.late_return_fee || 0);

        const badgeClass =
          status === "confirmed" || status === "completed"
            ? "badge-verified"
            : status === "cancelled" || status === "rejected"
            ? "badge-rejected"
            : "badge-pending";

        return `
          <tr>
            <td>
              <strong>${bId.slice(0, 14)}</strong>
              <div style="font-size:0.74rem; color:#64748b;">Payment: ${escapeHtml(b.payment_status || "unpaid_estimate")}</div>
            </td>
            <td><strong>${vehName}</strong></td>
            <td>
              <strong>${custName}</strong>
              <div style="font-size:0.76rem; color:#475569;">${custPhone} ${custEmail ? `· ${custEmail}` : ""}</div>
            </td>
            <td>
              <div><strong>Out:</strong> ${pickup}</div>
              <div><strong>Due:</strong> ${ret}</div>
              ${actualRet}
            </td>
            <td>
              <strong>₹${rentalSub.toLocaleString("en-IN")}</strong>
              <div style="font-size:0.75rem; color:#475569;">+ Deposit: ₹${deposit.toLocaleString("en-IN")}${lateFee > 0 ? ` · Late Fee: ₹${lateFee.toLocaleString("en-IN")}` : ""}</div>
            </td>
            <td><span class="badge-pill ${badgeClass}">${status.toUpperCase()}</span></td>
            <td>
              <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                ${
                  status === "pending"
                    ? `
                  <button type="button" class="btn-glass btn-glass-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-book-action="confirmed" data-book-id="${bId}">
                    <i class="fa-solid fa-check"></i> Confirm
                  </button>
                  <button type="button" class="btn-glass btn-glass-danger" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-book-action="rejected" data-book-id="${bId}">
                    <i class="fa-solid fa-xmark"></i> Reject
                  </button>
                `
                    : ""
                }
                ${
                  status === "confirmed"
                    ? `
                  <button type="button" class="btn-glass btn-glass-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-book-action="active" data-book-id="${bId}">
                    <i class="fa-solid fa-key"></i> Handover / Start
                  </button>
                `
                    : ""
                }
                ${
                  status === "confirmed" || status === "active"
                    ? `
                  <button type="button" class="btn-glass" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-book-action="completed" data-book-id="${bId}">
                    <i class="fa-solid fa-flag-checkered"></i> Complete Return
                  </button>
                `
                    : ""
                }
                <button type="button" class="btn-glass" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-book-inspect="${bId}">
                  <i class="fa-solid fa-clipboard-check"></i> Inspect
                </button>
                <button type="button" class="btn-glass" style="padding:0.3rem 0.6rem; font-size:0.75rem;" data-book-invoice="${bId}">
                  <i class="fa-solid fa-file-invoice"></i> Invoice
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderInspectionsTable() {
    const tbody = document.getElementById("inspectionsTableBody");
    if (!tbody) return;

    if (!providerInspections.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.25rem;">No pickup or return inspections recorded yet. Use the form above to log handover condition.</td></tr>`;
      return;
    }

    tbody.innerHTML = providerInspections
      .map((item) => {
        const dt = new Date(item.created_at || Date.now()).toLocaleString("en-IN");
        const stageBadge = item.inspection_type === "return" ? "badge-verified" : "badge-pending";
        return `
          <tr>
            <td>${escapeHtml(dt)}</td>
            <td><strong>${escapeHtml(item.booking_id)}</strong></td>
            <td><span class="badge-pill ${stageBadge}">${escapeHtml(String(item.inspection_type || "pickup").toUpperCase())}</span></td>
            <td>${Number(item.odometer_km || 0).toLocaleString("en-IN")} km · ${Number(item.fuel_or_battery_percent || 0)}%</td>
            <td>
              <div>${escapeHtml(item.condition_notes || "—")}</div>
              ${item.new_damage_reported ? `<div style="font-size:0.76rem; color:#b91c1c;">Damage: ${escapeHtml(item.new_damage_reported)}</div>` : ""}
            </td>
            <td>₹${Number(item.estimated_damage_cost || 0).toLocaleString("en-IN")}</td>
            <td>
              ${
                item.dispute_flagged
                  ? `<span class="badge-pill badge-rejected"><i class="fa-solid fa-triangle-exclamation"></i> DISPUTE ESCALATED</span>`
                  : `<span class="badge-pill badge-verified">${item.customer_acknowledged ? "Acknowledged" : "Logged"}</span>`
              }
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderInquiriesTable() {
    const tbody = document.getElementById("providerInquiriesTableBody");
    if (!tbody) return;

    if (!providerInquiries.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.25rem;">No customer inquiries yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = providerInquiries
      .map((inq, idx) => {
        const dt = new Date(inq.created_at || Date.now()).toLocaleDateString("en-IN");
        const status = inq.status || (inq.provider_response ? "responded" : "open");
        const badge = status === "responded" ? "badge-verified" : "badge-pending";
        return `
          <tr>
            <td>${escapeHtml(dt)}</td>
            <td><strong>${escapeHtml(inq.vehicle_name || `Vehicle #${inq.vehicle_id || 1}`)}</strong></td>
            <td>
              <strong>${escapeHtml(inq.customer_name || "Customer")}</strong>
              <div style="font-size:0.76rem; color:#475569;">${escapeHtml(inq.customer_email || "")}</div>
            </td>
            <td>${escapeHtml(inq.message || "")}</td>
            <td>
              <span class="badge-pill ${badge}">${escapeHtml(status.toUpperCase())}</span>
              ${
                inq.provider_response
                  ? `<div style="font-size:0.8rem; color:#0f172a; margin-top:0.3rem;"><strong>Reply:</strong> ${escapeHtml(inq.provider_response)}</div>`
                  : ""
              }
            </td>
            <td>
              <button type="button" class="btn-glass btn-glass-primary" style="padding:0.35rem 0.7rem; font-size:0.78rem;" data-reply-inq="${idx}">
                <i class="fa-solid fa-reply"></i> ${inq.provider_response ? "Update Reply" : "Reply"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function bindTabs() {
    const tabButtons = document.querySelectorAll(".provider-tab-btn");
    const sections = document.querySelectorAll(".provider-tab-section");

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab");
        tabButtons.forEach((b) => b.classList.remove("btn-glass-primary"));
        btn.classList.add("btn-glass-primary");
        sections.forEach((sec) => {
          sec.style.display = sec.id === `tab-${target}` ? "block" : "none";
        });
      });
    });
  }

  function bindVehicleForm() {
    const panel = document.getElementById("vehicleFormPanel");
    const openBtn = document.getElementById("btnOpenAddVehicle");
    const closeBtn = document.getElementById("btnCloseVehicleForm");
    const form = document.getElementById("providerVehicleForm");

    if (openBtn && panel) {
      openBtn.addEventListener("click", () => {
        if (!isAuthorizedProvider()) {
          if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
          return;
        }
        form.reset();
        document.getElementById("vehEditId").value = "";
        document.getElementById("vehicleFormTitle").innerHTML =
          '<i class="fa-solid fa-car-on"></i> Add New Marketplace Vehicle';
        panel.style.display = "block";
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    if (closeBtn && panel) {
      closeBtn.addEventListener("click", () => {
        panel.style.display = "none";
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!isAuthorizedProvider()) {
          showFeedback("vehFormFeedback", "Please sign in with a Provider or Administrator account to add or edit vehicles.", true);
          return;
        }

        const editId = document.getElementById("vehEditId").value.trim();
        const title = document.getElementById("vehTitle").value.trim();
        const category = document.getElementById("vehCategory").value;
        const modelYear = Number(document.getElementById("vehModelYear").value);
        const fuelType = document.getElementById("vehFuel").value;
        const transmission = document.getElementById("vehTransmission").value;
        const seats = Number(document.getElementById("vehSeats").value);
        const dailyRate = Number(document.getElementById("vehDailyRate").value);
        const extraHourRate = Number(document.getElementById("vehExtraHourRate").value) || Math.round(dailyRate / 8);
        const lateHourRate = Number(document.getElementById("vehLateHourRate").value) || Math.round(dailyRate / 6);
        const securityDeposit = Number(document.getElementById("vehSecurityDeposit").value);
        const city = document.getElementById("vehCity").value;
        const publicHub = document.getElementById("vehHub").value.trim();
        const availabilityStatus = document.getElementById("vehAvailability").value;
        const unavailableDates = document
          .getElementById("vehUnavailableDates")
          .value.split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const primaryImage = document.getElementById("vehPrimaryImage").value.trim() || "./assets/vehicles/bmw x5.jpg";
        const galleryImages = document
          .getElementById("vehGalleryImages")
          .value.split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const rentalRules = document.getElementById("vehRules").value.trim();
        const isPublished = document.getElementById("vehPublishedToggle").checked;
        const termsAccepted = document.getElementById("vehTermsAccept").checked;

        if (!title || !publicHub) {
          showFeedback("vehFormFeedback", "Vehicle Name and Public Pickup Hub are required.", true);
          return;
        }
        if (!Number.isInteger(modelYear) || modelYear < 2010 || modelYear > 2027) {
          showFeedback("vehFormFeedback", "Model Year must be between 2010 and 2027.", true);
          return;
        }
        if (!Number.isFinite(dailyRate) || dailyRate < 100) {
          showFeedback("vehFormFeedback", "Daily rental rate must be at least ₹100.", true);
          return;
        }
        if (!termsAccepted) {
          showFeedback("vehFormFeedback", "You must accept the Provider Terms (v1.0-provider) before saving a listing.", true);
          return;
        }

        const coords = CITY_COORDS[city] || CITY_COORDS.Mumbai;
        const user = getCurrentUser();
        const providerName = user ? user.fullName || user.full_name || user.email : "Drivora Partner Fleet";
        const providerVerified = Boolean(user && (user.isVerified || user.is_verified || user.role === "admin"));

        const payload = {
          id: editId || `prov-veh-${Date.now()}`,
          title,
          name: title,
          category,
          type: category,
          model_year: modelYear,
          modelYear,
          fuel_type: fuelType,
          fuel: fuelType,
          transmission,
          seating_capacity: seats,
          seats,
          daily_rate: dailyRate,
          price: dailyRate,
          extra_hour_rate: extraHourRate,
          extraHourRate,
          late_fee_per_hour: lateHourRate,
          lateFeePerHour: lateHourRate,
          security_deposit: securityDeposit,
          securityDeposit,
          city,
          public_hub: publicHub,
          publicHub,
          location: publicHub,
          lat: coords.lat,
          lng: coords.lng,
          latitude: coords.lat,
          longitude: coords.lng,
          availability_status: availabilityStatus,
          availability: availabilityStatus,
          unavailable_dates: unavailableDates,
          unavailableDates,
          primary_image: primaryImage,
          image: primaryImage,
          gallery_images: galleryImages.length ? galleryImages : [primaryImage],
          photos: galleryImages.length ? galleryImages : [primaryImage],
          rental_rules: rentalRules,
          is_published: isPublished,
          isPublished,
          moderation_status: "approved",
          provider_name: providerName,
          providerName,
          provider_verified: providerVerified,
          providerVerified,
          rating: 4.8,
          reviewCount: 5,
          terms_version: "v1.0-provider",
        };

        try {
          await fetch("/api/marketplace?action=terms", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              terms_type: "provider",
              version_code: "v1.0-provider",
              context: "vehicle_listing_save",
            }),
          });
          await fetch("/api/vehicles", {
            method: editId ? "PATCH" : "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          });
        } catch (err) {
          // Persist locally below
        }

        const customList = readLocalJson(CUSTOM_VEHICLES_KEY, []);
        const existingIndex = customList.findIndex((item) => String(item.id) === String(payload.id));
        if (existingIndex >= 0) {
          customList[existingIndex] = payload;
        } else {
          customList.unshift(payload);
        }
        writeLocalJson(CUSTOM_VEHICLES_KEY, customList);
        writeLocalJson(CUSTOM_VEHICLES_ALT_KEY, customList);

        showFeedback("vehFormFeedback", `Vehicle listing <strong>${escapeHtml(title)}</strong> saved and synchronized with marketplace catalog.`);
        await loadDashboardData();
      });
    }
  }

  function bindTableDelegation() {
    // Fleet table edit / publish toggle
    const fleetBody = document.getElementById("providerFleetTableBody");
    if (fleetBody) {
      fleetBody.addEventListener("click", async (e) => {
        const editBtn = e.target.closest("[data-edit-veh]");
        if (editBtn) {
          const id = editBtn.getAttribute("data-edit-veh");
          const veh = providerVehicles.find((v) => String(v.id || `veh-${v.legacy_id}`) === String(id));
          if (!veh) return;

          document.getElementById("vehEditId").value = veh.id || `veh-${veh.legacy_id}`;
          document.getElementById("vehTitle").value = veh.title || veh.name || "";
          document.getElementById("vehCategory").value = veh.category || veh.type || "Cars";
          document.getElementById("vehModelYear").value = veh.model_year || veh.modelYear || 2024;
          document.getElementById("vehFuel").value = veh.fuel_type || veh.fuel || "Petrol";
          document.getElementById("vehTransmission").value = veh.transmission || "Automatic";
          document.getElementById("vehSeats").value = veh.seating_capacity || veh.seats || 5;
          document.getElementById("vehDailyRate").value = veh.daily_rate || veh.price || 2500;
          document.getElementById("vehSecurityDeposit").value = veh.security_deposit || veh.securityDeposit || 5000;
          document.getElementById("vehCity").value = veh.city || "Mumbai";
          document.getElementById("vehHub").value = veh.public_hub || veh.publicHub || veh.location || "";
          document.getElementById("vehPrimaryImage").value = veh.primary_image || veh.image || "./assets/vehicles/bmw x5.jpg";
          document.getElementById("vehPublishedToggle").checked = veh.is_published !== false && veh.isPublished !== false;
          document.getElementById("vehTermsAccept").checked = true;

          const panel = document.getElementById("vehicleFormPanel");
          document.getElementById("vehicleFormTitle").innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Vehicle: ${escapeHtml(veh.title || veh.name)}`;
          panel.style.display = "block";
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const pubBtn = e.target.closest("[data-toggle-pub]");
        if (pubBtn) {
          if (!isAuthorizedProvider()) {
            if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
            return;
          }
          const id = pubBtn.getAttribute("data-toggle-pub");
          const veh = providerVehicles.find((v) => String(v.id || `veh-${v.legacy_id}`) === String(id));
          if (!veh) return;
          const nextPub = veh.is_published === false || veh.isPublished === false;
          veh.is_published = nextPub;
          veh.isPublished = nextPub;

          try {
            await fetch("/api/vehicles", {
              method: "PATCH",
              headers: getAuthHeaders(),
              body: JSON.stringify({ id: veh.id, is_published: nextPub }),
            });
          } catch (err) {
            // fallback
          }

          const customList = readLocalJson(CUSTOM_VEHICLES_KEY, []);
          const idx = customList.findIndex((c) => String(c.id) === String(veh.id));
          if (idx >= 0) {
            customList[idx].is_published = nextPub;
            customList[idx].isPublished = nextPub;
          } else {
            customList.push(veh);
          }
          writeLocalJson(CUSTOM_VEHICLES_KEY, customList);
          writeLocalJson(CUSTOM_VEHICLES_ALT_KEY, customList);
          await loadDashboardData();
        }
      });
    }

    // Bookings table actions
    const bookingsBody = document.getElementById("providerBookingsTableBody");
    if (bookingsBody) {
      bookingsBody.addEventListener("click", async (e) => {
        const actionBtn = e.target.closest("[data-book-action]");
        if (actionBtn) {
          if (!isAuthorizedProvider()) {
            if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
            return;
          }
          const newStatus = actionBtn.getAttribute("data-book-action");
          const targetId = actionBtn.getAttribute("data-book-id");
          const booking = providerBookings.find((b) => String(b.id) === String(targetId));
          if (!booking) return;

          if ((newStatus === "confirmed" || newStatus === "active") && hasConflictingBooking(booking)) {
            showFeedback(
              "bookingActionFeedback",
              `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Conflict Blocked:</strong> Another confirmed or active booking already exists for <strong>${escapeHtml(booking.vehicle_name)}</strong> during ${escapeHtml(booking.pickup_at || booking.pickup_date)} – ${escapeHtml(booking.return_at || booking.return_date)}.`,
              true
            );
            return;
          }

          let actualReturnIso = null;
          let lateFee = Number(booking.late_return_fee || 0);

          if (newStatus === "completed") {
            const defaultReturn = `${booking.return_date || "2026-11-05"}T10:00`;
            const entered = window.prompt(
              "Enter actual return timestamp (YYYY-MM-DDTHH:mm) to verify on-time or late return (1-hour free grace period applies):",
              defaultReturn
            );
            if (!entered) return;
            actualReturnIso = entered.trim();

            if (window.DrivoraPricing && typeof window.DrivoraPricing.calculateBookingBreakdown === "function") {
              const calc = window.DrivoraPricing.calculateBookingBreakdown({
                dailyRate: Number(booking.daily_rate || 2500),
                securityDeposit: Number(booking.security_deposit || 5000),
                pickupAt: booking.pickup_at || booking.pickup_date,
                returnAt: booking.return_at || booking.return_date,
                actualReturnAt: actualReturnIso,
              });
              if (calc.valid) {
                lateFee = calc.lateReturnFee;
                booking.late_return_hours = calc.lateBillableHours;
                booking.lateHours = calc.lateBillableHours;
                booking.late_return_fee = calc.lateReturnFee;
                booking.lateFeeAmount = calc.lateReturnFee;
                booking.rental_subtotal = calc.rentalSubtotal;
                booking.totalAmount = calc.rentalSubtotal;
                booking.total_payable = calc.totalPayable;
              }
            }
          }

          booking.status = newStatus;
          booking.bookingStatus = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
          if (actualReturnIso) booking.actual_return_at = actualReturnIso;

          try {
            await fetch("/api/bookings", {
              method: "PATCH",
              headers: getAuthHeaders(),
              body: JSON.stringify({
                id: booking.id,
                status: newStatus,
                actual_return_at: actualReturnIso,
              }),
            });
          } catch (err) {
            // fallback
          }

          writeLocalJson(LOCAL_BOOKINGS_KEY, providerBookings);
          writeLocalJson(LOCAL_BOOKINGS_ALT_KEY, providerBookings);
          if (window.DrivoraAuth && typeof window.DrivoraAuth.addNotification === "function") {
            window.DrivoraAuth.addNotification({
              title: `Booking ${booking.bookingStatus}: ${booking.vehicle_name}`,
              message: `Reservation ${booking.id} is now ${booking.bookingStatus}${lateFee > 0 ? ` (Late fee ₹${lateFee})` : ""}.`,
              bookingCode: booking.id,
            });
          }
          showFeedback(
            "bookingActionFeedback",
            `Booking for <strong>${escapeHtml(booking.vehicle_name)}</strong> updated to <strong>${escapeHtml(newStatus.toUpperCase())}</strong>${lateFee > 0 ? ` (Late return fee applied: ₹${lateFee.toLocaleString("en-IN")})` : ""}.`
          );
          await loadDashboardData();
          return;
        }

        const inspectBtn = e.target.closest("[data-book-inspect]");
        if (inspectBtn) {
          const bId = inspectBtn.getAttribute("data-book-inspect");
          const inspTabBtn = document.querySelector('.provider-tab-btn[data-tab="inspections"]');
          if (inspTabBtn) inspTabBtn.click();
          const input = document.getElementById("inspBookingId");
          if (input) {
            input.value = bId;
            input.focus();
          }
          return;
        }

        const invoiceBtn = e.target.closest("[data-book-invoice]");
        if (invoiceBtn) {
          const targetId = invoiceBtn.getAttribute("data-book-invoice");
          const b = providerBookings.find((item) => String(item.id) === String(targetId));
          if (b && window.DrivoraAuth && typeof window.DrivoraAuth.openInvoiceWindow === "function") {
            window.DrivoraAuth.openInvoiceWindow(b);
          }
        }
      });
    }

    // Inquiries reply handler
    const inqBody = document.getElementById("providerInquiriesTableBody");
    if (inqBody) {
      inqBody.addEventListener("click", async (e) => {
        const replyBtn = e.target.closest("[data-reply-inq]");
        if (!replyBtn) return;
        if (!isAuthorizedProvider()) {
          if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
          return;
        }
        const idx = Number(replyBtn.getAttribute("data-reply-inq"));
        const inq = providerInquiries[idx];
        if (!inq) return;

        const reply = window.prompt(
          `Reply to ${inq.customer_name || "Customer"}'s inquiry about ${inq.vehicle_name || "vehicle"}:`,
          inq.provider_response || "Yes, the vehicle is sanitized, insured, and available at our public pickup hub."
        );
        if (!reply || !reply.trim()) return;

        inq.provider_response = reply.trim();
        inq.providerResponse = reply.trim();
        inq.status = "responded";
        inq.inquiryStatus = "responded";
        inq.responded_at = new Date().toISOString();

        try {
          await fetch("/api/inquiries", {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              id: inq.id,
              provider_response: inq.provider_response,
              status: "responded",
            }),
          });
        } catch (err) {
          // local fallback
        }

        writeLocalJson(LOCAL_INQUIRIES_KEY, providerInquiries);
        writeLocalJson(LOCAL_INQUIRIES_ALT_KEY, providerInquiries);
        renderKpis();
        renderInquiriesTable();
      });
    }
  }

  function bindInspectionForm() {
    const form = document.getElementById("inspectionForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!isAuthorizedProvider()) {
        showFeedback("inspFeedback", "Sign in as a Provider or Administrator to log vehicle condition inspections.", true);
        return;
      }

      const bookingId = document.getElementById("inspBookingId").value.trim();
      const inspectionType = document.getElementById("inspType").value;
      const odometerKm = Number(document.getElementById("inspOdometer").value);
      const fuelPercent = Number(document.getElementById("inspFuel").value);
      const estimatedDamageCost = Number(document.getElementById("inspDamageCost").value || 0);
      const photoUrls = document
        .getElementById("inspPhotoUrls")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const conditionNotes = document.getElementById("inspConditionNotes").value.trim();
      const newDamageReported = document.getElementById("inspDamageReport").value.trim();
      const customerAcknowledged = document.getElementById("inspCustomerAck").checked;
      const disputeFlagged = document.getElementById("inspDisputeFlag").checked;

      if (!bookingId || !conditionNotes) {
        showFeedback("inspFeedback", "Booking ID and condition notes are required.", true);
        return;
      }

      const record = {
        id: `insp-${Date.now()}`,
        action: "record_inspection",
        booking_id: bookingId,
        inspection_type: inspectionType,
        odometer_km: odometerKm,
        fuel_or_battery_percent: fuelPercent,
        condition_notes: conditionNotes,
        new_damage_reported: newDamageReported,
        estimated_damage_cost: estimatedDamageCost,
        photo_urls: photoUrls,
        customer_acknowledged: customerAcknowledged,
        dispute_flagged: disputeFlagged,
        created_at: new Date().toISOString(),
      };

      try {
        await fetch("/api/bookings", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(record),
        });
      } catch (err) {
        // local fallback
      }

      providerInspections.unshift(record);
      writeLocalJson(LOCAL_INSPECTIONS_KEY, providerInspections);
      showFeedback(
        "inspFeedback",
        `Condition report (${escapeHtml(inspectionType.toUpperCase())}) saved for Booking <strong>${escapeHtml(bookingId)}</strong>.`
      );
      form.reset();
      renderInspectionsTable();
    });
  }

  function bindKycForm() {
    const resSelect = document.getElementById("kycResidencyType");
    const nriFields = document.getElementById("kycNriFields");
    const form = document.getElementById("providerKycForm");

    if (resSelect && nriFields) {
      resSelect.addEventListener("change", () => {
        nriFields.style.display = resSelect.value === "nri_international" ? "grid" : "none";
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        const residencyType = document.getElementById("kycResidencyType").value;
        const businessName = document.getElementById("kycBusinessName").value.trim();
        const docType = document.getElementById("kycDocType").value;
        const docLast4 = document.getElementById("kycDocLast4").value.trim();
        const licenceNumber = document.getElementById("kycLicenceNumber").value.trim();
        const licenceExpiry = document.getElementById("kycLicenceExpiry").value;
        const passportCountry = document.getElementById("kycPassportCountry")?.value.trim() || "";
        const visaOciRef = document.getElementById("kycVisaOciRef")?.value.trim() || "";
        const idpRef = document.getElementById("kycIdpRef")?.value.trim() || "";

        if (!businessName || !/^[A-Za-z0-9]{4}$/.test(docLast4) || !licenceNumber || !licenceExpiry) {
          showFeedback("kycSubmitFeedback", "Please complete all required KYC fields (Document number must be strictly last 4 characters).", true);
          return;
        }
        if (new Date(licenceExpiry) <= new Date()) {
          showFeedback("kycSubmitFeedback", "Document expiry date must be in the future.", true);
          return;
        }
        if (residencyType === "nri_international" && (!passportCountry || !visaOciRef)) {
          showFeedback("kycSubmitFeedback", "NRI / International applicants must provide Passport Issuing Country and Visa/OCI reference.", true);
          return;
        }

        const record = {
          id: `kyc-${Date.now()}`,
          user_id: user ? user.id : "guest-provider",
          applicant_name: user ? user.fullName || user.full_name || user.email : businessName,
          business_name: businessName,
          role_target: "provider",
          residency_type: residencyType,
          document_type: docType,
          document_number_last4: docLast4,
          driving_licence_number: licenceNumber,
          licence_expiry_date: licenceExpiry,
          passport_country: passportCountry || null,
          visa_or_oci_reference: visaOciRef || null,
          idp_number: idpRef || null,
          status: "pending",
          created_at: new Date().toISOString(),
        };

        try {
          await fetch("/api/marketplace?action=verification", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(record),
          });
        } catch (err) {
          // local fallback
        }

        const list = readLocalJson(LOCAL_KYC_KEY, []);
        list.unshift(record);
        writeLocalJson(LOCAL_KYC_KEY, list);

        showFeedback(
          "kycSubmitFeedback",
          `<i class="fa-solid fa-circle-check"></i> Verification dossier submitted with status <strong>PENDING ADMIN REVIEW</strong>. Self-approval is disabled; an Administrator must verify your submission in the Admin Dashboard.`
        );
        form.reset();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindTabs();
    bindVehicleForm();
    bindTableDelegation();
    bindInspectionForm();
    bindKycForm();

    const signInBtn = document.getElementById("btnProviderSignIn");
    if (signInBtn) {
      signInBtn.addEventListener("click", () => {
        if (window.DrivoraAuth) window.DrivoraAuth.openAuthModal("login");
      });
    }

    const fleetSearch = document.getElementById("fleetSearchInput");
    if (fleetSearch) fleetSearch.addEventListener("input", renderFleetTable);

    const statusFilter = document.getElementById("bookingStatusFilter");
    if (statusFilter) statusFilter.addEventListener("change", renderBookingsTable);

    window.addEventListener("drivora:auth-changed", () => {
      loadDashboardData();
    });

    loadDashboardData();
  });
})();
