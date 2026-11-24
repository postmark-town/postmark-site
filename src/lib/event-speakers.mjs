// event-speakers.mjs — when an event page carries its speakers' faces (CORE-178).
//
// The event page hands each room's reader the site's one resident mention as its speaker identity, drawn from the build's own faces it carries on
// the conversation section (no new read). It must carry them WHENEVER that section can mount a reader: the section is drawn for every event that is not
// cancelled, and an ENDED page whose bake had no rooms still asks the office's one-event read (CORE-174's data-refresh) and adds the rooms it now
// has. Until 2026-11-24 the faces were carried only when rooms were baked or the event was live, so those late rooms kept the World's fallback for good
// (the independent review on site #491, F1).

/** The page's sections (calendar.mjs § eventSections): true when the conversation section is drawn, so a reader may mount in it. */
export const carriesSpeakerFaces = (sections) => !!sections && !sections.cancelled;
