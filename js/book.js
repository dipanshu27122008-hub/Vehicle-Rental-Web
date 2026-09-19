document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("booking-modal"), form = document.getElementById("booking-form");
  if (!modal || !form) return;
  const catalog = window.vehicleCatalog || {}, emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, phonePattern = /^\d{10}$/;
  let selectedVehicle = "";
  const field = (id, label, control) => `<div class="booking-field"><label for="${id}">${label}</label>${control}<small class="field-error" id="${id}-error" aria-live="polite"></small></div>`;
  const input = (id, name, label, extra = "") => field(id, label, `<input id="${id}" name="${name}" ${extra} aria-describedby="${id}-error">`);
  const textarea = (id, name, label) => field(id, label, `<textarea id="${id}" name="${name}" required aria-describedby="${id}-error"></textarea>`);
  form.innerHTML = `<input id="booking-vehicle-input" name="vehicle" type="hidden"><input id="booking-model-year" name="modelYear" type="hidden"><p class="booking-summary" id="booking-summary"></p><fieldset class="customer-type"><legend>Customer type</legend><label><input type="radio" name="customerType" value="indian" checked> Indian Resident</label><label><input type="radio" name="customerType" value="nri"> NRI</label></fieldset><p class="kyc-note">These are demo platform verification requirements and may differ by rental provider.</p><div class="booking-fields" id="booking-fields"></div><div class="booking-date-row">${field("pickup-date", "Pickup date", `<input id="pickup-date" name="pickup" type="date" required aria-describedby="pickup-date-error">`)}${field("return-date", "Return date", `<input id="return-date" name="return" type="date" required aria-describedby="return-date-error">`)}</div><p id="booking-error" class="booking-error" role="alert" aria-live="polite"></p><button class="btn btn-primary" type="submit">Confirm Booking</button><p id="booking-success" class="booking-success" role="status"></p>`;
  const fields = document.getElementById("booking-fields"), error = document.getElementById("booking-error"), success = document.getElementById("booking-success");
  const clearValidation = () => form.querySelectorAll(".field-error").forEach((item) => item.textContent = "");
  const setFieldError = (element, message) => { const target = document.getElementById(`${element.id}-error`); element.classList.toggle("is-invalid", Boolean(message)); element.setAttribute("aria-invalid", String(Boolean(message))); if (target) target.textContent = message; return !message; };
  const renderFields = () => {
    const isNri = form.elements.customerType.value === "nri";
    fields.innerHTML = isNri ? `${input("booking-name", "name", "Full name", 'type="text" autocomplete="name" required')}${input("booking-phone", "phone", "Mobile number", 'type="tel" inputmode="numeric" required')}${input("booking-email", "email", "Email", 'type="email" autocomplete="email" required')}${input("passport-number", "passport", "Passport number", 'type="text" required')}${input("driving-authorisation", "drivingAuthorisation", "Driving licence / applicable driving authorization", 'type="text" required')}${input("residence-country", "country", "Country of residence", 'type="text" required')}${textarea("overseas-address", "address", "Overseas address")}` : `${input("booking-name", "name", "Full name", 'type="text" autocomplete="name" required')}${input("booking-phone", "phone", "Mobile number", 'type="tel" inputmode="numeric" required')}${input("booking-email", "email", "Email", 'type="email" autocomplete="email" required')}${input("licence-number", "licence", "Driving licence number", 'type="text" required')}${field("government-id-type", "Government ID type", `<select id="government-id-type" name="governmentIdType" required aria-describedby="government-id-type-error"><option value="">Select ID type</option><option>Aadhaar</option><option>Voter ID</option><option>Passport</option></select>`)}${input("government-id-number", "governmentIdNumber", "Government ID number", 'type="text" required')}${textarea("customer-address", "address", "Address")}`;
  };
  const close = () => { modal.hidden = true; modal.setAttribute("aria-hidden", "true"); };
  const open = (vehicle) => { selectedVehicle = vehicle; const data = Object.values(catalog).find((item) => item.name === vehicle); form.reset(); renderFields(); clearValidation(); error.textContent = ""; success.textContent = ""; document.getElementById("booking-vehicle").textContent = vehicle; form.elements.vehicle.value = vehicle; form.elements.modelYear.value = data?.modelYear || ""; document.getElementById("booking-summary").textContent = data ? `${data.category} • Model Year: ${data.modelYear} • ₹${data.price.toLocaleString("en-IN")}/day` : ""; modal.hidden = false; modal.setAttribute("aria-hidden", "false"); document.getElementById("booking-name").focus(); };
  const validate = () => {
    clearValidation(); let firstInvalid;
    const check = (element, message) => { if (!setFieldError(element, message) && !firstInvalid) firstInvalid = element; };
    fields.querySelectorAll("[required]").forEach((element) => check(element, element.value.trim() ? "" : "This field is required."));
    const { email, phone, pickup, return: returnDate } = form.elements;
    if (email?.value && !emailPattern.test(email.value.trim())) check(email, "Enter a valid email address.");
    if (phone?.value && !phonePattern.test(phone.value.trim())) check(phone, "Enter a valid 10-digit mobile number.");
    check(pickup, pickup.value ? "" : "Select a pickup date.");
    check(returnDate, !returnDate.value ? "Select a return date." : (pickup.value && returnDate.value < pickup.value ? "Return date must be after pickup date." : ""));
    return firstInvalid;
  };
  document.querySelectorAll(".book-button").forEach((button) => button.addEventListener("click", () => open(button.dataset.vehicle)));
  form.addEventListener("change", (event) => { if (event.target.name === "customerType") { renderFields(); clearValidation(); error.textContent = ""; } });
  modal.querySelectorAll("[data-close-booking]").forEach((button) => button.addEventListener("click", close));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) close(); });
  form.addEventListener("submit", (event) => {
    event.preventDefault(); success.textContent = ""; const firstInvalid = validate();
    if (firstInvalid) { error.textContent = "Please correct the highlighted fields."; firstInvalid.focus(); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    const booking = { id: Date.now(), vehicle: selectedVehicle, modelYear: data.modelYear, name: data.name.trim(), phone: data.phone.trim(), email: data.email.trim(), pickup: data.pickup, returnDate: data.return, customerType: data.customerType, kycStatus: "Pending Verification", createdAt: new Date().toISOString() };
    const bookings = JSON.parse(localStorage.getItem("drivora-bookings") || "[]"); bookings.push(booking); localStorage.setItem("drivora-bookings", JSON.stringify(bookings));
    const documentNumber = data.customerType === "nri" ? data.passport : data.licence;
    const kyc = JSON.parse(localStorage.getItem("drivora-kyc-data") || "[]"); kyc.push({ bookingId: booking.id, vehicle: selectedVehicle, customerType: data.customerType, name: booking.name, email: booking.email, phone: booking.phone, documentsProvided: true, documentLast4: documentNumber.slice(-4), kycStatus: "Pending Verification", submittedAt: booking.createdAt }); localStorage.setItem("drivora-kyc-data", JSON.stringify(kyc));
    error.textContent = ""; success.textContent = "KYC Status: Pending Verification. Booking confirmed for demo review."; form.reset(); renderFields();
  });
  renderFields();
});
