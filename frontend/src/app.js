const state = {
  demo: null
};

const $ = (selector) => document.querySelector(selector);
const api = (path, options) => fetch(`/api${path}`, {
  headers: { "content-type": "application/json" },
  ...options
}).then((response) => response.json());

async function load() {
  state.demo = await api("/demo");
  render();
}

function render() {
  const { experiment, metrics, regression, incidents, trace, audit } = state.demo;
  const incident = incidents[0];

  $("#experiment-name").textContent = experiment.name;
  $("#experiment-description").textContent = experiment.description;
  $("#rollout-kpi").textContent = `${experiment.rolloutPercentage}%`;
  $("#rollout-sub").textContent = `Previous: ${experiment.previousRolloutPercentage}%`;
  $("#p95-kpi").textContent = `${metrics.deltas.p95Percent}%`;
  $("#error-kpi").textContent = `+${metrics.deltas.errorRatePoints}`;
  $("#conversion-kpi").textContent = `${metrics.deltas.conversionPercent}%`;
  $("#rollout-value").textContent = `${experiment.rolloutPercentage}%`;
  $("#rollout-slider").value = experiment.rolloutPercentage;
  $("#status-pill").textContent = experiment.status.replace("_", " ");
  $("#regression-pill").textContent = regression.unhealthy ? "Regression detected" : "Healthy";
  $("#regression-pill").classList.toggle("danger", regression.unhealthy);

  renderExperiments();
  renderAssignment();
  renderChart(metrics.series);
  renderRegression(regression);
  renderIncident(incident);
  renderTrace(trace);
  renderAudit(audit);
}

function renderExperiments() {
  api("/experiments").then((experiments) => {
    $("#experiment-list").innerHTML = experiments.map((experiment) => `
      <div class="experiment">
        <div>
          <strong>${experiment.name}</strong>
          <small>${experiment.owner} · ${experiment.targeting.regions.join(", ")}</small>
        </div>
        <span class="pill ${experiment.status === "degraded" ? "danger" : ""}">${experiment.status.replace("_", " ")}</span>
      </div>
    `).join("");
  });
}

async function renderAssignment() {
  const userId = $("#assignment-user").value;
  const assignment = await api("/assignments", {
    method: "POST",
    body: JSON.stringify({ experimentId: "ranking-v2", userId })
  });
  $("#assignment-result").innerHTML = `
    <strong>${userId}</strong> maps to <strong>${assignment.variant}</strong>
    <br><small>Stable bucket ${assignment.bucketNumber}; included=${assignment.included}</small>
  `;
}

function renderRegression(regression) {
  $("#regression-reasons").innerHTML = regression.reasons.map((reason) => (
    `<div class="reason">${reason}</div>`
  )).join("");
}

function renderIncident(incident) {
  $("#incident-title").textContent = incident.title;
  $("#incident-summary").textContent = `${incident.severity} · ${incident.status} · ${incident.summary}`;
  $("#timeline").innerHTML = incident.timeline.map((item) => `
    <div class="timeline-item">
      <span>${item.time}</span>
      <div><strong>${item.type}</strong><br>${item.text}</div>
    </div>
  `).join("");
}

function renderTrace(trace) {
  $("#trace-id").textContent = trace.id;
  $("#trace-status").textContent = trace.status;
  $("#trace-reason").textContent = `${trace.bucket} bucket · ${trace.durationMs}ms · ${trace.failureReason}`;
  $("#spans").innerHTML = trace.spans.map((span) => `
    <div class="span">
      <div><strong>${span.service}</strong><small>${span.operation}</small></div>
      <span>${span.durationMs}ms</span>
      <span class="pill ${span.status !== "ok" ? "danger" : ""}">${span.status}</span>
    </div>
  `).join("");
}

function renderAudit(audit) {
  $("#audit-body").innerHTML = audit.map((event) => `
    <tr>
      <td>${formatTime(event.time)}</td>
      <td>${event.actor}</td>
      <td>${event.action}</td>
      <td>${event.from} -> ${event.to}</td>
    </tr>
  `).join("");
}

function renderChart(series) {
  const canvas = $("#metric-chart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pad = 42;
  const values = series.flatMap((point) => [point.controlP95, point.treatmentP95].filter(Boolean));
  const max = Math.max(...values) * 1.15;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#dbe1e8";
  ctx.lineWidth = 1;

  for (let i = 0; i < 4; i += 1) {
    const y = pad + ((height - pad * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  drawLine(ctx, series, "controlP95", "#1c7c54", max, width, height, pad);
  drawLine(ctx, series, "treatmentP95", "#b42318", max, width, height, pad);

  ctx.fillStyle = "#617080";
  ctx.font = "13px system-ui";
  series.forEach((point, index) => {
    const x = xAt(index, series.length, width, pad);
    ctx.fillText(point.time, x - 14, height - 12);
  });

  drawLegend(ctx, "Control p95", "#1c7c54", 64);
  drawLegend(ctx, "Treatment p95", "#b42318", 178);
}

function drawLine(ctx, series, key, color, max, width, height, pad) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  series.forEach((point, index) => {
    if (!point[key]) return;
    const x = xAt(index, series.length, width, pad);
    const y = height - pad - (point[key] / max) * (height - pad * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = color;
  series.forEach((point, index) => {
    if (!point[key]) return;
    const x = xAt(index, series.length, width, pad);
    const y = height - pad - (point[key] / max) * (height - pad * 2);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawLegend(ctx, label, color, x) {
  ctx.fillStyle = color;
  ctx.fillRect(x, 18, 14, 4);
  ctx.fillStyle = "#17202a";
  ctx.font = "13px system-ui";
  ctx.fillText(label, x + 20, 24);
}

function xAt(index, count, width, pad) {
  return pad + (index / Math.max(1, count - 1)) * (width - pad * 2);
}

async function setRollout(value) {
  await api("/experiments/ranking-v2/rollout", {
    method: "PATCH",
    body: JSON.stringify({ rolloutPercentage: Number(value), actor: "maya@company.com" })
  });
  await load();
}

async function rollback() {
  await api("/incidents/inc-1042/rollback", {
    method: "POST",
    body: JSON.stringify({ actor: "maya@company.com" })
  });
  await load();
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

$("#refresh").addEventListener("click", load);
$("#assignment-user").addEventListener("input", renderAssignment);
$("#rollout-slider").addEventListener("change", (event) => setRollout(event.target.value));
document.querySelectorAll("[data-rollout]").forEach((button) => {
  button.addEventListener("click", () => setRollout(button.dataset.rollout));
});
$("#rollback-primary").addEventListener("click", rollback);
$("#rollback-secondary").addEventListener("click", rollback);

load();
