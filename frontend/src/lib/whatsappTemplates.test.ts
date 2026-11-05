import { describe, expect, it } from 'vitest';
import { buildDispatchedOrderWhatsAppMessage, getCourierTrackingUrl } from './whatsappTemplates';

describe.each([
  { courier: 'Shadowfax', awb: 'SF12345', url: 'https://shadowfax.in/track' },
  { courier: 'Amazon Shipping', awb: 'AMZ12345', url: 'https://track.amazon.in/' },
])('$courier dispatch details', ({ courier, awb, url }) => {
  it('links to the official tracking page and preserves the saved courier and AWB', () => {
    const message = buildDispatchedOrderWhatsAppMessage({
      orderId: '12345', customerName: 'Customer', shippingService: courier, trackingId: awb,
    });
    expect(message).toContain(`Shipping Provider: ${courier}`);
    expect(message).toContain(`Your Order Tracking Number is: ${awb}`);
    expect(message).toContain(url);
    expect(message).not.toContain('delhivery.com');
  });

  it('recognizes the courier regardless of case or surrounding whitespace', () => {
    expect(getCourierTrackingUrl(` ${courier.toLowerCase()} `, awb)).toBe(url);
    expect(getCourierTrackingUrl(courier.toUpperCase())).toBe(url);
  });
});
