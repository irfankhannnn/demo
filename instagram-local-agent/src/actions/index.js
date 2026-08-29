/**
 * A10 / A11 - Account management and publishing. PHASE 4 - NOT IMPLEMENTED.
 *
 * The interfaces are fixed here so the console and CLI can already reference
 * them and so the shape is agreed before anyone writes the bodies. See
 * docs/insta-sol-ms-docs/01-PLAN.md sections A10 and A11.
 *
 * What belongs here when it is built - and, just as importantly, what never
 * will. Comment moderation, public replies and publishing are all officially
 * supported write actions. Following, unfollowing, liking and bulk DMs are not
 * in this file and must not be added to it: none of them has an official API,
 * and every one of them is a documented route to an account restriction.
 */
const NOT_IMPLEMENTED = 'Phase 4 - not implemented. See docs/insta-sol-ms-docs/01-PLAN.md';

function unimplemented(name) {
  return () => {
    throw new Error(`${name}: ${NOT_IMPLEMENTED}`);
  };
}

/** A10 - hide a spam or competitor-poaching comment. */
export const hideComment = unimplemented('hideComment');

/** A10 - unhide a comment hidden in error. */
export const unhideComment = unimplemented('unhideComment');

/** A10 - delete one of OUR OWN comments. Never someone else's. */
export const deleteOwnComment = unimplemented('deleteOwnComment');

/** A10 - mark a DM thread as seen. */
export const markSeen = unimplemented('markSeen');

/** A10 - show the typing indicator. */
export const showTyping = unimplemented('showTyping');

/** A11 - create a media container (reel, image, carousel, story). */
export const createMediaContainer = unimplemented('createMediaContainer');

/** A11 - publish a prepared container. Capped by Meta at 50 posts / 24h. */
export const publishMedia = unimplemented('publishMedia');

export default {
  hideComment, unhideComment, deleteOwnComment, markSeen, showTyping,
  createMediaContainer, publishMedia,
};
