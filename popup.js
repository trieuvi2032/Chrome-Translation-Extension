document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("inputText");
  const button = document.getElementById("translateBtn");
  const result = document.getElementById("result");

  const clipboardPromise = navigator.clipboard.readText().catch(() => "");

  function translateText(text = input.value.trim()) {
    const cleanText = text.trim();
    if (!cleanText) {
      result.innerHTML = "";
      return;
    }

    result.innerHTML = "<p>Loading...</p>";

    chrome.runtime.sendMessage(
      { type: "translate", text: cleanText },
      (res) => {
        if (!res || chrome.runtime.lastError) {
          result.innerHTML = `<div class="content">(error)</div>`;
          return;
        }

        const { translatedText, detectedLang } = res;

        result.innerHTML = `
        <div class="section">
          <div class="label">VIETNAMESE</div>
          <div class="content">${translatedText}</div>
        </div>`;

        if (detectedLang?.startsWith("zh")) {
          chrome.runtime.sendMessage(
            { type: "pinyin", text: cleanText },
            (pinRes) => {
              const pinyin = pinRes?.pinyin;
              if (pinyin && pinyin !== "(Not available)") {
                result.innerHTML =
                  `
                <div class="section">
                  <div class="label">TRANSCRIPTION</div>
                  <div class="content">${pinyin}</div>
                </div>` + result.innerHTML;
              }
            }
          );
        }
      }
    );
  }

  // --- Lấy text được bôi đen, fallback nếu không có ---
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs?.length || !tabs[0]?.id) {
      fallbackClipboard();
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        func: () => window.getSelection().toString(),
      },
      async (results) => {
        const selected = results?.[0]?.result?.trim();
        if (selected) {
          input.value = selected;
          translateText(selected);
        } else {
          fallbackClipboard();
        }
      }
    );
  });

  // --- Nếu không có selected text → dùng clipboard ---
  async function fallbackClipboard() {
    try {
      // đọc trực tiếp ở đây, đảm bảo popup đã được focus rồi
      const clip = await navigator.clipboard.readText();
      const trimmed = clip.trim();
      if (trimmed) {
        input.value = trimmed;
        translateText(trimmed);
      }
    } catch (err) {
      console.warn("[popup] Clipboard access failed:", err);
    }
  }

  // --- Sự kiện người dùng gõ tay hoặc nhấn nút ---
  button.addEventListener("click", () => translateText(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      translateText(input.value);
    }
  });
});
