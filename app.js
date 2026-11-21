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
  const reportStatus = document.getElementById('report-status');

  // Очистка ввода от лишних символов (пробелы, дефисы и т.д.)
  function normalize(raw) {
    return String(raw || '').toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
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
    submitBtn.querySelector('.btn__label').textContent = on ? 'Проверяем базы…' : 'Проверить автомобиль';
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch { 
      return iso; 
    }
  }

  // Отрисовка списка проверок
  function renderChecks(checks) {
    reportChecks.innerHTML = '';
    
    // Если бэкенд вернул ошибку или пустой массив
    if (!checks || !Array.isArray(checks)) {
      const li = document.createElement('li');
      li.textContent = 'Не удалось получить список проверок.';
      reportChecks.appendChild(li);
      return;
    }

    checks.forEach((check) => {
      const li = document.createElement('li');
      const nameWrap = document.createElement('div');
      nameWrap.className = 'check__name';

      // Иконка статуса
      const icon = document.createElement('span');
      icon.className = 'check__icon';
      icon.textContent = check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '—';

      const label = document.createElement('span');
      label.textContent = check.name;
      nameWrap.append(icon, label);

      // Плашка со статусом
      const status = document.createElement('span');
      status.className = 'check__status';
      
      if (check.status === 'ok') {
        status.classList.add('check__status--ok');
        status.textContent = 'ОК';
      } else if (check.status === 'warn') {
        status.classList.add('check__status--warn');
        status.textContent = 'Внимание';
      } else {
        status.classList.add('check__status--skip');
        status.textContent = 'Пропущено';
      }
      
      // Показываем детали при клике на статус
      if (check.details) {
        status.style.cursor = 'pointer';
        status.title = 'Нажмите, чтобы узнать подробности';
        status.addEventListener('click', () => {
          let msg = check.details;
          if (check.sourceUrl) msg += '\n\nИсточник: ' + check.sourceUrl;
          alert(msg);
        });
      }

      li.append(nameWrap, status);
      reportChecks.appendChild(li);
    });
  }

  // Отрисовка всего отчета
  function renderReport(data) {
    reportQuery.textContent = data.query;
    reportMeta.textContent = 'Запрос выполнен: ' + formatDate(data.checkedAt);
    reportMessage.textContent = data.summary || 'Проверка завершена.';
    
    // Меняем цвет плашки в зависимости от результата
    if (data.summary && data.summary.includes('предупреждения')) {
      reportStatus.className = 'chip chip--warn';
      reportStatus.textContent = 'Есть замечания';
    } else {
      reportStatus.className = 'chip chip--ok';
      reportStatus.textContent = 'Проверено';
    }

    renderChecks(data.checks);

    resultEl.hidden = false;
    skeletonEl.hidden = true;
    reportEl.hidden = false;
    reportEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Отправка запроса на сервер
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

      // Небольшая задержка для красоты (чтобы скелетон не мелькал)
      await new Promise(r => setTimeout(r, 300));
      renderReport(data);
    } catch (err) {
      skeletonEl.hidden = true;
      resultEl.hidden = true;
      showError(err.message || 'Не удалось выполнить проверку.');
    } finally {
      setLoading(false);
    }
  }

  // Обработчик формы
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();

    const raw = input.value.trim();
    if (!raw) {
      showError('Введите VIN, кузов или госномер.');
      return;
    }

    const value = normalize(raw);
    if (value.length < 5) {
      showError('Слишком короткий запрос.');
      return;
    }

    setLoading(true);
    submit(value);
  });

  // Сброс ошибки при вводе
  input.addEventListener('input', () => { 
    if (!errorEl.hidden) clearError(); 
  });

  // Кнопка "Проверить другой"
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
