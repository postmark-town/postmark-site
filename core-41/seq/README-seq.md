# CORE-41: one phone-width tap sequence on the red mark (TOUCH EMULATION, not a physical phone)

Head under test: `952b0c18c3b0693775e3f245c7047d5aaa9a3735` (postmark-site#422, the build Truey i1 passed).
Input: Chrome DevTools `Input.dispatchTouchEvent` (touchStart/touchEnd) on a touch-emulating 390x844 @2x mobile viewport (`pointer: coarse`, `maxTouchPoints` 1), headless Chrome, throwaway profile, the built `dist-town`, served locally.
Board: invented. The settlement probe DOWN on a 2-minute-old board (the forced red mark). The live sentinel was never touched.
This is emulation. No physical phone was used; Darko's physical tap is still to come.

| frame | what it shows | popover open |
|---|---|---|
| seq-1-rest.png | at rest, the red mark shown, closed | false |
| seq-2-after-one-tap.png | 0.9 s after one real tap on the mark | true |
| seq-3-still-open-2s-later.png | 3 s after the tap, no further input: still open | true |
| seq-4-tap-on-its-words.png | a tap on the popover's own words: still open | true |
| seq-5-outside-tap-dismissed.png | a tap outside the mark and popover: dismissed | false |

The state of each frame (aria-expanded, rows, tap coordinates) is in `seq-states.json`.
