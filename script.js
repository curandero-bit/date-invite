const invite = document.getElementById("invite");
const success = document.getElementById("success");
const yesBtn = document.getElementById("yesBtn");
const noBtn = document.getElementById("noBtn");
const hint = document.getElementById("hint");
const dateForm = document.getElementById("dateForm");
const sendBtn = document.getElementById("sendBtn");
const formStatus = document.getElementById("formStatus");
const canvas = document.getElementById("petals");
const ctx = canvas ? canvas.getContext("2d") : null;

const INVITE_EMAIL = "kiber_kotleta@inbox.ru";

const excuses = [
  "Нет? Точно?",
  "Подумай ещё раз.",
  "Это была шутка, да?",
  "Кнопка сломалась. Жми «Да».",
  "Я всё равно буду ждать.",
  "Ладно, ты почти сдалась.",
];

let excuseIndex = 0;
let celebrating = false;
const hearts = [];

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function spawnHeart(burst = false) {
  const count = burst ? 48 : 1;
  for (let i = 0; i < count; i += 1) {
    hearts.push({
      x: burst ? Math.random() * canvas.width : Math.random() * canvas.width,
      y: burst ? canvas.height + Math.random() * 40 : -20,
      s: 8 + Math.random() * 14,
      v: 0.6 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * 1.2,
      a: Math.random() * Math.PI * 2,
      o: 0.35 + Math.random() * 0.5,
    });
  }
}

function drawHeart(x, y, size, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#e85a8c";
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-12, -4, -8, -14, 0, -8);
  ctx.bezierCurveTo(8, -14, 12, -4, 0, 6);
  ctx.fill();
  ctx.restore();
}

function tick() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (Math.random() < (celebrating ? 0.35 : 0.04)) spawnHeart();
  hearts.forEach((h) => {
    h.a += 0.02;
    h.y += celebrating ? -h.v * 1.6 : h.v;
    h.x += Math.sin(h.a) * h.drift;
    drawHeart(h.x, h.y, h.s, h.o);
  });
  for (let i = hearts.length - 1; i >= 0; i -= 1) {
    const h = hearts[i];
    if (h.y > canvas.height + 40 || h.y < -60) hearts.splice(i, 1);
  }
  requestAnimationFrame(tick);
}

function viewportSize() {
  const view = window.visualViewport;
  return {
    width: view?.width ?? window.innerWidth,
    height: view?.height ?? window.innerHeight,
  };
}

function moveNo(event) {
  const rect = noBtn.getBoundingClientRect();
  const pad = 16;
  const { width, height } = viewportSize();
  const maxX = Math.max(pad, width - rect.width - pad);
  const maxY = Math.max(pad, height - rect.height - pad);
  const point = event?.touches?.[0] ?? event;
  const mx = point?.clientX ?? rect.left + rect.width / 2;
  const my = point?.clientY ?? rect.top + rect.height / 2;

  if (!noBtn.classList.contains("fleeing")) {
    document.body.appendChild(noBtn);
    noBtn.classList.add("fleeing");
  }

  let x = pad;
  let y = pad;
  for (let i = 0; i < 24; i += 1) {
    x = pad + Math.random() * Math.max(0, maxX - pad);
    y = pad + Math.random() * Math.max(0, maxY - pad);
    if (Math.hypot(x + rect.width / 2 - mx, y + rect.height / 2 - my) > 140) break;
  }

  noBtn.style.left = `${x}px`;
  noBtn.style.top = `${y}px`;
  hint.textContent = excuses[excuseIndex % excuses.length];
  excuseIndex += 1;
}

function sayYes() {
  celebrating = true;
  spawnHeart(true);
  invite.hidden = true;
  success.hidden = false;
  noBtn.remove();
}

function letterBody({ date, time, place, note }) {
  return [
    "Свидание подтверждено.",
    `Дата: ${date}`,
    `Время: ${time}`,
    `Место: ${place}`,
    note ? `Сообщение: ${note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function openMailto(email, fields) {
  const subject = encodeURIComponent("Свидание: место и время");
  const body = encodeURIComponent(letterBody(fields));
  const link = document.createElement("a");
  link.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  link.click();
}

async function sendByFormSubmit(email, fields) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        _subject: "Свидание: место и время",
        _captcha: "false",
        _template: "table",
        Дата: fields.date,
        Время: fields.time,
        Место: fields.place,
        Сообщение: fields.note || "—",
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw new Error("network");
  const payload = await response.json();
  if (payload.success === false || payload.success === "false") throw new Error("rejected");
}

function setStatus(text, kind) {
  formStatus.textContent = text;
  formStatus.classList.remove("error", "ok");
  if (kind) formStatus.classList.add(kind);
}

dateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = {
    date: document.getElementById("dateInput").value,
    time: document.getElementById("timeInput").value,
    place: document.getElementById("placeInput").value.trim(),
    note: document.getElementById("noteInput").value.trim(),
  };
  const email = INVITE_EMAIL.trim();

  if (!fields.date || !fields.time || !fields.place) {
    setStatus("Нужны дата, время и место.", "error");
    return;
  }

  sendBtn.disabled = true;
  setStatus("Отправляю письмо...");

  try {
    await sendByFormSubmit(email, fields);
    setStatus("Письмо отправлено. Если это первый раз — подтверди адрес в письме от FormSubmit.", "ok");
    dateForm.querySelectorAll("input, textarea, button").forEach((el) => {
      if (el !== sendBtn) el.disabled = true;
    });
    sendBtn.textContent = "Отправлено";
  } catch (error) {
    openMailto(email, fields);
    setStatus("Почтовая программа открыта. Нажми «Отправить» в письме.", "ok");
    sendBtn.disabled = false;
  }
});

yesBtn.addEventListener("click", sayYes);
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  noBtn.addEventListener("mouseenter", moveNo);
}
noBtn.addEventListener(
  "pointerdown",
  (event) => {
    event.preventDefault();
    moveNo(event);
  },
  { passive: false }
);
noBtn.addEventListener("click", (event) => {
  event.preventDefault();
  moveNo(event);
});

window.addEventListener("resize", resize);
resize();
tick();
