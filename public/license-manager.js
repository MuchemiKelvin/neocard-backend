const form = document.querySelector("#load-form");
const message = document.querySelector("#message");
const manager = document.querySelector("#manager");

function showMessage(text) {
  message.hidden = !text;
  message.textContent = text || "";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fillList(element, items, emptyText) {
  element.replaceChildren();
  const values = items.length ? items : [emptyText];
  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    element.appendChild(item);
  });
}

function render(license, activity) {
  document.querySelector("#school-name").textContent = license.school_name || license.tenant_id;
  document.querySelector("#school-id").textContent = license.tenant_id;
  const status = document.querySelector("#status");
  status.textContent = license.license_status;
  status.className = license.license_status === "ACTIVE" ? "badge" : "badge warn";
  document.querySelector("#expires").textContent = formatDate(license.expires_at);
  document.querySelector("#renewed").textContent = formatDate(license.renewed_at);
  document.querySelector("#seats").textContent = `${license.active_seats} / ${license.seat_limit}`;
  const seatRatio = license.seat_limit ? (license.active_seats / license.seat_limit) * 100 : 0;
  document.querySelector("#seat-bar").style.width = `${Math.min(seatRatio, 100)}%`;
  document.querySelector("#storage").textContent = `${license.storage_used_gb ?? 0} / ${license.storage_quota_gb ?? 0} GB`;
  document.querySelector("#per-student").textContent = license.storage_per_student_gb == null
    ? "Per-student quota is not set"
    : `${license.storage_per_student_gb} GB per student`;
  const storageRatio = license.storage_quota_gb
    ? (license.storage_used_gb / license.storage_quota_gb) * 100
    : 0;
  document.querySelector("#storage-bar").style.width = `${Math.min(storageRatio, 100)}%`;
  fillList(document.querySelector("#products"), license.products || [], "No products on this license");
  fillList(document.querySelector("#devices"), license.devices || [], "No devices linked");

  const body = document.querySelector("#activity");
  body.replaceChildren();
  const rows = activity.length ? activity : [{ at: null, action: "No license decisions yet", decision: "—", code: "—" }];
  rows.forEach((event) => {
    const row = document.createElement("tr");
    [formatDate(event.at), event.action, event.decision || "—", event.code || "—"].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
  manager.hidden = false;
}

async function loadLicense(tenantId) {
  const response = await fetch(`/license-manager/data?tenant=${encodeURIComponent(tenantId)}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || "License could not be loaded");
  }
  render(body.data, body.activity || []);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const tenantId = document.querySelector("#tenant-id").value.trim();
  showMessage("");
  try {
    await loadLicense(tenantId);
  } catch (error) {
    manager.hidden = true;
    showMessage(error.message);
  }
});

document.querySelector("#renew").addEventListener("click", async () => {
  const tenantId = document.querySelector("#tenant-id").value.trim();
  const response = await fetch("/license-manager/renew", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant_id: tenantId })
  });
  const body = await response.json();
  if (!response.ok) {
    showMessage(body.message || "Renewal failed");
    return;
  }
  showMessage("");
  render(body.data, body.activity || []);
});

loadLicense(document.querySelector("#tenant-id").value.trim()).catch((error) => {
  showMessage(error.message);
});
