const DEFAULTS = {
  supabaseUrl: "http://127.0.0.1:8787",
  anonKey: "local-demo",
};

const supabaseUrl = document.getElementById("supabaseUrl");
const anonKey = document.getElementById("anonKey");
const save = document.getElementById("save");
const banner = document.getElementById("banner");

chrome.storage.local.get(DEFAULTS).then((cfg) => {
  supabaseUrl.value = cfg.supabaseUrl || DEFAULTS.supabaseUrl;
  anonKey.value = cfg.anonKey || DEFAULTS.anonKey;
});

save.addEventListener("click", async () => {
  await chrome.storage.local.set({
    supabaseUrl: supabaseUrl.value.trim() || DEFAULTS.supabaseUrl,
    anonKey: anonKey.value.trim() || DEFAULTS.anonKey,
  });
  banner.textContent = "Enregistré. Rouvrez le panneau Snow AI.";
  banner.classList.remove("hidden");
});
