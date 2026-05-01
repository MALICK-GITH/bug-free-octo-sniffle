# FC 25 Virtual Predictions

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

3. Lancer le serveur

```bash
npm start
```

Le site est disponible sur:

- `http://localhost:3029`
- `https://fifaxpred.onrender.com`

## Base de donnees integree

Le projet utilise SQLite (natif Node.js) et cree automatiquement:

- `coupon_generations`
- `coupon_validations`
- `telegram_logs`

Fichier DB par defaut:

- `data/app.sqlite`

## API utiles

- `GET /api/db/status` -> etat de la DB
- `GET /api/coupon/history?limit=20` -> historique des coupons
- `GET /api/telegram/history?limit=20` -> historique des envois Telegram
- `GET /api/mobile/bootstrap` -> bootstrap pour application Android
- `GET /api/mobile/openapi` -> spec OpenAPI mobile
- `GET /api/watchlist?userId=demo` -> watchlist synchronisee
- `POST /api/watchlist` -> sauvegarder la watchlist
- `POST /api/mobile/devices/register` -> enregistrer un appareil Android

## Notes

- Aucune manipulation SQL manuelle n'est necessaire.
- Les tables sont creees automatiquement au demarrage.

## Android

- Guide complet: `ANDROID_INTEGRATION_GUIDE.md`
- Cahier des charges detaille: `CAHIER_DES_CHARGES_ANDROID.md`
- Dossier de transmission dev Android: `HANDOFF_DEV_ANDROID.md`
- Spec API mobile: `docs/android-api.openapi.json`
- Verification syntaxe serveur: `npm run check:server`

## Production

- URL de production cible: `https://fifaxpred.onrender.com`
- Si `/api/mobile/bootstrap` ou `/api/mobile/openapi` renvoient `404`, le deploiement Render n'est pas encore aligne sur la derniere version backend locale et doit etre redeploye avant handoff mobile.
