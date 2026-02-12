(function () {
  "use strict";

  // ===== PREVENT DOUBLE-LOADING =====
  if (window.__SMARTPR_WIDGET_LOADED__) return;
  window.__SMARTPR_WIDGET_LOADED__ = true;

  // ===== CONSTANTS =====
  var PREFIX = "smartpr";
  var EVENT_PREFIX = "smartpr:";
  var API_BASE_URL = "https://smarthelper.replit.app/api";
  var STORAGE_KEY_EMAIL = "smartpr_user_email";
  var STORAGE_KEY_LANG = "smartpr_language";
  var STORAGE_KEY_DISABLED = "smartpr_helper_disabled";

  // ===== HOST CONTEXT =====
  var hostContext = { user: null, client: null };

  // ===== INLINE SVG LOGOS =====
  var LOGO_WHITE_SVG =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' +
    '<path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="white"/>' +
    "</svg>";

  var LOGO_BRAND_SVG =
    '<svg width="48" height="48" viewBox="0 0 48 48" fill="none">' +
    '<defs><linearGradient id="smartpr-grad" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#FFD580"/><stop offset="50%" stop-color="#FFBC7F"/>' +
    '<stop offset="100%" stop-color="#E8B5E8"/></linearGradient></defs>' +
    '<path d="M24 4L28.8 19.2L44 24L28.8 28.8L24 44L19.2 28.8L4 24L19.2 19.2L24 4Z" fill="url(#smartpr-grad)"/>' +
    "</svg>";

  var LOGO_ICON_SMALL_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none">' +
    '<path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="white"/>' +
    "</svg>";

  // ===== STORAGE HELPER (replaces chrome.storage.sync) =====
  var storage = {
    get: function (key) {
      return Promise.resolve(
        (function () {
          try {
            return localStorage.getItem(key);
          } catch (e) {
            return null;
          }
        })(),
      );
    },
    set: function (key, value) {
      return Promise.resolve(
        (function () {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            /* ignore */
          }
        })(),
      );
    },
  };

  // ===== ESCAPE HTML (XSS prevention) =====
  function escapeHTML(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== I18N MODULE =====
  var currentLang = "en";

  var translations = {
    en: {
      "sidebar.subjectLineHelper": "Subject Line Helper",
      "sidebar.subjectLineCoach": "Subject Line Coach",
      "sidebar.paragraphCoach": "Paragraph Coach",
      "sidebar.askMeAnything": "Ask me anything",
      "sidebar.feedback": "Feedback",
      "sidebar.feedbackPlaceholder": "Tell us what you think...",
      "sidebar.send": "Send",
      "sidebar.cancel": "Cancel",
      "sidebar.sending": "Sending...",
      "sidebar.feedbackSent": "\u2713 Feedback sent!",
      "sidebar.feedbackFailed": "Failed to send feedback",
      "sidebar.backToAsk": "Back to Ask me anything",
      "paragraph.improveWithAI": "Improve with AI",
      "paragraph.selectText": "Select text to improve",
      "paragraph.selectTextDesc":
        "Highlight text in any heading or paragraph block to get AI-powered suggestions.",
      "paragraph.whatYouCanDo": "What you can do",
      "paragraph.fixGrammar": "Fix spelling & grammar",
      "paragraph.rephraseParagraph": "Rephrase paragraph",
      "paragraph.suggestSynonyms": "Suggest synonyms",
      "paragraph.translateLanguages": "Translate to other languages",
      "paragraph.makeTextShorter": "Make text shorter",
      "paragraph.orFullMailing": "Or work with the full mailing",
      "paragraph.summarizeMailing": "Summarize Mailing",
      "paragraph.selectedHeading": "Selected Heading",
      "paragraph.selectedSubheading": "Selected Subheading",
      "paragraph.selectedText": "Selected Text",
      "paragraph.whatToDo": "What would you like to do?",
      "paragraph.fixSpellingGrammar": "Fix Spelling & Grammar",
      "paragraph.rephrase": "Rephrase Paragraph",
      "paragraph.synonyms": "Suggest Synonyms",
      "paragraph.translate": "Translate",
      "paragraph.shorter": "Make Shorter",
      "paragraph.fullMailing": "Full Mailing",
      "tone.selectedText": "Selected Text",
      "tone.rephrase": "Rephrase",
      "tone.orPickTone": "Or pick a tone",
      "tone.formal": "Formal",
      "tone.friendly": "Friendly",
      "tone.persuasive": "Persuasive",
      "tone.concise": "Concise",
      "tone.back": "\u2190 Back",
      "translate.translateTo": "Translate to",
      "translate.otherPlaceholder": "Other language (e.g., Spanish)",
      "translate.translateBtn": "Translate",
      "translate.back": "\u2190 Back",
      "result.original": "Original",
      "result.correctedText": "Corrected Text",
      "result.rephrasedText": "Rephrased Text",
      "result.synonymSuggestions": "Synonym Suggestions",
      "result.translatedTo": "Translated to",
      "result.shortenedText": "Shortened Text",
      "result.result": "Result",
      "result.replaceInEditor": "Replace in Editor",
      "result.copyToClipboard": "Copy to Clipboard",
      "result.tryAnotherAction": "\u2190 Try Another Action",
      "result.copy": "Copy",
      "result.inject": "Inject",
      "result.rephraseOptions": "Rephrase Options",
      "result.changesMade": "Changes Made",
      "result.words": "words",
      "result.copied": "\u2713 Copied",
      "result.done": "\u2713 Done",
      "summary.chooseFormat": "Choose a summary format",
      "summary.oneLiner": "One-liner",
      "summary.oneLinerDesc": "Single sentence, ~20 words",
      "summary.shortPitch": "Short Pitch",
      "summary.shortPitchDesc": "2-3 sentences, email-friendly",
      "summary.executiveSummary": "Executive Summary",
      "summary.executiveSummaryDesc": "One paragraph, ~100 words",
      "summary.bulletPoints": "Bullet Points",
      "summary.bulletPointsDesc": "Key facts, 4-6 bullets",
      "summary.back": "\u2190 Back",
      "summary.noContent":
        "No mailing content found. Make sure the editor has some text.",
      "summary.tryAnotherFormat": "\u2190 Try Another Format",
      "summary.tryAgain": "Try Again",
      "kb.iKnowSmartPr": "I know Smart.pr inside out",
      "kb.platformQuestions":
        "Platform questions, PR tips, how-tos \u2014 just ask.",
      "kb.placeholder": "What do you need help with?",
      "kb.ask": "Ask",
      "kb.tryAsking": "Try asking",
      "kb.scheduleMailing": "How do I schedule a mailing?",
      "kb.goodSubjectLine": "What makes a good PR subject line?",
      "kb.importContacts": "How do I import contacts?",
      "kb.alsoAvailable": "Also available in mailings",
      "kb.subjectLineCoachHint": "Subject Line Coach",
      "kb.subjectLineCoachAction": "click the subject field",
      "kb.paragraphCoachHint": "Paragraph Coach",
      "kb.paragraphCoachAction": "select text in the editor",
      "kb.followUp": "Ask a follow-up...",
      "kb.newConversation": "New conversation",
      "subject.describePR": "Describe Your Press Release",
      "subject.describePrompt":
        "Tell me about your press release and I'll generate compelling subject lines for you.",
      "subject.placeholder":
        "e.g., We're launching a new AI-powered analytics platform that helps companies reduce costs by 40%...",
      "subject.generate": "Generate Subject Lines",
      "subject.moreDetails":
        "The more details you provide, the better the suggestions!",
      "subject.currentSubject": "Current Subject",
      "subject.getFeedback": "Get Feedback",
      "subject.generateAlternatives": "Generate Alternatives",
      "subject.originalSubject": "Original Subject",
      "subject.suggestedLines": "Suggested Subject Lines",
      "subject.use": "Use",
      "subject.copy": "Copy",
      "subject.generateMore": "Generate More",
      "subject.yourSubject": "Your Subject",
      "subject.whatWorks": "What works",
      "subject.improvements": "Improvements",
      "subject.noImprovements":
        "Nothing to improve \u2014 your subject line looks great!",
      "subject.alternatives": "Alternatives",
      "subject.generateBetter": "Generate Better Alternatives",
      "subject.feedbackReady": "\u2713 Feedback ready!",
      "subject.setEmailHint":
        "Please configure your email via setContext() to use this feature.",
      "subject.generatingSuggestions": "Generating subject line suggestions...",
      "subject.analyzingSubject": "Analyzing your subject line...",
      "loading.generating": "Generating suggestions...",
      "loading.processing": "Processing...",
      "progress.grammar": [
        "Checking spelling & grammar...",
        "Scanning for typos...",
        "Polishing your prose...",
        "Almost there...",
      ],
      "progress.rephrase": [
        "Rephrasing paragraph...",
        "Exploring different angles...",
        "Crafting alternatives...",
        "Putting finishing touches...",
      ],
      "progress.synonyms": [
        "Finding synonyms...",
        "Searching the thesaurus...",
        "Picking the best words...",
        "Almost ready...",
      ],
      "progress.translate": [
        "Translating text...",
        "Finding the right words...",
        "Preserving meaning...",
        "Wrapping up...",
      ],
      "progress.shorter": [
        "Making text shorter...",
        "Trimming the excess...",
        "Keeping what matters...",
        "Nearly done...",
      ],
      "progress.summarize": [
        "Reading your mailing...",
        "Identifying key points...",
        "Crafting summary...",
        "Almost done...",
      ],
      "progress.kb": [
        "Let me look that up...",
        "Going through the details...",
        "Putting together an answer...",
        "One moment...",
      ],
      "progress.default": [
        "Processing...",
        "Working on it...",
        "Hang tight...",
        "Almost there...",
      ],
      "toast.done": "\u2728 Done!",
      "toast.copiedToClipboard": "\u2713 Copied to clipboard",
      "toast.textReplaced": "\u2713 Text replaced",
      "toast.undo": "Undo",
      "toast.undone": "\u21a9 Undone!",
      "toast.undoFailed": "Undo failed.",
      "toast.couldNotUndo": "Could not find text to undo.",
      "toast.unableToReplace":
        "Unable to replace text. Please select text again.",
      "toast.replaceFailed": "Replace failed. Try copying instead.",
      "toast.suggestionsGenerated": "\u2728 Suggestions generated!",
      "error.noTextSelected":
        "No text selected. Please select text and try again.",
      "error.tryAgain": "Try Again",
      "error.back": "\u2190 Back",
      "nudge.morning": "Good morning!",
      "nudge.afternoon": "Hey there!",
      "nudge.evening": "Still working?",
      "nudge.emptySubject": "Need help writing a subject line?",
      "nudge.filledSubject": "Want feedback on your subject line?",
      "loading.checkingGrammar": "Checking spelling & grammar...",
      "loading.rephrasing": "Rephrasing paragraph...",
      "loading.findingSynonyms": "Finding synonyms...",
      "loading.translatingTo": "Translating to",
      "loading.makingShorter": "Making text shorter...",
      "loading.readingMailing": "Reading your mailing...",
      "apiError.notAuthorized":
        "Please configure your email to use this feature.",
      "apiError.invalidEmail": "Please configure a valid email address.",
      "apiError.rateLimit":
        "You've reached your usage limit. Please try again later.",
      "apiError.openai":
        "Our AI service encountered an error. Please try again.",
      "apiError.server":
        "Our service is temporarily unavailable. Please try again in a moment.",
      "apiError.network":
        "Connection failed. Please check your internet connection.",
      "apiError.invalidRequest": "Invalid request. Please try again.",
      "apiError.unknown": "An unexpected error occurred. Please try again.",
      "apiError.enterEmail": "Please configure your email address.",
      "format.oneliner": "One-liner",
      "format.pitch": "Short Pitch",
      "format.executive": "Executive Summary",
      "format.bullets": "Bullet Points",
      "format.summary": "Summary",
    },

    nl: {
      "sidebar.subjectLineHelper": "Onderwerpregel Helper",
      "sidebar.subjectLineCoach": "Onderwerpregel Coach",
      "sidebar.paragraphCoach": "Alinea Coach",
      "sidebar.askMeAnything": "Stel een vraag",
      "sidebar.feedback": "Feedback",
      "sidebar.feedbackPlaceholder": "Vertel ons wat je ervan vindt...",
      "sidebar.send": "Verstuur",
      "sidebar.cancel": "Annuleren",
      "sidebar.sending": "Versturen...",
      "sidebar.feedbackSent": "\u2713 Feedback verstuurd!",
      "sidebar.feedbackFailed": "Feedback versturen mislukt",
      "sidebar.backToAsk": "Terug naar Stel een vraag",
      "paragraph.improveWithAI": "Verbeter met AI",
      "paragraph.selectText": "Selecteer tekst om te verbeteren",
      "paragraph.selectTextDesc":
        "Selecteer tekst in een kop of alinea voor AI-suggesties.",
      "paragraph.whatYouCanDo": "Dit kun je doen",
      "paragraph.fixGrammar": "Spelling & grammatica corrigeren",
      "paragraph.rephraseParagraph": "Alinea herformuleren",
      "paragraph.suggestSynonyms": "Synoniemen voorstellen",
      "paragraph.translateLanguages": "Vertalen naar andere talen",
      "paragraph.makeTextShorter": "Tekst inkorten",
      "paragraph.orFullMailing": "Of werk met de hele mailing",
      "paragraph.summarizeMailing": "Mailing samenvatten",
      "paragraph.selectedHeading": "Geselecteerde kop",
      "paragraph.selectedSubheading": "Geselecteerde subkop",
      "paragraph.selectedText": "Geselecteerde tekst",
      "paragraph.whatToDo": "Wat wil je doen?",
      "paragraph.fixSpellingGrammar": "Spelling & grammatica",
      "paragraph.rephrase": "Herformuleren",
      "paragraph.synonyms": "Synoniemen",
      "paragraph.translate": "Vertalen",
      "paragraph.shorter": "Inkorten",
      "paragraph.fullMailing": "Hele mailing",
      "tone.selectedText": "Geselecteerde tekst",
      "tone.rephrase": "Herformuleren",
      "tone.orPickTone": "Of kies een toon",
      "tone.formal": "Formeel",
      "tone.friendly": "Vriendelijk",
      "tone.persuasive": "Overtuigend",
      "tone.concise": "Beknopt",
      "tone.back": "\u2190 Terug",
      "translate.translateTo": "Vertaal naar",
      "translate.otherPlaceholder": "Andere taal (bijv. Spaans)",
      "translate.translateBtn": "Vertalen",
      "translate.back": "\u2190 Terug",
      "result.original": "Origineel",
      "result.correctedText": "Verbeterde tekst",
      "result.rephrasedText": "Herschreven tekst",
      "result.synonymSuggestions": "Synoniemen",
      "result.translatedTo": "Vertaald naar",
      "result.shortenedText": "Ingekorte tekst",
      "result.result": "Resultaat",
      "result.replaceInEditor": "Vervang in editor",
      "result.copyToClipboard": "Kopieer naar klembord",
      "result.tryAnotherAction": "\u2190 Probeer iets anders",
      "result.copy": "Kopieer",
      "result.inject": "Invoegen",
      "result.rephraseOptions": "Varianten",
      "result.changesMade": "Wijzigingen",
      "result.words": "woorden",
      "result.copied": "\u2713 Gekopieerd",
      "result.done": "\u2713 Klaar",
      "summary.chooseFormat": "Kies een formaat",
      "summary.oneLiner": "E\u00e9n zin",
      "summary.oneLinerDesc": "E\u00e9n zin, ~20 woorden",
      "summary.shortPitch": "Korte pitch",
      "summary.shortPitchDesc": "2-3 zinnen, handig voor e-mail",
      "summary.executiveSummary": "Management-\nsamenvatting",
      "summary.executiveSummaryDesc": "E\u00e9n alinea, ~100 woorden",
      "summary.bulletPoints": "Opsomming",
      "summary.bulletPointsDesc": "Belangrijkste punten, 4-6 bullets",
      "summary.back": "\u2190 Terug",
      "summary.noContent":
        "Geen inhoud gevonden. Zorg dat er tekst in de editor staat.",
      "summary.tryAnotherFormat": "\u2190 Ander formaat kiezen",
      "summary.tryAgain": "Opnieuw proberen",
      "kb.iKnowSmartPr": "Ik ken Smart.pr van binnen en buiten",
      "kb.platformQuestions":
        "Platformvragen, PR-tips, handleidingen \u2014 vraag maar.",
      "kb.placeholder": "Waar kan ik je mee helpen?",
      "kb.ask": "Vraag",
      "kb.tryAsking": "Probeer bijvoorbeeld",
      "kb.scheduleMailing": "Hoe plan ik een mailing in?",
      "kb.goodSubjectLine": "Wat maakt een goede PR-onderwerpregel?",
      "kb.importContacts": "Hoe importeer ik contacten?",
      "kb.alsoAvailable": "Ook beschikbaar bij mailings",
      "kb.subjectLineCoachHint": "Onderwerpregel Coach",
      "kb.subjectLineCoachAction": "klik op het onderwerpveld",
      "kb.paragraphCoachHint": "Alinea Coach",
      "kb.paragraphCoachAction": "selecteer tekst in de editor",
      "kb.followUp": "Stel een vervolgvraag...",
      "kb.newConversation": "Nieuw gesprek",
      "subject.describePR": "Beschrijf je persbericht",
      "subject.describePrompt":
        "Vertel over je persbericht en ik bedenk pakkende onderwerpregels.",
      "subject.placeholder":
        "bijv. We lanceren een nieuw AI-gedreven analyseplatform dat bedrijven helpt kosten met 40% te verlagen...",
      "subject.generate": "Genereer onderwerpregels",
      "subject.moreDetails":
        "Hoe meer details je geeft, hoe beter de suggesties!",
      "subject.currentSubject": "Huidige onderwerpregel",
      "subject.getFeedback": "Vraag feedback",
      "subject.generateAlternatives": "Genereer alternatieven",
      "subject.originalSubject": "Originele onderwerpregel",
      "subject.suggestedLines": "Voorgestelde onderwerpregels",
      "subject.use": "Gebruik",
      "subject.copy": "Kopieer",
      "subject.generateMore": "Genereer meer",
      "subject.yourSubject": "Je onderwerpregel",
      "subject.whatWorks": "Wat goed is",
      "subject.improvements": "Verbeterpunten",
      "subject.noImprovements":
        "Niets te verbeteren \u2014 je onderwerpregel is top!",
      "subject.alternatives": "Alternatieven",
      "subject.generateBetter": "Genereer betere alternatieven",
      "subject.feedbackReady": "\u2713 Feedback klaar!",
      "subject.setEmailHint":
        "Stel je e-mail in via setContext() om deze functie te gebruiken.",
      "subject.generatingSuggestions": "Onderwerpregels bedenken...",
      "subject.analyzingSubject": "Onderwerpregel analyseren...",
      "loading.generating": "Suggesties genereren...",
      "loading.processing": "Bezig...",
      "progress.grammar": [
        "Spelling & grammatica controleren...",
        "Zoeken naar typefouten...",
        "Je tekst verbeteren...",
        "Bijna klaar...",
      ],
      "progress.rephrase": [
        "Alinea herformuleren...",
        "Verschillende invalshoeken verkennen...",
        "Alternatieven bedenken...",
        "De puntjes op de i...",
      ],
      "progress.synonyms": [
        "Synoniemen zoeken...",
        "Door het woordenboek bladeren...",
        "De beste woorden kiezen...",
        "Bijna klaar...",
      ],
      "progress.translate": [
        "Tekst vertalen...",
        "De juiste woorden vinden...",
        "Betekenis overbrengen...",
        "Afronden...",
      ],
      "progress.shorter": [
        "Tekst inkorten...",
        "Overbodige woorden schrappen...",
        "Het belangrijkste behouden...",
        "Bijna klaar...",
      ],
      "progress.summarize": [
        "Je mailing doorlezen...",
        "Kernpunten verzamelen...",
        "Samenvatting schrijven...",
        "Bijna klaar...",
      ],
      "progress.kb": [
        "Even opzoeken...",
        "De details doornemen...",
        "Een antwoord formuleren...",
        "Momentje...",
      ],
      "progress.default": [
        "Bezig...",
        "Even geduld...",
        "Wordt aan gewerkt...",
        "Bijna klaar...",
      ],
      "toast.done": "\u2728 Klaar!",
      "toast.copiedToClipboard": "\u2713 Gekopieerd naar klembord",
      "toast.textReplaced": "\u2713 Tekst vervangen",
      "toast.undo": "Ongedaan maken",
      "toast.undone": "\u21a9 Ongedaan gemaakt!",
      "toast.undoFailed": "Ongedaan maken mislukt.",
      "toast.couldNotUndo": "Kon de originele tekst niet terugvinden.",
      "toast.unableToReplace":
        "Kan tekst niet vervangen. Selecteer de tekst opnieuw.",
      "toast.replaceFailed": "Vervangen mislukt. Probeer het te kopi\u00ebren.",
      "toast.suggestionsGenerated": "\u2728 Suggesties klaar!",
      "error.noTextSelected":
        "Geen tekst geselecteerd. Selecteer tekst en probeer het opnieuw.",
      "error.tryAgain": "Opnieuw proberen",
      "error.back": "\u2190 Terug",
      "nudge.morning": "Goedemorgen!",
      "nudge.afternoon": "Hoi!",
      "nudge.evening": "Nog aan het werk?",
      "nudge.emptySubject": "Hulp nodig met je onderwerpregel?",
      "nudge.filledSubject": "Wil je feedback op je onderwerpregel?",
      "loading.checkingGrammar": "Spelling & grammatica controleren...",
      "loading.rephrasing": "Alinea herformuleren...",
      "loading.findingSynonyms": "Synoniemen zoeken...",
      "loading.translatingTo": "Vertalen naar",
      "loading.makingShorter": "Tekst inkorten...",
      "loading.readingMailing": "Je mailing doorlezen...",
      "apiError.notAuthorized":
        "Stel je e-mailadres in om deze functie te gebruiken.",
      "apiError.invalidEmail": "Stel een geldig e-mailadres in.",
      "apiError.rateLimit":
        "Je hebt je gebruikslimiet bereikt. Probeer het later opnieuw.",
      "apiError.openai": "Er ging iets mis met de AI. Probeer het opnieuw.",
      "apiError.server":
        "De service is even niet beschikbaar. Probeer het zo opnieuw.",
      "apiError.network":
        "Verbinding mislukt. Controleer je internetverbinding.",
      "apiError.invalidRequest": "Ongeldig verzoek. Probeer het opnieuw.",
      "apiError.unknown": "Er ging iets mis. Probeer het opnieuw.",
      "apiError.enterEmail": "Stel je e-mailadres in.",
      "format.oneliner": "E\u00e9n zin",
      "format.pitch": "Korte pitch",
      "format.executive": "Management-\nsamenvatting",
      "format.bullets": "Opsomming",
      "format.summary": "Samenvatting",
    },
  };

  function t(key, params) {
    var dict = translations[currentLang] || translations.en;
    var val = dict[key];
    if (val === undefined) val = translations.en[key];
    if (val === undefined) return key;
    if (typeof val === "string" && params) {
      for (var k in params) {
        if (params.hasOwnProperty(k)) {
          val = val.replace("{" + k + "}", params[k]);
        }
      }
    }
    return val;
  }

  function initLanguage() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY_LANG);
      if (saved) currentLang = saved;
    } catch (e) {
      /* ignore */
    }
    return currentLang;
  }

  function setLanguage(lang) {
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
    } catch (e) {
      /* ignore */
    }
  }

  // ===== ERROR MESSAGES =====
  function getErrorMessages() {
    return {
      USER_NOT_AUTHORIZED: t("apiError.notAuthorized"),
      INVALID_EMAIL: t("apiError.invalidEmail"),
      RATE_LIMIT_EXCEEDED: t("apiError.rateLimit"),
      OPENAI_ERROR: t("apiError.openai"),
      SERVER_ERROR: t("apiError.server"),
      NETWORK_ERROR: t("apiError.network"),
      INVALID_REQUEST: t("apiError.invalidRequest"),
      UNKNOWN_ERROR: t("apiError.unknown"),
    };
  }

  var ERROR_MESSAGES = new Proxy(
    {},
    {
      get: function (_, key) {
        return getErrorMessages()[key];
      },
    },
  );

  // ===== API CLIENT =====
  function getUserEmail() {
    // Priority: hostContext > localStorage
    if (hostContext.user && hostContext.user.email) {
      return hostContext.user.email;
    }
    try {
      return localStorage.getItem(STORAGE_KEY_EMAIL) || "";
    } catch (e) {
      return "";
    }
  }

  function callProxyAPI(endpoint, payload, options) {
    options = options || {};
    var email = getUserEmail();

    if (!email) {
      return Promise.reject({
        code: "INVALID_EMAIL",
        message: ERROR_MESSAGES.INVALID_EMAIL,
      });
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, options.timeout || 30000);

    return fetch(API_BASE_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ email: email }, payload)),
      signal: controller.signal,
    })
      .then(function (response) {
        clearTimeout(timeoutId);
        if (!response.ok) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (errorData) {
              if (response.status === 403) {
                throw {
                  code: "USER_NOT_AUTHORIZED",
                  message:
                    errorData.message || ERROR_MESSAGES.USER_NOT_AUTHORIZED,
                  details: errorData,
                };
              } else if (response.status === 429) {
                throw {
                  code: "RATE_LIMIT_EXCEEDED",
                  message:
                    errorData.message || ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
                  retryAfter: errorData.retryAfter,
                  details: errorData,
                };
              } else if (response.status === 400) {
                throw {
                  code: "INVALID_REQUEST",
                  message: errorData.message || ERROR_MESSAGES.INVALID_REQUEST,
                  details: errorData,
                };
              } else if (response.status >= 500) {
                throw {
                  code: "SERVER_ERROR",
                  message: ERROR_MESSAGES.SERVER_ERROR,
                  details: errorData,
                };
              }
              throw {
                code: "UNKNOWN_ERROR",
                message: ERROR_MESSAGES.UNKNOWN_ERROR,
                details: errorData,
              };
            });
        }
        return response.json();
      })
      .catch(function (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          throw {
            code: "NETWORK_ERROR",
            message: ERROR_MESSAGES.NETWORK_ERROR,
          };
        }
        if (
          error instanceof TypeError &&
          error.message.indexOf("fetch") !== -1
        ) {
          throw {
            code: "NETWORK_ERROR",
            message: ERROR_MESSAGES.NETWORK_ERROR,
          };
        }
        if (error.code) throw error;
        throw {
          code: "UNKNOWN_ERROR",
          message: ERROR_MESSAGES.UNKNOWN_ERROR,
          originalError: error,
        };
      });
  }

  function generateSubjectLinesAPI(userPrompt, context) {
    return callProxyAPI("/generate-subjects", {
      prompt: userPrompt,
      context: context || {},
    }).then(function (response) {
      if (!response.success || !response.subjects)
        throw { code: "INVALID_RESPONSE", message: "Invalid response" };
      return { subjects: response.subjects, usage: response.usage };
    });
  }

  function getSubjectFeedbackAPI(subjectLine, context) {
    var payload = { subject: subjectLine };
    if (context && Object.keys(context).length) payload.context = context;
    return callProxyAPI("/feedback-subject", payload).then(function (response) {
      if (!response.success || !response.feedback)
        throw { code: "INVALID_RESPONSE", message: "Invalid response" };
      return { feedback: response.feedback, usage: response.usage };
    });
  }

  function processParagraphAPI(text, action, options) {
    return callProxyAPI("/process-paragraph", {
      text: text,
      action: action,
      options: options || {},
    }).then(function (response) {
      if (!response.success || !response.text)
        throw { code: "INVALID_RESPONSE", message: "Invalid response" };
      return {
        text: response.text,
        synonyms: response.synonyms || null,
        rephraseOptions: response.rephraseOptions || null,
        changes: response.changes || null,
        usage: response.usage,
      };
    });
  }

  function submitFeedbackAPI(feedback) {
    return callProxyAPI("/submit-feedback", { feedback: feedback });
  }

  function askKnowledgeBaseAPI(question, conversationId) {
    var payload = { question: question };
    if (conversationId) payload.conversation_id = conversationId;
    return callProxyAPI("/ask-kb", payload, { timeout: 45000 }).then(
      function (response) {
        if (!response.success || !response.answer)
          throw { code: "INVALID_RESPONSE", message: "Invalid response" };
        return {
          answer: response.answer,
          conversationId: response.conversation_id || null,
          citations: response.citations || [],
        };
      },
    );
  }

  function summarizeMailingAPI(subject, body, format, options) {
    return callProxyAPI(
      "/summarize",
      { subject: subject, body: body, format: format, options: options || {} },
      { timeout: 45000 },
    ).then(function (response) {
      if (!response.success || !response.summary)
        throw { code: "INVALID_RESPONSE", message: "Invalid response" };
      return { summary: response.summary, usage: response.usage };
    });
  }

  function getErrorMessage(error) {
    if (error && error.message) return error.message;
    return ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  // ===== STATE =====
  var floatingIcon = null;
  var sidebar = null;
  var currentNudge = null;
  var subjectField = null;
  var lastSubjectValue = "";
  var extensionDisabled = false;
  var subjectListenersAttached = false;

  // Paragraph Coach state
  var currentSelection = null;
  var selectedText = "";
  var selectedEditor = null;
  var selectedEditorDoc = null;
  var currentSidebarMode = "subject";
  var editorIframe = null;
  var editorIframeObserver = null;
  var dialogObserver = null;
  var scanThrottleTimer = null;
  var selectionUpdateTimer = null;
  var subjectFieldUpdateTimer = null;
  var iconVisibilityTimer = null;
  var paragraphIconDocs = new Set();

  // Undo state
  var undoState = null;
  var undoToastTimer = null;

  // Cross-frame state
  var proEditorSource = null;
  var proEditorBlockType = "text";
  var proEditorContext = "";

  // Knowledge Base state
  var kbConversation = [];
  var kbConversationId = null;
  var kbBusy = false;

  // Loading state
  var loadingMessageTimer = null;

  // Icon overlay
  var iconOverlayContainer = null;
  var elementToIconMap = new WeakMap();
  var iconPositionUpdateTimer = null;

  // Pro editor
  var proEditorObserver = null;
  var proStageObserver = null;

  // ===== EVENT EMITTER =====
  var eventCallbacks = {};

  function emit(eventName, detail) {
    window.dispatchEvent(
      new CustomEvent(EVENT_PREFIX + eventName, { detail: detail }),
    );
    if (eventCallbacks[eventName]) {
      eventCallbacks[eventName].forEach(function (cb) {
        try {
          cb(detail);
        } catch (e) {
          /* ignore callback errors */
        }
      });
    }
  }

  // ===== CSS INJECTION =====
  function injectStyles() {
    if (document.getElementById("smartpr-widget-styles")) return;
    var styleEl = document.createElement("style");
    styleEl.id = "smartpr-widget-styles";
    styleEl.textContent = getCSSText();
    document.head.appendChild(styleEl);
  }

  function getCSSText() {
    return (
      "/* Smart.pr Widget Styles */" +
      "\n@keyframes smartpr-iconFadeIn{from{opacity:0;transform:scale(.8) rotate(-10deg)}to{opacity:1;transform:scale(1) rotate(0)}}" +
      "\n@keyframes smartpr-iconPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.15)}}" +
      "\n@keyframes smartpr-gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}" +
      "\n@keyframes smartpr-spin{to{transform:rotate(360deg)}}" +
      "\n@keyframes smartpr-slideIn{from{opacity:0;transform:translateY(-12px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}" +
      "\n@keyframes smartpr-toastSlideIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}" +
      "\n@keyframes smartpr-cascadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}" +
      "\n@keyframes smartpr-viewFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}" +
      "\n@keyframes smartpr-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}" +
      "\n@keyframes smartpr-sparkleBurst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--sx),var(--sy)) scale(0);opacity:0}}" +
      "\n@keyframes smartpr-blink{0%,100%{opacity:1}50%{opacity:0}}" +
      "\n@keyframes smartpr-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}" +
      "\n@keyframes smartpr-badgePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}" +
      "\n@keyframes smartpr-kbTypingBounce{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}" +
      "\n@keyframes smartpr-paragraphNudgeIn{from{opacity:0;transform:translateY(-8px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}" +
      "\n#smartpr-widget-root{position:fixed;inset:0;pointer-events:none;z-index:9998;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}" +
      "\n#smartpr-helper-icon{position:fixed;bottom:80px;right:20px;width:48px;height:48px;max-width:48px;max-height:48px;" +
      "background:linear-gradient(135deg,#FFD580 0%,#FFBC7F 20%,#FFB4A0 40%,#FFB0C0 60%,#E8B5E8 80%,#D4A5F5 100%);" +
      "border-radius:50%;border:none;padding:0;margin:0;cursor:pointer;z-index:9999;pointer-events:auto;" +
      "display:flex;align-items:center;justify-content:center;" +
      "box-shadow:0 1px 6px 0 rgba(0,0,0,.06),0 2px 32px 0 rgba(0,0,0,.16);" +
      "transition:transform 167ms cubic-bezier(.33,0,0,1),filter .3s ease;" +
      "animation:smartpr-iconFadeIn .5s ease-out;filter:brightness(1);box-sizing:content-box}" +
      "\n#smartpr-helper-icon:hover{transform:scale(1.1) translateY(-2px);filter:brightness(1.1)}" +
      "\n#smartpr-helper-icon:active{transform:scale(1.05)}" +
      "\n#smartpr-helper-icon.smartpr-sidebar-open{background:linear-gradient(135deg,#E8B5E8 0%,#D4A5F5 50%,#C8A8F8 100%);animation:smartpr-iconPulse 2s ease-in-out infinite}" +
      "\n.smartpr-icon-inner{width:32px;height:32px;display:flex;align-items:center;justify-content:center;transition:transform .4s cubic-bezier(.68,-.55,.265,1.55)}" +
      "\n#smartpr-helper-icon.smartpr-sidebar-open .smartpr-icon-inner{transform:rotate(180deg) scale(1.1)}" +
      "\n.smartpr-icon-badge{position:absolute;top:-4px;right:-4px;width:22px;height:22px;background:linear-gradient(135deg,#FF6B9D 0%,#FFA07A 100%);" +
      "border:3px solid white;border-radius:50%;font-size:11px;font-weight:700;color:white;display:none;align-items:center;justify-content:center;" +
      "animation:smartpr-badgePulse 2s ease-in-out infinite;box-shadow:0 2px 8px rgba(255,107,157,.4)}" +
      "\n.smartpr-icon-badge.smartpr-show{display:flex}" +
      "\n#smartpr-helper-sidebar{position:fixed;top:0;right:-400px;width:400px;height:100vh;" +
      "background:linear-gradient(135deg,#FFFBF7 0%,#FFF8F5 15%,#FFF5F8 30%,#FAF5FF 45%,#FFFBF7 55%,#FFF8F5 70%,#FFF5F8 85%,#FAF5FF 100%);" +
      "background-size:400% 400%;animation:smartpr-gradientShift 20s ease infinite;animation-play-state:paused;" +
      "backdrop-filter:blur(20px);border-left:1px solid rgba(212,165,245,.3);" +
      "box-shadow:-4px 0 24px rgba(0,0,0,.08),-1px 0 6px rgba(212,165,245,.25);" +
      "z-index:9999;pointer-events:auto;transition:right .4s cubic-bezier(.4,0,.2,1);" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;" +
      "display:flex;flex-direction:column}" +
      "\n#smartpr-helper-sidebar.smartpr-open{right:0;animation-play-state:running}" +
      "\n.smartpr-header{padding:24px 28px;border-bottom:2px solid rgba(232,181,232,.2);display:flex;justify-content:space-between;align-items:center;" +
      "background:linear-gradient(135deg,rgba(255,213,128,.15) 0%,rgba(255,188,127,.15) 50%,rgba(232,181,232,.15) 100%)}" +
      "\n.smartpr-header-left{display:flex;align-items:center;gap:8px;min-width:0}" +
      "\n.smartpr-back{display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:8px;" +
      "background:rgba(255,255,255,.5);color:#6B5B8C;cursor:pointer;flex-shrink:0;transition:all .2s ease}" +
      "\n.smartpr-back:hover{background:rgba(255,255,255,.9);color:#0a313c}" +
      "\n.smartpr-title{font-size:22px;font-weight:600;color:#0a313c;margin:0;letter-spacing:-.5px}" +
      "\n.smartpr-close{background:rgba(255,255,255,.6);border:2px solid rgba(232,181,232,.3);color:#6B5B8C;cursor:pointer;" +
      "width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:12px;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1);backdrop-filter:blur(10px)}" +
      "\n.smartpr-close:hover{background:rgba(255,255,255,.9);border-color:rgba(232,181,232,.6);transform:scale(1.1) rotate(90deg)}" +
      "\n.smartpr-content{flex:1;overflow-y:auto;padding:24px}" +
      "\n.smartpr-section{margin-bottom:24px}" +
      "\n.smartpr-label{font-size:12px;font-weight:600;color:#9B8FB8;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;display:block}" +
      "\n.smartpr-current-subject{background:linear-gradient(135deg,rgba(255,213,128,.15) 0%,rgba(255,176,192,.15) 100%);" +
      "padding:16px 20px;border-radius:16px;font-size:15px;color:#2D1B4E;line-height:1.6;margin-bottom:16px;" +
      "border:2px solid rgba(255,188,127,.3);font-weight:500}" +
      "\n.smartpr-description{font-size:15px;color:#6B5B8C;line-height:1.7;margin-bottom:20px}" +
      "\n.smartpr-textarea{width:100%;padding:14px 18px;background:rgba(255,255,255,.7);border:2px solid rgba(232,181,232,.3);" +
      "border-radius:14px;font-size:15px;font-family:inherit;color:#2D1B4E;line-height:1.6;resize:vertical;" +
      "margin-bottom:16px;transition:all .3s ease;min-height:100px;box-sizing:border-box}" +
      "\n.smartpr-textarea::placeholder{color:#9B8FB8;opacity:.7}" +
      "\n.smartpr-textarea:focus{outline:none;border-color:rgba(255,188,127,.6);background:rgba(255,255,255,.9);box-shadow:0 0 0 4px rgba(255,188,127,.1)}" +
      "\n.smartpr-button{width:100%;padding:14px 24px;background:linear-gradient(135deg,#FFD580 0%,#FFBC7F 20%,#FFB4A0 40%,#FFB0C0 60%,#E8B5E8 80%,#D4A5F5 100%);" +
      "color:white;border:none;border-radius:16px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1);margin-bottom:10px;position:relative;overflow:hidden;" +
      "box-shadow:0 4px 16px rgba(255,188,127,.3)}" +
      "\n.smartpr-button:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(255,188,127,.4)}" +
      "\n.smartpr-button:active{transform:translateY(0)}" +
      "\n.smartpr-button:disabled{background:linear-gradient(135deg,#E5E7EB 0%,#D1D5DB 100%);cursor:not-allowed;transform:none;box-shadow:none}" +
      "\n.smartpr-button-secondary{background:rgba(255,255,255,.7);color:#2D1B4E;border:2px solid rgba(232,181,232,.3);" +
      "box-shadow:0 2px 8px rgba(232,181,232,.2)}" +
      "\n.smartpr-button-secondary:hover{background:rgba(255,255,255,.9);border-color:rgba(232,181,232,.5);box-shadow:0 4px 16px rgba(232,181,232,.3)}" +
      "\n.smartpr-suggestions{display:flex;flex-direction:column;gap:14px}" +
      "\n.smartpr-suggestion-item{background:rgba(255,255,255,.8);border:2px solid rgba(232,181,232,.25);border-radius:16px;" +
      "padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1)}" +
      "\n.smartpr-suggestion-item:hover{border-color:rgba(255,188,127,.6);box-shadow:0 4px 16px rgba(255,188,127,.2);transform:translateY(-2px)}" +
      "\n.smartpr-suggestion-text{flex:1;font-size:15px;color:#2D1B4E;line-height:1.6}" +
      "\n.smartpr-suggestion-actions{display:flex;gap:6px;flex-shrink:0}" +
      "\n.smartpr-use-button{background:linear-gradient(135deg,#FFD580,#FFBC7F,#E8B5E8);color:white;border:none;border-radius:10px;" +
      "padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 8px rgba(255,188,127,.3);min-width:72px;text-align:center;font-family:inherit}" +
      "\n.smartpr-use-button:hover{transform:scale(1.05)}" +
      "\n.smartpr-use-button.smartpr-copied{background:linear-gradient(135deg,#86EFAC 0%,#34D399 100%)}" +
      "\n.smartpr-copy-button{background:linear-gradient(135deg,#E8B5E8 0%,#D4A5F5 50%,#C8A8F8 100%);color:white;border:none;border-radius:10px;" +
      "padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 8px rgba(212,165,245,.3);min-width:72px;text-align:center;font-family:inherit}" +
      "\n.smartpr-copy-button:hover{transform:scale(1.05)}" +
      "\n.smartpr-copy-button.smartpr-copied{background:linear-gradient(135deg,#86EFAC 0%,#34D399 100%)}" +
      "\n.smartpr-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px}" +
      "\n.smartpr-spinner{width:48px;height:48px;border:4px solid transparent;border-top-color:#FFD580;border-right-color:#FFB0C0;" +
      "border-bottom-color:#E8B5E8;border-left-color:#D4A5F5;border-radius:50%;animation:smartpr-spin 1.2s cubic-bezier(.68,-.55,.265,1.55) infinite;margin-bottom:20px}" +
      "\n.smartpr-loading-text{font-size:15px;color:#6B5B8C;font-weight:500}" +
      "\n.smartpr-error{background:linear-gradient(135deg,rgba(255,180,180,.2) 0%,rgba(255,200,200,.2) 100%);" +
      "border:2px solid rgba(255,120,120,.3);border-radius:14px;padding:16px 20px;margin-bottom:16px}" +
      "\n.smartpr-error-text{font-size:14px;color:#991b1b;line-height:1.6;font-weight:500}" +
      "\n.smartpr-nudge{position:fixed;background:linear-gradient(135deg,rgba(255,255,255,.95) 0%,rgba(255,250,255,.95) 100%);" +
      "border:2px solid rgba(232,181,232,.4);border-radius:18px;padding:14px 18px;" +
      "box-shadow:0 8px 24px rgba(212,165,245,.3);z-index:9999;pointer-events:auto;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;" +
      "font-size:15px;color:#2D1B4E;font-weight:500;max-width:300px;display:flex;align-items:center;gap:14px;" +
      "cursor:pointer;transition:all .3s cubic-bezier(.34,1.56,.64,1);animation:smartpr-slideIn .4s ease-out}" +
      "\n.smartpr-nudge:hover{transform:translateY(-3px) scale(1.02);box-shadow:0 12px 32px rgba(212,165,245,.4)}" +
      "\n.smartpr-nudge-close{background:rgba(232,181,232,.15);border:none;color:#9B8FB8;font-size:20px;cursor:pointer;" +
      "padding:4px 6px;line-height:1;flex-shrink:0;border-radius:8px;transition:all .2s}" +
      "\n.smartpr-nudge-close:hover{background:rgba(232,181,232,.3);color:#6B5B8C}" +
      "\n.smartpr-toast{position:fixed;bottom:32px;left:50%;transform:translateX(-50%);" +
      "background:linear-gradient(135deg,#FFD580,#FFBC7F,#E8B5E8);color:white;padding:14px 24px;" +
      "border-radius:16px;font-size:15px;font-weight:600;z-index:99999;pointer-events:auto;" +
      "animation:smartpr-toastSlideIn .4s cubic-bezier(.34,1.56,.64,1);box-shadow:0 8px 24px rgba(255,188,127,.4);" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}" +
      "\n.smartpr-empty{text-align:center;padding:48px 24px}" +
      "\n.smartpr-empty-icon{font-size:64px;margin-bottom:20px;animation:smartpr-float 4s ease-in-out infinite}" +
      "\n.smartpr-empty-text{font-size:15px;line-height:1.7;color:#6B5B8C;font-weight:500}" +
      "\n.smartpr-action-buttons{display:grid;grid-template-columns:1fr 1fr;gap:12px}" +
      "\n.smartpr-action-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:20px 16px;" +
      "min-height:110px;background:rgba(255,255,255,.8);border:2px solid rgba(232,181,232,.3);border-radius:16px;cursor:pointer;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1);font-family:inherit}" +
      "\n.smartpr-action-btn:hover{background:rgba(255,255,255,.95);border-color:rgba(255,188,127,.6);box-shadow:0 4px 16px rgba(255,188,127,.25);transform:translateY(-3px)}" +
      "\n.smartpr-action-icon{font-size:24px;line-height:1}" +
      "\n.smartpr-action-label{font-size:13px;font-weight:600;color:#2D1B4E;text-align:center;line-height:1.3;white-space:pre-line}" +
      "\n.smartpr-action-desc{font-size:11px;font-weight:400;color:#9B8FB8;text-align:center;line-height:1.3}" +
      "\n.smartpr-original-text{background:rgba(200,200,200,.15);padding:14px 18px;border-radius:12px;font-size:14px;" +
      "color:#6B5B8C;line-height:1.6;border:1px solid rgba(200,200,200,.3);font-style:italic}" +
      "\n.smartpr-result-text{background:linear-gradient(135deg,rgba(134,239,172,.15) 0%,rgba(52,211,153,.15) 100%);" +
      "padding:18px 20px;border-radius:14px;font-size:15px;color:#2D1B4E;line-height:1.7;" +
      "border:2px solid rgba(52,211,153,.3);white-space:pre-wrap}" +
      "\n.smartpr-result-actions{display:flex;flex-direction:column;gap:10px}" +
      "\n.smartpr-result-actions .smartpr-button{width:100%;margin-bottom:0;padding:14px 16px;font-size:14px}" +
      "\n.smartpr-synonym-list{display:flex;flex-direction:column;gap:8px}" +
      "\n.smartpr-synonym-option{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;" +
      "background:rgba(255,255,255,.8);border:2px solid rgba(232,181,232,.25);border-radius:12px;transition:all .2s ease}" +
      "\n.smartpr-synonym-option.smartpr-rephrase-option{flex-direction:column;align-items:stretch;gap:8px}" +
      "\n.smartpr-synonym-option:hover{border-color:rgba(255,188,127,.5);background:rgba(255,255,255,.95)}" +
      "\n.smartpr-synonym-option.smartpr-feedback-positive{border-color:rgba(52,211,153,.3);background:rgba(236,253,245,.8)}" +
      "\n.smartpr-synonym-option.smartpr-feedback-improvement{border-color:rgba(251,191,36,.3);background:rgba(255,251,235,.8)}" +
      "\n.smartpr-synonym-text{font-size:14px;color:#2D1B4E;flex:1;line-height:1.4;min-width:0;word-break:break-word}" +
      "\n.smartpr-synonym-actions{display:flex;gap:6px;margin-left:10px;flex-shrink:0}" +
      "\n.smartpr-rephrase-option .smartpr-synonym-actions{margin-left:0}" +
      "\n.smartpr-synonym-btn{padding:5px 10px;font-size:11px;font-weight:600;font-family:inherit;border-radius:8px;" +
      "border:1.5px solid rgba(200,200,200,.4);cursor:pointer;transition:all .2s ease;background:rgba(255,255,255,.9);" +
      "color:#6B5B8C;white-space:nowrap;min-width:42px;text-align:center}" +
      "\n.smartpr-synonym-btn:hover{transform:translateY(-1px)}" +
      "\n.smartpr-synonym-copy:hover{background:linear-gradient(135deg,#E8B5E8,#D4A5F5,#C8A8F8);color:white;border-color:transparent}" +
      "\n.smartpr-synonym-inject{background:linear-gradient(135deg,rgba(134,239,172,.15),rgba(52,211,153,.15));border-color:rgba(52,211,153,.35);color:#059669}" +
      "\n.smartpr-synonym-inject:hover{background:linear-gradient(135deg,#34d399,#10b981);color:white;border-color:transparent}" +
      "\n.smartpr-changes-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}" +
      "\n.smartpr-change-item{padding:8px 12px;background:rgba(255,188,127,.1);border-radius:8px;font-size:13px;" +
      "color:#6B5B8C;line-height:1.4;border-left:3px solid rgba(255,188,127,.5)}" +
      "\n.smartpr-word-count-badge{display:inline-block;padding:4px 12px;background:linear-gradient(135deg,rgba(232,181,232,.2),rgba(212,165,245,.2));" +
      "border:1.5px solid rgba(212,165,245,.35);border-radius:20px;font-size:12px;font-weight:600;color:#6B5B8C;margin-bottom:10px}" +
      "\n.smartpr-footer{padding:12px 24px;border-top:1px solid rgba(232,181,232,.2);flex-shrink:0;text-align:center}" +
      "\n.smartpr-feedback-link{background:none;border:none;font-family:inherit;font-size:12px;color:#9B8FB8;cursor:pointer;padding:0;transition:color .2s ease}" +
      "\n.smartpr-feedback-link:hover{color:#6B5B8C}" +
      "\n.smartpr-feedback-form{display:flex;flex-direction:column;gap:8px}" +
      "\n.smartpr-feedback-textarea{width:100%;padding:10px 14px;background:rgba(255,255,255,.7);border:2px solid rgba(232,181,232,.3);" +
      "border-radius:10px;font-size:13px;font-family:inherit;color:#2D1B4E;resize:vertical;min-height:48px;box-sizing:border-box}" +
      "\n.smartpr-feedback-textarea:focus{outline:none;border-color:rgba(255,188,127,.5);background:rgba(255,255,255,.9)}" +
      "\n.smartpr-feedback-actions{display:flex;gap:8px;align-items:center}" +
      "\n.smartpr-feedback-send{padding:6px 16px;background:linear-gradient(135deg,#FFD580,#FFBC7F,#E8B5E8);color:white;border:none;" +
      "border-radius:8px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .2s ease}" +
      "\n.smartpr-feedback-send:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(255,188,127,.3)}" +
      "\n.smartpr-feedback-send:disabled{opacity:.6;cursor:default;transform:none}" +
      "\n.smartpr-feedback-cancel{background:none;border:none;font-family:inherit;font-size:12px;color:#9B8FB8;cursor:pointer;padding:4px 8px}" +
      "\n.smartpr-feedback-cancel:hover{color:#6B5B8C}" +
      "\n.smartpr-cascade-item{animation:smartpr-cascadeIn .3s ease-out both}" +
      "\n.smartpr-view-enter{animation:smartpr-viewFadeIn .2s ease-out both}" +
      "\n.smartpr-skeleton{background:linear-gradient(90deg,rgba(232,181,232,.1) 25%,rgba(232,181,232,.25) 50%,rgba(232,181,232,.1) 75%);" +
      "background-size:200% 100%;animation:smartpr-shimmer 1.5s ease-in-out infinite;border-radius:12px}" +
      "\n.smartpr-skeleton-card{height:48px;border-radius:12px;margin-bottom:8px}" +
      "\n.smartpr-skeleton-text{height:80px;border-radius:14px}" +
      "\n.smartpr-skeleton-label{height:12px;width:120px;border-radius:6px;margin-bottom:12px}" +
      "\n.smartpr-sparkle{position:absolute;width:6px;height:6px;border-radius:50%;pointer-events:none;z-index:9999;animation:smartpr-sparkleBurst .5s ease-out forwards}" +
      "\n.smartpr-diff-highlight{background:rgba(255,188,127,.3);border-radius:3px;padding:1px 3px;font-weight:600}" +
      "\n.smartpr-typing-cursor{display:inline;color:#9B8FB8;animation:smartpr-blink .8s step-end infinite;font-weight:300}" +
      "\n.smartpr-undo-toast{display:flex;align-items:center;gap:12px}" +
      "\n.smartpr-undo-btn{background:rgba(255,255,255,.3);color:white;border:1.5px solid rgba(255,255,255,.5);border-radius:8px;" +
      "padding:4px 12px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .2s ease;white-space:nowrap}" +
      "\n.smartpr-undo-btn:hover{background:rgba(255,255,255,.5)}" +
      "\n.smartpr-tone-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}" +
      "\n.smartpr-tone-btn{padding:10px 12px;background:rgba(255,255,255,.8);border:2px solid rgba(232,181,232,.3);" +
      "border-radius:12px;font-size:14px;font-weight:600;color:#2D1B4E;cursor:pointer;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1);text-align:center;font-family:inherit}" +
      "\n.smartpr-tone-btn:hover{background:linear-gradient(135deg,#FFD580,#FFBC7F,#E8B5E8);border-color:transparent;color:white;transform:translateY(-2px)}" +
      "\n.smartpr-language-buttons{display:flex;gap:10px;margin-bottom:16px}" +
      "\n.smartpr-lang-btn{flex:1;padding:14px 12px;background:rgba(255,255,255,.8);border:2px solid rgba(232,181,232,.3);" +
      "border-radius:12px;font-size:15px;font-weight:700;color:#2D1B4E;cursor:pointer;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1);font-family:inherit}" +
      "\n.smartpr-lang-btn:hover{background:linear-gradient(135deg,#FFD580,#FFBC7F,#E8B5E8);border-color:transparent;color:white;transform:translateY(-2px)}" +
      "\n.smartpr-other-lang{display:flex;gap:10px;align-items:stretch;margin-top:12px}" +
      "\n.smartpr-input{flex:1;padding:12px 16px;background:rgba(255,255,255,.7);border:2px solid rgba(232,181,232,.3);" +
      "border-radius:12px;font-size:14px;font-family:inherit;color:#2D1B4E;transition:all .3s ease;box-sizing:border-box}" +
      "\n.smartpr-input::placeholder{color:#9B8FB8;opacity:.7}" +
      "\n.smartpr-input:focus{outline:none;border-color:rgba(255,188,127,.6);background:rgba(255,255,255,.9);box-shadow:0 0 0 4px rgba(255,188,127,.1)}" +
      "\n.smartpr-other-lang .smartpr-button{margin-bottom:0;white-space:nowrap;padding:12px 20px}" +
      "\n.smartpr-kb-conversation{max-height:calc(100vh - 220px);overflow-y:auto;padding-bottom:8px}" +
      "\n.smartpr-kb-message{margin-bottom:12px;padding:14px 18px;border-radius:16px;font-size:14px;line-height:1.6;word-break:break-word}" +
      "\n.smartpr-kb-user{background:linear-gradient(135deg,rgba(255,213,128,.18) 0%,rgba(232,181,232,.18) 100%);" +
      "border:2px solid rgba(255,188,127,.3);color:#2D1B4E;font-weight:500}" +
      "\n.smartpr-kb-assistant{background:rgba(255,255,255,.8);border:2px solid rgba(232,181,232,.2);color:#2D1B4E}" +
      "\n.smartpr-kb-assistant p{margin-bottom:8px}.smartpr-kb-assistant p:last-child{margin-bottom:0}" +
      "\n.smartpr-kb-assistant ul,.smartpr-kb-assistant ol{padding-left:20px;margin:8px 0}" +
      "\n.smartpr-kb-assistant li{margin-bottom:4px}" +
      "\n.smartpr-kb-assistant code{background:rgba(232,181,232,.15);padding:2px 6px;border-radius:4px;font-size:13px}" +
      "\n.smartpr-kb-typing{display:flex;gap:4px;padding:4px 0}" +
      "\n.smartpr-kb-typing-dot{width:8px;height:8px;border-radius:50%;background:#9B8FB8;animation:smartpr-kbTypingBounce 1.4s ease-in-out infinite}" +
      "\n.smartpr-kb-typing-dot:nth-child(2){animation-delay:.2s}" +
      "\n.smartpr-kb-typing-dot:nth-child(3){animation-delay:.4s}" +
      "\n.smartpr-kb-loading-text{font-size:12px;color:#9B8FB8;margin-top:6px;transition:opacity .2s ease}" +
      "\n.smartpr-kb-input-section{position:sticky;bottom:0;background:inherit;padding-top:8px}" +
      "\n.smartpr-kb-input-row{display:flex;gap:10px;align-items:stretch}" +
      "\n.smartpr-kb-input{flex:1;padding:12px 16px;min-height:auto;margin-bottom:0}" +
      "\n.smartpr-kb-ask-btn{padding:12px 20px;background:linear-gradient(135deg,#FFD580,#FFBC7F,#E8B5E8);color:white;border:none;" +
      "border-radius:12px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 8px rgba(255,188,127,.3);white-space:nowrap}" +
      "\n.smartpr-kb-ask-btn:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(255,188,127,.4)}" +
      "\n.smartpr-kb-ask-btn:disabled{background:linear-gradient(135deg,#E5E7EB 0%,#D1D5DB 100%);cursor:not-allowed;transform:none;box-shadow:none}" +
      "\n.smartpr-kb-suggestions{display:flex;flex-direction:column;gap:8px}" +
      "\n.smartpr-kb-suggestion-btn{padding:12px 16px;background:rgba(255,255,255,.8);border:2px solid rgba(232,181,232,.25);" +
      "border-radius:12px;font-size:13px;font-weight:500;color:#2D1B4E;cursor:pointer;text-align:left;" +
      "transition:all .3s cubic-bezier(.34,1.56,.64,1);font-family:inherit}" +
      "\n.smartpr-kb-suggestion-btn:hover{border-color:rgba(255,188,127,.5);background:rgba(255,255,255,.95);transform:translateY(-2px)}" +
      "\n.smartpr-kb-actions-row{margin-top:8px;text-align:center}" +
      "\n.smartpr-kb-new-btn{background:none;border:none;font-family:inherit;font-size:12px;color:#9B8FB8;cursor:pointer;padding:4px 8px}" +
      "\n.smartpr-kb-new-btn:hover{color:#6B5B8C}" +
      "\n.smartpr-block-icon{position:absolute;width:32px;height:32px;border:none;border-radius:50%;" +
      "background:linear-gradient(135deg,#FFD580 0%,#FFBC7F 50%,#E8B5E8 100%);color:white;font-size:16px;" +
      "cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease;" +
      "display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(212,165,245,.3);z-index:100}" +
      "\n.smartpr-block-icon.smartpr-visible{opacity:1;pointer-events:auto}" +
      "\n.smartpr-block-icon:hover{transform:scale(1.1);box-shadow:0 4px 12px rgba(212,165,245,.5)}"
    );
  }

  // ===== DOM HELPERS =====
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  // ===== EDITOR DETECTION =====
  function findTipTapEditors(doc) {
    doc = doc || document;
    var editors = Array.from(
      doc.querySelectorAll('.tiptap.ProseMirror[contenteditable="true"]'),
    );
    if (editors.length === 0)
      editors = Array.from(doc.querySelectorAll(".tiptap.ProseMirror"));
    return editors;
  }

  function findHeadingInputs(doc) {
    doc = doc || document;
    var h1 = Array.from(doc.querySelectorAll(".block-wrapper h1 > input"));
    var h2 = Array.from(doc.querySelectorAll(".block-wrapper h2 > input"));
    return h1.concat(h2);
  }

  function findTinyMCEEditors(doc) {
    doc = doc || document;
    return Array.from(
      doc.querySelectorAll('.mce-content-body[contenteditable="true"]'),
    );
  }

  function findAllEditableBlocks(doc) {
    doc = doc || document;
    var tipTap = findTipTapEditors(doc).map(function (e) {
      return { element: e, type: "tiptap", doc: doc };
    });
    var headings = findHeadingInputs(doc).map(function (e) {
      return { element: e, type: "heading", doc: doc };
    });
    var tinyMCE = findTinyMCEEditors(doc).map(function (e) {
      return { element: e, type: "tiptap", doc: doc };
    });
    return tipTap.concat(headings).concat(tinyMCE);
  }

  function findEditorIframe() {
    var iframes = $$('iframe[src^="blob:"]');
    if (iframes.length === 0) {
      var sandboxed = $$('iframe[sandbox*="allow-same-origin"]');
      for (var i = 0; i < sandboxed.length; i++) {
        if (sandboxed[i].src && sandboxed[i].src.indexOf("blob:") === 0)
          return sandboxed[i];
      }
    }
    return iframes[0] || null;
  }

  function findEditorsInBlobIframe() {
    var iframe = findEditorIframe();
    if (!iframe) return [];
    try {
      var iframeDoc =
        iframe.contentDocument ||
        (iframe.contentWindow && iframe.contentWindow.document);
      if (!iframeDoc) return [];
      var blocks = findAllEditableBlocks(iframeDoc);
      return blocks.map(function (block) {
        return {
          element: block.element,
          type: block.type,
          iframeDoc: iframeDoc,
          iframe: iframe,
        };
      });
    } catch (e) {
      return [];
    }
  }

  function getEditorContainer(editor) {
    return (
      editor.closest(".module-box") ||
      editor.closest(".block-wrapper") ||
      editor.parentElement
    );
  }

  function getBlockType(container) {
    if (!container) return "text";
    if (container.classList && container.classList.contains("module-box")) {
      if (container.classList.contains("module-box--heading")) return "heading";
      if (container.classList.contains("module-box--paragraph"))
        return "paragraph";
      return "text";
    }
    if (container.classList && container.classList.contains("block-wrapper")) {
      if (container.querySelector("h1 > input")) return "heading";
      if (container.querySelector("h2 > input")) return "subheading";
      if (container.querySelector(".tiptap.ProseMirror")) return "paragraph";
    }
    return "text";
  }

  function getActiveEditorFromSelection(doc) {
    var selection = doc.getSelection && doc.getSelection();
    if (!selection || selection.isCollapsed) return null;
    var selText = selection.toString();
    if (!selText || !selText.trim()) return null;
    var range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    var node =
      (range && range.commonAncestorContainer) ||
      selection.anchorNode ||
      selection.focusNode;
    var element =
      node && node.nodeType === 1 ? node : node && node.parentElement;
    return (
      (element && element.closest(".tiptap.ProseMirror")) ||
      (element && element.closest(".mce-content-body")) ||
      null
    );
  }

  // ===== ICON OVERLAY SYSTEM =====
  function getOrCreateIconOverlay(iframeDoc) {
    if (
      iconOverlayContainer &&
      iconOverlayContainer.ownerDocument === iframeDoc
    )
      return iconOverlayContainer;
    iconOverlayContainer = iframeDoc.createElement("div");
    iconOverlayContainer.id = "smartpr-icon-overlay";
    iconOverlayContainer.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
    iframeDoc.body.appendChild(iconOverlayContainer);
    if (!iframeDoc.getElementById("smartpr-injected-styles"))
      injectStylesIntoIframe(iframeDoc);
    return iconOverlayContainer;
  }

  function injectStylesIntoIframe(iframeDoc) {
    var style = iframeDoc.createElement("style");
    style.id = "smartpr-injected-styles";
    style.textContent =
      "#smartpr-icon-overlay{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999}" +
      ".smartpr-block-icon{position:absolute;width:32px;height:32px;border:none;border-radius:50%;" +
      "background:linear-gradient(135deg,#FFD580 0%,#FFBC7F 50%,#E8B5E8 100%);" +
      "color:white;font-size:16px;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease;" +
      "display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(212,165,245,.3)}" +
      ".smartpr-block-icon.smartpr-visible{opacity:1;pointer-events:auto}" +
      ".smartpr-block-icon:hover{transform:scale(1.1);box-shadow:0 4px 12px rgba(212,165,245,.5)}";
    iframeDoc.head.appendChild(style);
    var iframeWin = iframeDoc.defaultView;
    if (iframeWin && !iframeWin._smartprListeners) {
      iframeWin.addEventListener("scroll", updateAllIconPositions, {
        passive: true,
      });
      iframeWin.addEventListener("resize", updateAllIconPositions, {
        passive: true,
      });
      iframeWin._smartprListeners = true;
    }
  }

  function updateIconPosition(icon, element) {
    var container = getEditorContainer(element);
    if (!container) return;
    var rect = container.getBoundingClientRect();
    icon.style.top = rect.top + 4 + "px";
    icon.style.left = rect.right - 40 + "px";
  }

  function updateAllIconPositions() {
    if (iconPositionUpdateTimer) return;
    iconPositionUpdateTimer = requestAnimationFrame(function () {
      iconPositionUpdateTimer = null;
      if (!iconOverlayContainer) return;
      var icons = iconOverlayContainer.querySelectorAll(".smartpr-block-icon");
      icons.forEach(function (icon) {
        var el = icon._targetElement;
        if (el && el.isConnected) {
          updateIconPosition(icon, el);
        } else {
          icon.remove();
          if (el) elementToIconMap.delete(el);
        }
      });
    });
  }

  function setParagraphIconVisible(editor, isVisible) {
    var icon = elementToIconMap.get(editor);
    if (!icon) return;
    icon.classList.toggle("smartpr-visible", isVisible);
  }

  function clearVisibleParagraphIcons() {
    paragraphIconDocs.forEach(function (doc) {
      doc
        .querySelectorAll(
          ".smartpr-block-icon.smartpr-visible:not([data-input-managed])",
        )
        .forEach(function (icon) {
          icon.classList.remove("smartpr-visible");
        });
    });
  }

  function handleParagraphSelectionChange(doc) {
    if (iconVisibilityTimer) clearTimeout(iconVisibilityTimer);
    iconVisibilityTimer = setTimeout(function () {
      clearVisibleParagraphIcons();
      var editor = getActiveEditorFromSelection(doc);
      if (editor) setParagraphIconVisible(editor, true);
    }, 100);
  }

  function registerParagraphSelectionListener(doc) {
    if (!doc || doc._smartprSelHandler) return;
    var handler = function () {
      handleParagraphSelectionChange(doc);
    };
    doc.addEventListener("selectionchange", handler);
    doc._smartprSelHandler = handler;
    paragraphIconDocs.add(doc);
  }

  function addParagraphIcon(element, iframeDoc, elementType) {
    if (elementToIconMap.has(element)) return;
    var container = getEditorContainer(element);
    if (!container) return;
    var doc = iframeDoc || element.ownerDocument || document;
    var overlay = getOrCreateIconOverlay(doc);
    var iconBtn = doc.createElement("button");
    iconBtn.className = "smartpr-block-icon";
    iconBtn.innerHTML = LOGO_ICON_SMALL_SVG;
    iconBtn.title = t("paragraph.improveWithAI");
    iconBtn._targetElement = element;
    overlay.appendChild(iconBtn);
    updateIconPosition(iconBtn, element);
    elementToIconMap.set(element, iconBtn);

    if (elementType === "tiptap") {
      registerParagraphSelectionListener(doc);
      handleParagraphSelectionChange(doc);
    } else {
      iconBtn.dataset.inputManaged = "true";
      var checkSel = function () {
        var has = element.selectionStart !== element.selectionEnd;
        setParagraphIconVisible(element, has);
      };
      element.addEventListener("select", checkSel);
      element.addEventListener("keyup", checkSel);
      element.addEventListener("mouseup", checkSel);
      element.addEventListener("blur", function () {
        setTimeout(function () {
          setParagraphIconVisible(element, false);
        }, 200);
      });
    }

    iconBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var text = "";
      if (elementType === "heading") {
        text = (element.value && element.value.trim()) || "";
        currentSelection = null;
      } else {
        var win = iframeDoc ? iframeDoc.defaultView : window;
        var selection = win && win.getSelection();
        if (
          selection &&
          !selection.isCollapsed &&
          element.contains(selection.anchorNode)
        ) {
          text = selection.toString().trim();
          currentSelection = selection.getRangeAt(0).cloneRange();
        } else {
          text = element.innerText.trim();
          currentSelection = null;
        }
      }
      if (!text) return;
      selectedText = text;
      selectedEditor = element;
      selectedEditorDoc = iframeDoc;
      openParagraphCoachSidebar();
    });
  }

  function scanAndAddIcons() {
    var count = 0;
    var iframeBlocks = findEditorsInBlobIframe();
    iframeBlocks.forEach(function (b) {
      addParagraphIcon(b.element, b.iframeDoc, b.type);
    });
    count = iframeBlocks.length;
    return count;
  }

  function watchEditorIframe(iframe) {
    if (editorIframe === iframe && editorIframeObserver) return;
    if (editorIframeObserver) {
      editorIframeObserver.disconnect();
      editorIframeObserver = null;
    }
    editorIframe = iframe;
    try {
      var iframeDoc =
        iframe.contentDocument ||
        (iframe.contentWindow && iframe.contentWindow.document);
      if (!iframeDoc || !iframeDoc.body) {
        iframe.addEventListener(
          "load",
          function () {
            watchEditorIframe(iframe);
          },
          { once: true },
        );
        return;
      }
      setTimeout(function () {
        var count = scanAndAddIcons();
        if (count === 0) {
          setTimeout(function () {
            scanAndAddIcons();
          }, 500);
        }
      }, 200);
      editorIframeObserver = new MutationObserver(function () {
        if (scanThrottleTimer) return;
        scanThrottleTimer = setTimeout(function () {
          scanThrottleTimer = null;
          scanAndAddIcons();
          updateAllIconPositions();
        }, 300);
      });
      editorIframeObserver.observe(iframeDoc.body, {
        childList: true,
        subtree: true,
      });
      registerParagraphSelectionListener(iframeDoc);
    } catch (e) {
      /* iframe access error */
    }
  }

  // ===== SUBJECT FIELD DETECTION =====
  function findSubjectField() {
    var selectors = [
      'input[name="subject"]',
      'input[placeholder="Type your subject"]',
      'input[placeholder*="subject" i]',
      'input[placeholder*="onderwerp" i]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var field = $(selectors[i]);
      if (field) return field;
    }
    return null;
  }

  // ===== DIALOG WATCHER =====
  function initDialogWatcher() {
    if (dialogObserver) return;
    var checkForEditorIframe = function () {
      var iframe = findEditorIframe();
      if (iframe && iframe !== editorIframe) watchEditorIframe(iframe);
    };
    var checkForSubjectField = function () {
      var field = findSubjectField();
      if (field && field !== subjectField) {
        subjectField = field;
        if (!subjectListenersAttached) {
          subjectField.addEventListener("focus", handleSubjectFocus);
          subjectField.addEventListener("blur", hideNudgeOnBlur);
          subjectField.addEventListener("input", handleSubjectInput);
          subjectListenersAttached = true;
          setTimeout(function () {
            if (document.activeElement === subjectField && !currentNudge)
              handleSubjectFocus();
          }, 800);
        }
        lastSubjectValue = subjectField.value;
      }
    };
    checkForEditorIframe();
    checkForSubjectField();
    dialogObserver = new MutationObserver(function (mutations) {
      var shouldCheckIframe = false;
      var shouldCheckSubject = false;
      for (var m = 0; m < mutations.length; m++) {
        var added = mutations[m].addedNodes;
        for (var i = 0; i < added.length; i++) {
          var node = added[i];
          if (node.nodeType !== 1) continue;
          if (
            node.tagName === "IFRAME" ||
            (node.querySelector && node.querySelector("iframe"))
          )
            shouldCheckIframe = true;
          if (
            (node.querySelector &&
              node.querySelector('input[name="subject"]')) ||
            (node.matches && node.matches(".Dialog")) ||
            (node.querySelector && node.querySelector(".Dialog"))
          )
            shouldCheckSubject = true;
        }
        var removed = mutations[m].removedNodes;
        for (var j = 0; j < removed.length; j++) {
          var rNode = removed[j];
          if (rNode.nodeType !== 1) continue;
          if (
            (rNode.matches && rNode.matches(".Dialog")) ||
            (rNode.querySelector && rNode.querySelector(".Dialog"))
          )
            resetDetectionState();
        }
      }
      if (shouldCheckIframe) setTimeout(checkForEditorIframe, 100);
      if (shouldCheckSubject) setTimeout(checkForSubjectField, 100);
    });
    dialogObserver.observe(document.body, { childList: true, subtree: true });
  }

  function resetDetectionState() {
    if (scanThrottleTimer) {
      clearTimeout(scanThrottleTimer);
      scanThrottleTimer = null;
    }
    if (editorIframeObserver) {
      editorIframeObserver.disconnect();
      editorIframeObserver = null;
    }
    editorIframe = null;
    if (iconOverlayContainer) {
      iconOverlayContainer.remove();
      iconOverlayContainer = null;
    }
    elementToIconMap = new WeakMap();
    selectedEditor = null;
    selectedEditorDoc = null;
    selectedText = "";
    currentSelection = null;
    if (currentSidebarMode === "paragraph") closeSidebar();
    subjectListenersAttached = false;
    var field = findSubjectField();
    if (field) {
      subjectField = field;
      subjectField.addEventListener("focus", handleSubjectFocus);
      subjectField.addEventListener("blur", hideNudgeOnBlur);
      subjectField.addEventListener("input", handleSubjectInput);
      subjectListenersAttached = true;
      lastSubjectValue = subjectField.value;
    }
  }

  // ===== NUDGE SYSTEM =====
  function getNudgeMessage(type) {
    var hour = new Date().getHours();
    var greeting =
      hour >= 5 && hour < 12
        ? t("nudge.morning")
        : hour >= 12 && hour < 17
          ? t("nudge.afternoon")
          : t("nudge.evening");
    return type === "empty"
      ? greeting + " " + t("nudge.emptySubject")
      : greeting + " " + t("nudge.filledSubject");
  }

  function showNudge(message, type) {
    if (extensionDisabled || currentNudge) return;
    var rect = subjectField.getBoundingClientRect();
    currentNudge = document.createElement("div");
    currentNudge.className = "smartpr-nudge";
    currentNudge.dataset.type = type;
    currentNudge.style.top = rect.bottom + window.scrollY + 12 + "px";
    currentNudge.style.left = rect.left + window.scrollX + "px";
    currentNudge.innerHTML =
      '<span style="font-size:24px">\u2728</span>' +
      '<span style="flex:1;line-height:1.5">' +
      message +
      "</span>" +
      '<button class="smartpr-nudge-close">\u00d7</button>';
    document.body.appendChild(currentNudge);
    currentNudge.addEventListener("click", function (e) {
      if (!e.target.classList.contains("smartpr-nudge-close")) {
        openSidebar(type);
        hideNudge();
      }
    });
    currentNudge
      .querySelector(".smartpr-nudge-close")
      .addEventListener("click", function (e) {
        e.stopPropagation();
        hideNudge();
      });
  }

  function hideNudge() {
    if (currentNudge) {
      currentNudge.remove();
      currentNudge = null;
    }
  }

  function hideNudgeOnBlur() {
    setTimeout(hideNudge, 150);
  }

  function handleSubjectFocus() {
    if (extensionDisabled) return;
    var val = subjectField.value.trim();
    if (sidebar && sidebar.classList.contains("smartpr-open")) return;
    showNudge(
      getNudgeMessage(val === "" ? "empty" : "filled"),
      val === "" ? "empty" : "filled",
    );
  }

  function handleSubjectInput() {
    if (extensionDisabled) return;
    var newVal = subjectField.value;
    if (Math.abs(newVal.length - lastSubjectValue.length) > 5) hideNudge();
    lastSubjectValue = newVal;
  }

  // ===== FLOATING ICON =====
  function createFloatingIcon() {
    if (extensionDisabled) return null;
    var root = document.getElementById("smartpr-widget-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "smartpr-widget-root";
      document.body.appendChild(root);
    }
    floatingIcon = document.createElement("button");
    floatingIcon.id = "smartpr-helper-icon";
    floatingIcon.type = "button";
    floatingIcon.setAttribute("aria-label", "Open Smart.pr Assistant");
    floatingIcon.innerHTML =
      '<div class="smartpr-icon-inner">' +
      LOGO_WHITE_SVG +
      "</div>" +
      '<div class="smartpr-icon-badge"></div>';
    root.appendChild(floatingIcon);
    floatingIcon.addEventListener("click", function () {
      if (sidebar && sidebar.classList.contains("smartpr-open")) closeSidebar();
      else openSidebarFromIcon();
    });
    return floatingIcon;
  }

  function updateFloatingIcon(isOpen) {
    if (!floatingIcon) return;
    floatingIcon.classList.toggle("smartpr-sidebar-open", isOpen);
  }

  function hideIconBadge() {
    if (!floatingIcon) return;
    var badge = floatingIcon.querySelector(".smartpr-icon-badge");
    if (badge) badge.classList.remove("smartpr-show");
  }

  // ===== SIDEBAR =====
  function createSidebar() {
    var root = document.getElementById("smartpr-widget-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "smartpr-widget-root";
      document.body.appendChild(root);
    }
    sidebar = document.createElement("div");
    sidebar.id = "smartpr-helper-sidebar";
    sidebar.innerHTML =
      '<div class="smartpr-header">' +
      '<div class="smartpr-header-left">' +
      '<button class="smartpr-back" title="' +
      t("sidebar.backToAsk") +
      '"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8,1 3,6 8,11"/></svg></button>' +
      '<h2 class="smartpr-title">' +
      t("sidebar.subjectLineHelper") +
      "</h2>" +
      "</div>" +
      '<button class="smartpr-close"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/></svg></button>' +
      "</div>" +
      '<div class="smartpr-content" id="smartpr-content"></div>' +
      '<div class="smartpr-footer" id="smartpr-footer">' +
      '<button class="smartpr-feedback-link" id="smartpr-feedback-btn">' +
      t("sidebar.feedback") +
      "</button>" +
      "</div>";
    root.appendChild(sidebar);
    sidebar
      .querySelector(".smartpr-close")
      .addEventListener("click", closeSidebar);
    sidebar
      .querySelector(".smartpr-back")
      .addEventListener("click", function () {
        stopSelectionTracking();
        stopSubjectFieldTracking();
        openKnowledgeBaseSidebar();
      });
    initSidebarFeedback();
    updateBackButton();
    return sidebar;
  }

  function updateBackButton() {
    if (!sidebar) return;
    var btn = sidebar.querySelector(".smartpr-back");
    if (btn) btn.style.display = currentSidebarMode === "kb" ? "none" : "flex";
  }

  function initSidebarFeedback() {
    var footer = sidebar.querySelector("#smartpr-footer");
    footer
      .querySelector("#smartpr-feedback-btn")
      .addEventListener("click", function () {
        showSidebarFeedbackForm(footer);
      });
  }

  function showSidebarFeedbackForm(footer) {
    footer.innerHTML =
      '<div class="smartpr-feedback-form">' +
      '<textarea class="smartpr-feedback-textarea" id="smartpr-feedback-text" rows="2" placeholder="' +
      t("sidebar.feedbackPlaceholder") +
      '"></textarea>' +
      '<div class="smartpr-feedback-actions">' +
      '<button class="smartpr-feedback-send" id="smartpr-feedback-send">' +
      t("sidebar.send") +
      "</button>" +
      '<button class="smartpr-feedback-cancel" id="smartpr-feedback-cancel">' +
      t("sidebar.cancel") +
      "</button>" +
      "</div></div>";
    var textarea = footer.querySelector("#smartpr-feedback-text");
    textarea.focus();
    footer
      .querySelector("#smartpr-feedback-cancel")
      .addEventListener("click", function () {
        resetSidebarFeedback(footer);
      });
    footer
      .querySelector("#smartpr-feedback-send")
      .addEventListener("click", function () {
        var text = textarea.value.trim();
        if (!text) return;
        var sendBtn = footer.querySelector("#smartpr-feedback-send");
        sendBtn.textContent = t("sidebar.sending");
        sendBtn.disabled = true;
        submitFeedbackAPI(text)
          .then(function () {
            triggerSparkle(sendBtn);
            showToast(t("sidebar.feedbackSent"));
            resetSidebarFeedback(footer);
          })
          .catch(function () {
            sendBtn.textContent = t("sidebar.send");
            sendBtn.disabled = false;
            showToast(t("sidebar.feedbackFailed"));
          });
      });
  }

  function resetSidebarFeedback(footer) {
    footer.innerHTML =
      '<button class="smartpr-feedback-link" id="smartpr-feedback-btn">' +
      t("sidebar.feedback") +
      "</button>";
    footer
      .querySelector("#smartpr-feedback-btn")
      .addEventListener("click", function () {
        showSidebarFeedbackForm(footer);
      });
  }

  // ===== SIDEBAR OPEN/CLOSE =====
  function openSidebar(type) {
    if (extensionDisabled) return;
    if (!sidebar) createSidebar();
    currentSidebarMode = "subject";
    updateBackButton();
    sidebar.querySelector(".smartpr-title").textContent = t(
      "sidebar.subjectLineCoach",
    );
    sidebar.classList.add("smartpr-open");
    updateFloatingIcon(true);
    hideIconBadge();
    var val = subjectField ? subjectField.value.trim() : "";
    if (type === "empty" || val === "") showEmptyState();
    else showFilledState(val);
    startSubjectFieldTracking();
    emit("open", { mode: "subject" });
  }

  function openSidebarFromIcon() {
    if (extensionDisabled) return;
    var hasEditor = editorIframe !== null;
    if (hasEditor) {
      try {
        var iframeDoc =
          editorIframe.contentDocument ||
          (editorIframe.contentWindow && editorIframe.contentWindow.document);
        var iframeWin = editorIframe.contentWindow;
        if (iframeDoc && iframeWin) {
          var selection = iframeWin.getSelection();
          var hasSel =
            selection && !selection.isCollapsed && selection.toString().trim();
          if (hasSel) {
            var anchorNode = selection.anchorNode;
            var anchorEl =
              anchorNode && anchorNode.nodeType === 1
                ? anchorNode
                : anchorNode && anchorNode.parentElement;
            var editor =
              (anchorEl && anchorEl.closest(".tiptap.ProseMirror")) ||
              (anchorEl && anchorEl.closest(".mce-content-body"));
            if (editor) {
              selectedText = selection.toString().trim();
              selectedEditor = editor;
              selectedEditorDoc = iframeDoc;
              currentSelection = selection.getRangeAt(0).cloneRange();
              openParagraphCoachSidebar();
              return;
            }
          }
          openEditorContextSidebar();
          return;
        }
      } catch (e) {
        /* iframe access error */
      }
    }
    var beeFrames = document.querySelectorAll('iframe[src*="getbee.io"]');
    if (beeFrames.length > 0) {
      openEditorContextSidebar();
      return;
    }
    var activeField =
      subjectField && subjectField.isConnected
        ? subjectField
        : findSubjectField();
    if (activeField) {
      subjectField = activeField;
      var val = subjectField.value.trim();
      openSidebar(val === "" ? "empty" : "filled");
    } else {
      openKnowledgeBaseSidebar();
    }
  }

  function closeSidebar() {
    if (sidebar) {
      sidebar.classList.remove("smartpr-open");
      updateFloatingIcon(false);
    }
    stopSelectionTracking();
    stopSubjectFieldTracking();
    emit("close", {});
  }

  // ===== PARAGRAPH COACH SIDEBAR =====
  function openParagraphCoachSidebar() {
    if (extensionDisabled) return;
    if (!sidebar) createSidebar();
    currentSidebarMode = "paragraph";
    updateBackButton();
    sidebar.querySelector(".smartpr-title").textContent = t(
      "sidebar.paragraphCoach",
    );
    sidebar.classList.add("smartpr-open");
    updateFloatingIcon(true);
    hideIconBadge();
    showParagraphCoachContent();
    startSelectionTracking();
    emit("open", { mode: "paragraph" });
  }

  function openEditorContextSidebar() {
    if (extensionDisabled) return;
    if (!sidebar) createSidebar();
    currentSidebarMode = "paragraph";
    updateBackButton();
    sidebar.querySelector(".smartpr-title").textContent = t(
      "sidebar.paragraphCoach",
    );
    sidebar.classList.add("smartpr-open");
    updateFloatingIcon(true);
    hideIconBadge();
    var content = $("#smartpr-content");
    content.innerHTML =
      '<div class="smartpr-empty">' +
      '<div class="smartpr-empty-icon">\u2728</div>' +
      '<div class="smartpr-empty-text">' +
      "<strong>" +
      t("paragraph.selectText") +
      "</strong>" +
      '<p style="margin-top:8px;color:#6b7280;font-size:13px">' +
      t("paragraph.selectTextDesc") +
      "</p></div></div>" +
      '<div class="smartpr-section" style="margin-top:16px">' +
      '<span class="smartpr-label">' +
      t("paragraph.whatYouCanDo") +
      "</span>" +
      '<div style="font-size:13px;color:#374151;line-height:1.6">' +
      "<div style='margin-bottom:8px'>\u2713 " +
      t("paragraph.fixGrammar") +
      "</div>" +
      "<div style='margin-bottom:8px'>\ud83d\udd04 " +
      t("paragraph.rephraseParagraph") +
      "</div>" +
      "<div style='margin-bottom:8px'>\ud83d\udca1 " +
      t("paragraph.suggestSynonyms") +
      "</div>" +
      "<div style='margin-bottom:8px'>\ud83c\udf10 " +
      t("paragraph.translateLanguages") +
      "</div>" +
      "<div style='margin-bottom:8px'>\ud83d\udcdd " +
      t("paragraph.makeTextShorter") +
      "</div></div></div>" +
      '<div class="smartpr-section">' +
      '<span class="smartpr-label">' +
      t("paragraph.orFullMailing") +
      "</span>" +
      '<button class="smartpr-button" id="smartpr-summarize-mailing-btn">' +
      t("paragraph.summarizeMailing") +
      "</button></div>";
    var summarizeBtn = content.querySelector("#smartpr-summarize-mailing-btn");
    if (summarizeBtn)
      summarizeBtn.addEventListener("click", function () {
        showSummaryFormatSelector();
      });
    startEditorSelectionWatcher();
  }

  // ===== SMART SUMMARY =====
  function getFullMailingContent() {
    var body = "";
    if (editorIframe) {
      try {
        var doc =
          editorIframe.contentDocument ||
          (editorIframe.contentWindow && editorIframe.contentWindow.document);
        if (doc) {
          var blocks = findAllEditableBlocks(doc);
          body = blocks
            .map(function (b) {
              return b.element.value !== undefined
                ? b.element.value
                : b.element.innerText;
            })
            .filter(function (t) {
              return t && t.trim();
            })
            .join("\n")
            .trim();
        }
      } catch (e) {
        /* ignore */
      }
    }
    if (!body) {
      var previewIframe = document.querySelector("iframe[srcdoc]");
      if (previewIframe) {
        try {
          var previewDoc = previewIframe.contentDocument;
          if (previewDoc && previewDoc.body) {
            body = previewDoc.body.innerText.trim();
            var unsubIdx = body.search(/geen berichten|unsubscribe|afmelden/i);
            if (unsubIdx > 0) body = body.substring(0, unsubIdx).trim();
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
    var subject =
      (subjectField && subjectField.value && subjectField.value.trim()) || "";
    return { subject: subject, body: body };
  }

  function getFormatLabels() {
    return {
      oneliner: t("format.oneliner"),
      pitch: t("format.pitch"),
      executive: t("format.executive"),
      bullets: t("format.bullets"),
    };
  }

  function showSummaryFormatSelector() {
    setContentWithTransition(
      '<div class="smartpr-section">' +
        '<span class="smartpr-label">' +
        t("summary.chooseFormat") +
        "</span>" +
        '<div class="smartpr-action-buttons">' +
        '<button class="smartpr-action-btn smartpr-cascade-item" id="smartpr-fmt-oneliner" style="animation-delay:0ms">' +
        '<span class="smartpr-action-icon">\u270f\ufe0f</span>' +
        '<span class="smartpr-action-label">' +
        t("summary.oneLiner") +
        "</span>" +
        '<span class="smartpr-action-desc">' +
        t("summary.oneLinerDesc") +
        "</span></button>" +
        '<button class="smartpr-action-btn smartpr-cascade-item" id="smartpr-fmt-pitch" style="animation-delay:60ms">' +
        '<span class="smartpr-action-icon">\ud83d\udcac</span>' +
        '<span class="smartpr-action-label">' +
        t("summary.shortPitch") +
        "</span>" +
        '<span class="smartpr-action-desc">' +
        t("summary.shortPitchDesc") +
        "</span></button>" +
        '<button class="smartpr-action-btn smartpr-cascade-item" id="smartpr-fmt-executive" style="animation-delay:120ms">' +
        '<span class="smartpr-action-icon">\ud83d\udccb</span>' +
        '<span class="smartpr-action-label">' +
        t("summary.executiveSummary") +
        "</span>" +
        '<span class="smartpr-action-desc">' +
        t("summary.executiveSummaryDesc") +
        "</span></button>" +
        '<button class="smartpr-action-btn smartpr-cascade-item" id="smartpr-fmt-bullets" style="animation-delay:180ms">' +
        '<span class="smartpr-action-icon">\ud83d\udccc</span>' +
        '<span class="smartpr-action-label">' +
        t("summary.bulletPoints") +
        "</span>" +
        '<span class="smartpr-action-desc">' +
        t("summary.bulletPointsDesc") +
        "</span></button></div></div>" +
        '<div class="smartpr-section">' +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-summary-back-btn">' +
        t("summary.back") +
        "</button></div>",
    ).then(function () {
      $("#smartpr-fmt-oneliner").addEventListener("click", function () {
        handleSummarize("oneliner");
      });
      $("#smartpr-fmt-pitch").addEventListener("click", function () {
        handleSummarize("pitch");
      });
      $("#smartpr-fmt-executive").addEventListener("click", function () {
        handleSummarize("executive");
      });
      $("#smartpr-fmt-bullets").addEventListener("click", function () {
        handleSummarize("bullets");
      });
      $("#smartpr-summary-back-btn").addEventListener("click", function () {
        if (selectedText) showParagraphCoachContent();
        else openEditorContextSidebar();
      });
    });
  }

  function handleSummarize(format) {
    var content = getFullMailingContent();
    if (!content.body) {
      showError(t("summary.noContent"));
      return;
    }
    showLoadingState(t("loading.readingMailing"), "summarize");
    summarizeMailingAPI(content.subject, content.body, format)
      .then(function (result) {
        if (loadingMessageTimer) {
          clearInterval(loadingMessageTimer);
          loadingMessageTimer = null;
        }
        showSummaryResult(result.summary, format);
        showToast(t("toast.done"));
      })
      .catch(function (error) {
        if (loadingMessageTimer) {
          clearInterval(loadingMessageTimer);
          loadingMessageTimer = null;
        }
        showSummaryError(getErrorMessage(error), format);
      });
  }

  function showSummaryResult(summary, format) {
    var formatLabel = getFormatLabels()[format] || t("format.summary");
    setContentWithTransition(
      '<div class="smartpr-section">' +
        '<span class="smartpr-label">' +
        escapeHTML(formatLabel) +
        "</span>" +
        '<div class="smartpr-result-text" id="smartpr-summary-result-text"></div></div>' +
        '<div class="smartpr-section smartpr-result-actions">' +
        '<button class="smartpr-button" id="smartpr-copy-summary-btn" disabled>' +
        t("result.copyToClipboard") +
        "</button>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-another-format-btn">' +
        t("summary.tryAnotherFormat") +
        "</button></div>",
    ).then(function () {
      var resultEl = $("#smartpr-summary-result-text");
      var copyBtn = $("#smartpr-copy-summary-btn");
      typewriterEffect(resultEl, summary).then(function () {
        copyBtn.disabled = false;
      });
      copyBtn.addEventListener("click", function () {
        copyToClipboard(summary);
        triggerSparkle(copyBtn);
        copyBtn.textContent = t("result.copied");
        copyBtn.classList.add("smartpr-copied");
        setTimeout(function () {
          copyBtn.textContent = t("result.copyToClipboard");
          copyBtn.classList.remove("smartpr-copied");
        }, 2000);
      });
      $("#smartpr-another-format-btn").addEventListener("click", function () {
        showSummaryFormatSelector();
      });
    });
  }

  function showSummaryError(message, format) {
    var content = $("#smartpr-content");
    content.innerHTML =
      '<div class="smartpr-error"><div class="smartpr-error-text">' +
      escapeHTML(message) +
      "</div></div>" +
      '<div class="smartpr-section" style="margin-top:16px">' +
      '<button class="smartpr-button" id="smartpr-retry-summary-btn">' +
      t("summary.tryAgain") +
      "</button>" +
      '<button class="smartpr-button smartpr-button-secondary" id="smartpr-summary-error-back-btn" style="margin-top:10px">' +
      t("summary.back") +
      "</button></div>";
    content
      .querySelector("#smartpr-retry-summary-btn")
      .addEventListener("click", function () {
        handleSummarize(format);
      });
    content
      .querySelector("#smartpr-summary-error-back-btn")
      .addEventListener("click", function () {
        showSummaryFormatSelector();
      });
  }

  // ===== KNOWLEDGE BASE =====
  function openKnowledgeBaseSidebar() {
    if (extensionDisabled) return;
    if (!sidebar) createSidebar();
    currentSidebarMode = "kb";
    updateBackButton();
    sidebar.querySelector(".smartpr-title").textContent = t(
      "sidebar.askMeAnything",
    );
    sidebar.classList.add("smartpr-open");
    updateFloatingIcon(true);
    hideIconBadge();
    kbConversation = [];
    kbConversationId = null;
    showKBEmptyState();
    emit("open", { mode: "kb" });
  }

  function showKBEmptyState() {
    setContentWithTransition(
      '<div class="smartpr-section">' +
        '<div class="smartpr-empty" style="padding:24px">' +
        '<div class="smartpr-empty-icon">' +
        LOGO_BRAND_SVG +
        "</div>" +
        '<div class="smartpr-empty-text"><strong>' +
        t("kb.iKnowSmartPr") +
        "</strong>" +
        '<p style="margin-top:8px;color:#6b7280;font-size:13px">' +
        t("kb.platformQuestions") +
        "</p></div></div></div>" +
        '<div class="smartpr-section smartpr-kb-input-section">' +
        '<div class="smartpr-kb-input-row">' +
        '<input type="text" id="smartpr-kb-question-input" class="smartpr-input smartpr-kb-input" placeholder="' +
        t("kb.placeholder") +
        '">' +
        '<button class="smartpr-kb-ask-btn" id="smartpr-kb-ask-btn">' +
        t("kb.ask") +
        "</button></div></div>" +
        '<div class="smartpr-section">' +
        '<span class="smartpr-label">' +
        t("kb.tryAsking") +
        "</span>" +
        '<div class="smartpr-kb-suggestions">' +
        '<button class="smartpr-kb-suggestion-btn smartpr-cascade-item" style="animation-delay:0ms" data-q="' +
        escapeHTML(t("kb.scheduleMailing")) +
        '">' +
        t("kb.scheduleMailing") +
        "</button>" +
        '<button class="smartpr-kb-suggestion-btn smartpr-cascade-item" style="animation-delay:60ms" data-q="' +
        escapeHTML(t("kb.goodSubjectLine")) +
        '">' +
        t("kb.goodSubjectLine") +
        "</button>" +
        '<button class="smartpr-kb-suggestion-btn smartpr-cascade-item" style="animation-delay:120ms" data-q="' +
        escapeHTML(t("kb.importContacts")) +
        '">' +
        t("kb.importContacts") +
        "</button></div></div>" +
        '<div class="smartpr-section" style="margin-top:8px;padding-top:12px;border-top:1px solid rgba(232,181,232,.15)">' +
        '<span class="smartpr-label">' +
        t("kb.alsoAvailable") +
        "</span>" +
        '<div style="font-size:12px;color:#9B8FB8;line-height:1.7">' +
        "<div>\u2709\ufe0f <strong>" +
        t("kb.subjectLineCoachHint") +
        "</strong> \u2014 " +
        t("kb.subjectLineCoachAction") +
        "</div>" +
        "<div>\u2728 <strong>" +
        t("kb.paragraphCoachHint") +
        "</strong> \u2014 " +
        t("kb.paragraphCoachAction") +
        "</div></div></div>",
    ).then(function () {
      $$(".smartpr-kb-suggestion-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          handleKBQuestion(btn.dataset.q);
        });
      });
      var input = $("#smartpr-kb-question-input");
      var askBtn = $("#smartpr-kb-ask-btn");
      askBtn.addEventListener("click", function () {
        var q = input.value.trim();
        if (q) handleKBQuestion(q);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var q = input.value.trim();
          if (q) handleKBQuestion(q);
        }
      });
      input.focus();
    });
  }

  function handleKBQuestion(question) {
    if (kbBusy) return;
    kbBusy = true;
    kbConversation.push({ role: "user", text: question });
    showKBConversation(true);
    askKnowledgeBaseAPI(question, kbConversationId)
      .then(function (result) {
        kbConversationId = result.conversationId;
        kbConversation.push({
          role: "assistant",
          text: result.answer,
          citations: result.citations || [],
        });
        showKBConversation(false);
      })
      .catch(function (error) {
        kbConversation.pop();
        showKBConversation(false, getErrorMessage(error));
      })
      .finally(function () {
        kbBusy = false;
      });
  }

  function showKBConversation(isLoading, errorMessage) {
    var messagesHTML = kbConversation
      .map(function (msg, i) {
        if (msg.role === "user") {
          return (
            '<div class="smartpr-kb-message smartpr-kb-user smartpr-cascade-item" style="animation-delay:' +
            i * 40 +
            'ms"><div>' +
            escapeHTML(msg.text) +
            "</div></div>"
          );
        }
        return (
          '<div class="smartpr-kb-message smartpr-kb-assistant smartpr-cascade-item" style="animation-delay:' +
          i * 40 +
          'ms"><div>' +
          renderKBMarkup(msg.text) +
          "</div></div>"
        );
      })
      .join("");

    var loadingHTML = "";
    if (isLoading) {
      var kbMsgs = t("progress.kb");
      loadingHTML =
        '<div class="smartpr-kb-message smartpr-kb-assistant">' +
        '<div class="smartpr-kb-typing">' +
        '<span class="smartpr-kb-typing-dot"></span>' +
        '<span class="smartpr-kb-typing-dot"></span>' +
        '<span class="smartpr-kb-typing-dot"></span></div>' +
        '<div class="smartpr-kb-loading-text">' +
        kbMsgs[0] +
        "</div></div>";
      if (loadingMessageTimer) {
        clearInterval(loadingMessageTimer);
        loadingMessageTimer = null;
      }
      var msgIdx = 1;
      loadingMessageTimer = setInterval(function () {
        var el = document.querySelector(".smartpr-kb-loading-text");
        if (el && msgIdx < kbMsgs.length) {
          el.style.opacity = "0";
          setTimeout(function () {
            el.textContent = kbMsgs[msgIdx];
            el.style.opacity = "1";
            msgIdx++;
          }, 200);
        }
        if (msgIdx >= kbMsgs.length) {
          clearInterval(loadingMessageTimer);
          loadingMessageTimer = null;
        }
      }, 2500);
    } else {
      if (loadingMessageTimer) {
        clearInterval(loadingMessageTimer);
        loadingMessageTimer = null;
      }
    }

    var errorHTML = errorMessage
      ? '<div class="smartpr-error" style="margin-bottom:12px"><div class="smartpr-error-text">' +
        escapeHTML(errorMessage) +
        "</div></div>"
      : "";

    setContentWithTransition(
      '<div class="smartpr-kb-conversation" id="smartpr-kb-conversation">' +
        messagesHTML +
        loadingHTML +
        errorHTML +
        "</div>" +
        '<div class="smartpr-section smartpr-kb-input-section">' +
        '<div class="smartpr-kb-input-row">' +
        '<input type="text" id="smartpr-kb-question-input" class="smartpr-input smartpr-kb-input" placeholder="' +
        t("kb.followUp") +
        '"' +
        (isLoading ? " disabled" : "") +
        ">" +
        '<button class="smartpr-kb-ask-btn" id="smartpr-kb-ask-btn"' +
        (isLoading ? " disabled" : "") +
        ">" +
        t("kb.ask") +
        "</button></div>" +
        '<div class="smartpr-kb-actions-row">' +
        '<button class="smartpr-kb-new-btn" id="smartpr-kb-new-btn">' +
        t("kb.newConversation") +
        "</button></div></div>",
    ).then(function () {
      var convoEl = $("#smartpr-kb-conversation");
      if (convoEl) convoEl.scrollTop = convoEl.scrollHeight;
      var input = $("#smartpr-kb-question-input");
      var askBtn = $("#smartpr-kb-ask-btn");
      var newBtn = $("#smartpr-kb-new-btn");
      if (!isLoading) {
        askBtn.addEventListener("click", function () {
          var q = input.value.trim();
          if (q) handleKBQuestion(q);
        });
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            var q = input.value.trim();
            if (q) handleKBQuestion(q);
          }
        });
        input.focus();
      }
      newBtn.addEventListener("click", function () {
        kbConversation = [];
        kbConversationId = null;
        showKBEmptyState();
      });
    });
  }

  function renderKBMarkup(text) {
    if (!text) return "";
    var escaped = escapeHTML(text);
    var lines = escaped.split(/\r?\n/);
    var parts = [];
    var inList = false;
    var listType = null;
    var closeList = function () {
      if (!inList) return;
      parts.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
      listType = null;
    };
    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (!trimmed) {
        closeList();
        continue;
      }
      var bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
      var orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (bulletMatch) {
        if (!inList || listType !== "ul") {
          closeList();
          parts.push("<ul>");
          inList = true;
          listType = "ul";
        }
        parts.push("<li>" + bulletMatch[1] + "</li>");
        continue;
      }
      if (orderedMatch) {
        if (!inList || listType !== "ol") {
          closeList();
          parts.push("<ol>");
          inList = true;
          listType = "ol";
        }
        parts.push("<li>" + orderedMatch[1] + "</li>");
        continue;
      }
      closeList();
      parts.push("<p>" + trimmed + "</p>");
    }
    closeList();
    return parts
      .join("")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  // ===== PARAGRAPH COACH CONTENT =====
  function showParagraphCoachContent() {
    if (extensionDisabled) return;
    var container =
      selectedEditor &&
      (selectedEditor.closest(".block-wrapper") ||
        selectedEditor.closest(".module-box"));
    var blockType = container
      ? getBlockType(container)
      : proEditorSource
        ? proEditorBlockType
        : "text";
    var typeLabel =
      blockType === "heading"
        ? t("paragraph.selectedHeading")
        : blockType === "subheading"
          ? t("paragraph.selectedSubheading")
          : t("paragraph.selectedText");
    var displayText =
      selectedText.length > 200
        ? selectedText.substring(0, 200) + "..."
        : selectedText;
    setContentWithTransition(
      '<div class="smartpr-section">' +
        '<span class="smartpr-label">' +
        typeLabel +
        "</span>" +
        '<div class="smartpr-current-subject">' +
        escapeHTML(displayText) +
        "</div></div>" +
        '<div class="smartpr-section">' +
        '<span class="smartpr-label">' +
        t("paragraph.whatToDo") +
        "</span>" +
        '<div class="smartpr-action-buttons">' +
        '<button class="smartpr-action-btn" id="smartpr-action-grammar"><span class="smartpr-action-icon">\u2713</span><span class="smartpr-action-label">' +
        t("paragraph.fixSpellingGrammar") +
        "</span></button>" +
        '<button class="smartpr-action-btn" id="smartpr-action-rephrase"><span class="smartpr-action-icon">\ud83d\udd04</span><span class="smartpr-action-label">' +
        t("paragraph.rephrase") +
        "</span></button>" +
        '<button class="smartpr-action-btn" id="smartpr-action-synonyms"><span class="smartpr-action-icon">\ud83d\udca1</span><span class="smartpr-action-label">' +
        t("paragraph.synonyms") +
        "</span></button>" +
        '<button class="smartpr-action-btn" id="smartpr-action-translate"><span class="smartpr-action-icon">\ud83c\udf10</span><span class="smartpr-action-label">' +
        t("paragraph.translate") +
        "</span></button>" +
        '<button class="smartpr-action-btn" id="smartpr-action-shorter"><span class="smartpr-action-icon">\ud83d\udcdd</span><span class="smartpr-action-label">' +
        t("paragraph.shorter") +
        "</span></button></div></div>" +
        '<div class="smartpr-section"><span class="smartpr-label">' +
        t("paragraph.fullMailing") +
        "</span>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-summarize-mailing-btn">' +
        t("paragraph.summarizeMailing") +
        "</button></div>",
    ).then(function () {
      $("#smartpr-action-grammar").addEventListener("click", function () {
        handleParagraphAction("grammar");
      });
      $("#smartpr-action-rephrase").addEventListener("click", function () {
        showToneSelector();
      });
      $("#smartpr-action-synonyms").addEventListener("click", function () {
        handleParagraphAction("synonyms");
      });
      $("#smartpr-action-translate").addEventListener("click", function () {
        showTranslateOptions();
      });
      $("#smartpr-action-shorter").addEventListener("click", function () {
        handleParagraphAction("shorter");
      });
      $("#smartpr-summarize-mailing-btn").addEventListener(
        "click",
        function () {
          showSummaryFormatSelector();
        },
      );
    });
  }

  function showToneSelector() {
    var displayText =
      selectedText.length > 150
        ? selectedText.substring(0, 150) + "..."
        : selectedText;
    setContentWithTransition(
      '<div class="smartpr-section"><span class="smartpr-label">' +
        t("tone.selectedText") +
        '</span><div class="smartpr-current-subject">' +
        escapeHTML(displayText) +
        "</div></div>" +
        '<div class="smartpr-section"><button class="smartpr-button" id="smartpr-rephrase-no-tone-btn">' +
        t("tone.rephrase") +
        "</button></div>" +
        '<div class="smartpr-section"><span class="smartpr-label">' +
        t("tone.orPickTone") +
        '</span><div class="smartpr-tone-buttons">' +
        '<button class="smartpr-tone-btn" data-tone="formal">' +
        t("tone.formal") +
        "</button>" +
        '<button class="smartpr-tone-btn" data-tone="friendly">' +
        t("tone.friendly") +
        "</button>" +
        '<button class="smartpr-tone-btn" data-tone="persuasive">' +
        t("tone.persuasive") +
        "</button>" +
        '<button class="smartpr-tone-btn" data-tone="concise">' +
        t("tone.concise") +
        "</button></div></div>" +
        '<div class="smartpr-section"><button class="smartpr-button smartpr-button-secondary" id="smartpr-back-to-actions-btn">' +
        t("tone.back") +
        "</button></div>",
    ).then(function () {
      $("#smartpr-rephrase-no-tone-btn").addEventListener("click", function () {
        handleParagraphAction("rephrase");
      });
      $$(".smartpr-tone-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          handleParagraphAction("rephrase", { tone: btn.dataset.tone });
        });
      });
      $("#smartpr-back-to-actions-btn").addEventListener("click", function () {
        showParagraphCoachContent();
      });
    });
  }

  function showTranslateOptions() {
    var displayText =
      selectedText.length > 150
        ? selectedText.substring(0, 150) + "..."
        : selectedText;
    setContentWithTransition(
      '<div class="smartpr-section"><span class="smartpr-label">' +
        t("tone.selectedText") +
        '</span><div class="smartpr-current-subject">' +
        escapeHTML(displayText) +
        "</div></div>" +
        '<div class="smartpr-section"><span class="smartpr-label">' +
        t("translate.translateTo") +
        '</span><div class="smartpr-language-buttons">' +
        '<button class="smartpr-lang-btn" data-lang="English">EN</button>' +
        '<button class="smartpr-lang-btn" data-lang="Dutch">NL</button>' +
        '<button class="smartpr-lang-btn" data-lang="German">DE</button>' +
        '<button class="smartpr-lang-btn" data-lang="French">FR</button></div>' +
        '<div class="smartpr-other-lang"><input type="text" id="smartpr-other-language-input" class="smartpr-input" placeholder="' +
        t("translate.otherPlaceholder") +
        '">' +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-translate-other-btn">' +
        t("translate.translateBtn") +
        "</button></div></div>" +
        '<div class="smartpr-section"><button class="smartpr-button smartpr-button-secondary" id="smartpr-back-to-actions-btn">' +
        t("translate.back") +
        "</button></div>",
    ).then(function () {
      $$(".smartpr-lang-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          handleParagraphAction("translate", {
            targetLanguage: btn.dataset.lang,
          });
        });
      });
      var otherInput = $("#smartpr-other-language-input");
      var translateHandler = function () {
        var lang = otherInput.value.trim();
        if (lang) handleParagraphAction("translate", { targetLanguage: lang });
      };
      $("#smartpr-translate-other-btn").addEventListener(
        "click",
        translateHandler,
      );
      otherInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          translateHandler();
        }
      });
      $("#smartpr-back-to-actions-btn").addEventListener("click", function () {
        showParagraphCoachContent();
      });
    });
  }

  function handleParagraphAction(action, options) {
    options = options || {};
    if (extensionDisabled) return;
    var text = selectedText;
    if (!text) {
      showError(t("error.noTextSelected"));
      return;
    }
    var loadingMsg = t("loading.processing");
    if (action === "grammar") loadingMsg = t("loading.checkingGrammar");
    else if (action === "rephrase") loadingMsg = t("loading.rephrasing");
    else if (action === "synonyms") loadingMsg = t("loading.findingSynonyms");
    else if (action === "translate")
      loadingMsg =
        t("loading.translatingTo") + " " + options.targetLanguage + "...";
    else if (action === "shorter") loadingMsg = t("loading.makingShorter");
    showLoadingState(loadingMsg, action);

    if (!options.context && selectedEditor) {
      try {
        var doc = selectedEditorDoc || selectedEditor.ownerDocument || document;
        var blocks = findAllEditableBlocks(doc);
        var ctx = blocks
          .map(function (b) {
            return b.element.value !== undefined
              ? b.element.value
              : b.element.innerText;
          })
          .filter(function (t) {
            return t && t.trim();
          })
          .join("\n")
          .trim();
        if (ctx && ctx !== text) options.context = ctx.substring(0, 500);
      } catch (e) {
        /* best-effort */
      }
    }

    processParagraphAPI(text, action, options)
      .then(function (result) {
        if (loadingMessageTimer) {
          clearInterval(loadingMessageTimer);
          loadingMessageTimer = null;
        }
        if (action === "synonyms") showSynonymResult(result);
        else if (action === "rephrase") showRephraseResult(result);
        else if (action === "grammar") showGrammarResult(result);
        else if (action === "shorter") showShorterResult(result);
        else showParagraphResult(result.text, action, options);
        showToast(t("toast.done"));
      })
      .catch(function (error) {
        if (loadingMessageTimer) {
          clearInterval(loadingMessageTimer);
          loadingMessageTimer = null;
        }
        showParagraphError(getErrorMessage(error), action, options);
      });
  }

  function showParagraphResult(resultText, action, options) {
    options = options || {};
    var actionLabel = t("result.result");
    if (action === "grammar") actionLabel = t("result.correctedText");
    else if (action === "translate")
      actionLabel = t("result.translatedTo") + " " + options.targetLanguage;
    else if (action === "shorter") actionLabel = t("result.shortenedText");
    var origDisplay =
      selectedText.length > 100
        ? selectedText.substring(0, 100) + "..."
        : selectedText;
    setContentWithTransition(
      '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.original") +
        '</span><div class="smartpr-original-text">' +
        escapeHTML(origDisplay) +
        "</div></div>" +
        '<div class="smartpr-section"><span class="smartpr-label">' +
        escapeHTML(actionLabel) +
        '</span><div class="smartpr-result-text" id="smartpr-paragraph-result-text"></div></div>' +
        '<div class="smartpr-section smartpr-result-actions">' +
        '<button class="smartpr-button" id="smartpr-replace-text-btn" disabled>' +
        t("result.replaceInEditor") +
        "</button>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-copy-result-btn" disabled>' +
        t("result.copyToClipboard") +
        "</button>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-try-another-btn">' +
        t("result.tryAnotherAction") +
        "</button></div>",
    ).then(function () {
      var resultEl = $("#smartpr-paragraph-result-text");
      var replaceBtn = $("#smartpr-replace-text-btn");
      var copyBtn = $("#smartpr-copy-result-btn");
      typewriterEffect(resultEl, resultText).then(function () {
        replaceBtn.disabled = false;
        copyBtn.disabled = false;
      });
      replaceBtn.addEventListener("click", function () {
        replaceTextInEditor(resultText);
      });
      copyBtn.addEventListener("click", function () {
        copyToClipboard(resultText);
        triggerSparkle(copyBtn);
        copyBtn.textContent = t("result.copied");
        setTimeout(function () {
          copyBtn.textContent = t("result.copyToClipboard");
        }, 2000);
      });
      $("#smartpr-try-another-btn").addEventListener("click", function () {
        showParagraphCoachContent();
      });
    });
  }

  function showSynonymResult(result) {
    var suggestions = result.synonyms || parseSynonymsFromText(result.text);
    var origDisplay =
      selectedText.length > 100
        ? selectedText.substring(0, 100) + "..."
        : selectedText;
    var optionsHTML = suggestions
      .map(function (syn, i) {
        return (
          '<div class="smartpr-synonym-option smartpr-cascade-item" style="animation-delay:' +
          i * 60 +
          'ms"><span class="smartpr-synonym-text">' +
          escapeHTML(syn) +
          '</span><div class="smartpr-synonym-actions">' +
          '<button class="smartpr-synonym-btn smartpr-synonym-copy" data-index="' +
          i +
          '">' +
          t("result.copy") +
          "</button>" +
          '<button class="smartpr-synonym-btn smartpr-synonym-inject" data-index="' +
          i +
          '">' +
          t("result.inject") +
          "</button></div></div>"
        );
      })
      .join("");
    setContentWithTransition(
      '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.original") +
        '</span><div class="smartpr-original-text">' +
        escapeHTML(origDisplay) +
        "</div></div>" +
        '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.synonymSuggestions") +
        '</span><div class="smartpr-synonym-list">' +
        optionsHTML +
        "</div></div>" +
        '<div class="smartpr-section smartpr-result-actions"><button class="smartpr-button smartpr-button-secondary" id="smartpr-try-another-btn">' +
        t("result.tryAnotherAction") +
        "</button></div>",
    ).then(function () {
      $$(".smartpr-synonym-copy").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.dataset.index);
          copyToClipboard(suggestions[idx]);
          triggerSparkle(btn);
          btn.textContent = "\u2713";
          setTimeout(function () {
            btn.textContent = t("result.copy");
          }, 2000);
        });
      });
      $$(".smartpr-synonym-inject").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.dataset.index);
          triggerSparkle(btn);
          replaceTextInEditor(suggestions[idx]);
        });
      });
      $("#smartpr-try-another-btn").addEventListener("click", function () {
        showParagraphCoachContent();
      });
    });
  }

  function showRephraseResult(result) {
    var options = result.rephraseOptions || parseRephraseFromText(result.text);
    var origDisplay =
      selectedText.length > 100
        ? selectedText.substring(0, 100) + "..."
        : selectedText;
    var optionsHTML = options
      .map(function (opt, i) {
        return (
          '<div class="smartpr-synonym-option smartpr-rephrase-option smartpr-cascade-item" style="animation-delay:' +
          i * 60 +
          'ms"><span class="smartpr-synonym-text">' +
          escapeHTML(opt) +
          '</span><div class="smartpr-synonym-actions">' +
          '<button class="smartpr-synonym-btn smartpr-synonym-copy" data-index="' +
          i +
          '">' +
          t("result.copy") +
          "</button>" +
          '<button class="smartpr-synonym-btn smartpr-synonym-inject" data-index="' +
          i +
          '">' +
          t("result.inject") +
          "</button></div></div>"
        );
      })
      .join("");
    setContentWithTransition(
      '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.original") +
        '</span><div class="smartpr-original-text">' +
        escapeHTML(origDisplay) +
        "</div></div>" +
        '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.rephraseOptions") +
        '</span><div class="smartpr-synonym-list">' +
        optionsHTML +
        "</div></div>" +
        '<div class="smartpr-section smartpr-result-actions"><button class="smartpr-button smartpr-button-secondary" id="smartpr-try-another-btn">' +
        t("result.tryAnotherAction") +
        "</button></div>",
    ).then(function () {
      $$(".smartpr-synonym-copy").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.dataset.index);
          copyToClipboard(options[idx]);
          triggerSparkle(btn);
          btn.textContent = "\u2713";
          setTimeout(function () {
            btn.textContent = t("result.copy");
          }, 2000);
        });
      });
      $$(".smartpr-synonym-inject").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.dataset.index);
          triggerSparkle(btn);
          replaceTextInEditor(options[idx]);
        });
      });
      $("#smartpr-try-another-btn").addEventListener("click", function () {
        showParagraphCoachContent();
      });
    });
  }

  function showGrammarResult(result) {
    var origDisplay =
      selectedText.length > 100
        ? selectedText.substring(0, 100) + "..."
        : selectedText;
    var diff = diffWords(selectedText, result.text);
    var diffHTML = renderDiffHTML(diff);
    var changesHTML = "";
    if (result.changes && result.changes.length > 0) {
      var items = result.changes
        .map(function (c, i) {
          return (
            '<li class="smartpr-change-item smartpr-cascade-item" style="animation-delay:' +
            i * 60 +
            'ms">' +
            escapeHTML(c) +
            "</li>"
          );
        })
        .join("");
      changesHTML =
        '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.changesMade") +
        '</span><ul class="smartpr-changes-list">' +
        items +
        "</ul></div>";
    }
    setContentWithTransition(
      '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.original") +
        '</span><div class="smartpr-original-text">' +
        escapeHTML(origDisplay) +
        "</div></div>" +
        '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.correctedText") +
        '</span><div class="smartpr-result-text" id="smartpr-grammar-result-text">' +
        diffHTML +
        "</div></div>" +
        changesHTML +
        '<div class="smartpr-section smartpr-result-actions">' +
        '<button class="smartpr-button" id="smartpr-replace-text-btn" disabled>' +
        t("result.replaceInEditor") +
        "</button>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-copy-result-btn" disabled>' +
        t("result.copyToClipboard") +
        "</button>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-try-another-btn">' +
        t("result.tryAnotherAction") +
        "</button></div>",
    ).then(function () {
      var resultEl = $("#smartpr-grammar-result-text");
      var replaceBtn = $("#smartpr-replace-text-btn");
      var copyBtn = $("#smartpr-copy-result-btn");
      typewriterEffect(resultEl, result.text).then(function () {
        resultEl.innerHTML = diffHTML;
        replaceBtn.disabled = false;
        copyBtn.disabled = false;
      });
      replaceBtn.addEventListener("click", function () {
        replaceTextInEditor(result.text);
      });
      copyBtn.addEventListener("click", function () {
        copyToClipboard(result.text);
        triggerSparkle(copyBtn);
        copyBtn.textContent = t("result.copied");
        setTimeout(function () {
          copyBtn.textContent = t("result.copyToClipboard");
        }, 2000);
      });
      $("#smartpr-try-another-btn").addEventListener("click", function () {
        showParagraphCoachContent();
      });
    });
  }

  function showShorterResult(result) {
    var origDisplay =
      selectedText.length > 100
        ? selectedText.substring(0, 100) + "..."
        : selectedText;
    var origWC = selectedText.trim().split(/\s+/).filter(Boolean).length;
    var newWC = result.text.trim().split(/\s+/).filter(Boolean).length;
    setContentWithTransition(
      '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.original") +
        '</span><div class="smartpr-original-text">' +
        escapeHTML(origDisplay) +
        "</div></div>" +
        '<div class="smartpr-section"><span class="smartpr-label">' +
        t("result.shortenedText") +
        '</span><div class="smartpr-word-count-badge">' +
        origWC +
        " \u2192 " +
        newWC +
        " " +
        t("result.words") +
        '</div><div class="smartpr-result-text" id="smartpr-shorter-result-text"></div></div>' +
        '<div class="smartpr-section smartpr-result-actions">' +
        '<button class="smartpr-button" id="smartpr-replace-text-btn" disabled>' +
        t("result.replaceInEditor") +
        "</button>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-copy-result-btn" disabled>' +
        t("result.copyToClipboard") +
        "</button>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-try-another-btn">' +
        t("result.tryAnotherAction") +
        "</button></div>",
    ).then(function () {
      var resultEl = $("#smartpr-shorter-result-text");
      var replaceBtn = $("#smartpr-replace-text-btn");
      var copyBtn = $("#smartpr-copy-result-btn");
      typewriterEffect(resultEl, result.text).then(function () {
        replaceBtn.disabled = false;
        copyBtn.disabled = false;
      });
      replaceBtn.addEventListener("click", function () {
        replaceTextInEditor(result.text);
      });
      copyBtn.addEventListener("click", function () {
        copyToClipboard(result.text);
        triggerSparkle(copyBtn);
        copyBtn.textContent = t("result.copied");
        setTimeout(function () {
          copyBtn.textContent = t("result.copyToClipboard");
        }, 2000);
      });
      $("#smartpr-try-another-btn").addEventListener("click", function () {
        showParagraphCoachContent();
      });
    });
  }

  function showParagraphError(message, action, options) {
    setContentWithTransition(
      '<div class="smartpr-error"><div class="smartpr-error-text">' +
        escapeHTML(message) +
        "</div></div>" +
        '<div class="smartpr-section"><button class="smartpr-button" id="smartpr-retry-action-btn">' +
        t("error.tryAgain") +
        "</button>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-back-to-actions-btn">' +
        t("error.back") +
        "</button></div>",
    ).then(function () {
      $("#smartpr-retry-action-btn").addEventListener("click", function () {
        handleParagraphAction(action, options);
      });
      $("#smartpr-back-to-actions-btn").addEventListener("click", function () {
        showParagraphCoachContent();
      });
    });
  }

  // ===== TEXT REPLACEMENT =====
  function replaceTextInEditor(newText) {
    if (!selectedEditor) {
      showToast(t("toast.unableToReplace"));
      return;
    }
    try {
      var isInput = selectedEditor.tagName === "INPUT";
      undoState = {
        editor: selectedEditor,
        editorDoc:
          selectedEditorDoc || selectedEditor.ownerDocument || document,
        originalText: isInput ? selectedEditor.value : selectedText,
        newText: newText,
        isInput: isInput,
      };
      if (isInput) {
        selectedEditor.focus();
        selectedEditor.value = newText;
        selectedEditor.dispatchEvent(new Event("input", { bubbles: true }));
        selectedEditor.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        var editorDoc =
          selectedEditorDoc || selectedEditor.ownerDocument || document;
        var editorWin = editorDoc.defaultView || window;
        selectedEditor.focus();
        if (currentSelection) {
          var sel = editorWin.getSelection();
          sel.removeAllRanges();
          sel.addRange(currentSelection);
          editorDoc.execCommand("insertText", false, newText);
        } else {
          var sel2 = editorWin.getSelection();
          var range = editorDoc.createRange();
          range.selectNodeContents(selectedEditor);
          sel2.removeAllRanges();
          sel2.addRange(range);
          editorDoc.execCommand("insertText", false, newText);
        }
      }
      var replaceBtn = $("#smartpr-replace-text-btn");
      if (replaceBtn) triggerSparkle(replaceBtn);
      showUndoToast();
      currentSelection = null;
      selectedText = "";
      selectedEditorDoc = null;
      setTimeout(closeSidebar, 1000);
    } catch (error) {
      showToast(t("toast.replaceFailed"));
    }
  }

  function showUndoToast() {
    if (extensionDisabled) return;
    var existing = document.querySelector(".smartpr-undo-toast");
    if (existing) existing.remove();
    if (undoToastTimer) clearTimeout(undoToastTimer);
    var toast = document.createElement("div");
    toast.className = "smartpr-toast smartpr-undo-toast";
    toast.innerHTML =
      "<span>" +
      t("toast.textReplaced") +
      "</span>" +
      '<button class="smartpr-undo-btn">' +
      t("toast.undo") +
      "</button>";
    document.body.appendChild(toast);
    toast
      .querySelector(".smartpr-undo-btn")
      .addEventListener("click", function () {
        performUndo();
        toast.remove();
      });
    undoToastTimer = setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transition = "opacity .3s ease";
      setTimeout(function () {
        toast.remove();
      }, 300);
      undoState = null;
    }, 5000);
  }

  function performUndo() {
    if (!undoState) return;
    var state = undoState;
    try {
      if (state.isInput) {
        state.editor.focus();
        state.editor.value = state.originalText;
        state.editor.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        var editorWin = state.editorDoc.defaultView || window;
        state.editor.focus();
        var range = findTextRange(state.editor, state.newText, state.editorDoc);
        if (range) {
          var sel = editorWin.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          state.editorDoc.execCommand("insertText", false, state.originalText);
        } else {
          showToast(t("toast.couldNotUndo"));
          undoState = null;
          return;
        }
      }
      showToast(t("toast.undone"));
    } catch (e) {
      showToast(t("toast.undoFailed"));
    }
    undoState = null;
    if (undoToastTimer) clearTimeout(undoToastTimer);
  }

  function findTextRange(rootNode, searchText, doc) {
    var walker = doc.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    var textNodes = [];
    var fullText = "";
    while (walker.nextNode()) {
      textNodes.push({ node: walker.currentNode, offset: fullText.length });
      fullText += walker.currentNode.textContent;
    }
    var idx = fullText.indexOf(searchText);
    if (idx === -1) return null;
    var endIdx = idx + searchText.length;
    var range = doc.createRange();
    for (var i = 0; i < textNodes.length; i++) {
      var tn = textNodes[i];
      var nodeEnd = tn.offset + tn.node.textContent.length;
      if (tn.offset <= idx && idx < nodeEnd) {
        range.setStart(tn.node, idx - tn.offset);
        break;
      }
    }
    for (var j = 0; j < textNodes.length; j++) {
      var tn2 = textNodes[j];
      var nodeEnd2 = tn2.offset + tn2.node.textContent.length;
      if (tn2.offset < endIdx && endIdx <= nodeEnd2) {
        range.setEnd(tn2.node, endIdx - tn2.offset);
        break;
      }
    }
    return range;
  }

  // ===== SUBJECT LINE STATES =====
  function showEmptyState() {
    setContentWithTransition(
      '<div class="smartpr-section">' +
        '<p class="smartpr-description">' +
        t("subject.describePrompt") +
        "</p>" +
        '<span class="smartpr-label">' +
        t("subject.describePR") +
        "</span>" +
        '<textarea id="smartpr-pr-description-input" class="smartpr-textarea" placeholder="' +
        t("subject.placeholder") +
        '" rows="4"></textarea>' +
        '<button class="smartpr-button" id="smartpr-generate-subject-btn">' +
        t("subject.generate") +
        "</button></div>" +
        '<div class="smartpr-empty"><div class="smartpr-empty-icon">\u2728</div>' +
        '<div class="smartpr-empty-text">' +
        t("subject.moreDetails") +
        "</div></div>",
    ).then(function () {
      var btn = $("#smartpr-generate-subject-btn");
      var textarea = $("#smartpr-pr-description-input");
      btn.addEventListener("click", function () {
        generateSubjectSuggestions("", textarea.value.trim());
      });
      textarea.addEventListener("keydown", function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") btn.click();
      });
    });
  }

  function showFilledState(currentSubject) {
    setContentWithTransition(
      '<div class="smartpr-section"><span class="smartpr-label">' +
        t("subject.currentSubject") +
        '</span><div class="smartpr-current-subject">' +
        escapeHTML(currentSubject) +
        "</div></div>" +
        '<div class="smartpr-section"><button class="smartpr-button" id="smartpr-get-feedback-btn">' +
        t("subject.getFeedback") +
        "</button>" +
        '<button class="smartpr-button smartpr-button-secondary" id="smartpr-generate-alternatives-btn">' +
        t("subject.generateAlternatives") +
        "</button></div>",
    ).then(function () {
      $("#smartpr-get-feedback-btn").addEventListener("click", function () {
        getFeedback(currentSubject);
      });
      $("#smartpr-generate-alternatives-btn").addEventListener(
        "click",
        function () {
          generateSubjectSuggestions(currentSubject);
        },
      );
    });
  }

  // ===== SUBJECT LINE GENERATION =====
  function generateSubjectSuggestions(currentSubject, prDescription) {
    currentSubject = currentSubject || "";
    prDescription = prDescription || "";
    if (extensionDisabled) return;
    showLoadingState(t("subject.generatingSuggestions"));
    var langInstruction = currentSubject
      ? "All output must stay in the same language as the subject line."
      : prDescription
        ? "Write all output in the same language as the description."
        : "";
    var langSuffix = langInstruction ? "\n\n" + langInstruction : "";
    var content = getFullMailingContent();
    var contentCtx = content.body
      ? '\n\nHere is the mailing content:\n"""' +
        content.body.substring(0, 1500) +
        '"""'
      : "";
    var userPrompt;
    if (currentSubject)
      userPrompt =
        'Generate improved alternatives for this subject line:\n\n"' +
        currentSubject +
        '"\n\nProvide 3-5 alternatives.' +
        contentCtx +
        langSuffix;
    else if (prDescription)
      userPrompt =
        "Generate 3-5 compelling subject lines for a press release about:\n\n" +
        prDescription +
        contentCtx +
        langSuffix;
    else
      userPrompt =
        "Generate 3-5 compelling subject lines for a press release email." +
        contentCtx +
        langSuffix;

    generateSubjectLinesAPI(userPrompt, {
      currentSubject: currentSubject || undefined,
    })
      .then(function (result) {
        showSuggestions(result.subjects, currentSubject);
        showToast(t("toast.suggestionsGenerated"));
      })
      .catch(function (error) {
        showError(getErrorMessage(error));
        if (
          error.code === "INVALID_EMAIL" ||
          error.code === "USER_NOT_AUTHORIZED"
        ) {
          var content = $("#smartpr-content");
          var hint = document.createElement("p");
          hint.style.cssText =
            "font-size:12px;color:#9B8FB8;margin-top:8px;line-height:1.5";
          hint.textContent = t("subject.setEmailHint");
          content.appendChild(hint);
        }
      });
  }

  function showSuggestions(suggestions, originalSubject) {
    var html = "";
    if (originalSubject)
      html +=
        '<div class="smartpr-section"><span class="smartpr-label">' +
        t("subject.originalSubject") +
        '</span><div class="smartpr-current-subject">' +
        escapeHTML(originalSubject) +
        "</div></div>";
    html +=
      '<div class="smartpr-section"><span class="smartpr-label">' +
      t("subject.suggestedLines") +
      '</span><div class="smartpr-suggestions">' +
      suggestions
        .map(function (sug, i) {
          return (
            '<div class="smartpr-suggestion-item smartpr-cascade-item" style="animation-delay:' +
            i * 60 +
            'ms"><div class="smartpr-suggestion-text">' +
            escapeHTML(sug) +
            '</div><div class="smartpr-suggestion-actions">' +
            '<button class="smartpr-use-button" data-text="' +
            escapeHTML(sug) +
            '">' +
            t("subject.use") +
            "</button>" +
            '<button class="smartpr-copy-button" data-text="' +
            escapeHTML(sug) +
            '">' +
            t("subject.copy") +
            "</button></div></div>"
          );
        })
        .join("") +
      "</div></div>" +
      '<div class="smartpr-section"><button class="smartpr-button smartpr-button-secondary" id="smartpr-generate-more-btn">' +
      t("subject.generateMore") +
      "</button></div>";

    setContentWithTransition(html).then(function () {
      $$(".smartpr-use-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var text = btn.dataset.text;
          if (subjectField) {
            var setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value",
            ).set;
            setter.call(subjectField, text);
            subjectField.dispatchEvent(new Event("input", { bubbles: true }));
            subjectField.dispatchEvent(new Event("change", { bubbles: true }));
            lastSubjectValue = text;
            triggerSparkle(btn);
            btn.textContent = t("result.done");
            btn.classList.add("smartpr-copied");
            setTimeout(function () {
              btn.textContent = t("subject.use");
              btn.classList.remove("smartpr-copied");
            }, 2000);
          }
        });
      });
      $$(".smartpr-copy-button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          copyToClipboard(btn.dataset.text);
          triggerSparkle(btn);
          btn.textContent = t("result.copied");
          btn.classList.add("smartpr-copied");
          setTimeout(function () {
            btn.textContent = t("subject.copy");
            btn.classList.remove("smartpr-copied");
          }, 2000);
        });
      });
      var moreBtn = $("#smartpr-generate-more-btn");
      if (moreBtn) {
        moreBtn.addEventListener("click", function () {
          var cur =
            originalSubject || (subjectField ? subjectField.value.trim() : "");
          generateSubjectSuggestions(cur);
        });
      }
    });
  }

  // ===== FEEDBACK =====
  function getFeedback(subject) {
    if (extensionDisabled) return;
    showLoadingState(t("subject.analyzingSubject"));
    var content = getFullMailingContent();
    var ctx = { keepLanguage: true };
    if (content.body) ctx.mailingContent = content.body.substring(0, 1500);
    getSubjectFeedbackAPI(subject, ctx)
      .then(function (result) {
        var feedback =
          typeof result.feedback === "object" ? result.feedback : null;
        var cascadeIdx = 0;
        var renderCards = function (items, colorClass) {
          return items
            .map(function (point) {
              var formatted = escapeHTML(point).replace(
                /\*\*(.+?)\*\*/g,
                "<strong>$1</strong>",
              );
              return (
                '<div class="smartpr-synonym-option ' +
                (colorClass || "") +
                ' smartpr-cascade-item" style="animation-delay:' +
                cascadeIdx++ * 60 +
                'ms"><span class="smartpr-synonym-text">' +
                formatted +
                "</span></div>"
              );
            })
            .join("");
        };
        var renderAlts = function (items) {
          return items
            .map(function (rawAlt) {
              var alt = rawAlt.replace(/^['"]+|['"]+$/g, "");
              return (
                '<div class="smartpr-suggestion-item smartpr-cascade-item" style="animation-delay:' +
                cascadeIdx++ * 60 +
                'ms"><div class="smartpr-suggestion-text">' +
                escapeHTML(alt) +
                '</div><div class="smartpr-suggestion-actions">' +
                '<button class="smartpr-use-button" data-text="' +
                escapeHTML(alt) +
                '">' +
                t("subject.use") +
                "</button>" +
                '<button class="smartpr-copy-button" data-text="' +
                escapeHTML(alt) +
                '">' +
                t("subject.copy") +
                "</button></div></div>"
              );
            })
            .join("");
        };
        var contentEl = $("#smartpr-content");
        if (
          feedback &&
          (feedback.positives || feedback.improvements || feedback.alternatives)
        ) {
          var html =
            '<div class="smartpr-section"><span class="smartpr-label">' +
            t("subject.yourSubject") +
            '</span><div class="smartpr-current-subject">' +
            escapeHTML(subject) +
            "</div></div>";
          if (feedback.positives && feedback.positives.length)
            html +=
              '<div class="smartpr-section"><span class="smartpr-label">' +
              t("subject.whatWorks") +
              '</span><div class="smartpr-synonym-list">' +
              renderCards(feedback.positives, "smartpr-feedback-positive") +
              "</div></div>";
          if (feedback.improvements && feedback.improvements.length)
            html +=
              '<div class="smartpr-section"><span class="smartpr-label">' +
              t("subject.improvements") +
              '</span><div class="smartpr-synonym-list">' +
              renderCards(
                feedback.improvements,
                "smartpr-feedback-improvement",
              ) +
              "</div></div>";
          if (feedback.alternatives && feedback.alternatives.length)
            html +=
              '<div class="smartpr-section"><span class="smartpr-label">' +
              t("subject.alternatives") +
              '</span><div class="smartpr-suggestions">' +
              renderAlts(feedback.alternatives) +
              "</div></div>";
          contentEl.innerHTML = html;
          $$(".smartpr-use-button").forEach(function (btn) {
            btn.addEventListener("click", function () {
              if (subjectField) {
                var setter = Object.getOwnPropertyDescriptor(
                  window.HTMLInputElement.prototype,
                  "value",
                ).set;
                setter.call(subjectField, btn.dataset.text);
                subjectField.dispatchEvent(
                  new Event("input", { bubbles: true }),
                );
                triggerSparkle(btn);
                btn.textContent = t("result.done");
                setTimeout(function () {
                  btn.textContent = t("subject.use");
                }, 2000);
              }
            });
          });
          $$(".smartpr-copy-button").forEach(function (btn) {
            btn.addEventListener("click", function () {
              copyToClipboard(btn.dataset.text);
              triggerSparkle(btn);
              btn.textContent = t("result.copied");
              setTimeout(function () {
                btn.textContent = t("subject.copy");
              }, 2000);
            });
          });
        } else {
          var feedbackText =
            typeof result.feedback === "string"
              ? result.feedback
              : JSON.stringify(result.feedback);
          var points = [];
          feedbackText.split(/\r?\n/).forEach(function (line) {
            var tr = line.trim();
            if (!tr) return;
            if (/^\d+\.\s+/.test(tr)) points.push(tr.replace(/^\d+\.\s+/, ""));
            else if (points.length > 0) points[points.length - 1] += " " + tr;
            else points.push(tr);
          });
          contentEl.innerHTML =
            '<div class="smartpr-section"><span class="smartpr-label">' +
            t("subject.yourSubject") +
            '</span><div class="smartpr-current-subject">' +
            escapeHTML(subject) +
            "</div></div>" +
            '<div class="smartpr-section"><span class="smartpr-label">' +
            t("sidebar.feedback") +
            '</span><div class="smartpr-synonym-list">' +
            renderCards(points) +
            "</div></div>" +
            '<div class="smartpr-section"><button class="smartpr-button" id="smartpr-generate-alternatives-btn">' +
            t("subject.generateBetter") +
            "</button></div>";
          $("#smartpr-generate-alternatives-btn").addEventListener(
            "click",
            function () {
              generateSubjectSuggestions(subject);
            },
          );
        }
        showToast(t("subject.feedbackReady"));
      })
      .catch(function (error) {
        showError(getErrorMessage(error));
      });
  }

  // ===== SELECTION TRACKING =====
  function startSelectionTracking() {
    stopSelectionTracking();
    if (!selectedEditor) return;
    var editorDoc =
      selectedEditorDoc || selectedEditor.ownerDocument || document;
    var handler = function () {
      if (selectionUpdateTimer) clearTimeout(selectionUpdateTimer);
      selectionUpdateTimer = setTimeout(function () {
        updateSelectedTextFromEditor();
      }, 150);
    };
    editorDoc.addEventListener("selectionchange", handler);
    editorDoc._smartprTrackHandler = handler;
  }

  function stopSelectionTracking() {
    if (selectionUpdateTimer) {
      clearTimeout(selectionUpdateTimer);
      selectionUpdateTimer = null;
    }
    if (selectedEditorDoc && selectedEditorDoc._smartprTrackHandler) {
      selectedEditorDoc.removeEventListener(
        "selectionchange",
        selectedEditorDoc._smartprTrackHandler,
      );
      delete selectedEditorDoc._smartprTrackHandler;
    }
  }

  function updateSelectedTextFromEditor() {
    if (!selectedEditor || currentSidebarMode !== "paragraph") return;
    var editorDoc =
      selectedEditorDoc || selectedEditor.ownerDocument || document;
    var editorWin = editorDoc.defaultView || window;
    var newText = "";
    var isInput = selectedEditor.tagName === "INPUT";
    if (isInput) {
      if (selectedEditor.selectionStart !== selectedEditor.selectionEnd)
        newText = selectedEditor.value
          .substring(selectedEditor.selectionStart, selectedEditor.selectionEnd)
          .trim();
      else
        newText = (selectedEditor.value && selectedEditor.value.trim()) || "";
      currentSelection = null;
    } else {
      var selection = editorWin.getSelection();
      if (
        selection &&
        !selection.isCollapsed &&
        selectedEditor.contains(selection.anchorNode)
      ) {
        newText = selection.toString().trim();
        currentSelection = selection.getRangeAt(0).cloneRange();
      } else {
        newText = selectedEditor.innerText.trim();
        currentSelection = null;
      }
    }
    if (newText && newText !== selectedText) {
      selectedText = newText;
      updateSelectedTextDisplay();
    }
  }

  function updateSelectedTextDisplay() {
    var display = $("#smartpr-content .smartpr-current-subject");
    if (!display) return;
    var actionBtns = $("#smartpr-content .smartpr-action-buttons");
    if (!actionBtns) return;
    var displayText =
      selectedText.length > 200
        ? selectedText.substring(0, 200) + "..."
        : selectedText;
    display.innerHTML = escapeHTML(displayText);
  }

  function startSubjectFieldTracking() {
    stopSubjectFieldTracking();
    if (!subjectField) return;
    var handler = function () {
      if (subjectFieldUpdateTimer) clearTimeout(subjectFieldUpdateTimer);
      subjectFieldUpdateTimer = setTimeout(function () {
        updateSubjectFieldDisplay();
      }, 150);
    };
    subjectField.addEventListener("input", handler);
    subjectField._smartprChangeHandler = handler;
  }

  function stopSubjectFieldTracking() {
    if (subjectFieldUpdateTimer) {
      clearTimeout(subjectFieldUpdateTimer);
      subjectFieldUpdateTimer = null;
    }
    if (subjectField && subjectField._smartprChangeHandler) {
      subjectField.removeEventListener(
        "input",
        subjectField._smartprChangeHandler,
      );
      delete subjectField._smartprChangeHandler;
    }
  }

  function updateSubjectFieldDisplay() {
    if (currentSidebarMode !== "subject") return;
    var val = subjectField ? subjectField.value.trim() : "";
    var display = $("#smartpr-content .smartpr-current-subject");
    if (display) display.innerHTML = escapeHTML(val || "(empty)");
  }

  function startEditorSelectionWatcher() {
    stopSelectionTracking();
    try {
      var iframeDoc =
        editorIframe &&
        (editorIframe.contentDocument ||
          (editorIframe.contentWindow && editorIframe.contentWindow.document));
      var iframeWin = editorIframe && editorIframe.contentWindow;
      if (!iframeDoc || !iframeWin) return;
      var handler = function () {
        if (selectionUpdateTimer) clearTimeout(selectionUpdateTimer);
        selectionUpdateTimer = setTimeout(function () {
          if (currentSidebarMode !== "paragraph") return;
          var sel = iframeWin.getSelection();
          if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
          var anchorNode = sel.anchorNode;
          var anchorEl =
            anchorNode && anchorNode.nodeType === 1
              ? anchorNode
              : anchorNode && anchorNode.parentElement;
          var editor =
            (anchorEl && anchorEl.closest(".tiptap.ProseMirror")) ||
            (anchorEl && anchorEl.closest(".mce-content-body"));
          if (!editor) return;
          selectedText = sel.toString().trim();
          selectedEditor = editor;
          selectedEditorDoc = iframeDoc;
          currentSelection = sel.getRangeAt(0).cloneRange();
          showParagraphCoachContent();
          startSelectionTracking();
        }, 200);
      };
      iframeDoc.addEventListener("selectionchange", handler);
      iframeDoc._smartprEditorSelHandler = handler;
    } catch (e) {
      /* ignore */
    }
  }

  // ===== PARSING HELPERS =====
  function parseSynonymsFromText(text) {
    var suggestions = [];
    var lines = text.split("\n").filter(function (l) {
      return l.trim();
    });
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf("\u2192") !== -1 || line.indexOf("->") !== -1) {
        var parts = line.split(/\u2192|->/).map(function (s) {
          return s.trim();
        });
        if (parts.length >= 2) {
          parts[1]
            .split(",")
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean)
            .forEach(function (s) {
              suggestions.push(s);
            });
          continue;
        }
      }
      var listMatch = line.match(/^(?:\d+[.)]\s*|-\s*|\*\s*)(.+)/);
      if (listMatch) {
        suggestions.push(listMatch[1].trim());
        continue;
      }
    }
    if (suggestions.length === 0) {
      var commaList = text
        .split(",")
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      if (commaList.length > 1) suggestions = commaList;
    }
    if (suggestions.length === 0 && text.trim()) suggestions.push(text.trim());
    return suggestions;
  }

  function parseRephraseFromText(text) {
    var options = [];
    text
      .split("\n")
      .filter(function (l) {
        return l.trim();
      })
      .forEach(function (line) {
        var m = line.match(/^(?:\d+[.)]\s*|-\s*|\*\s*)(.+)/);
        if (m) options.push(m[1].trim());
      });
    if (options.length === 0 && text.trim()) options.push(text.trim());
    return options;
  }

  // ===== UX UTILITIES =====
  function getProgressMessages() {
    return {
      grammar: t("progress.grammar"),
      rephrase: t("progress.rephrase"),
      synonyms: t("progress.synonyms"),
      translate: t("progress.translate"),
      shorter: t("progress.shorter"),
      summarize: t("progress.summarize"),
      kb: t("progress.kb"),
      default: t("progress.default"),
    };
  }

  function showLoadingState(message, action) {
    var content = $("#smartpr-content");
    if (loadingMessageTimer) {
      clearInterval(loadingMessageTimer);
      loadingMessageTimer = null;
    }
    var skeletonHTML = "";
    if (action === "synonyms" || action === "rephrase") {
      skeletonHTML =
        '<div class="smartpr-skeleton smartpr-skeleton-label"></div>' +
        '<div class="smartpr-skeleton smartpr-skeleton-card smartpr-cascade-item" style="animation-delay:0ms"></div>' +
        '<div class="smartpr-skeleton smartpr-skeleton-card smartpr-cascade-item" style="animation-delay:100ms"></div>' +
        '<div class="smartpr-skeleton smartpr-skeleton-card smartpr-cascade-item" style="animation-delay:200ms"></div>';
    } else if (
      action === "grammar" ||
      action === "translate" ||
      action === "shorter" ||
      action === "summarize"
    ) {
      skeletonHTML =
        '<div class="smartpr-skeleton smartpr-skeleton-label"></div>' +
        '<div class="smartpr-skeleton smartpr-skeleton-text"></div>';
    }
    content.innerHTML =
      '<div class="smartpr-loading">' +
      (skeletonHTML || '<div class="smartpr-spinner"></div>') +
      '<div class="smartpr-loading-text">' +
      (message || t("loading.generating")) +
      "</div></div>";
    var messages =
      getProgressMessages()[action] || getProgressMessages().default;
    var msgIndex = 1;
    loadingMessageTimer = setInterval(function () {
      var el = content.querySelector(".smartpr-loading-text");
      if (el && msgIndex < messages.length) {
        el.style.opacity = "0";
        el.style.transition = "opacity .2s ease";
        setTimeout(function () {
          el.textContent = messages[msgIndex];
          el.style.opacity = "1";
          msgIndex++;
        }, 200);
      }
      if (msgIndex >= messages.length) {
        clearInterval(loadingMessageTimer);
        loadingMessageTimer = null;
      }
    }, 2500);
  }

  function showError(message) {
    var content = $("#smartpr-content");
    var errorHTML =
      '<div class="smartpr-error"><div class="smartpr-error-text">' +
      escapeHTML(message) +
      "</div></div>";
    content.innerHTML =
      errorHTML +
      content.innerHTML.replace(
        /<div class="smartpr-error">[\s\S]*?<\/div>/,
        "",
      );
  }

  function setContentWithTransition(html) {
    return new Promise(function (resolve) {
      var content = $("#smartpr-content");
      content.style.opacity = "0";
      content.style.transition = "opacity .1s ease";
      setTimeout(function () {
        content.innerHTML = html;
        content.style.opacity = "";
        content.style.transition = "";
        content.classList.remove("smartpr-view-enter");
        void content.offsetWidth;
        content.classList.add("smartpr-view-enter");
        resolve();
      }, 100);
    });
  }

  function triggerSparkle(buttonElement) {
    if (!buttonElement) return;
    var rect = buttonElement.getBoundingClientRect();
    var colors = [
      "#FFD580",
      "#FFBC7F",
      "#FFB0C0",
      "#E8B5E8",
      "#D4A5F5",
      "#34D399",
    ];
    for (var i = 0; i < 7; i++) {
      var spark = document.createElement("div");
      spark.className = "smartpr-sparkle";
      var angle = (i / 7) * Math.PI * 2;
      var dist = 20 + Math.random() * 25;
      spark.style.setProperty("--sx", Math.cos(angle) * dist + "px");
      spark.style.setProperty("--sy", Math.sin(angle) * dist + "px");
      spark.style.left = rect.left + rect.width / 2 - 3 + "px";
      spark.style.top = rect.top + rect.height / 2 - 3 + "px";
      spark.style.position = "fixed";
      spark.style.background = colors[i % colors.length];
      document.body.appendChild(spark);
      setTimeout(
        (function (s) {
          return function () {
            s.remove();
          };
        })(spark),
        550,
      );
    }
  }

  function typewriterEffect(element, text, speed) {
    speed = speed || 18;
    return new Promise(function (resolve) {
      var words = text.split(/(\s+)/);
      var i = 0;
      element.textContent = "";
      var cursor = document.createElement("span");
      cursor.className = "smartpr-typing-cursor";
      cursor.textContent = "|";
      element.appendChild(cursor);
      var interval = setInterval(function () {
        if (i < words.length) {
          cursor.before(document.createTextNode(words[i]));
          i++;
        } else {
          clearInterval(interval);
          cursor.remove();
          resolve();
        }
      }, speed);
    });
  }

  function diffWords(original, corrected) {
    var origWords = original.split(/(\s+)/);
    var corrWords = corrected.split(/(\s+)/);
    var result = [];
    var oi = 0;
    for (var ci = 0; ci < corrWords.length; ci++) {
      var word = corrWords[ci];
      if (!word.trim()) {
        result.push({ text: word, changed: false });
        continue;
      }
      if (oi < origWords.length && origWords[oi] === word) {
        result.push({ text: word, changed: false });
        oi++;
      } else {
        while (oi < origWords.length && !origWords[oi].trim()) oi++;
        if (oi < origWords.length && origWords[oi] === word) {
          result.push({ text: word, changed: false });
          oi++;
        } else {
          result.push({ text: word, changed: true });
          if (oi < origWords.length) oi++;
        }
      }
    }
    return result;
  }

  function renderDiffHTML(diffResult) {
    return diffResult
      .map(function (seg) {
        return seg.changed
          ? '<span class="smartpr-diff-highlight">' +
              escapeHTML(seg.text) +
              "</span>"
          : escapeHTML(seg.text);
      })
      .join("");
  }

  function copyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text);
    } catch (e) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(t("toast.copiedToClipboard"));
  }

  function showToast(message) {
    if (extensionDisabled) return;
    var toast = document.createElement("div");
    toast.className = "smartpr-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 2000);
  }

  // ===== CROSS-FRAME MESSAGING (Pro Editor) =====
  window.addEventListener("message", function (e) {
    if (
      !e.data ||
      typeof e.data.type !== "string" ||
      e.data.type.indexOf("sph:") !== 0
    )
      return;
    switch (e.data.type) {
      case "sph:open-sidebar":
        proEditorSource = e.source;
        proEditorBlockType = e.data.blockType || "text";
        proEditorContext = e.data.context || "";
        selectedText = e.data.text;
        selectedEditor = null;
        selectedEditorDoc = null;
        currentSelection = null;
        openParagraphCoachSidebar();
        break;
      case "sph:selection-update":
        if (currentSidebarMode !== "paragraph") return;
        selectedText = e.data.text;
        proEditorBlockType = e.data.blockType || proEditorBlockType;
        updateSelectedTextDisplay();
        break;
    }
  });

  // ===== CUSTOM EVENT LISTENERS =====
  window.addEventListener(EVENT_PREFIX + "open", function () {
    openSidebarFromIcon();
  });
  window.addEventListener(EVENT_PREFIX + "close", closeSidebar);
  window.addEventListener(EVENT_PREFIX + "setContext", function (e) {
    if (e.detail) setContextInternal(e.detail);
  });

  // ===== CONTEXT MANAGEMENT =====
  function setContextInternal(payload) {
    if (payload.user != null) hostContext.user = payload.user;
    if (payload.client != null) hostContext.client = payload.client;
    if (payload.user && payload.user.email) {
      try {
        localStorage.setItem(STORAGE_KEY_EMAIL, payload.user.email);
      } catch (e) {
        /* ignore */
      }
    }
    if (payload.language) {
      setLanguage(payload.language);
    }
    emit("contextUpdated", hostContext);
  }

  // ===== TEARDOWN =====
  function teardownExtensionUI() {
    hideNudge();
    if (dialogObserver) {
      dialogObserver.disconnect();
      dialogObserver = null;
    }
    if (editorIframeObserver) {
      editorIframeObserver.disconnect();
      editorIframeObserver = null;
    }
    editorIframe = null;
    if (iconOverlayContainer) {
      iconOverlayContainer.remove();
      iconOverlayContainer = null;
    }
    elementToIconMap = new WeakMap();
    closeSidebar();
    if (sidebar) {
      sidebar.remove();
      sidebar = null;
    }
    if (floatingIcon) {
      floatingIcon.remove();
      floatingIcon = null;
    }
  }

  // ===== GLOBAL API =====
  var api = {
    open: function () {
      openSidebarFromIcon();
    },
    close: closeSidebar,
    toggle: function () {
      if (sidebar && sidebar.classList.contains("smartpr-open")) closeSidebar();
      else openSidebarFromIcon();
    },
    isOpen: function () {
      return !!(sidebar && sidebar.classList.contains("smartpr-open"));
    },
    setContext: function (payload) {
      setContextInternal(payload);
    },
    getContext: function () {
      return Object.assign({}, hostContext);
    },
    setLanguage: function (lang) {
      setLanguage(lang);
    },
    getLanguage: function () {
      return currentLang;
    },
    on: function (event, callback) {
      if (!eventCallbacks[event]) eventCallbacks[event] = [];
      eventCallbacks[event].push(callback);
    },
    off: function (event, callback) {
      if (!eventCallbacks[event]) return;
      eventCallbacks[event] = eventCallbacks[event].filter(function (cb) {
        return cb !== callback;
      });
    },
    destroy: function () {
      teardownExtensionUI();
      var styleEl = document.getElementById("smartpr-widget-styles");
      if (styleEl) styleEl.remove();
      var root = document.getElementById("smartpr-widget-root");
      if (root) root.remove();
      delete window.__SMARTPR_WIDGET_LOADED__;
      delete window.SmartPRAssistant;
    },
  };

  window.SmartPRAssistant = api;

  // ===== INITIALIZATION =====
  function init() {
    initLanguage();
    injectStyles();

    // Check for disabled state in localStorage
    try {
      extensionDisabled = localStorage.getItem(STORAGE_KEY_DISABLED) === "true";
    } catch (e) {
      extensionDisabled = false;
    }

    if (!extensionDisabled) {
      createFloatingIcon();
      initDialogWatcher();
    }

    emit("ready", { version: "2.1.0" });
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
