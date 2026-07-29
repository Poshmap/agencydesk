# AgencyDesk — Specifiche complete

**Stato**: primo step congelato, pronto per la pubblicazione online.
**Ultimo aggiornamento**: 2026-07-29

Documento di riferimento completo: cosa fa l'app, come è fatta, come è protetta, come si mantiene nel tempo. Il [README.md](README.md) resta la guida rapida per avvio locale e deploy; questo documento è il riferimento esteso.

---

## 1. Cos'è

App web interna per una web agency, per gestire clienti e le scadenze dei servizi che l'agenzia gestisce per loro (domini, hosting, siti Wix, assistenza, licenze software), con controllo del fatturato ricorrente generato dai rinnovi.

Non è un prodotto multi-tenant: è pensata per un solo team che vede tutti gli stessi dati (nessuna segmentazione dei dati per utente — chi accede vede tutti i clienti e servizi dell'agenzia, coerente con l'uso previsto).

---

## 2. Stack tecnico

- **Backend**: Node.js + Express, nessun framework ORM (query SQL dirette con `better-sqlite3`, statement sempre parametrizzati)
- **Database**: SQLite, file singolo (`data/database.sqlite`), persistente su Volume Railway in produzione
- **Frontend**: HTML/CSS/JS vanilla, nessun framework, nessuna build step
- **Dipendenze runtime** (6, verificate senza vulnerabilità note — `npm audit`: 0 al 2026-07-29):
  `express`, `better-sqlite3`, `bcryptjs`, `cookie-session`, `nodemailer`, `dotenv`

---

## 3. Modello dati

```
users        (id, username, password_hash, role[admin|operatore], created_at)
clienti      (id, nome, email, telefono, note, created_at)
servizi      (id, cliente_id→clienti, nome_servizio, categoria, provider,
              data_inizio, data_scadenza, costo_annuo, stato_rinnovo, note, created_at)
alert_log    (id, servizio_id→servizi, data_invio, created_at)   -- storico email inviate
settings     (key, value, updated_at)                            -- config modificabile da UI
login_log    (id, username, ip, esito[successo|fallito], created_at)
migrations   (id, nome, applicata_il)                             -- bookkeeping interno, vedi §7
```

**Categorie servizio** (vincolo a livello DB + validazione applicativa):
`Dominio`, `Servizio Wix`, `Assistenza ordinaria`, `Assistenza straordinaria`, `Dominio + hosting`, `Licenza Software`, `Altro`

**Stati rinnovo**: `Da rinnovare`, `Rinnovato`, `Annullato`

**Relazioni**: `servizi.cliente_id` e `alert_log.servizio_id` con `ON DELETE CASCADE` — eliminare un cliente elimina i suoi servizi; eliminare un servizio elimina il suo storico invii.

Schema completo: [db/schema.sql](db/schema.sql).

---

## 4. Funzionalità

### Dashboard (`/index.html`)
Tabella servizi ordinata per scadenza, semaforo colori (rosso=scaduto, arancione=entro 30gg, giallo=entro 60gg, verde=ok, grigio=annullato). Filtri combinabili: cliente, categoria, stato rinnovo, **anno di scadenza**. Contatori in alto sempre coerenti con i filtri attivi. Export CSV che rispetta gli stessi filtri.

### Clienti (`/clienti.html`, `/cliente.html`)
CRUD clienti. Vista dettaglio con tutti i servizi collegati e CRUD servizi in loco.

### Statistiche (`/statistiche.html`) — **solo admin**
Fatturato da `costo_annuo`, diviso per stato (confermato / in attesa / perso), andamento per anno, breakdown per categoria e per cliente. Servizi senza costo impostato segnalati ed esclusi dai totali.

### Utenti (`/utenti.html`) — **solo admin**
CRUD operatori, due ruoli (admin/operatore). Protezioni: un utente non può eliminare se stesso; non si può eliminare o retrocedere l'ultimo admin rimasto.

### Impostazioni (`/impostazioni.html`) — **solo admin**
Email destinatario alert (modificabile da UI, salvata a DB), pulsante di invio email di test, stato configurazione SMTP/cron, storico invii alert, storico accessi (login riusciti e falliti con IP e orario).

