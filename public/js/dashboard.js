const ETICHETTE_URGENZA = {
  scaduto: 'Scaduto',
  entro30: 'Entro 30gg',
  entro60: 'Entro 60gg',
  ok: 'OK',
  annullato: 'Annullato'
};

let clientiCache = [];

async function caricaFiltri() {
  const [{ categorie, stati }, clienti] = await Promise.all([
    api.get('/api/servizi/meta/opzioni'),
    api.get('/api/clienti')
  ]);

  clientiCache = clienti;

  const selCliente = document.getElementById('f-cliente');
  clienti.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    selCliente.appendChild(opt);
  });

  const selCategoria = document.getElementById('f-categoria');
  categorie.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selCategoria.appendChild(opt);
  });

  const selStato = document.getElementById('f-stato');
  stati.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    selStato.appendChild(opt);
  });
}

function leggiFiltri() {
  const params = new URLSearchParams();
  const cliente = document.getElementById('f-cliente').value;
  const categoria = document.getElementById('f-categoria').value;
  const stato = document.getElementById('f-stato').value;

  if (cliente) params.set('cliente_id', cliente);
  if (categoria) params.set('categoria', categoria);
  if (stato) params.set('stato', stato);

  return params;
}

async function caricaContatori() {
  const stats = await api.get('/api/servizi/meta/stats');
  document.getElementById('c-totale').textContent = stats.totale;
  document.getElementById('c-scaduti').textContent = stats.scaduti;
  document.getElementById('c-scadenza').textContent = stats.in_scadenza_30;
  document.getElementById('c-ok').textContent = stats.ok;
}

async function caricaServizi() {
  const params = leggiFiltri();
  const servizi = await api.get(`/api/servizi?${params.toString()}`);

  const tbody = document.getElementById('tabella-servizi');
  const msgVuoto = document.getElementById('msg-vuoto');

  if (servizi.length === 0) {
    tbody.innerHTML = '';
    msgVuoto.style.display = 'block';
    return;
  }
  msgVuoto.style.display = 'none';

  tbody.innerHTML = servizi
    .map(
      (s) => `
    <tr class="riga-${s.urgenza}">
      <td>${formatData(s.data_scadenza)}</td>
      <td><a class="link-cliente" href="/cliente.html?id=${s.cliente_id}">${escapeHtml(s.cliente_nome)}</a></td>
      <td>${escapeHtml(s.nome_servizio)}</td>
      <td>${escapeHtml(s.categoria)}</td>
      <td>${escapeHtml(s.provider) || '—'}</td>
      <td>${formatValuta(s.costo_annuo)}</td>
      <td>
        <span class="pill ${s.urgenza}">${ETICHETTE_URGENZA[s.urgenza]}</span>
        <div class="badge-stato" style="margin-top:4px">${escapeHtml(s.stato_rinnovo)}</div>
      </td>
    </tr>
  `
    )
    .join('');
}

function aggiornaLinkExport() {
  const params = leggiFiltri();
  document.getElementById('btn-export').href = `/api/export/servizi.csv?${params.toString()}`;
}

async function ricarica() {
  await Promise.all([caricaContatori(), caricaServizi()]);
  aggiornaLinkExport();
}

document.addEventListener('DOMContentLoaded', async () => {
  await initNav();
  initRicercaGlobale();
  await caricaFiltri();
  await ricarica();

  ['f-cliente', 'f-categoria', 'f-stato'].forEach((id) => {
    document.getElementById(id).addEventListener('change', ricarica);
  });

  document.getElementById('btn-reset-filtri').addEventListener('click', () => {
    document.getElementById('f-cliente').value = '';
    document.getElementById('f-categoria').value = '';
    document.getElementById('f-stato').value = '';
    ricarica();
  });
});
