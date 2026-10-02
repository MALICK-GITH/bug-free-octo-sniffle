# Cahier Des Charges Android

## Objectif

Construire une application Android native qui reproduit et prolonge le site `SOLITFIFPRO225` autour de 5 piliers :

1. Lecture rapide des matchs FIFA virtuels a venir et en direct.
2. Fiche match riche avec details, marches et prediction.
3. Generation de coupon, validation, export et partage.
4. Synchronisation utilisateur minimale entre web et mobile.
5. Chat IA et experience mobile premium.

## Verdict de depart

Le backend actuel est **suffisant pour lancer un prototype Android**.

Le backend actuel est **insuffisant pour une publication Play Store finale** tant que les blocs suivants ne sont pas ajoutes :

- authentification utilisateur,
- notifications push FCM reelles,
- verification serveur Google Play Billing,
- securite de production complete.

## Livrables attendus du developpeur Android

Le developpeur Android doit livrer :

1. Une application Kotlin native.
2. Une interface Jetpack Compose.
3. Une base reseau branchee sur les endpoints du backend existant.
4. Un cache local propre pour fonctionnement degrade.
5. Une version prototype installable en APK.
6. Une base de code propre pour activer ensuite auth, push et premium.

## Stack recommandee

- Langage : Kotlin.
- UI : Jetpack Compose.
- Navigation : Navigation Compose.
- HTTP : Retrofit avec OkHttp.
- JSON : Kotlinx Serialization ou Moshi.
- Injection : Hilt.
- Cache local : Room.
- Preferences : DataStore.
- Jobs : WorkManager.
- Images : Coil.
- Push : Firebase Cloud Messaging.
- Paiement : Google Play Billing.

## Package Android recommande

- `com.solitairehack.solitfifpro225`

## Base URL backend

- Production cible : `https://fifaxpred.onrender.com`
- Local de dev : `http://localhost:3029`

Important :

- si la production renvoie `404` sur `/api/mobile/bootstrap`, `/api/mobile/openapi` ou `/api/mobile/devices/register`, cela veut dire que le serveur Render n'a pas encore ete redeploye avec la derniere version du backend.
- dans ce cas, le developpeur Android peut travailler contre le backend local ou attendre le redeploiement de production.

## Niveaux Android recommandes

- `minSdk = 26`
- `targetSdk = 35`

## Identite utilisateur temporaire

En attendant la vraie auth, l'application doit creer un `userId` local unique au premier lancement.

Regle recommandee :

- generer un UUID,
- le stocker dans DataStore,
- le reutiliser pour `favorites`, `watchlist` et `device register`,
- migrer plus tard ce `userId` vers un vrai compte lors de l'ajout de l'auth.

## Identite appareil

L'application doit aussi stocker un `deviceId` local stable.

Regle recommandee :

- generer un UUID d'installation,
- ne pas utiliser de serial materiel,
- l'envoyer a `POST /api/mobile/devices/register`.

## Architecture Android recommandee

### Couches

- `app/` : bootstrap, navigation, theme.
- `core/network/` : client API, interceptors, serializers.
- `core/database/` : Room, DAO, cache.
- `core/datastore/` : userId, deviceId, settings.
- `feature/home/` : matchs a venir et live.
- `feature/match/` : detail match, prediction, marches.
- `feature/coupon/` : generation, validation, exports.
- `feature/favorites/` : favoris et historique.
- `feature/watchlist/` : watchlist synchronisee.
- `feature/chat/` : assistant IA.
- `feature/settings/` : preferences, app info.
- `feature/premium/` : reserve pour billing futur.

### Pattern

- `ViewModel + UseCase + Repository`
- `UiState` immutable par ecran
- `sealed class UiEvent`
- `sealed class UiAction`

## Navigation fonctionnelle

Navigation minimale recommandee :

1. Splash / bootstrap
2. Home
3. Match detail
4. Coupon
5. Favorites
6. Watchlist
7. Chat
8. Settings

Bottom navigation recommandee :

