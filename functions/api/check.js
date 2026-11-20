const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
const PLATE_RE = /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$/i;
const PLATE_NOREGION_RE = /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}$/i;
const BODY_RE = /^[A-Z0-9]{5,24}$/i;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function normalize(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
}

export async function onRequestGet() {
  return json({ ok: true, service: 'vincheck', version: '0.2.0' });
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: 'Некорректный запрос.' }, 400);
  }

  const normalized = normalize(body?.query);

  if (!normalized) {
    return json({ ok: false, message: 'Введите VIN, номер кузова или госномер.' }, 400);
  }

  let type = null;
  if (VIN_RE.test(normalized)) type = 'vin';
  else if (PLATE_RE.test(normalized)) type = 'plate';
  else if (PLATE_NOREGION_RE.test(normalized)) type = 'plate';
  else if (BODY_RE.test(normalized)) type = 'body';

  if (!type) {
    return json({
      ok: false,
      message: 'Не удалось распознать формат. Проверьте ввод.'
    }, 422);
  }

  return json({
    ok: true,
    query: normalized,
    type: type, 
    status: 'source_unavailable',
    checkedAt: new Date().toISOString(),
    message: 'Источники данных пока не подключены. Мы работаем над интеграцией и не показываем предполагаемые сведения.',
    sources: []
  });
}
