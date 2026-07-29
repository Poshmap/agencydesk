async function caricaClienti() {
  const clienti = await api.get('/api/clienti');
  const tbody = document.getElementById('tabella-clienti');
  const msgVuoto = document.getElementById('msg-vuoto');

  if (clienti.length === 0) {
    tbody.innerHTML = '';
    msgVuoto.style.display = 'block';
    return;
  }
  msgVuoto.style.display = 'none';

  const dettagli = await Promise.all(clienti.map((c) => api.get(`/api/clienti/${c.id}`)));

  tbody.innerHTML = dettagli
    .map(
      (c) => `
    <tr>
      <td><a class="link-cliente" href="/cliente.html?id=${c.id}">${escapeHtml(c.nome)}</a></td>
      <td>${escapeHtml(c.email) || '—'}</td>
      <td>${c.servizi.length}</td>
      <td>
        <button class="btn btn-sm" data-modifica="${c.id}">Modifica</button>
        <button class="btn btn-sm btn-danger" data-elimina="${c.id}">Elimina</button>
      </td>
    </tr>
  `
    )
    .join('');
}

function apriModaleCliente(cliente = null) {
  document.getElementById('titolo-modale-cliente').textContent = cliente
    ? 'Modifica cliente'
    : 'Nuovo cliente';
  document.getElementById('cliente-id').value = cliente ? cliente.id : '';
  document.getElementById('cliente-nome').value = cliente ? cliente.nome : '';
  document.getElementById('cliente-email').value = cliente ? cliente.email || '' : '';
  document.getElementById('cliente-note').value = cliente ? cliente.note || '' : '';
  document.getElementById('errore-cliente').classList.remove('visibile');
  document.getElementById('overlay-cliente').classList.add('visibile');
}

function chiudiModaleCliente() {
  document.getElementById('overlay-cliente').classList.remove('visibile');
}

document.addEventListener('DOMContentLoaded', async () => {
  await initNav();
  initRicercaGlobale();
  await caricaClienti();

  document.getElementById('btn-nuovo-cliente').addEventListener('click', () => apriModaleCliente());
  document.getElementById('chiudi-modale-cliente').addEventListener('click', chiudiModaleCliente);
  document.getElementById('annulla-cliente').addEventListener('click', chiudiModaleCliente);

  document.getElementById('tabella-clienti').addEventListener('click', async (e) => {
    const idModifica = e.target.getAttribute('data-modifica');
    const idElimina = e.target.getAttribute('data-elimina');

    if (idModifica) {
      const cliente = await api.get(`/api/clienti/${idModifica}`);
      apriModaleCliente(cliente);
    }

    if (idElimina) {
      if (!confirm('Eliminare questo cliente e tutti i suoi servizi?')) return;
      await api.del(`/api/clienti/${idElimina}`);
      caricaClienti();
    }
  });

  document.getElementById('form-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cliente-id').value;
    const payload = {
      nome: document.getElementById('cliente-nome').value,
      email: document.getElementById('cliente-email').value,
      note: document.getElementById('cliente-note').value
    };

    try {
      if (id) {
        await api.put(`/api/clienti/${id}`, payload);
      } else {
        await api.post('/api/clienti', payload);
      }
      chiudiModaleCliente();
      caricaClienti();
    } catch (err) {
      const box = document.getElementById('errore-cliente');
      box.textContent = err.message;
      box.classList.add('visibile');
    }
  });
});