- `Accueil`
- `Coupon`
- `Favoris`
- `Chat`
- `Parametres`

## Ecrans a realiser

## 1. Splash / Bootstrap

### But

Initialiser l'app et verifier que le backend est joignable.

### Appels API

- `GET /health`
- `GET /api/mobile/bootstrap`
- `POST /api/mobile/devices/register`

### Comportement

- afficher logo + loader,
- charger bootstrap et health,
- enregistrer le device,
- stocker la config mobile recue,
- passer a Home si succes,
- afficher un ecran erreur/retry si echec reseau.

### Etat local

- `userId`
- `deviceId`
- `bootstrap`
- `appVersion`

## 2. Home - Matchs a venir

### But

Presenter les matchs a venir sous forme de cartes rapides.

### Appel API

- `GET /api/matches/upcoming`

### Champs utiles d'une carte match

- `id`
- `teamHome`
- `teamAway`
- `teamHomeLogo`
- `teamAwayLogo`
- `league`
- `startTimeUnix`
- `statusText`
- `infoText`
- `odds1x2.home`
- `odds1x2.draw`
- `odds1x2.away`
- `betsCount`

### Actions utilisateur

- ouvrir le detail,
- ajouter a la watchlist,
- copier / partager le match,
- filtrer par ligue plus tard.

### Frequence de refresh

- 60 secondes.

## 3. Home - Matchs live

### But

Afficher les matchs en cours.

### Appel API

- `GET /api/matches/live`

### Frequence de refresh

- 15 secondes.

### Particularites

- mettre en avant score et momentum visuel,
- differencier clairement live et pre-match,
- supporter etat vide propre.

## 4. Match Detail

### But

Afficher la fiche complete d'un match avec marches, prediction et top picks.

### Appels API

- principal : `GET /api/matches/:id/details`
- secondaire : `GET /api/predictions/:matchId`

### Utilisation recommandee

- utiliser `/api/matches/:id/details` comme source principale pour l'ecran riche,
- utiliser `/api/predictions/:matchId` comme source complementaire si besoin de structure separee.

### Sections UI

- hero match,
- score / statut / heure,
- cotes 1X2,
- liste des marches,
- bloc prediction maitre,
- top 3 recommandations,
- extra filter / signaux de prudence,
- CTA `Ajouter a la watchlist`,
- CTA `Utiliser dans le coupon`.

### Frequence de refresh

- 10 a 15 secondes si ecran visible,
- stop refresh quand l'app passe en background.

## 5. Coupon Builder

### But

Generer un coupon simple, le valider, l'exporter et l'ajouter aux favoris.

### Appels API

- `POST /api/coupon/generate`
- `POST /api/coupon/validate`
- `POST /api/coupon/favorite`
- `POST /api/coupon/image`
- `POST /api/coupon/pdf`
- `POST /api/coupon/send-telegram`

### Champs de generation

- `size`
- `league`
- `risk`
- `stake`

### Reponse attendue

- `coupon.id`
- `coupon.matches[]`
- `coupon.config`
- `coupon.calculated.totalOdds`
- `coupon.calculated.potentialWin`
- `coupon.timestamp`

### Regles UI

- tolerer `odds = null` si l'API en renvoie parfois,
- ne jamais promettre un gain,
- afficher risque et avertissements,
- permettre ajout aux favoris,
- partager le coupon en texte/image/PDF.

## 6. Favoris et Historique

### But

Regrouper les coupons enregistres et l'historique disponible.

### Appels API

- `GET /api/coupon/favorites?userId=...`
- `POST /api/coupon/favorite`
- `GET /api/coupon/history?limit=20`
- `GET /api/coupon/:id`

### Sections UI

- favoris utilisateur,
- historique recent,
- detail d'un coupon,
- action `rejouer ce coupon`,
- action `exporter`.

## 7. Watchlist synchronisee

### But

Permettre a l'utilisateur de suivre des matchs entre web et mobile.

### Appels API

- `GET /api/watchlist?userId=...`
- `POST /api/watchlist`

### Regles

