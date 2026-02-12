// i18n - Internationalization for Smart.pr Helper
// Supports: English (en), Dutch (nl)

(function() {
const LANG_KEY = 'smartpr_language';
let currentLang = 'en';

const translations = {
  en: {
    // === Popup ===
    'popup.title': 'Smart.pr Assistant',
    'popup.yourEmail': 'Your Email',
    'popup.noEmailSet': 'No email set',
    'popup.setUp': 'Set up',
    'popup.edit': 'Edit',
    'popup.save': 'Save',
    'popup.cancel': 'Cancel',
    'popup.emailPlaceholder': 'you@company.com',
    'popup.enterEmail': 'Please enter an email address',
    'popup.validEmail': 'Please enter a valid email address',
    'popup.saveFailed': 'Failed to save. Please try again.',
    'popup.toolsInSidebar': 'Tools in your sidebar',
    'popup.subjectLineCoach': 'Subject Line Coach',
    'popup.subjectLineCoachDesc': 'Feedback & alternatives for your subject',
    'popup.paragraphCoach': 'Paragraph Coach',
    'popup.paragraphCoachDesc': 'Grammar, rephrase, synonyms, translate, shorten',
    'popup.smartSummary': 'Smart Summary',
    'popup.smartSummaryDesc': 'Summarize your mailing in various formats',
    'popup.knowledgeBase': 'Knowledge Base',
    'popup.knowledgeBaseDesc': 'Ask anything about Smart.pr',
    'popup.extensionOn': 'Extension is on',
    'popup.extensionOff': 'Extension is off',
    'popup.feedback': 'Feedback',
    'popup.feedbackPlaceholder': 'Tell us what you think...',
    'popup.send': 'Send',
    'popup.sending': 'Sending...',
    'popup.feedbackSent': '\u2713 Feedback sent!',
    'popup.language': 'Language',

    // === Sidebar ===
    'sidebar.subjectLineHelper': 'Subject Line Helper',
    'sidebar.subjectLineCoach': 'Subject Line Coach',
    'sidebar.paragraphCoach': 'Paragraph Coach',
    'sidebar.askMeAnything': 'Ask me anything',
    'sidebar.feedback': 'Feedback',
    'sidebar.feedbackPlaceholder': 'Tell us what you think...',
    'sidebar.send': 'Send',
    'sidebar.cancel': 'Cancel',
    'sidebar.sending': 'Sending...',
    'sidebar.feedbackSent': '\u2713 Feedback sent!',
    'sidebar.feedbackFailed': 'Failed to send feedback',
    'sidebar.backToAsk': 'Back to Ask me anything',

    // === Paragraph Coach ===
    'paragraph.improveWithAI': 'Improve with AI',
    'paragraph.selectText': 'Select text to improve',
    'paragraph.selectTextDesc': 'Highlight text in any heading or paragraph block to get AI-powered suggestions.',
    'paragraph.whatYouCanDo': 'What you can do',
    'paragraph.fixGrammar': 'Fix spelling & grammar',
    'paragraph.rephraseParagraph': 'Rephrase paragraph',
    'paragraph.suggestSynonyms': 'Suggest synonyms',
    'paragraph.translateLanguages': 'Translate to other languages',
    'paragraph.makeTextShorter': 'Make text shorter',
    'paragraph.orFullMailing': 'Or work with the full mailing',
    'paragraph.summarizeMailing': 'Summarize Mailing',
    'paragraph.selectedHeading': 'Selected Heading',
    'paragraph.selectedSubheading': 'Selected Subheading',
    'paragraph.selectedText': 'Selected Text',
    'paragraph.whatToDo': 'What would you like to do?',
    'paragraph.fixSpellingGrammar': 'Fix Spelling & Grammar',
    'paragraph.rephrase': 'Rephrase Paragraph',
    'paragraph.synonyms': 'Suggest Synonyms',
    'paragraph.translate': 'Translate',
    'paragraph.shorter': 'Make Shorter',
    'paragraph.fullMailing': 'Full Mailing',

    // === Tone Selector ===
    'tone.selectedText': 'Selected Text',
    'tone.rephrase': 'Rephrase',
    'tone.orPickTone': 'Or pick a tone',
    'tone.formal': 'Formal',
    'tone.friendly': 'Friendly',
    'tone.persuasive': 'Persuasive',
    'tone.concise': 'Concise',
    'tone.back': '\u2190 Back',

    // === Translate ===
    'translate.translateTo': 'Translate to',
    'translate.otherPlaceholder': 'Other language (e.g., Spanish)',
    'translate.translateBtn': 'Translate',
    'translate.back': '\u2190 Back',

    // === Results ===
    'result.original': 'Original',
    'result.correctedText': 'Corrected Text',
    'result.rephrasedText': 'Rephrased Text',
    'result.synonymSuggestions': 'Synonym Suggestions',
    'result.translatedTo': 'Translated to',
    'result.shortenedText': 'Shortened Text',
    'result.result': 'Result',
    'result.replaceInEditor': 'Replace in Editor',
    'result.copyToClipboard': 'Copy to Clipboard',
    'result.tryAnotherAction': '\u2190 Try Another Action',
    'result.copy': 'Copy',
    'result.inject': 'Inject',
    'result.rephraseOptions': 'Rephrase Options',
    'result.changesMade': 'Changes Made',
    'result.words': 'words',
    'result.copied': '\u2713 Copied',
    'result.done': '\u2713 Done',

    // === Summary ===
    'summary.chooseFormat': 'Choose a summary format',
    'summary.oneLiner': 'One-liner',
    'summary.oneLinerDesc': 'Single sentence, ~20 words',
    'summary.shortPitch': 'Short Pitch',
    'summary.shortPitchDesc': '2-3 sentences, email-friendly',
    'summary.executiveSummary': 'Executive Summary',
    'summary.executiveSummaryDesc': 'One paragraph, ~100 words',
    'summary.bulletPoints': 'Bullet Points',
    'summary.bulletPointsDesc': 'Key facts, 4-6 bullets',
    'summary.back': '\u2190 Back',
    'summary.noContent': 'No mailing content found. Make sure the editor has some text.',
    'summary.tryAnotherFormat': '\u2190 Try Another Format',
    'summary.tryAgain': 'Try Again',

    // === Knowledge Base ===
    'kb.iKnowSmartPr': 'I know Smart.pr inside out',
    'kb.platformQuestions': 'Platform questions, PR tips, how-tos \u2014 just ask.',
    'kb.placeholder': 'What do you need help with?',
    'kb.ask': 'Ask',
    'kb.tryAsking': 'Try asking',
    'kb.scheduleMailing': 'How do I schedule a mailing?',
    'kb.goodSubjectLine': 'What makes a good PR subject line?',
    'kb.importContacts': 'How do I import contacts?',
    'kb.alsoAvailable': 'Also available in mailings',
    'kb.subjectLineCoachHint': 'Subject Line Coach',
    'kb.subjectLineCoachAction': 'click the subject field',
    'kb.paragraphCoachHint': 'Paragraph Coach',
    'kb.paragraphCoachAction': 'select text in the editor',
    'kb.followUp': 'Ask a follow-up...',
    'kb.newConversation': 'New conversation',

    // === Subject Line ===
    'subject.describePR': 'Describe Your Press Release',
    'subject.describePrompt': 'Tell me about your press release and I\'ll generate compelling subject lines for you.',
    'subject.placeholder': 'e.g., We\'re launching a new AI-powered analytics platform that helps companies reduce costs by 40%...',
    'subject.generate': 'Generate Subject Lines',
    'subject.moreDetails': 'The more details you provide, the better the suggestions!',
    'subject.currentSubject': 'Current Subject',
    'subject.getFeedback': 'Get Feedback',
    'subject.generateAlternatives': 'Generate Alternatives',
    'subject.originalSubject': 'Original Subject',
    'subject.suggestedLines': 'Suggested Subject Lines',
    'subject.use': 'Use',
    'subject.copy': 'Copy',
    'subject.generateMore': 'Generate More',
    'subject.yourSubject': 'Your Subject',
    'subject.whatWorks': 'What works',
    'subject.improvements': 'Improvements',
    'subject.noImprovements': 'Nothing to improve \u2014 your subject line looks great!',
    'subject.alternatives': 'Alternatives',
    'subject.generateBetter': 'Generate Better Alternatives',
    'subject.feedbackReady': '\u2713 Feedback ready!',
    'subject.setEmailHint': 'Click the extension icon in your toolbar to set your email.',
    'subject.generatingSuggestions': 'Generating subject line suggestions...',
    'subject.analyzingSubject': 'Analyzing your subject line...',

    // === Loading / Progress ===
    'loading.generating': 'Generating suggestions...',
    'loading.processing': 'Processing...',
    'progress.grammar': ['Checking spelling & grammar...', 'Scanning for typos...', 'Polishing your prose...', 'Almost there...'],
    'progress.rephrase': ['Rephrasing paragraph...', 'Exploring different angles...', 'Crafting alternatives...', 'Putting finishing touches...'],
    'progress.synonyms': ['Finding synonyms...', 'Searching the thesaurus...', 'Picking the best words...', 'Almost ready...'],
    'progress.translate': ['Translating text...', 'Finding the right words...', 'Preserving meaning...', 'Wrapping up...'],
    'progress.shorter': ['Making text shorter...', 'Trimming the excess...', 'Keeping what matters...', 'Nearly done...'],
    'progress.summarize': ['Reading your mailing...', 'Identifying key points...', 'Crafting summary...', 'Almost done...'],
    'progress.kb': ['Let me look that up...', 'Going through the details...', 'Putting together an answer...', 'One moment...'],
    'progress.default': ['Processing...', 'Working on it...', 'Hang tight...', 'Almost there...'],

    // === Toasts / Actions ===
    'toast.done': '\u2728 Done!',
    'toast.copiedToClipboard': '\u2713 Copied to clipboard',
    'toast.textReplaced': '\u2713 Text replaced',
    'toast.undo': 'Undo',
    'toast.undone': '\u21a9 Undone!',
    'toast.undoFailed': 'Undo failed.',
    'toast.couldNotUndo': 'Could not find text to undo.',
    'toast.unableToReplace': 'Unable to replace text. Please select text again.',
    'toast.replaceFailed': 'Replace failed. Try copying instead.',
    'toast.suggestionsGenerated': '\u2728 Suggestions generated!',

    // === Errors ===
    'error.noTextSelected': 'No text selected. Please select text and try again.',
    'error.tryAgain': 'Try Again',
    'error.back': '\u2190 Back',

    // === Nudge Messages ===
    'nudge.morning': 'Good morning!',
    'nudge.afternoon': 'Hey there!',
    'nudge.evening': 'Still working?',
    'nudge.emptySubject': 'Need help writing a subject line?',
    'nudge.filledSubject': 'Want feedback on your subject line?',

    // === Loading action messages ===
    'loading.checkingGrammar': 'Checking spelling & grammar...',
    'loading.rephrasing': 'Rephrasing paragraph...',
    'loading.findingSynonyms': 'Finding synonyms...',
    'loading.translatingTo': 'Translating to',
    'loading.makingShorter': 'Making text shorter...',
    'loading.readingMailing': 'Reading your mailing...',

    // === API Error Messages ===
    'apiError.notAuthorized': 'Please enter your Smart.pr email address in the extension settings.',
    'apiError.invalidEmail': 'Please enter a valid email address in the extension settings.',
    'apiError.rateLimit': "You've reached your usage limit. Please try again later.",
    'apiError.openai': 'Our AI service encountered an error. Please try again.',
    'apiError.server': 'Our service is temporarily unavailable. Please try again in a moment.',
    'apiError.network': 'Connection failed. Please check your internet connection.',
    'apiError.extensionUpdated': 'Extension updated. Refresh the page to continue.',
    'apiError.invalidRequest': 'Invalid request. Please try again.',
    'apiError.unknown': 'An unexpected error occurred. Please try again.',
    'apiError.enterEmail': 'Please enter your email address in the extension settings.',

    // === Format Labels ===
    'format.oneliner': 'One-liner',
    'format.pitch': 'Short Pitch',
    'format.executive': 'Executive Summary',
    'format.bullets': 'Bullet Points',
    'format.summary': 'Summary',
  },

  nl: {
    // === Popup ===
    'popup.title': 'Smart.pr Assistent',
    'popup.yourEmail': 'Je e-mail',
    'popup.noEmailSet': 'Geen e-mail ingesteld',
    'popup.setUp': 'Instellen',
    'popup.edit': 'Wijzig',
    'popup.save': 'Opslaan',
    'popup.cancel': 'Annuleren',
    'popup.emailPlaceholder': 'jij@bedrijf.nl',
    'popup.enterEmail': 'Vul een e-mailadres in',
    'popup.validEmail': 'Vul een geldig e-mailadres in',
    'popup.saveFailed': 'Opslaan mislukt. Probeer het opnieuw.',
    'popup.toolsInSidebar': 'Tools in je zijbalk',
    'popup.subjectLineCoach': 'Onderwerpregel Coach',
    'popup.subjectLineCoachDesc': 'Feedback & alternatieven voor je onderwerp',
    'popup.paragraphCoach': 'Alinea Coach',
    'popup.paragraphCoachDesc': 'Grammatica, herformuleren, synoniemen, vertalen, inkorten',
    'popup.smartSummary': 'Slimme Samenvatting',
    'popup.smartSummaryDesc': 'Vat je mailing samen in diverse formaten',
    'popup.knowledgeBase': 'Kennisbank',
    'popup.knowledgeBaseDesc': 'Vraag alles over Smart.pr',
    'popup.extensionOn': 'Extensie staat aan',
    'popup.extensionOff': 'Extensie staat uit',
    'popup.feedback': 'Feedback',
    'popup.feedbackPlaceholder': 'Vertel ons wat je ervan vindt...',
    'popup.send': 'Verstuur',
    'popup.sending': 'Versturen...',
    'popup.feedbackSent': '\u2713 Feedback verstuurd!',
    'popup.language': 'Taal',

    // === Sidebar ===
    'sidebar.subjectLineHelper': 'Onderwerpregel Helper',
    'sidebar.subjectLineCoach': 'Onderwerpregel Coach',
    'sidebar.paragraphCoach': 'Alinea Coach',
    'sidebar.askMeAnything': 'Stel een vraag',
    'sidebar.feedback': 'Feedback',
    'sidebar.feedbackPlaceholder': 'Vertel ons wat je ervan vindt...',
    'sidebar.send': 'Verstuur',
    'sidebar.cancel': 'Annuleren',
    'sidebar.sending': 'Versturen...',
    'sidebar.feedbackSent': '\u2713 Feedback verstuurd!',
    'sidebar.feedbackFailed': 'Feedback versturen mislukt',
    'sidebar.backToAsk': 'Terug naar Stel een vraag',

    // === Paragraph Coach ===
    'paragraph.improveWithAI': 'Verbeter met AI',
    'paragraph.selectText': 'Selecteer tekst om te verbeteren',
    'paragraph.selectTextDesc': 'Selecteer tekst in een kop of alinea voor AI-suggesties.',
    'paragraph.whatYouCanDo': 'Dit kun je doen',
    'paragraph.fixGrammar': 'Spelling & grammatica corrigeren',
    'paragraph.rephraseParagraph': 'Alinea herformuleren',
    'paragraph.suggestSynonyms': 'Synoniemen voorstellen',
    'paragraph.translateLanguages': 'Vertalen naar andere talen',
    'paragraph.makeTextShorter': 'Tekst inkorten',
    'paragraph.orFullMailing': 'Of werk met de hele mailing',
    'paragraph.summarizeMailing': 'Mailing samenvatten',
    'paragraph.selectedHeading': 'Geselecteerde kop',
    'paragraph.selectedSubheading': 'Geselecteerde subkop',
    'paragraph.selectedText': 'Geselecteerde tekst',
    'paragraph.whatToDo': 'Wat wil je doen?',
    'paragraph.fixSpellingGrammar': 'Spelling & grammatica',
    'paragraph.rephrase': 'Herformuleren',
    'paragraph.synonyms': 'Synoniemen',
    'paragraph.translate': 'Vertalen',
    'paragraph.shorter': 'Inkorten',
    'paragraph.fullMailing': 'Hele mailing',

    // === Tone Selector ===
    'tone.selectedText': 'Geselecteerde tekst',
    'tone.rephrase': 'Herformuleren',
    'tone.orPickTone': 'Of kies een toon',
    'tone.formal': 'Formeel',
    'tone.friendly': 'Vriendelijk',
    'tone.persuasive': 'Overtuigend',
    'tone.concise': 'Beknopt',
    'tone.back': '\u2190 Terug',

    // === Translate ===
    'translate.translateTo': 'Vertaal naar',
    'translate.otherPlaceholder': 'Andere taal (bijv. Spaans)',
    'translate.translateBtn': 'Vertalen',
    'translate.back': '\u2190 Terug',

    // === Results ===
    'result.original': 'Origineel',
    'result.correctedText': 'Verbeterde tekst',
    'result.rephrasedText': 'Herschreven tekst',
    'result.synonymSuggestions': 'Synoniemen',
    'result.translatedTo': 'Vertaald naar',
    'result.shortenedText': 'Ingekorte tekst',
    'result.result': 'Resultaat',
    'result.replaceInEditor': 'Vervang in editor',
    'result.copyToClipboard': 'Kopieer naar klembord',
    'result.tryAnotherAction': '\u2190 Probeer iets anders',
    'result.copy': 'Kopieer',
    'result.inject': 'Invoegen',
    'result.rephraseOptions': 'Varianten',
    'result.changesMade': 'Wijzigingen',
    'result.words': 'woorden',
    'result.copied': '\u2713 Gekopieerd',
    'result.done': '\u2713 Klaar',

    // === Summary ===
    'summary.chooseFormat': 'Kies een formaat',
    'summary.oneLiner': 'E\u00e9n zin',
    'summary.oneLinerDesc': 'E\u00e9n zin, ~20 woorden',
    'summary.shortPitch': 'Korte pitch',
    'summary.shortPitchDesc': '2-3 zinnen, handig voor e-mail',
    'summary.executiveSummary': 'Management-\nsamenvatting',
    'summary.executiveSummaryDesc': 'E\u00e9n alinea, ~100 woorden',
    'summary.bulletPoints': 'Opsomming',
    'summary.bulletPointsDesc': 'Belangrijkste punten, 4-6 bullets',
    'summary.back': '\u2190 Terug',
    'summary.noContent': 'Geen inhoud gevonden. Zorg dat er tekst in de editor staat.',
    'summary.tryAnotherFormat': '\u2190 Ander formaat kiezen',
    'summary.tryAgain': 'Opnieuw proberen',

    // === Knowledge Base ===
    'kb.iKnowSmartPr': 'Ik ken Smart.pr van binnen en buiten',
    'kb.platformQuestions': 'Platformvragen, PR-tips, handleidingen \u2014 vraag maar.',
    'kb.placeholder': 'Waar kan ik je mee helpen?',
    'kb.ask': 'Vraag',
    'kb.tryAsking': 'Probeer bijvoorbeeld',
    'kb.scheduleMailing': 'Hoe plan ik een mailing in?',
    'kb.goodSubjectLine': 'Wat maakt een goede PR-onderwerpregel?',
    'kb.importContacts': 'Hoe importeer ik contacten?',
    'kb.alsoAvailable': 'Ook beschikbaar bij mailings',
    'kb.subjectLineCoachHint': 'Onderwerpregel Coach',
    'kb.subjectLineCoachAction': 'klik op het onderwerpveld',
    'kb.paragraphCoachHint': 'Alinea Coach',
    'kb.paragraphCoachAction': 'selecteer tekst in de editor',
    'kb.followUp': 'Stel een vervolgvraag...',
    'kb.newConversation': 'Nieuw gesprek',

    // === Subject Line ===
    'subject.describePR': 'Beschrijf je persbericht',
    'subject.describePrompt': 'Vertel over je persbericht en ik bedenk pakkende onderwerpregels.',
    'subject.placeholder': 'bijv. We lanceren een nieuw AI-gedreven analyseplatform dat bedrijven helpt kosten met 40% te verlagen...',
    'subject.generate': 'Genereer onderwerpregels',
    'subject.moreDetails': 'Hoe meer details je geeft, hoe beter de suggesties!',
    'subject.currentSubject': 'Huidige onderwerpregel',
    'subject.getFeedback': 'Vraag feedback',
    'subject.generateAlternatives': 'Genereer alternatieven',
    'subject.originalSubject': 'Originele onderwerpregel',
    'subject.suggestedLines': 'Voorgestelde onderwerpregels',
    'subject.use': 'Gebruik',
    'subject.copy': 'Kopieer',
    'subject.generateMore': 'Genereer meer',
    'subject.yourSubject': 'Je onderwerpregel',
    'subject.whatWorks': 'Wat goed is',
    'subject.improvements': 'Verbeterpunten',
    'subject.noImprovements': 'Niets te verbeteren \u2014 je onderwerpregel is top!',
    'subject.alternatives': 'Alternatieven',
    'subject.generateBetter': 'Genereer betere alternatieven',
    'subject.feedbackReady': '\u2713 Feedback klaar!',
    'subject.setEmailHint': 'Klik op het extensie-icoon in je werkbalk om je e-mail in te stellen.',
    'subject.generatingSuggestions': 'Onderwerpregels bedenken...',
    'subject.analyzingSubject': 'Onderwerpregel analyseren...',

    // === Loading / Progress ===
    'loading.generating': 'Suggesties genereren...',
    'loading.processing': 'Bezig...',
    'progress.grammar': ['Spelling & grammatica controleren...', 'Zoeken naar typefouten...', 'Je tekst verbeteren...', 'Bijna klaar...'],
    'progress.rephrase': ['Alinea herformuleren...', 'Verschillende invalshoeken verkennen...', 'Alternatieven bedenken...', 'De puntjes op de i...'],
    'progress.synonyms': ['Synoniemen zoeken...', 'Door het woordenboek bladeren...', 'De beste woorden kiezen...', 'Bijna klaar...'],
    'progress.translate': ['Tekst vertalen...', 'De juiste woorden vinden...', 'Betekenis overbrengen...', 'Afronden...'],
    'progress.shorter': ['Tekst inkorten...', 'Overbodige woorden schrappen...', 'Het belangrijkste behouden...', 'Bijna klaar...'],
    'progress.summarize': ['Je mailing doorlezen...', 'Kernpunten verzamelen...', 'Samenvatting schrijven...', 'Bijna klaar...'],
    'progress.kb': ['Even opzoeken...', 'De details doornemen...', 'Een antwoord formuleren...', 'Momentje...'],
    'progress.default': ['Bezig...', 'Even geduld...', 'Wordt aan gewerkt...', 'Bijna klaar...'],

    // === Toasts / Actions ===
    'toast.done': '\u2728 Klaar!',
    'toast.copiedToClipboard': '\u2713 Gekopieerd naar klembord',
    'toast.textReplaced': '\u2713 Tekst vervangen',
    'toast.undo': 'Ongedaan maken',
    'toast.undone': '\u21a9 Ongedaan gemaakt!',
    'toast.undoFailed': 'Ongedaan maken mislukt.',
    'toast.couldNotUndo': 'Kon de originele tekst niet terugvinden.',
    'toast.unableToReplace': 'Kan tekst niet vervangen. Selecteer de tekst opnieuw.',
    'toast.replaceFailed': 'Vervangen mislukt. Probeer het te kopi\u00ebren.',
    'toast.suggestionsGenerated': '\u2728 Suggesties klaar!',

    // === Errors ===
    'error.noTextSelected': 'Geen tekst geselecteerd. Selecteer tekst en probeer het opnieuw.',
    'error.tryAgain': 'Opnieuw proberen',
    'error.back': '\u2190 Terug',

    // === Nudge Messages ===
    'nudge.morning': 'Goedemorgen!',
    'nudge.afternoon': 'Hoi!',
    'nudge.evening': 'Nog aan het werk?',
    'nudge.emptySubject': 'Hulp nodig met je onderwerpregel?',
    'nudge.filledSubject': 'Wil je feedback op je onderwerpregel?',

    // === Loading action messages ===
    'loading.checkingGrammar': 'Spelling & grammatica controleren...',
    'loading.rephrasing': 'Alinea herformuleren...',
    'loading.findingSynonyms': 'Synoniemen zoeken...',
    'loading.translatingTo': 'Vertalen naar',
    'loading.makingShorter': 'Tekst inkorten...',
    'loading.readingMailing': 'Je mailing doorlezen...',

    // === API Error Messages ===
    'apiError.notAuthorized': 'Vul je Smart.pr e-mailadres in bij de extensie-instellingen.',
    'apiError.invalidEmail': 'Vul een geldig e-mailadres in bij de extensie-instellingen.',
    'apiError.rateLimit': 'Je hebt je gebruikslimiet bereikt. Probeer het later opnieuw.',
    'apiError.openai': 'Er ging iets mis met de AI. Probeer het opnieuw.',
    'apiError.server': 'De service is even niet beschikbaar. Probeer het zo opnieuw.',
    'apiError.network': 'Verbinding mislukt. Controleer je internetverbinding.',
    'apiError.extensionUpdated': 'De extensie is bijgewerkt. Ververs de pagina om verder te gaan.',
    'apiError.invalidRequest': 'Ongeldig verzoek. Probeer het opnieuw.',
    'apiError.unknown': 'Er ging iets mis. Probeer het opnieuw.',
    'apiError.enterEmail': 'Vul je e-mailadres in bij de extensie-instellingen.',

    // === Format Labels ===
    'format.oneliner': 'E\u00e9n zin',
    'format.pitch': 'Korte pitch',
    'format.executive': 'Management-\nsamenvatting',
    'format.bullets': 'Opsomming',
    'format.summary': 'Samenvatting',
  }
};

/**
 * Get translation for a key
 * @param {string} key - Translation key (e.g., 'popup.title')
 * @param {object} params - Optional interpolation params (e.g., { lang: 'Dutch' })
 * @returns {string|Array} - Translated string or array (for progress messages)
 */
function t(key, params) {
  const dict = translations[currentLang] || translations.en;
  let val = dict[key];
  if (val === undefined) {
    // Fallback to English
    val = translations.en[key];
  }
  if (val === undefined) return key;
  if (typeof val === 'string' && params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replace(`{${k}}`, v);
    }
  }
  return val;
}

/**
 * Initialize language from storage
 * @returns {Promise<string>} - Current language code
 */
async function initLanguage() {
  try {
    const result = await new Promise(resolve =>
      chrome.storage.sync.get([LANG_KEY], resolve)
    );
    currentLang = result[LANG_KEY] || 'en';
  } catch (e) {
    currentLang = 'en';
  }
  return currentLang;
}

/**
 * Set language and persist
 * @param {string} lang - Language code ('en' or 'nl')
 */
async function setLanguage(lang) {
  currentLang = lang;
  try {
    await new Promise(resolve =>
      chrome.storage.sync.set({ [LANG_KEY]: lang }, resolve)
    );
  } catch (e) {
    // Storage might not be available
  }
}

/**
 * Get current language
 * @returns {string}
 */
function getLang() {
  return currentLang;
}

// Export for use in other scripts
window.SmartPRI18n = { t, initLanguage, setLanguage, getLang, LANG_KEY };
})();
