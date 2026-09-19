/** Persist only the vehicle wishlist, last search, and chosen category. */
document.addEventListener("DOMContentLoaded", () => {
  const keys = {
    wishlist: "drivora-wishlist",
    search: "drivora-vehicle-search",
    filter: "drivora-vehicle-filter"
  };
  const searchInput = document.getElementById("vehicle-search");
  const categorySelect = document.getElementById("vehicle-category");
  const filterButtons = Array.from(document.querySelectorAll(".filter-chip[data-filter]"));
  const cards = Array.from(document.querySelectorAll(".vehicles-list .vehicle-card[data-vehicle-id]"));

  const getWishlist = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(keys.wishlist) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  };

  const saveWishlist = (wishlist) => localStorage.setItem(keys.wishlist, JSON.stringify(wishlist));
  let wishlist = getWishlist();

  const renderWishlist = () => {
    cards.forEach((card) => {
      const button = card.querySelector(".wishlist-button");
      const name = card.querySelector("h3")?.textContent || "vehicle";
      const saved = wishlist.includes(card.dataset.vehicleId);
      button.classList.toggle("is-saved", saved);
      button.setAttribute("aria-pressed", String(saved));
      button.setAttribute("aria-label", `${saved ? "Remove" : "Add"} ${name} ${saved ? "from" : "to"} wishlist`);
      button.innerHTML = saved ? "&#9829;" : "&#9825;";
    });
  };

  cards.forEach((card) => {
    card.querySelector(".wishlist-button").addEventListener("click", () => {
      const id = card.dataset.vehicleId;
      wishlist = wishlist.includes(id) ? wishlist.filter((savedId) => savedId !== id) : [...wishlist, id];
      saveWishlist(wishlist);
      renderWishlist();
    });
  });
  renderWishlist();

  if (searchInput) {
    searchInput.value = localStorage.getItem(keys.search) || "";
    searchInput.addEventListener("input", () => localStorage.setItem(keys.search, searchInput.value));
  }

  const savedFilter = localStorage.getItem(keys.filter);
  if (categorySelect && savedFilter && Array.from(categorySelect.options).some((option) => option.value === savedFilter)) {
    categorySelect.value = savedFilter;
  }
  categorySelect?.addEventListener("change", () => localStorage.setItem(keys.filter, categorySelect.value));
  filterButtons.forEach((button) => button.addEventListener("click", () => localStorage.setItem(keys.filter, button.dataset.filter)));
});
