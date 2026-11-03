import Parser from 'rss-parser';
import { EmbedBuilder } from 'discord.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7',
  },
});
const NEWS_TIME_ZONE = 'Europe/Sofia';
const NEWS_CHANNEL_NAME = process.env.NEWS_CHANNEL_NAME ?? 'trading-shit';
const NEWS_POST_HOUR = Number(process.env.NEWS_POST_HOUR ?? 9);
const NEWS_POLL_INTERVAL = 5 * 60_000;
const NEWS_STATE_FILE = fileURLToPath(new URL('../data/news-state.json', import.meta.url));
const translatedTitleCache = new Map();
const NEWS_FEED_VERSION = 2;

const FEEDS = [
  {
    name: 'Federal Reserve',
    currency: 'USD',
    url: 'https://www.federalreserve.gov/feeds/press_monetary.xml',
    includeAll: false,
  },
  {
    name: 'FXStreet Forex News',
    currency: 'FX',
    url: 'https://www.fxstreet.com/rss/news',
    includeAll: false,
  },
  {
    name: 'European Central Bank',
    currency: 'EUR',
    url: 'https://www.ecb.europa.eu/rss/press.html',
    includeAll: false,
  },
];

const relevantHeadline = /interest rate|rate decision|monetary policy|central bank|inflation|consumer price|\bcpi\b|employment situation|unemployment|payroll|\bjobs\b|wage|\bfomc\b|\becb\b|\bgdp\b|economic growth|economic projections|forex|currency|currencies|\bfx\b|\b(?:usd|eur|gbp|jpy|aud|cad|nzd|chf)(?:\/|\b)|bond yield|treasury|gold price|crude oil/i;

function getSofiaDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: NEWS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  );
}

function getSofiaDateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function getPlainText(value = '') {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRelevant(item, feed) {
  return feed.includeAll || relevantHeadline.test(`${item.title} ${item.description}`);
}

async function fetchFeedItems(since) {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsedFeed = await parser.parseURL(feed.url);

      return (parsedFeed.items ?? []).flatMap((item) => {
        const title = getPlainText(item.title);
        const url = item.link;
        const publishedAt = new Date(item.isoDate ?? item.pubDate ?? NaN);
        const description = getPlainText(item.contentSnippet ?? item.summary ?? item.content ?? '');

        if (!title || !url || Number.isNaN(publishedAt.getTime())) return [];
        if (publishedAt < since || publishedAt > new Date(Date.now() + 5 * 60_000)) return [];

        const newsItem = {
          title,
          description,
          url,
          publishedAt,
          source: feed.name,
          currency: feed.currency,
        };

        return isRelevant(newsItem, feed) ? [newsItem] : [];
      });
    }),
  );

  return results.flatMap((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Could not read ${FEEDS[index].name} RSS feed: ${result.reason?.message ?? result.reason}`);
      return [];
    }

    return result.value;
  });
}

export async function getTodaysNews() {
  const todayKey = getSofiaDateKey(getSofiaDateTime());
  const recentItems = await fetchFeedItems(new Date(Date.now() - 26 * 60 * 60_000));

  return recentItems
    .filter((item) => getSofiaDateKey(getSofiaDateTime(item.publishedAt)) === todayKey)
    .sort((first, second) => second.publishedAt - first.publishedAt);
}

export async function translateToBulgarian(text) {
  if (translatedTitleCache.has(text)) return translatedTitleCache.get(text);

  try {
    const url = new URL('https://api.mymemory.translated.net/get');
    url.search = new URLSearchParams({
      q: truncate(text, 450),
      langpair: 'en|bg',
    }).toString();

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`translation service returned HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.responseStatus !== 200 || !result.responseData?.translatedText) {
      throw new Error('translation service returned no translation');
    }

    const translatedText = getPlainText(result.responseData.translatedText);
    translatedTitleCache.set(text, translatedText);
    return translatedText;
  } catch (error) {
    console.warn(`Could not translate headline; posting it in English: ${error.message}`);
    translatedTitleCache.set(text, text);
    return text;
  }
}

export function getMarketContext(title) {
  if (/inflation|consumer price|\bcpi\b|price index/i.test(title)) {
    return 'Публикация за инфлацията или цените. Следете отчетената промяна и периода, за който се отнася.';
  }

  if (/employment|unemployment|payroll|\bjobs\b|wage/i.test(title)) {
    return 'Публикация за пазара на труда. Следете отчетената стойност и сравнението с предишния период.';
  }

  if (/interest rate|rate decision|monetary policy|\bfomc\b|\becb\b/i.test(title)) {
    return 'Съобщение за паричната политика. Проверете решението и насоките в оригиналния източник.';
  }

  if (/\bgdp\b|economic growth|economic projections/i.test(title)) {
    return 'Публикация за икономическия растеж или прогнозите. Отворете източника за периода и точните стойности.';
  }

  return 'Новина, свързана с валутите или пазарите. Проверете подробностите в оригиналния източник.';
}

