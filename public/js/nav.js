async function initNav() {
  try {
    const { user } = await api.get('/api/session');

    document.getElementById('nav-username').textContent = user.username;
    document.getElementById('nav-ruolo').textContent =
      user.role === 'admin' ? 'Admin' : 'Operatore';

    if (user.role !== 'admin') {
      const linkUtenti = document.getElementById('nav-link-utenti');
      if (linkUtenti) linkUtenti.remove();
      const linkImpostazioni = document.getElementById('nav-link-impostazioni');
      if (linkImpostazioni) linkImpostazioni.remove();
      const linkStatistiche = document.getElementById('nav-link-statistiche');
      if (linkStatistiche) linkStatistiche.remove();
    }

    return user;
  } catch (e) {
    window.location.href = '/dev-console';
    return null;
  }
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btn-logout') {
    api.post('/api/logout', {}).finally(() => {
      window.location.href = '/dev-console';
    });
  }
});

function initRicercaGlobale() {
  const input = document.getElementById('ricerca-globale');
  const risultatiBox = document.getElementById('risultati-ricerca');
  if (!input || !risultatiBox) return;

  let timeoutId = null;

  input.addEventListener('input', () => {
    clearTimeout(timeoutId);
    const q = input.value.trim();

    if (!q) {
      risultatiBox.classList.remove('visibile');
      risultatiBox.innerHTML = '';
      return;
    }

    timeoutId = setTimeout(async () => {
      const { clienti, servizi } = await api.get(`/api/search?q=${encodeURIComponent(q)}`);
      renderRisultatiRicerca(risultatiBox, clienti, servizi);
    }, 250);
  });

  document.addEventListener('click', (e) => {
    if (!risultatiBox.contains(e.target) && e.target !== input) {
      risultatiBox.classList.remove('visibile');
    }
  });
}

function renderRisultatiRicerca(box, clienti, servizi) {
  if (clienti.length === 0 && servizi.length === 0) {
    box.innerHTML = '<div class="msg-vuoto">Nessun risultato</div>';
    box.classList.add('visibile');
    return;
  }

  let html = '';

  if (clienti.length) {
    html += '<div class="gruppo-titolo">Clienti</div>';
    html += clienti
      .map((c) => `<a href="/cliente.html?id=${c.id}">${escapeHtml(c.nome)}</a>`)
      .join('');
  }

  if (servizi.length) {
    html += '<div class="gruppo-titolo">Servizi</div>';
    html += servizi
      .map(
        (s) =>
          `<a href="/cliente.html?id=${s.cliente_id}">${escapeHtml(s.nome_servizio)} — <span class="testo-muted">${escapeHtml(s.cliente_nome)}</span></a>`
      )
      .join('');
  }

  box.innerHTML = html;
  box.classList.add('visibile');
}
