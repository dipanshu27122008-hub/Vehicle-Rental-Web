document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("booking-modal"), form = document.getElementById("booking-form");
  if (!modal || !form) return;
  const catalog = window.vehicleCatalog || {}, emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, phonePattern = /^\d{10}$/;
  let selectedVehicle = "";
  let isSubmitting = false;

  const vehicleFor = (name) => Object.values(catalog).find((item) => item.name === name);
  const money = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  const formatDate = (value) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
  const statusText = { available: "🟢 Available", reserved: "🟡 Reserved", unavailable: "🔴 Unavailable" };
  const field = (id, label, control) => `<div class="booking-field"><label for="${id}">${label}</label>${control}<small class="field-error" id="${id}-error" aria-live="polite"></small></div>`;
  const input = (id, name, label, extra = "") => field(id, label, `<input id="${id}" name="${name}" ${extra} aria-describedby="${id}-error">`);
  const textarea = (id, name, label) => field(id, label, `<textarea id="${id}" name="${name}" required aria-describedby="${id}-error"></textarea>`);

  form.innerHTML = `
    <input id="booking-vehicle-input" name="vehicle" type="hidden">
    <input id="booking-model-year" name="modelYear" type="hidden">
    <section class="booking-summary-card" aria-live="polite">
      <h3>Itemized Pricing &amp; Booking Summary</h3>
      <dl id="booking-summary"></dl>
      <p class="kyc-note" style="margin-top:0.5rem;">
        <strong>Pricing Policy:</strong> Extra hours rounded up to 1h (capped at 1-day rate). 1-hour free return grace period; late fee applies only after grace period. Security deposit is 100% refundable after damage-free return inspection.
      </p>
    </section>
    <fieldset class="customer-type">
      <legend>Customer Verification Category</legend>
      <label><input type="radio" name="customerType" value="indian" checked> Indian Resident</label>
      <label><input type="radio" name="customerType" value="nri"> NRI / International Visitor</label>
    </fieldset>
    <p class="kyc-note">Only the last 4 digits of your ID are retained for verification audit. Documents are never publicly exposed.</p>
    <div class="booking-fields" id="booking-fields"></div>
    <div class="booking-date-row">
      ${field("pickup-date", "Pickup date", `<input id="pickup-date" name="pickup" type="date" required aria-describedby="pickup-date-error">`)}
      ${field("return-date", "Return date", `<input id="return-date" name="return" type="date" required aria-describedby="return-date-error">`)}
    </div>
    <div class="booking-date-row">
      ${field("pickup-time", "Pickup time", `<input id="pickup-time" name="pickupTime" type="time" value="10:00" required aria-describedby="pickup-time-error">`)}
      ${field("return-time", "Return time", `<input id="return-time" name="returnTime" type="time" value="10:00" required aria-describedby="return-time-error">`)}
    </div>
    <label class="terms-checkbox-row" for="booking-terms-consent">
      <input id="booking-terms-consent" name="termsAccepted" type="checkbox" required>
      <span>I accept the <a href="./terms.html" target="_blank" style="color:var(--primary);font-weight:700;">Customer Rental Terms (v1.0-customer)</a>, cancellation &amp; late-return policy, and consent to KYC identity verification.</span>
    </label>
    <small class="field-error" id="booking-terms-consent-error" aria-live="polite"></small>
    <p id="booking-error" class="booking-error" role="alert" aria-live="polite"></p>
    <button class="btn btn-primary" id="booking-submit-btn" type="submit">Confirm Booking Request</button>
  `;

  let confirmation = document.getElementById("booking-confirmation");
  if (!confirmation) {
    confirmation = document.createElement("section");
    confirmation.id = "booking-confirmation";
    confirmation.className = "booking-confirmation";
    confirmation.hidden = true;
    confirmation.setAttribute("role", "status");
    confirmation.setAttribute("aria-live", "polite");
    form.after(confirmation);
  } else if (confirmation.parentElement === form) {
    form.after(confirmation);
  }

  const fields = document.getElementById("booking-fields"),
    error = document.getElementById("booking-error"),
    summary = document.getElementById("booking-summary");

  const clearValidation = () => form.querySelectorAll(".field-error").forEach((item) => (item.textContent = ""));
  const setFieldError = (element, message) => {
    const target = document.getElementById(`${element.id}-error`);
    element.classList.toggle("is-invalid", Boolean(message));
    element.setAttribute("aria-invalid", String(Boolean(message)));
    if (target) target.textContent = message;
    return !message;
  };

  const renderFields = () => {
    const isNri = form.elements.customerType.value === "nri";
    fields.innerHTML = isNri
      ? `${input("booking-name", "name", "Full name", 'type="text" autocomplete="name" required')}${input("booking-phone", "phone", "Mobile number (10 digits)", 'type="tel" inputmode="numeric" required')}${input("booking-email", "email", "Email", 'type="email" autocomplete="email" required')}${input("passport-number", "passport", "Passport number", 'type="text" required')}${input("driving-authorisation", "drivingAuthorisation", "International Driving Permit / Authorisation", 'type="text" required')}${input("residence-country", "country", "Country of residence", 'type="text" required')}${textarea("overseas-address", "address", "Overseas address")}`
      : `${input("booking-name", "name", "Full name", 'type="text" autocomplete="name" required')}${input("booking-phone", "phone", "Mobile number (10 digits)", 'type="tel" inputmode="numeric" required')}${input("booking-email", "email", "Email", 'type="email" autocomplete="email" required')}${input("licence-number", "licence", "Driving licence number", 'type="text" required')}${field("government-id-type", "Government ID type", `<select id="government-id-type" name="governmentIdType" required aria-describedby="government-id-type-error"><option value="">Select ID type</option><option>Aadhaar</option><option>Voter ID</option><option>Passport</option></select>`)}${input("government-id-number", "governmentIdNumber", "Government ID number", 'type="text" required')}${textarea("customer-address", "address", "Residential address")}`;

    // Pre-fill from logged-in user session if available
    const session = window.DrivoraAuth?.getSession?.();
    if (session?.user) {
      if (form.elements.name && !form.elements.name.value) form.elements.name.value = session.user.fullName || "";
      if (form.elements.email && !form.elements.email.value) form.elements.email.value = session.user.email || "";
    }
  };

  const computeCurrentPricing = () => {
    const vehicle = vehicleFor(selectedVehicle);
    if (!vehicle) return null;
    const pickup = form.elements.pickup?.value;
    const returnDate = form.elements.return?.value;
    const pickupTime = form.elements.pickupTime?.value || "10:00";
    const returnTime = form.elements.returnTime?.value || "10:00";

    if (window.DrivoraPricing) {
      return window.DrivoraPricing.calculatePricing({
        dailyPrice: vehicle.price,
        extraHourRate: vehicle.extraHourRate,
        lateFeePerHour: vehicle.lateFeePerHour,
        securityDeposit: vehicle.securityDeposit || 5000,
        pickupDate: pickup,
        returnDate,
        pickupTime,
        returnTime
      });
    }

    const days = !pickup || !returnDate ? 0 : Math.max(0, Math.round((new Date(`${returnDate}T00:00:00`) - new Date(`${pickup}T00:00:00`)) / 86400000));
    const base = days * vehicle.price;
    const deposit = vehicle.securityDeposit || 5000;
    return {
      valid: days > 0,
      days,
      extraHours: 0,
      dailyPrice: vehicle.price,
      extraHourRate: vehicle.extraHourRate || Math.round(vehicle.price / 8),
      lateFeePerHour: vehicle.lateFeePerHour || Math.round(vehicle.price / 6),
      baseRentalAmount: base,
      extraHourAmount: 0,
      securityDeposit: deposit,
      rentalSubtotal: base,
      totalPayableWithDeposit: base + deposit
    };
  };

  const updateSummary = () => {
    const vehicle = vehicleFor(selectedVehicle);
    if (!vehicle) return;
    const calc = computeCurrentPricing();
    const customer = form.elements.customerType.value === "nri" ? "NRI / International" : "Indian Resident";
    const pickup = form.elements.pickup?.value;
    const returnDate = form.elements.return?.value;
    const dates = pickup && returnDate && calc?.valid ? `${formatDate(pickup)} (${form.elements.pickupTime?.value || "10:00"}) – ${formatDate(returnDate)} (${form.elements.returnTime?.value || "10:00"})` : "Select valid pickup & return dates";

    const rows = [
      ["Vehicle", `${vehicle.name} (${vehicle.modelYear})`],
      ["Pickup Hub", `${vehicle.publicHub || vehicle.city || "Jaipur"}`],
      ["Rental Schedule", dates],
      ["Billable Duration", calc?.valid ? `${calc.days} day${calc.days === 1 ? "" : "s"}${calc.extraHours ? ` + ${calc.extraHours} extra hr` : ""}` : "—"],
      ["Base Rental Rate", `${money(vehicle.price)}/day (Extra hr: ${money(calc?.extraHourRate)}/hr)`],
      ["Rental Charges (Excl. Deposit)", calc?.valid ? money(calc.rentalSubtotal) : "—"],
      ["Refundable Security Deposit", money(calc?.securityDeposit || 5000)],
      ["Total Payable at Pickup", calc?.valid ? `${money(calc.totalPayableWithDeposit)} (Unpaid Estimate)` : "—"],
      ["Late-Return Rule", `1h free grace; ${money(calc?.lateFeePerHour)}/hr thereafter`],
      ["Customer Category", customer]
    ];
    summary.innerHTML = rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
  };

  const close = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  };

  const open = (name) => {
    const vehicle = vehicleFor(name);
    if (!vehicle || vehicle.availability === "unavailable") return;
    selectedVehicle = name;
    form.reset();
    renderFields();
    clearValidation();
    error.textContent = "";
    confirmation.hidden = true;
    form.hidden = false;
    document.getElementById("booking-vehicle").textContent = name;
    form.elements.vehicle.value = name;
    form.elements.modelYear.value = vehicle.modelYear;
    updateSummary();
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("booking-name")?.focus();
  };

  window.openDrivoraBooking = open;

  const validate = () => {
    clearValidation();
    let firstInvalid;
    const check = (element, message) => {
      if (!element) return;
      if (!setFieldError(element, message) && !firstInvalid) firstInvalid = element;
    };
    fields.querySelectorAll("[required]").forEach((element) => check(element, element.value.trim() ? "" : "This field is required."));
    const { email, phone, pickup, return: returnDate, termsAccepted } = form.elements;
    if (email?.value && !emailPattern.test(email.value.trim())) check(email, "Enter a valid email address.");
    if (phone?.value && !phonePattern.test(phone.value.trim())) check(phone, "Enter a valid 10-digit mobile number.");
    check(pickup, pickup.value ? "" : "Select a pickup date.");
    const calc = computeCurrentPricing();
    check(
      returnDate,
      !returnDate.value
        ? "Select a return date."
        : !calc?.valid
        ? "Return date/time must be after pickup date/time."
        : ""
    );
    check(termsAccepted, termsAccepted?.checked ? "" : "You must accept the Customer Rental Terms & KYC notice before booking.");
    return firstInvalid;
  };

  const addAvailabilityBadges = () =>
    document.querySelectorAll(".vehicle-card").forEach((card) => {
      const button = card.querySelector(".book-button"),
        vehicle = vehicleFor(button?.dataset.vehicle || card.querySelector("h3")?.textContent.trim());
      if (!vehicle) return;
      let badge = card.querySelector(".availability-badge");
      const state = vehicle.availability || "available";
      if (!badge) {
        badge = document.createElement("p");
        card.querySelector(".vehicle-price")?.insertAdjacentElement("beforebegin", badge);
      }
      badge.className = `availability-badge availability-badge--${state}`;
      badge.textContent = statusText[state];
      if (state === "unavailable" && button) {
        button.disabled = true;
        button.textContent = "Currently Unavailable";
        button.setAttribute("aria-disabled", "true");
      }
    });

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".book-button");
    if (!button || button.disabled) return;
    open(button.dataset.vehicle);
  });

  form.addEventListener("input", (event) => {
    if (["pickup", "return", "pickupTime", "returnTime"].includes(event.target.name)) updateSummary();
  });
  form.addEventListener("change", (event) => {
    if (event.target.name === "customerType") {
      renderFields();
      clearValidation();
      error.textContent = "";
    }
    updateSummary();
  });
  modal.querySelectorAll("[data-close-booking]").forEach((button) => button.addEventListener("click", close));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const firstInvalid = validate();
    if (firstInvalid) {
      error.textContent = "Please correct the highlighted fields.";
      firstInvalid.focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    const vehicle = vehicleFor(selectedVehicle);
    const calc = computeCurrentPricing();

    // Local overlap check against existing Confirmed/Active bookings for this vehicle
    const existingLocal = JSON.parse(localStorage.getItem("drivora-bookings") || "[]");
    const localConflict = existingLocal.find((b) => {
      if (b.vehicle !== selectedVehicle) return false;
      const st = b.bookingStatus || "Pending";
      if (st !== "Confirmed" && st !== "Active") return false;
      return data.pickup < b.returnDate && data.return > b.pickup;
    });
    if (localConflict) {
      error.textContent = `${selectedVehicle} already has a confirmed reservation (${localConflict.id}) from ${localConflict.pickup} to ${localConflict.returnDate}. Please select non-overlapping dates.`;
      return;
    }

    isSubmitting = true;
    const submitBtn = document.getElementById("booking-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Verifying Availability...";
    }

    const documentNumber = data.customerType === "nri" ? data.passport : data.licence;
    const booking = {
      id: `DRV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      vehicleId: vehicle.id || selectedVehicle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      vehicle: selectedVehicle,
      modelYear: data.modelYear,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      pickup: data.pickup,
      returnDate: data.return,
      pickupTime: data.pickupTime || "10:00",
      returnTime: data.returnTime || "10:00",
      days: calc.days,
      extraHours: calc.extraHours,
      dailyPrice: calc.dailyPrice,
      extraHourRate: calc.extraHourRate,
      lateFeePerHour: calc.lateFeePerHour,
      baseRentalAmount: calc.baseRentalAmount,
      extraHourAmount: calc.extraHourAmount,
      securityDeposit: calc.securityDeposit,
      totalAmount: calc.rentalSubtotal,
      totalPayableWithDeposit: calc.totalPayableWithDeposit,
      customerType: data.customerType,
      governmentIdType: data.governmentIdType || (data.customerType === "nri" ? "Passport" : "Aadhaar"),
      documentLast4: documentNumber ? documentNumber.slice(-4) : "0000",
      country: data.country || "India",
      address: data.address ? data.address.trim() : "",
      kycStatus: "Pending Verification",
      bookingStatus: "Pending",
      paymentStatus: "unpaid",
      acceptedTermsVersion: "v1.0-customer",
      createdAt: new Date().toISOString()
    };

    try {
      // Authoritative backend overlap & booking creation check
      const authHeaders = window.DrivoraAuth?.getAuthHeaders?.() || { "Content-Type": "application/json" };
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(booking)
      });

      if (response.status === 409) {
        const errPayload = await response.json();
        error.textContent = errPayload.error || "This vehicle is already booked for the selected dates.";
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Confirm Booking Request";
        }
        return;
      }
    } catch {
      // Offline / static demo fallback continues safely
    }

    existingLocal.push(booking);
    localStorage.setItem("drivora-bookings", JSON.stringify(existingLocal));

    const kyc = JSON.parse(localStorage.getItem("drivora-kyc-data") || "[]");
    kyc.push({
      bookingId: booking.id,
      vehicle: selectedVehicle,
      customerType: data.customerType,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      governmentIdType: booking.governmentIdType,
      documentsProvided: true,
      documentLast4: booking.documentLast4,
      kycStatus: "Pending Verification",
      submittedAt: booking.createdAt
    });
    localStorage.setItem("drivora-kyc-data", JSON.stringify(kyc));

    window.DrivoraAuth?.addNotification?.({
      title: `Booking Request Submitted (${booking.id})`,
      message: `${booking.vehicle} requested for ${booking.pickup} to ${booking.returnDate}. Rental: ${money(booking.totalAmount)} + Refundable Deposit: ${money(booking.securityDeposit)}.`,
      type: "booking",
      bookingCode: booking.id
    });

    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Confirm Booking Request";
    }

    form.hidden = true;
    confirmation.hidden = false;
    confirmation.innerHTML = `
      <p class="confirmation-check">✓</p>
      <h2>Booking Request Recorded</h2>
      <p class="confirmation-id">Booking Reference: <strong>${booking.id}</strong></p>
      <dl>
        <div><dt>Vehicle</dt><dd>${booking.vehicle} (${booking.modelYear})</dd></div>
        <div><dt>Dates</dt><dd>${formatDate(booking.pickup)} – ${formatDate(booking.returnDate)} (${booking.days}d${booking.extraHours ? ` + ${booking.extraHours}h` : ""})</dd></div>
        <div><dt>Rental Charges (Excl. Deposit)</dt><dd>${money(booking.totalAmount)}</dd></div>
        <div><dt>Refundable Security Deposit</dt><dd>${money(booking.securityDeposit)}</dd></div>
        <div><dt>Total Payable at Pickup</dt><dd>${money(booking.totalPayableWithDeposit)}</dd></div>
        <div><dt>Payment &amp; Booking Status</dt><dd>UNPAID ESTIMATE • ${booking.bookingStatus}</dd></div>
      </dl>
      <p class="kyc-note">KYC Status: Pending Verification • Accepted Terms: v1.0-customer</p>
      <div class="detail-actions" style="justify-content:center;margin-top:1rem;">
        <button class="btn btn-secondary" type="button" id="download-invoice-btn">📄 Download Estimate / Receipt</button>
        <button class="btn btn-primary" type="button" data-close-booking>Done</button>
      </div>
    `;
    confirmation.querySelector("[data-close-booking]").addEventListener("click", close);
    confirmation.querySelector("#download-invoice-btn").addEventListener("click", () => {
      window.DrivoraAuth?.openInvoiceWindow?.(booking);
    });
    confirmation.querySelector("[data-close-booking]").focus();
  });

  renderFields();
  addAvailabilityBadges();
});
