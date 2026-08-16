/**
 * Compatibility boundary: the public module key is `reservations` while the
 * first implementation historically lived under `modules/bookings`.
 * Keep the old export during migration and let new code import the canonical name.
 */
export { bookingsRouter as reservationsRouter } from "../bookings/router";
