// CORE-145 picture setup for `site-prep shots --setup` (untracked scratch inside the claimed tree; removed after the run).
// INVENTED fixtures only: invented households and residents (every name says "Fixture"), invented last-active times, an invented sign-in (a placeholder
// value in localStorage; the page's own island would ask the office and that request is aborted by site-prep). Nothing real is read or written.
// The state is the path's query: /households/?wsn=<state>
//   result      anonymous reader, an invented pool, one click: a dealt resident + the plain disclaimer
//   own-skipped signed-in fixture reader whose own house is first in the pool and would be dealt first: the dealt resident is NOT theirs
//   only-yours  signed-in fixture reader; the only recent house is theirs: the plain message
//   none-recent an invented pool where nobody acted within 14 days: the plain message
//   unknown     the build's own data (the committed snapshot carries no last_active): the plain "can't see who has been around" message
// Math.random is fixed to a short sequence so the picture is repeatable (the page uses it only for the deal).

const DAY = 86_400_000;
const state = (p) => new URL(p, "http://x").searchParams.get("wsn") || "";
const m = (handle, name, line, daysAgo, now) => ({ handle, name, line, at: new Date(now - daysAgo * DAY).toISOString() });
const house = (key, name, href, foundedDaysAgo, sent, members, now, extraHandles = []) => ({
  key, name, href, founded: now - foundedDaysAgo * DAY, sent, handles: [...members.map((x) => x.handle), ...extraHandles], members,
});

function fixture(now, which) {
  const own = house("fixture-own", "Fixture Own House", "/households/fixture-own/", 20, 0,
    [m("fixture-own-a", "Fixture Own A", "INVENTED: your own house, first in the pool.", 1, now)], now);
  const fresh = house("fixture-fresh", "Fixture Fresh House", "/households/fixture-fresh/", 12, 1,
    [m("fixture-wren", "Fixture Wren", "INVENTED card line: I keep a lamp lit for late letters, and I answer slowly.", 2, now)], now);
  const big = house("fixture-big", "Fixture Big House", "/households/fixture-big/", 200, 90,
    [m("fixture-b1", "Fixture B One", "INVENTED: one of four.", 3, now), m("fixture-b2", "Fixture B Two", "INVENTED: two of four.", 5, now),
     m("fixture-b3", "Fixture B Three", "INVENTED: three of four.", 6, now), m("fixture-b4", "Fixture B Four", "INVENTED: four of four.", 9, now)], now);
  const solo = house("solo:fixture-solo", "Fixture Solo", null, 40, 3, [m("fixture-solo", "Fixture Solo", "INVENTED: a house of one, quiet lately.", 4, now)], now);
  const old = house("fixture-old", "Fixture Old House", "/households/fixture-old/", 400, 300, [m("fixture-old-a", "Fixture Old A", "INVENTED: long gone.", 100, now)], now);
  const counts = (n, known) => ({ houses: n, unknown: n - known, known });
  if (which === "result") return { houses: [fresh, big, solo], counts: counts(4, 4) };
  if (which === "own-skipped") return { houses: [own, fresh, big, solo], counts: counts(5, 5) };
  if (which === "only-yours") return { houses: [own], counts: counts(2, 2) };
  if (which === "none-recent") return { houses: [], counts: counts(4, 4) };
  return null;
}

export default async function ({ page, path }) {
  const which = state(path);
  const signedIn = which === "own-skipped" || which === "only-yours";
  await page.addInitScript(({ signedIn }) => {
    let i = 0; const seq = [0.05, 0.2, 0.4];
    Math.random = () => seq[i++ % seq.length];
    if (signedIn) {
      try {
        localStorage.setItem("pm.oauth.token", JSON.stringify({ access_token: "invented-placeholder", obtained: Date.now(), expires_in: 3600 }));
        localStorage.setItem("pm.oauth.handles.cache", JSON.stringify(["fixture-own-a"]));
      } catch {}
    }
  }, { signedIn });
  const data = fixture(Date.now(), which);
  if (data) {
    // the page's serialised block is replaced with the invented one before the page's script reads it (the document response only; nothing else is touched)
    await page.route(/\/households\/(\?.*)?$/, async (route) => {
      if (route.request().resourceType() !== "document") return route.fallback();
      const res = await route.fetch();
      let body = await res.text();
      body = body.replace(/(<script[^>]*id="wsn-data"[^>]*>)([\s\S]*?)(<\/script>)/, (_, a, _b, c) => a + JSON.stringify(data).replace(/</g, "\\u003c") + c);
      await route.fulfill({ response: res, body });
    });
  }
}

export async function after({ page, path }) {
  const which = state(path);
  if (!which) return;
  await page.waitForSelector("[data-wsn-go]:visible", { timeout: 20000 });
  await page.click("[data-wsn-go]");
  await page.waitForSelector("[data-wsn-card]:not([hidden]), [data-wsn-empty]:not([hidden])", { timeout: 10000 });
  await page.evaluate(() => document.querySelector("[data-wsn]")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
}
