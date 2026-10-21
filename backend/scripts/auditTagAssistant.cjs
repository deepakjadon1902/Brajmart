// Read-only JSON analysis. Never executes scripts/HTML stored in an export.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const safePath = (value) => {
  try { return new URL(value).pathname.replace(/\/(?:order|pay)_[A-Za-z0-9]+/g, '/[payment-token]'); }
  catch { return ''; }
};
const resolved = (value) => {
  try { return JSON.parse(value); } catch { return value; }
};
function analyze(file) {
  const raw = fs.readFileSync(file);
  const data = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
  if (!Array.isArray(data.data?.containers)) throw new Error('Not a Tag Assistant export');
  return {
    file: path.basename(file), sha256: digest(raw), exportedAt: new Date(data.timestamp).toISOString(),
    containersSha256: digest(JSON.stringify(data.data.containers)),
    containers: data.data.containers.map((container) => {
      const tags = [...new Map((container.messages || []).flatMap((message) => message.tagInfo || []).map((tag) => [tag.name, tag])).values()];
      const ruleMap = new Map();
      for (const message of container.messages || []) for (const group of message.data || []) for (const rule of group.ruleInfo || []) {
        if (!/purchase|checkout|cart/i.test(rule.name)) continue;
        ruleMap.set(rule.name, {
          name: rule.name,
          predicates: (rule.predicates || []).map((predicate) => ({ operator: predicate.function, variable: predicate.arg0?.[0]?.name, expected: predicate.arg1?.[0] })),
          firingTags: (rule.firingTags || []).map((index) => message.tagInfo?.find((tag) => tag.index === index)?.name || index),
        });
      }
      return {
        publicId: container.publicId, version: container.version, product: container.product,
        aliases: container.aliases, destinations: container.destinations,
        messageCount: container.messages.length,
        eventCounts: container.messages.reduce((counts, message) => { const event = message.eventName || message.title; counts[event] = (counts[event] || 0) + 1; return counts; }, {}),
        navigationPaths: [...new Set((container.messages || []).map((message) => safePath(message.message?.['gtm.newUrl'])).filter(Boolean))],
        tags: tags.map((tag) => ({
          name: tag.name, type: tag.type,
          parameters: (tag.params || []).filter((param) => /^(vtp_pixelId|vtp_conversionId|vtp_conversionLabel|vtp_orderId|vtp_conversionValue|vtp_currencyCode)$/.test(param.key)).map((param) => ({ name: param.name, configured: resolved(param.value?.[0]), resolved: resolved(param.value?.[1]) })),
        })),
        fired: Object.entries(container.tagsFired || {}).map(([name, events]) => ({ name, count: events.length, eventTypes: [...new Set(events.map((message) => message.eventName))] })),
        purchaseEventCount: (container.messages || []).filter((message) => String(message.eventName || '').toLowerCase() === 'purchase').length,
        purchaseTagsFired: Object.entries(container.tagsFired || {}).filter(([name]) => /purchase/i.test(name)).map(([name, events]) => ({ name, count: events.length })),
        rules: [...ruleMap.values()],
      };
    }),
  };
}
module.exports = { analyze };
if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('Usage: node backend/scripts/auditTagAssistant.cjs <export.json> [export2.json]'); process.exitCode = 1; }
  else {
    try { console.log(JSON.stringify(files.map(analyze), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
