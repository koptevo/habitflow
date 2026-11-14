/* Мне Букет — демо-лендинг: интерактив */
(function () {
  'use strict';

  /* ---------- Sticky header ---------- */
  var header = document.getElementById('header');
  var onScroll = function () {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile nav ---------- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  var closeNav = function () {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') closeNav();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) closeNav();
  });

  /* ---------- Reveal on scroll ---------- */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = Array.prototype.slice.call(el.parentNode.children);
        var i = Math.max(0, siblings.indexOf(el) % 3);
        el.style.transitionDelay = (i * 80) + 'ms';
        el.classList.add('is-visible');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Catalog -> form ---------- */
  var select = document.getElementById('f-bouquet');
  var form = document.getElementById('orderForm');
  var nameInput = document.getElementById('f-name');

  document.querySelectorAll('.js-order').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('[data-bouquet]');
      var value = card ? card.getAttribute('data-bouquet') : 'Пока не знаю — подскажите';
      if (select) {
        var matched = false;
        Array.prototype.forEach.call(select.options, function (opt) {
          if (opt.text.trim() === value) { select.value = opt.value || opt.text; matched = true; }
        });
        if (!matched) select.value = 'Пока не знаю — подскажите';
      }
      document.getElementById('order').scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(function () { if (nameInput) nameInput.focus({ preventScroll: true }); }, 650);
    });
  });

  /* ---------- Phone formatting ---------- */
  var phone = document.getElementById('f-phone');
  if (phone) {
    phone.addEventListener('input', function () {
      var digits = phone.value.replace(/\D/g, '');
      if (digits[0] === '8') digits = '7' + digits.slice(1);
      if (digits[0] !== '7' && digits.length) digits = '7' + digits;
      digits = digits.slice(0, 11);

      var out = '';
      if (digits.length) out = '+7';
      if (digits.length > 1) out += ' ' + digits.slice(1, 4);
      if (digits.length > 4) out += ' ' + digits.slice(4, 7);
      if (digits.length > 7) out += '-' + digits.slice(7, 9);
      if (digits.length > 9) out += '-' + digits.slice(9, 11);
      phone.value = out;
    });
  }

  /* ---------- Form validation + demo submit ---------- */
  var fields = {
    name: document.getElementById('f-name'),
    phone: document.getElementById('f-phone')
  };

  function setInvalid(input, invalid) {
    var field = input.closest('.field');
    if (field) field.classList.toggle('is-invalid', invalid);
  }

  Object.keys(fields).forEach(function (key) {
    var input = fields[key];
    if (!input) return;
    input.addEventListener('input', function () { setInvalid(input, false); });
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nameOk = fields.name.value.trim().length >= 2;
      var digits = fields.phone.value.replace(/\D/g, '');
      var phoneOk = digits.length === 11;

      setInvalid(fields.name, !nameOk);
      setInvalid(fields.phone, !phoneOk);

      if (!nameOk) { fields.name.focus(); return; }
      if (!phoneOk) { fields.phone.focus(); return; }

      form.classList.add('is-sent');
    });
  }

  /* ---------- Year in footer stays current ---------- */
  var legal = document.querySelector('.footer__legal');
  if (legal) {
    legal.innerHTML = legal.innerHTML.replace('2026', String(new Date().getFullYear()));
  }
})();

