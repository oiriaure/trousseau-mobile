// Catalogue des services d'API et des messageries (partagé entre le cœur et l'écran).
(function (racine) {
  // Ordre important pour la détection : les motifs les plus précis d'abord.
  const B = '(?<![A-Za-z0-9_\\-])', F = '(?![A-Za-z0-9_\\-])';
  const SERVICES = [
    { id: 'gemini', nom: 'Google Gemini', court: 'Gemini', couleur: '#4285F4', lettre: 'G', icone: 'ic-gemini.png', env: 'GEMINI_API_KEY',
      page: 'https://aistudio.google.com/apikey', motif: new RegExp(B + '(?:AIza[0-9A-Za-z_\\-]{35}|AQ\\.[A-Za-z0-9_\\-]{40,})' + F),
      etapes: ['Connecte-toi avec cette adresse si on te le demande', 'Clique sur « Create API key » (« Créer une clé API »)', 'Clique sur l’icône Copier à côté de la clé'] },
    { id: 'anthropic', nom: 'Anthropic (Claude)', court: 'Claude', couleur: '#D97757', lettre: 'A', icone: 'ic-anthropic.png', env: 'ANTHROPIC_API_KEY',
      page: 'https://console.anthropic.com/settings/keys', motif: new RegExp(B + 'sk-ant-[A-Za-z0-9_\\-]{20,}'),
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « Create Key » et donne-lui un nom', 'Copie la clé affichée (elle ne s’affiche qu’une fois)'] },
    { id: 'openrouter', nom: 'OpenRouter', court: 'OpenRouter', couleur: '#6467F2', lettre: 'R', env: 'OPENROUTER_API_KEY',
      page: 'https://openrouter.ai/settings/keys', motif: new RegExp(B + 'sk-or-v1-[A-Za-z0-9]{40,}'),
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « Create Key »', 'Copie la clé'] },
    { id: 'deepseek', nom: 'DeepSeek', court: 'DeepSeek', couleur: '#4D6BFE', lettre: 'D', env: 'DEEPSEEK_API_KEY',
      page: 'https://platform.deepseek.com/api_keys', motif: new RegExp(B + 'sk-[a-f0-9]{32}' + F),
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « Create new API key »', 'Copie la clé'] },
    { id: 'openai', nom: 'OpenAI (ChatGPT)', court: 'OpenAI', couleur: '#10A37F', lettre: 'O', env: 'OPENAI_API_KEY',
      page: 'https://platform.openai.com/api-keys', motif: new RegExp(B + 'sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_\\-]{20,}'),
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « Create new secret key »', 'Clique sur « Copy » (elle ne s’affiche qu’une fois)'] },
    { id: 'xai', nom: 'xAI (Grok)', court: 'Grok', couleur: '#111827', lettre: 'X', env: 'XAI_API_KEY',
      page: 'https://console.x.ai', motif: new RegExp(B + 'xai-[A-Za-z0-9]{40,}'),
      etapes: ['Connecte-toi avec cette adresse', 'Ouvre « API Keys » puis « Create API Key »', 'Copie la clé'] },
    { id: 'groq', nom: 'Groq', court: 'Groq', couleur: '#F55036', lettre: 'Q', env: 'GROQ_API_KEY',
      page: 'https://console.groq.com/keys', motif: new RegExp(B + 'gsk_[A-Za-z0-9]{20,}'),
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « Create API Key »', 'Copie la clé'] },
    { id: 'perplexity', nom: 'Perplexity', court: 'Perplexity', couleur: '#20808D', lettre: 'P', env: 'PERPLEXITY_API_KEY',
      page: 'https://www.perplexity.ai/account/api/keys', motif: new RegExp(B + 'pplx-[A-Za-z0-9]{32,}'),
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « Create Key »', 'Copie la clé'] },
    { id: 'mistral', nom: 'Mistral AI', court: 'Mistral', couleur: '#FA520F', lettre: 'M', env: 'MISTRAL_API_KEY',
      page: 'https://console.mistral.ai/api-keys', motif: null,
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « Create new key »', 'Copie la clé, puis clique sur « Coller la clé » dans Trousseau'] },
    { id: 'cohere', nom: 'Cohere', court: 'Cohere', couleur: '#39594D', lettre: 'C', env: 'COHERE_API_KEY',
      page: 'https://dashboard.cohere.com/api-keys', motif: null,
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « New Trial key »', 'Copie la clé, puis clique sur « Coller la clé » dans Trousseau'] },
    { id: 'together', nom: 'Together AI', court: 'Together', couleur: '#0F6FFF', lettre: 'T', env: 'TOGETHER_API_KEY',
      page: 'https://api.together.ai/settings/api-keys', motif: null,
      etapes: ['Connecte-toi avec cette adresse', 'Copie la clé affichée', 'Clique sur « Coller la clé » dans Trousseau'] },
    { id: 'elevenlabs', nom: 'ElevenLabs', court: 'ElevenLabs', couleur: '#000000', lettre: 'E', env: 'ELEVENLABS_API_KEY',
      page: 'https://elevenlabs.io/app/settings/api-keys', motif: new RegExp(B + 'sk_[a-f0-9]{40,}'),
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « Create API Key »', 'Copie la clé'] },
    { id: 'replicate', nom: 'Replicate', court: 'Replicate', couleur: '#EA2805', lettre: 'R', env: 'REPLICATE_API_TOKEN',
      page: 'https://replicate.com/account/api-tokens', motif: new RegExp(B + 'r8_[A-Za-z0-9]{30,}'),
      etapes: ['Connecte-toi avec cette adresse', 'Clique sur « Create token »', 'Copie le jeton'] },
    { id: 'github', nom: 'GitHub', court: 'GitHub', couleur: '#6E7681', lettre: 'H', icone: 'ic-github.png', env: 'GITHUB_TOKEN',
      page: 'https://github.com/settings/personal-access-tokens/new', motif: new RegExp(B + '(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,})'),
      etapes: ['Connecte-toi avec cette adresse', 'Choisis « No expiration » et les dépôts, puis « Generate token »', 'Copie le jeton'] },
    { id: 'huggingface', nom: 'Hugging Face', court: 'Hugging Face', couleur: '#FFB000', lettre: 'F', env: 'HF_TOKEN',
      page: 'https://huggingface.co/settings/tokens/new', motif: new RegExp(B + 'hf_[A-Za-z0-9]{30,}'),
      etapes: ['Connecte-toi avec cette adresse', 'Choisis « Read », puis « Create token »', 'Copie le jeton'] },
    { id: 'autre', nom: 'Autre service', court: 'Autre', couleur: '#7C8799', lettre: '•', env: 'API_KEY', page: null, motif: null, etapes: [] }
  ];

  // Messageries reconnues d'après la fin de l'adresse. « connexion » ouvre la page officielle
  // de connexion avec l'adresse déjà remplie quand le site le permet.
  const MESSAGERIES = [
    { id: 'gmail', nom: 'Gmail', domaines: ['gmail.com', 'googlemail.com'], boite: 'https://mail.google.com/mail/u/0/#inbox',
      connexion: e => 'https://accounts.google.com/AddSession?Email=' + encodeURIComponent(e) + '&continue=' + encodeURIComponent('https://mail.google.com/mail/u/0/') },
    { id: 'outlook', nom: 'Outlook', domaines: ['outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr', 'msn.com'],
      boite: 'https://outlook.live.com/mail/0/', connexion: e => 'https://login.live.com/login.srf?username=' + encodeURIComponent(e) },
    { id: 'yahoo', nom: 'Yahoo Mail', domaines: ['yahoo.com', 'yahoo.fr', 'ymail.com'], boite: 'https://mail.yahoo.com/', connexion: () => 'https://login.yahoo.com/' },
    { id: 'icloud', nom: 'iCloud Mail', domaines: ['icloud.com', 'me.com', 'mac.com'], boite: 'https://www.icloud.com/mail/', connexion: () => 'https://www.icloud.com/mail/' },
    { id: 'proton', nom: 'Proton Mail', domaines: ['proton.me', 'protonmail.com', 'pm.me'], boite: 'https://mail.proton.me/', connexion: () => 'https://account.proton.me/login' },
    { id: 'orange', nom: 'Mail Orange', domaines: ['orange.fr', 'wanadoo.fr'], boite: 'https://messagerie.orange.fr/', connexion: () => 'https://login.orange.fr/' },
    { id: 'sfr', nom: 'Mail SFR', domaines: ['sfr.fr', 'neuf.fr'], boite: 'https://webmail.sfr.fr/', connexion: () => 'https://webmail.sfr.fr/' },
    { id: 'free', nom: 'Zimbra Free', domaines: ['free.fr'], boite: 'https://zimbra.free.fr/', connexion: () => 'https://zimbra.free.fr/' },
    { id: 'laposte', nom: 'La Poste', domaines: ['laposte.net'], boite: 'https://www.laposte.net/accueil', connexion: () => 'https://compte.laposte.net/' },
    { id: 'gmx', nom: 'GMX', domaines: ['gmx.fr', 'gmx.com', 'gmx.net'], boite: 'https://www.gmx.fr/', connexion: () => 'https://www.gmx.fr/' }
  ];

  function messagerie(email) {
    const dom = String(email || '').split('@')[1] || '';
    return MESSAGERIES.find(m => m.domaines.includes(dom.toLowerCase())) || null;
  }
  function service(id) { return SERVICES.find(s => s.id === id) || SERVICES[SERVICES.length - 1]; }
  function serviceParEnv(nom) { const n = String(nom || '').toUpperCase(); return SERVICES.find(s => s.id !== 'autre' && (s.env === n || n.startsWith(s.env.replace(/_API_KEY|_TOKEN$/, '') + '_'))) || null; }

  // Trouve une clé reconnue dans un texte court. Renvoie { service, valeur } ou null.
  function detecter(texte) {
    const t = String(texte || '').trim();
    if (!t || t.length > 600) return null;
    for (const s of SERVICES) {
      if (!s.motif) continue;
      const m = t.match(s.motif);
      if (m) return { service: s.id, valeur: m[0] };
    }
    return null;
  }

  // Lit un fichier .env ou un texte : une entrée par clé trouvée (reconnue par son format ou son nom).
  // Nom lisible tiré d'une étiquette : « Jeton GitHub Boussole » → « Boussole », « Cerveau obsidian (Claude) » → « Cerveau obsidian ».
  const L = '(?<![\\p{L}\\p{N}_])', R = '(?![\\p{L}\\p{N}_])';
  const MOTS_VIDES = new RegExp(L + '(?:cl[ée]s?|api|jetons?|tokens?|keys?|secrets?|personal access|pat|google|anthropic|openai|github)' + R, 'giu');
  function nettoyer(et) {
    let t = String(et || '').replace(/\([^)]*\)/g, ' ').replace(/[:=]+\s*$/, '');
    for (const sv of SERVICES) for (const mot of [sv.nom, sv.court]) if (mot && mot.length > 2) t = t.replace(new RegExp(L + mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + R, 'giu'), ' ');
    t = t.replace(MOTS_VIDES, ' ').replace(/\s+/g, ' ').replace(/^[\s,;\-–—:]+|[\s,;\-–—:]+$/g, '');
    return t ? t[0].toUpperCase() + t.slice(1) : '';
  }

  // Lit un fichier .env ou un texte (notes, document Word copié) : une entrée par clé trouvée.
  // Les lignes sans clé servent d'étiquettes : un titre (« Jeton GitHub Boussole ») suivi d'un sous-titre (« Jeton téléphone »)
  // donne le nom « Boussole – téléphone » et l'usage « Boussole ». « Clé API Atelier : AQ.… » donne le nom « Atelier ».
  function lireTexte(texte) {
    const vus = new Set(), sortie = [];
    let titre = '', sous = '', derniereEtiquette = false;
    for (const ligne of String(texte || '').split(/\r?\n/)) {
      const l = ligne.trim();
      if (!l) continue;
      if (l.startsWith('#')) { const e = l.replace(/^#+\s*/, ''); if (e && !detecter(e)) { titre = e; sous = ''; derniereEtiquette = true; } continue; }
      const m = l.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[=:]\s*["']?([^"'\s]+)["']?/);
      let service = null, valeur = null, variable = null, etiquette = '';
      if (m) {
        variable = m[1]; valeur = m[2];
        const d = detecter(valeur); const e = serviceParEnv(variable);
        service = d ? d.service : e ? e.id : null;
        if (d) valeur = d.valeur;
        if (!service && !/KEY|TOKEN|SECRET/i.test(variable)) continue;
      } else {
        const d = detecter(l);
        if (!d) {   // ligne sans clé = étiquette
          if (l.length <= 80) { if (derniereEtiquette && sous) titre = sous; sous = l; derniereEtiquette = true; }
          continue;
        }
        service = d.service; valeur = d.valeur;
        const avant = l.slice(0, l.indexOf(d.valeur)).trim();
        if (avant.length > 1) etiquette = avant;
      }
      if (!valeur || valeur.length < 12 || vus.has(valeur)) { derniereEtiquette = false; continue; }
      vus.add(valeur);
      let nom = '', usage = '';
      if (etiquette) { nom = nettoyer(etiquette); usage = nom; }
      else if (variable) { nom = ''; }
      else {
        const t = nettoyer(titre), so = nettoyer(sous);
        if (t && so && t.toLowerCase() !== so.toLowerCase()) { nom = t + ' – ' + so.toLowerCase(); usage = t; }
        else { nom = so || t; usage = t || ''; }
      }
      sortie.push({ service: service || 'autre', valeur, variable, nom: nom.slice(0, 60), usage: usage.slice(0, 60) });
      derniereEtiquette = false;
    }
    return sortie;
  }

  const api = { SERVICES, MESSAGERIES, messagerie, service, serviceParEnv, detecter, lireTexte };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.CAT = api;
})(this);
