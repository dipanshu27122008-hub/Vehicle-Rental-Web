document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("vehicle-search");
  const categorySelect = document.getElementById("vehicle-category");
  const sortSelect = document.getElementById("vehicle-sort");
  const yearSelect = document.getElementById("vehicle-year");
  const vehicleGrid = document.querySelector(".vehicles-list .vehicle-grid");
  const filterButtons = Array.from(document.querySelectorAll(".filter-chip[data-filter]"));
  const noVehiclesMessage = document.querySelector(".no-vehicles");
  const pagination = document.querySelector(".pagination");
  const controlsSection = document.querySelector(".vehicle-controls");

  if (!vehicleGrid || !noVehiclesMessage) return;

  const catalog = window.vehicleCatalog || {};
  const cityCoords = window.drivoraCityCoords || {};
  let userLocation = null; // { lat, lng, label }

  // Inject any custom provider-added vehicles into the DOM grid before indexing
  Object.entries(catalog).forEach(([id, v]) => {
    if (v.isPublished === false) return;
    if (!vehicleGrid.querySelector(`.vehicle-card[data-vehicle-id="${id}"]`)) {
      const article = document.createElement("article");
      article.className = "vehicle-card";
      article.dataset.category = String(v.category || "suv").toLowerCase();
      article.dataset.vehicleId = id;
      article.innerHTML = `
        <button class="wishlist-button" type="button" aria-label="Add ${v.name} to wishlist" aria-pressed="false">&#9825;</button>
        <img src="${v.image || "./assets/vehicles/bmw x5.jpg"}" alt="${v.name}" loading="lazy">
        <h3>${v.name}</h3>
        <p class="vehicle-type">${v.category} &bull; ${v.transmission || "Automatic"} &bull; ${v.fuel || "Petrol"}</p>
        <p class="vehicle-rating" aria-label="Rated ${(v.rating || 4.7).toFixed(1)} out of 5 stars">★★★★★</p>
        <p class="vehicle-price">₹${Number(v.price || 3000).toLocaleString("en-IN")}/day</p>
        <div class="card-action-group">
          <button class="btn btn-primary details-button" type="button" data-vehicle-id="${id}">View Details</button>
          <button class="btn btn-secondary book-button" type="button" data-vehicle="${v.name}">Book Now</button>
        </div>
      `;
      vehicleGrid.appendChild(article);
    }
  });

  // Add Distance Discovery, Price Range & Fuel Type filters into .vehicle-controls
  if (controlsSection && !document.getElementById("vehicle-location-city")) {
    // Ensure Distance option exists in Sort dropdown
    if (sortSelect && !sortSelect.querySelector('option[value="distance"]')) {
      sortSelect.insertAdjacentHTML("beforeend", `<option value="distance">Distance: Nearest First</option>`);
    }

    const extraControlsHtml = `
      <div class="search-field">
        <label for="vehicle-price-max">Max Price / Day</label>
        <select id="vehicle-price-max" name="price-max">
          <option value="all">Any Price</option>
          <option value="2000">Up to ₹2,000/day</option>
          <option value="3500">Up to ₹3,500/day</option>
          <option value="5000">Up to ₹5,000/day</option>
        </select>
      </div>
      <div class="search-field">
        <label for="vehicle-fuel">Fuel Type</label>
        <select id="vehicle-fuel" name="fuel">
          <option value="all">All Fuels</option>
          <option value="petrol">Petrol</option>
          <option value="diesel">Diesel</option>
          <option value="electric">Electric</option>
        </select>
      </div>
      <div class="search-field" style="grid-column: 1 / -1;">
        <label for="vehicle-location-city">Nearby Vehicle Discovery (Haversine Straight-Line Distance)</label>
        <div style="display:flex;gap:0.65rem;flex-wrap:wrap;align-items:center;">
          <select id="vehicle-location-city" style="max-width:240px;">
            <option value="">All Cities (Select city for distance)</option>
            <option value="Jaipur">Jaipur, Rajasthan</option>
            <option value="Delhi">New Delhi, NCR</option>
            <option value="Mumbai">Mumbai, Maharashtra</option>
            <option value="Bengaluru">Bengaluru, Karnataka</option>
            <option value="Udaipur">Udaipur, Rajasthan</option>
          </select>
          <select id="vehicle-max-distance" style="max-width:220px;">
            <option value="all">Any Distance</option>
            <option value="25">Within 25 km (Same City)</option>
            <option value="300">Within 300 km</option>
            <option value="1500">Within 1,500 km</option>
          </select>
          <button type="button" id="use-geolocation-btn" class="btn btn-secondary" style="padding:0.6rem 1.1rem;font-size:0.88rem;">
            📍 Use My Location
          </button>
          <small id="location-status-msg" class="kyc-note" aria-live="polite">Distances are straight-line (Haversine) to the public pickup hub.</small>
        </div>
      </div>
    `;
    const chipsEl = controlsSection.querySelector(".filter-chips");
    if (chipsEl) chipsEl.insertAdjacentHTML("beforebegin", extraControlsHtml);
  }

  const priceMaxSelect = document.getElementById("vehicle-price-max");
  const fuelSelect = document.getElementById("vehicle-fuel");
  const locationCitySelect = document.getElementById("vehicle-location-city");
  const maxDistanceSelect = document.getElementById("vehicle-max-distance");
  const geoBtn = document.getElementById("use-geolocation-btn");
  const locationStatusMsg = document.getElementById("location-status-msg");

  const cards = Array.from(document.querySelectorAll(".vehicles-list .vehicle-card"));
  const originalOrder = cards.map((card, index) => ({ card, index }));
  const pageSize = 6;
  let currentPage = 1;
  let selectedCategory = categorySelect?.value || "all";

  const normalise = (value) => (value || "").trim().toLowerCase();
  const getPrice = (card) => Number((card.querySelector(".vehicle-price")?.textContent || "").replace(/[^0-9]/g, ""));
  const getRating = (card) => Number((card.querySelector(".vehicle-rating")?.getAttribute("aria-label") || "").match(/\d+(?:\.\d+)?/)?.[0] || 0);

  cards.forEach((card) => {
    const vehicle = catalog[card.dataset.vehicleId];
    if (!vehicle) return;
    card.dataset.modelYear = vehicle.modelYear;
    card.dataset.fuel = normalise(vehicle.fuel);
    card.dataset.city = vehicle.city || "Jaipur";

    const img = card.querySelector("img");
    if (img && !img.getAttribute("loading")) img.setAttribute("loading", "lazy");

    const type = card.querySelector(".vehicle-type");
    if (type && !card.querySelector(".model-year")) {
      type.insertAdjacentHTML(
        "afterend",
        `<p class="model-year">Model Year: ${vehicle.modelYear} • ${vehicle.seats || 5} Seats</p>
         <div class="vehicle-meta-row">
           <span class="distance-badge" data-distance-badge>📍 ${vehicle.city || "Jaipur"}</span>
           ${
             vehicle.providerVerified
               ? `<span class="verified-provider-badge">✔ Verified Host</span>`
               : `<span class="unverified-provider-badge">Host Pending KYC</span>`
           }
         </div>`
      );
    }

    const rating = card.querySelector(".vehicle-rating");
    if (rating) {
      rating.textContent = `★★★★★ ${vehicle.rating.toFixed(1)} (${vehicle.reviewCount} Reviews)`;
      rating.setAttribute("aria-label", `Rated ${vehicle.rating.toFixed(1)} out of 5 stars`);
    }
    if (!card.querySelector(".details-button")) {
      const bookBtn = card.querySelector(".book-button");
      if (bookBtn) {
        const actionGroup = card.querySelector(".card-action-group");
        if (actionGroup) {
          actionGroup.insertAdjacentHTML(
            "afterbegin",
            `<button class="btn btn-primary details-button" type="button" data-vehicle-id="${card.dataset.vehicleId}">View Details</button>`
          );
        } else {
          bookBtn.insertAdjacentHTML(
            "beforebegin",
            `<button class="btn btn-primary details-button" type="button" data-vehicle-id="${card.dataset.vehicleId}">View Details</button>`
          );
        }
      }
    }
  });

  if (yearSelect) {
    [...new Set(Object.values(catalog).map((vehicle) => vehicle.modelYear))]
      .sort((a, b) => b - a)
      .forEach((year) => {
        if (!yearSelect.querySelector(`option[value="${year}"]`)) {
          yearSelect.insertAdjacentHTML("beforeend", `<option value="${year}">${year}</option>`);
        }
      });
  }

  const updateCardDistances = () => {
    cards.forEach((card) => {
      const v = catalog[card.dataset.vehicleId];
      const badge = card.querySelector("[data-distance-badge]");
      if (!v || !badge) return;
      if (userLocation && typeof v.lat === "number" && typeof v.lng === "number" && window.calculateHaversineKm) {
        const km = window.calculateHaversineKm(userLocation.lat, userLocation.lng, v.lat, v.lng);
        card.dataset.distanceKm = km !== null ? String(km) : "";
        badge.textContent =
          km !== null
            ? `📍 ${v.city} • ~${km} km (straight-line)`
            : `📍 ${v.city} (Coordinates unavailable)`;
      } else {
        card.dataset.distanceKm = "";
        badge.textContent = `📍 ${v.city || "Jaipur"} (${v.publicHub || "Public Hub"})`;
      }
    });
  };

  const updateActiveButton = () => {
    filterButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === selectedCategory);
    });
  };

  const getFilteredList = () => {
    const searchTerm = normalise(searchInput?.value || "");
    const year = yearSelect?.value || "all";
    const maxPrice = priceMaxSelect?.value || "all";
    const fuel = fuelSelect?.value || "all";
    const maxDist = maxDistanceSelect?.value || "all";

    return originalOrder.filter(({ card }) => {
      const matchesSearch = normalise(card.textContent).includes(searchTerm);
      const matchesCategory = selectedCategory === "all" || card.dataset.category === selectedCategory;
      const matchesYear = year === "all" || String(card.dataset.modelYear) === year;
      const matchesPrice = maxPrice === "all" || getPrice(card) <= Number(maxPrice);
      const matchesFuel = fuel === "all" || card.dataset.fuel === fuel;
      const distVal = card.dataset.distanceKm ? Number(card.dataset.distanceKm) : null;
      const matchesDist =
        maxDist === "all" || !userLocation || (distVal !== null && distVal <= Number(maxDist));

      return matchesSearch && matchesCategory && matchesYear && matchesPrice && matchesFuel && matchesDist;
    });
  };

  const filterVehicles = (resetPage = false) => {
    if (resetPage) currentPage = 1;
    updateCardDistances();
    const sort = sortSelect?.value || "default";
    const visibleCards = getFilteredList();

    visibleCards.sort((a, b) => {
      if (sort === "price-low") return getPrice(a.card) - getPrice(b.card);
      if (sort === "price-high") return getPrice(b.card) - getPrice(a.card);
      if (sort === "rating") return getRating(b.card) - getRating(a.card);
      if (sort === "distance") {
        const da = a.card.dataset.distanceKm ? Number(a.card.dataset.distanceKm) : 999999;
        const db = b.card.dataset.distanceKm ? Number(b.card.dataset.distanceKm) : 999999;
        return da - db;
      }
      return a.index - b.index;
    });

    const pageCount = Math.ceil(visibleCards.length / pageSize);
    currentPage = Math.min(currentPage, Math.max(pageCount, 1));
    const pageCards = visibleCards.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const pageCardSet = new Set(pageCards.map(({ card }) => card));
    cards.forEach((card) => {
      card.hidden = !pageCardSet.has(card);
    });
    pageCards.forEach(({ card }) => {
      vehicleGrid.append(card);
    });

    noVehiclesMessage.hidden = visibleCards.length > 0;
    if (pagination) {
      pagination.hidden = pageCount < 2;
      pagination.innerHTML =
        pageCount > 1
          ? `<button type="button" data-page="previous" ${currentPage === 1 ? "disabled" : ""}>‹ Previous</button>${Array.from(
              { length: pageCount },
              (_, index) =>
                `<button type="button" data-page="${index + 1}" class="${index + 1 === currentPage ? "current" : ""}" ${
                  index + 1 === currentPage ? 'aria-current="page"' : ""
                }>${index + 1}</button>`
            ).join("")}<button type="button" data-page="next" ${currentPage === pageCount ? "disabled" : ""}>Next ›</button>`
          : "";
    }
  };

  const setCategory = (category) => {
    selectedCategory = normalise(category) || "all";
    if (categorySelect) categorySelect.value = category;
    updateActiveButton();
    filterVehicles(true);
  };

  locationCitySelect?.addEventListener("change", () => {
    const cityKey = locationCitySelect.value;
    if (cityKey && cityCoords[cityKey]) {
      userLocation = { ...cityCoords[cityKey] };
      if (locationStatusMsg) {
        locationStatusMsg.textContent = `Showing straight-line (Haversine) distances from ${userLocation.label}.`;
      }
      if (sortSelect) sortSelect.value = "distance";
    } else {
      userLocation = null;
      if (locationStatusMsg) {
        locationStatusMsg.textContent = "Distances are straight-line (Haversine) to the public pickup hub.";
      }
    }
    filterVehicles(true);
  });

  geoBtn?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      if (locationStatusMsg) locationStatusMsg.textContent = "Geolocation is not supported by your browser. Please select a city manually.";
      return;
    }
    if (locationStatusMsg) locationStatusMsg.textContent = "Requesting browser location permission...";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Your Current GPS Location"
        };
        if (locationStatusMsg) {
          locationStatusMsg.textContent = "✔ Using your approximate location for straight-line (Haversine) distance sorting.";
        }
        if (sortSelect) sortSelect.value = "distance";
        filterVehicles(true);
      },
      () => {
        if (locationStatusMsg) {
          locationStatusMsg.textContent = "Location permission denied or unavailable. Please choose a city from the dropdown.";
        }
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => setCategory(button.dataset.filter));
  });
  categorySelect?.addEventListener("change", () => setCategory(categorySelect.value));
  sortSelect?.addEventListener("change", () => filterVehicles(true));
  yearSelect?.addEventListener("change", () => filterVehicles(true));
  priceMaxSelect?.addEventListener("change", () => filterVehicles(true));
  fuelSelect?.addEventListener("change", () => filterVehicles(true));
  maxDistanceSelect?.addEventListener("change", () => filterVehicles(true));

  let debounceTimer;
  document.addEventListener("vehicles:filter", () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => filterVehicles(true), 160);
  });

  pagination?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button || button.disabled) return;
    const lastPage = Math.ceil(getFilteredList().length / pageSize);
    currentPage =
      button.dataset.page === "previous"
        ? currentPage - 1
        : button.dataset.page === "next"
        ? currentPage + 1
        : Number(button.dataset.page);
    currentPage = Math.min(Math.max(currentPage, 1), lastPage || 1);
    filterVehicles();
    vehicleGrid.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.addEventListener("vehicles:ratings-updated", () => filterVehicles());
  updateActiveButton();
  filterVehicles();
});
