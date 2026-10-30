(() => {
  const archive = document.querySelector("[data-video-archive]");
  if (!archive) return;

  const grid = archive.querySelector("[data-video-grid]");
  const cards = Array.from(archive.querySelectorAll("[data-video-card]"));
  const filters = Array.from(archive.querySelectorAll("[data-category]"));
  const search = archive.querySelector("[data-video-search]");
  const sort = archive.querySelector("[data-video-sort]");
  const loadMore = archive.querySelector("[data-video-load-more]");
  const results = archive.querySelector("[data-video-results]");
  const empty = archive.querySelector("[data-video-empty]");
  const dialog = document.querySelector("[data-video-dialog]");
  const playerFrame = dialog?.querySelector("[data-video-frame]");
  const playerTitle = dialog?.querySelector("[data-video-dialog-title]");
  const closeButton = dialog?.querySelector("[data-video-close]");

  let activeCategory = "all";
  let visibleCount = 12;

  const searchable = value => value.toLocaleLowerCase("nl-NL").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const render = () => {
    const query = searchable(search.value.trim());
    const order = sort.value;
    const matches = cards.filter(card => {
      const categoryMatch = activeCategory === "all" || card.dataset.category === activeCategory;
      return categoryMatch && searchable(card.dataset.title || "").includes(query);
    }).sort((a, b) => {
      if (order === "oldest") return Number(a.dataset.date) - Number(b.dataset.date);
      if (order === "views") return Number(b.dataset.views) - Number(a.dataset.views);
      return Number(b.dataset.date) - Number(a.dataset.date);
    });

    cards.forEach(card => { card.hidden = true; });
    matches.forEach((card, index) => {
      grid.append(card);
      card.hidden = index >= visibleCount;
    });

    const shown = Math.min(visibleCount, matches.length);
    results.textContent = `${shown} van ${matches.length} video${matches.length === 1 ? "" : "'s"}`;
    loadMore.hidden = shown >= matches.length;
    empty.hidden = matches.length !== 0;
  };

  filters.forEach(filter => filter.addEventListener("click", () => {
    activeCategory = filter.dataset.category;
    visibleCount = 12;
    filters.forEach(item => {
      const active = item === filter;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    render();
  }));

  search.addEventListener("input", () => { visibleCount = 12; render(); });
  sort.addEventListener("change", () => { visibleCount = 12; render(); });
  loadMore.addEventListener("click", () => { visibleCount += 12; render(); });

  const closePlayer = () => {
    if (dialog?.open) dialog.close();
  };
  const clearPlayer = () => {
    if (playerFrame) playerFrame.replaceChildren();
    document.body.classList.remove("video-player-open");
  };

  grid.addEventListener("click", event => {
    const trigger = event.target.closest("[data-video-id]");
    if (!trigger || !dialog || !playerFrame || !playerTitle) return;
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trigger.dataset.videoId)}?autoplay=1&rel=0`;
    iframe.title = trigger.dataset.videoTitle;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    playerTitle.textContent = trigger.dataset.videoTitle;
    playerFrame.replaceChildren(iframe);
    dialog.showModal();
    document.body.classList.add("video-player-open");
  });

  closeButton?.addEventListener("click", closePlayer);
  dialog?.addEventListener("click", event => { if (event.target === dialog) closePlayer(); });
  dialog?.addEventListener("close", clearPlayer);
  render();
})();
