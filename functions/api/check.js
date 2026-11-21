// ============================================================
// VINCHECK — Engine v2.5 (С информацией об авто и умным VIN)
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

const AvtoVinCodProvider = {
  // 1. Получаем базовую инфу и VIN (если ввели номер)
  async getCarInfo(query, type, env) {
    const token = env.AVTOVINCOD_TOKEN;
    if (!token) return null;
    try {
      const param = type === 'vin' ? 'vin' : type === 'plate' ? 'plate' : 'body';
      const url = `https://api.avtovincod.ru/info?${param}=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      
      if (data.success === 1 && data.vehicle) {
        return data.vehicle; // Возвращает объект { vin, mark, model, year, ... }
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  async checkPledge(query, type, env) {
    const token = env.AVTOVINCOD_TOKEN;
    if (!token) return this.skip('Залог ФНП', 'Токен не настроен');
    const param = type === 'vin' ? 'vin' : type === 'body' ? 'body' : null;
    if (!param) return this.skip('Залог ФНП', 'Нужен VIN или кузов');
    try {
      const url = `https://api.avtovincod.ru/pledge?${param}=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
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

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, message: 'Некорректный JSON.' }, 400); }

  const normalized = normalize(body?.query);
  let type = detectType(normalized);
  if (!type) return json({ ok: false, message: 'Не удалось распознать формат.' }, 422);

  let vehicle = null;
  let searchQuery = normalized; // По умолчанию ищем по тому, что ввели
  let searchType = type;

  // Если ввели не VIN, пробуем сначала узнать VIN и инфу об авто
  if (type !== 'vin') {
    vehicle = await AvtoVinCodProvider.getCarInfo(normalized, type, env);
    if (vehicle && vehicle.vin) {
      searchQuery = vehicle.vin; // Если нашли VIN — дальше используем его!
      searchType = 'vin';
    }
  } else {
    // Если сразу ввели VIN, просто получаем инфу
    vehicle = await AvtoVinCodProvider.getCarInfo(normalized, type, env);
  }

  // Теперь делаем все проверки (используя найденный VIN, если он был)
  const results = await Promise.allSettled([
    AvtoVinCodProvider.checkPledge(searchQuery, searchType, env),
    AvtoVinCodProvider.checkTaxi(normalized, type, env), // Такси и ЕАИСТО можно искать и по номеру
    AvtoVinCodProvider.checkGibddHistory(searchQuery, searchType, env),
    AvtoVinCodProvider.checkEaisto(normalized, type, env)
  ]);

  const checks = results.map(r => r.status === 'fulfilled' ? r.value : { name: 'Источник', status: 'skip', details: `Сбой: ${r.reason?.message || 'неизвестно'}` });

  const warnCount = checks.filter(c => c.status === 'warn').length;
  const skipCount = checks.filter(c => c.status === 'skip').length;

  let summary = 'Проверка выполнена.';
  if (warnCount > 0) summary = `Обнаружены предупреждения (${warnCount}).`;
  else summary = `Проблем не обнаружено.`;
  if (skipCount > 0) summary += ` Пропущено: ${skipCount}.`;

  return json({
    ok: true, 
    query: normalized, 
    type,
    vehicle: vehicle, // Отдаем инфу об авто на фронтенд
    checkedAt: new Date().toISOString(),
    summary, 
    checks
  });
}

export async function onRequestGet() {
  return json({ ok: true, status: 'online' });
}
