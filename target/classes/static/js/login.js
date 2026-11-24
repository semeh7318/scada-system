"use strict";

const TEXTS = {
  fr: {
    subtitle: "Supervision industrielle · Station de pompage",
    username: "Nom d'utilisateur",
    password: "Mot de passe",
    show: "Afficher",
    hide: "Masquer",
    submit: "Se connecter",
    error: "Nom d'utilisateur ou mot de passe incorrect.",
    note: "Accès réservé au personnel autorisé."
  },
  en: {
    subtitle: "Industrial supervision · Pumping station",
    username: "Username",
    password: "Password",
    show: "Show",
    hide: "Hide",
    submit: "Sign in",
    error: "Incorrect username or password.",
    note: "Access restricted to authorized personnel."
  }
};

let lang = "fr";
const $ = (id) => document.getElementById(id);
const t = (key) => TEXTS[lang][key];

function readCookie(name) {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function storedValue(name, allowed, fallback) {
  const fromUrl = new URLSearchParams(window.location.search).get(name);
  if (allowed.includes(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem("scadasec-" + name);
    if (allowed.includes(saved)) return saved;
  } catch (e) { /* storage not available */ }
  return fallback;
}

function applyLang(newLang) {
  lang = newLang;
  try { window.localStorage.setItem("scadasec-lang", lang); } catch (e) { /* ignore */ }
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll(".lang button").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  $("toggle").textContent = t($("password").type === "password" ? "show" : "hide");
}

document.documentElement.dataset.theme = storedValue("theme", ["dark", "light"], "dark");

document.querySelectorAll(".lang button").forEach((b) => {
  b.addEventListener("click", () => applyLang(b.dataset.lang));
});

$("toggle").addEventListener("click", () => {
  const hidden = $("password").type === "password";
  $("password").type = hidden ? "text" : "password";
  $("toggle").textContent = t(hidden ? "hide" : "show");
});

// The CSRF token comes from the XSRF-TOKEN cookie set by the server
$("csrf").value = readCookie("XSRF-TOKEN");
document.querySelector("form").addEventListener("submit", () => {
  $("csrf").value = readCookie("XSRF-TOKEN");
});

if (new URLSearchParams(window.location.search).has("erreur")) {
  $("error").classList.remove("hidden");
}

applyLang(storedValue("lang", ["fr", "en"], "fr"));
