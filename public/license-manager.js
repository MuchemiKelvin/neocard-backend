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

function fillTable(body, rows, columns, emptyCells) {
  body.replaceChildren();
  const values = rows.length ? rows : [emptyCells];
  values.forEach((item) => {
    const row = document.createElement("tr");
    columns.forEach((column) => {
      const cell = document.createElement("td");
      cell.textContent = column(item);
      row.appendChild(cell);
    });
    body.appendChild(row);
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
  const products = document.querySelector("#products");
  products.replaceChildren();
  const cards = license.product_cards?.length
    ? license.product_cards
    : (license.products || []).map((product) => ({ product, summary: "" }));
  if (!cards.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No products on this license";
    products.appendChild(empty);
  }
  cards.forEach((card) => {
    const item = document.createElement("article");
    item.className = "product";
    const name = document.createElement("strong");
    name.textContent = card.product;
    const summary = document.createElement("p");
    summary.className = "muted";
    summary.textContent = card.summary || "";
    item.append(name, summary);
    products.appendChild(item);
  });

  const details = license.device_details || (license.devices || []).map((deviceId) => ({
    device_id: deviceId,
    device_type: "—",
    security_status: "—",
    last_valid_at: null
  }));
  fillTable(
    document.querySelector("#devices"),
    details,
    [
      (item) => item.device_name || item.device_id,
      (item) => item.device_type || "—",
      (item) => item.security_status || "—",
      (item) => formatDate(item.last_valid_at)
    ],
    { device_id: "No devices linked", device_type: "—", security_status: "—", last_valid_at: null }
  );
  fillTable(
    document.querySelector("#students"),
    license.students || [],
    [
      (item) => item.user_id,
      (item) => formatDate(item.activated_at),
      (item) => item.used_bytes == null ? "—" : `${item.used_bytes} bytes`
    ],
    { user_id: "No seats are activated", activated_at: null, used_bytes: null }
  );
  const files = license.student_files || [];
  const invoices = license.invoices || [];
  const payments = license.payments || [];
  document.querySelector("#billing").textContent = invoices.length || payments.length
    ? `${invoices.length} invoices, ${payments.length} payments`
    : files.length
      ? `${files.length} student file${files.length === 1 ? "" : "s"} stored. No invoice or payment is stored on this license.`
      : "No invoice or payment is stored on this license.";

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
