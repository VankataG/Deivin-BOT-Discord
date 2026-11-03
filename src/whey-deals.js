import { EmbedBuilder } from 'discord.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TIME_ZONE = 'Europe/Sofia';
const CHANNEL_ID = process.env.WHEY_DEALS_CHANNEL_ID;
const STATE_PATH = process.env.WHEY_DEALS_STATE_FILE
  ? (isAbsolute(process.env.WHEY_DEALS_STATE_FILE)
    ? process.env.WHEY_DEALS_STATE_FILE
    : resolve(process.cwd(), process.env.WHEY_DEALS_STATE_FILE))
  : fileURLToPath(new URL('../data/whey-deals-state.json', import.meta.url));
const MAX_EUR_PER_KG = Number(process.env.WHEY_MAX_EUR_PER_KG ?? 30);
const CHECK_HOURS = [9, 15, 21];
const USER_AGENT = 'DeivinBot-WheyDeals/1.0 (+product price availability check)';

// Explicit catalog only. Pack sizes and product classifications were checked against the product pages.
// Reference prices are intentionally omitted: displayed strike-through prices are not treated as evidence.
export const TRACKED_PRODUCTS = [
  { id: 'gymbeam:true-whey:1000g', store: 'GymBeam', title: 'True Whey — 1 kg', sourceName: 'True Whey', type: 'Whey concentrate', weightKg: 1, url: 'https://gymbeam.bg/true-whey-gymbeam.html' },
  { id: 'gymbeam:true-whey:2500g', store: 'GymBeam', title: 'True Whey — 2.5 kg', sourceName: 'True Whey', type: 'Whey concentrate', weightKg: 2.5, url: 'https://gymbeam.bg/true-whey-gymbeam.html' },
  { id: 'fitness1:now-isolate:2268g', store: 'Fitness1', title: 'NOW Foods Whey Protein Isolate — 2.268 kg', sourceName: 'NOW Foods Whey Protein Isolate', type: 'Whey isolate', weightKg: 2.268, url: 'https://fitness1.bg/proteini/now-foods/now-foods-whey-protein-isolate/10079' },
  { id: 'fitness1:lazar-angelov-whey:2270g', store: 'Fitness1', title: 'Lazar Angelov LA Whey Protein — 2.27 kg', sourceName: 'Lazar Angelov Nutrition LA Whey Protein Powder Drink Mix | Concentrate', type: 'Whey concentrate', weightKg: 2.27, url: 'https://fitness1.bg/proteini/lazar-angelov-nutrition/la-whey-protein-powder-drink-mix-concentrate/40200' },
  { id: 'silabg:amix-whey-pro-fusion:4000g', store: 'SilaBG', title: 'AMIX Whey Pro Fusion — 4 kg', sourceName: 'AMIX Whey Pro Fusion', type: 'Whey blend', weightKg: 4, url: 'https://www.silabg.com/en/11569-amix-whey-pro-fusion.html' },
];

function sofiaParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, Number(value)]));
}

function dateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getNextWheyCheck(from = new Date()) {
  const local = sofiaParts(from);
  const current = local.hour * 60 + local.minute;
  const next = CHECK_HOURS.map((hour) => hour * 60).find((minute) => minute > current);
  const dayShift = next === undefined ? 1 : 0;
  const minuteOfDay = next ?? CHECK_HOURS[0] * 60;
  // Use a UTC date cursor only to construct a stable local wall-clock label; timezone conversion is handled by Intl.
  const day = new Date(Date.UTC(local.year, local.month - 1, local.day + dayShift));
  return `${new Intl.DateTimeFormat('bg-BG', { timeZone: TIME_ZONE, dateStyle: 'short' }).format(day)} ${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')} (Europe/Sofia)`;
}

async function loadState() {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  try {
    const state = JSON.parse(await readFile(STATE_PATH, 'utf8'));
    return { sentToday: {}, offers: {}, ...state };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { lastCheckAt: null, lastCheckOk: false, lastCheckError: null, sentToday: {}, offers: {}, lastScheduledKey: null };
  }
}

