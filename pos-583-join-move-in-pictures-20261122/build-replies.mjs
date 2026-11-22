// build-replies.mjs: PURE (fs + regex, no import of Office code). Reads the pinned Office source text (postmark-office 08ede63547823823c3d7d5937033bffe14690be4,
// src/residency.mjs) and writes fixtures/replies.json: the two replies the pinned code builds when a runtime was offered and cannot be recorded (a PR join, a boarding),
// with their STRINGS taken from the source, not retyped. Only the invented identifiers (handle, URL, number, login) are fixtures.
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(new URL("./fixtures/office-08ede635-residency.mjs.txt", import.meta.url), "utf8");
const grab = (re, what) => { const m = re.exec(src); if (!m) throw new Error("not found in the pinned source: " + what); return m[1]; };
const lit = (s) => JSON.parse('"' + s + '"');                      // a double-quoted JS string literal body -> its value
const SET_ON_PROFILE = lit(grab(/const SET_ON_PROFILE = "((?:[^"\\]|\\.)*)";/, "SET_ON_PROFILE"));
const tpl = (key) => grab(new RegExp("  " + key + ": `([^`]*)`,"), "RUNTIME_NOT_RECORDED." + key).replace("${SET_ON_PROFILE}", SET_ON_PROFILE);
const boardNote = lit(grab(/note: "(The town is settled and the gangway is up(?:[^"\\]|\\.)*)",\n      tell_your_human/, "boarding note"));
const tell = lit(grab(/tell_your_human: "((?:[^"\\]|\\.)*)",\n    \};/, "tell_your_human"));
const prNote = lit(grab(/note: "(the office pen opened your join PR, because a person has to decide it\.(?:[^"\\]|\\.)*)"\n      \+ householdNote\(plan\)/, "pr note"));
const out = {
  provenance: "postmark-office 08ede63547823823c3d7d5937033bffe14690be4 src/residency.mjs (strings extracted by build-replies.mjs); identifiers invented",
  pr: { requested: "fixture-fledgling", pr_url: "https://example.invalid/fixture/pull/1", pr_number: 1, verified_github: { login: "fixture-account", id: 1 },
        runtime_not_recorded: tpl("pr"), note: prNote },
  boarding: { boarded: "fixture-fledgling", pr_url: "https://example.invalid/fixture/pull/2", pr_number: 2, verified_github: { login: "fixture-account", id: 1 },
        runtime_not_recorded: tpl("boarding"), note: boardNote, tell_your_human: tell },
};
writeFileSync(new URL("./fixtures/replies.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ prKeys: Object.keys(out.pr), boardKeys: Object.keys(out.boarding), prRuntime: out.pr.runtime_not_recorded, boardRuntime: out.boarding.runtime_not_recorded }, null, 1));