- stocker des `matchIds` sous forme de chaines,
- faire un sync au lancement,
- sync apres chaque ajout/suppression,
- garder aussi une copie locale Room/DataStore.

## 8. Chat IA

### But

Permettre des questions libres sur le site, les matchs et les actions de navigation.

### Appel API

- `POST /api/chat`

### Payload minimal

- `message`
- `history[]`
- `context.page`
- `context.matchId`
- `context.league`

### Reponse utile

- `answer`
- `actions[]`
- `provider`
- `model`

### UX

- discussion en style messagerie,
- scroll automatique,
- affichage etat `en cours`,
- bouton retry,
- historique conserve localement.

## 9. Settings

### But

Centraliser les reglages mobiles.

### Preferences a prevoir

- langue future,
- theme futur,
- intervalle refresh,
- mode economie data,
- autorisation notifications,
- identifiants techniques visibles en debug,
- version de l'app,
- version API.

## 10. Premium / Auth reserve

Pas obligatoire pour le prototype, mais l'architecture doit prevoir :

- login,
- plan gratuit / premium,
- limitation par role,
- ecran paywall,
- ecran achat/restauration abonnement.

## Contrats API a respecter

## Bootstrap mobile

### Endpoint

- `GET /api/mobile/bootstrap`

### Utilite

- recupere le statut de readiness,
- donne le package Android suggere,
- donne la liste des endpoints principaux,
- donne les modules recommandes.

### Exemple simplifie

```json
{
  "success": true,
  "data": {
    "app": {
      "name": "SOLITFIFPRO225",
      "apiVersion": "2026-04-18-android",
      "suggestedAndroidPackage": "com.solitairehack.solitfifpro225",
      "minimumSdk": 26,
      "targetSdk": 35,
      "language": "fr"
    },
    "readiness": {
      "status": "foundation-ready",
      "readyForPrototype": true,
      "readyForProductionRelease": false
    }
  }
}
```

## Device register

### Endpoint

- `POST /api/mobile/devices/register`

### Body

```json
{
  "userId": "android-demo",
  "platform": "android",
  "deviceId": "emu-001",
  "appVersion": "0.1.0",
  "meta": {
    "brand": "Pixel",
    "sdk": 35
  }
}
```

### Reponse simplifiee

```json
{
  "success": true,
  "data": {
    "userId": "android-demo",
    "platform": "android",
    "deviceId": "emu-001",
    "pushTokenRegistered": false,
    "appVersion": "0.1.0"
  }
}
```

## Matchs a venir

### Endpoint

- `GET /api/matches/upcoming`

### Reponse simplifiee

```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "id": 713561156,
        "teamHome": "Club Atletico de Madrid",
        "teamAway": "Manchester City",
        "teamHomeLogo": "/api/logo/180445.png",
        "teamAwayLogo": "/api/logo/202183.png",
        "league": "FC 26. 5x5 Rush. Superligue",
        "startTimeUnix": 1776485400,
        "statusText": "Debut dans 11 minutes",
        "infoText": "Paris avant le debut du jeu",
        "statusCode": 128,
        "odds1x2": {
          "home": 1.944,
          "draw": 6.42,
          "away": 2.45
        },
        "betsCount": 30
      }
    ],
    "total": 40
  }
}
```

## Match detail

### Endpoint

- `GET /api/matches/:id/details`

### Structure utile

- `match`
- `bettingMarkets[]`
- `prediction`

### Reponse simplifiee

```json
{
  "success": true,
  "match": {
    "id": 713561156,
    "teamHome": "Club Atletico de Madrid",
    "teamAway": "Manchester City",
    "league": "FC 26. 5x5 Rush. Superligue",
    "odds1x2": {
      "home": 1.944,
      "draw": 6.42,
      "away": 2.45
    }
  },
  "bettingMarkets": [
    {
      "nom": "1 - Victoire Club Atletico de Madrid",
      "cote": 1.944,
      "type": "1X2"
    }
  ],
  "prediction": {
    "maitre": {},
    "analyse_avancee": {}
  }
}
```

