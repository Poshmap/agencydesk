async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (res.status === 401) {
    window.location.href = '/dev-console';
    return new Promise(() => {});
  }

  let data = null;
  const testo = await res.text();
  if (testo) {
    try {
      data = JSON.parse(testo);
    } catch (e) {
      data = null;
    }
  }

  if (!res.ok) {
    const errore = (data && data.error) || 'Si è verificato un errore';
    throw new Error(errore);
  }

  return data;
}

const api = {
  get: (url) => apiFetch(url),
  post: (url, body) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiFetch(url, { method: 'PUT', body: JSON.stringify(body) }),
  del: (url) => apiFetch(url, { method: 'DELETE' })
};

function formatData(iso) {
  if (!iso) return '—';
  const [anno, mese, giorno] = iso.split('-');
  return `${giorno}/${mese}/${anno}`;
}

function formatValuta(valore) {
  if (valore === null || valore === undefined || valore === '') return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Un solo pill per servizio, niente doppia etichetta: la scadenza stessa
// diventa il messaggio quando serve attenzione.
function etichettaUrgenza(servizio) {
  if (servizio.urgenza === 'annullato') return 'Annullato';
  if (servizio.urgenza === 'ok') return 'OK';

  const g = servizio.giorni_alla_scadenza;
  if (g === 0) return 'Scade oggi';
  if (g > 0) return `Scade tra ${g}gg`;
  return `Scaduto da ${Math.abs(g)}gg`;
}
