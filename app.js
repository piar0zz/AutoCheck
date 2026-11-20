(() => {
  'use strict';

  const form = document.getElementById('check-form');
  const input = document.getElementById('query');
  const errorEl = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  const resultEl = document.getElementById('result');
  const skeletonEl = document.getElementById('skeleton');
  const reportEl = document.getElementById('report');
  const resetBtn = document.getElementById('reset-btn');

  const reportQuery = document.getElementById('report-query');
  const reportMeta = document.getElementById('report-meta');
  const reportMessage = document.getElementById('report-message');
  const reportChecks = document.getElementById('report-checks');

  const FULL_CHECKS = [
    "История пробега и скрутки",
    "ДТП со схемой повреждений",
    "Залоги",
    "Лицензии такси",
    "Количество владельцев по ПТС",
    "Ограничения на регистрацию",
    "Коммерческое использование",
    "Обслуживание у дилера и СТО",
    "Лизинг",
    "Арбитражные дела",
    "Объявления о продаже с фото",
    "Розыск",
    "Периоды владения",
    "Дубликат ПТС",
    "Отзывные кампании",
    "Страховые полисы",
    "Среднерыночная стоимость"
  ];

  // Регулярные выражения для распознавания
  const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i; // 17 символов (VIN)
  const PLATE_RE = /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$/i; // Госномер с регионом
  const PLATE_NOREGION_RE = /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}$/i; // Госномер без региона
  const BODY_RE = /^[A-Z0-9]{5,24}$/i; // Номер кузова (от 5 до 24 символов)

  // Очищаем ввод от пробелов, дефисов и спецсимволов
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

  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
    input.removeAttribute('aria-invalid');
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-loading', on);
    submitBtn.querySelector('.btn__label').textContent = on ? 'Формируем отчет…' : 'Проверить автомобиль';
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  function renderChecks() {
    reportChecks.innerHTML = '';
    FULL_CHECKS.forEach((name, index) => {
      const li = document.createElement('li');
      const nameWrap = document.createElement('div');
      nameWrap.className = 'check__name';
      
      const icon = document.createElement('span');
      icon.className = 'check__icon';
      icon.textContent = index + 1; 
      
      const label = document.createElement('span');
      label.textContent = name;
      
      nameWrap.append(icon, label);
      
      const status = document.createElement('span');
      status.className = 'check__status check__status--pending';
      status.textContent = 'Ожидает источника';
      
      li.append(nameWrap, status);
      reportChecks.appendChild(li);
    });
  }

  function renderReport(data) {
    reportQuery.textContent = data.query || input.value.trim();
    reportMeta.textContent = 'Запрос выполнен: ' + formatDate(data.checkedAt);
    reportMessage.textContent = data.message ||
      'Источники данных пока не подключены. Проверка временно недоступна.';
    
    renderChecks();

    resultEl.hidden = false;
    skeletonEl.hidden = true;
    reportEl.hidden = false;

    reportEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submit(query) {
    clearError();
    resultEl.hidden = false;
    reportEl.hidden = true;
    skeletonEl.hidden = false;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.ok === false) {
        throw new Error(data?.message || 'Сервис временно недоступен. Попробуйте позже.');
      }

      await new Promise(r => setTimeout(r, 500));
      renderReport(data);
    } catch (err) {
      skeletonEl.hidden = true;
      resultEl.hidden = true;
      showError(err.message || 'Не удалось выполнить проверку. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();

    const raw = input.value.trim();
    if (!raw) {
      showError('Введите VIN, номер кузова или госномер автомобиля.');
      input.focus();
      return;
    }

    const value = normalize(raw);
    
    if (value.length < 5) {
      showError('Слишком короткий запрос. Введите VIN, номер кузова или госномер.');
      input.focus();
      return;
    }

    if (!detectType(value)) {
      showError('Не удалось распознать формат. Проверьте ввод.');
      input.focus();
      return;
    }

    setLoading(true);
    submit(value);
  });

  input.addEventListener('input', () => {
    if (!errorEl.hidden) clearError();
  });

  resetBtn.addEventListener('click', () => {
    resultEl.hidden = true;
    reportEl.hidden = true;
    skeletonEl.hidden = true;
    input.value = '';
    clearError();
    input.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
