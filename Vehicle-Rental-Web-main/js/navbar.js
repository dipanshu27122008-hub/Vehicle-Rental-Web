/** Shared responsive navigation behaviour for every Drivora page. */
document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".header");
    const navbar = document.querySelector(".navbar");
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelectorAll(".nav-link");

    if (!header || !navbar || !toggle) return;

    const setMenuState = (isOpen) => {
        navbar.classList.toggle("is-open", isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        toggle.textContent = isOpen ? "✕" : "☰";
    };

    toggle.addEventListener("click", () => setMenuState(!navbar.classList.contains("is-open")));
    links.forEach((link) => link.addEventListener("click", () => setMenuState(false)));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setMenuState(false);
    });

    const mobileQuery = window.matchMedia("(max-width: 700px)");
    mobileQuery.addEventListener("change", (event) => {
        if (!event.matches) setMenuState(false);
    });

    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-link:not(.book-now)").forEach((link) => {
        const linkPath = new URL(link.href).pathname.split("/").pop();
        const isCurrentPage = linkPath === currentPath;
        link.classList.toggle("active", isCurrentPage);
        if (isCurrentPage) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    });

    const updateScrollState = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
});
