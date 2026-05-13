/**
 * Build-time configuratie voor de browser-app.
 *
 * PROXY_URL wijst naar de Cloudflare Worker proxy in
 * security-commons-nl/anonimizer-proxy. Wijzig hier als die op een
 * ander domein komt te draaien (bv. een eigen security-commons.nl
 * subdomein via Cloudflare custom hostnames).
 */
export const PROXY_URL = "https://anonimizer-proxy.shgstevens.workers.dev";