## Coupon generate

### Endpoint

- `POST /api/coupon/generate`

### Body

```json
{
  "size": 2,
  "league": "all",
  "risk": "balanced",
  "stake": 1000
}
```

### Reponse simplifiee

```json
{
  "success": true,
  "data": {
    "coupon": {
      "id": "coupon_1776484853252",
      "matches": [
        {
          "matchId": "713561156",
          "homeTeam": "Club Atletico de Madrid",
          "awayTeam": "Manchester City",
          "league": "FC 26. 5x5 Rush. Superligue",
          "startTime": 1776485400,
          "odds": 1.944,
          "prediction": {
            "recommendation": "1",
            "confidence": 0.75
          }
        }
      ],
      "config": {
        "size": 2,
        "league": "all",
        "risk": "balanced",
        "stake": 1000
      },
      "calculated": {
        "totalOdds": 6.796224,
        "potentialWin": 6796
      }
    }
  }
}
```

## Coupon validate

### Endpoint

- `POST /api/coupon/validate`

### Body minimal recommande

```json
{
  "coupon": {
    "id": "coupon_x",
    "matches": []
  },
  "driftThresholdPercent": 6
}
```

### Regle d'integration

Le developpeur Android doit encapsuler la reponse dans un mapper tolerant, car la route a une structure historique plus riche cote serveur. Il faut donc parser en tolerant :

- `success`
- `data.validation` si present
- sinon utiliser les champs racine retournes par le backend

## Favorites

### Ajout

- `POST /api/coupon/favorite`

### Lecture

- `GET /api/coupon/favorites?userId=android-demo`

### Exemple lecture

```json
{
  "success": true,
  "data": {
    "favorites": [
      {
        "id": 2,
        "createdAt": "2026-04-18 03:59:37",
        "userId": "android-demo",
        "couponId": "coupon-spec",
        "coupon": {
          "id": "coupon-spec"
        }
      }
    ],
    "total": 1,
    "userId": "android-demo"
  }
}
```

## Watchlist

### Sauvegarde

- `POST /api/watchlist`

### Lecture

- `GET /api/watchlist?userId=android-demo-2`

### Exemple sauvegarde

```json
{
  "userId": "android-demo-2",
  "matchIds": ["713561156"],
  "snapshot": {
    "source": "android",
    "count": 1
  }
}
```

### Exemple reponse

```json
{
  "success": true,
  "data": {
    "watchlist": ["713561156"],
    "total": 1,
    "userId": "android-demo-2",
    "snapshot": {
      "source": "android",
      "count": 1
    },
    "updatedAt": "2026-04-18 03:59:55"
  }
}
```

## Chat

### Endpoint

- `POST /api/chat`

### Body minimal

```json
{
  "message": "Analyse ce match",
  "history": [
    {
      "role": "user",
      "text": "Salut"
    }
  ],
  "context": {
    "page": "match",
    "matchId": "713561156",
    "league": "FC 26. 5x5 Rush. Superligue"
  }
}
```

### Reponse a gerer

- `success`
- `answer`
- `actions[]`
- `provider`
- `model`

## Exports

### Image

- `POST /api/coupon/image`
- `POST /api/coupon/image/story`
- `POST /api/coupon/image/premium`

### PDF

- `POST /api/coupon/pdf`
- `POST /api/coupon/pdf/summary`
- `POST /api/coupon/pdf/detailed`
- `POST /api/coupon/pdf/quick`

### Telegram

- `POST /api/coupon/send-telegram`

### Regle Android

Ces endpoints doivent etre geres comme des telechargements de fichier ou des actions de partage, pas comme des reponses JSON classiques.

## Modeles Kotlin a prevoir

Minimum recommande :

- `AppBootstrapDto`
- `HealthDto`
- `MatchCardDto`
- `MatchDetailsDto`
- `BettingMarketDto`
- `PredictionDto`
- `CouponDto`
- `CouponMatchDto`
- `CouponValidationDto`
- `FavoriteDto`
- `WatchlistDto`
- `ChatMessageDto`
- `ChatResponseDto`
- `DeviceRegistrationDto`

