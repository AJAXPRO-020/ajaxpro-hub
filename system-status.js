const copyButton = document.querySelector("[data-copy-system-report]");
const reportSource = document.querySelector("[data-system-report]");
const copyFeedback = document.querySelector("[data-copy-feedback]");

const fallbackCopy = (value) => {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("copy_failed");
};

copyButton?.addEventListener("click", async () => {
  const report = reportSource?.value;
  if (!report) return;
  copyButton.disabled = true;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(report);
    else fallbackCopy(report);
    copyFeedback.textContent = "Systeemrapport gekopieerd.";
  } catch {
    copyFeedback.textContent = "Kopiëren is niet gelukt. Probeer het opnieuw.";
  } finally {
    copyButton.disabled = false;
  }
});
