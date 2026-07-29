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

L'app è su `http://localhost:3000`. Al primo avvio viene creato automaticamente:
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
| `ALERT_EMAIL_TO` | Destinatario delle email di alert scadenze |
| `CRON_SECRET` | Segreto per autorizzare la chiamata esterna che avvia il controllo scadenze (vedi sotto) |

## Deploy su Railway

### 1. Crea il servizio web

- Crea un nuovo progetto su Railway a partire da questo repository
- Railway rileva automaticamente `Procfile` e Node.js (Nixpacks)
- Aggiungi tutte le variabili d'ambiente elencate sopra nelle **Variables** del servizio, con `NODE_ENV=production`

### 2. Volume persistente per SQLite (obbligatorio)

Il filesystem di un servizio Railway è **effimero**: viene ricreato ad ogni deploy/restart, e senza un Volume il database SQLite (e quindi tutti i dati clienti/servizi) andrebbe perso ogni volta.

Per evitarlo:

1. Nel servizio web, vai su **Settings → Volumes → New Volume**
2. Imposta il **Mount Path** su `/app/data` (deve corrispondere esattamente alla cartella `data/` nella root del progetto, dove il codice crea `database.sqlite`)
3. Fai il deploy: al primo avvio lo schema e i dati di esempio vengono creati dentro il volume, e da quel momento sopravvivono a ogni redeploy/restart

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

## Note

- Tutte le route (tranne login e l'endpoint interno del cron) richiedono una sessione autenticata
- Rate limiting sul login: 5 tentativi falliti bloccano l'IP per 15 minuti
- In produzione (`NODE_ENV=production`) le richieste HTTP vengono reindirizzate automaticamente a HTTPS
- Non committare mai il file `.env`
