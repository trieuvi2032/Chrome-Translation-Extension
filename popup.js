document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("inputText");
  const button = document.getElementById("translateBtn");
  const result = document.getElementById("result");
  const checkbox = document.getElementById("toggleBubble");

  // 🔸 Đọc trạng thái toggle từ storage
  try {
    chrome.storage?.local?.get("bubbleEnabled", (data) => {
      checkbox.checked = data?.bubbleEnabled ?? true;
    });
  } catch (err) {
    console.warn("[popup] Failed to read storage:", err);
    checkbox.checked = true;
  }

  checkbox.addEventListener("change", () => {
    const isEnabled = checkbox.checked;
    chrome.storage.local.set({ bubbleEnabled: isEnabled });

    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (!tab.id || !tab.url?.startsWith("http")) continue;

        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            files: ["content.js"],
          },
          () => {
            // Sau khi inject content.js, gửi message
            chrome.tabs.sendMessage(tab.id, {
              type: "updateBubbleStatus",
              value: isEnabled,
            });
          }
        );
      }
    });
  });

  // --- Translate logic ---
  function translateText(text = input.value.trim()) {
    const cleanText = text.trim();
    if (!cleanText) {
      result.style.display = "none"; // 🔸 Ẩn hẳn luôn
      result.innerHTML = "";
      return;
    }

    result.style.display = "block"; // 🔸 Hiện lại khi có nội dung
    result.innerHTML = "<p class='content'>Loading...</p>";

    chrome.runtime.sendMessage(
      { type: "translate", text: cleanText },
      (res) => {
        if (!res || chrome.runtime.lastError) {
          result.innerHTML = `<div class="content">(translation error)</div>`;
          return;
        }

        const { translatedText, detectedLang } = res;
        let html = `
      <div class="section">
        <div class="label">VIETNAMESE</div>
        <div class="content">${translatedText}</div>
      </div>`;

        // Nếu là tiếng Trung thì chèn thêm pinyin trước
        if (detectedLang?.startsWith("zh")) {
          chrome.runtime.sendMessage(
            { type: "pinyin", text: cleanText },
            (pinRes) => {
              const pinyin = pinRes?.pinyin?.trim();
              if (pinyin && pinyin !== "(Not available)") {
                const trimmedPinyin = pinyin
                  .split("\n")
                  .map((line) => line.trim())
                  .join("\n");
                const cleanedPinyin = trimmedPinyin.replace(/\s+/g, " ").trim();

                html =
                  `
              <div class="section">
                <div class="label">TRANSCRIPTION</div>
                <div class="content">${cleanedPinyin}</div>
              </div>` + html;
              }
              result.innerHTML = html; // ✅ cuối cùng mới gán
            }
          );
        } else {
          result.innerHTML = html;
        }
      }
    );
  }

  // --- Nếu có text được bôi đen trên trang ---
  chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs?.length || !tabs[0]?.id || tabs[0].url?.startsWith("chrome://")) {
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

  // --- Người dùng gõ hoặc bấm nút ---
  button.addEventListener("click", () => translateText(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      translateText(input.value);
    }
  });
});
