document.addEventListener("DOMContentLoaded", () => {
  const catalog = window.vehicleCatalog || {};
  if (!Object.keys(catalog).length) return;

  const demoReviews = {
    "bmw-x5": [{ id: "d1", name: "Arjun Mehta", rating: 5, comment: "Powerful, spotless, and perfect for our family road trip.", verified: true }, { id: "d2", name: "Neha Kapoor", rating: 5, comment: "The cabin was exceptionally comfortable on a long drive.", verified: true }, { id: "d3", name: "Ritesh Saini", rating: 4, comment: "Smooth SUV with an easy pickup experience.", verified: true }],
    "mercedes-c-class": [{ id: "d4", name: "Sneha Iyer", rating: 5, comment: "Elegant ride and very well maintained.", verified: true }, { id: "d5", name: "Karan Malhotra", rating: 4, comment: "Comfortable for a business day in the city.", verified: true }, { id: "d6", name: "Pooja Nair", rating: 5, comment: "Clean interior and responsive service.", verified: true }],
    "tesla-model-3": [{ id: "d7", name: "Dev Shah", rating: 5, comment: "Quiet, quick, and surprisingly easy to drive.", verified: true }, { id: "d8", name: "Mira Joshi", rating: 5, comment: "Loved the electric drive for our weekend plans.", verified: true }, { id: "d9", name: "Aditya Rao", rating: 4, comment: "A modern car with a very smooth ride.", verified: true }],
    "audi-q7": [{ id: "d10", name: "Farhan Ali", rating: 5, comment: "Plenty of space and excellent highway comfort.", verified: true }, { id: "d11", name: "Tanya Bhatia", rating: 5, comment: "A premium choice for travelling with parents.", verified: true }, { id: "d12", name: "Saurabh Jain", rating: 4, comment: "Strong performance and a clean seven-seat cabin.", verified: true }],
    "honda-city": [{ id: "d13", name: "Ishita Bose", rating: 5, comment: "Fuel-efficient, tidy, and ideal for daily travel.", verified: true }, { id: "d14", name: "Manav Gupta", rating: 4, comment: "Easy to handle in traffic and good value.", verified: true }, { id: "d15", name: "Kavya Menon", rating: 5, comment: "The car was delivered in excellent condition.", verified: true }],
    "royal-enfield-classic": [{ id: "d16", name: "Kabir Singh", rating: 5, comment: "A lovely bike for a relaxed ride outside the city.", verified: true }, { id: "d17", name: "Ananya Roy", rating: 4, comment: "Comfortable seat and the bike felt well cared for.", verified: true }, { id: "d18", name: "Yash Verma", rating: 5, comment: "A memorable classic-bike experience.", verified: true }],
    "mini-convertible": [{ id: "d19", name: "Rhea Arora", rating: 5, comment: "So much fun for a sunny weekend drive.", verified: true }, { id: "d20", name: "Nitin Chawla", rating: 4, comment: "Stylish, compact, and easy to park.", verified: true }, { id: "d21", name: "Simran Kaur", rating: 5, comment: "The convertible made our celebration extra special.", verified: true }],
    "continental-gt-650": [{ id: "d22", name: "Rohan Dutta", rating: 5, comment: "Great balance and a fantastic engine note.", verified: true }, { id: "d23", name: "Diya Kulkarni", rating: 5, comment: "The bike was clean and ready exactly on time.", verified: true }, { id: "d24", name: "Harsh Patel", rating: 4, comment: "A very enjoyable ride for experienced riders.", verified: true }],
    "ola-s1": [{ id: "d25", name: "Aman Bansal", rating: 4, comment: "Convenient and economical for quick city errands.", verified: true }, { id: "d26", name: "Nisha Desai", rating: 5, comment: "Simple to ride and the battery range suited my day.", verified: true }, { id: "d27", name: "Vansh Arora", rating: 4, comment: "A practical scooter with a smooth pickup.", verified: true }],
    "toyota-commuter-van": [{ id: "d28", name: "Sonal Tripathi", rating: 5, comment: "Our whole group travelled comfortably with room for bags.", verified: true }, { id: "d29", name: "Gaurav Saxena", rating: 4, comment: "Reliable van for an airport transfer with colleagues.", verified: true }, { id: "d30", name: "Meera Pillai", rating: 5, comment: "Clean, spacious, and ideal for a family outing.", verified: true }],
    "volkswagen-virtus-gt": [{ id: "d31", name: "Abeer Khan", rating: 5, comment: "Engaging to drive and very stable on the highway.", verified: true }, { id: "d32", name: "Lavanya Reddy", rating: 4, comment: "Sporty feel with a comfortable interior.", verified: true }, { id: "d33", name: "Pranav Kulkarni", rating: 5, comment: "An excellent sedan for a weekend getaway.", verified: true }],
    "isuzu-pickup": [{ id: "d34", name: "Vivek Yadav", rating: 5, comment: "Handled our equipment run without any trouble.", verified: true }, { id: "d35", name: "Shreya Das", rating: 4, comment: "Strong, useful, and surprisingly comfortable.", verified: true }, { id: "d36", name: "Rahul Thakur", rating: 4, comment: "A dependable option when extra cargo space is needed.", verified: true }],
    "tata-altroz": [{ id: "d37", name: "Aditi Sharma", rating: 5, comment: "A neat hatchback that was easy to drive around town.", verified: true }, { id: "d38", name: "Mohit Batra", rating: 4, comment: "Good mileage and a comfortable compact car.", verified: true }, { id: "d39", name: "Zoya Mirza", rating: 4, comment: "Convenient booking and a very clean vehicle.", verified: true }],
    "bmw-i7": [{ id: "d40", name: "Ira Sood", rating: 5, comment: "A remarkably quiet and luxurious electric sedan.", verified: true }, { id: "d41", name: "Siddharth Bose", rating: 5, comment: "The rear-seat comfort made our event transfer effortless.", verified: true }, { id: "d42", name: "Nakul Anand", rating: 5, comment: "Premium in every detail and beautifully maintained.", verified: true }],
    "toyota-hiace": [{ id: "d43", name: "Anjali Thomas", rating: 5, comment: "Perfect amount of room for our extended family.", verified: true }, { id: "d44", name: "Chirag Sethi", rating: 4, comment: "A comfortable minivan for a full-day group trip.", verified: true }, { id: "d45", name: "Priya Ghosh", rating: 5, comment: "Clean seats, ample luggage room, and a smooth journey.", verified: true }]
  };

  const remoteReviews = {};
  let lastInquirySubmitAt = 0;

  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || fallback);
    } catch {
      return JSON.parse(fallback);
    }
  };
  const stars = (number) => "★".repeat(Math.round(number)) + "☆".repeat(5 - Math.round(number));

  const reviewsFor = (id) => {
    const localList = read("drivora-vehicle-reviews", "{}")[id] || [];
    const cloudList = remoteReviews[id] || [];
    const removedIds = new Set(read("drivora-removed-reviews", "[]"));
    const seen = new Set();
    const merged = [];
    [...(demoReviews[id] || []), ...cloudList, ...localList].forEach((item) => {
      if (item.id && removedIds.has(String(item.id))) return;
      const key = `${item.name}|${item.rating}|${item.comment}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    });
    return merged;
  };

  const summary = (id) => {
    const reviews = reviewsFor(id),
      v = catalog[id],
      userTotal = reviews.reduce((total, item) => total + Number(item.rating), 0);
    return {
      average: (v.rating * v.reviewCount + userTotal) / (v.reviewCount + reviews.length),
      count: v.reviewCount + reviews.length
    };
  };

  const modal = document.createElement("div");
  modal.className = "booking-modal vehicle-detail-modal";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `<div class="booking-modal__backdrop" data-close-details></div><section class="booking-modal__dialog vehicle-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="vehicle-detail-title"><button class="booking-modal__close" type="button" data-close-details aria-label="Close vehicle details">&times;</button><div id="vehicle-detail-content"></div></section>`;
  document.body.append(modal);
  const content = modal.querySelector("#vehicle-detail-content");
  let activeId = "";
  let frameIndex = 0;

  const close = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  };

  const renderInquiry = () => {
    const v = catalog[activeId];
    const existingInquiries = read("drivora-vehicle-inquiries", "[]").filter((inq) => inq.vehicleId === activeId);
    content.innerHTML = `
      <p class="hero-badge">Vehicle Inquiry</p>
      <h2 id="vehicle-detail-title">Ask Provider About ${v.name}</h2>
      <p class="kyc-note" style="margin-bottom:0.75rem;">Provider: <strong>${v.providerName || "Drivora Partner Fleet"}</strong> (${v.city || "Jaipur"} • ${v.publicHub || "Central Hub"})</p>
      <form id="inquiry-form" novalidate>
        <label>Name<input name="name" required></label>
        <label>Email<input name="email" type="email" required></label>
        <label>10-Digit Phone<input name="phone" type="tel" inputmode="numeric" required></label>
        <label>Vehicle Name/Model<input name="vehicle" value="${v.name}" readonly></label>
        <label>Inquiry / Question<textarea name="question" placeholder="Is this vehicle available for my trip dates, or does it include roof luggage racks?" required></textarea></label>
        <p class="form-message" role="alert"></p>
        <div class="detail-actions">
          <button class="btn btn-secondary" type="button" id="back-to-details-btn">← Back to Vehicle</button>
          <button class="btn btn-primary" type="submit">Send Inquiry</button>
        </div>
      </form>
      ${
        existingInquiries.length > 0
          ? `<div style="margin-top:1.25rem;border-top:1px solid var(--glass-border);padding-top:1rem;">
               <h3>Recent Questions &amp; Provider Responses</h3>
               <div class="review-list">
                 ${existingInquiries
                   .map(
                     (q) => `
                   <article class="review">
                     <strong>Q: ${q.question}</strong> <small class="kyc-note">by ${q.name}</small>
                     <p style="margin-top:0.3rem;color:${q.providerResponse ? "#166534" : "#64748b"};">
                       ${q.providerResponse ? `✔ Provider Reply: “${q.providerResponse}”` : "⏳ Status: Open — Awaiting provider response"}
                     </p>
                   </article>`
                   )
                   .join("")}
               </div>
             </div>`
          : ""
      }
    `;

    content.querySelector("#back-to-details-btn").addEventListener("click", render);
    content.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget,
        data = Object.fromEntries(new FormData(form)),
        message = form.querySelector(".form-message");

      if (Date.now() - lastInquirySubmitAt < 15000) {
        message.textContent = "Please wait 15 seconds before submitting another inquiry.";
        return;
      }

      if (!data.name.trim() || !data.question.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !/^\d{10}$/.test(data.phone)) {
        message.textContent = "Enter your name, a valid email, 10-digit phone number, and question.";
        return;
      }

      lastInquirySubmitAt = Date.now();
      const inquiryPayload = {
        id: `INQ-${Date.now()}`,
        ...data,
        vehicleId: activeId,
        inquiryStatus: "open",
        providerResponse: null,
        createdAt: new Date().toISOString()
      };
      const inquiries = read("drivora-vehicle-inquiries", "[]");
      inquiries.push(inquiryPayload);
      localStorage.setItem("drivora-vehicle-inquiries", JSON.stringify(inquiries));

      fetch("/api/inquiries", {
        method: "POST",
        headers: window.DrivoraAuth?.getAuthHeaders?.() || { "Content-Type": "application/json" },
        body: JSON.stringify(inquiryPayload)
      }).catch(() => {});

      window.DrivoraAuth?.addNotification?.({
        title: `Inquiry Sent: ${v.name}`,
        message: `Your question about ${v.name} was delivered to ${v.providerName || "the vehicle provider"}.`,
        type: "inquiry"
      });

      form.innerHTML = `<p class="booking-success">✓ Inquiry Submitted Successfully</p><p>Your inquiry has been recorded in the Provider Inbox. You will receive a response shortly.</p><button class="btn btn-secondary" type="button" id="done-inq-btn" style="margin-top:0.75rem;">Back to Details</button>`;
      form.querySelector("#done-inq-btn")?.addEventListener("click", render);
    });
  };

  const render = () => {
    const v = catalog[activeId],
      score = summary(activeId),
      reviews = reviewsFor(activeId);
    const frames = Array.isArray(v.frames360) && v.frames360.length > 0 ? v.frames360 : Array.isArray(v.photos) && v.photos.length > 0 ? v.photos : [v.image];
    const hasTrue360 = Array.isArray(v.frames360) && v.frames360.length >= 6;
    frameIndex = frameIndex % frames.length;

    const extraRate = v.extraHourRate || Math.round(v.price / 8);
    const lateRate = v.lateFeePerHour || Math.round(v.price / 6);
    const deposit = v.securityDeposit || 5000;

    // Reserved date blocks for this vehicle
    const bookingsForVehicle = read("drivora-bookings", "[]").filter(
      (b) => b.vehicle === v.name && (b.bookingStatus === "Confirmed" || b.bookingStatus === "Active")
    );

    content.innerHTML = `
      <div class="viewer-360-card" id="detail-360-viewer">
        <div class="viewer-360-stage" id="detail-360-stage" tabindex="0" aria-label="${hasTrue360 ? "360-degree rotatable view" : "Interactive multi-angle photo viewer"} for ${v.name}">
          <img id="detail-360-img" src="${frames[frameIndex]}" alt="${v.name} angle ${frameIndex + 1} of ${frames.length}">
        </div>
        <div class="viewer-360-toolbar">
          <span>🔄 ${hasTrue360 ? "360° Interactive Spin Viewer (Drag or Swipe)" : `Multi-Angle Photo Viewer (${frameIndex + 1}/${frames.length}) — True 360° sequence not uploaded, showing verified photos`}</span>
          <div class="viewer-360-controls">
            <button type="button" class="viewer-360-btn" id="viewer-prev-btn" aria-label="Previous angle">◀</button>
            <button type="button" class="viewer-360-btn" id="viewer-next-btn" aria-label="Next angle">▶</button>
          </div>
        </div>
      </div>

      <div class="vehicle-meta-row" style="margin-bottom:0.5rem;">
        <span class="hero-badge" style="margin:0;">${v.category}</span>
        ${
          v.providerVerified
            ? `<span class="verified-provider-badge" title="Provider identity and fleet documents verified">✔ Verified Provider: ${v.providerName || "Drivora Partner"}</span>`
            : `<span class="unverified-provider-badge" title="Verification pending">⏳ Unverified Provider: ${v.providerName || "Independent Host"}</span>`
        }
        <span class="distance-badge">📍 ${v.city || "Jaipur"} (${v.publicHub || "Central Hub"})</span>
      </div>

      <h2 id="vehicle-detail-title">${v.name}</h2>
      <p class="detail-specs">Model Year: ${v.modelYear} • ${v.transmission} • ${v.fuel} • ${v.seats} Seats</p>

      <div class="booking-summary" style="margin:0.75rem 0;display:grid;gap:0.35rem;font-size:0.9rem;">
        <div><strong>Daily Rate:</strong> ₹${v.price.toLocaleString("en-IN")}/day &nbsp;|&nbsp; <strong>Extra Hour:</strong> ₹${extraRate}/hr &nbsp;|&nbsp; <strong>Late Fee:</strong> ₹${lateRate}/hr (after 1h grace)</div>
        <div><strong>Refundable Security Deposit:</strong> ₹${deposit.toLocaleString("en-IN")} (held separately, refunded after return inspection)</div>
        <div><strong>Rental Rules:</strong> ${v.rentalRules || "Original driving licence & government ID required at pickup. Fuel/charge returned at pickup level."}</div>
        <div><strong>Cancellation Policy:</strong> ${v.cancellationPolicy || "Free cancellation up to 24 hours before pickup; 15% of 1-day rate within 24 hours."}</div>
      </div>

      <p class="vehicle-rating" aria-label="Rated ${score.average.toFixed(1)} out of 5 stars">${stars(score.average)} ${score.average.toFixed(1)} (${score.count} Reviews)</p>
      <p class="availability">
        ${v.availability === "unavailable" ? "🔴 Currently Unavailable" : v.availability === "reserved" ? "🟡 Reserved on Selected Dates" : "🟢 Available for Booking"}
        ${bookingsForVehicle.length > 0 ? ` — <small>Confirmed dates: ${bookingsForVehicle.map((b) => `${b.pickup} to ${b.returnDate}`).join(", ")}</small>` : ""}
      </p>

      <div class="detail-actions">
        <button class="btn btn-secondary inquiry-button" type="button">Ask Provider</button>
        <button class="btn btn-primary detail-book-button" type="button" ${v.availability === "unavailable" ? "disabled" : ""}>
          ${v.availability === "unavailable" ? "Unavailable" : "Book Now"}
        </button>
      </div>

      <section class="reviews-section">
        <h3>Customer Reviews &amp; Ratings</h3>
        <div class="review-list">
          ${reviews
            .map(
              (item, idx) => `
            <article class="review">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span>${stars(item.rating)} ${item.verified || item.is_verified_rental ? `<small style="color:#166534;font-weight:700;">✔ Verified Booking</small>` : ""}</span>
                <button type="button" class="btn-xs" data-report-review="${item.id || idx}" title="Flag review for admin moderation">⚑ Report</button>
              </div>
              <p>“${item.comment}”</p>
              <strong>— ${item.name}</strong>
            </article>`
            )
            .join("")}
        </div>
        <form id="review-form" novalidate style="margin-top:1rem;">
          <h3>Share Your Review</h3>
          <label>Your Name<input name="name" required></label>
          <label>Booking Reference (Optional — verifies your completed rental)<input name="bookingCode" placeholder="e.g. DRV-8X92A1"></label>
          <label>Rating
            <select name="rating" required>
              <option value="">Choose a rating</option>
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Very good</option>
              <option value="3">3 - Good</option>
              <option value="2">2 - Fair</option>
              <option value="1">1 - Poor</option>
            </select>
          </label>
          <label>Review / Comment<textarea name="comment" required></textarea></label>
          <p class="form-message" role="alert"></p>
          <button class="btn btn-primary" type="submit">Submit Review</button>
        </form>
      </section>
    `;

    // Interactive 360 / Multi-Angle Drag, Touch & Button Logic
    const stage = content.querySelector("#detail-360-stage");
    const imgEl = content.querySelector("#detail-360-img");
    let startX = null;

    const stepFrame = (delta) => {
      frameIndex = (frameIndex + delta + frames.length) % frames.length;
      imgEl.src = frames[frameIndex];
      const labelSpan = content.querySelector(".viewer-360-toolbar span");
      if (labelSpan && !hasTrue360) {
        labelSpan.textContent = `🔄 Multi-Angle Photo Viewer (${frameIndex + 1}/${frames.length}) — Drag or use arrows`;
      }
    };

    content.querySelector("#viewer-prev-btn")?.addEventListener("click", () => stepFrame(-1));
    content.querySelector("#viewer-next-btn")?.addEventListener("click", () => stepFrame(1));

    stage?.addEventListener("pointerdown", (e) => {
      startX = e.clientX;
    });
    stage?.addEventListener("pointermove", (e) => {
      if (startX === null) return;
      const diff = e.clientX - startX;
      if (Math.abs(diff) > 35) {
        stepFrame(diff > 0 ? -1 : 1);
        startX = e.clientX;
      }
    });
    window.addEventListener("pointerup", () => {
      startX = null;
    });
    stage?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") stepFrame(-1);
      if (e.key === "ArrowRight") stepFrame(1);
    });

    content.querySelector(".detail-book-button")?.addEventListener("click", () => {
      close();
      if (window.openDrivoraBooking) window.openDrivoraBooking(v.name);
      else document.querySelector(`.book-button[data-vehicle="${v.name}"]`)?.click();
    });
    content.querySelector(".inquiry-button")?.addEventListener("click", renderInquiry);

    content.querySelectorAll("[data-report-review]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const revId = btn.dataset.reportReview;
        const reported = read("drivora-reported-reviews", "[]");
        reported.push({
          id: revId,
          vehicleId: activeId,
          vehicleName: v.name,
          reportedAt: new Date().toISOString()
        });
        localStorage.setItem("drivora-reported-reviews", JSON.stringify(reported));
        fetch("/api/reviews", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: revId, isReported: true, reportReason: "Flagged by user" })
        }).catch(() => {});
        btn.textContent = "✓ Reported to Admin";
        btn.disabled = true;
      })
    );

    content.querySelector("#review-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget,
        data = Object.fromEntries(new FormData(form)),
        message = form.querySelector(".form-message");
      const numRating = Number(data.rating);
      if (!data.name.trim() || !data.comment.trim() || !numRating || numRating < 1 || numRating > 5) {
        message.textContent = "Complete your name, valid rating (1–5), and review.";
        return;
      }

      const bookings = read("drivora-bookings", "[]");
      const hasMatchingBooking = Boolean(
        data.bookingCode &&
          bookings.some((b) => b.id === data.bookingCode.trim() && b.vehicle === v.name)
      );

      const reviewEntry = {
        id: `REV-${Date.now()}`,
        name: data.name.trim(),
        rating: numRating,
        comment: data.comment.trim(),
        verified: hasMatchingBooking
      };
      const saved = read("drivora-vehicle-reviews", "{}");
      saved[activeId] = [...(saved[activeId] || []), reviewEntry];
      localStorage.setItem("drivora-vehicle-reviews", JSON.stringify(saved));

      fetch("/api/reviews", {
        method: "POST",
        headers: window.DrivoraAuth?.getAuthHeaders?.() || { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: activeId,
          bookingCode: data.bookingCode?.trim() || null,
          ...reviewEntry
        })
      }).catch(() => {});

      document.dispatchEvent(new CustomEvent("vehicles:ratings-updated"));
      render();
    });
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".details-button");
    if (!button) return;
    activeId = button.dataset.vehicleId;
    frameIndex = 0;
    render();
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    modal.querySelector(".booking-modal__close").focus();

    fetch(`/api/reviews?vehicleId=${encodeURIComponent(activeId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.ok && Array.isArray(payload.reviews)) {
          remoteReviews[activeId] = payload.reviews.map((r) => ({
            id: r.id,
            name: r.reviewer_name,
            rating: Number(r.rating),
            comment: r.comment,
            verified: Boolean(r.is_verified_rental)
          }));
          if (!modal.hidden && activeId === button.dataset.vehicleId) render();
        }
      })
      .catch(() => {});
  });

  modal.querySelectorAll("[data-close-details]").forEach((button) => button.addEventListener("click", close));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });
});
