// speech-status.mjs — what the household page may say about the house's speech when the read of it failed (POS-779 candidate).
//
// `reads.conversationsStatus` (conversations-read.mjs) says whether a missing `conversations` body means the read could not be done
// (`unavailable`), was cut (`partial`) or was the office's short record (`legacy`). A refused read must never be drawn as a
// definitive "nothing was said": the feed's empty sentence, the said chip's zero and a resident's "nothing on the record lately" are
// all claims about speech, so while speech is unreadable they say that instead. Everything the page knows from its OTHER reads
// (letters, marks, stamps) stays exactly as it was; partial and legacy keep their existing note and change no count.
import { readNoteOf } from "../conversations-read.mjs";

/** True only when the speech read was refused or failed: the one state in which a zero or an empty sentence would be a false claim. */
export const speechUnknown = (reads) => reads?.conversationsStatus?.state === "unavailable";

/** The said chip's count text: unknown shows a question mark, never a zero. */
export const saidChipCount = (n, unknown) => (unknown ? " · ?" : " · " + (n ?? 0));

/** The sentence for an empty feed, or null when the ordinary words apply. Only an empty feed over unreadable speech changes. */
export function emptyFeedWords(reads) {
  return speechUnknown(reads) ? readNoteOf(reads.conversationsStatus, "what the house said") : null;
}

/** A resident card's "last active" words when no act of theirs is known: unreadable speech is not "nothing on the record". */
export const noActWords = (reads) => (speechUnknown(reads) ? "what they said can't be read just now" : "nothing on the record lately");
