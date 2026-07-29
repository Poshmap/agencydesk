const clienteId = new URLSearchParams(window.location.search).get('id');

let opzioniServizio = { categorie: [], stati: [] };
let clienteCorrente = null;

function popolaSelect(id, valori, selezionato) {
  const sel = document.getElementById(id);
  sel.innerHTML = valori
    .map((v) => `<option value="${v}" ${v === selezionato ? 'selected' : ''}>${v}</option>`)
    .join('');
}

async function caricaCliente() {
  clienteCorrente = await api.get(`/api/clienti/${clienteId}`);

  document.title = `${clienteCorrente.nome} — AgencyDesk`;
  document.getElementById('nome-cliente').textContent = clienteCorrente.nome;
  document.getElementById('cliente-email-vista').textContent = clienteCorrente.email || '—';
  document.getElementById('cliente-note-vista').textContent = clienteCorrente.note || '—';

  const tbody = document.getElementById('tabella-servizi');
  const msgVuoto = document.getElementById('msg-vuoto-servizi');

  if (clienteCorrente.servizi.length === 0) {
    tbody.innerHTML = '';
    msgVuoto.style.display = 'block';
    return;
  }
  msgVuoto.style.display = 'none';

  tbody.innerHTML = clienteCorrente.servizi
    .map(
      (s) => `
      <tr class="riga-${s.urgenza}">
        <td>${formatData(s.data_scadenza)}</td>
        <td>${escapeHtml(s.nome_servizio)}</td>
        <td>${escapeHtml(s.categoria)}</td>
        <td>${escapeHtml(s.provider) || '—'}</td>
        <td>${formatValuta(s.costo_annuo)}</td>
        <td><span class="pill ${s.urgenza}">${etichettaUrgenza(s)}</span></td>
        <td>
          ${s.stato_rinnovo === 'Attivo' ? `<button class="btn btn-sm btn-primary" data-rinnova="${s.id}">Rinnova</button>` : ''}
          <button class="btn btn-sm" data-modifica-servizio="${s.id}">Modifica</button>
          <button class="btn btn-sm btn-danger" data-elimina-servizio="${s.id}">Elimina</button>
        </td>
      </tr>
    `
    )
    .join('');
}

function apriModaleCliente() {
  document.getElementById('cliente-nome').value = clienteCorrente.nome;
  document.getElementById('cliente-email').value = clienteCorrente.email || '';
  document.getElementById('cliente-note').value = clienteCorrente.note || '';
  document.getElementById('errore-cliente').classList.remove('visibile');
  document.getElementById('overlay-cliente').classList.add('visibile');
}

function chiudiModaleCliente() {
  document.getElementById('overlay-cliente').classList.remove('visibile');
}

function apriModaleServizio(servizio = null) {
  document.getElementById('titolo-modale-servizio').textContent = servizio
    ? 'Modifica servizio'
    : 'Nuovo servizio';
  document.getElementById('servizio-id').value = servizio ? servizio.id : '';
  document.getElementById('servizio-nome').value = servizio ? servizio.nome_servizio : '';
  document.getElementById('servizio-provider').value = servizio ? servizio.provider || '' : '';
  document.getElementById('servizio-data-inizio').value = servizio ? servizio.data_inizio || '' : '';
  document.getElementById('servizio-data-scadenza').value = servizio ? servizio.data_scadenza : '';
  document.getElementById('servizio-costo').value = servizio ? servizio.costo_annuo || '' : '';
  document.getElementById('servizio-note').value = servizio ? servizio.note || '' : '';
  document.getElementById('servizio-annullato').checked = servizio
    ? servizio.stato_rinnovo === 'Annullato'
    : false;

  popolaSelect('servizio-categoria', opzioniServizio.categorie, servizio ? servizio.categoria : null);

  document.getElementById('errore-servizio').classList.remove('visibile');
  document.getElementById('overlay-servizio').classList.add('visibile');
}

function chiudiModaleServizio() {
  document.getElementById('overlay-servizio').classList.remove('visibile');
}

document.addEventListener('DOMContentLoaded', async () => {
  await initNav();
  initRicercaGlobale();

  opzioniServizio = await api.get('/api/servizi/meta/opzioni');

  await caricaCliente();

  document.getElementById('btn-modifica-cliente').addEventListener('click', apriModaleCliente);
  document.getElementById('chiudi-modale-cliente').addEventListener('click', chiudiModaleCliente);
  document.getElementById('annulla-cliente').addEventListener('click', chiudiModaleCliente);

  document.getElementById('form-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nome: document.getElementById('cliente-nome').value,
      email: document.getElementById('cliente-email').value,
      note: document.getElementById('cliente-note').value
    };
    try {
      await api.put(`/api/clienti/${clienteId}`, payload);
      chiudiModaleCliente();
      caricaCliente();
    } catch (err) {
      const box = document.getElementById('errore-cliente');
      box.textContent = err.message;
      box.classList.add('visibile');
    }
  });

  document.getElementById('btn-nuovo-servizio').addEventListener('click', () => apriModaleServizio());
  document.getElementById('chiudi-modale-servizio').addEventListener('click', chiudiModaleServizio);
  document.getElementById('annulla-servizio').addEventListener('click', chiudiModaleServizio);

  document.getElementById('tabella-servizi').addEventListener('click', async (e) => {
    const idModifica = e.target.getAttribute('data-modifica-servizio');
    const idElimina = e.target.getAttribute('data-elimina-servizio');
    const idRinnova = e.target.getAttribute('data-rinnova');

    if (idModifica) {
      const servizio = clienteCorrente.servizi.find((s) => String(s.id) === idModifica);
      apriModaleServizio(servizio);
    }

    if (idElimina) {
      if (!confirm('Eliminare questo servizio?')) return;
      await api.del(`/api/servizi/${idElimina}`);
      caricaCliente();
    }

    if (idRinnova) {
      const servizio = clienteCorrente.servizi.find((s) => String(s.id) === idRinnova);
      const nuovaData = new Date(servizio.data_scadenza);
      nuovaData.setFullYear(nuovaData.getFullYear() + 1);
      const conferma = confirm(
        `Rinnovare "${servizio.nome_servizio}"?\nNuova scadenza: ${formatData(nuovaData.toISOString().slice(0, 10))}`
      );
      if (!conferma) return;
      await api.post(`/api/servizi/${idRinnova}/rinnova`, {});
      caricaCliente();
    }
  });

  document.getElementById('form-servizio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('servizio-id').value;
    const annullato = document.getElementById('servizio-annullato').checked;
    const payload = {
      cliente_id: Number(clienteId),
      nome_servizio: document.getElementById('servizio-nome').value,
      categoria: document.getElementById('servizio-categoria').value,
      provider: document.getElementById('servizio-provider').value,
      data_inizio: document.getElementById('servizio-data-inizio').value || null,
      data_scadenza: document.getElementById('servizio-data-scadenza').value,
      costo_annuo: document.getElementById('servizio-costo').value || null,
      stato_rinnovo: annullato ? 'Annullato' : 'Attivo',
      note: document.getElementById('servizio-note').value
    };

    try {
      if (id) {
        await api.put(`/api/servizi/${id}`, payload);
      } else {
        await api.post('/api/servizi', payload);
      }
      chiudiModaleServizio();
      caricaCliente();
    } catch (err) {
      const box = document.getElementById('errore-servizio');
      box.textContent = err.message;
      box.classList.add('visibile');
    }
  });
});
