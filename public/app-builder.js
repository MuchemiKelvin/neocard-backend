const form = document.querySelector("#lesson-form");
const message = document.querySelector("#message");
const lesson = document.querySelector("#lesson");
let lessonId = "";

function showMessage(text) {
  message.hidden = !text;
  message.textContent = text || "";
}

function render(data) {
  lessonId = data.lesson_id;
  document.querySelector("#lesson-title").textContent = `${data.lesson.subject} · Grade ${data.lesson.grade} · ${data.lesson.topic}`;
  document.querySelector("#lesson-status").textContent = `${data.status} · ${data.source}`;
  const steps = document.querySelector("#lesson-steps");
  steps.replaceChildren();
  data.lesson.steps.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    steps.appendChild(item);
  });
  lesson.hidden = false;
}

async function post(url) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lesson_id: lessonId })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Request failed");
  return body.data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  const response = await fetch("/app-builder/draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenant_id: document.querySelector("#tenant-id").value.trim(),
      user_id: document.querySelector("#user-id").value.trim(),
      role: document.querySelector("#role").value.trim(),
      grade: document.querySelector("#grade").value.trim(),
      subject: document.querySelector("#subject").value.trim(),
      topic: document.querySelector("#topic").value.trim()
    })
  });
  const body = await response.json();
  if (!response.ok) {
    lesson.hidden = true;
    showMessage(body.message || "Draft could not be created");
    return;
  }
  render(body.data);
});

document.querySelector("#save").addEventListener("click", async () => {
  try {
    render(await post(`/app-builder/lessons/${encodeURIComponent(lessonId)}/save`));
    showMessage("");
  } catch (error) {
    showMessage(error.message);
  }
});

document.querySelector("#publish").addEventListener("click", async () => {
  try {
    render(await post(`/app-builder/lessons/${encodeURIComponent(lessonId)}/publish`));
    showMessage("");
  } catch (error) {
    showMessage(error.message);
  }
});