## Strategie de cache

### Cache Room

- matchs upcoming,
- matchs live,
- detail match recent,
- favoris,
- watchlist,
- historique coupons.

### Cache DataStore

- `userId`
- `deviceId`
- `refreshInterval`
- `lowDataMode`
- `lastBootstrapJson`

### TTL recommandes

- bootstrap : 24h
- upcoming : 60s
- live : 15s
- match detail : 15s
- favorites : 5 min
- watchlist : sync immediate + fallback local

## Gestion reseau et erreurs

Le developpeur Android doit prevoir :

- timeout propre,
- retry manuel,
- etat vide,
- etat hors ligne,
- erreurs API avec message lisible,
- parsing tolerant quand le backend retourne des formes historiques.

## Gestion des images

- utiliser Coil,
- supporter `teamHomeLogo` et `teamAwayLogo`,
- si echec image, afficher `teamHomeLogoFallback` ou `teamAwayLogoFallback`,
- placeholder local recommande.

## Polling et cycle de vie

Recommandation :

- polling uniquement quand l'ecran est visible,
- stop polling quand app en background,
- utiliser WorkManager uniquement pour sync non critique,
- eviter le polling agressif sur ecran non visible.

## Notifications push - phase suivante

Quand FCM sera ajoute cote backend, prevoir :

- topic `live`,
- topic `coupon`,
- alertes match start,
- alertes drift,
- alertes coupon premium,
- deep links vers match detail ou coupon.

## Premium / Billing - phase suivante

Quand billing sera ajoute :

- verifier achat cote serveur,
- synchroniser statut premium au lancement,
- paywall pour export premium / outils avances / push premium.

## Tests attendus

Le developpeur Android doit livrer au minimum :

- tests unitaires ViewModel,
- tests repository sur parsing API,
- tests UI sur Home, Match detail et Coupon,
- verification manuelle offline,
- verification rotation ecran,
- verification erreurs reseau.

## Critere d'acceptation

Le prototype est valide si :

1. L'app demarre et charge le bootstrap sans crash.
2. Les matchs upcoming et live s'affichent.
3. Le detail match s'ouvre et affiche marches + prediction.
4. Un coupon peut etre genere.
5. Un coupon peut etre ajoute aux favoris.
6. La watchlist se synchronise.
7. Le chat repond.
8. Le cache local evite un ecran vide apres un premier chargement.

## Limites backend connues

- pas de vraie auth,
- pas de push FCM actif,
- pas de billing,
- `coupon/validate` doit etre parse en tolerant,
- le lint frontend global du repo a encore des erreurs historiques sans rapport direct avec ce cahier des charges.

## Ordre de developpement recommande

### Sprint 1

- bootstrap,
- home upcoming/live,
- detail match,
- cache local.

### Sprint 2

- coupon builder,
- favoris,
- watchlist,
- exports.

### Sprint 3

- chat,
- settings,
- polish UX,
- APK prototype.

### Sprint 4

- auth,
- push,
- premium,
- publication.

## Fichiers backend de reference

- [server.js](/c:/Users/HP/Downloads/oracpr-main/server.js:46)
- [services/liveFeed.js](/c:/Users/HP/Downloads/oracpr-main/services/liveFeed.js:335)
- [services/db.js](/c:/Users/HP/Downloads/oracpr-main/services/db.js:642)
- [ANDROID_INTEGRATION_GUIDE.md](/c:/Users/HP/Downloads/oracpr-main/ANDROID_INTEGRATION_GUIDE.md:3)
- [docs/android-api.openapi.json](/c:/Users/HP/Downloads/oracpr-main/docs/android-api.openapi.json:2)

## Conclusion

Ce document doit etre donne tel quel au developpeur Android comme base d'execution.

Pour une application Android payante vraiment exploitable en production, la prochaine etape backend a financer en priorite reste :

1. auth,
2. push,
3. premium billing,
4. securite production.
