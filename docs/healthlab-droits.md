# Activité – À chacun ses droits (HealthLab)

## Contexte

**HealthLab** est une plateforme de gestion des examens biologiques pour les établissements de santé :

- les **professionnels de santé** transmettent les demandes d'analyses ;
- les **équipes de laboratoire** réalisent les analyses et transmettent les résultats ;
- les **patients** ont un portail pour consulter leurs données ;
- chaque analyse est **facturée au patient**.

Objectifs :

1. isoler les ressources ;
2. définir les rôles et leur hiérarchie ;
3. déterminer les droits d'accès aux ressources et aux actions.

> **Hypothèses**
> - La plateforme est utilisée par **plusieurs établissements**. Chaque utilisateur (sauf l'admin plateforme) appartient à un seul établissement.
> - Les données d'analyses sont des **données de santé**. Ce sont des données sensibles (RGPD, art. 9) : on applique donc partout le **principe du moindre privilège**.

---

## 1. Les ressources

| Ressource | URI | Contenu | Rattachée à |
|---|---|---|---|
| **Établissement** | `/establishments/{id}` | nom, adresse, type (hôpital, clinique, laboratoire) | — |
| **Utilisateur** | `/users/{id}` | email, mot de passe haché, rôle | un établissement |
| **Catalogue d'examens** | `/exams/{code}` | code, libellé, tarif | la plateforme |
| **Patient** | `/patients/{id}` | identité, date de naissance, coordonnées, n° de sécurité sociale | un établissement |
| **Demande d'analyse** | `/patients/{id}/requests`, `/requests/{id}` | prescripteur, examens demandés, statut, date | un patient + un médecin |
| **Analyse** | `/requests/{id}/analyses`, `/analyses/{id}` | examen, échantillon, statut | une demande |
| **Résultat** | `/analyses/{id}/result` | valeurs, unités, normes, commentaire, validé par, version | une analyse |
| **Facture** | `/patients/{id}/invoices`, `/invoices/{id}` | lignes (examen, tarif), total, statut | un patient |
| **Paiement** | `/invoices/{id}/payments` | montant, date, moyen | une facture |
| **Journal d'audit** | `/audit-logs` | qui, quoi, quand, sur quelle ressource | un établissement |

**Cycle de vie d'une demande :**

`envoyée` → `prise en charge` → `analyses en cours` → `résultats validés` → `transmise`

### Pourquoi isoler ces ressources

- Le **résultat** est séparé de l'**analyse**. On peut ainsi donner accès au suivi d'une analyse (son statut) sans donner accès au résultat médical. Exemple : le service facturation sait qu'une analyse a été faite, sans voir ses valeurs.
- La **facture** est séparée de la **demande**. La facturation ne manipule que des codes d'examens et des montants, jamais de données médicales.
- Le **patient** (identité) est séparé de ses **demandes** et de ses **résultats**. Un agent peut gérer l'identité ou la facturation sans voir le dossier médical.
- Les données sont **isolées par établissement**. Un utilisateur ne voit jamais les données d'un autre établissement.

---

## 2. Les rôles et leur hiérarchie

| Rôle | Qui | Mission |
|---|---|---|
| `patient` | le patient | consulter ses demandes, ses résultats et ses factures, et payer |
| `medecin` | professionnel de santé prescripteur | créer des demandes d'analyses et lire les résultats de ses patients |
| `technicien` | équipe de laboratoire | prendre en charge les demandes, réaliser les analyses, saisir les résultats |
| `biologiste` | biologiste responsable du laboratoire | tout ce que fait le technicien, **+ valider et transmettre** les résultats |
| `facturation` | service administratif | gérer les factures et les paiements |
| `admin_etablissement` | administrateur de l'établissement | gérer les comptes et les rôles de son établissement |
| `admin_plateforme` | équipe HealthLab | gérer les établissements, le catalogue et les admins d'établissement |

### Hiérarchie

```
admin_plateforme
└── admin_etablissement                 (administration : comptes et rôles)

biologiste                              (laboratoire)
└── technicien

medecin                                 (soins)

facturation                             (administratif)

patient                                 (portail : ses propres données)
```

Les règles de la hiérarchie :

- **Un rôle supérieur hérite des droits du rôle inférieur, mais seulement dans une même branche métier.** Le `biologiste` peut faire tout ce que fait le `technicien`, plus la validation des résultats. L'`admin_plateforme` peut faire tout ce que fait l'`admin_etablissement`, sur tous les établissements.
- **Les admins n'héritent pas des droits médicaux** (séparation des fonctions et moindre privilège). Gérer les comptes ne nécessite pas de lire des résultats d'analyses. Un admin qui a besoin de soigner doit avoir aussi un compte `medecin`.
- **Il n'y a pas de hiérarchie entre les branches.** Un biologiste n'est pas « au-dessus » d'un médecin : ils ne font pas le même travail.
- Le `patient` est à part. Il n'a accès qu'à **ses propres** données.

---

## 3. Les droits d'accès

**Légende :**
- ✅ autorisé, dans la limite de son établissement
- 🔸 autorisé sous condition (voir les notes en dessous du tableau)
- ❌ interdit
- ⚙️ action faite automatiquement par le système, par aucun rôle

### Matrice rôle × ressource × action

| Ressource | Action | patient | medecin | technicien | biologiste | facturation | admin étab. | admin plateforme |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Établissement** | lire | ❌ | ❌ | ❌ | ❌ | ❌ | 🔸 ¹ | ✅ |
| | créer / modifier / supprimer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Utilisateurs** | lire | 🔸 ² | 🔸 ² | 🔸 ² | 🔸 ² | 🔸 ² | ✅ | ✅ |
| | créer / modifier / désactiver | ❌ | ❌ | ❌ | ❌ | ❌ | 🔸 ³ | ✅ |
| **Catalogue d'examens** | lire | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | modifier (examens, tarifs) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Patient** (identité) | lire | 🔸 ⁴ | 🔸 ⁵ | 🔸 ⁶ | 🔸 ⁶ | ✅ | ❌ | ❌ |
| | créer | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| | modifier les coordonnées | 🔸 ⁴ | 🔸 ⁵ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Demande d'analyse** | créer | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | lire | 🔸 ⁴ | 🔸 ⁵ | 🔸 ⁷ | 🔸 ⁷ | ❌ | ❌ | ❌ |
| | modifier / annuler | ❌ | 🔸 ⁸ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | prendre en charge | ❌ | ❌ | 🔸 ⁷ | 🔸 ⁷ | ❌ | ❌ | ❌ |
| **Analyse** (suivi, statut) | lire | 🔸 ⁴ | 🔸 ⁵ | 🔸 ⁷ | 🔸 ⁷ | 🔸 ⁹ | ❌ | ❌ |
| | mettre à jour le statut | ❌ | ❌ | 🔸 ⁷ | 🔸 ⁷ | ❌ | ❌ | ❌ |
| **Résultat** | saisir (brouillon) | ❌ | ❌ | 🔸 ⁷ | 🔸 ⁷ | ❌ | ❌ | ❌ |
| | valider et transmettre | ❌ | ❌ | ❌ | 🔸 ⁷ | ❌ | ❌ | ❌ |
| | lire | 🔸 ¹⁰ | 🔸 ⁵ | 🔸 ⁷ | 🔸 ⁷ | ❌ | ❌ | ❌ |
| | corriger après validation | ❌ | ❌ | ❌ | 🔸 ¹¹ | ❌ | ❌ | ❌ |
| | supprimer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Facture** | générer | ⚙️ ¹² | ⚙️ ¹² | ⚙️ ¹² | ⚙️ ¹² | ⚙️ ¹² | ⚙️ ¹² | ⚙️ ¹² |
| | lire | 🔸 ⁴ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| | annuler (avoir) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| | supprimer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Paiement** | payer en ligne | 🔸 ⁴ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | enregistrer un paiement (guichet) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Journal d'audit** | lire | ❌ | ❌ | ❌ | ❌ | ❌ | 🔸 ¹ | ✅ |

### Conditions

1. Uniquement **son** établissement.
2. Uniquement **son propre** compte (`GET /users/me`).
3. Uniquement les comptes de **son** établissement. Il ne peut pas créer d'admin plateforme ni se donner lui-même un rôle supérieur.
4. Uniquement **ses propres** données : `patient.user_id = utilisateur connecté`.
5. Uniquement les patients pour lesquels il est **prescripteur**, c'est-à-dire qu'il a créé au moins une demande pour ce patient (relation de soin).
6. Identité minimale (nom, date de naissance, sexe), nécessaire pour interpréter les résultats. Uniquement pour les patients ayant une demande adressée à son laboratoire. Pas de coordonnées ni de n° de sécurité sociale.
7. Uniquement les demandes adressées à **son** laboratoire.
8. Uniquement **ses propres** demandes, et seulement tant que le statut est `envoyée` (pas encore prise en charge par le laboratoire).
9. Statut et code d'examen uniquement, **sans le résultat** : c'est ce qui sert à facturer.
10. Uniquement **ses** résultats, et seulement une fois **validés** par un biologiste. Un brouillon n'est jamais visible par le patient.
11. Crée une **nouvelle version** du résultat avec un motif obligatoire. L'ancienne version est conservée et le médecin prescripteur est notifié.
12. ⚙️ Personne ne crée de facture à la main. La **facture est générée par le système** quand une analyse passe au statut « réalisée ».

---

## 4. Règles transverses

- **Le contrôle se fait côté API, à chaque requête.** On ne fait jamais confiance au client : le rôle, l'id utilisateur et l'id d'établissement viennent du **jeton signé**, pas du corps de la requête.
- **Trois niveaux de contrôle**, comme dans le cours :
  1. **le type de ressource** : un rôle `facturation` n'a aucune route sur `/analyses/{id}/result` → **403** ;
  2. **la ressource spécifique** : ce patient appartient-il à mon établissement ? Suis-je son prescripteur ? → **404** sinon ;
  3. **l'action** : un `technicien` peut saisir un résultat mais pas le valider → **403**.
- **On répond 404 plutôt que 403** sur une ressource qui appartient à quelqu'un d'autre. Par exemple, `GET /patients/42` par un médecin qui n'est pas son prescripteur renvoie 404. On ne révèle pas qu'un patient existe dans la base.
- **Rien n'est supprimé pour de vrai** :
  - les résultats sont versionnés ;
  - les factures sont annulées par un avoir ;
  - les comptes sont désactivés, pas supprimés.
  
  Ce sont des obligations légales, et c'est aussi ce qui permet de garder une trace.
- **Chaque accès à une donnée de santé est journalisé** (journal d'audit) : qui a lu quel résultat, et quand.
- **Moindre privilège** : un rôle n'a que les droits dont il a besoin pour sa mission. Par exemple, les admins n'ont aucun accès médical.

---

## 5. Exemples de cas à vérifier

| Requête | Utilisateur | Réponse attendue |
|---|---|---|
| `POST /patients/12/requests` | medecin | **201** |
| `POST /patients/12/requests` | technicien | **403** (rôle) |
| `GET /patients/12` | medecin qui n'est pas prescripteur du patient 12 | **404** (ressource d'un autre) |
| `PATCH /requests/5` (demande `prise en charge`) | medecin auteur de la demande | **409** (statut ne permet plus la modification) |
| `POST /analyses/8/result` | technicien du labo concerné | **201** (brouillon) |
| `POST /analyses/8/result/validate` | technicien | **403** (action réservée au biologiste) |
| `POST /analyses/8/result/validate` | biologiste du labo concerné | **200** |
| `GET /analyses/8/result` | patient concerné, résultat non validé | **404** |
| `GET /analyses/8/result` | facturation | **403** (rôle) |
| `GET /invoices/3` | patient propriétaire | **200** |
| `GET /invoices/3` | autre patient | **404** |
| `DELETE /invoices/3` | facturation | **405** (aucune suppression, on fait un avoir) |
| `GET /patients/12` | admin_etablissement | **403** (pas d'accès aux données médicales) |
| n'importe quelle route protégée | sans jeton / jeton expiré | **401** |

---

## 6. Lien avec notre API produits

On retrouve les mêmes mécanismes que dans l'activité « Les rôles en action » ([auth.js](../auth.js), [index.js](../index.js)) :

| HealthLab | API produits |
|---|---|
| contrôle du rôle (`technicien` ne valide pas) | `authorize('manager', 'admin')` → 403 |
| contrôle de la ressource (médecin = prescripteur) | `checkOwnership` : le manager ne modifie que les produits dont il est `created_by` |
| identité tirée du jeton signé | `req.user = { id, role }` lu dans le JWT |
| hiérarchie biologiste ⊃ technicien | admin ⊃ manager ⊃ client |