### Ricerca globale
Barra di ricerca in ogni pagina, cerca su nome cliente e nome servizio in tempo reale.

### Alert email scadenze
`lib/alerts.js`: controlla i servizi con stato "Da rinnovare" in scadenza nei prossimi 30 giorni, invia un'email per ciascuno, logga gli invii per non duplicarli nello stesso giorno. Tre modi per eseguirlo:
- `npm run check-alerts` (CLI, locale/manuale)
- `POST /api/internal/check-alerts` (endpoint HTTP protetto da `CRON_SECRET`, per il cron su Railway — vedi README)
- Pulsante "Invia email di test" in Impostazioni (invia un'email di prova, non controlla le scadenze)

### Backup locale
`npm run backup-db`: copia consistente del database (via API di backup nativa di better-sqlite3, sicura anche con WAL attivo) in `data/backups/`, mantiene le ultime 30. **Non è backup off-site** — vive nello stesso Volume Railway del database live (vedi README, sezione Sicurezza, per i limiti).

---

## 5. Autenticazione e ruoli

- Login con username/password, hash bcrypt (cost 10), mai salvate in chiaro
- Sessione in cookie firmato (`cookie-session`): `httpOnly`, `secure` in produzione, `sameSite=lax`
- Due ruoli: **admin** (accesso completo, incluse Utenti/Impostazioni/Statistiche) e **operatore** (Dashboard e Clienti, dati sensibili di business come fatturato e configurazione esclusi)
- Il controllo dei permessi è **sempre lato server** (middleware `requireLogin`/`requireAdmin` su ogni rotta), non solo nascondere voci di menu — un operatore che prova un URL diretto o chiama l'API direttamente riceve comunque 403
- Primo utente admin creato automaticamente al primo avvio da `LOGIN_USER`/`LOGIN_PASSWORD` in `.env`; da lì si gestisce tutto da UI

---

## 6. Sicurezza — verifica effettuata il 2026-07-29

Prima di congelare questo step ho fatto una revisione mirata (non solo affidata alla memoria di cosa costruito, ma releggendo il codice riga per riga sui punti critici). Riepilogo con esito:

| Area | Verifica | Esito |
|---|---|---|
| SQL injection | Ogni query con dati esterni passa da parametri `?`, mai concatenazione di stringhe | ✅ Nessuna query vulnerabile trovata |
| XSS | Ogni punto che scrive dati esterni in `innerHTML` verificato uno per uno, incluso il caso più delicato (username nei tentativi di login, scrivibile da chiunque anche senza account, letto dagli admin in Impostazioni) | ✅ Sempre passato da `escapeHtml()` |
| Autorizzazione | Ogni rotta pagina/API riverificata contro `requireLogin`/`requireAdmin` in `server.js` | ✅ Nessuna rotta scoperta |
| Fuga di dati | Verificato che `password_hash` e credenziali SMTP non escano mai nelle risposte JSON | ✅ Confermato, solo campi espliciti restituiti |
| CSRF | `sameSite=lax` blocca l'invio del cookie su richieste cross-site che modificano stato | ✅ Adeguato al profilo di rischio (tool interno) |
| Rate limiting login | 5 tentativi falliti bloccano IP e username per 15 minuti | ✅ Testato con IP multipli sullo stesso username |
| **Consumo memoria rate limiter** | Un attacco con migliaia di username diversi, un tentativo ciascuno, non superava mai la soglia di blocco e restava in memoria indefinitamente | 🔧 **Trovato e corretto**: pulizia automatica delle voci inattive da oltre un'ora |
| **Validazione email Impostazioni** | Un newline interno nell'indirizzo email (vettore classico di SMTP header injection) superava la regex | 🔧 **Trovato e corretto**: rifiutato esplicitamente qualunque carattere di spaziatura, testato con payload di injection reale |
| Dipendenze | `npm audit` | ✅ 0 vulnerabilità note |
| Header di sicurezza | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS in produzione | ✅ Verificati attivi |
| Cron interno | `/api/internal/check-alerts` protetto da confronto a tempo costante (`crypto.timingSafeEqual`) sul `CRON_SECRET` | ✅ |

**Due problemi reali sono stati trovati e corretti durante questa revisione** (rate limiter e validazione email) — non erano exploitable in modo grave nel contesto attuale (il secondo richiede comunque un account admin), ma li ho chiusi comunque.

### Onestà sui limiti di questa garanzia

Non esiste un "sicuro al 100%" assoluto in software — nessuno può onestamente garantirlo, e diffiderei di chi lo fa. Quello che posso dire con fondamento:
- Ho verificato **le classi di vulnerabilità più comuni e più rilevanti per questa app** (SQL injection, XSS, autorizzazione, fuga di credenziali, CSRF) leggendo il codice reale, non a memoria
- Le dipendenze non hanno vulnerabilità note al momento della verifica (`npm audit` va ripetuto periodicamente, le vulnerabilità nuove emergono nel tempo)
- **Non è stato fatto** un penetration test formale, né un audit di terze parti, né fuzzing automatizzato — ragionevole per un tool interno di questa scala, ma vale la pena saperlo

Elenco completo dei prossimi passi consigliati (non bloccanti per il lancio, ma da tenere in lista) nel [README, sezione Sicurezza](README.md#sicurezza).

---

## 7. Aggiornamenti e migrazioni — come si evolve senza rischi

**Il rischio principale non era mai il codice**: un redeploy su Railway sostituisce solo il container applicativo, il database vive nel Volume persistente, separato — aggiornare il codice non tocca mai i dati.

**Il rischio vero erano le modifiche alla struttura del database** (es. cambiare i valori ammessi in un campo, aggiungere una colonna) su un database già popolato con dati reali. Prima di questo step la creazione tabelle usava `CREATE TABLE IF NOT EXISTS`, che su un database esistente non fa nulla — un cambio di struttura sarebbe stato silenziosamente ignorato, con inserimenti nuovi rifiutati dal database.

Ho introdotto un **sistema di migrazioni versionate** (`db/migrate.js` + `db/migrations/`): ogni cambio di struttura è un file numerato, tracciato in una tabella `migrations`, applicato **una sola volta**, in ordine, anche su un database già in uso. Testato con uno scenario realistico prima di essere usato per la modifica reale delle categorie (vedi cronologia conversazione): database "vecchio" simulato con dati e foreign key collegate → migrazione applicata → dati convertiti correttamente, nessuna perdita, integrità referenziale preservata.

**Procedura per una futura modifica di struttura**: aggiungere un file in `db/migrations/`, aggiornare `db/schema.sql` per riflettere lo stato finale (per le installazioni nuove), testare la migrazione su una copia del database prima di applicarla in produzione.

---

## 8. Struttura del progetto

```
server.js                    Bootstrap Express, montaggio rotte e middleware
db/
  schema.sql                 Schema completo (installazioni nuove)
  index.js                   Connessione, seed iniziale (admin, dati esempio, settings)
  migrate.js                 Runner delle migrazioni
  migrations/                Migrazioni versionate
lib/
  alerts.js                  Logica controllo scadenze + invio alert
  mailer.js                  Transporter nodemailer condiviso
  settings.js                Lettura/scrittura settings (con fallback a .env)
middleware/
  auth.js                    requireLogin, requireAdmin
  rateLimiter.js             Rate limiting login (IP + username)
  httpsRedirect.js           Redirect HTTP→HTTPS in produzione
  securityHeaders.js         Header di sicurezza HTTP
routes/                      Un file per area funzionale (clienti, servizi, utenti,
                              impostazioni, statistiche, export, search, auth, internal)
public/                      Frontend: una pagina HTML + un file JS per area,
                              css/style.css condiviso, img/ per gli asset del brand
scripts/
  check-alerts.js            CLI per il controllo scadenze
  backup-db.js                CLI per il backup del database
```

---

## 9. Cosa NON c'è (limiti noti, non bloccanti)

- Nessun recupero password self-service (un admin deve reimpostarla manualmente da Utenti)
- Nessuna 2FA
- Nessun backup off-site automatico (solo locale/stesso Volume, vedi §4)
- Nessun audit log delle modifiche a clienti/servizi (solo login tracciati, non le modifiche ai dati)
- Nessuna paginazione (adeguato al volume dati previsto per una singola agenzia; da rivalutare se i clienti diventano centinaia)

---

## 10. Deploy

Procedura completa, incluso Volume Railway e configurazione del cron, nel [README.md](README.md#deploy-su-railway).
