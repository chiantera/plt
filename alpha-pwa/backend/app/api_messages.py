"""Localized API errors. User content is never passed through this catalog."""

MESSAGES = {
    "Estrai e carica singolarmente i file dell’archivio.": (
        "Extract the archive and upload the files individually.",
        "Entpacken Sie das Archiv und laden Sie die Dateien einzeln hoch.",
    ),
    "Estrazione non riuscita. Incolla il testo manualmente.": (
        "Text extraction failed. Paste the text manually.",
        "Die Textextraktion ist fehlgeschlagen. Fügen Sie den Text manuell ein.",
    ),
    "Nessun testo estratto dall'URL. Il contenuto potrebbe essere dinamico (JavaScript) o non accessibile.": (
        "No text could be extracted from the URL. The page may be dynamic or inaccessible.",
        "Aus der URL konnte kein Text extrahiert werden. Die Seite ist möglicherweise dynamisch oder nicht zugänglich.",
    ),
    "Analisi non riuscita. Riprova tra qualche secondo.": (
        "Analysis failed. Try again in a few seconds.",
        "Die Analyse ist fehlgeschlagen. Versuchen Sie es in einigen Sekunden erneut.",
    ),
    "Job di analisi sconosciuto o scaduto.": (
        "The analysis job could not be found or has expired.",
        "Der Analyseauftrag wurde nicht gefunden oder ist abgelaufen.",
    ),
    "Chat non disponibile. Riprova tra qualche secondo.": (
        "Chat is unavailable. Try again in a few seconds.",
        "Der Chat ist nicht verfügbar. Versuchen Sie es in einigen Sekunden erneut.",
    ),
    "File troppo grande per l'upload alpha": (
        "The file exceeds the upload limit.", "Die Datei überschreitet die Upload-Grenze.",
    ),
    "URL non valido: sono supportati solo http:// e https://": (
        "Invalid URL. Use http:// or https://.", "Ungültige URL. Verwenden Sie http:// oder https://.",
    ),
    "Impossibile recuperare il contenuto dall'URL.": (
        "Could not retrieve content from this URL.", "Der Inhalt dieser URL konnte nicht geladen werden.",
    ),
    "Trascrizione non disponibile.": ("Transcription is unavailable.", "Die Transkription ist nicht verfügbar."),
    "Trascrizione non riuscita. Contatta studiolegale.ai@gmail.com": (
        "Transcription failed. Contact studiolegale.ai@gmail.com.",
        "Die Transkription ist fehlgeschlagen. Kontaktieren Sie studiolegale.ai@gmail.com.",
    ),
}


def translate_error(message: str, accept_language: str) -> str:
    language = accept_language.split(",", 1)[0].split(";", 1)[0].strip().lower().split("-", 1)[0]
    translations = MESSAGES.get(message)
    if not translations or language not in ("en", "de"):
        return message
    return translations[0 if language == "en" else 1]
