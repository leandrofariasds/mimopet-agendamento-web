/*
 * MimoPet — agenda de atendimentos (front-end)
 * Todos os dados são armazenados localmente neste navegador.
 * Para uso comercial, substitua o localStorage por uma API com autenticação
 * e um banco de dados compartilhado, com controle de concorrência no servidor.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'mimopet_agendamentos_v1';
  const OPEN_MINUTES = 8 * 60;
  const CLOSE_MINUTES = 18 * 60;
  const SLOT_MINUTES = 15;
  const SERVICES = Object.freeze({
    banho: { label: 'Banho relaxante', duration: 60 },
    tosa: { label: 'Tosa especial', duration: 90 },
    'banho-tosa': { label: 'Banho + tosa', duration: 120 },
    hidratacao: { label: 'Hidratação & spa', duration: 45 },
    unhas: { label: 'Corte de unhas', duration: 30 }
  });
  const PET_EMOJIS = { cachorro: '🐶', gato: '🐱', outro: '🐾' };

  const $ = (selector) => document.querySelector(selector);
  const form = $('#appointment-form');
  const formModalElement = $('#appointmentModal');
  const deleteModalElement = $('#deleteModal');
  const formModal = bootstrap.Modal.getOrCreateInstance(formModalElement);
  const deleteModal = bootstrap.Modal.getOrCreateInstance(deleteModalElement);
  const toast = bootstrap.Toast.getOrCreateInstance($('#feedback-toast'), { delay: 3900 });

  let appointments = [];
  let currentFilter = 'todos';
  let pendingDeleteId = null;
  let storageEnabled = true;

  function pad(number) { return String(number).padStart(2, '0'); }
  function dateISO(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  function minutesFromTime(time) {
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
  function timeFromMinutes(minutes) { return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`; }
  function dateTimeOf(appointment) {
    const day = parseDate(appointment.date);
    const minutes = minutesFromTime(appointment.time);
    if (!day || minutes === null) return new Date(0);
    day.setMinutes(minutes);
    return day;
  }
  function isClosedDay(date) { return date.getDay() === 0; }
  function moveDays(baseDate, days) {
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + days);
  }
  function findBusinessDate(offset) {
    let date = moveDays(new Date(), offset);
    while (isClosedDay(date)) date = moveDays(date, 1);
    return date;
  }
  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  function cleanText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  }
  function validAppointment(item) {
    return item && typeof item.id === 'string' && cleanText(item.pet, 50) &&
      cleanText(item.tutor, 70) && PET_EMOJIS[item.type] && SERVICES[item.service] &&
      parseDate(item.date) && minutesFromTime(item.time) !== null;
  }
  function createDemoAppointments() {
    const examples = [
      { pet: 'Amora', tutor: 'Ana Souza', type: 'cachorro', service: 'banho-tosa', phone: '(81) 99999-0001', offset: 1, time: '09:00' },
      { pet: 'Chico', tutor: 'Bruno Lima', type: 'gato', service: 'banho', phone: '', offset: 2, time: '11:00' },
      { pet: 'Luna', tutor: 'Carla Mendes', type: 'cachorro', service: 'hidratacao', phone: '', offset: 3, time: '14:30' }
    ];
    return examples.map(({ offset, ...example }) => ({
      ...example, id: makeId(), date: dateISO(findBusinessDate(offset)), notes: '', sample: true
    }));
  }
  function readStoredAppointments() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) {
        const demo = createDemoAppointments();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
        return demo;
      }
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter(validAppointment) : [];
    } catch (error) {
      storageEnabled = false;
      console.warn('Não foi possível acessar os agendamentos locais:', error);
      return [];
    }
  }
  function saveAppointments() {
    if (!storageEnabled) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
    } catch (error) {
      storageEnabled = false;
      console.warn('Falha ao salvar localmente:', error);
      showToast('O navegador impediu o armazenamento. Os dados serão perdidos ao fechar esta página.', true);
    }
  }
  function findConflict(proposed, skipId = null) {
    const start = minutesFromTime(proposed.time);
    const duration = SERVICES[proposed.service]?.duration;
    if (start === null || !duration) return null;
    const end = start + duration;
    return appointments.find((item) => {
      if (item.id === skipId || item.date !== proposed.date) return false;
      const existingStart = minutesFromTime(item.time);
      const existingService = SERVICES[item.service];
      if (existingStart === null || !existingService) return false;
      const existingEnd = existingStart + existingService.duration;
      return start < existingEnd && existingStart < end;
    }) || null;
  }
  function findNextAvailableSlot(service = 'banho') {
    const duration = SERVICES[service]?.duration || 60;
    const now = new Date();
    for (let offset = 0; offset < 60; offset++) {
      const day = moveDays(now, offset);
      if (isClosedDay(day)) continue;
      let first = OPEN_MINUTES;
      if (offset === 0) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes() + 1;
        first = Math.max(first, Math.ceil(currentMinutes / SLOT_MINUTES) * SLOT_MINUTES);
      }
      for (let minute = first; minute + duration <= CLOSE_MINUTES; minute += SLOT_MINUTES) {
        const candidate = { date: dateISO(day), time: timeFromMinutes(minute), service };
        if (!findConflict(candidate)) return candidate;
      }
    }
    return { date: dateISO(findBusinessDate(1)), time: '09:00', service };
  }
  function formattedDate(isoDate, options = { day: '2-digit', month: 'long' }) {
    const date = parseDate(isoDate);
    return date ? new Intl.DateTimeFormat('pt-BR', options).format(date) : isoDate;
  }
  function humanize(text) {
    return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function showToast(message, error = false) {
    $('#toast-message').textContent = message;
    $('#feedback-toast').classList.toggle('toast-error', error);
    $('#toast-icon').className = error ? 'bi bi-exclamation-triangle-fill' : 'bi bi-check-circle-fill';
    toast.show();
  }
  function showFormError(message) {
    const target = $('#form-error');
    target.textContent = message;
    target.classList.remove('d-none');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function resetFormError() {
    $('#form-error').classList.add('d-none');
    $('#form-error').textContent = '';
    form.classList.remove('was-validated');
  }
  function newElement(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent !== undefined) element.textContent = textContent;
    return element;
  }
  function appendIcon(target, iconClass) {
    const icon = newElement('i', `bi ${iconClass}`);
    icon.setAttribute('aria-hidden', 'true');
    target.append(icon);
  }

  function makeAppointmentElement(item) {
    const article = newElement('article', 'appointment-item');
    const date = parseDate(item.date);
    const calendar = newElement('div', 'appt-date');
    calendar.setAttribute('aria-label', formattedDate(item.date, { day: 'numeric', month: 'long', year: 'numeric' }));
    calendar.append(newElement('span', 'day', String(date.getDate())));
    calendar.append(newElement('span', 'month', formattedDate(item.date, { month: 'short' }).replace('.', '')));

    const body = newElement('div', 'appt-body');
    const header = newElement('div', 'appt-title');
    header.append(newElement('span', 'pet-emoji', PET_EMOJIS[item.type]));
    header.append(newElement('h4', '', item.pet));
    header.append(newElement('span', 'appt-service', SERVICES[item.service].label + (item.sample ? ' · Exemplo' : '')));
    body.append(header);
    const meta = newElement('div', 'appt-meta');
    appendIcon(meta, 'bi-person');
    meta.append(document.createTextNode(item.tutor));
    if (item.phone) {
      meta.append(newElement('span', 'sep', '•'));
      appendIcon(meta, 'bi-telephone');
      meta.append(document.createTextNode(item.phone));
    }
    body.append(meta);
    if (item.notes) {
      const notes = newElement('div', 'appt-meta', `Obs.: ${item.notes}`);
      body.append(notes);
    }

    const time = newElement('span', 'appt-time');
    appendIcon(time, 'bi-clock');
    time.append(document.createTextNode(` ${item.time}`));
    const actions = newElement('div', 'appt-actions');
    const editButton = newElement('button', 'action-button');
    editButton.type = 'button';
    editButton.dataset.action = 'edit';
    editButton.dataset.id = item.id;
    editButton.setAttribute('aria-label', `Editar agendamento de ${item.pet}`);
    editButton.title = 'Editar agendamento';
    appendIcon(editButton, 'bi-pencil-square');
    const removeButton = newElement('button', 'action-button danger');
    removeButton.type = 'button';
    removeButton.dataset.action = 'delete';
    removeButton.dataset.id = item.id;
    removeButton.setAttribute('aria-label', `Excluir agendamento de ${item.pet}`);
    removeButton.title = 'Excluir agendamento';
    appendIcon(removeButton, 'bi-trash3');
    actions.append(editButton, removeButton);
    article.append(calendar, body, time, actions);
    return article;
  }

  function renderSummary() {
    const now = new Date();
    const today = dateISO(now);
    const future = appointments.filter((item) => dateTimeOf(item) >= now);
    $('#stat-today').textContent = appointments.filter((item) => item.date === today).length;
    $('#stat-upcoming').textContent = future.length;
    $('#stat-total').textContent = appointments.length;
    $('#current-date').textContent = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(now);

    const upcoming = [...future].sort((a, b) => dateTimeOf(a) - dateTimeOf(b));
    const next = upcoming[0];
    const container = $('#next-appointment-details');
    container.replaceChildren();
    if (!next) {
      container.append(newElement('div', 'next-empty', 'Assim que houver um novo agendamento, ele aparecerá aqui.'));
      $('#hero-next-title').textContent = 'Confira sua agenda';
      $('#hero-next-time').textContent = 'Todos os cuidados organizados';
      return;
    }
    container.append(newElement('div', 'next-pet', `${PET_EMOJIS[next.type]} ${next.pet}`));
    const details = newElement('div', 'next-detail');
    details.append(newElement('span', '', SERVICES[next.service].label));
    details.append(newElement('span', '', `${formattedDate(next.date, { weekday: 'short', day: '2-digit', month: 'short' })} às ${next.time}`));
    container.append(details);
    $('#hero-next-title').textContent = `${next.pet} · ${SERVICES[next.service].label}`;
    $('#hero-next-time').textContent = `${formattedDate(next.date)} às ${next.time}`;
  }

  function renderList() {
    const today = dateISO(new Date());
    const now = new Date();
    const searched = humanize($('#search-appointments').value.trim());
    const filtered = appointments
      .filter((item) => {
        if (currentFilter === 'hoje' && item.date !== today) return false;
        if (currentFilter === 'proximos' && dateTimeOf(item) < now) return false;
        if (searched && !humanize(`${item.pet} ${item.tutor} ${SERVICES[item.service].label}`).includes(searched)) return false;
        return true;
      })
      .sort((a, b) => dateTimeOf(a) - dateTimeOf(b));

    const list = $('#appointment-list');
    list.replaceChildren(...filtered.map(makeAppointmentElement));
    $('#agenda-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'agendamento encontrado' : 'agendamentos encontrados'}`;
    const emptyState = $('#empty-state');
    emptyState.classList.toggle('d-none', filtered.length > 0);
    if (!filtered.length) {
      if (searched || currentFilter !== 'todos') {
        $('#empty-title').textContent = 'Nenhum horário encontrado';
        $('#empty-description').textContent = 'Experimente outra busca ou selecione o filtro “Todos”.';
      } else {
        $('#empty-title').textContent = 'Sua agenda está prontinha para começar';
        $('#empty-description').textContent = 'Adicione o primeiro agendamento para organizar os cuidados dos seus pets.';
      }
    }
  }
  function render() { renderSummary(); renderList(); }

  function openNewAppointment(service = 'banho') {
    const selectedService = SERVICES[service] ? service : 'banho';
    form.reset();
    resetFormError();
    $('#appointment-id').value = '';
    $('#appointment-service').value = selectedService;
    $('#appointment-date').min = dateISO(new Date());
    const candidate = findNextAvailableSlot(selectedService);
    $('#appointment-date').value = candidate.date;
    $('#appointment-time').value = candidate.time;
    $('#appointmentModalTitle').textContent = 'Novo agendamento 🐾';
    $('#save-appointment').innerHTML = '<i class="bi bi-check2-circle me-2" aria-hidden="true"></i>Salvar agendamento';
    formModal.show();
  }
  function openEditAppointment(id) {
    const item = appointments.find((appointment) => appointment.id === id);
    if (!item) { showToast('Agendamento não encontrado.', true); return; }
    form.reset();
    resetFormError();
    $('#appointment-id').value = item.id;
    $('#pet-name').value = item.pet;
    $('#tutor-name').value = item.tutor;
    $('#pet-type').value = item.type;
    $('#tutor-phone').value = item.phone || '';
    $('#appointment-service').value = item.service;
    $('#appointment-date').min = dateISO(new Date());
    $('#appointment-date').value = item.date;
    $('#appointment-time').value = item.time;
    $('#appointment-notes').value = item.notes || '';
    $('#appointmentModalTitle').textContent = 'Editar agendamento ✏️';
    $('#save-appointment').innerHTML = '<i class="bi bi-check2-circle me-2" aria-hidden="true"></i>Salvar alterações';
    formModal.show();
  }

  function validateBusinessRules(item) {
    const date = parseDate(item.date);
    const start = minutesFromTime(item.time);
    const duration = SERVICES[item.service]?.duration;
    if (!date || start === null || !duration) return 'Informe uma data, um horário e um serviço válidos.';
    if (date < parseDate(dateISO(new Date()))) return 'Não é possível agendar uma data que já passou.';
    if (isClosedDay(date)) return 'A loja não realiza atendimentos aos domingos. Escolha outro dia.';
    if (start % SLOT_MINUTES !== 0) return 'Escolha um horário em intervalos de 15 minutos (ex.: 09:00 ou 09:15).';
    if (start < OPEN_MINUTES || start + duration > CLOSE_MINUTES) {
      return `Este serviço dura ${duration} minutos. Selecione um horário que permita concluí-lo entre 08:00 e 18:00.`;
    }
    if (dateTimeOf(item) < new Date()) return 'Selecione um horário futuro para realizar o agendamento.';
    const conflict = findConflict(item, item.id);
    if (conflict) {
      return `Horário indisponível: ${conflict.pet} já tem um atendimento às ${conflict.time}. Escolha um horário sem sobreposição.`;
    }
    return null;
  }

  function handleSave(event) {
    event.preventDefault();
    resetFormError();
    $('#pet-name').value = $('#pet-name').value.trim();
    $('#tutor-name').value = $('#tutor-name').value.trim();
    form.classList.add('was-validated');
    if (!form.checkValidity()) {
      showFormError('Preencha os campos obrigatórios antes de salvar.');
      return;
    }
    const editingId = $('#appointment-id').value;
    const item = {
      id: editingId || makeId(),
      pet: cleanText($('#pet-name').value, 50),
      tutor: cleanText($('#tutor-name').value, 70),
      type: $('#pet-type').value,
      phone: cleanText($('#tutor-phone').value, 20),
      service: $('#appointment-service').value,
      date: $('#appointment-date').value,
      time: $('#appointment-time').value,
      notes: cleanText($('#appointment-notes').value, 300)
    };
    const error = validateBusinessRules(item);
    if (error) { showFormError(error); return; }
    const index = appointments.findIndex((appointment) => appointment.id === editingId);
    if (index >= 0) appointments[index] = item;
    else appointments.push(item);
    saveAppointments();
    render();
    formModal.hide();
    showToast(storageEnabled
      ? (index >= 0 ? 'Agendamento atualizado com sucesso!' : 'Agendamento criado com sucesso!')
      : 'Agendamento salvo apenas nesta sessão. O armazenamento do navegador está indisponível.', !storageEnabled);
    // Após cadastrar, mostra todos para o compromisso não ficar oculto por um filtro anterior.
    currentFilter = 'todos';
    $('#search-appointments').value = '';
    syncFilterButtons();
    renderList();
  }

  function syncFilterButtons() {
    document.querySelectorAll('[data-filter]').forEach((button) => {
      const isSelected = button.dataset.filter === currentFilter;
      button.classList.toggle('active', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }
  function requestDelete(id) {
    const item = appointments.find((appointment) => appointment.id === id);
    if (!item) { showToast('Agendamento não encontrado.', true); return; }
    pendingDeleteId = id;
    $('#delete-description').textContent = `Excluir o atendimento de ${item.pet} (${formattedDate(item.date)} às ${item.time})? Essa ação não poderá ser desfeita.`;
    deleteModal.show();
  }

  // Ações principais
  document.querySelectorAll('[data-new-appointment]').forEach((button) => {
    button.addEventListener('click', () => openNewAppointment());
  });
  document.querySelectorAll('[data-service]').forEach((button) => {
    button.addEventListener('click', () => openNewAppointment(button.dataset.service));
  });
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter;
      syncFilterButtons();
      renderList();
    });
  });
  $('#search-appointments').addEventListener('input', renderList);
  $('#appointment-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'edit') openEditAppointment(button.dataset.id);
    if (button.dataset.action === 'delete') requestDelete(button.dataset.id);
  });
  $('#confirm-delete').addEventListener('click', () => {
    if (pendingDeleteId) {
      appointments = appointments.filter((appointment) => appointment.id !== pendingDeleteId);
      saveAppointments();
      render();
      showToast(storageEnabled
        ? 'Agendamento removido com sucesso.'
        : 'Agendamento removido nesta sessão. As alterações não serão mantidas ao fechar a página.', !storageEnabled);
    }
    pendingDeleteId = null;
    deleteModal.hide();
  });
  deleteModalElement.addEventListener('hidden.bs.modal', () => { pendingDeleteId = null; });
  formModalElement.addEventListener('hidden.bs.modal', resetFormError);
  $('#appointment-service').addEventListener('change', () => { resetFormError(); });
  form.addEventListener('submit', handleSave);
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      appointments = readStoredAppointments();
      render();
    }
  });

  appointments = readStoredAppointments();
  render();
  // Atualiza o resumo se a página permanecer aberta durante a virada de horário/dia.
  window.setInterval(render, 60_000);
})();