// ---------- Habit Tracker ----------
(function () {
  'use strict';

  // Данные привычек (в реальном приложении хранятся в localStorage)
  var habits = JSON.parse(localStorage.getItem('habits')) || [];
  var today = new Date();
  var currentYear = today.getFullYear();
  var currentMonth = today.getMonth();

  // Элементы DOM
  var habitHabits = document.getElementById('habit-habits');
  var habitAddBtn = document.getElementById('habit-add-btn');
  var habitModal = document.getElementById('habit-modal');
  var habitModalClose = document.getElementById('habit-modal-close');
  var habitForm = document.getElementById('habit-form');
  var habitName = document.getElementById('habit-name');
  var habitPeriod = document.getElementById('habit-period');
  var habitGoal = document.getElementById('habit-goal');
  var habitCurrentStreak = document.getElementById('habit-current-streak');
  var habitTotalDays = document.getElementById('habit-total-days');
  var habitPercent = document.getElementById('habit-percent');

  // Сохраняем привычки в localStorage
  function saveHabits() {
    localStorage.setItem('habits', JSON.stringify(habits));
  }

  // Расчет текущего суток для месяца
  function getDaysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
  }

  // Получаем даты для отображения календаря
  function getCalendarDays(month, year) {
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = getDaysInMonth(month, year);
    var days = [];
    // Дни предыдущего месяца
    for (var i = firstDay; i > 0; i--) {
      days.unshift({ day: 0, date: new Date(year, month - 1, daysInMonth - i + 1).getDate(), completed: false });
    }
    // Дни текущего месяца
    for (var i = 1; i <= daysInMonth; i++) {
      var date = new Date(year, month, i);
      var dayOfWeek = date.getDay();
      var isToday = (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate());
      days.push({ day: i, date: i, completed: false, today: isToday, dayOfWeek: dayOfWeek });
    }
    // Дни следующего месяца
    var totalCells = 42; // 6 недель
    var remaining = totalCells - days.length;
    for (var i = 1; i <= remaining; i++) {
      days.push({ day: 0, date: i, completed: false });
    }
    return days;
  }

  // Расчет streak (серий)
  function calculateStreak() {
    if (habits.length === 0) return 0;

    // Сортируем даты по убыванию
    var allDates = [];
    habits.forEach(function (habit) {
      if (habit.completionDates && habit.completionDates.length > 0) {
        habit.completionDates.forEach(function (dateStr) {
          allDates.push(new Date(dateStr));
        });
      }
    });

    if (allDates.length === 0) return 0;

    allDates.sort(function (a, b) { return b - a; });

    var streak = 0;
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Проверяем, была ли сегодняшняя дата завершена
    var todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    var todayCompleted = allDates.some(function (d) {
      return d >= todayStart && d < new Date(todayStart.getTime() + 86400000);
    });

    var lastDate = new Date(allDates[0]);
    lastDate.setHours(0, 0, 0, 0);

    if (!todayCompleted && lastDate.getTime() < todayStart.getTime()) {
      // Серия прервалась, начинаем с вчерашнего дня
      if (lastDate.getTime() === yesterday.getTime()) {
        streak = 1;
      } else {
        return 0;
      }
    } else {
      streak = 1;
    }

    for (var i = 1; i < allDates.length; i++) {
      var current = new Date(allDates[i]);
      current.setHours(0, 0, 0, 0);
      var prev = new Date(allDates[i - 1]);
      prev.setHours(0, 0, 0, 0);

      var diffDays = Math.floor((prev - current) / 86400000);

      if (diffDays === 1) {
        streak++;
      } else if (diffDays > 1) {
        break;
      }
      // если diffDays === 0 - повторная дата, не считаем за срыв
    }

    return streak;
  }

  // Обновление статистики
  function updateStats() {
    var totalCompleted = 0;
    var totalPossible = 0;

    habits.forEach(function (habit) {
      var daysInPeriod = 0;
      var completed = 0;

      if (habit.period === 'daily') {
        daysInPeriod = getDaysInMonth(currentMonth, currentYear);
        completed = habit.completionDates ? habit.completionDates.filter(function (d) {
          var date = new Date(d);
          return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
        }).length : 0;
      } else if (habit.period === 'weekly') {
        // Для недели считаем с начала текущей недели
        var weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        var weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        daysInPeriod = 7;

        if (habit.completionDates) {
          habit.completionDates.forEach(function (d) {
            var date = new Date(d);
            if (date >= weekStart && date <= weekEnd) completed++;
          });
        }
      } else if (habit.period === 'monthly') {
        daysInPeriod = 1; // один день месяца, который задала цель
        if (habit.goal) completed = habit.completionDates ? habit.completionDates.length : 0;
      }

      totalPossible += daysInPeriod;
      totalCompleted += completed;
    });

    var percent = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
    var streak = calculateStreak();

    habitCurrentStreak.textContent = streak;
    habitTotalDays.textContent = totalCompleted;
    habitPercent.textContent = percent + '%';
  }

  // Рендерим привычки
  function renderHabits() {
    if (habits.length === 0) {
      habitHabits.innerHTML = '<div class="habit-state__empty"><p>Начните с добавления первой привычки</p></div>';
      updateStats();
      return;
    }

    var html = '';
    habits.forEach(function (habit, index) {
      var daysInPeriod = habit.period === 'daily' ? getDaysInMonth(currentMonth, currentYear) : 
                         habit.period === 'weekly' ? 7 : 1;
      var completionCount = habit.completionDates ? habit.completionDates.length : 0;
      var progress = daysInPeriod > 0 ? Math.round((completionCount / daysInPeriod) * 100) : 0;

      // Получаем календарные ячейки для этого месяца
      var calendarDays = getCalendarDays(currentMonth, currentYear);
      var completedDaysSet = new Set(habit.completionDates || []);

      var calendarHtml = '';
      calendarDays.forEach(function (cell) {
        if (cell.day === 0) {
          calendarHtml += '<div class="habit__cell"></div>';
          return;
        }
        var isCompleted = completedDaysSet.has(cell.date.toString());
        var cellClass = 'habit__cell' + (isCompleted ? ' completed' : '');
        cellClass += (cell.today && isCompleted ? ' today current' : '');
        if (cell.today && !isCompleted) cellClass += ' today';
        calendarHtml += '<div class="' + cellClass + '">' + cell.day + '</div>';
      });

      html += '<div class="habit">' +
        '<div class="habit__header">' +
          '<div>' +
            '<span class="habit__name">' + (habit.name || 'Без названия') + '</span>' +
            '<span class="habit__period">' + (habit.period || 'daily') + '</span>' +
          '</div>' +
          '<div class="habit__stats">' +
            '<div class="habit__stat"><span class="habit__stat-value">' + completionCount + '</span><span class="habit__stat-label"> completions</span></div>' +
            '<div class="habit__stat"><span class="habit__stat-value">' + progress + '%</span><span class="habit__stat-label"> прогресс</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="habit__calendar">' + calendarHtml + '</div>' +
        '<div class="habit__footer">' +
          '<a href="#" class="habit__edit" data-index="' + index + '">Редактировать</a>' +
          '<a href="#" class="habit__delete" data-index="' + index + '">Удалить</a>' +
        '</div>' +
      '</div>';
    });

    habitHabits.innerHTML = html;

    // Добавляем обработчики событий для удаления и редактирования
    document.querySelectorAll('.habit__delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var index = parseInt(this.getAttribute('data-index'));
        deleteHabit(index);
      });
    });

    document.querySelectorAll('.habit__edit').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var index = parseInt(this.getAttribute('data-index'));
        editHabit(index);
      });
    });
  }

  // Добавить новую привычку
  function addHabit(name, period, goal) {
    habits.push({
      name: name || 'Новая привычка',
      period: period || 'daily',
      goal: goal || '',
      completionDates: []
    });
    saveHabits();
    renderHabits();
    updateStats();
    habitName.value = '';
  }

  // Удалить привычку
  function deleteHabit(index) {
    habits.splice(index, 1);
    saveHabits();
    renderHabits();
    updateStats();
  }

  // Редактировать привычку
  function editHabit(index) {
    var habit = habits[index];
    if (!habit) return;

    habitName.value = habit.name;
    habitPeriod.value = habit.period;
    habitGoal.value = habit.goal || '';

    // Показываем модальное окно с данными для редактирования
    habitModal.style.display = 'flex';
    habitModal.setAttribute('aria-hidden', 'false');

    // Переопределяем сабмит формы
    var originalSubmit = habitForm.submit;
    habitForm.submit = function (e) {
      e.preventDefault();
      var name = habitName.value;
      var period = habitPeriod.value;
      var goal = habitGoal.value;

      // Обновляем привычку
      habits[index].name = name;
      habits[index].period = period;
      habits[index].goal = goal;
      saveHabits();
      renderHabits();
      updateStats();

      // Закрываем модальное
      closeHabitModal();
    };
  }

  // Закрыть модальное
  function closeHabitModal() {
    habitModal.style.display = 'none';
    habitModal.setAttribute('aria-hidden', 'true');
    // Восстанавливаем оригинальный сабмит
    habitForm.removeAttribute('data-editing-index');
    habitForm.onsubmit = function (e) {
      e.preventDefault();
      var name = habitName.value;
      var period = habitPeriod.value;
      var goal = habitGoal.value;
      addHabit(name, period, goal);
    };
  }

  // Обработчики событий

  // Открыть модальное для добавления
  habitAddBtn.addEventListener('click', function () {
    habitName.value = '';
    habitPeriod.value = 'daily';
    habitGoal.value = '';
    habitModal.style.display = 'flex';
    habitModal.setAttribute('aria-hidden', 'false');
    // Заменяем сабмит формы
    var originalSubmit = habitForm.onsubmit;
    habitForm.onsubmit = function (e) {
      e.preventDefault();
      var name = habitName.value;
      var period = habitPeriod.value;
      var goal = habitGoal.value;
      addHabit(name, period, goal);
      closeHabitModal();
    };
  });

  // Закрыть модальное по крестику
  habitModalClose.addEventListener('click', closeHabitModal);

  // Закрыть при клике вне модального
  habitModal.addEventListener('click', function (e) {
    if (e.target === habitModal) {
      closeHabitModal();
    }
  });

  // Отправка формы добавления/редактирования
  habitForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = habitName.value;
    var period = habitPeriod.value;
    var goal = habitGoal.value;
    addHabit(name, period, goal);
    closeHabitModal();
  });

  // Отметка дня как выполненного (при клике на ячейку календаря)
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('habit__cell') && !e.target.classList.contains('completed') && !e.target.classList.contains('today')) {
      var cell = e.target;
      var habitEl = cell.closest('.habit');
      var index = parseInt(habitEl.getAttribute('data-index') || '0');

      // Находим дату для этой ячейки
      var cellText = cell.textContent.trim;
      if (cellText && cellText !== '0') {
        var day = parseInt(cellText);
        var dateStr = currentYear + '-' + String(currentMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');

        if (!habits[index].completionDates) {
          habits[index].completionDates = [];
        }

        // Переключаем статус
        var dateIdx = habits[index].completionDates.indexOf(dateStr);
        if (dateIdx === -1) {
          habits[index].completionDates.push(dateStr);
        } else {
          habits[index].completionDates.splice(dateIdx, 1);
        }

        saveHabits();
        renderHabits();
        updateStats();
      }
    }
  });

  // Инициализация
  renderHabits();
  updateStats();
})();
