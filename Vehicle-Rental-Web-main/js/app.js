/**
 * Shared site bootstrap.
 * Keep page-specific features in their own modules and place reusable
 * behaviour here so every Drivora page can use it.
 */
document.addEventListener("DOMContentLoaded", () => {
    console.log("Drivora website loaded successfully!");

    // Smoothly scroll to in-page anchors while keeping normal page links intact.
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            const target = document.querySelector(link.getAttribute("href"));

            if (!target) return;

            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
});

/** Scroll the current page back to its top. */
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}

window.scrollToTop = scrollToTop;
