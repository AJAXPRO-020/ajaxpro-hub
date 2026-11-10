const form = document.querySelector(".content-form");
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = form.querySelector("[data-content-hub-file]").files[0];
  const type = form.querySelector("[name=type]").value;
  const message = form.querySelector(".content-form__hint");
  const valid = type === "video" ? ["video/mp4", "video/quicktime"].includes(file?.type) && file.size <= 100 * 1024 * 1024 : ["image/jpeg", "image/png", "image/webp"].includes(file?.type) && file.size <= 15 * 1024 * 1024;
  if (!file || !valid) { message.textContent = "Kies een geldig bestand binnen de limiet."; return; }
  message.textContent = "Upload voorbereiden…";
  const session = await fetch(`/api/club-tools?view=content-hub-upload-session&type=${type}&mime=${encodeURIComponent(file.type)}&size=${file.size}&name=${encodeURIComponent(file.name)}`);
  if (!session.ok) { message.textContent = "Upload voorbereiden mislukt."; return; }
  const { uploadUrl } = await session.json();
  const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Length": file.size, "Content-Range": `bytes 0-${file.size - 1}/${file.size}` }, body: file });
  if (!response.ok) { message.textContent = "Upload mislukt. Probeer het opnieuw."; return; }
  const uploaded = await response.json();
  for (const [name, value] of [["driveFileId", uploaded.id], ["driveFileName", uploaded.name || file.name], ["driveMimeType", uploaded.mimeType || file.type], ["driveFileSize", String(file.size)]]) { const input = document.createElement("input"); input.type = "hidden"; input.name = name; input.value = value; form.append(input); }
  form.submit();
});
