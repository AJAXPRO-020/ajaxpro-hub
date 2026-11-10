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
  root.querySelectorAll("[data-open-content-form]").forEach((trigger) => trigger.addEventListener("click", (event) => {
    if (!dialog?.showModal) return;
    event.preventDefault();
    dialog.showModal();
    dialog.querySelector("[name=scheduledFor]")?.focus();
  }));
  root.querySelector("[data-close-content-form]")?.addEventListener("click", () => dialog?.close());
  dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  const form = root.querySelector(".content-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = form.querySelector("[data-content-hub-file]")?.files[0];
    const type = form.querySelector("[name=type]")?.value;
    const message = form.querySelector(".content-form__hint");
    const valid = type === "video" ? ["video/mp4", "video/quicktime"].includes(file?.type) && file.size <= 100 * 1024 * 1024 : ["image/jpeg", "image/png", "image/webp"].includes(file?.type) && file.size <= 15 * 1024 * 1024;
    if (!file || !valid) { if (message) message.textContent = "Kies een geldig bestand binnen de limiet."; return; }
    if (message) message.textContent = "Upload voorbereiden…";
    const session = await fetch(`/api/club-tools?view=content-hub-upload-session&type=${type}&mime=${encodeURIComponent(file.type)}&size=${file.size}&name=${encodeURIComponent(file.name)}`);
    if (!session.ok) { if (message) message.textContent = "Upload voorbereiden mislukt."; return; }
    const { uploadUrl } = await session.json();
    const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Length": file.size, "Content-Range": `bytes 0-${file.size - 1}/${file.size}` }, body: file });
    if (!response.ok) { if (message) message.textContent = "Upload mislukt. Probeer het opnieuw."; return; }
    const uploaded = await response.json();
    for (const [name, value] of [["driveFileId", uploaded.id], ["driveFileName", uploaded.name || file.name], ["driveMimeType", uploaded.mimeType || file.type], ["driveFileSize", String(file.size)]]) { const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.append(input); }
    form.submit();
  });
};

window.addEventListener("popstate", () => navigateContentHub(location.href, false));
bindContentHub();
