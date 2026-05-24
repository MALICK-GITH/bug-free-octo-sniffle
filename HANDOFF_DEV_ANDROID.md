# Handoff Dev Android

## Reponse courte

Oui, les fichiers prepares sont **complets pour qu'un developpeur Android puisse construire une application Android prototype connectee au backend actuel**.

Non, ils ne sont **pas suffisants a eux seuls pour garantir une application payante finalisee pour le Play Store**, car il manque encore cote backend :

1. auth utilisateur,
2. push FCM complet,
3. verification abonnement Google Play,
4. securite production complete.

## Ce que le developpeur peut faire immediatement avec ces fichiers

Le developpeur peut deja construire une application Android qui :

- charge les matchs a venir,
- charge les matchs live,
- ouvre le detail d'un match,
- genere un coupon,
- valide un coupon,
- ajoute un coupon aux favoris,
- synchronise une watchlist,
- utilise le chat IA,
- enregistre l'appareil mobile,
- se connecte au backend existant.

## Fichiers a envoyer au developpeur Android

Envoie ces fichiers minimum :

1. `CAHIER_DES_CHARGES_ANDROID.md`
2. `ANDROID_INTEGRATION_GUIDE.md`
3. `docs/android-api.openapi.json`
4. `README.md`
5. `.env.example`

Si le developpeur Android doit aussi comprendre le backend ou verifier les routes, envoie aussi :

6. `server.js`
7. `services/liveFeed.js`
8. `services/db.js`
9. `services/database.js`
10. `package.json`

## Ce qu'il doit comprendre avant de commencer

### Verite importante

Le backend actuel est bon pour une app connectee **prototype / beta**.

Le backend actuel n'est pas encore le backend final d'une app premium publiee.

### Donc

Si tu lui envoies ces fichiers aujourd'hui, il peut :

- construire l'application,
- brancher l'application au backend,
- faire tourner les ecrans principaux,
- produire un APK prototype ou une beta testable.

Mais il ne doit pas supposer que :

- la connexion utilisateur finale existe deja,
- le paiement premium final existe deja,
- les notifications push finales sont deja terminees.

## URL / backend a fournir au developpeur

En plus des fichiers, tu dois lui donner :

1. l'URL du backend si heberge en ligne,
2. ou le projet backend complet s'il doit le lancer localement,
3. le fichier `.env` reel ou les vraies variables d'environnement,
4. le port / domaine exact a utiliser.

### URL actuelle

- production cible : `https://fifaxpred.onrender.com`
- local : `http://localhost:3029`

Sans cela, il pourra coder l'app, mais il ne pourra pas la connecter reellement.

## Etat du deploiement verifie

Verification effectuee sur `https://fifaxpred.onrender.com` :

- `/` : OK
- `/health` : OK
- `/api/matches/upcoming` : OK
- `/api/watchlist` : OK
- `/api/mobile/bootstrap` : `404`
- `/api/mobile/openapi` : `404`
- `/api/mobile/devices/register` : `404`

Conclusion :

- la production existe bien,
- mais elle ne porte pas encore toute la derniere version backend preparee localement pour l'app Android.

Donc :

- si le developpeur Android doit travailler tout de suite, il peut utiliser le dossier et brancher l'app sur un backend local,
- si tu veux qu'il consomme directement Render, il faut redeployer la derniere version backend avant.

## Backend deja disponible pour connexion

Endpoints principaux deja exploitables :

- `GET /health`
- `GET /api/mobile/bootstrap`
- `GET /api/mobile/openapi`
- `POST /api/mobile/devices/register`
- `GET /api/matches/upcoming`
- `GET /api/matches/live`
- `GET /api/matches/:id/details`
- `GET /api/predictions/:matchId`
- `POST /api/coupon/generate`
- `POST /api/coupon/validate`
- `GET /api/coupon/history`
- `GET /api/coupon/favorites`
- `POST /api/coupon/favorite`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `POST /api/chat`

## Ce que j'ai deja prepare pour lui

### 1. Le cahier des charges complet

Dans `CAHIER_DES_CHARGES_ANDROID.md`, il a :

- les ecrans,
- les flux,
- l'architecture Android,
- les modeles a creer,
- les strategies de cache,
- les criteres d'acceptation,
- l'ordre de developpement.

### 2. Le guide d'integration

Dans `ANDROID_INTEGRATION_GUIDE.md`, il a :

- le verdict de readiness,
- les endpoints prioritaires,
- la roadmap,
- les limites actuelles.

### 3. La spec API

Dans `docs/android-api.openapi.json`, il a :

- les routes,
- les payloads,
- les schemas de base.

## Ce que le developpeur doit produire a partir de ces fichiers

Je lui recommande ce livrable minimum :

1. app Android Kotlin,
2. ecrans Home / Live / Detail Match / Coupon / Favoris / Watchlist / Chat / Settings,
3. connexion reelle au backend,
4. cache local,
5. APK prototype,
6. base propre pour ajouter auth/premium plus tard.

## Ce qu'il ne faut pas lui promettre a ce stade

Ne lui dis pas :

- "tout le backend final est deja termine",
- "l'app payante est deja 100% prete",
- "tu peux publier directement sur Play Store sans autre backend".

La bonne formulation est :

"Tu peux construire l'application Android connectee a partir de ce dossier. La base backend est prete pour un prototype connecte et une beta. Les blocs auth, push et billing seront finalises ensuite pour la release production."

## Mon verdict final pour toi

Si ton objectif est :

- **creer maintenant une app Android connectee au site**, alors oui, ces fichiers sont suffisants pour lancer ton developpeur.
- **sortir directement une app Android premium finale publiee**, alors non, il manque encore des blocs backend.

## Phrase simple a envoyer au developpeur

"Je t'envoie le cahier des charges, le guide d'integration et la spec API. Tu peux construire l'application Android connectee au backend actuel sur cette base. La priorite est de livrer une version prototype connectee et propre, en preparant l'ajout futur de l'auth, du push et du billing."
