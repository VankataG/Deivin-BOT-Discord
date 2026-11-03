import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDealsEmbed, extractLivePrice, getNextWheyCheck, qualifiesWheyDeal, TRACKED_PRODUCTS } from '../src/whey-deals.js';

const whey1kg = { sourceName: 'True Whey', weightKg: 1 };

test('selects GymBeam 1 kg offer instead of the 30 g AggregateOffer low price', () => {
  const html = `<meta property="product:price:amount" content="1.40"><script type="application/ld+json">${JSON.stringify({
    '@type': 'Product', name: 'True Whey - GymBeam', offers: {
      '@type': 'AggregateOffer', lowPrice: 1.4, highPrice: 84.95, offers: [
        { '@type': 'Offer', name: 'True Whey - GymBeam 1000 g - chocolate', price: 34.95, priceCurrency: 'EUR' },
        { '@type': 'Offer', name: 'True Whey - GymBeam 2500 g - chocolate', price: 84.95, priceCurrency: 'EUR' },
        { '@type': 'Offer', name: 'True Whey - GymBeam 30 g - chocolate', price: 1.4, priceCurrency: 'EUR' },
      ],
    },
  })}</script>`;
  assert.equal(extractLivePrice(html, whey1kg), 34.95);
  assert.equal(extractLivePrice(html, { sourceName: 'True Whey', weightKg: 2.5 }), 84.95);
});

test('reads current price from a single-size product Offer', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"NOW Foods Whey Protein Isolate","offers":{"@type":"Offer","priceCurrency":"EUR","price":"160.00"}}</script>';
  assert.equal(extractLivePrice(html, { sourceName: 'NOW Foods Whey Protein Isolate', weightKg: 2.268 }), 160);
});

test('uses current Offer price and ignores its strike-through reference price', () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"AMIX Whey Pro Fusion","offers":{"@type":"Offer","priceCurrency":"EUR","price":"192.75","priceSpecification":{"priceType":"https://schema.org/StrikethroughPrice","price":"257.00"}}}</script>';
  assert.equal(extractLivePrice(html, { sourceName: 'AMIX Whey Pro Fusion', weightKg: 4 }), 192.75);
});

test('a 5 percent subscription deal cannot qualify a 1 kg pack above the €30/kg ceiling', () => {
  assert.equal(qualifiesWheyDeal({ pricePerKg: 34.95 }), false);
  assert.equal(qualifiesWheyDeal({ pricePerKg: 29.99 }), true);
});

test('Fitness1 LA Whey at its verified 2.27 kg pack price qualifies under €30/kg', () => {
  const price = 54.95;
  const packKg = 2.27;
  assert.equal(Math.round((price / packKg) * 100) / 100, 24.21);
  assert.equal(qualifiesWheyDeal({ pricePerKg: price / packKg }), true);
});

test('deal embed shows full pack price and price per kg without an unsupported discount claim', () => {
  const embed = buildDealsEmbed([{
    store: 'GymBeam', title: 'True Whey — 1 kg', priceEur: 29.95, pricePerKg: 29.95,
    url: 'https://gymbeam.bg/true-whey-gymbeam.html',
  }]).toJSON();
  const text = embed.fields[0].value;
  assert.match(text, /Цена: €29\.95/);
  assert.match(text, /Цена\/kg: €29\.95/);
  assert.doesNotMatch(text, /Намаление/);
});

test('does not infer a price from unrelated metadata, page offers, or crossed-out text', () => {
  const html = '<meta property="product:price:amount" content="1.40"><span class="old-price">99.95 €</span><script type="application/ld+json">{"@type":"Product","name":"Unrelated snack","offers":{"@type":"Offer","price":"1.40","priceCurrency":"EUR"}}</script>';
  assert.equal(extractLivePrice(html, whey1kg), null);
});

test('catalog contains only explicitly selected whey products and verified product pages', () => {
  assert.equal(TRACKED_PRODUCTS.length, 5);
  assert.ok(TRACKED_PRODUCTS.every(({ title, url }) => /whey/i.test(title) && /^https:\/\//.test(url)));
  assert.ok(TRACKED_PRODUCTS.every(({ title }) => !/vegan|gainer|collagen|bar|bcaa|creatine/i.test(title)));
});

test('calculates the next scheduled check in Sofia time', () => {
  assert.match(getNextWheyCheck(new Date('2026-10-28T06:30:00.000Z')), /09:00 \(Europe\/Sofia\)$/);
  assert.match(getNextWheyCheck(new Date('2026-10-28T19:30:00.000Z')), /09:00 \(Europe\/Sofia\)$/);
});
