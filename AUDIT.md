# Audit Foxpile Companion 1.1.0

Date: 14 juin 2026

## Conclusion

La refactorisation demandee est fonctionnelle et le build Windows complet passe.
L'application principale est maintenant un SEA Node 24 unique nomme
`Foxpile Companion.exe`, marque comme application Windows GUI. Le launcher Go
et `Foxpile Companion.core.exe` ont ete supprimes. L'updater reste en Go.

Le depot `nodejs-sea-hide-passthrough` n'a volontairement pas ete embarque:
son executable est un launcher qui demarre un second executable SEA, ce qui
recreerait l'architecture a deux processus que cette version doit supprimer.
La modification equivalente est appliquee directement au champ `Subsystem` du
PE final, apres l'injection `postject`. Les executables Windows de `systray2`
sont egalement convertis en applications GUI pour eviter leur bref affichage
et toute prise de focus au demarrage.

## Nouveautes livrees

- Migration complete du compagnon de JavaScript vers TypeScript strict.
- Organisation de `src` par domaines: `app`, `auth`, `core`, `game`, `saves`,
  `ui` et `updates`.
- Bundle `esbuild`, blob SEA, copie du runtime Node, injection `postject`, puis
  conversion du SEA final vers le subsystem Windows GUI.
- Verification automatique du subsystem GUI et du fuse SEA pendant le build.
- Verification du subsystem GUI des deux executables `systray2` embarques.
- Nouvelle tentative automatique de l'injection SEA lorsqu'un scanner Windows
  conserve temporairement le PE apres `rcedit`.
- Suppression de `tools/windows-launcher.go` et de toute sortie `.core.exe`.
- Conservation de `tools/windows-updater.go` avec metadonnees Windows 1.1.0.
- Nettoyage par Inno Setup des anciens fichiers 1.0.4 devenus inutiles.
- Service de demarrage Windows utilisant
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
- Menu systray `Start with Windows`, modifie uniquement sur action explicite.
- Aucune recreation automatique de la valeur de demarrage au lancement ou
  pendant une mise a jour.
- Verification SHA-256 de l'installateur telecharge a partir du digest publie
  par GitHub Releases avant son execution.
- CI separee des releases et workflow de release declenche uniquement par un
  tag semantique `v*.*.*`.
- Checkout de la reference exacte du tag, controle de concordance entre le tag
  et `package.json`, et verification que le commit tague appartient a `main`.
- Actions GitHub officielles mises a jour sur leurs versions majeures courantes.

## Migration 1.0.4 vers 1.1.0

Le chemin de mise a jour est compatible:

1. Le compagnon 1.0.4 lance son updater Go en lui transmettant le PID du
   `.core.exe` et le chemin `Foxpile Companion.exe`.
2. L'updater attend la fin de l'ancien coeur, puis lance silencieusement
   l'installateur 1.1.0.
3. Inno Setup reutilise la meme identite d'application et le meme repertoire.
4. L'ancien launcher est remplace par le nouveau SEA portant exactement le
   meme nom.
5. `Foxpile Companion.core.exe` et les anciens binaires tray non-Windows sont
   supprimes.
6. L'updater 1.0.4 redemarre le chemin historique, qui designe desormais le SEA
   1.1.0.

Le compagnon 1.1.0 continue aussi d'utiliser l'argument historique
`--launcher` lorsqu'il invoque l'updater, afin qu'un updater 1.0.4 deja present
reste utilisable pendant la transition. Le nouvel updater accepte
`--launcher` et `--companion`.

## Verification

- `npm run typecheck`: succes.
- `npm test`: 14 tests reussis.
- `npm audit --audit-level=high`: 0 vulnerabilite.
- `actionlint` 1.7.7: succes.
- `git diff --check`: aucune erreur.
- `npm run build:windows`: succes avec Node 24.11.1 et Inno Setup 6.7.1.
- `Foxpile Companion.exe`: version 1.1.0, subsystem GUI 2, fuse SEA present.
- `Foxpile Companion Updater.exe`: version 1.1.0, subsystem GUI 2.
- `Foxpile Companion Setup.exe`: version 1.1.0, subsystem GUI 2.
- Aucun `Foxpile Companion.core.exe` n'est genere.
- Seuls les binaires systray Windows necessaires sont inclus.

## Constats residuels

### Eleve - secret partage extractible

`FOXPILE_COMPANION_SECRET` est injecte dans le bundle distribue et sert a
calculer un HMAC. Un utilisateur pouvant lire l'executable peut extraire ce
secret. Il ne faut donc pas le considerer comme une preuve forte qu'une requete
provient d'un client de confiance.

Une correction solide demande une evolution du protocole cote API: enrolement
par appareil, cle propre a chaque installation, rotation et revocation, ou
autre mecanisme d'identite serveur. Ce point ne peut pas etre resolu uniquement
par de l'obfuscation dans le compagnon.

### Moyen - executables non signes

Le SEA, l'updater et l'installateur produits ne possedent pas de signature
Authenticode. La verification SHA-256 du digest GitHub protege le telechargement
contre une alteration accidentelle ou intermediaire, mais ne remplace pas une
signature avec un certificat de confiance.

La prochaine amelioration de distribution devrait signer les trois artefacts
dans le workflow de release, puis verifier leur signature avant publication.

### Moyen - migration non executee sur une installation reelle

Le contrat de migration et les artefacts ont ete verifies statiquement, mais
aucune mise a niveau destructive d'une installation 1.0.4 reelle n'a ete
executee sur cette machine. Un test de release en VM Windows propre reste
necessaire avant publication.

### Faible - etat Windows StartupApproved

Le menu reflete la presence de la valeur `Run`. Windows peut desactiver une
application dans le Gestionnaire des taches via `StartupApproved` sans
supprimer cette valeur. Le compagnon ne la recree pas et une mise a jour ne la
reactive pas, mais la case du menu peut alors rester cochee.

### Faible - durcissement de la chaine CI

Les actions officielles sont referencees par versions majeures. Pour une chaine
de publication a exigence maximale, elles peuvent etre epinglees par SHA de
commit et mises a jour par Dependabot.

## Artefacts audites

- `Foxpile Companion.exe`:
  `9543DEACB81ED14E0FFFB6BFF4F3F63CD72408A87A949E2FD5F3B676E7C3CE04`
- `Foxpile Companion Updater.exe`:
  `F8C27A39E090D1E5AAC733840E51386C8C43B773F2FBF475940E7793052B1912`
- `Foxpile Companion Setup.exe`:
  `6C69CEF7A81BFFCB075F6D117B83B4670EA29F703F95A606BC4B48A8561B53C4`

Ces sommes correspondent au build local du 14 juin 2026 et changeront lors
d'un nouveau build.
