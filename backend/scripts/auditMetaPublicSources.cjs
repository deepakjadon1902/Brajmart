// Read public deployment assets only; never submit tracking or payment events.
const urls = [
  'https://www.brajmart.com/',
  'https://www.googletagmanager.com/gtm.js?id=GTM-PBFHQWC4',
  'https://connect.facebook.net/signals/config/1824114108557446',
];

const { parse } = require('../../frontend/node_modules/acorn');
const readTrackingRules = (source) => {
  const result = { derivedPurchaseRules: [], derivedRuleContexts: [], metaGatewayConfigurations: [], gtmTags: [], gtmPredicates: [], gtmMacros: [], gtmRules: [] };
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee?.property?.name === 'set' && /openbridge|parallelfire/i.test(String(node.arguments?.[1]?.value))) {
      result.metaGatewayConfigurations.push(source.slice(node.start, node.end));
    }
    if (node.type === 'ObjectExpression' && node.properties?.some((property) => property.key?.value === 'derived_event_name' && property.value?.value === 'Purchase')) {
      try {
        result.derivedPurchaseRules.push(JSON.parse(source.slice(node.start, node.end)));
        result.derivedRuleContexts.push(source.slice(Math.max(0, node.start - 180), node.end + 40));
      } catch {}
    }
    if (node.type === 'Property' && (node.key?.value || node.key?.name) === 'resource' && node.value?.type === 'ObjectExpression') {
      try {
        const resource = JSON.parse(source.slice(node.value.start, node.value.end));
        result.gtmTags = (resource.tags || []).filter((tag) => /facebook|pixel|1824114108557446|2744712869202681/i.test(JSON.stringify(tag)));
        result.gtmPredicates = resource.predicates || [];
        result.gtmMacros = resource.macros || [];
        result.gtmRules = resource.rules || [];
      } catch {}
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  try { visit(parse(source, { ecmaVersion: 'latest' })); } catch {}
  return result;
};

(async () => {
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const source = await response.text();
      console.log(JSON.stringify({
        url,
        status: response.status,
        bytes: source.length,
        pixelIds: [...new Set(source.match(/\b\d{15,16}\b/g) || [])].slice(0, 15),
        gtmIds: [...new Set(source.match(/GTM-[A-Z0-9]+/g) || [])],
        purchaseMentions: (source.match(/purchase/gi) || []).length,
        hasBrowserPurchaseGuard: source.includes('Purchase is sent only by verified'),
        hasAutoConfigDisabled: /['"]autoConfig['"]\s*,\s*false/.test(source),
        indicators: [...source.matchAll(/.{0,70}(?:Purchase|autoConfig|automaticEvents|eventSetupTool).{0,90}/gi)].slice(0, 8).map((match) => match[0]),
        trackingRules: url.includes('brajmart.com') ? undefined : readTrackingRules(source),
      }));
      if (!response.ok) process.exitCode = 1;
    } catch (error) {
      console.log(JSON.stringify({ url, error: error.message, cause: error.cause?.code }));
      process.exitCode = 1;
    }
  }
})();
