/**
 * Mock NotebookLM service for testing
 * Provides realistic responses based on query patterns
 */

interface MockResponse {
  answer: string;
  latency?: number;
}

export class MockNotebookLMService {
  private responses: Map<string, MockResponse>;

  constructor() {
    this.responses = new Map();
    this.initializeResponses();
  }

  private initializeResponses() {
    // Table responses
    this.responses.set('programme', {
      answer: `
| Programme | Durée | Niveau | Professeur |
|-----------|-------|--------|------------|
| Mathématiques | 4h/sem | Avancé | M. Dupont |
| Français | 3h/sem | Intermédiaire | Mme. Martin |
| Anglais | 3h/sem | Intermédiaire | M. Smith |
| Histoire-Géo | 2h/sem | Débutant | Mme. Dubois |
| Sciences | 3h/sem | Avancé | M. Bernard |
      `.trim(),
      latency: 500,
    });

    this.responses.set('tarifs', {
      answer: `
| Type de frais | Montant | Fréquence | Notes |
|---------------|---------|-----------|-------|
| Inscription | 150€ | Annuel | Non remboursable |
| Scolarité | 1200€ | Mensuel | Septembre à Juin |
| Cantines | 5€ | Repas | Optionnel |
| Activités | 50€ | Mensuel | Clubs et ateliers |
      `.trim(),
      latency: 400,
    });

    this.responses.set('horaires', {
      answer: `
| Jour | Ouverture | Fermeture | Pause déjeuner |
|------|-----------|-----------|----------------|
| Lundi | 8h00 | 17h30 | 12h00-13h30 |
| Mardi | 8h00 | 17h30 | 12h00-13h30 |
| Mercredi | 8h00 | 16h00 | 12h00-13h30 |
| Jeudi | 8h00 | 17h30 | 12h00-13h30 |
| Vendredi | 8h00 | 16h30 | 12h00-13h30 |
      `.trim(),
      latency: 300,
    });

    // List responses
    this.responses.set('inscription', {
      answer: `
## Procédure d'inscription

Pour inscrire votre enfant au Collège Saint-Louis, suivez ces étapes:

1. **Télécharger le formulaire** d'inscription depuis notre site web
2. **Remplir** toutes les sections requises
3. **Fournir les documents suivants:**
   - Certificat de naissance
   - Bulletins scolaires des 2 dernières années
   - Justificatif de domicile
   - Photos d'identité (2)
4. **Passer l'entretien** avec la direction
5. **Payer les frais** d'inscription
6. **Recevoir la confirmation** par email

⚠️ **Attention:** Le délai de traitement est de 2 semaines.
      `.trim(),
      latency: 600,
    });

    this.responses.set('documents', {
      answer: `
## Documents requis

### Pour l'inscription:
- Certificat de naissance (copie certifiée)
- Livret de famille
- Carnet de santé (pages vaccinations)

### Pour la scolarité:
- Justificatif de domicile (moins de 3 mois)
- Assurance scolaire obligatoire
- Fiche de renseignements complétée
- Autorisation de sortie signée
      `.trim(),
      latency: 400,
    });

    this.responses.set('classe', {
      answer: `
## Niveaux d'enseignement

### Primaire:
- CP (Cours Préparatoire)
- CE1 (Cours Élémentaire 1)
- CE2 (Cours Élémentaire 2)
- CM1 (Cours Moyen 1)
- CM2 (Cours Moyen 2)

### Collège:
- **6ème**: Cycle d'adaptation
- **5ème**: Cycle central
- **4ème**: Cycle central
- **3ème**: Cycle d'orientation

### Options disponibles:
- Langues: Anglais, Allemand, Espagnol
- Options: Latin, Grec, Langue vivante 3
      `.trim(),
      latency: 500,
    });

    // Formatted text responses
    this.responses.set('presentation', {
      answer: `
# Collège Saint-Louis

## Bienvenue dans notre établissement

Le **Collège Saint-Louis** est un établissement d'excellence fondé en *1965*. Nous accueillons les élèves de la **6ème à la 3ème** dans un cadre *stimulant et bienveillant*.

### Nos valeurs:
- **Excellence académique**
- **Ouverture d'esprit**
- **Respect et tolérance**
- **Engagement communautaire**

> "L'éducation est la base de tout succès durable."

Pour plus d'informations, visitez [notre site web](https://saint-louis.fr).
      `.trim(),
      latency: 350,
    });

    // Code responses
    this.responses.set('code', {
      answer: `
Voici un exemple de code Python:

\`\`\`python
def eleve(nom, classe, moyenne):
    return {
        "nom": nom,
        "classe": classe,
        "moyenne": moyenne,
        "mention": "Excellent" if moyenne >= 16 else "Bien"
    }

# Créer un élève
etudiant = eleve("Marie Dupont", "3ème", 17.5)
print(f"{etudiant['nom']} - {etudiant['mention']}")
\`\`\`

Et en JavaScript:

\`\`\`javascript
const eleve = (nom, classe, moyenne) => ({
    nom,
    classe,
    moyenne,
    mention: moyenne >= 16 ? "Excellent" : "Bien"
});

const etudiant = eleve("Marie Dupont", "3ème", 17.5);
console.log(\`\${etudiant.nom} - \${etudiant.mention}\`);
\`\`\`
      `.trim(),
      latency: 700,
    });

    // Mixed content
    this.responses.set('complet', {
      answer: `
# Informations complètes

## Présentation
Le Collège Saint-Louis offre un enseignement de qualité depuis 1965.

## Programmes
| Matière | Durée | Niveau |
|---------|-------|--------|
| Maths | 4h | Avancé |
| Français | 3h | Intermédiaire |

### Comment s'inscrire:
1. Télécharger le formulaire
2. Remplir les informations
3. Envoyer les documents
4. Passer l'entretien

> "L'excellence est notre priorité"

Plus d'infos sur [saint-louis.fr](https://saint-louis.fr)

### Langues:
- Anglais (débutant 6ème)
- Allemand (option 4ème)
- Espagnol (option 4ème)

\`\`\`bash
# Pour télécharger le dossier:
curl https://saint-louis.fr/dossier.pdf -o dossier.pdf
\`\`\`
      `.trim(),
      latency: 800,
    });

    // Default response
    this.responses.set('default', {
      answer: `
Je suis l'assistant du Collège Saint-Louis. Je peux vous aider avec:

- **Programmes scolaires**: Horaires, matières, options
- **Inscription**: Procédure, documents, tarifs
- **Vie scolaire**: Règlement, activités, services
- **Contact**: Coordonnées, rendez-vous

Posez-moi vos questions!
      `.trim(),
      latency: 300,
    });
  }

  public getResponse(query: string): MockResponse {
    const lowerQuery = query.toLowerCase();

    // Check for keywords and return appropriate response
    for (const [key, response] of this.responses.entries()) {
      if (key === 'default') continue;
      if (lowerQuery.includes(key)) {
        return response;
      }
    }

    // Return default response if no match
    return this.responses.get('default')!;
  }

  public simulateAPI(query: string): Promise<Response> {
    const response = this.getResponse(query);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          json: async () => ({ answer: response.answer }),
        } as Response);
      }, response.latency || 300);
    });
  }
}

// Export singleton instance
export const mockNotebookLM = new MockNotebookLMService();

// Export function to set up global mock
export function setupMockNotebookLM() {
  global.fetch = jest.fn((url: string) => {
    if (url === '/api/chat') {
      // This will be called by the real implementation
      // We need to extract the message from the request body
      return Promise.resolve({
        ok: true,
        json: async () => ({ answer: 'Default response' }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    });
  });
}
