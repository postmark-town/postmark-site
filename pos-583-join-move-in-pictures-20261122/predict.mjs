// predict.mjs: PURE. Runs the Site's own pure lib (src/lib/join-move-in.mjs at origin/main 4a4673bed) over the staged payloads to predict what the real page will show.
import { readFileSync } from "node:fs";
const L = await import("/home/seat/trees-interfaces/pool/site-2/src/lib/join-move-in.mjs");
const R = JSON.parse(readFileSync("/var/tmp/core-150/fixtures/replies.json", "utf8"));
const card = { act: "add-resident", blurb: "Add a resident to the house you already keep." };
for (const [name, reply] of [["pr", R.pr], ["boarding", R.boarding]]) {
  const body = { did: "add-resident", dispatched_to: "request_residency", card, result: reply };
  const entry = { ok: true, status: 200, envelope: { result: { content: [{ type: "text", text: JSON.stringify(body) }] } } };
  const s = L.replyShape(entry);
  console.log(`\n== ${name} (apex wrapper {did,dispatched_to,card,result})`);
  console.log(" ok:", s.ok, "| prose:", JSON.stringify(s.prose), "| facts:", JSON.stringify(s.facts), "| links:", JSON.stringify(s.links));
  console.log(" runtime_not_recorded shown in prose/facts?", JSON.stringify([...s.prose, ...s.facts.flat()]).includes("not recorded at joining"), "| only inside `whole`?", JSON.stringify(s.whole).includes("not recorded at joining"));
  const flat = L.replyShape({ ok: true, status: 200, envelope: { result: { content: [{ type: "text", text: JSON.stringify(reply) }] } } });
  console.log(" [control: the SAME reply sent flat] prose:", flat.prose.length, "facts:", JSON.stringify(flat.facts.map(([k]) => k)));
}
