# Tableau de bord Hectare (site web)

Ce dossier est un petit site (React) qui **lit** la même base Firestore que l’app iPad.

## En mots simples

- **Firestore** = un classeur en ligne.
- **Organisation** = le dossier de ton restaurant dans ce classeur (`organizations/...`).
- **Collection** = un tiroir (températures, procédures, etc.).
- **Synchronisé** = dès que l’iPad enregistre, le site écoute et se met à jour tout seul (pas besoin d’actualiser).

## Lancer le site sur ton Mac

Dans le Terminal :

```bash
cd dashboard
cp .env.example .env
# Remplis VITE_FIREBASE_API_KEY et VITE_FIREBASE_APP_ID (appli Web dans Firebase)
npm install
npm run dev
```

Ouvre l’adresse affichée (souvent `http://localhost:5173`).

## Première connexion

1. Firebase → Authentication → ajoute un utilisateur e-mail / mot de passe.
2. Firebase → Firestore (base **hectarecafe**) → collection `dashboardUsers`.
3. Crée un document dont l’ID est l’**UID** de cet utilisateur (visible dans Authentication).
4. Ajoute un champ `organizationId` (texte) = l’ID d’organisation de l’iPad.

Les règles Firestore doivent autoriser cet utilisateur à **lire** `organizations/{organizationId}/...`.

## Mettre le site en ligne avec GitHub

**GitHub** = le coffre-fort du code. À chaque fois que tu envoies (`push`) le dossier `dashboard`, GitHub **fabrique** le site et le met à l’adresse :

`https://TON-PSEUDO.github.io/NOM-DU-REPO/`

Exemple : `https://jaylenjocelyn11.github.io/hectare/`

### Étape A — Créer le dépôt sur github.com

1. Va sur [https://github.com/new](https://github.com/new)
2. Nom : `Hectare` (ou un autre, tu t’en souviendras)
3. Choisis **Public** (Pages gratuit) **ou** Private (Pages privé demande souvent un compte payant)
4. Ne coche pas « Add a README »
5. **Create repository**

### Étape B — Secrets (tes clés, pas dans le code)

1. Dans le repo GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Ajoute :
   - Nom `VITE_FIREBASE_API_KEY` → ta clé API Web Firebase
   - Nom `VITE_FIREBASE_APP_ID` → ton App ID Web (`1:...:web:...`)

### Étape C — Activer GitHub Pages

1. **Settings** → **Pages**
2. **Source** : **GitHub Actions** (pas « Deploy from a branch »)

### Étape D — Envoyer le code

Dans le Terminal (une fois Node et `git` prêts, et après avoir créé `.env` **en local seulement**) :

```bash
cd "/Users/jaylenjocelyn/Documents/Hectare"
git add dashboard .github .gitignore
git commit -m "Ajouter le tableau de bord web et le déploiement GitHub Pages"
git remote add origin https://github.com/TON-PSEUDO/Hectare.git
git branch -M main
git push -u origin main
```

Remplace `TON-PSEUDO` et `Hectare` par ton vrai nom GitHub et le nom du repo.

Ne **jamais** envoyer `.env`, ni le fichier `Untitled.p12` (certificat).

### Étape E — Ouvrir le site

Onglet **Actions** : le job « Publier le tableau de bord » doit devenir vert.  
Puis l’URL Pages (Settings → Pages).

Il te faut toujours l’utilisateur Authentication + `dashboardUsers` (voir plus haut).

**Important :** Firebase → Authentication → Settings → **Authorized domains** → ajoute `TON-PSEUDO.github.io` (sinon la connexion sera refusée).

---

## Autre option : Firebase Hosting (sans GitHub Pages)

Tu obtiens une adresse du type `https://hectarecafe-e0df2.web.app`.

### Avant

1. Node.js installé (`npm` dans le Terminal).
2. Fichier `dashboard/.env` rempli (clé API + App ID **Web**).
3. Un compte e-mail créé dans Authentication, et le document `dashboardUsers`.

### Commandes

```bash
cd dashboard
npm install
npm run build
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

`npm run build` fabrique le site (dossier `dist`).  
`firebase deploy` envoie ce dossier sur les serveurs Google.

### Après le déploiement

Ouvre l’URL affichée dans le Terminal. Connecte-toi avec le même e-mail / mot de passe.

Si tu changes `.env`, refais `npm run build` puis `firebase deploy --only hosting` (les clés sont copiées **au moment** du build).

### Autre hébergeur (Netlify, Vercel)

Même idée : `npm run build` dans `dashboard`, puis envoie le dossier **`dist`**.  
Ajoute une règle « toutes les pages → `index.html` » (site en une page). Sur Vercel / Netlify, mets aussi tes variables `VITE_...` dans les réglages **avant** le build.
