import unicodedata


def normalise(word: str) -> str:
    """Normalize a headword for use as a dictionary key."""
    word = word.lower().strip()
    word = unicodedata.normalize('NFD', word)
    word = ''.join(c for c in word if unicodedata.category(c) != 'Mn')
    return word


def get_letter(word: str) -> str:
    """Get the bucket letter for a headword. Handles Æ→A, Œ→O."""
    w = normalise(word)
    if not w:
        return 'A'
    first = word.strip()[0]
    if first in ('Æ', 'æ'):
        return 'A'
    if first in ('Œ', 'œ'):
        return 'O'
    first_upper = w[0].upper()
    if 'A' <= first_upper <= 'Z':
        return first_upper
    return 'A'
