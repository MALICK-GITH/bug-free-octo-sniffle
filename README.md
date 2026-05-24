# ONE-DELUX

## Demarrage rapide

1. Installer les dependances

```bash
npm install
```

2. Configurer le fichier `.env` (copie de `.env.example`)

Variables minimales:

- `PORT=3029`
- `DB_FILE=data/app.sqlite`
- `TELEGRAM_BOT_TOKEN=...` (optionnel mais recommande)

Variables base de donnees:

- `DATABASE_URL=...` ou `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD`
- `DB_SSL=false` si ton hebergement ne supporte pas le SSL PostgreSQL
- `DB_POOL_MAX=20` pour la taille du pool de connexions

Variables tracker de matchs:

- `MATCH_TRACKER_ENABLED=1`
- `MATCH_TRACKER_INTERVAL_SECONDS=60`
- `MATCH_TRACKER_KEY=default`

3. Lancer le serveur

```bash
npm start
```

Le site est disponible sur:

- `http://localhost:3029`
- `https://fifaxpred.onrender.com`

## Base de donnees integree

Le projet utilise SQLite par defaut et cree automatiquement:

- `coupon_generations`
- `coupon_validations`
- `telegram_logs`
- `matches`
- `match_tracking_runs`
- `match_tracking_state`

Fichier DB par defaut:

- `data/app.sqlite`

Si tu renseignes les variables `DB_HOST`, `DB_NAME`, `DB_USER` et `DB_PASSWORD`, le service peut aussi s'appuyer sur une base MySQL/PostgreSQL selon la configuration serveur.

## API utiles

- `GET /api/db/status` -> etat de la DB
- `GET /api/coupon/history?limit=20` -> historique des coupons
- `GET /api/telegram/history?limit=20` -> historique des envois Telegram
- `GET /api/mobile/bootstrap` -> bootstrap pour application Android
- `GET /api/mobile/openapi` -> spec OpenAPI mobile
- `GET /api/watchlist?userId=demo` -> watchlist synchronisee
- `POST /api/watchlist` -> sauvegarder la watchlist
- `POST /api/mobile/devices/register` -> enregistrer un appareil Android

## Architecture consolidee

Le serveur garde `server.js` comme point d'entree et de composition, avec extraction des routes critiques par domaine:

- `server/routes/matches.js` -> matchs, details, cotes, predictions
- `server/routes/coupon.js` -> generation, validation, favoris, historique, impression
- `server/routes/watchlist.js` -> lecture et sauvegarde synchronisee
- `server/routes/mobile.js` -> bootstrap Android, spec OpenAPI, enregistrement device
- `server/routes/chat.js` -> chat IA et introspection provider

La persistance est separee en deux roles:

- `services/db.js` = stockage metier principal et fallback SQLite local
- `services/database.js` = adaptateur PostgreSQL / service auxiliaire avec fallback vers `services/db.js`

## Contrats API sensibles

Les endpoints suivants doivent conserver leur enveloppe JSON actuelle sauf versionnement explicite:

- `GET /api/matches/upcoming` -> `{ success, data: { matches, total }, meta }`
- `GET /api/matches/live` -> `{ success, data: { matches, total }, meta }`
- `GET /api/matches/:id/details` -> `{ success, source, match, prediction, bettingMarkets, ... }`
- `GET /api/coupon` -> `{ success, source, coupon, summary, ... }`
- `POST /api/coupon/validate` -> `{ success, source, ...report }`
- `GET /api/watchlist` -> `{ success, data: { watchlist, total, userId, snapshot, updatedAt }, meta }`
- `POST /api/watchlist` -> `{ success, data: { watchlist, total, userId, snapshot, updatedAt }, meta }`
- `GET /api/mobile/bootstrap` -> `{ success, data, meta }`
- `POST /api/mobile/devices/register` -> `{ success, data, meta }`
- `POST /api/chat` -> `{ success, provider, model, answer, actions, ... }`

## Notes

- Aucune manipulation SQL manuelle n'est necessaire.
- Les tables sont creees automatiquement au demarrage.
- `npm run check:server` valide la syntaxe du serveur et des services.
- `npm run test` lance la suite Playwright.

## Android

- Guide complet: `ANDROID_INTEGRATION_GUIDE.md`
- Cahier des charges detaille: `CAHIER_DES_CHARGES_ANDROID.md`
- Dossier de transmission dev Android: `HANDOFF_DEV_ANDROID.md`
- Spec API mobile: `docs/android-api.openapi.json`
- Verification syntaxe serveur: `npm run check:server`

## Production

- URL de production cible: `https://fifaxpred.onrender.com`
- Si `/api/mobile/bootstrap` ou `/api/mobile/openapi` renvoient `404`, le deploiement Render n'est pas encore aligne sur la derniere version backend locale et doit etre redeploye avant handoff mobile.

## Deploiement automatique

Le lancement par defaut utilise un wrapper d'auto-mise-a-jour:

```bash
npm start
```

Ce mode:

- demarre le serveur normalement
- verifie regulierement si le depot Git a avance
- fait `git pull --ff-only` quand une nouvelle version est disponible
- relance automatiquement le processus serveur apres mise a jour
- execute `npm install` si `package.json` ou `package-lock.json` a change

Variables utiles:

- `AUTO_UPDATE_ENABLED=1` active la mise a jour auto
- `AUTO_UPDATE_DISABLED=1` la desactive
- `AUTO_UPDATE_REMOTE=origin` choisit le remote Git a suivre
- `AUTO_UPDATE_BRANCH=main` force une branche si besoin
- `AUTO_UPDATE_INTERVAL_MINUTES=5` regle la frequence de verification
- `AUTO_UPDATE_INSTALL=1` relance l'installation des dependances si necessaire

Pour lancer le serveur sans auto-update:

```bash
npm run start:direct
```

Telegram fonctionne maintenant en mode automatique:

- avec `TELEGRAM_BOT_TOKEN` seul, le serveur passe en polling
- si tu ajoutes `TELEGRAM_WEBHOOK_URL`, il utilise le webhook
- `TELEGRAM_WEBHOOK_SECRET` reste optionnel
