/** Persist vehicle wishlist (localStorage + Supabase favourites sync), last search, and chosen category. */
document.addEventListener("DOMContentLoaded", () => {
  const keys = {
    wishlist: "drivora-wishlist",
    search: "drivora-vehicle-search",
    filter: "drivora-vehicle-filter"
  };
  const searchInput = document.getElementById("vehicle-search");
  const categorySelect = document.getElementById("vehicle-category");
  const filterButtons = Array.from(document.querySelectorAll(".filter-chip[data-filter]"));
  const getCards = () => Array.from(document.querySelectorAll(".vehicles-list .vehicle-card[data-vehicle-id]"));

  const getWishlist = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(keys.wishlist) || "[]");
      return Array.isArray(saved) ? [...new Set(saved)] : [];
    } catch {
      return [];
    }
  };

  const saveWishlist = (wishlist) => {
    const unique = [...new Set(wishlist)];
    localStorage.setItem(keys.wishlist, JSON.stringify(unique));
  };

  let wishlist = getWishlist();

  const renderWishlist = () => {
    getCards().forEach((card) => {
      const button = card.querySelector(".wishlist-button");
      if (!button) return;
      const name = card.querySelector("h3")?.textContent || "vehicle";
      const saved = wishlist.includes(card.dataset.vehicleId);
      button.classList.toggle("is-saved", saved);
      button.setAttribute("aria-pressed", String(saved));
      button.setAttribute("aria-label", `${saved ? "Remove" : "Add"} ${name} ${saved ? "from" : "to"} wishlist`);
      button.innerHTML = saved ? "&#9829;" : "&#9825;";
    });
  };

  // Sync with Supabase favourites when authenticated
  const syncWithBackend = async () => {
    const authHeaders = window.DrivoraAuth?.getAuthHeaders?.();
    if (!authHeaders?.Authorization) return;
    try {
      const res = await fetch("/api/vehicles?resource=favourites", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ vehicleIds: wishlist })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.favourites)) {
          wishlist = [...new Set([...wishlist, ...data.favourites])];
          saveWishlist(wishlist);
          renderWishlist();
        }
      }
    } catch {}
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".wishlist-button");
    if (!button) return;
    const card = button.closest(".vehicle-card[data-vehicle-id]");
    if (!card) return;
    const id = card.dataset.vehicleId;
    const wasSaved = wishlist.includes(id);
    wishlist = wasSaved ? wishlist.filter((savedId) => savedId !== id) : [...wishlist, id];
    saveWishlist(wishlist);
    renderWishlist();

    const authHeaders = window.DrivoraAuth?.getAuthHeaders?.();
    if (authHeaders?.Authorization) {
      if (wasSaved) {
        fetch(`/api/vehicles?resource=favourites&vehicleId=${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: authHeaders
        }).catch(() => {});
      } else {
        fetch("/api/vehicles?resource=favourites", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ vehicleId: id })
        }).catch(() => {});
      }
    }
  });

  document.addEventListener("drivora:auth-changed", syncWithBackend);
  renderWishlist();
  syncWithBackend();

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
