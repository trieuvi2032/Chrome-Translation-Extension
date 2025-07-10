(() => {
  if (window.__bubbleAlreadyInjected) {
    console.log("[Bubble] content.js already injected, skip");
    return;
  }
  window.__bubbleAlreadyInjected = true;

  let bubbleIcon = null;
  let popupDiv = null;
  let lastSelectedText = "";

  const handleOutsideClick = (event) => {
    if (
      popupDiv &&
      !popupDiv.contains(event.target) &&
      !(bubbleIcon && bubbleIcon.contains(event.target))
    ) {
      removeAll();
    }
  };

  document.addEventListener("mouseup", () => {
    const selection = window.getSelection().toString().trim();
    if (!selection || selection === lastSelectedText) return;

    chrome.storage.local.get("bubbleEnabled", (data) => {
      const enabled = data?.bubbleEnabled ?? true;
      if (!enabled) return;

      lastSelectedText = selection;
      removeAll();

      const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
      const x = rect.left + window.scrollX;
      const y = rect.bottom + window.scrollY;

      bubbleIcon = document.createElement("img");
      bubbleIcon.src = chrome.runtime.getURL("icon.png");
      bubbleIcon.style = `
        position: absolute;
        top: ${y + 8}px;
        left: ${x}px;
        width: 24px;
        height: 24px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        background: white;
        border-radius: 4px;
        padding: 2px;
        user-select: none;
      `;

      bubbleIcon.addEventListener("click", (ev) => {
        ev.stopPropagation();
        showPopup(selection, x, y);
      });

      document.body.appendChild(bubbleIcon);
    });
  });

  function showPopup(text, x, y) {
    removeAll();

    popupDiv = document.createElement("div");
    popupDiv.style = `
      position:absolute; top:${y + 36}px; left:${x}px;
      background:#fff;
      padding:10px;
      border-radius:6px;
      box-shadow:
        inset 0 0 0 2px rgba(100, 170, 255, 0.3),
        0 4px 10px rgba(0,0,0,0.2);
      z-index:999999;
      max-width:320px;
      font-size:15px;
      font-family:'Arial','Segoe UI',sans-serif;
      color:#333;
      line-height:1.5;
    `;

    const chineseLine = document.createElement("div");
    chineseLine.style.color = "#a00";
    chineseLine.style.fontWeight = "bold";
    chineseLine.style.fontSize = "18px";
    chineseLine.textContent = text;

    const pinyinLine = document.createElement("div");
    pinyinLine.style.margin = "4px 0";
    pinyinLine.style.fontSize = "15px";
    pinyinLine.style.color = "#000";
    pinyinLine.textContent = "";

    const translationLine = document.createElement("div");
    translationLine.style.fontSize = "15px";
    translationLine.style.color = "#000";
    translationLine.textContent = "";

    popupDiv.appendChild(chineseLine);
    popupDiv.appendChild(pinyinLine);
    popupDiv.appendChild(translationLine);
    document.body.appendChild(popupDiv);

    // Gửi hai request song song
    chrome.runtime.sendMessage({ type: "translate", text }, (res) => {
      const translation = res?.translatedText || "(translation error)";
      const detectedLang = res?.detectedLang || "unknown";
      translationLine.textContent = `1. ${translation}`;

      if (detectedLang.startsWith("zh")) {
        chrome.runtime.sendMessage({ type: "pinyin", text }, (pinRes) => {
          const pinyin = pinRes?.pinyin || "(pinyin error)";
          pinyinLine.textContent = `[ ${pinyin} ]`;
        });
      } else {
        pinyinLine.textContent = "";
      }
    });

    document.addEventListener("click", handleOutsideClick);
  }

  function removeAll() {
    if (bubbleIcon) bubbleIcon.remove();
    if (popupDiv) popupDiv.remove();
    bubbleIcon = null;
    popupDiv = null;
    document.removeEventListener("click", handleOutsideClick);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "updateBubbleStatus") {
      const isEnabled = message.value;
      if (!isEnabled) {
        if (bubbleIcon) bubbleIcon.remove();
        if (popupDiv) popupDiv.remove();
        bubbleIcon = null;
        popupDiv = null;
        lastSelectedText = "";
      }
    }
  });
})();
