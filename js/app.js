/**
 * Shared Drivora Marketplace Bootstrap (js/app.js)
 * Loaded on every page. Provides:
 * - Smooth anchor scrolling & scrollToTop()
 * - Automatic injection of css/marketplace.css and js/pricing.js
 * - Supabase Auth session management (Customer, Provider, Admin login/signup/reset/logout)
 * - Role-aware navigation bar & In-App Notifications drawer
 * - Guest favourites migration to Supabase upon login
 * - Official Printable / Downloadable Invoice & Estimate Generator
 */
(function () {
  // Ensure marketplace.css is loaded on every page
  if (!document.querySelector('link[href*="marketplace.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./css/marketplace.css";
    document.head.appendChild(link);
  }

  // Ensure pricing.js is loaded on every page
  if (!window.DrivoraPricing && !document.querySelector('script[src*="pricing.js"]')) {
    const script = document.createElement("script");
    script.src = "./js/pricing.js";
    document.head.appendChild(script);
  }

  const AUTH_STORAGE_KEY = "drivora-auth-session";
  const NOTIF_STORAGE_KEY = "drivora-notifications";

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setSession(session) {
    if (!session) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    }
    document.dispatchEvent(new CustomEvent("drivora:auth-changed", { detail: session }));
    window.dispatchEvent(new CustomEvent("drivora:auth-changed", { detail: session }));
  }

  function getAuthHeaders() {
    const s = getSession();
    const headers = { "Content-Type": "application/json" };
    if (s?.accessToken) {
      headers.Authorization = `Bearer ${s.accessToken}`;
    }
    return headers;
  }

  function addNotification({ title, message, type = "info", bookingCode = null }) {
    try {
      const list = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]");
      list.unshift({
        id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        message,
        type,
        bookingCode,
        isRead: false,
        deliveryMode: "In-App Notification (Email provider not configured)",
        createdAt: new Date().toISOString()
      });
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
      updateNavbarUI();
    } catch {}
  }

  async function migrateGuestWishlist() {
    const s = getSession();
    if (!s?.accessToken) return;
    try {
      const localList = JSON.parse(localStorage.getItem("drivora-wishlist") || "[]");
      if (Array.isArray(localList) && localList.length > 0) {
        const res = await fetch("/api/vehicles?resource=favourites", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ vehicleIds: localList })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.favourites)) {
            const merged = [...new Set([...localList, ...data.favourites])];
            localStorage.setItem("drivora-wishlist", JSON.stringify(merged));
          }
        }
      }
    } catch {}
  }

  // Printable / Downloadable Invoice & Estimate Generator
  function openInvoiceWindow(booking) {
    if (!booking) return;
    const isPaid = booking.paymentStatus === "paid" || booking.payment_status === "paid";
    const docTitle = isPaid ? "OFFICIAL TAX INVOICE & RECEIPT" : "BOOKING ESTIMATE & RESERVATION VOUCHER (UNPAID)";
    const badgeColor = isPaid ? "#166534" : "#92400e";
    const badgeBg = isPaid ? "#dcfce7" : "#fef3c7";
    const bookingId = booking.id || booking.booking_code || "DRV-REF";
    const customerName = booking.name || booking.customer_name || "Customer";
    const email = booking.email || "—";
    const phone = booking.phone || "—";
    const vehicleName = booking.vehicle || "Vehicle";
    const modelYear = booking.modelYear || booking.model_year || "2024";
    const pickup = booking.pickup || booking.pickup_date || "—";
    const returnDate = booking.returnDate || booking.return_date || "—";
    const days = Number(booking.days) || 1;
    const dailyPrice = Number(booking.dailyPrice || booking.daily_price || 0);
    const baseAmount = Number(booking.baseRentalAmount || booking.base_rental_amount || days * dailyPrice);
    const extraHours = Number(booking.extraHours || booking.extra_hours || 0);
    const extraHourAmount = Number(booking.extraHourAmount || booking.extra_hour_amount || 0);
    const lateHours = Number(booking.lateHours || booking.late_hours || 0);
    const lateFeeAmount = Number(booking.lateFeeAmount || booking.late_fee_amount || 0);
    const deposit = Number(booking.securityDeposit || booking.security_deposit || 5000);
    const cancellationFee = Number(booking.cancellationFee || booking.cancellation_fee || 0);
    const rentalSubtotal = Number(booking.totalAmount || booking.total_amount || baseAmount + extraHourAmount + lateFeeAmount);
    const grandTotalWithDeposit = rentalSubtotal + deposit;

    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) {
      alert("Please allow pop-ups to view and print your Drivora Invoice/Estimate.");
      return;
    }

    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${docTitle} - ${bookingId}</title>
  <style>
    body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; margin: 2rem; line-height: 1.5; background: #f8fafc; }
    .sheet { max-width: 740px; margin: 0 auto; background: #fff; padding: 2.25rem; border-radius: 16px; border: 1px solid #cbd5e1; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .status-pill { display: inline-block; padding: 0.35rem 0.85rem; border-radius: 999px; font-weight: 800; font-size: 0.82rem; background: ${badgeBg}; color: ${badgeColor}; }
    table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; }
    th, td { padding: 0.7rem; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f1f5f9; font-weight: 700; }
    .right { text-align: right; }
    .total-row td { font-weight: 800; font-size: 1.05rem; background: #eff6ff; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; font-size: 0.92rem; }
    .print-bar { text-align: right; margin-bottom: 1rem; max-width: 740px; margin-inline: auto; }
    .btn { padding: 0.6rem 1.2rem; background: #2563eb; color: #fff; border: 0; border-radius: 999px; font-weight: 700; cursor: pointer; }
    @media print { .print-bar { display: none; } body { background: #fff; margin: 0; } .sheet { box-shadow: none; border: 0; } }
  </style>
</head>
<body>
  <div class="print-bar"><button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button></div>
  <div class="sheet">
    <div class="top">
      <div>
        <h1 style="margin:0;color:#2563eb;">DRIVORA</h1>
        <p style="margin:0.2rem 0 0;color:#475569;font-size:0.9rem;">Vehicle Rental Marketplace • Jaipur, Delhi &amp; Mumbai</p>
        <p style="margin:0.15rem 0 0;font-weight:700;font-size:0.95rem;">${docTitle}</p>
      </div>
      <div style="text-align:right;">
        <span class="status-pill">Payment Status: ${isPaid ? "PAID" : "UNPAID (PAY AT PICKUP)"}</span>
        <p style="margin:0.5rem 0 0;font-size:0.88rem;"><strong>Booking Ref:</strong> ${bookingId}</p>
        <p style="margin:0.1rem 0 0;font-size:0.85rem;color:#64748b;">Issued: ${new Date(booking.createdAt || booking.created_at || Date.now()).toLocaleString("en-IN")}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <strong>Customer Details</strong><br>
        Name: ${customerName}<br>
        Email: ${email}<br>
        Phone: ${phone}<br>
        Category: ${(booking.customerType || booking.customer_type) === "nri" ? "NRI Customer" : "Indian Resident"}<br>
        KYC Status: ${booking.kycStatus || booking.kyc_status || "Pending Verification"}
      </div>
      <div>
        <strong>Vehicle &amp; Rental Schedule</strong><br>
        Vehicle: ${vehicleName} (${modelYear})<br>
        Pickup Date: ${pickup} (${booking.pickupTime || booking.pickup_time || "10:00"})<br>
        Return Date: ${returnDate} (${booking.returnTime || booking.return_time || "10:00"})<br>
        Booking Status: ${booking.bookingStatus || booking.booking_status || "Pending"}
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Charge Description</th><th>Rate / Rule</th><th class="right">Amount (INR)</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Base Vehicle Rental (${days} day${days === 1 ? "" : "s"})</td>
          <td>₹${dailyPrice.toLocaleString("en-IN")}/day (Locked Agreed Rate)</td>
          <td class="right">₹${baseAmount.toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td>Scheduled Extra Hours (${extraHours} hr${extraHours === 1 ? "" : "s"})</td>
          <td>Rounded to 1h interval (Capped at 1-day rate)</td>
          <td class="right">₹${extraHourAmount.toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td>Late-Return Fee (${lateHours} billable hr${lateHours === 1 ? "" : "s"})</td>
          <td>1-hour free grace period; post-grace overrun only</td>
          <td class="right">₹${lateFeeAmount.toLocaleString("en-IN")}</td>
        </tr>
        ${cancellationFee > 0 ? `<tr><td>Cancellation Fee</td><td>Per Drivora Cancellation Policy</td><td class="right">₹${cancellationFee.toLocaleString("en-IN")}</td></tr>` : ""}
        <tr class="total-row">
          <td colspan="2">Finalized Rental Charges (Excl. Refundable Deposit)</td>
          <td class="right">₹${rentalSubtotal.toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td><strong>Refundable Security Deposit</strong> (Held Separately)</td>
          <td>Refunded after damage-free return inspection</td>
          <td class="right"><strong>₹${deposit.toLocaleString("en-IN")}</strong></td>
        </tr>
        <tr class="total-row">
          <td colspan="2">Total Estimated Payable at Pickup (Rental + Refundable Deposit)</td>
          <td class="right">₹${grandTotalWithDeposit.toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
    </table>

    <p style="font-size:0.82rem;color:#475569;margin-top:1.25rem;">
      <strong>Notice:</strong> This document reflects authoritative Drivora booking records. ${isPaid ? "Payment has been recorded." : "This is an unpaid booking estimate/voucher—no online payment gateway charge has been collected."} Accepted Terms Version: ${booking.acceptedTermsVersion || booking.accepted_terms_version || "v1.0-customer"}.
    </p>
  </div>
</body>
</html>`);
    win.document.close();
  }

  window.DrivoraAuth = {
    getSession,
    setSession,
    getAuthHeaders,
    addNotification,
    openAuthModal,
    openModal: openAuthModal,
    openInvoiceWindow
  };

  let authModalEl = null;

  function ensureAuthModal() {
    if (authModalEl) return authModalEl;
    authModalEl = document.createElement("div");
    authModalEl.id = "drivora-auth-modal";
    authModalEl.className = "booking-modal";
    authModalEl.hidden = true;
    authModalEl.setAttribute("aria-hidden", "true");
    authModalEl.innerHTML = `
      <div class="booking-modal__backdrop" data-close-auth></div>
      <section class="booking-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button class="booking-modal__close" type="button" aria-label="Close authentication modal" data-close-auth>&times;</button>
        <p class="hero-badge">Supabase Account &amp; Role Portal</p>
        <h2 id="auth-modal-title">Sign In to Drivora</h2>
        <div class="action-btn-group" style="margin-bottom:1rem;">
          <button type="button" class="btn-xs btn-xs--primary" data-auth-tab="login">Sign In</button>
          <button type="button" class="btn-xs" data-auth-tab="signup">Create Account</button>
          <button type="button" class="btn-xs" data-auth-tab="reset">Reset Password</button>
          <button type="button" class="btn-xs" data-auth-tab="bookings">My Bookings &amp; Invoices</button>
        </div>
        <div id="auth-modal-body"></div>
      </section>
    `;
    document.body.appendChild(authModalEl);

    authModalEl.querySelectorAll("[data-close-auth]").forEach((btn) =>
      btn.addEventListener("click", () => {
        authModalEl.hidden = true;
        authModalEl.setAttribute("aria-hidden", "true");
      })
    );

    authModalEl.querySelectorAll("[data-auth-tab]").forEach((btn) =>
      btn.addEventListener("click", () => renderAuthTab(btn.dataset.authTab))
    );

    return authModalEl;
  }

  function renderAuthTab(tab = "login") {
    ensureAuthModal();
    authModalEl.querySelectorAll("[data-auth-tab]").forEach((b) => {
      b.classList.toggle("btn-xs--primary", b.dataset.authTab === tab);
    });
    const body = authModalEl.querySelector("#auth-modal-body");
    const session = getSession();

    if (tab === "bookings") {
      const bookings = JSON.parse(localStorage.getItem("drivora-bookings") || "[]");
      const notifs = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]");
      body.innerHTML = `
        <div style="display:grid;gap:0.85rem;">
          ${
            session
              ? `<div class="booking-summary-card"><strong>Signed in as:</strong> ${session.user.fullName} (${session.user.email}) — <span style="text-transform:uppercase;color:var(--primary);font-weight:800;">${session.user.role}</span>
                 <div class="action-btn-group" style="margin-top:0.6rem;">
                   <a href="./provider-dashboard.html" class="btn-xs btn-xs--primary">Provider Dashboard</a>
                   <a href="./admin-dashboard.html" class="btn-xs">Admin Console</a>
                   <button type="button" id="auth-logout-btn" class="btn-xs btn-xs--reject">Sign Out</button>
                 </div></div>`
              : `<p class="kyc-note">Sign in above to sync your bookings and favourites across devices.</p>`
          }
          <h3>Your Recent Bookings (${bookings.length})</h3>
          ${
            bookings.length === 0
              ? `<p class="kyc-note">No bookings recorded yet. Browse vehicles to reserve your ride.</p>`
              : bookings
                  .slice()
                  .reverse()
                  .map(
                    (b) => `
                <div class="review" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
                  <div>
                    <strong>${b.vehicle} (${b.id || b.booking_code})</strong>
                    <p style="font-size:0.84rem;color:#475569;">${b.pickup} → ${b.returnDate} • ₹${Number(b.totalAmount || 0).toLocaleString("en-IN")} + ₹${Number(b.securityDeposit || 5000).toLocaleString("en-IN")} deposit</p>
                    <small class="kyc-note">Status: <strong>${b.bookingStatus || "Pending"}</strong> | KYC: ${b.kycStatus || "Pending Verification"}</small>
                  </div>
                  <div class="action-btn-group">
                    <button type="button" class="btn-xs btn-xs--primary" data-invoice-id="${b.id}">📄 Invoice / Estimate</button>
                    ${
                      b.bookingStatus !== "Cancelled" && b.bookingStatus !== "Completed"
                        ? `<button type="button" class="btn-xs btn-xs--reject" data-cancel-id="${b.id}">Cancel</button>`
                        : ""
                    }
                  </div>
                </div>`
                  )
                  .join("")
          }
          <h3>Notifications (${notifs.length})</h3>
          ${
            notifs.length === 0
              ? `<p class="kyc-note">No notifications yet.</p>`
              : notifs
                  .slice(0, 6)
                  .map(
                    (n) => `<div class="review"><strong>${n.title}</strong><p style="font-size:0.85rem;">${n.message}</p><small class="kyc-note">${new Date(n.createdAt).toLocaleString("en-IN")} • ${n.deliveryMode}</small></div>`
                  )
                  .join("")
          }
        </div>
      `;

      body.querySelector("#auth-logout-btn")?.addEventListener("click", async () => {
        try {
          await fetch("/api/marketplace?action=auth", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ authOperation: "logout" })
          });
        } catch {}
        setSession(null);
        updateNavbarUI();
        renderAuthTab("login");
      });

      body.querySelectorAll("[data-invoice-id]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const b = bookings.find((item) => item.id === btn.dataset.invoiceId);
          if (b) openInvoiceWindow(b);
        })
      );

      body.querySelectorAll("[data-cancel-id]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const all = JSON.parse(localStorage.getItem("drivora-bookings") || "[]");
          const target = all.find((item) => item.id === btn.dataset.cancelId);
          if (!target) return;
          const calc = window.DrivoraPricing
            ? window.DrivoraPricing.calculateCancellationFee({
                dailyPrice: target.dailyPrice,
                pickupDate: target.pickup
              })
            : { fee: 0, policyApplied: "Standard policy" };
          target.bookingStatus = "Cancelled";
          target.cancellationFee = calc.fee;
          localStorage.setItem("drivora-bookings", JSON.stringify(all));
          fetch("/api/bookings", {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              bookingCode: target.id,
              newStatus: "Cancelled",
              reason: calc.policyApplied
            })
          }).catch(() => {});
          addNotification({
            title: `Booking ${target.id} Cancelled`,
            message: `${target.vehicle} reservation cancelled. Cancellation fee: ₹${calc.fee} (${calc.policyApplied}).`,
            type: "warning",
            bookingCode: target.id
          });
          renderAuthTab("bookings");
        })
      );
      return;
    }

    if (tab === "reset") {
      body.innerHTML = `
        <form id="supabase-reset-form">
          <label for="reset-email">Account Email</label>
          <input id="reset-email" name="email" type="email" required placeholder="you@example.com">
          <p id="reset-msg" class="kyc-note" role="status"></p>
          <button type="submit" class="btn btn-primary" style="margin-top:0.5rem;">Send Recovery Email</button>
        </form>
      `;
      body.querySelector("#supabase-reset-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = body.querySelector("#reset-email").value.trim();
        const msg = body.querySelector("#reset-msg");
        msg.textContent = "Requesting password reset from Supabase Auth...";
        try {
          const res = await fetch("/api/marketplace?action=auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authOperation: "recover", email })
          });
          const data = await res.json();
          msg.textContent = data.message || data.error || "Recovery request processed.";
        } catch {
          msg.textContent = "Recovery link requested. Check your configured Supabase Auth email inbox.";
        }
      });
      return;
    }

    if (tab === "signup") {
      body.innerHTML = `
        <form id="supabase-signup-form">
          <label for="signup-name">Full Name</label>
          <input id="signup-name" name="fullName" type="text" required placeholder="Your full name">
          <label for="signup-email">Email</label>
          <input id="signup-email" name="email" type="email" required placeholder="you@example.com">
          <label for="signup-phone">10-Digit Mobile Number</label>
          <input id="signup-phone" name="phone" type="tel" inputmode="numeric" required placeholder="9876543210">
          <label for="signup-password">Password (min 6 chars)</label>
          <input id="signup-password" name="password" type="password" required minlength="6">
          <label for="signup-role">Account Type</label>
          <select id="signup-role" name="requestedRole">
            <option value="customer">Customer (Book &amp; Review Vehicles)</option>
            <option value="provider">Vehicle Provider / Shopkeeper (List &amp; Manage Fleet)</option>
          </select>
          <div id="provider-extra-fields" hidden style="display:grid;gap:0.5rem;margin-top:0.4rem;">
            <label for="signup-business">Provider / Fleet Business Name</label>
            <input id="signup-business" name="businessName" type="text" placeholder="e.g. Rajputana Luxury Fleet">
            <label for="signup-city">Operating City</label>
            <select id="signup-city" name="city"><option>Jaipur</option><option>Delhi</option><option>Mumbai</option><option>Bengaluru</option><option>Udaipur</option></select>
          </div>
          <label class="terms-checkbox-row">
            <input type="checkbox" id="signup-terms" required>
            <span>I accept the <a href="./terms.html" target="_blank" style="color:var(--primary);font-weight:700;">Drivora Customer &amp; Provider Terms (v1.0)</a>.</span>
          </label>
          <p id="signup-error" class="booking-error" role="alert"></p>
          <button type="submit" class="btn btn-primary">Register with Supabase Auth</button>
        </form>
      `;

      const roleSelect = body.querySelector("#signup-role");
      const extra = body.querySelector("#provider-extra-fields");
      roleSelect.addEventListener("change", () => {
        extra.hidden = roleSelect.value !== "provider";
      });

      body.querySelector("#supabase-signup-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = body.querySelector("#signup-error");
        errEl.textContent = "";
        const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
        if (!/^\d{10}$/.test(fd.phone.trim())) {
          errEl.textContent = "Enter a valid 10-digit mobile number.";
          return;
        }
        try {
          const res = await fetch("/api/marketplace?action=auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authOperation: "signup", ...fd })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.error || "Registration failed.");
          }
          const newSession = {
            accessToken: data.session?.access_token || null,
            user: data.user
          };
          setSession(newSession);
          await migrateGuestWishlist();
          addNotification({
            title: "Welcome to Drivora!",
            message: `Registered as ${data.user.role} (${data.user.email}).`,
            type: "success"
          });
          updateNavbarUI();
          renderAuthTab("bookings");
        } catch (err) {
          errEl.textContent = err.message;
        }
      });
      return;
    }

    // Default tab: Login
    body.innerHTML = `
      <form id="supabase-login-form">
        <label for="login-email">Email</label>
        <input id="login-email" name="email" type="email" required placeholder="you@example.com">
        <label for="login-password">Password</label>
        <input id="login-password" name="password" type="password" required placeholder="••••••••">
        <p id="login-error" class="booking-error" role="alert"></p>
        <button type="submit" class="btn btn-primary">Sign In</button>
      </form>
      <div style="margin-top:1.1rem;padding-top:0.9rem;border-top:1px solid var(--glass-border);">
        <p class="kyc-note" style="margin-bottom:0.45rem;"><strong>Quick Portal Navigation:</strong></p>
        <div class="action-btn-group">
          <a href="./provider-dashboard.html" class="btn-xs">🚗 Provider Dashboard</a>
          <a href="./admin-dashboard.html" class="btn-xs">🛡 Admin Dashboard</a>
          <a href="./terms.html" class="btn-xs">📜 Terms &amp; Policies</a>
        </div>
      </div>
    `;

    body.querySelector("#supabase-login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = body.querySelector("#login-error");
      errEl.textContent = "";
      const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
      try {
        const res = await fetch("/api/marketplace?action=auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authOperation: "login", ...fd })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Invalid login credentials.");
        }
        setSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user
        });
        await migrateGuestWishlist();
        updateNavbarUI();
        renderAuthTab("bookings");
      } catch (err) {
        errEl.textContent = err.message;
      }
    });
  }

  function openAuthModal(defaultTab = "login") {
    ensureAuthModal();
    renderAuthTab(defaultTab);
    authModalEl.hidden = false;
    authModalEl.setAttribute("aria-hidden", "false");
  }

  function updateNavbarUI() {
    const navLinks = document.querySelector(".nav-links");
    if (!navLinks) return;

    // Add Provider & Admin Portal links if not already present
    if (!navLinks.querySelector('a[href*="provider-dashboard.html"]')) {
      const providerLi = document.createElement("li");
      providerLi.className = "nav-item";
      providerLi.innerHTML = `<a href="./provider-dashboard.html" class="nav-link">Provider Portal</a>`;
      const bookNowLi = navLinks.querySelector(".book-now")?.closest("li");
      if (bookNowLi) navLinks.insertBefore(providerLi, bookNowLi);
      else navLinks.appendChild(providerLi);
    }

    let portalLi = navLinks.querySelector("#nav-auth-item");
    if (!portalLi) {
      portalLi = document.createElement("li");
      portalLi.id = "nav-auth-item";
      portalLi.className = "nav-item nav-portal-group";
      navLinks.appendChild(portalLi);
    }

    const session = getSession();
    const notifs = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]");
    const unreadCount = notifs.filter((n) => !n.isRead).length;

    portalLi.innerHTML = `
      <button type="button" class="notif-bell-btn" id="nav-notif-btn" aria-label="View notifications and bookings" title="Notifications &amp; My Bookings">
        🔔${unreadCount > 0 ? `<span class="notif-count">${unreadCount}</span>` : ""}
      </button>
      <button type="button" class="nav-role-badge" id="nav-account-btn">
        ${session?.user ? `👤 ${session.user.fullName.split(" ")[0]} (${session.user.role})` : "🔑 Sign In"}
      </button>
    `;

    portalLi.querySelector("#nav-notif-btn").addEventListener("click", () => {
      try {
        const list = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]").map((n) => ({ ...n, isRead: true }));
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list));
        updateNavbarUI();
      } catch {}
      openAuthModal("bookings");
    });

    portalLi.querySelector("#nav-account-btn").addEventListener("click", () => {
      openAuthModal(session?.user ? "bookings" : "login");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    console.log("Drivora website loaded successfully!");

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    updateNavbarUI();
  });
})();

/** Scroll the current page back to its top. */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.scrollToTop = scrollToTop;
