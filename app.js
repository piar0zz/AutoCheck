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
  
  // Создаем контейнер для инфы об авто прямо в памяти
  const vehicleCard = document.createElement('div');
  vehicleCard.className = 'vehicle-card';
  vehicleCard.hidden = true;
  // Вставляем его перед списком проверок
  reportChecks.parentNode.insertBefore(vehicleCard, reportChecks);

  function normalize(raw) { return String(raw || '').toUpperCase().replace(/[^A-ZА-Я0-9]/g, ''); }
  function showError(text) { errorEl.textContent = text; errorEl.hidden = false; }
  function clearError() { errorEl.hidden = true; errorEl.textContent = ''; }
  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-loading', on);
    submitBtn.querySelector('.btn__label').textContent = on ? 'Проверяем базы…' : 'Проверить автомобиль';
  }
  function formatDate(iso) {
    try { return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } 
    catch { return iso; }
  }

  function renderVehicle(vehicle) {
    if (!vehicle) {
      vehicleCard.hidden = true;
      return;
    }
    const mark = vehicle.mark || '—';
    const model = vehicle.model || '—';
    const year = vehicle.year || '—';
    const vin = vehicle.vin ? `<br><small style="color:var(--muted)">VIN: ${vehicle.vin}</small>` : '';
    
    vehicleCard.innerHTML = `
      <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${mark} ${model}</div>
      <div style="font-size: 14px; color: var(--muted);">${year} год ${vin}</div>
    `;
    vehicleCard.hidden = false;
  }

  function renderChecks(checks) {
    reportChecks.innerHTML = '';
    if (!checks || !Array.isArray(checks)) return;

    checks.forEach((check) => {
      const li = document.createElement('li');
      const nameWrap = document.createElement('div');
      nameWrap.className = 'check__name';

      const icon = document.createElement('span');
      icon.className = 'check__icon';
      icon.textContent = check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '—';

      const label = document.createElement('span');
      label.textContent = check.name;
      nameWrap.append(icon, label);

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
      
      if (check.details) {
        status.style.cursor = 'pointer';
        status.addEventListener('click', () => alert(check.details + (check.sourceUrl ? '\n\nИсточник: ' + check.sourceUrl : '')));
      }

      li.append(nameWrap, status);
      reportChecks.appendChild(li);
    });
  }

  function renderReport(data) {
    reportQuery.textContent = data.query;
    reportMeta.textContent = 'Запрос выполнен: ' + formatDate(data.checkedAt);
    reportMessage.textContent = data.summary || 'Проверка завершена.';
    
    if (data.summary && data.summary.includes('предупреждения')) {
      reportStatus.className = 'chip chip--warn';
      reportStatus.textContent = 'Есть замечания';
    } else {
      reportStatus.className = 'chip chip--ok';
      reportStatus.textContent = 'Проверено';
    }

    renderVehicle(data.vehicle); // Рисуем карточку авто
    renderChecks(data.checks);

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
      if (!res.ok || !data || data.ok === false) throw new Error(data?.message || 'Сервис недоступен.');

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

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    const raw = input.value.trim();
    if (!raw) return showError('Введите данные автомобиля.');
    const value = normalize(raw);
    if (value.length < 5) return showError('Слишком короткий запрос.');

    setLoading(true);
    submit(value);
  });

  input.addEventListener('input', () => { if (!errorEl.hidden) clearError(); });

  resetBtn.addEventListener('click', () => {
    resultEl.hidden = true;
    reportEl.hidden = true;
    vehicleCard.hidden = true;
    input.value = '';
    clearError();
    input.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
