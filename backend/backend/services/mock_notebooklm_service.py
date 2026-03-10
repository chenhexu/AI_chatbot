"""
Mock NotebookLM Service for testing UI rendering with various response types.

This service returns predefined responses based on keywords in the question,
allowing comprehensive testing of the frontend's markdown rendering capabilities.
"""
from typing import Dict, Any

from backend.utils.logger import logger
from backend.utils.constants import ResponseKeys, SourceLabels


class MockNotebookLMService:
    """Mock service that mimics NotebookLM responses for UI testing"""

    # Keyword to response method mapping
    RESPONSE_KEYWORDS = {
        "table": "_table_response",
        "list": "_list_response",
        "format": "_format_response",
        "image": "_image_response",
        "photo": "_image_response",
        "quote": "_quote_response",
        "code": "_code_response",
        "header": "_header_response",
    }

    def __init__(self):
        """Initialize the mock service"""
        logger.info("🎭 Mock NotebookLM Service initialized")

    def query(self, question: str) -> Dict[str, Any]:
        """
        Return mock responses based on keywords in the question

        Args:
            question: The question to ask (used for keyword detection)

        Returns:
            Dict containing answer, sources, and language
        """
        question_lower = question.lower()

        # Detect response type based on keywords
        for keyword, method_name in self.RESPONSE_KEYWORDS.items():
            if keyword in question_lower:
                return getattr(self, method_name)()

        return self._default_response(question)

    def _build_response(self, answer: str) -> Dict[str, Any]:
        """Build a standard response dict with the given answer."""
        return {
            ResponseKeys.ANSWER: answer,
            ResponseKeys.SOURCES: [SourceLabels.MOCK_SERVICE],
            ResponseKeys.LANGUAGE: "fr",
        }

    def _table_response(self) -> Dict[str, Any]:
        """Return a markdown table"""
        answer = """Voici les horaires des cours au Collège Saint-Louis :

| Jour | Heure | Matière | Professeur | Salle |
|------|-------|---------|------------|-------|
| Lundi | 08:00-10:00 | Mathématiques | M. Dupont | 201 |
| Lundi | 10:15-12:00 | Français | Mme. Martin | 105 |
| Lundi | 14:00-16:00 | Histoire | M. Bernard | 302 |
| Mardi | 08:00-10:00 | Physique | Mme. Petit | Lab 1 |
| Mardi | 10:15-12:00 | Anglais | M. Johnson | 204 |

**Note** : Les cours du mercredi après-midi sont consacrés aux activités sportives.

*Les horaires peuvent être modifiés en cas de nécessité.*"""
        return self._build_response(answer)

    def _list_response(self) -> Dict[str, Any]:
        """Return ordered and unordered lists"""
        answer = """### Documents requis pour l'inscription

Pour vous inscrire au Collège Saint-Louis, veuillez fournir les documents suivants :

#### Documents obligatoires :
- Formulaire d'inscription dûment rempli
- Certificat de naissance
- Relevé de notes de l'année précédente
- Photos d'identité (2 copies)
- Justificatif de domicile

#### Démarches à suivre :

1. Prendre rendez-vous avec le secrétariat
2. Soumettre tous les documents requis
3. Passer l'entretien d'évaluation
4. Attendre la confirmation d'admission
5. Finaliser l'inscription administrative

##### Informations complémentaires :

- Les dossiers doivent être déposés **avant le 31 mai**
- Les frais d'inscription s'élèvent à *150 euros*
- Pour toute question : contact@saintlouis.edu"""
        return self._build_response(answer)

    def _format_response(self) -> Dict[str, Any]:
        """Return text with various formatting"""
        answer = """# Bienvenue au Collège Saint-Louis !

Nous sommes ravis de vous accueillir dans notre établissement d'excellence.

## Notre mission

Le **Collège Saint-Louis** s'engage à fournir une éducation de qualité supérieure. Notre *approche pédagogique innovante* combine :

- Rigueur académique
- Ouverture d'esprit
- Excellence sportive

### Programmes spéciaux

Nous offrons des programmes en `langues étrangères` et en **sciences avancées**.

> L'éducation est l'arme la plus puissante pour changer le monde.
> _Nelson Mandela_

Les élèves peuvent participer à des ***échanges internationaux*** et à des projets de recherche.

---
*Pour plus d'informations, visitez notre site web*"""
        return self._build_response(answer)

    def _image_response(self) -> Dict[str, Any]:
        """Return markdown with images"""
        answer = """# Campus du Collège Saint-Louis

Notre campus offre un environnement d'apprentissage exceptionnel.

## Bâtiments et installations

![Bâtiment principal](https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600)

Le **bâtiment principal** abrite les salles de classe et les laboratoires.


![Bibliothèque](https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600)

Notre *bibliothèque moderne* dispose de plus de 10 000 ouvrages.


## Espaces extérieurs

![Campus extérieur](https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600)

Les étudiants peuvent se détendre dans nos **espaces verts** entre les cours.

---

*Photos illustratives du campus*"""
        return self._build_response(answer)

    def _quote_response(self) -> Dict[str, Any]:
        """Return blockquotes and nested quotes"""
        answer = """# Citations inspirantes

Voici quelques citations qui guident notre philosophie éducative :

## sur l'éducation

> L'éducation est ce qui reste après avoir oublié ce qu'on a appris à l'école.
>
> — *Albert Einstein*

## Sur la connaissance

> La connaissance est la seule chose qui s'accroît quand on la partage.
>
> > La véritable éducation consiste à tirer le meilleur de soi-même.
> >
> > — *Mahatma Gandhi*

## Notre engagement

> Au Collège Saint-Louis, nous croyons que chaque élève a le potentiel de devenir un leader de demain.
>
> Cette conviction guide chacune de nos actions éducatives.

---
*Ces citations inspirent notre communauté chaque jour.*"""
        return self._build_response(answer)

    def _code_response(self) -> Dict[str, Any]:
        """Return code blocks"""
        answer = """# Ressources informatiques

## Connexion au réseau

Pour vous connecter au Wi-Fi du collège, utilisez le script suivant :

```bash
#!/bin/bash
# Script de connexion au réseau étudiant

SSID="saintlouis-etudiant"
echo "Connexion au réseau $SSID..."
nmcli dev wifi connect "$SSID"
echo "Connexion établie !"
```

## Configuration Python

Voici un exemple de configuration pour les projets informatiques :

```python
import os
from typing import Dict, List

class StudentConfig:
    '''Configuration élève'''

    def __init__(self, student_id: str):
        self.student_id = student_id
        self.courses: List[str] = []
        self.grades: Dict[str, float] = {}

    def add_course(self, course_name: str) -> None:
        '''Ajouter un cours'''
        self.courses.append(course_name)
        print(f"Cours ajouté : {course_name}")

# Utilisation
config = StudentConfig("STU2024-001")
config.add_course("Mathématiques")
```

## Formules mathématiques

Les étudiants utilisent également des formules LaTeX :

```
E = mc²
∫(0→∞) e^(-x²) dx = √π / 2
```

---
*Documentation technique du collège*"""
        return self._build_response(answer)

    def _header_response(self) -> Dict[str, Any]:
        """Return various header levels"""
        answer = """# Guide de l'étudiant
## Collège Saint-Louis - 2024

### Règlement intérieur

#### 1. Assiduité et ponctualité

##### Présence aux cours

La présence à tous les cours est **obligatoire**. En cas d'absence :

- Avertir le secrétariat avant 8h00
- Fournir un justificatif écrit
- Rattraper les cours manqués

###### Procédure de justification

1. Télécharger le formulaire
2. Le faire signer par les parents
3. Le déposer au secrétariat

### 2. Comportement

#### Respect et discipline

##### Relations élèves-professeurs

Les élèves doivent :
- Être respectueux
- Participer activement
- Remettre les travaux à temps

---

**Note importante** : Tout manquement au règlement peut entraîner des sanctions.

*Pour le détail complet, consultez le carnet de correspondance.*"""
        return self._build_response(answer)

    def _default_response(self, question: str) -> Dict[str, Any]:
        """Return a default plain text response"""
        answer = f"""# Bienvenue au Collège Saint-Louis !

Merci pour votre question : **{question[:50]}{'...' if len(question) > 50 else ''}**

Je suis là pour vous aider à trouver des informations sur notre établissement.

## Que puis-je faire pour vous ?

- Répondre à vos questions sur les programmes
- Fournir des informations sur l'admission
- Expliquer les horaires et les cours
- Donner des détails sur les activités extrascolaires

**N'hésitez pas à poser vos questions !**

---

> Le Collège Saint-Louis, un établissement d'excellence depuis 1950.

*Pour des réponses spécifiques, essayez d'inclure des mots-clés comme : "table", "list", "format", "image", "quote", "code", ou "header" pour voir différents types de réponses.*"""
        return self._build_response(answer)
