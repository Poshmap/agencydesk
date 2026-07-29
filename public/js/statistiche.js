async function caricaAnni() {
  const { anni } = await api.get('/api/servizi/meta/opzioni');
  const sel = document.getElementById('f-anno');
  anni.forEach((anno) => {
    const opt = document.createElement('option');
    opt.value = anno;
    opt.textContent = anno;
    sel.appendChild(opt);
  });
}

function formatValutaIntera(valore) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(valore || 0);
}

async function caricaStatistiche() {
  const anno = document.getElementById('f-anno').value;
  const params = new URLSearchParams();
  if (anno) params.set('anno', anno);

  let dati;
  try {
    dati = await api.get(`/api/statistiche?${params.toString()}`);
  } catch (err) {
    document.getElementById('contenuto-statistiche').style.display = 'none';
    document.getElementById('msg-non-admin').style.display = 'block';
    return;
  }

  const { riepilogo, perCategoria, perCliente, andamento } = dati;

  document.getElementById('s-confermato').textContent = formatValutaIntera(riepilogo.confermato);
  document.getElementById('s-attesa').textContent = formatValutaIntera(riepilogo.in_attesa);
  document.getElementById('s-perso').textContent = formatValutaIntera(riepilogo.perso);
  document.getElementById('s-totale').textContent = formatValutaIntera(riepilogo.totale);

  const avviso = document.getElementById('avviso-senza-costo');
  if (riepilogo.servizi_senza_costo > 0) {
    avviso.textContent = `${riepilogo.servizi_senza_costo} servizi non hanno un costo annuo impostato e sono esclusi da questi totali.`;
    avviso.style.display = 'block';
  } else {
    avviso.style.display = 'none';
  }

  const tbodyAndamento = document.getElementById('tabella-andamento');
  tbodyAndamento.innerHTML = andamento
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(r.anno)}</td>
      <td>${formatValutaIntera(r.confermato)}</td>
      <td>${formatValutaIntera(r.in_attesa)}</td>
      <td>${formatValutaIntera(r.perso)}</td>
      <td><strong>${formatValutaIntera(r.totale)}</strong></td>
    </tr>
  `
    )
    .join('');

  const tbodyCategoria = document.getElementById('tabella-categoria');
  const msgVuotoCategoria = document.getElementById('msg-vuoto-categoria');
  if (perCategoria.length === 0) {
    tbodyCategoria.innerHTML = '';
    msgVuotoCategoria.style.display = 'block';
  } else {
    msgVuotoCategoria.style.display = 'none';
    tbodyCategoria.innerHTML = perCategoria
      .map(
        (r) => `
      <tr>
        <td>${escapeHtml(r.categoria)}</td>
        <td>${r.n}</td>
        <td>${formatValutaIntera(r.totale)}</td>
      </tr>
    `
      )
      .join('');
  }

  const tbodyCliente = document.getElementById('tabella-cliente');
  const msgVuotoCliente = document.getElementById('msg-vuoto-cliente');
  if (perCliente.length === 0) {
    tbodyCliente.innerHTML = '';
    msgVuotoCliente.style.display = 'block';
  } else {
    msgVuotoCliente.style.display = 'none';
    tbodyCliente.innerHTML = perCliente
      .map(
        (r) => `
      <tr>
        <td><a class="link-cliente" href="/cliente.html?id=${r.cliente_id}">${escapeHtml(r.cliente_nome)}</a></td>
        <td>${r.n}</td>
        <td>${formatValutaIntera(r.totale)}</td>
      </tr>
    `
      )
      .join('');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initNav();
  initRicercaGlobale();
  await caricaAnni();
  await caricaStatistiche();

  document.getElementById('f-anno').addEventListener('change', caricaStatistiche);
});
