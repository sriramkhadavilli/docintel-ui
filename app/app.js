const pdfInput = document.getElementById("pdf");
const btn = document.getElementById("btn");
const msg = document.getElementById("msg");

function setMsg(text, type) {
  msg.className = `msg ${type}`;
  msg.textContent = text;
  msg.style.display = "block";
}

btn.addEventListener("click", async () => {
  const file = pdfInput.files[0];
  if (!file) {
    setMsg("Please choose a PDF file.", "err");
    return;
  }

  btn.disabled = true;
  setMsg("Uploading… Converting… Please wait.", "ok");

  try {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/convert", {
      method: "POST",
      body: form
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed: ${res.status}`);
    }

    const blob = await res.blob();

    const cd = res.headers.get("Content-Disposition") || "";
    let filename = "converted.docx";
    const m = cd.match(/filename="(.+?)"/);
    if (m?.[1]) filename = m[1];

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setMsg("Done! Download should start automatically.", "ok");
  } catch (e) {
    setMsg(`Error: ${e.message}`, "err");
  } finally {
    btn.disabled = false;
  }
});
