# Android Integration Guide

## Verdict

Le projet est maintenant **apte pour lancer le developpement d'une application Android prototype**.

Il n'est **pas encore pret pour une sortie Play Store en production** sans ajouter les 4 blocs suivants :

1. Authentification utilisateur.
2. Notifications push reelles via Firebase Cloud Messaging.
3. Verification serveur des abonnements Google Play.
4. Configuration production securisee: HTTPS, rotation des secrets, variables d'environnement propres.

## Ce que le backend sait deja faire

- Lister les matchs live et a venir.
- Fournir les details d'un match et une prediction.
- Generer et valider des coupons.
- Exporter un coupon en image ou PDF.
- Envoyer des coupons sur Telegram.
- Servir un chat IA unifie.
- Synchroniser une watchlist cote serveur.
- Enregistrer un appareil mobile cote serveur.
- Exposer un bootstrap mobile et une spec OpenAPI.

## Endpoints a utiliser en priorite

- Base URL production cible: `https://fifaxpred.onrender.com`
- `GET /api/mobile/bootstrap`
- `GET /api/mobile/openapi`
- `GET /api/matches/upcoming`
- `GET /api/matches/live`
- `GET /api/matches/:id/details`
- `GET /api/predictions/:matchId`
- `POST /api/coupon/generate`
- `POST /api/coupon/validate`
- `GET /api/coupon/history`
- `GET /api/coupon/favorites?userId=...`
- `POST /api/coupon/favorite`
- `GET /api/watchlist?userId=...`
- `POST /api/watchlist`
- `POST /api/mobile/devices/register`
- `POST /api/chat`

## Architecture Android recommandee

- Langage: Kotlin.
- UI: Jetpack Compose.
- HTTP: Retrofit ou Ktor Client.
- Injection: Hilt.
- Cache local: Room.
- Preferences: DataStore.
- Taches de fond: WorkManager.
- Push: Firebase Cloud Messaging.
- Paiement: Google Play Billing.

## Ecrans recommandes

1. Splash + bootstrap API.
2. Accueil matchs a venir.
3. Onglet matchs live.
4. Detail match.
5. Coupon builder.
6. Historique / favoris.
7. Watchlist synchronisee.
8. Chat IA.
9. Parametres.
10. Connexion / abonnement premium.

## Flux de demarrage conseille

1. Appel `GET /api/mobile/bootstrap`.
2. Appel `POST /api/mobile/devices/register`.
3. Chargement des matchs `upcoming` puis `live`.
4. Synchronisation `watchlist` et `favorites`.
5. Activation du chat et du coupon builder.

## Ce qu'il faut encore construire cote backend avant la release

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/me`

### Push

- Stockage fiable du token FCM par utilisateur.
- Endpoint d'envoi cible par type d'alerte.
- Preferences de notification par utilisateur.

### Billing

- Validation serveur des achats Google Play.
- Table `subscriptions`.
- Gestion des plans gratuit / premium / expire.

### Securite

- Secrets uniquement via `.env`.
- Rate limiting cible sur auth et chat.
- Journal d'audit par utilisateur.
- CORS et domaines de prod stricts.

## Donnees a synchroniser entre site et app

- Favoris.
- Watchlist.
- Historique des coupons.
- Parametres utilisateur.
- Statut premium.
- Historique chat utile si tu veux une experience continue multi-support.

## Recommandation de roadmap

### Phase 1

- Android prototype lecture seule: matchs, details, prediction.

### Phase 2

- Coupon builder + favoris + watchlist + chat.

### Phase 3

- Auth + push + premium + publication Play Store.

## Fichiers utiles dans ce repo

- `server.js`
- `services/db.js`
- `services/database.js`
- `public/manifest.webmanifest`
- `docs/android-api.openapi.json`

## Note de pilotage

Au moment du controle de production, `https://fifaxpred.onrender.com` repondait bien sur `/`, `/health` et `/api/matches/upcoming`, mais les routes `/api/mobile/bootstrap` et `/api/mobile/openapi` renvoyaient `404`.

Conclusion pratique :

- tu peux transmettre ce dossier au developpeur Android,
- mais si tu veux qu'il branche l'app directement sur la prod Render, il faut redeployer la derniere version du backend avant.

Si tu engages un developpeur Android maintenant, il peut commencer tout de suite sur le prototype.

Si ton objectif est une **vraie application Android payante et synchronisee avec le site**, il faudra d'abord finaliser les blocs `auth`, `push` et `billing` avant publication.