export function formatPublishedAt(date) {
  return new Intl.DateTimeFormat('bg-BG', {
    timeZone: NEWS_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

async function loadNewsState() {
  await mkdir(dirname(NEWS_STATE_FILE), { recursive: true });

  try {
    return JSON.parse(await readFile(NEWS_STATE_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { initialized: false, feedVersion: 0, lastDigestDate: '', seenUrls: [] };
  }
}

async function saveNewsState(state) {
  await writeFile(NEWS_STATE_FILE, JSON.stringify(state, null, 2));
}

async function postDailyDigest(channel, dateKey) {
  const state = await loadNewsState();
  if (state.lastDigestDate === dateKey) return;

  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const seenUrls = new Set(state.seenUrls ?? []);
  const items = (await fetchFeedItems(since))
    .sort((first, second) => second.publishedAt - first.publishedAt)
    .slice(0, 6);

  const embed = new EmbedBuilder()
    .setTitle('🗞️ Трейдинг новини — дневен обзор')
    .setColor(0x2f80ed)
    .setDescription(
      `Пазарни и официални източници • последните 24 часа • часове в българско време.\n${items.length === 0 ? 'Няма нови избрани заглавия за периода.' : 'Преводът и контекстът са информационни, не прогноза за посоката на пазара.'}`,
    );

  if (items.length > 0) {
    const translatedTitles = [];
    for (const item of items) {
      translatedTitles.push(await translateToBulgarian(item.title));
    }

    embed.addFields(
      items.map((item, index) => {
        return {
          name: truncate(`[${item.currency}] ${translatedTitles[index]}`, 256),
          value: [
            `**Какво да следим:** ${getMarketContext(item.title)}`,
            `[${item.source} — ${formatPublishedAt(item.publishedAt)}](${item.url})`,
          ].join('\n'),
          inline: false,
        };
      }),
    );
  }

  embed.setFooter({ text: 'Източници: FXStreet, ECB и Federal Reserve.' });
  await channel.send({ embeds: [embed] });

  state.lastDigestDate = dateKey;
  state.seenUrls = [...seenUrls, ...items.map((item) => item.url)].slice(-250);
  await saveNewsState(state);
}

async function publishNewHeadlines(channel) {
  const state = await loadNewsState();
  const items = await fetchFeedItems(new Date(Date.now() - 7 * 24 * 60 * 60_000));
  const seenUrls = new Set(state.seenUrls ?? []);

  if (!state.initialized || state.feedVersion !== NEWS_FEED_VERSION) {
    state.initialized = true;
    state.feedVersion = NEWS_FEED_VERSION;
    state.seenUrls = [...seenUrls, ...items.map((item) => item.url)].slice(-500);
    await saveNewsState(state);
    console.log(`News watcher initialized with ${items.length} existing headlines; no backlog was posted.`);
    return;
  }

  const newItems = items
    .filter((item) => !seenUrls.has(item.url))
    .sort((first, second) => first.publishedAt - second.publishedAt);

  for (const item of newItems) {
    const translatedTitle = await translateToBulgarian(item.title);
    const embed = new EmbedBuilder()
      .setTitle(truncate(`[${item.currency}] ${translatedTitle}`, 256))
      .setURL(item.url)
      .setColor(0x2f80ed)
      .setDescription(`**Какво да следим:** ${getMarketContext(item.title)}`)
      .setFooter({ text: `${item.source} • ${formatPublishedAt(item.publishedAt)}` });

    await channel.send({ embeds: [embed] });
    seenUrls.add(item.url);
    state.seenUrls = [...seenUrls].slice(-500);
    await saveNewsState(state);
  }
}

export function startNewsAutomation(client) {
  if (process.env.NEWS_AUTOMATION_ENABLED !== 'true') {
    console.log('Automatic news posting is disabled. Use /news to fetch headlines manually.');
    return;
  }

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  const channel = guild?.channels.cache.find(
    (candidate) => candidate.name === NEWS_CHANNEL_NAME && candidate.isTextBased(),
  );

  if (!channel) {
    console.error(`Could not find text channel #${NEWS_CHANNEL_NAME} in the configured server.`);
    return;
  }

  let isRunning = false;
  let retryAfter = 0;

  const checkAndPost = async () => {
    const now = new Date();
    const local = getSofiaDateTime(now);
    if (isRunning || Date.now() < retryAfter) return;

    isRunning = true;
    try {
      await publishNewHeadlines(channel);

      if (local.hour >= NEWS_POST_HOUR) {
        await postDailyDigest(channel, getSofiaDateKey(local));
      }
    } catch (error) {
      retryAfter = Date.now() + 5 * 60_000;
      console.error('Could not check or publish news:', error);
    } finally {
      isRunning = false;
    }
  };

  void checkAndPost();
  setInterval(() => void checkAndPost(), NEWS_POLL_INTERVAL);
}
