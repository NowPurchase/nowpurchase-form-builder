/**
 * Single source of truth for the runtime environment.
 *
 * The same build can target either staging or production. Which one is decided
 * only by `VITE_IS_PROD` in the environment.
 *
 * Behavioural rules driven by IS_PROD:
 *   - Production calls the prod APIs everywhere (login included). The only
 *     staging call is the template-listing API on the Deployments page, which
 *     reuses the prod JWT (it is accepted by staging).
 *   - The Deployments section is only visible on production.
 */
export const IS_PROD = import.meta.env.VITE_IS_PROD === 'true';
