// paypal.mjs — the fund page's PayPal choice (POS-183 part 2, the third money rail).
//
// International givers' banks balk at a foreign USD card charge from an
// unfamiliar US merchant; PayPal is where they already hold a balance. The
// fund page offers it beside the card, and this module is the whole of it:
//
//   · THE SDK LOADS ONLY WHEN THE GIVER CHOOSES PAYPAL. Nothing from
//     paypal.com is on the page until the "Pay with PayPal" button is pressed;
//     then one script tag is added, once. A page that loaded a payment SDK on
//     every visit would be the town telling PayPal about every reader.
//   · THE ORDER NAMES ITS POT. `purchase_units[0].custom_id` is
//     `<pot>|<handle>`, where the handle is the text the giver typed, trimmed,
//     or empty. The office's paypal-watch reads it back as `custom_field` and
//     resolves the pot and the hand by the card rail's own rule, so the two
//     spellings must agree: this file's customIdFor and the office's
//     tools/paypal-watch.mjs § customIdFor are pinned to the same cases by
//     each repo's tests.
//   · WHOLE US DOLLARS. The ledger records whole dollars; the order is for a
//     whole number of them, in USD.
//
// The client ID is public by design (it is in the page either way) and comes
// from build config, `PUBLIC_PAYPAL_CLIENT_ID`: the sandbox app's on the dev
// build, the live app's on prod. Never the secret, which only the office's
// watcher holds. With no client ID the page offers no PayPal choice at all.

export const SDK_HOST = "https://www.paypal.com/sdk/js";
export const CUSTOM_SEP = "|";
/** PayPal's own bound on custom_id. */
export const CUSTOM_MAX = 127;
export const DEFAULT_USD = 10;

/** The SDK's URL for a client ID: dollars, capture, buttons only. */
export function sdkUrl(clientId) {
  return `${SDK_HOST}?client-id=${encodeURIComponent(String(clientId ?? ""))}&currency=USD&intent=capture&components=buttons`;
}

/** `<pot>|<handle>`, the handle trimmed (or empty), bounded to PayPal's 127. */
export function customIdFor(pot, handle) {
  const h = String(handle ?? "").trim();
  return `${pot}${CUSTOM_SEP}${h}`.slice(0, CUSTOM_MAX);
}

/** A whole number of dollars, at least one, or null. */
export function wholeUsd(v) {
  const s = String(v ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 100_000 ? n : null;
}

/** The order the giver's approval creates. */
export function orderFor({ pot, title, handle, usd }) {
  return {
    intent: "CAPTURE",
    purchase_units: [{
      custom_id: customIdFor(pot, handle),
      description: `Postmark · ${title ?? pot}`.slice(0, 127),
      amount: { currency_code: "USD", value: Number(usd).toFixed(2) },
    }],
  };
}

/** Add the SDK script once, and resolve when it has loaded. */
export function loadSdk(doc, clientId, win = globalThis) {
  if (win.paypal?.Buttons) return Promise.resolve(win.paypal);
  const existing = doc.querySelector(`script[data-pp-sdk]`);
  return new Promise((resolve, reject) => {
    const s = existing ?? doc.createElement("script");
    s.addEventListener("load", () => resolve(win.paypal));
    s.addEventListener("error", () => reject(new Error("PayPal could not be reached")));
    if (!existing) {
      s.src = sdkUrl(clientId);
      s.setAttribute("data-pp-sdk", "");
      doc.head.appendChild(s);
    }
  });
}

/**
 * Wire the fund page's PayPal choice. The box carries `data-pp-client`,
 * `data-pp-pot` and `data-pp-title`; nothing loads until `[data-pp-go]` is
 * pressed. Returns the box, or null when this page offers no PayPal.
 */
export function mountPaypal(doc, { win = globalThis } = {}) {
  const box = doc.querySelector("[data-pp-client]");
  if (!box) return null;
  const clientId = box.getAttribute("data-pp-client");
  const pot = box.getAttribute("data-pp-pot");
  const title = box.getAttribute("data-pp-title");
  const go = box.querySelector("[data-pp-go]");
  const usdIn = box.querySelector("[name='pp-usd']");
  const handleIn = box.querySelector("[name='pp-handle']");
  const target = box.querySelector("[data-pp-buttons]");
  const out = box.querySelector("[data-pp-out]");
  const say = (text) => { if (out) out.textContent = text; };
  let rendered = false;
  go?.addEventListener("click", async () => {
    const usd = wholeUsd(usdIn?.value);
    if (usd == null) { say("Choose a whole number of dollars, at least one — the ledger records whole dollars."); return; }
    if (rendered) return;
    go.disabled = true;
    say("Opening PayPal…");
    try {
      const paypal = await loadSdk(doc, clientId, win);
      await paypal.Buttons({
        // read at the moment of payment, so a change after pressing is what is paid
        createOrder: (_data, actions) => actions.order.create(orderFor({ pot, title, handle: handleIn?.value, usd: wholeUsd(usdIn?.value) ?? usd })),
        onApprove: (_data, actions) => actions.order.capture().then(() => say(
          "Paid, thank you. PayPal has it; the office's watcher writes it on the ledger once PayPal lists it (up to three hours) and one crossing's grace has passed.")),
        onCancel: () => say("Cancelled — nothing was taken."),
        onError: () => say("PayPal could not take this payment. Nothing was recorded; try again, or pay by card."),
      }).render(target);
      rendered = true;
      go.hidden = true;
      say("");
    } catch (e) {
      go.disabled = false;
      say(`${e?.message ?? "PayPal could not be reached"} — nothing was taken.`);
    }
  });
  return box;
}
