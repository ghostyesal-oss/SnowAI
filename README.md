# SnowAI

Extension Chrome **Snow AI** (Manifest V3) — panneau latéral branché sur un hub (local ou Supabase).

**Dépôt :** https://github.com/ghostyesal-oss/SnowAI

Ce projet est **uniquement l’extension**. Le hub / worker ne sont pas inclus (voir le dépôt [SNOW](https://github.com/ghostyesal-oss/SNOW) pour la démo complète).

## Récupérer le code

```bash
git clone https://github.com/ghostyesal-oss/SnowAI.git
```

## Installer dans Chrome ou Edge

1. Ouvrir `chrome://extensions` (ou `edge://extensions`).
2. Activer **Mode développeur**.
3. **Charger l’extension non empaquetée**.
4. Choisir le dossier cloné (celui qui contient `manifest.json`).

Sur Windows, vous pouvez aussi lancer **`installer-extension.bat`** après le clone.

## Configuration

Clic droit sur l’icône → **Options**, ou menu de l’extension :

| Champ | Défaut | Usage |
|-------|--------|--------|
| URL hub | `http://127.0.0.1:8787` | Hub local (démo SNOW) |
| Clé | `local-demo` | Clé anon Supabase ou jeton démo local |

Hub local : lancer le dépôt **SNOW** (`lancer.bat`) sur la machine où le hub tourne.

## Structure

```text
manifest.json
background.js
app.js / app.css
sidepanel.html
options.html / options.js
icons/
```

## Licence

Usage interne / démo — adaptez avant publication sur le Chrome Web Store.
