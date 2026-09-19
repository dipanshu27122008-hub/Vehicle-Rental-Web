document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("vehicle-search");
  const categorySelect = document.getElementById("vehicle-category");
  const sortSelect = document.getElementById("vehicle-sort");
  const yearSelect = document.getElementById("vehicle-year");
  const vehicleGrid = document.querySelector(".vehicles-list .vehicle-grid");
  const cards = Array.from(document.querySelectorAll(".vehicles-list .vehicle-card"));
  const filterButtons = Array.from(document.querySelectorAll(".filter-chip[data-filter]"));
  const noVehiclesMessage = document.querySelector(".no-vehicles");
  const pagination = document.querySelector(".pagination");

  if (!vehicleGrid || !cards.length || !noVehiclesMessage) return;

  const originalOrder = cards.map((card, index) => ({ card, index }));
  const pageSize = 6;
  let currentPage = 1;
  let selectedCategory = categorySelect?.value || "all";
  const normalise = (value) => value.trim().toLowerCase();
  const getPrice = (card) => Number((card.querySelector(".vehicle-price")?.textContent || "").replace(/[^0-9]/g, ""));
  const getRating = (card) => Number((card.querySelector(".vehicle-rating")?.getAttribute("aria-label") || "").match(/\d+(?:\.\d+)?/)?.[0] || 0);
  const catalog = window.vehicleCatalog || {};
  cards.forEach((card) => {
    const vehicle = catalog[card.dataset.vehicleId];
    if (!vehicle) return;
    card.dataset.modelYear = vehicle.modelYear;
    const type = card.querySelector(".vehicle-type");
    if (type && !card.querySelector(".model-year")) type.insertAdjacentHTML("afterend", `<p class="model-year">Model Year: ${vehicle.modelYear}</p>`);
    const rating = card.querySelector(".vehicle-rating");
    if (rating) {
      rating.textContent = `★★★★★ ${vehicle.rating.toFixed(1)} (${vehicle.reviewCount} Reviews)`;
      rating.setAttribute("aria-label", `Rated ${vehicle.rating.toFixed(1)} out of 5 stars`);
    }
    if (!card.querySelector(".details-button")) card.querySelector(".book-button")?.insertAdjacentHTML("beforebegin", `<button class="btn btn-secondary details-button" type="button" data-vehicle-id="${card.dataset.vehicleId}">View Details</button>`);
  });
  if (yearSelect) {
    [...new Set(Object.values(catalog).map((vehicle) => vehicle.modelYear))].sort((a, b) => b - a)
      .forEach((year) => yearSelect.insertAdjacentHTML("beforeend", `<option value="${year}">${year}</option>`));
  }

  const updateActiveButton = () => {
    filterButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === selectedCategory);
    });
  };

  const filterVehicles = (resetPage = false) => {
    if (resetPage) currentPage = 1;
    const searchTerm = normalise(searchInput?.value || "");
    const sort = sortSelect?.value || "default";
    const year = yearSelect?.value || "all";
    const visibleCards = originalOrder.filter(({ card }) => {
      const matchesSearch = normalise(card.textContent).includes(searchTerm);
      // Categories are matched only against data-category, never card text.
      const matchesCategory = selectedCategory === "all" || card.dataset.category === selectedCategory;
      const matchesYear = year === "all" || String(card.dataset.modelYear) === year;
      return matchesSearch && matchesCategory && matchesYear;
    });

    visibleCards.sort((a, b) => {
      if (sort === "price-low") return getPrice(a.card) - getPrice(b.card);
      if (sort === "price-high") return getPrice(b.card) - getPrice(a.card);
      if (sort === "rating") return getRating(b.card) - getRating(a.card);
      return a.index - b.index;
    });

    const pageCount = Math.ceil(visibleCards.length / pageSize);
    currentPage = Math.min(currentPage, Math.max(pageCount, 1));
    const pageCards = visibleCards.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const pageCardSet = new Set(pageCards.map(({ card }) => card));
    cards.forEach((card) => { card.hidden = !pageCardSet.has(card); });
    pageCards.forEach(({ card }) => {
      vehicleGrid.append(card);
    });

    noVehiclesMessage.hidden = visibleCards.length > 0;
    if (pagination) {
      pagination.hidden = pageCount < 2;
      pagination.innerHTML = pageCount > 1 ? `<button type="button" data-page="previous" ${currentPage === 1 ? "disabled" : ""}>‹ Previous</button>${Array.from({ length: pageCount }, (_, index) => `<button type="button" data-page="${index + 1}" class="${index + 1 === currentPage ? "current" : ""}" ${index + 1 === currentPage ? 'aria-current="page"' : ""}>${index + 1}</button>`).join("")}<button type="button" data-page="next" ${currentPage === pageCount ? "disabled" : ""}>Next ›</button>` : "";
    }
  };

  const setCategory = (category) => {
    selectedCategory = normalise(category) || "all";
    if (categorySelect) categorySelect.value = category;
    updateActiveButton();
    filterVehicles(true);
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => setCategory(button.dataset.filter));
  });
  categorySelect?.addEventListener("change", () => setCategory(categorySelect.value));
  sortSelect?.addEventListener("change", () => filterVehicles(true));
  yearSelect?.addEventListener("change", () => filterVehicles(true));
  document.addEventListener("vehicles:filter", () => filterVehicles(true));
  pagination?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button || button.disabled) return;
    const lastPage = Math.ceil(originalOrder.filter(({ card }) => selectedCategory === "all" || card.dataset.category === selectedCategory).length / pageSize);
    currentPage = button.dataset.page === "previous" ? currentPage - 1 : button.dataset.page === "next" ? currentPage + 1 : Number(button.dataset.page);
    currentPage = Math.min(Math.max(currentPage, 1), lastPage || 1);
    filterVehicles();
    vehicleGrid.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  updateActiveButton();
  filterVehicles();
});
