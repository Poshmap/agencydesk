async function caricaImpostazioni() {
  try {
    const { alertEmailTo, mailerConfigured, cronConfigured } = await api.get('/api/impostazioni');

    document.getElementById('alert-email').value = alertEmailTo || '';

    const statoSmtp = document.getElementById('stato-smtp');
    const partiStato = [];
    partiStato.push(
      mailerConfigured
        ? '✓ Configurazione invio email (Resend) presente'
        : '✗ Configurazione invio email (Resend) mancante o incompleta — le email non verranno inviate'
    );
    partiStato.push(
      cronConfigured
        ? '✓ CRON_SECRET impostato, l\'endpoint di controllo scadenze è protetto'
        : '✗ CRON_SECRET non impostato — l\'endpoint /api/internal/check-alerts è disabilitato'
    );
    statoSmtp.innerHTML = partiStato.join('<br>');

    await Promise.all([caricaStorico(), caricaAccessi()]);
  } catch (err) {
    document.getElementById('contenuto-impostazioni').style.display = 'none';
    document.getElementById('msg-non-admin').style.display = 'block';
  }
}

async function caricaStorico() {
  const righe = await api.get('/api/impostazioni/storico');
  const tbody = document.getElementById('tabella-storico');
  const msgVuoto = document.getElementById('msg-vuoto-storico');

  if (righe.length === 0) {
    tbody.innerHTML = '';
    msgVuoto.style.display = 'block';
    return;
  }
  msgVuoto.style.display = 'none';

  tbody.innerHTML = righe
    .map(
      (r) => `
    <tr>
      <td>${formatData(r.data_invio)}</td>
      <td>${escapeHtml(r.cliente_nome)}</td>
      <td>${escapeHtml(r.nome_servizio)}</td>
      <td>${escapeHtml(r.categoria)}</td>
      <td>${formatData(r.data_scadenza)}</td>
    </tr>
  `
    )
    .join('');
}

async function caricaAccessi() {
  const righe = await api.get('/api/impostazioni/accessi');
  const tbody = document.getElementById('tabella-accessi');
  const msgVuoto = document.getElementById('msg-vuoto-accessi');

  if (righe.length === 0) {
    tbody.innerHTML = '';
    msgVuoto.style.display = 'block';
    return;
  }
  msgVuoto.style.display = 'none';

  tbody.innerHTML = righe
    .map((r) => {
      const classe = r.esito === 'successo' ? 'ok' : 'urgente';
      return `
    <tr>
      <td>${escapeHtml(r.created_at)}</td>
      <td>${escapeHtml(r.username)}</td>
      <td>${escapeHtml(r.ip) || '—'}</td>
      <td><span class="pill ${classe}">${r.esito === 'successo' ? 'Successo' : 'Fallito'}</span></td>
    </tr>
  `;
    })
    .join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  await initNav();
  await caricaImpostazioni();

  document.getElementById('form-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errore = document.getElementById('errore-email');
    const successo = document.getElementById('successo-email');
    errore.classList.remove('visibile');
    successo.classList.remove('visibile');

    try {
      await api.put('/api/impostazioni', {
        alert_email_to: document.getElementById('alert-email').value
      });
      successo.textContent = 'Salvato';
      successo.classList.add('visibile');
    } catch (err) {
      errore.textContent = err.message;
      errore.classList.add('visibile');
    }
  });

  document.getElementById('btn-test-email').addEventListener('click', async () => {
    const errore = document.getElementById('errore-email');
    const successo = document.getElementById('successo-email');
    errore.classList.remove('visibile');
    successo.classList.remove('visibile');

    const btn = document.getElementById('btn-test-email');
    btn.disabled = true;
    btn.textContent = 'Invio in corso…';

    try {
      const { destinatario } = await api.post('/api/impostazioni/test-email', {});
      successo.textContent = `Email di test inviata a ${destinatario}`;
      successo.classList.add('visibile');
    } catch (err) {
      errore.textContent = err.message;
      errore.classList.add('visibile');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Invia email di test';
    }
  });
});
