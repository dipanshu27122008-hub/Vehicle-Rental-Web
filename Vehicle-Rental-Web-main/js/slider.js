document.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("hero-slider");
  const firstImage = document.getElementById("hero-image");
  const secondImage = document.getElementById("hero-image-next");
  if (!slider || !firstImage || !secondImage) return;

  const slides = [
    ["./assets/hero/car1.png", "Luxury SUV"], ["./assets/hero/car2.jpg", "Premium rental car"],
    ["./assets/hero/car3.jpg", "Modern luxury car"], ["./assets/hero/car4.jpg", "Drivora featured vehicle"],
    ["./assets/vehicles/bmw x5.jpg", "BMW X5 SUV"], ["./assets/vehicles/audi q7.jpg", "Audi Q7 luxury SUV"],
    ["./assets/vehicles/model 3.jpg", "Tesla Model 3 electric car"], ["./assets/vehicles/luxuryi7.jpg", "BMW i7 luxury electric car"],
    ["./assets/vehicles/convertiblemini.jpg", "Mini Convertible"], ["./assets/vehicles/bikegt650.jpg", "Continental GT 650 motorcycle"]
  ];
  let current = 0;
  let activeImage = firstImage;
  let timer;
  const dots = slider.querySelector(".slider-dots");

  slides.forEach(([src]) => { const image = new Image(); image.src = src; });
  dots.innerHTML = slides.map(([, alt], index) => `<button type="button" aria-label="Show ${alt}" aria-current="${index === 0 ? "true" : "false"}"></button>`).join("");

  const updateDots = () => dots.querySelectorAll("button").forEach((dot, index) => dot.setAttribute("aria-current", String(index === current)));
  const showSlide = (index) => {
    current = (index + slides.length) % slides.length;
    const incoming = activeImage === firstImage ? secondImage : firstImage;
    const [src, alt] = slides[current];
    const reveal = () => {
      activeImage.classList.remove("is-active");
      incoming.classList.add("is-active");
      activeImage = incoming;
      updateDots();
    };
    incoming.src = src; incoming.alt = alt;
    if (incoming.complete) reveal(); else incoming.addEventListener("load", reveal, { once: true });
  };
  const restartTimer = () => { window.clearInterval(timer); timer = window.setInterval(() => showSlide(current + 1), 4500); };
  slider.querySelector(".slider-control--previous").addEventListener("click", () => { showSlide(current - 1); restartTimer(); });
  slider.querySelector(".slider-control--next").addEventListener("click", () => { showSlide(current + 1); restartTimer(); });
  dots.addEventListener("click", (event) => { const index = [...dots.children].indexOf(event.target); if (index >= 0) { showSlide(index); restartTimer(); } });
  slider.addEventListener("mouseenter", () => window.clearInterval(timer));
  slider.addEventListener("mouseleave", restartTimer);
  restartTimer();
});
