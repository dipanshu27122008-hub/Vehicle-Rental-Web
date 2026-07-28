document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("vehicle-search");
  if (!searchInput) return;

  // filter.js applies the current text together with the selected category.
  searchInput.addEventListener("input", () => {
    document.dispatchEvent(new CustomEvent("vehicles:filter"));
  });
});
