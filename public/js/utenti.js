let utenteLoggato = null;

async function caricaUtenti() {
  try {
    const utenti = await api.get('/api/utenti');
    document.getElementById('tabella-utenti').innerHTML = utenti
      .map(
        (u) => `
      <tr>
        <td>${escapeHtml(u.username)}</td>
        <td><span class="badge-ruolo">${u.role === 'admin' ? 'Admin' : 'Operatore'}</span></td>
        <td>${escapeHtml(u.created_at)}</td>
        <td>
          <button class="btn btn-sm" data-modifica="${u.id}" data-username="${escapeHtml(u.username)}" data-ruolo="${u.role}">Modifica</button>
          <button class="btn btn-sm btn-danger" data-elimina="${u.id}" ${u.id === utenteLoggato.id ? 'disabled' : ''}>Elimina</button>
        </td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    document.getElementById('card-utenti').style.display = 'none';
    document.getElementById('btn-nuovo-utente').style.display = 'none';
    document.getElementById('msg-non-admin').style.display = 'block';
  }
}

function apriModaleUtente(utente = null) {
  document.getElementById('titolo-modale-utente').textContent = utente
    ? 'Modifica operatore'
    : 'Nuovo operatore';
  document.getElementById('utente-id').value = utente ? utente.id : '';
  document.getElementById('utente-username').value = utente ? utente.username : '';
  document.getElementById('utente-username').disabled = !!utente;
  document.getElementById('utente-password').value = '';
  document.getElementById('utente-ruolo').value = utente ? utente.role : 'operatore';
  document.getElementById('hint-password').textContent = utente
    ? '(lascia vuoto per non modificarla)'
    : '';
  document.getElementById('utente-password').required = !utente;
  document.getElementById('errore-utente').classList.remove('visibile');
  document.getElementById('overlay-utente').classList.add('visibile');
}

function chiudiModaleUtente() {
  document.getElementById('overlay-utente').classList.remove('visibile');
}

document.addEventListener('DOMContentLoaded', async () => {
  utenteLoggato = await initNav();
  if (!utenteLoggato) return;

  await caricaUtenti();

  document.getElementById('btn-nuovo-utente').addEventListener('click', () => apriModaleUtente());
  document.getElementById('chiudi-modale-utente').addEventListener('click', chiudiModaleUtente);
  document.getElementById('annulla-utente').addEventListener('click', chiudiModaleUtente);

  document.getElementById('tabella-utenti').addEventListener('click', async (e) => {
    const idModifica = e.target.getAttribute('data-modifica');
    const idElimina = e.target.getAttribute('data-elimina');

    if (idModifica) {
      apriModaleUtente({
        id: idModifica,
        username: e.target.getAttribute('data-username'),
        role: e.target.getAttribute('data-ruolo')
      });
    }

    if (idElimina) {
      if (!confirm('Eliminare questo operatore?')) return;
      try {
        await api.del(`/api/utenti/${idElimina}`);
        caricaUtenti();
      } catch (err) {
        alert(err.message);
      }
    }
  });

  document.getElementById('form-utente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('utente-id').value;
    const password = document.getElementById('utente-password').value;
    const ruolo = document.getElementById('utente-ruolo').value;

    try {
      if (id) {
        const payload = { role: ruolo };
        if (password) payload.password = password;
        await api.put(`/api/utenti/${id}`, payload);
      } else {
        const payload = {
          username: document.getElementById('utente-username').value,
          password,
          role: ruolo
        };
        await api.post('/api/utenti', payload);
      }
      chiudiModaleUtente();
      caricaUtenti();
    } catch (err) {
      const box = document.getElementById('errore-utente');
      box.textContent = err.message;
      box.classList.add('visibile');
    }
  });
});
