# AgencyDesk

App interna per gestire clienti e scadenze dei servizi di una web agency (domini, hosting, SSL, assistenza, Google Workspace, licenze software, ecc.).

Stack: Node.js + Express + SQLite (better-sqlite3), frontend HTML/CSS/JS vanilla, nessun framework/ORM pesante.

## Avvio in locale

```bash
npm install
cp .env.example .env
```

Modifica `.env` con le tue credenziali (almeno `LOGIN_USER`, `LOGIN_PASSWORD`, `SESSION_SECRET`), poi:

```bash
npm start
```

L'app è su `http://localhost:3000`, la pagina di login è su `/dev-console` (percorso volutamente non ovvio, vedi sezione Sicurezza). Al primo avvio viene creato automaticamente:
- il database SQLite in `data/database.sqlite`
- un utente admin con le credenziali `LOGIN_USER` / `LOGIN_PASSWORD` da `.env`
- 3 clienti e 6 servizi di esempio, per testare subito la dashboard

Dopo il primo login puoi creare altri operatori dalla pagina **Utenti** (visibile solo agli admin).

## Variabili d'ambiente

| Variabile | Descrizione |
|---|---|
| `PORT` | Porta locale (default 3000, su Railway viene impostata automaticamente) |
| `NODE_ENV` | `production` su Railway: abilita redirect HTTPS e cookie `secure` |
| `LOGIN_USER` / `LOGIN_PASSWORD` | Credenziali del primo utente admin, usate solo al primo avvio (seed) |
| `SESSION_SECRET` | Stringa lunga e casuale per firmare il cookie di sessione |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Configurazione SMTP per l'invio email di alert |
| `ALERT_EMAIL_TO` | Destinatario iniziale delle email di alert (solo al primo avvio: dopo si cambia dalla pagina **Impostazioni**, salvato nel database) |
| `CRON_SECRET` | Segreto per autorizzare la chiamata esterna che avvia il controllo scadenze (vedi sotto) |

La pagina **Impostazioni** (solo admin) mostra anche lo stato della configurazione SMTP/cron e lo storico delle email di alert inviate.

## Deploy su Railway

### 1. Crea il servizio web

- Crea un nuovo progetto su Railway a partire da questo repository
- Railway rileva automaticamente `Procfile` e Node.js (Nixpacks)
- Aggiungi tutte le variabili d'ambiente elencate sopra nelle **Variables** del servizio, con `NODE_ENV=production`

### 2. Volume persistente per SQLite (obbligatorio)

Il filesystem di un servizio Railway è **effimero**: viene ricreato ad ogni deploy/restart, e senza un Volume il database SQLite (e quindi tutti i dati clienti/servizi) andrebbe perso ogni volta.

Per evitarlo:

1. Nella vista del progetto (canvas con i blocchi dei servizi), click destro in un punto vuoto → **Volume** (oppure Command Palette **⌘K** → cerca "volume")
2. Quando richiesto, collega il volume al servizio web
3. Imposta il **Mount Path** su `/app/data` (deve corrispondere esattamente alla cartella `data/` nella root del progetto, dove il codice crea `database.sqlite`)
4. Railway rifà il deploy automaticamente: al primo avvio lo schema e i dati di esempio vengono creati dentro il volume, e da quel momento sopravvivono a ogni redeploy/restart

### 3. Alert email scadenze (Cron Job)

Su Railway **un Volume può essere collegato a un solo servizio alla volta**. Questo significa che un secondo servizio separato che esegue `npm run check-alerts` direttamente non potrebbe leggere lo stesso database del servizio web (avrebbe un filesystem/volume diverso o nessun volume).

Per aggirare il problema, il controllo scadenze è esposto anche come endpoint interno protetto: `POST /api/internal/check-alerts`, autenticato con l'header `x-cron-secret` (valore = `CRON_SECRET` da `.env`). Un Cron Job separato chiama semplicemente questo endpoint via HTTP, così la logica gira nel servizio web e legge il database dal suo stesso volume — nessun problema di condivisione.

Per configurarlo:

1. Nello stesso progetto Railway, crea un nuovo servizio: **New → Empty Service** (non serve collegare questo repo)
2. In **Settings** del nuovo servizio:
   - **Source**: immagine Docker `curlimages/curl` (oppure lascia il deploy da repo se preferisci, basta che il comando finale sia quello sotto)
   - **Custom Start Command**:
     ```
     curl -sf -X POST https://<il-tuo-dominio-railway>/api/internal/check-alerts -H "x-cron-secret: $CRON_SECRET"
     ```
   - **Cron Schedule**: `0 8 * * *`
   - Aggiungi la variabile `CRON_SECRET` con lo stesso valore usato nel servizio web
3. Salva: da quel momento, ogni giorno alle 8:00 il job chiama l'endpoint, che controlla i servizi in scadenza nei prossimi 30 giorni e invia le email (loggando gli invii per non duplicarli nello stesso giorno)

In locale (o per un test manuale), puoi anche eseguire direttamente:

```bash
npm run check-alerts
```

che esegue lo stesso controllo via script CLI, senza passare dall'endpoint HTTP.

## Sicurezza

Misure attualmente in atto:

- Password hashate con bcrypt, mai salvate in chiaro
- Sessione in cookie firmato, `httpOnly`, `secure` in produzione, `sameSite=lax` (mitiga CSRF sulle richieste POST/PUT/DELETE cross-site)
- Rate limiting sul login: 5 tentativi falliti bloccano sia l'IP sia lo username per 15 minuti
- Tutte le query al database sono parametrizzate (nessuna concatenazione di stringhe SQL)
- Output HTML sempre escapato lato frontend (nessuna interpolazione diretta di dati utente nel DOM)
- Ruoli admin/operatore con controlli lato server su ogni endpoint sensibile, non solo lato UI
- In produzione (`NODE_ENV=production`) le richieste HTTP vengono reindirizzate automaticamente a HTTPS
- Pagina di login su `/dev-console` invece di `/login`, per non essere il primo bersaglio di scanner automatici che provano percorsi standard (misura di offuscamento, non sostituisce le altre protezioni)
- Endpoint cron interno protetto da segreto confrontato con `crypto.timingSafeEqual`
- Security header HTTP: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, e `Strict-Transport-Security` in produzione
- Log di ogni tentativo di login (successo/fallito, username, IP, orario), consultabile in **Impostazioni → Ultimi accessi**

Da valutare come prossimi passi, prima di andare online:

- Backup **off-site** del database: `npm run backup-db` crea una copia con timestamp in `data/backups/` (consistente anche con WAL attivo, tramite l'API di backup di better-sqlite3, mantiene le ultime 30 copie), ma su Railway questa cartella vive comunque nello stesso Volume — protegge da corruzione/cancellazione accidentale del file live, non da un disastro che colpisce l'intero volume. Per un vero backup off-site serve schedulare l'invio periodico di questi file altrove (S3, Google Drive, email): non implementato, richiede una scelta su dove archiviarli
- 2FA per gli account admin, se il livello di rischio percepito lo giustifica
- Considerare un provider email transazionale dedicato (es. Resend, Postmark) invece di SMTP generico, per deliverability e log di invio più solidi

## Note

- Tutte le route (tranne login e l'endpoint interno del cron) richiedono una sessione autenticata
- Non committare mai il file `.env`
