// ============================================================
// VINCHECK — Engine v2.0 (Бесплатный тариф)
// ============================================================

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
const BODY_RE = /^[A-Z0-9]{5,24}$/i;
const PLATE_RE = /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$/i;
const PLATE_NOREGION_RE = /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function normalize(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
}

function detectType(value) {
  if (VIN_RE.test(value)) return 'vin';
  if (PLATE_RE.test(value)) return 'plate';
  if (PLATE_NOREGION_RE.test(value)) return 'plate';
  if (BODY_RE.test(value)) return 'body';
  return null;
}

async function cachedFetch(key, ttlSeconds, fetchFn) {
  const cache = caches.default;
  const cacheKey = new Request(`https://vincheck.internal/cache/${encodeURIComponent(key)}`);
  let response = await cache.match(cacheKey);
  if (response) return response.json();

  const data = await fetchFn();
  if (!data) return null;

  await cache.put(cacheKey, new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttlSeconds}` }
  }));
  return data;
}

// ============================================================
// ПРОВАЙДЕР: AvtoVinCod (Залоги, Такси, ГИБДД, Пробег)
// ============================================================
const AvtoVinCodProvider = {
  async checkPledge(query, type, env) {
    const token = env.AVTOVINCOD_TOKEN;
    if (!token) return this.skip('Залог ФНП', 'Токен не настроен');
    const param = type === 'vin' ? 'vin' : type === 'body' ? 'body' : null;
    if (!param) return this.skip('Залог ФНП', 'Нужен VIN или номер кузова');

    try {
      const url = `https://api.avtovincod.ru/pledge?${param}=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json();
      if (data.active_count > 0) return { name: 'Залог ФНП', status: 'warn', details: `Действующий залог. Записей: ${data.found}`, sourceUrl: 'https://www.reestr-zalogov.ru/' };
      if (data.found > 0) return { name: 'Залог ФНП', status: 'ok', details: `Залог прекращён. Записей: ${data.found}` };
      return { name: 'Залог ФНП', status: 'ok', details: 'Залогов не найдено' };
    } catch (e) { return this.skip('Залог ФНП', `Ошибка: ${e.message}`); }
  },

  async checkTaxi(query, type, env) {
    const token = env.AVTOVINCOD_TOKEN;
    if (!token) return this.skip('Лицензия такси', 'Токен не настроен');
    try {
      const url = `https://api.avtovincod.ru/taxi?${type === 'vin' ? 'vin' : 'plate'}=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (data.isTaxi) return { name: 'Лицензия такси', status: 'warn', details: 'Действующая лицензия такси' };
      return { name: 'Лицензия такси', status: 'ok', details: 'Лицензий такси не найдено' };
    } catch (e) { return this.skip('Лицензия такси', `Ошибка: ${e.message}`); }
  },

  async checkGibddHistory(query, type, env) {
    const token = env.AVTOVINCOD_TOKEN;
    if (!token || type !== 'vin') return this.skip('История ГИБДД', 'Нужен VIN и токен');
    try {
      const res = await fetch(`https://api.avtovincod.ru/gibdd-archive?vin=${encodeURIComponent(query)}`, { headers: { 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      const periods = data.periods || [];
      if (periods.length > 0) return { name: 'История ГИБДД', status: 'ok', details: `Найдено периодов владения: ${periods.length}` };
      return { name: 'История ГИБДД', status: 'ok', details: 'Периодов не найдено' };
    } catch (e) { return this.skip('История ГИБДД', `Ошибка: ${e.message}`); }
  },

  async checkEaisto(query, type, env) {
    const token = env.AVTOVINCOD_TOKEN;
    if (!token) return this.skip('Пробег (ЕАИСТО)', 'Токен не настроен');
    try {
      const param = type === 'vin' ? 'vin' : type === 'plate' ? 'plate' : 'body';
      const url = `https://api.avtovincod.ru/probeg?${param}=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
      const data = await res.json();
      if (data.records && data.records.length > 0) {
        const latest = data.records[0];
        return { 
          name: 'Пробег (ЕАИСТО)', status: 'ok', 
          details: `Последний пробег: ${latest.car_mileage?.toLocaleString('ru-RU') || '—'} км (ТО от ${latest.date_of_diagnosis || '—'})`,
          sourceUrl: 'https://eaisto.ru/'
        };
      }
      return { name: 'Пробег (ЕАИСТО)', status: 'ok', details: 'Записей о техосмотре не найдено' };
    } catch (e) { return this.skip('Пробег (ЕАИСТО)', `Ошибка: ${e.message}`); }
  },

  skip(name, reason) { return { name, status: 'skip', details: reason, sourceUrl: null }; }
};

// ============================================================
// ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================
export async function onRequestGet() {
  return json({ ok: true, status: 'online', version: '2.0.0' });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, message: 'Некорректный JSON.' }, 400); }

  const normalized = normalize(body?.query);
  const type = detectType(normalized);
  if (!type) return json({ ok: false, message: 'Не удалось распознать формат.' }, 422);

  // Параллельный запуск всех проверок
  const results = await Promise.allSettled([
    AvtoVinCodProvider.checkPledge(normalized, type, env),
    AvtoVinCodProvider.checkTaxi(normalized, type, env),
    AvtoVinCodProvider.checkGibddHistory(normalized, type, env),
    AvtoVinCodProvider.checkEaisto(normalized, type, env)
  ]);

  const checks = results.map(r => r.status === 'fulfilled' ? r.value : { name: 'Источник', status: 'skip', details: `Сбой: ${r.reason?.message || 'неизвестно'}` });

  const warnCount = checks.filter(c => c.status === 'warn').length;
  const okCount = checks.filter(c => c.status === 'ok').length;
  const skipCount = checks.filter(c => c.status === 'skip').length;

  let summary = 'Проверка выполнена.';
  if (warnCount > 0) summary = `Обнаружены предупреждения (${warnCount}).`;
  else if (okCount > 0) summary = `Проверено баз: ${okCount}. Проблем нет.`;
  if (skipCount > 0) summary += ` Пропущено: ${skipCount} (нет ключа или источник недоступен).`;

  return json({
    ok: true, query: normalized, type,
    checkedAt: new Date().toISOString(),
    summary, checks
  });
}
