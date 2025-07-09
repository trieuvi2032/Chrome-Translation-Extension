importScripts("pinyin.min.js");

let lastClipboardTime = 0;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 3. Translation only
  if (request.type === "translate") {
    const text = request.text;

    fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dt=ld&tl=vi&sl=auto&q=${encodeURIComponent(
        text
      )}`
    )
      .then((res) => res.json())
      .then((data) => {
        const translatedText =
          data?.[0]?.map((item) => item[0]).join("") || "(no result)";
        const detectedLang = data?.[2] || "unknown";

        sendResponse({
          translatedText,
          detectedLang,
        });
      })
      .catch((err) => {
        sendResponse({
          translatedText: "(error)",
          detectedLang: "unknown",
        });
      });

    return true;
  }

  // 4. Translate + Pinyin
  if (request.type === "translateWithPinyin") {
    const text = request.text;

    // Promise 1: Google Translate API
    const translatePromise = fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dt=ld&tl=vi&sl=auto&q=${encodeURIComponent(
        text
      )}`
    )
      .then((res) => res.json())
      .then((data) => ({
        translatedText:
          data?.[0]?.map((item) => item[0]).join("") || "(no result)",
        detectedLang: data?.[2] || "unknown",
      }))
      .catch((err) => {
        return {
          translatedText: "(error)",
          detectedLang: "unknown",
        };
      });

    // Promise 2: Generate Pinyin
    const pinyinPromise = new Promise((resolve) => {
      try {
        if (typeof pinyinPro !== "undefined" && pinyinPro.pinyin) {
          const pinyinResult = pinyinPro.pinyin(text, {
            toneType: "symbol",
            segment: true,
          });
          resolve(pinyinResult);
        } else {
          resolve("(Pinyin not available)");
        }
      } catch (err) {
        resolve("(Pinyin error)");
      }
    });

    // Run both promises in parallel
    Promise.all([translatePromise, pinyinPromise]).then(
      ([translation, pinyin]) => {
        sendResponse({
          ...translation,
          pinyin,
        });
      }
    );

    return true;
  }

  // 5. Pinyin-only (if ever used standalone)
  if (request.type === "pinyin") {
    const text = request.text;
    let pinyinResult = "(Not available)";

    try {
      if (typeof pinyinPro !== "undefined" && pinyinPro.pinyin) {
        pinyinResult = pinyinPro.pinyin(text, {
          toneType: "symbol",
          segment: true,
        });
      } else {
        pinyinResult = "(Pinyin library not loaded)";
      }
    } catch (err) {
      pinyinResult = "(Pinyin error)";
    }

    sendResponse({ pinyin: pinyinResult });
    return true;
  }
});
