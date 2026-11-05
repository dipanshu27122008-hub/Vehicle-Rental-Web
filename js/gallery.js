/**
 * Interactive Gallery Category Filters & Dynamic 360° Multi-Angle Studio Showcase (js/gallery.js)
 */
document.addEventListener("DOMContentLoaded", () => {
  const filterButtons = Array.from(document.querySelectorAll(".gallery-filters .filter-button"));
  const cards = Array.from(document.querySelectorAll(".gallery-grid .gallery-card"));
  const showcaseSection = document.querySelector(".gallery-showcase");

  if (!cards.length) return;

  const catalog = window.vehicleCatalog || {};

  // Map gallery filter labels to card overlay category text
  const matchesFilter = (cardCategoryText, filterLabel) => {
    const cat = cardCategoryText.trim().toLowerCase();
    const f = filterLabel.trim().toLowerCase();
    if (f === "all") return true;
    if (f === "suvs") return cat.includes("suv") || cat.includes("pickup");
    if (f === "sedans") return cat.includes("sedan") || cat.includes("sports") || cat.includes("hatchback");
    if (f === "luxury") return cat.includes("luxury") || cat.includes("convertible");
    if (f === "electric") return cat.includes("electric");
    if (f === "bikes") return cat.includes("bike") || cat.includes("scooter");
    return cat.includes(f);
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      const label = button.textContent || "All";
      cards.forEach((card) => {
        const pText = card.querySelector(".gallery-overlay p")?.textContent || "";
        card.hidden = !matchesFilter(pText, label);
      });
    });
  });

  // Inject Interactive 360° Multi-Angle Studio Viewer above the gallery grid
  if (showcaseSection && !document.getElementById("gallery-360-studio")) {
    const angleLabels = [
      "Angle 1 of 3: Front Three-Quarter Stance",
      "Angle 2 of 3: Side Profile & Exterior Lines",
      "Angle 3 of 3: Rear Stance & Badging"
    ];

    // Helper to get frames for a vehicle ID or fallback
    const getVehicleData = (vehicleId) => {
      if (catalog[vehicleId]) {
        const v = catalog[vehicleId];
        const frames = Array.isArray(v.frames360) && v.frames360.length ? v.frames360 : [v.image];
        return {
          id: vehicleId,
          name: v.name,
          category: v.category,
          price: v.price,
          frames
        };
      }
      return {
        id: "bmw-x5",
        name: "BMW X5",
        category: "SUV",
        price: 4500,
        frames: [
          "./assets/vehicles/bmw x5.jpg",
          "./assets/vehicles/360/bmw-x5-2.jpg",
          "./assets/vehicles/360/bmw-x5-3.jpg"
        ]
      };
    };

    let currentVehicle = getVehicleData("bmw-x5");
    let currentFrameIndex = 0;

    const studioEl = document.createElement("div");
    studioEl.id = "gallery-360-studio";
    studioEl.className = "viewer-360-card";
    studioEl.style.marginBottom = "2rem";
    studioEl.style.transition = "border-color 0.3s ease, box-shadow 0.3s ease";

    // Build vehicle selector options
    const optionsHtml = Object.entries(catalog).length
      ? Object.entries(catalog)
          .map(([id, v]) => `<option value="${id}">${v.name} (${v.category})</option>`)
          .join("")
      : `<option value="bmw-x5">BMW X5 (SUV)</option>`;

    studioEl.innerHTML = `
      <div class="viewer-360-stage" id="studio-stage" style="height:360px;" tabindex="0" aria-label="Interactive 360 drag-to-rotate vehicle showcase">
        <img id="studio-img" src="${currentVehicle.frames[0]}" alt="${currentVehicle.name}">
        <span class="viewer-360-badge" id="studio-badge" style="position:absolute;top:1rem;left:1rem;background:rgba(15,23,42,0.75);color:#fff;padding:0.35rem 0.75rem;border-radius:20px;font-size:0.8rem;backdrop-filter:blur(8px);">
          🔄 360° Studio View
        </span>
      </div>
      <div class="viewer-360-toolbar" style="padding:1rem 1.25rem;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;">
        <div style="flex:1;min-width:240px;">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.25rem;">
            <strong id="studio-title" style="font-size:1.15rem;color:var(--dark);">${currentVehicle.name}</strong>
            <span id="studio-cat-tag" style="background:rgba(0,52,142,0.12);color:var(--primary);font-size:0.75rem;padding:0.2rem 0.6rem;border-radius:12px;font-weight:700;">${currentVehicle.category}</span>
          </div>
          <span id="studio-mode" style="display:block;font-size:0.82rem;color:#64748b;">
            🔄 Drag left/right, swipe on mobile, or scrub slider (${angleLabels[0]})
          </span>
          <div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem;">
            <label for="studio-slider" style="font-size:0.75rem;color:#64748b;font-weight:700;">Angle:</label>
            <input type="range" id="studio-slider" min="0" max="${currentVehicle.frames.length - 1}" value="0" style="width:140px;cursor:pointer;">
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
          <label for="studio-vehicle-select" style="font-size:0.82rem;color:#475569;font-weight:600;">Choose Model:</label>
          <select id="studio-vehicle-select" style="padding:0.45rem 0.85rem;border-radius:10px;border:1px solid rgba(148,163,184,0.4);background:rgba(255,255,255,0.85);font-size:0.86rem;color:#0f172a;cursor:pointer;">
            ${optionsHtml}
          </select>
          <div class="viewer-360-controls" style="display:flex;gap:0.35rem;">
            <button type="button" class="viewer-360-btn" id="studio-prev" aria-label="Previous angle">◀</button>
            <button type="button" class="viewer-360-btn" id="studio-next" aria-label="Next angle">▶</button>
          </div>
          <a id="studio-book-btn" href="./vehicles.html#vehicles-heading" class="btn btn-primary" style="padding:0.5rem 1rem;font-size:0.86rem;text-decoration:none;">
            Book This Ride &rarr;
          </a>
        </div>
      </div>
    `;

    const gridEl = showcaseSection.querySelector(".gallery-grid");
    if (gridEl) showcaseSection.insertBefore(studioEl, gridEl);

    const imgEl = studioEl.querySelector("#studio-img");
    const titleEl = studioEl.querySelector("#studio-title");
    const catTagEl = studioEl.querySelector("#studio-cat-tag");
    const modeEl = studioEl.querySelector("#studio-mode");
    const stageEl = studioEl.querySelector("#studio-stage");
    const sliderEl = studioEl.querySelector("#studio-slider");
    const selectEl = studioEl.querySelector("#studio-vehicle-select");
    const bookBtn = studioEl.querySelector("#studio-book-btn");

    const renderFrame = (idx) => {
      const len = currentVehicle.frames.length;
      currentFrameIndex = (idx + len) % len;
      imgEl.src = currentVehicle.frames[currentFrameIndex];
      imgEl.alt = `${currentVehicle.name} (${angleLabels[currentFrameIndex] || `Frame ${currentFrameIndex + 1}`})`;
      modeEl.textContent = `🔄 Drag left/right, swipe on mobile, or scrub slider (${angleLabels[currentFrameIndex] || `Frame ${currentFrameIndex + 1}/${len}`})`;
      sliderEl.value = String(currentFrameIndex);
    };

    const loadVehicle = (vehicleId) => {
      currentVehicle = getVehicleData(vehicleId);
      currentFrameIndex = 0;
      titleEl.textContent = currentVehicle.name;
      catTagEl.textContent = currentVehicle.category;
      sliderEl.max = String(currentVehicle.frames.length - 1);
      sliderEl.value = "0";
      if (selectEl) selectEl.value = currentVehicle.id;
      if (bookBtn) {
        bookBtn.href = `./vehicles.html?category=${encodeURIComponent((currentVehicle.category || "suv").toLowerCase())}#vehicles-heading`;
      }
      renderFrame(0);

      // Highlight corresponding gallery card
      cards.forEach((c) => {
        const id = c.getAttribute("data-vehicle-id");
        if (id === currentVehicle.id) {
          c.style.outline = "2.5px solid var(--primary)";
          c.style.outlineOffset = "3px";
        } else {
          c.style.outline = "";
          c.style.outlineOffset = "";
        }
      });
    };

    // Range slider interaction
    sliderEl.addEventListener("input", (e) => {
      renderFrame(Number(e.target.value));
    });

    // Dropdown switch
    selectEl.addEventListener("change", (e) => {
      loadVehicle(e.target.value);
    });

    // Prev / Next button clicks
    studioEl.querySelector("#studio-prev").addEventListener("click", () => renderFrame(currentFrameIndex - 1));
    studioEl.querySelector("#studio-next").addEventListener("click", () => renderFrame(currentFrameIndex + 1));

    // Pointer drag & touch swipe
    let dragStartX = null;
    stageEl.addEventListener("pointerdown", (e) => {
      dragStartX = e.clientX;
    });
    stageEl.addEventListener("pointermove", (e) => {
      if (dragStartX === null) return;
      const delta = e.clientX - dragStartX;
      if (Math.abs(delta) > 35) {
        renderFrame(delta > 0 ? currentFrameIndex - 1 : currentFrameIndex + 1);
        dragStartX = e.clientX;
      }
    });
    window.addEventListener("pointerup", () => {
      dragStartX = null;
    });

    // Keyboard navigation
    stageEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        renderFrame(currentFrameIndex - 1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        renderFrame(currentFrameIndex + 1);
      }
    });

    // Clicking any card in the gallery grid loads it into the 360 Studio
    cards.forEach((card) => {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        const cardVehId = card.getAttribute("data-vehicle-id");
        if (cardVehId) {
          loadVehicle(cardVehId);
        } else {
          const cardTitle = card.querySelector("h3")?.textContent || "";
          // Find matching vehicle by name
          const match = Object.entries(catalog).find(([, v]) => v.name.toLowerCase() === cardTitle.toLowerCase());
          if (match) loadVehicle(match[0]);
        }
        studioEl.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    // Initialize with first vehicle highlighted
    loadVehicle("bmw-x5");
  }
});
