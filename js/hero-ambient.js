/**
 * Drivora Hero Ambient Live Canvas Engine (js/hero-ambient.js)
 * Inspired by high-end automotive design & interactive particle canvas.
 * - Fluid pointer-following luminous aura with inertia interpolation.
 * - Floating luxury ambient motes with subtle connecting filaments.
 * - Auto-pauses on scroll out of viewport (IntersectionObserver) & tab switch (visibilitychange).
 * - Honors prefers-reduced-motion: reduce by rendering a single static backdrop without loop.
 * - High-DPI crisp retina scaling capped at DPR 2 for optimal 60fps performance.
 */
(function () {
  "use strict";

  function initHeroAmbient() {
    const canvas = document.getElementById("hero-ambient-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const heroSection = canvas.closest(".hero") || canvas.parentElement;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrameId = null;
    let isRunning = false;
    let isVisible = true;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Pointer state with smooth spring inertia
    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      active: false
    };

    // Color palette matching Drivora's luxury glass aesthetic
    const colors = [
      "rgba(37, 99, 235, ",    // Primary Royal Blue
      "rgba(59, 130, 246, ",   // Electric Blue
      "rgba(16, 185, 129, ",   // Emerald Accent
      "rgba(245, 158, 11, ",   // Warm Amber Gold
      "rgba(99, 102, 241, "    // Indigo
    ];

    let particles = [];
    const PARTICLE_COUNT = 45;
    const CONNECT_DIST = 95;

    function resize() {
      if (!canvas || !heroSection) return;
      const rect = heroSection.getBoundingClientRect();
      width = Math.max(300, Math.floor(rect.width));
      height = Math.max(250, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      if (!pointer.active) {
        pointer.x = width * 0.55;
        pointer.y = height * 0.45;
        pointer.targetX = pointer.x;
        pointer.targetY = pointer.y;
      }

      initParticles();

      if (prefersReducedMotion) {
        drawFrame(0);
      }
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          radius: Math.random() * 2.2 + 1.0,
          baseAlpha: Math.random() * 0.45 + 0.25,
          alpha: 0.3,
          color: colors[i % colors.length],
          pulseSpeed: 0.02 + Math.random() * 0.02,
          pulseOffset: Math.random() * Math.PI * 2
        });
      }
    }

    function onPointerMove(e) {
      const rect = canvas.getBoundingClientRect();
      pointer.targetX = e.clientX - rect.left;
      pointer.targetY = e.clientY - rect.top;
      pointer.active = true;
    }

    function onPointerLeave() {
      pointer.targetX = width * 0.55;
      pointer.targetY = height * 0.45;
      pointer.active = false;
    }

    function drawFrame(time) {
      if (!width || !height) return;

      // Pointer inertia smoothing
      pointer.x += (pointer.targetX - pointer.x) * 0.06;
      pointer.y += (pointer.targetY - pointer.y) * 0.06;

      ctx.clearRect(0, 0, width, height);

      // 1. Dynamic luxury ambient aura following pointer
      const auraGradient = ctx.createRadialGradient(
        pointer.x, pointer.y, 0,
        pointer.x, pointer.y, Math.max(220, width * 0.35)
      );
      auraGradient.addColorStop(0, "rgba(59, 130, 246, 0.12)");
      auraGradient.addColorStop(0.35, "rgba(16, 185, 129, 0.06)");
      auraGradient.addColorStop(0.7, "rgba(245, 158, 11, 0.03)");
      auraGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = auraGradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle secondary background glow on vehicle side
      const secondaryGlow = ctx.createRadialGradient(
        width * 0.78, height * 0.48, 10,
        width * 0.78, height * 0.48, width * 0.4
      );
      secondaryGlow.addColorStop(0, "rgba(37, 99, 235, 0.08)");
      secondaryGlow.addColorStop(0.6, "rgba(99, 102, 241, 0.03)");
      secondaryGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = secondaryGlow;
      ctx.fillRect(0, 0, width, height);

      // 3. Update & render particles
      const t = (time || 0) * 0.001;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          // Wrap edges
          if (p.x < -10) p.x = width + 10;
          else if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          else if (p.y > height + 10) p.y = -10;

          // Gentle sinusoidal breathing
          p.alpha = p.baseAlpha + Math.sin(t * 2 + p.pulseOffset) * 0.15;
        }

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.max(0.05, Math.min(0.9, p.alpha)) + ")";
        ctx.fill();

        // 4. Draw connecting filaments to nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < CONNECT_DIST * CONNECT_DIST) {
            const dist = Math.sqrt(distSq);
            const lineAlpha = (1 - dist / CONNECT_DIST) * 0.18;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = "rgba(59, 130, 246, " + lineAlpha + ")";
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // 5. Filament to mouse pointer if close
        const pDistX = p.x - pointer.x;
        const pDistY = p.y - pointer.y;
        const pDistSq = pDistX * pDistX + pDistY * pDistY;
        const pointerReach = 130;
        if (pDistSq < pointerReach * pointerReach) {
          const dist = Math.sqrt(pDistSq);
          const pLineAlpha = (1 - dist / pointerReach) * 0.28;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.strokeStyle = "rgba(245, 158, 11, " + pLineAlpha + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    function animate(time) {
      if (!isRunning) return;
      drawFrame(time);
      animationFrameId = requestAnimationFrame(animate);
    }

    function start() {
      if (isRunning || prefersReducedMotion) return;
      isRunning = true;
      animationFrameId = requestAnimationFrame(animate);
    }

    function stop() {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }

    // Event listeners
    window.addEventListener("resize", resize, { passive: true });
    if (heroSection) {
      heroSection.addEventListener("mousemove", onPointerMove, { passive: true });
      heroSection.addEventListener("mouseleave", onPointerLeave, { passive: true });
    }

    // Tab visibility handling: pause when tab hidden
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stop();
      } else if (isVisible) {
        start();
      }
    });

    // Viewport intersection handling: pause when hero is scrolled out of view
    if ("IntersectionObserver" in window && heroSection) {
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          isVisible = entry.isIntersecting;
          if (isVisible) {
            start();
          } else {
            stop();
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(heroSection);
    } else {
      start();
    }

    // Initial setup
    resize();
    if (!prefersReducedMotion) {
      start();
    }

    window.DrivoraHeroAmbient = {
      start,
      stop,
      resize
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeroAmbient);
  } else {
    initHeroAmbient();
  }
})();
