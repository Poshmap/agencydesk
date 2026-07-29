document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();

  const errore = document.getElementById('errore');
  errore.classList.remove('visibile');

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      errore.textContent = data.error || 'Errore di accesso';
      errore.classList.add('visibile');
      return;
    }

    window.location.href = '/index.html';
  } catch (err) {
    errore.textContent = 'Impossibile contattare il server';
    errore.classList.add('visibile');
  }
});
