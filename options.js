(() => {
  "use strict";

  const form = document.querySelector("#settings-form");
  const keyInput = document.querySelector("#api-key");
  const saveButton = document.querySelector("#save-button");
  const clearButton = document.querySelector("#clear-cache");
  const status = document.querySelector("#status");
  const enableButton = document.querySelector("#enable-lookups");
  const pauseButton = document.querySelector("#pause-lookups");
  const lookupState = document.querySelector("#lookup-state");

  function setBusy(busy) {
    keyInput.disabled = busy;
    saveButton.disabled = busy;
    clearButton.disabled = busy;
    enableButton.disabled = busy;
    pauseButton.disabled = busy;
  }

  function showLookupState(enabled) {
    enableButton.hidden = enabled;
    pauseButton.hidden = !enabled;
    lookupState.textContent = enabled ? "On — article panels appear automatically." : "Off — no automatic article lookups.";
  }

  async function changeLookupState(enabled) {
    setBusy(true);
    try {
      await chrome.storage.local.set({ automaticLookupEnabled: enabled });
      showLookupState(enabled);
      showStatus(enabled ? "Automatic lookups enabled. Open an article page to see authorC." : "Automatic lookups paused.");
    } catch {
      showStatus("Could not change lookup settings. Reload this page and try again.", true);
    } finally {
      setBusy(false);
    }
  }

  enableButton.addEventListener("click", () => changeLookupState(true));
  pauseButton.addEventListener("click", () => changeLookupState(false));

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.state = isError ? "error" : "success";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const apiKey = keyInput.value.trim();
      await chrome.storage.local.set({ apiKey });
      keyInput.value = apiKey;
      showStatus(apiKey ? "Settings saved. Your key will be used for the next lookup." : "Settings saved. authorC will make lookups without an API key.");
    } catch {
      showStatus("Could not save settings. Reload this page and try again.", true);
    } finally {
      setBusy(false);
    }
  });

  clearButton.addEventListener("click", async () => {
    setBusy(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: "AUTHORC_CLEAR_CACHE" });
      if (!response?.ok) throw new Error("Cache clear failed");
      showStatus("Cached results cleared. Refresh an article page to fetch current counts.");
    } catch {
      showStatus("Could not clear cached results. Reload this page and try again.", true);
    } finally {
      setBusy(false);
    }
  });

  async function loadSettings() {
    try {
      const { apiKey, automaticLookupEnabled } = await chrome.storage.local.get(["apiKey", "automaticLookupEnabled"]);
      keyInput.value = typeof apiKey === "string" ? apiKey : "";
      showLookupState(automaticLookupEnabled === true);
      setBusy(false);
      showStatus("");
    } catch {
      showStatus("Could not load settings. Reload this page to try again.", true);
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && Object.hasOwn(changes, "automaticLookupEnabled")) showLookupState(changes.automaticLookupEnabled.newValue === true);
  });

  loadSettings();
})();
