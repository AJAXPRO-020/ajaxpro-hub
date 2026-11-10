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
      const { uploadUrl } = await session.json();
      if (typeof uploadUrl !== "string" || !uploadUrl.startsWith("https://www.googleapis.com/upload/drive/v3/files")) throw new Error("AjaxPro gaf geen geldige uploadsessie terug.");
      step = "Bestand uploaden naar Google Drive";
      setStatus("2/3 Bestand uploaden naar Google Drive… 0%");
      const uploaded = await new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", uploadUrl);
        request.timeout = 120000;
        request.setRequestHeader("Content-Range", `bytes 0-${file.size - 1}/${file.size}`);
        request.upload.onprogress = (progress) => { if (progress.lengthComputable) setStatus(`2/3 Bestand uploaden naar Google Drive… ${Math.round(progress.loaded / progress.total * 100)}%`); };
        request.onload = () => {
          if (request.status < 200 || request.status >= 300) {
            let reason = "Google API wees de upload af.";
            try { reason = JSON.parse(request.responseText)?.error?.message || reason; } catch { /* Geen leesbare API-fout. */ }
            reject(new Error(`Google API HTTP ${request.status}: ${reason.slice(0, 180)}`));
            return;
          }
          try { resolve(JSON.parse(request.responseText)); } catch { reject(new Error("Google API gaf een onleesbare response terug.")); }
        };
        request.onerror = () => reject(new Error("Netwerkfout of CORS-blokkade (HTTP-status niet beschikbaar). Controleer de browserconsole."));
        request.ontimeout = () => reject(new Error("Netwerk-timeout na 120 seconden (HTTP-status niet beschikbaar)."));
        request.send(file);
      });
      step = "Upload afronden en post opslaan";
      setStatus(`3/3 ${step}…`);
      for (const [name, value] of [["driveFileId", uploaded.id], ["driveFileName", uploaded.name || file.name], ["driveMimeType", uploaded.mimeType || file.type], ["driveFileSize", String(file.size)]]) { const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.append(input); }
      form.submit();
    } catch (error) { setStatus(`${step} mislukt: ${error instanceof Error ? error.message : "Onbekende fout."}`); if (submit) { submit.disabled = false; submit.textContent = "Post toevoegen"; } }
  });
};

window.addEventListener("popstate", () => navigateContentHub(location.href, false));
bindContentHub();
