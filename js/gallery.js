/**
 * Interactive Gallery Category Filters & 360° / Multi-Angle Drag-to-Rotate Showcase (js/gallery.js)
 */
document.addEventListener("DOMContentLoaded", () => {
  const filterButtons = Array.from(document.querySelectorAll(".gallery-filters .filter-button"));
  const cards = Array.from(document.querySelectorAll(".gallery-grid .gallery-card"));
  const showcaseSection = document.querySelector(".gallery-showcase");

  if (!cards.length) return;

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

  // Inject Interactive 360° / Multi-Angle Drag-to-Rotate Studio Viewer above the gallery grid
  if (showcaseSection && !document.getElementById("gallery-360-studio")) {
    const studioFrames = [
      { src: "./assets/vehicles/bmw x5.jpg", title: "BMW X5 — Front Quarter Angle", mode: "Multi-Angle Fleet Sequence (Frame 1/8)" },
      { src: "./assets/vehicles/audi q7.jpg", title: "Audi Q7 — Executive Profile", mode: "Multi-Angle Fleet Sequence (Frame 2/8)" },
      { src: "./assets/vehicles/model 3.jpg", title: "Tesla Model 3 — Aero View", mode: "Multi-Angle Fleet Sequence (Frame 3/8)" },
      { src: "./assets/vehicles/luxuryi7.jpg", title: "BMW i7 — Flagship Saloon", mode: "Multi-Angle Fleet Sequence (Frame 4/8)" },
      { src: "./assets/vehicles/convertiblemini.jpg", title: "Mini Convertible — Open Top", mode: "Multi-Angle Fleet Sequence (Frame 5/8)" },
      { src: "./assets/vehicles/sportsvirtusgt.jpg", title: "VW Virtus GT — Dynamic Stance", mode: "Multi-Angle Fleet Sequence (Frame 6/8)" },
      { src: "./assets/vehicles/bikegt650.jpg", title: "Continental GT 650 — Café Racer", mode: "Multi-Angle Fleet Sequence (Frame 7/8)" },
      { src: "./assets/vehicles/bullet.jpg", title: "Royal Enfield Classic — Cruiser", mode: "Multi-Angle Fleet Sequence (Frame 8/8)" }
    ];

    let activeIndex = 0;
    const studioEl = document.createElement("div");
    studioEl.id = "gallery-360-studio";
    studioEl.className = "viewer-360-card";
    studioEl.style.marginBottom = "2rem";
    studioEl.innerHTML = `
      <div class="viewer-360-stage" id="studio-stage" style="height:340px;" tabindex="0" aria-label="Interactive drag-to-rotate vehicle showcase">
        <img id="studio-img" src="${studioFrames[0].src}" alt="${studioFrames[0].title}">
      </div>
      <div class="viewer-360-toolbar">
        <div>
          <strong id="studio-title">${studioFrames[0].title}</strong>
          <span id="studio-mode" style="display:block;font-size:0.78rem;color:#475569;">🔄 Drag left/right, swipe on mobile, or use arrow keys (${studioFrames[0].mode})</span>
        </div>
        <div class="viewer-360-controls">
          <button type="button" class="viewer-360-btn" id="studio-prev" aria-label="Previous frame">◀ Prev</button>
          <button type="button" class="viewer-360-btn" id="studio-next" aria-label="Next frame">Next ▶</button>
        </div>
      </div>
    `;

    const gridEl = showcaseSection.querySelector(".gallery-grid");
    if (gridEl) showcaseSection.insertBefore(studioEl, gridEl);

    const imgEl = studioEl.querySelector("#studio-img");
    const titleEl = studioEl.querySelector("#studio-title");
    const modeEl = studioEl.querySelector("#studio-mode");
    const stageEl = studioEl.querySelector("#studio-stage");

    const setFrame = (index) => {
      activeIndex = (index + studioFrames.length) % studioFrames.length;
      const frame = studioFrames[activeIndex];
      imgEl.src = frame.src;
      imgEl.alt = frame.title;
      titleEl.textContent = frame.title;
      modeEl.textContent = `🔄 Drag left/right, swipe on mobile, or use arrow keys (${frame.mode})`;
    };

    studioEl.querySelector("#studio-prev").addEventListener("click", () => setFrame(activeIndex - 1));
    studioEl.querySelector("#studio-next").addEventListener("click", () => setFrame(activeIndex + 1));

    let dragStartX = null;
    stageEl.addEventListener("pointerdown", (e) => {
      dragStartX = e.clientX;
    });
    stageEl.addEventListener("pointermove", (e) => {
      if (dragStartX === null) return;
      const delta = e.clientX - dragStartX;
      if (Math.abs(delta) > 35) {
        setFrame(delta > 0 ? activeIndex - 1 : activeIndex + 1);
        dragStartX = e.clientX;
      }
    });
    window.addEventListener("pointerup", () => {
      dragStartX = null;
    });
    stageEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") setFrame(activeIndex - 1);
      if (e.key === "ArrowRight") setFrame(activeIndex + 1);
    });

    // Clicking any gallery card loads it into the studio viewer
    cards.forEach((card) => {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        const cardImg = card.querySelector("img")?.getAttribute("src");
        const cardTitle = card.querySelector("h3")?.textContent || "Vehicle";
        const cardCat = card.querySelector("p")?.textContent || "";
        if (cardImg) {
          imgEl.src = cardImg;
          titleEl.textContent = `${cardTitle} (${cardCat})`;
          modeEl.textContent = "🔄 Selected from Gallery — Drag left/right to rotate through fleet angles";
          studioEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }
});
