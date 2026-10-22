/**
 * Shared motion vocabulary.
 *
 * The built-in CSS easings are too weak to read as deliberate, so entrances
 * use a strong ease-out: fast at the start, where the eye is already
 * looking. Durations stay under 300ms; anything an element does on arrival
 * should be over before it is consciously noticed.
 *
 * Reduced motion keeps the fade and drops only the movement. An element
 * that appears with no transition at all reads as broken rather than calm.
 */
export const EASE_OUT_STRONG = "ease-[cubic-bezier(0.23,1,0.32,1)]";

/** The same curve as a raw value, for a timing function set from JavaScript. */
export const EASE_OUT_STRONG_VALUE = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * The iOS drawer curve, by way of Ionic. A panel changing size is morphing
 * rather than entering, so it wants gentle acceleration at both ends: a
 * strong ease-out drops most of the distance immediately and then crawls,
 * which reads as snappy rather than smooth.
 */
export const EASE_DRAWER_VALUE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** For a step or card that arrives above something already on screen. */
export const ENTER_SLIDE = `animate-in fade-in slide-in-from-top-1 duration-200 ${EASE_OUT_STRONG} motion-reduce:[--tw-enter-translate-y:0px]`;

/** For a chip or badge that settles into place. */
export const ENTER_SCALE = `animate-in fade-in zoom-in-95 duration-200 ${EASE_OUT_STRONG} motion-reduce:[--tw-enter-scale:1]`;

/** For an icon swapping inside a control that stays put. */
export const ENTER_ICON = `animate-in fade-in zoom-in-95 duration-150 ${EASE_OUT_STRONG} motion-reduce:[--tw-enter-scale:1]`;
