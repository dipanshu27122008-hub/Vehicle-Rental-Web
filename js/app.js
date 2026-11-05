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

  let signInModalEl = null;
  let signUpModalEl = null;
  let resetModalEl = null;
  let accountModalEl = null;

  function closeAllAuthModals() {
    [signInModalEl, signUpModalEl, resetModalEl, accountModalEl].forEach((m) => {
      if (m) {
        m.hidden = true;
        m.setAttribute("aria-hidden", "true");
      }
    });
    try {
      document.body.style.overflow = "";
    } catch {}
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllAuthModals();
    });
  }

  function bindPasswordToggles(container) {
    container.querySelectorAll(".btn-toggle-pw").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = btn.parentElement.querySelector("input");
        if (!input) return;
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        btn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      });
    });
  }

  // =========================================================================
  // 1. DEDICATED SIGN IN POP-UP
  // =========================================================================
  function openSignInModal() {
    closeAllAuthModals();
    if (!signInModalEl) {
      signInModalEl = document.createElement("div");
      signInModalEl.id = "drivora-signin-modal";
      signInModalEl.className = "booking-modal";
      signInModalEl.hidden = true;
      signInModalEl.setAttribute("aria-hidden", "true");
      signInModalEl.innerHTML = `
        <div class="booking-modal__backdrop" data-close-auth></div>
        <section class="booking-modal__dialog auth-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="signin-modal-title">
          <button class="booking-modal__close" type="button" aria-label="Close sign in" data-close-auth>&times;</button>
          <div class="auth-header">
            <div class="auth-logo"><i class="fa-solid fa-arrow-right-to-bracket"></i></div>
            <h2 id="signin-modal-title">Sign In to Drivora</h2>
            <p>Access your bookings, favorites, or vehicle provider dashboard.</p>
          </div>
          <form id="dedicated-signin-form">
            <label for="signin-email">Email Address</label>
            <input id="signin-email" name="email" type="email" required placeholder="you@example.com" autocomplete="email">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.4rem;">
              <label for="signin-password" style="margin:0;">Password</label>
              <button type="button" id="signin-forgot-link" style="background:transparent;border:0;color:var(--primary);font-size:0.82rem;font-weight:700;cursor:pointer;padding:0;">Forgot Password?</button>
            </div>
            <div class="password-input-group">
              <input id="signin-password" name="password" type="password" required placeholder="Enter your password" autocomplete="current-password">
              <button type="button" class="btn-toggle-pw" aria-label="Show or hide password"><i class="fa-solid fa-eye"></i></button>
            </div>
            <label class="terms-checkbox-row" style="margin-top:0.6rem;display:flex;align-items:flex-start;gap:0.5rem;font-size:0.82rem;color:#475569;cursor:pointer;">
              <input type="checkbox" id="signin-terms" required checked style="margin-top:0.15rem;">
              <span>I accept the <a href="./terms.html" target="_blank" style="color:var(--primary);font-weight:700;">Terms &amp; Conditions</a> and Privacy Guidelines.</span>
            </label>
            <p id="signin-error" class="booking-error" role="alert" style="margin-top:0.4rem;"></p>
            <button type="submit" class="btn btn-primary" id="btn-submit-signin" style="width:100%;margin-top:0.6rem;padding:0.85rem;">
              <i class="fa-solid fa-lock"></i> Sign In
            </button>
          </form>
          <div class="auth-switch-footer">
            Don't have an account? <button type="button" id="switch-to-signup-btn"><strong>Create Account / Sign Up</strong></button>
            <div style="margin-top:0.65rem;font-size:0.8rem;color:#64748b;">
              🚗 Looking to list your fleet? <button type="button" id="switch-to-provider-signup" style="background:transparent;border:0;color:var(--primary);font-weight:700;cursor:pointer;padding:0;">Register as Provider</button>
            </div>
          </div>
        </section>
      `;
      document.body.appendChild(signInModalEl);

      signInModalEl.querySelectorAll("[data-close-auth]").forEach((btn) =>
        btn.addEventListener("click", closeAllAuthModals)
      );

      signInModalEl.querySelector("#switch-to-signup-btn").addEventListener("click", () => {
        openSignUpModal("customer");
      });

      signInModalEl.querySelector("#switch-to-provider-signup")?.addEventListener("click", () => {
        openSignUpModal("provider");
      });

      signInModalEl.querySelector("#signin-forgot-link").addEventListener("click", () => {
        openResetModal();
      });

      bindPasswordToggles(signInModalEl);

      signInModalEl.querySelector("#dedicated-signin-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = signInModalEl.querySelector("#signin-error");
        const submitBtn = signInModalEl.querySelector("#btn-submit-signin");
        errEl.textContent = "";

        const termsInput = signInModalEl.querySelector("#signin-terms");
        if (termsInput && !termsInput.checked) {
          errEl.textContent = "You must agree to the Terms & Conditions to sign in.";
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';

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
          closeAllAuthModals();
          addNotification({
            title: `Welcome Back, ${data.user.fullName || data.user.email}!`,
            message: `Signed in as ${data.user.role}.`,
            type: "success"
          });
          if (data.user.role === "provider" && !window.location.pathname.includes("provider-dashboard.html")) {
            if (confirm("Sign in successful! Would you like to open your Provider Portal now?")) {
              window.location.href = "./provider-dashboard.html";
            }
          }
        } catch (err) {
          errEl.textContent = err.message;
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Sign In';
        }
      });
    }

    signInModalEl.hidden = false;
    signInModalEl.setAttribute("aria-hidden", "false");
    try { document.body.style.overflow = "hidden"; } catch {}
    setTimeout(() => signInModalEl.querySelector("#signin-email")?.focus(), 50);
  }

  // =========================================================================
  // 2. DEDICATED SIGN UP POP-UP
  // =========================================================================
  function openSignUpModal(defaultRole = "customer") {
    closeAllAuthModals();
    if (!signUpModalEl) {
      signUpModalEl = document.createElement("div");
      signUpModalEl.id = "drivora-signup-modal";
      signUpModalEl.className = "booking-modal";
      signUpModalEl.hidden = true;
      signUpModalEl.setAttribute("aria-hidden", "true");
      signUpModalEl.innerHTML = `
        <div class="booking-modal__backdrop" data-close-auth></div>
        <section class="booking-modal__dialog auth-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="signup-modal-title">
          <button class="booking-modal__close" type="button" aria-label="Close registration" data-close-auth>&times;</button>
          <div class="auth-header">
            <div class="auth-logo"><i class="fa-solid fa-user-plus"></i></div>
            <h2 id="signup-modal-title">Create Your Account</h2>
            <p>Join Drivora to rent premium vehicles or list your fleet as a provider.</p>
          </div>

          <!-- Role Segmented Cards -->
          <div class="auth-role-switcher" role="radiogroup" aria-label="Account Role Type">
            <button type="button" class="auth-role-card active" data-role-choice="customer">
              <span class="role-icon">👤</span>
              <strong>Customer Account</strong>
              <small>Rent cars, bikes &amp; EVs</small>
            </button>
            <button type="button" class="auth-role-card" data-role-choice="provider">
              <span class="role-icon">🏢</span>
              <strong>Vehicle Provider</strong>
              <small>List fleet &amp; earn revenue</small>
            </button>
          </div>

          <form id="dedicated-signup-form">
            <input type="hidden" id="signup-selected-role" name="requestedRole" value="customer">
            
            <label for="signup-name">Full Legal Name *</label>
            <input id="signup-name" name="fullName" type="text" required placeholder="e.g. Rahul Sharma" autocomplete="name">

            <!-- Provider-only fields -->
            <div id="signup-provider-fields" style="display:none;margin-top:0.4rem;padding:0.75rem;background:rgba(239,246,255,0.7);border-radius:12px;border:1px solid rgba(191,219,254,0.8);">
              <label for="signup-business">Shop / Dealership Business Name *</label>
              <input id="signup-business" name="businessName" type="text" placeholder="e.g. Rajputana Luxury Mobility">
              <label for="signup-city" style="margin-top:0.5rem;">Operating City *</label>
              <select id="signup-city" name="city">
                <option value="Jaipur">Jaipur</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Delhi NCR">Delhi NCR</option>
                <option value="Bengaluru">Bengaluru</option>
                <option value="Pune">Pune</option>
                <option value="Hyderabad">Hyderabad</option>
                <option value="Chennai">Chennai</option>
                <option value="Ahmedabad">Ahmedabad</option>
                <option value="Udaipur">Udaipur</option>
              </select>
            </div>

            <label for="signup-email" style="margin-top:0.4rem;">Email Address *</label>
            <input id="signup-email" name="email" type="email" required placeholder="you@example.com" autocomplete="email">

            <label for="signup-phone">10-Digit Mobile Number *</label>
            <input id="signup-phone" name="phone" type="tel" inputmode="numeric" required placeholder="9876543210" autocomplete="tel">

            <label for="signup-password">Password (minimum 6 characters) *</label>
            <div class="password-input-group">
              <input id="signup-password" name="password" type="password" required minlength="6" placeholder="Choose a secure password" autocomplete="new-password">
              <button type="button" class="btn-toggle-pw" aria-label="Show or hide password"><i class="fa-solid fa-eye"></i></button>
            </div>

            <label class="terms-checkbox-row" style="margin-top:0.75rem;">
              <input type="checkbox" id="signup-terms" required checked>
              <span id="signup-terms-text">I accept the <a href="./terms.html" target="_blank" style="color:var(--primary);font-weight:700;">Terms &amp; Conditions</a> and Privacy Guidelines.</span>
            </label>

            <p id="signup-error" class="booking-error" role="alert" style="margin-top:0.35rem;"></p>
            <button type="submit" class="btn btn-primary" id="btn-submit-signup" style="width:100%;margin-top:0.6rem;padding:0.85rem;">
              <i class="fa-solid fa-check"></i> Complete Registration
            </button>
          </form>

          <div class="auth-switch-footer">
            Already have an account? <button type="button" id="switch-to-signin-btn"><strong>Sign In</strong></button>
          </div>
        </section>
      `;
      document.body.appendChild(signUpModalEl);

      signUpModalEl.querySelectorAll("[data-close-auth]").forEach((btn) =>
        btn.addEventListener("click", closeAllAuthModals)
      );

      signUpModalEl.querySelector("#switch-to-signin-btn").addEventListener("click", () => {
        openSignInModal();
      });

      bindPasswordToggles(signUpModalEl);

      const roleButtons = signUpModalEl.querySelectorAll("[data-role-choice]");
      const roleInput = signUpModalEl.querySelector("#signup-selected-role");
      const providerFields = signUpModalEl.querySelector("#signup-provider-fields");
      const businessInput = signUpModalEl.querySelector("#signup-business");

      roleButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const role = btn.getAttribute("data-role-choice");
          roleButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          roleInput.value = role;
          const termsLabel = signUpModalEl.querySelector("#signup-terms-text");
          if (role === "provider") {
            providerFields.style.display = "block";
            businessInput.required = true;
            if (termsLabel) {
              termsLabel.innerHTML = 'I accept the <a href="./terms.html?tab=provider" target="_blank" style="color:var(--primary);font-weight:700;">Provider Commercial Terms (v1.0)</a>, Marketplace Terms &amp; Conditions, and Privacy Guidelines.';
            }
          } else {
            providerFields.style.display = "none";
            businessInput.required = false;
            if (termsLabel) {
              termsLabel.innerHTML = 'I accept the <a href="./terms.html" target="_blank" style="color:var(--primary);font-weight:700;">Terms &amp; Conditions</a> and Privacy Guidelines.';
            }
          }
        });
      });

      signUpModalEl.querySelector("#dedicated-signup-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = signUpModalEl.querySelector("#signup-error");
        const submitBtn = signUpModalEl.querySelector("#btn-submit-signup");
        errEl.textContent = "";

        const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
        if (!/^\d{10}$/.test(String(fd.phone || "").trim())) {
          errEl.textContent = "Please enter a valid 10-digit mobile number.";
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering Account...';

        try {
          const res = await fetch("/api/marketplace?action=auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authOperation: "signup", ...fd })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.error || "Registration failed. Please verify your details.");
          }

          const newSession = {
            accessToken: data.session?.access_token || null,
            user: data.user
          };
          setSession(newSession);
          await migrateGuestWishlist();
          updateNavbarUI();
          closeAllAuthModals();

          addNotification({
            title: "Welcome to Drivora!",
            message: `Your ${data.user.role} account has been registered successfully.`,
            type: "success"
          });

          if (data.user.role === "provider") {
            alert("Provider account created! Redirecting you to your Provider Portal to start listing vehicles.");
            window.location.href = "./provider-dashboard.html";
          } else {
            alert("Registration successful! You are now signed in to Drivora.");
          }
        } catch (err) {
          errEl.textContent = err.message;
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Complete Registration';
        }
      });
    }

    // Set role choice
    const roleBtn = signUpModalEl.querySelector(`[data-role-choice="${defaultRole === 'provider' ? 'provider' : 'customer'}"]`);
    if (roleBtn) roleBtn.click();

    signUpModalEl.hidden = false;
    signUpModalEl.setAttribute("aria-hidden", "false");
    try { document.body.style.overflow = "hidden"; } catch {}
    setTimeout(() => signUpModalEl.querySelector("#signup-name")?.focus(), 50);
  }

  // =========================================================================
  // 3. DEDICATED PASSWORD RESET POP-UP
  // =========================================================================
  function openResetModal() {
    closeAllAuthModals();
    if (!resetModalEl) {
      resetModalEl = document.createElement("div");
      resetModalEl.id = "drivora-reset-modal";
      resetModalEl.className = "booking-modal";
      resetModalEl.hidden = true;
      resetModalEl.setAttribute("aria-hidden", "true");
      resetModalEl.innerHTML = `
        <div class="booking-modal__backdrop" data-close-auth></div>
        <section class="booking-modal__dialog auth-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
          <button class="booking-modal__close" type="button" aria-label="Close password reset" data-close-auth>&times;</button>
          <div class="auth-header">
            <div class="auth-logo"><i class="fa-solid fa-key"></i></div>
            <h2 id="reset-modal-title">Reset Password</h2>
            <p>Enter your registered account email to receive recovery instructions.</p>
          </div>
          <form id="dedicated-reset-form">
            <label for="reset-account-email">Account Email</label>
            <input id="reset-account-email" name="email" type="email" required placeholder="you@example.com" autocomplete="email">
            <p id="reset-status-msg" class="kyc-note" role="status" style="margin-top:0.4rem;"></p>
            <button type="submit" class="btn btn-primary" id="btn-submit-reset" style="width:100%;margin-top:0.6rem;padding:0.85rem;">
              Send Password Reset Link
            </button>
          </form>
          <div class="auth-switch-footer">
            <button type="button" id="reset-back-to-signin-btn"><strong>← Back to Sign In</strong></button>
          </div>
        </section>
      `;
      document.body.appendChild(resetModalEl);

      resetModalEl.querySelectorAll("[data-close-auth]").forEach((btn) =>
        btn.addEventListener("click", closeAllAuthModals)
      );

      resetModalEl.querySelector("#reset-back-to-signin-btn").addEventListener("click", () => {
        openSignInModal();
      });

      resetModalEl.querySelector("#dedicated-reset-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = resetModalEl.querySelector("#reset-account-email").value.trim();
        const msg = resetModalEl.querySelector("#reset-status-msg");
        const submitBtn = resetModalEl.querySelector("#btn-submit-reset");
        msg.textContent = "Requesting recovery link from Supabase Auth...";
        msg.style.color = "#475569";
        submitBtn.disabled = true;

        try {
          const res = await fetch("/api/marketplace?action=auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ authOperation: "recover", email })
          });
          const data = await res.json();
          msg.textContent = data.message || "If an account exists for this email, password recovery instructions have been sent.";
          msg.style.color = "#166534";
        } catch {
          msg.textContent = "Recovery instructions requested. Please check your email inbox.";
          msg.style.color = "#166534";
        } finally {
          submitBtn.disabled = false;
        }
      });
    }

    resetModalEl.hidden = false;
    resetModalEl.setAttribute("aria-hidden", "false");
    try { document.body.style.overflow = "hidden"; } catch {}
    setTimeout(() => resetModalEl.querySelector("#reset-account-email")?.focus(), 50);
  }

  // =========================================================================
  // 4. DEDICATED ACCOUNT, BOOKINGS & NOTIFICATIONS POP-UP
  // =========================================================================
  function openAccountModal() {
    closeAllAuthModals();
    const session = getSession();
    if (!session?.user) {
      openSignInModal();
      return;
    }

    if (!accountModalEl) {
      accountModalEl = document.createElement("div");
      accountModalEl.id = "drivora-account-modal";
      accountModalEl.className = "booking-modal";
      accountModalEl.hidden = true;
      accountModalEl.setAttribute("aria-hidden", "true");
      document.body.appendChild(accountModalEl);
    }

    const bookings = JSON.parse(localStorage.getItem("drivora-bookings") || "[]");
    const notifs = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]");
    const roleBadgeColor = session.user.role === "admin" ? "#b91c1c" : session.user.role === "provider" ? "#2563eb" : "#166534";

    accountModalEl.innerHTML = `
      <div class="booking-modal__backdrop" data-close-auth></div>
      <section class="booking-modal__dialog" style="width:min(100%, 640px);" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <button class="booking-modal__close" type="button" aria-label="Close account view" data-close-auth>&times;</button>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1.25rem;">
          <div>
            <h2 id="account-modal-title" style="margin:0;font-size:1.4rem;">👤 ${escapeHtml(session.user.fullName || session.user.email)}</h2>
            <p style="margin:0.2rem 0 0;font-size:0.86rem;color:#64748b;">${escapeHtml(session.user.email)} · <strong style="color:${roleBadgeColor};text-transform:uppercase;">${session.user.role}</strong></p>
          </div>
          <button type="button" id="btn-account-signout" class="btn-xs btn-xs--reject" style="padding:0.45rem 0.9rem;">
            <i class="fa-solid fa-power-off"></i> Sign Out
          </button>
        </div>

        <!-- Quick Portal Jump -->
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1.25rem;padding:0.75rem;background:rgba(255,255,255,0.7);border-radius:14px;border:1px solid var(--glass-border);">
          <a href="./vehicles.html" class="btn-xs"><i class="fa-solid fa-car"></i> Browse Vehicles</a>
          ${
            session.user.role === "provider" || session.user.role === "admin"
              ? `<a href="./provider-dashboard.html" class="btn-xs btn-xs--primary"><i class="fa-solid fa-warehouse"></i> Provider Portal</a>`
              : `<button type="button" class="btn-xs btn-xs--primary" id="btn-upgrade-provider"><i class="fa-solid fa-store"></i> Become a Provider</button>`
          }
          ${
            session.user.role === "admin"
              ? `<a href="./admin-dashboard.html" class="btn-xs"><i class="fa-solid fa-shield-halved"></i> Admin Console</a>`
              : ""
          }
        </div>

        <h3 style="margin-bottom:0.6rem;font-size:1.05rem;"><i class="fa-solid fa-receipt"></i> My Bookings &amp; Invoices (${bookings.length})</h3>
        <div style="display:grid;gap:0.75rem;max-height:240px;overflow-y:auto;padding-right:0.25rem;margin-bottom:1.25rem;">
          ${
            bookings.length === 0
              ? `<p class="kyc-note">No bookings recorded yet. Browse vehicles to reserve your ride.</p>`
              : bookings
                  .slice()
                  .reverse()
                  .map(
                    (b) => `
                <div class="review" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;padding:0.85rem;border-radius:12px;background:rgba(255,255,255,0.75);">
                  <div>
                    <strong>${escapeHtml(b.vehicle || b.vehicle_name)} (${escapeHtml(b.id || b.booking_code)})</strong>
                    <div style="font-size:0.82rem;color:#475569;">${escapeHtml(b.pickup || b.pickup_date)} → ${escapeHtml(b.returnDate || b.return_date)} • ₹${Number(b.totalAmount || 0).toLocaleString("en-IN")}</div>
                    <small class="kyc-note">Status: <strong>${escapeHtml(b.bookingStatus || b.status || "Pending")}</strong></small>
                  </div>
                  <div class="action-btn-group">
                    <button type="button" class="btn-xs btn-xs--primary" data-invoice-id="${escapeHtml(b.id || b.booking_code)}">
                      <i class="fa-solid fa-print"></i> Invoice
                    </button>
                    ${
                      b.bookingStatus !== "Cancelled" && b.status !== "cancelled" && b.status !== "completed"
                        ? `<button type="button" class="btn-xs btn-xs--reject" data-cancel-booking-id="${escapeHtml(b.id || b.booking_code)}">Cancel</button>`
                        : ""
                    }
                  </div>
                </div>`
                  )
                  .join("")
          }
        </div>

        <h3 style="margin-bottom:0.6rem;font-size:1.05rem;"><i class="fa-solid fa-bell"></i> Notifications</h3>
        <div style="display:grid;gap:0.55rem;max-height:160px;overflow-y:auto;">
          ${
            notifs.length === 0
              ? `<p class="kyc-note">No notifications yet.</p>`
              : notifs
                  .slice(0, 5)
                  .map(
                    (n) => `
                <div style="padding:0.6rem 0.8rem;border-radius:10px;background:rgba(255,255,255,0.65);border:1px solid rgba(148,163,184,0.25);font-size:0.84rem;">
                  <strong>${escapeHtml(n.title)}</strong>
                  <div style="color:#475569;margin-top:0.15rem;">${escapeHtml(n.message)}</div>
                </div>`
                  )
                  .join("")
          }
        </div>
      </section>
    `;

    accountModalEl.querySelectorAll("[data-close-auth]").forEach((btn) =>
      btn.addEventListener("click", closeAllAuthModals)
    );

    accountModalEl.querySelector("#btn-account-signout")?.addEventListener("click", async () => {
      try {
        await fetch("/api/marketplace?action=auth", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ authOperation: "logout" })
        });
      } catch {}
      setSession(null);
      updateNavbarUI();
      closeAllAuthModals();
      alert("You have been signed out.");
    });

    accountModalEl.querySelector("#btn-upgrade-provider")?.addEventListener("click", () => {
      closeAllAuthModals();
      openSignUpModal("provider");
    });

    accountModalEl.querySelectorAll("[data-invoice-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const b = bookings.find((item) => String(item.id || item.booking_code) === String(btn.dataset.invoiceId));
        if (b) openInvoiceWindow(b);
      });
    });

    accountModalEl.querySelectorAll("[data-cancel-booking-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const all = JSON.parse(localStorage.getItem("drivora-bookings") || "[]");
        const target = all.find((item) => String(item.id || item.booking_code) === String(btn.dataset.cancelBookingId));
        if (!target) return;
        if (!confirm(`Are you sure you want to cancel booking for ${target.vehicle}?`)) return;

        const calc = window.DrivoraPricing
          ? window.DrivoraPricing.calculateCancellationFee({
              dailyPrice: target.dailyPrice,
              pickupDate: target.pickup
            })
          : { fee: 0, policyApplied: "Standard policy" };

        target.bookingStatus = "Cancelled";
        target.status = "cancelled";
        target.cancellationFee = calc.fee;
        localStorage.setItem("drivora-bookings", JSON.stringify(all));

        try {
          await fetch("/api/bookings", {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              bookingCode: target.id || target.booking_code,
              newStatus: "Cancelled",
              reason: calc.policyApplied
            })
          });
        } catch {}

        addNotification({
          title: `Booking Cancelled: ${target.vehicle}`,
          message: `Cancellation fee: ₹${calc.fee} (${calc.policyApplied}).`,
          type: "warning",
          bookingCode: target.id
        });
        openAccountModal();
      });
    });

    accountModalEl.hidden = false;
    accountModalEl.setAttribute("aria-hidden", "false");
    try { document.body.style.overflow = "hidden"; } catch {}
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Backward compatibility router
  function openAuthModal(defaultTab = "login") {
    if (defaultTab === "signup") openSignUpModal();
    else if (defaultTab === "reset") openResetModal();
    else if (defaultTab === "bookings") openAccountModal();
    else openSignInModal();
  }

  window.DrivoraAuth = {
    getSession,
    setSession,
    getAuthHeaders,
    addNotification,
    openSignInModal,
    openSignUpModal,
    openResetModal,
    openAccountModal,
    openAuthModal,
    openModal: openAuthModal,
    openInvoiceWindow
  };

  // =========================================================================
  // 5. NAVBAR SYNCHRONIZATION WITH DEDICATED BUTTONS
  // =========================================================================
  function updateNavbarUI() {
    const navLinks = document.querySelector(".nav-links");
    if (!navLinks) return;

    const session = getSession();
    const isProvider = Boolean(session?.user && (session.user.role === "provider" || session.user.role === "admin"));
    const existingProviderLink = navLinks.querySelector('a[href*="provider-dashboard.html"]');

    // Display Provider Portal only after a provider logs in (not for all users)
    if (isProvider) {
      if (!existingProviderLink) {
        const providerLi = document.createElement("li");
        providerLi.className = "nav-item";
        providerLi.id = "nav-provider-portal-item";
        providerLi.innerHTML = `<a href="./provider-dashboard.html" class="nav-link">Provider Portal</a>`;
        const bookNowLi = navLinks.querySelector(".book-now")?.closest("li") || navLinks.querySelector("#nav-auth-item");
        if (bookNowLi) navLinks.insertBefore(providerLi, bookNowLi);
        else navLinks.appendChild(providerLi);
      }
    } else {
      // Remove Provider Portal link for non-providers and logged-out visitors
      if (existingProviderLink) {
        existingProviderLink.closest("li")?.remove();
      }
    }

    let portalLi = navLinks.querySelector("#nav-auth-item");
    if (!portalLi) {
      portalLi = document.createElement("li");
      portalLi.id = "nav-auth-item";
      portalLi.className = "nav-item nav-portal-group";
      navLinks.appendChild(portalLi);
    }

    const notifs = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]");
    const unreadCount = notifs.filter((n) => !n.isRead).length;

    if (!session?.user) {
      // Logged out: Dedicated Sign In and Sign Up buttons
      portalLi.innerHTML = `
        <div class="nav-auth-group">
          <button type="button" class="btn btn-secondary nav-auth-btn" id="nav-signin-btn">
            Sign In
          </button>
          <button type="button" class="btn btn-primary nav-auth-btn" id="nav-signup-btn">
            Sign Up
          </button>
        </div>
      `;

      portalLi.querySelector("#nav-signin-btn")?.addEventListener("click", () => {
        openSignInModal();
      });

      portalLi.querySelector("#nav-signup-btn")?.addEventListener("click", () => {
        openSignUpModal("customer");
      });
    } else {
      // Logged in: Profile badge, Notification Bell, and quick Sign Out
      const userFirstName = (session.user.fullName || session.user.email || "User").split(" ")[0];
      portalLi.innerHTML = `
        <div class="nav-auth-group">
          <button type="button" class="notif-bell-btn" id="nav-notif-btn" aria-label="Notifications" title="Notifications &amp; Bookings">
            🔔${unreadCount > 0 ? `<span class="notif-count">${unreadCount}</span>` : ""}
          </button>
          <button type="button" class="nav-role-badge" id="nav-account-btn" title="View Account &amp; Bookings">
            👤 ${escapeHtml(userFirstName)} (${escapeHtml(session.user.role)})
          </button>
          <button type="button" class="notif-bell-btn" id="nav-quick-signout-btn" aria-label="Sign Out" title="Sign Out" style="color:#ef4444;">
            <i class="fa-solid fa-power-off"></i>
          </button>
        </div>
      `;

      portalLi.querySelector("#nav-notif-btn")?.addEventListener("click", () => {
        try {
          const list = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]").map((n) => ({ ...n, isRead: true }));
          localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list));
        } catch {}
        openAccountModal();
      });

      portalLi.querySelector("#nav-account-btn")?.addEventListener("click", () => {
        openAccountModal();
      });

      portalLi.querySelector("#nav-quick-signout-btn")?.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to sign out?")) return;
        try {
          await fetch("/api/marketplace?action=auth", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ authOperation: "logout" })
          });
        } catch {}
        setSession(null);
        updateNavbarUI();
        closeAllAuthModals();
      });
    }
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
