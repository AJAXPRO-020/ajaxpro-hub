const root = document.querySelector(".match-center-main");
if (root) {
  const selector = root.querySelector("[data-match-select]");
  selector?.addEventListener("change", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("match", selector.value);
    window.location.assign(url);
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion && "IntersectionObserver" in window) {
    const revealTargets = [...root.querySelectorAll(".match-center-navigation, .match-center-hero, .match-center-section > header, .match-center-stat, .match-center-player")];
    root.classList.add("match-center-motion");
    revealTargets.forEach((target) => {
      target.classList.add("mc-reveal");
      const group = target.closest(".match-center-headline, .match-center-supporting, .match-center-players");
      if (group) {
        const index = [...group.children].indexOf(target);
        target.style.setProperty("--mc-reveal-delay", `${Math.max(index, 0) % 3 * 42}ms`);
      }
    });

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

    revealTargets.forEach((target) => revealObserver.observe(target));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const bar = entry.target;
        requestAnimationFrame(() => {
          bar.querySelectorAll("i, b").forEach((segment) => {
            segment.style.transition = "transform 620ms cubic-bezier(.16,1,.3,1)";
            segment.style.transform = "scaleX(1)";
          });
        });
        observer.unobserve(bar);
      });
    }, { threshold: 0.25 });

    root.querySelectorAll(".match-center-stat__bar").forEach((bar) => {
      bar.querySelectorAll("i, b").forEach((segment) => {
        segment.style.transform = "scaleX(0)";
      });
      observer.observe(bar);
    });
  }
}