async function saveState(state) {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function decodeHtml(text) {
  return text.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
}

function parsePrice(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(/\s/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '');
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function htmlAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}=["']([^"']*)["']`, 'i'))?.[1];
}

function findProducts(value, found = []) {
  if (!value) return found;
  if (Array.isArray(value)) {
    for (const item of value) findProducts(item, found);
  } else if (typeof value === 'object') {
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.includes('Product')) found.push(value);
    if (value['@graph']) findProducts(value['@graph'], found);
  }
  return found;
}

function normalizeName(value = '') {
  return decodeHtml(String(value)).replace(/<[^>]*>/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function unpackOffers(offers) {
  if (!offers || typeof offers !== 'object') return [];
  if (Array.isArray(offers)) return offers.flatMap(unpackOffers);
  // AggregateOffer.lowPrice/highPrice may be a sample sachet or another variant: never use those totals.
  if (String(offers['@type']).includes('AggregateOffer')) return unpackOffers(offers.offers);
  return [offers];
}

export function extractLivePrice(html, product) {
  if (!product?.sourceName || !product?.weightKg) return null;
  const expectedName = normalizeName(product.sourceName);
  const expectedGrams = Math.round(product.weightKg * 1000);
  const matchingOffers = [];

  // Read only a named, exact-size Product Offer. Ignore meta prices and AggregateOffer.lowPrice.
  for (const [, source] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(source.replace(/^\s*<!--|-->\s*$/g, ''));
      for (const pageProduct of findProducts(data)) {
        if (!normalizeName(pageProduct.name).includes(expectedName)) continue;
        const hasVariantOffers = String(pageProduct.offers?.['@type']).includes('AggregateOffer');
        for (const offer of unpackOffers(pageProduct.offers)) {
          if (offer.priceCurrency && offer.priceCurrency !== 'EUR') continue;
          if (hasVariantOffers) {
            if (!offer.name) continue;
            const offerName = normalizeName(offer.name);
            const packPattern = new RegExp(`\\b${expectedGrams}\\s*g\\b`, 'i');
            if (!packPattern.test(offerName)) continue;
          }
          const price = parsePrice(offer.price);
          if (price) matchingOffers.push(price);
        }
      }
    } catch {
      // Ignore unrelated or malformed structured data and continue with other price signals.
    }
  }
  return matchingOffers.length ? Math.min(...matchingOffers) : null;
}

async function fetchProduct(product) {
  const response = await fetch(product.url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const price = extractLivePrice(html, product);
  if (!price) throw new Error('No unambiguous live product price metadata found');
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const titleText = decodeHtml(titleTag.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().toLowerCase();
  const productName = product.sourceName.toLowerCase();
  if (titleText && !titleText.includes(productName.split(' — ')[0]) && !titleText.includes(productName)) {
    throw new Error('Page title did not match the tracked product');
  }

  return { ...product, priceEur: price, pricePerKg: price / product.weightKg, checkedAt: new Date().toISOString() };
}

export function qualifiesWheyDeal(deal) {
  return deal.pricePerKg <= MAX_EUR_PER_KG;
}

export async function checkWheyDeals() {
  const results = await Promise.allSettled(TRACKED_PRODUCTS.map(fetchProduct));
  const deals = [];
  const failures = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (qualifiesWheyDeal(result.value)) deals.push(result.value);
    } else {
      failures.push({ product: TRACKED_PRODUCTS[index], error: result.reason?.message ?? String(result.reason) });
      console.warn(`[whey-deals] Skipping ${TRACKED_PRODUCTS[index].store} / ${TRACKED_PRODUCTS[index].title}: ${result.reason?.message ?? result.reason}`);
    }
  });
  const checkedCount = results.filter((result) => result.status === 'fulfilled').length;
  const state = await loadState();
  // A previous parser version could mistake a 30 g serving's AggregateOffer.lowPrice for a 1 kg pack.
  // Clear those impossible full-pack notification values so a future valid deal can notify again.
  for (const [id, offer] of Object.entries(state.offers ?? {})) {
    if (offer.lastNotifiedPrice > 0 && offer.lastNotifiedPrice < 10) delete state.offers[id];
  }
  state.lastCheckAt = new Date().toISOString();
  state.lastCheckOk = checkedCount > 0;
  state.lastCheckError = checkedCount === 0 ? 'No tracked shop returned a usable price.' : null;
  state.shopChecks = Object.fromEntries(TRACKED_PRODUCTS.map((product, index) => {
    const result = results[index];
    return [product.id, result.status === 'fulfilled'
      ? { store: product.store, ok: true, priceEur: result.value.priceEur, checkedAt: result.value.checkedAt }
      : { store: product.store, ok: false, error: result.reason?.message ?? String(result.reason), checkedAt: new Date().toISOString() }];
  }));
  await saveState(state);
  return { deals, failures, checkedCount };
}

export function buildDealsEmbed(deals, { test = false } = {}) {
  const embed = new EmbedBuilder()
    .setColor(test ? 0x8e9aaf : 0xff8c00)
    .setTitle(test ? '🧪 Тестово WHEY известие' : '🔥 WHEY DEAL FOUND')
    .setTimestamp(new Date());
  if (test) {
    embed.setDescription('Това е тест на канала и оформлението. Не съдържа реална оферта и не променя историята на известията.');
    embed.addFields({ name: 'Канал за оферти', value: 'Връзката към Discord канала работи.' });
    return embed;
  }
  embed.setDescription('Цените са проверени от страниците на продуктите. Намаление се показва само при надеждна базова цена.');
  embed.addFields(deals.slice(0, 25).map((deal) => ({
    name: `${deal.store} — ${deal.title}`.slice(0, 256),
    value: [`💰 Цена: €${deal.priceEur.toFixed(2)}`, `⚖️ Цена/kg: €${deal.pricePerKg.toFixed(2)}`, `🏪 Магазин: ${deal.store}`, `🔗 [Линк към продукта](${deal.url})`].join('\n'),
    inline: false,
  })));
  return embed;
}

async function postNewDeals(client, deals) {
  if (!CHANNEL_ID || deals.length === 0) return 0;
  const state = await loadState();
  const today = dateKey(sofiaParts());
  if ((state.sentToday[today] ?? 0) >= 3) return 0;
  const newDeals = deals.filter((deal) => {
    const previous = state.offers[deal.id];
    if (!previous?.lastNotifiedPrice) return true;
    return deal.priceEur <= previous.lastNotifiedPrice * 0.9;
  });
  if (newDeals.length === 0) return 0;

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel?.isTextBased() || !channel.send) throw new Error('WHEY_DEALS_CHANNEL_ID is not a text channel the bot can send to');
  await channel.send({ embeds: [buildDealsEmbed(newDeals)] });
  for (const deal of newDeals) {
    state.offers[deal.id] = { lastNotifiedPrice: deal.priceEur, lastNotifiedAt: new Date().toISOString() };
  }
  state.sentToday[today] = (state.sentToday[today] ?? 0) + 1;
  await saveState(state);
  return newDeals.length;
}

export async function runScheduledWheyCheck(client) {
  const result = await checkWheyDeals();
  if (result.deals.length) await postNewDeals(client, result.deals);
  return result;
}

export async function readWheyDealStatus() {
  return { ...(await loadState()), trackedCount: TRACKED_PRODUCTS.length, nextCheck: getNextWheyCheck() };
}

export function startWheyDealsAutomation(client) {
  if (process.env.WHEY_DEALS_ENABLED === 'false') {
    console.log('Whey deals automation is disabled.');
    return;
  }
  if (!CHANNEL_ID) {
    console.warn('Whey deals automation is disabled: WHEY_DEALS_CHANNEL_ID is missing.');
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    const local = sofiaParts();
    if (!CHECK_HOURS.includes(local.hour) || local.minute !== 0) return;
    const key = `${dateKey(local)}-${local.hour}`;
    const state = await loadState();
    if (state.lastScheduledKey === key) return;
    running = true;
    try {
      state.lastScheduledKey = key;
      await saveState(state);
      await runScheduledWheyCheck(client);
    } catch (error) {
      console.error('[whey-deals] Scheduled check failed:', error);
    } finally {
      running = false;
    }
  };
  setInterval(() => void tick().catch((error) => console.error('[whey-deals] Scheduler error:', error)), 30_000);
  console.log(`Whey deals automation enabled; checks at 09:00, 15:00, and 21:00 ${TIME_ZONE}.`);
}
