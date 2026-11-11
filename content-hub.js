const contentRoot = () => document.querySelector("main.content-hub");

const navigateContentHub = async (href, push = true) => {
  const current = contentRoot();
  if (!current) return;
  current.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(href, { headers: { Accept: "text/html" }, cache: "no-store" });
    if (!response.ok) throw new Error("CONTENT_HUB_NAVIGATION_FAILED");
    const documentHtml = new DOMParser().parseFromString(await response.text(), "text/html");
    const next = documentHtml.querySelector("main.content-hub");
    if (!next) throw new Error("CONTENT_HUB_PAGE_MISSING");
    current.replaceWith(next);
    if (push) history.pushState({}, "", href);
    bindContentHub();
  } catch {
    current.removeAttribute("aria-busy");
  }
};

const bindContentHub = () => {
  const root = contentRoot();
  if (!root) return;
  root.querySelectorAll(".content-calendar__day[href], .content-calendar__toolbar a[href]").forEach((link) => link.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigateContentHub(link.href);
  }));

  const dialog = root.querySelector("#content-hub-form");
  if (dialog?.hasAttribute("open") && dialog.showModal) {
    dialog.removeAttribute("open");
    dialog.showModal();
  }
  root.querySelectorAll("[data-open-content-form]").forEach((trigger) => trigger.addEventListener("click", (event) => {
    if (!dialog?.showModal) return;
    event.preventDefault();
    dialog.showModal();
    dialog.querySelector("[name=scheduledFor]")?.focus();
  }));
  root.querySelector("[data-close-content-form]")?.addEventListener("click", () => dialog?.close());
  dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  const preview = root.querySelector("#content-hub-preview");
  const media = preview?.querySelector(".content-preview__media");
  const closePreview = () => { preview?.close(); if (media) { media.replaceChildren(); media.style.width = ""; } };
  root.querySelectorAll("[data-open-content-preview]").forEach((button) => button.addEventListener("click", () => {
    if (!preview?.showModal || !media) return;
    const isVideo = button.dataset.type === "video";
    const element = document.createElement(isVideo ? "video" : "img");
    element.src = `/api/club-tools?view=content-hub-preview&id=${encodeURIComponent(button.dataset.id)}`;
    if (isVideo) { element.controls = true; element.preload = "metadata"; }
    else element.alt = button.dataset.name || "Geplande afbeelding";
    const fitMedia = () => {
      const width = isVideo ? element.videoWidth : element.naturalWidth;
      const height = isVideo ? element.videoHeight : element.naturalHeight;
      if (width && height) media.style.width = `${Math.floor(Math.min(780, window.innerWidth - 72, width * Math.max(160, window.innerHeight - 200) / height))}px`;
    };
    element.addEventListener(isVideo ? "loadedmetadata" : "load", fitMedia, { once: true });
    preview.querySelector("[data-preview-title]").textContent = button.dataset.fileName || "Bestand";
    const note = preview.querySelector("[data-preview-note]");
    note.textContent = button.dataset.note || "";
    note.hidden = !note.textContent;
    media.style.width = "min(360px, calc(100vw - 72px))";
    media.replaceChildren(element);
    preview.showModal();
  }));
  preview?.querySelector("[data-close-content-preview]")?.addEventListener("click", closePreview);
  preview?.addEventListener("click", (event) => { if (event.target === preview) closePreview(); });
  preview?.addEventListener("close", () => { if (media) { media.replaceChildren(); media.style.width = ""; } });

  const form = root.querySelector(".content-form");
  if (!form?.querySelector("[data-content-hub-file]")) return;
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = form.querySelector("[data-content-hub-file]")?.files[0];
    const type = form.querySelector("[name=type]")?.value;
    const message = form.querySelector(".content-form__hint");
    const submit = form.querySelector("button[type=submit]");
    const setStatus = (text) => { if (message) message.textContent = text; };
    const valid = type === "video" ? ["video/mp4", "video/quicktime"].includes(file?.type) && file.size <= 100 * 1024 * 1024 : ["image/jpeg", "image/png", "image/webp"].includes(file?.type) && file.size <= 15 * 1024 * 1024;
    if (!file || !valid) { setStatus("Kies een geldig bestand binnen de limiet."); return; }
    if (submit) { submit.disabled = true; submit.textContent = "Bezig…"; }
    let step = "Uploadsessie aanvragen bij AjaxPro";
    try {
      setStatus(`1/3 ${step}…`);
      const session = await fetch(`/api/club-tools?view=content-hub-upload-session&type=${type}&mime=${encodeURIComponent(file.type)}&size=${file.size}&name=${encodeURIComponent(file.name)}`);
      if (!session.ok) {
        const body = await session.json().catch(() => null);
        throw new Error(`AjaxPro HTTP ${session.status}: ${body?.error || "Uploadsessie kon niet worden aangemaakt."}`);
      }
      const { ticket } = await session.json();
      if (typeof ticket !== "string" || !ticket) throw new Error("AjaxPro gaf geen geldige uploadsessie terug.");
      step = "Bestand uploaden naar AjaxPro";
      setStatus("2/3 Bestand uploaden naar AjaxPro… 0%");
      let uploaded;
      for (let offset = 0; offset < file.size;) {
        const chunk = file.slice(offset, Math.min(offset + 2 * 1024 * 1024, file.size));
        const response = await fetch("/api/club-tools?view=content-hub-upload-chunk", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream", "X-Content-Hub-Ticket": ticket, "X-Content-Hub-Start": String(offset) },
          body: chunk,
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(`AjaxPro HTTP ${response.status}: ${result?.error || "Uploadchunk kon niet worden verwerkt."}`);
        if (result?.complete) { uploaded = result.file; break; }
        if (!Number.isSafeInteger(result?.next) || result.next <= offset || result.next > file.size) throw new Error("Google Drive gaf geen geldige uploadvoortgang terug.");
        offset = result.next;
        setStatus(`2/3 Bestand uploaden naar AjaxPro… ${Math.round(offset / file.size * 100)}%`);
      }
      if (!uploaded?.id) throw new Error("Google Drive gaf geen voltooid bestand terug.");
      step = "Upload afronden en post opslaan";
      setStatus(`3/3 ${step}…`);
      for (const [name, value] of [["driveFileId", uploaded.id], ["driveFileName", uploaded.name || file.name], ["driveMimeType", uploaded.mimeType || file.type], ["driveFileSize", String(file.size)]]) { const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.append(input); }
      form.submit();
    } catch (error) { setStatus(`${step} mislukt: ${error instanceof Error ? error.message : "Onbekende fout."}`); if (submit) { submit.disabled = false; submit.textContent = "Post toevoegen"; } }
  });
};

window.addEventListener("popstate", () => navigateContentHub(location.href, false));
bindContentHub();
