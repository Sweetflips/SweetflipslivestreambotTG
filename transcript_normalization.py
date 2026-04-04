"""
Whisper transcription vocabulary: canonical spellings for brands, slots, and streamers.

Shared with ``scripts/streamer_obs_whisper_agent`` (single source of truth).
"""

from __future__ import annotations

import re


def _w(pattern: str, canonical: str) -> tuple[re.Pattern[str], str]:
    return (re.compile(r"(?i)\b(?:" + pattern + r")\b"), canonical)


def _wp(pattern: str, canonical: str) -> tuple[re.Pattern[str], str]:
    """Phrase pattern (may contain spaces)."""
    return (re.compile(r"(?i)" + pattern), canonical)


VOCAB_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # --- Mascoobs (brand) — Whisper often says mascopes, mascop, mass scopes, etc. ---
    _wp(r"\bmy\s+scoops?,?\s*my\s+scupes?\b", "Mascoobs"),
    _wp(r"\bmy\s+scupes?,?\s*my\s+scoops?\b", "Mascoobs"),
    _wp(r"\bm[ua]s+c?o{1,2}ps?\s*,\s*m[ua]s+c?o{1,2}ps?\b", "Mascoobs"),
    _wp(r"\bmass\s+scopes?\b", "Mascoobs"),
    _wp(r"\bmass\s+coops?\b", "Mascoobs"),
    _wp(r"\bmas\s+co{1,2}bs?\b", "Mascoobs"),
    _wp(r"\bmass\s+co{1,2}bs?\b", "Mascoobs"),
    _wp(r"\bmask\s+co{1,2}bs?\b", "Mascoobs"),
    _w(
        r"mascopes?|mascop|mascops|mascubes?|mascobes?|mascoups?|"
        r"m[ua]s+copes?|m[ua]s+cop\b|m[ua]s+cops\b|"
        r"m[ua]s+c?o{1,2}ps?|m[ua]ssc+oops?|mucscoops?|musscoops?|muscoops|mascoops|"
        r"mus+copes?|muskopes?",
        "Mascoobs",
    ),

    # --- CSgoWin (incl. "cheese go win" mishear) ---
    _wp(r"\bcheese\s+go\s+win\b|\bchees\s+go\s+win\b", "CSgoWin"),
    _w(r"cs\s*go\s*win|csgo\s*win|cs\s*go\s*when|csg[oa]\s*wi?n", "CSgoWin"),

    # --- LuxDrop ("Lux Drops", "Looks drop") ---
    _wp(r"\blux\s+drops?\b", "LuxDrop"),
    _wp(r"\blooks?\s+drop\b", "LuxDrop"),
    _w(r"lux\s*drop|luxe?\s*drop|lucks?\s*drop|lux\s*tr[oa]p", "LuxDrop"),

    # --- Spartans ---
    _w(r"spart[ae]ns?|spartan's", "Spartans"),

    # --- Sweetflips ---
    _w(r"sweet\s*flips?|swee?t\s*fl[ie]ps?|suite?\s*flips?", "Sweetflips"),

    # --- Nico ---
    _w(r"n[iy]c+[ko]|neek[ao]|nikko|nee?co", "Nico"),

    # --- Amor ---
    _w(r"am[ao]r|a\s*more?|amour", "Amor"),

    # --- Danny ---
    _w(r"dann[iy]e?|denn[iy]e?|denny", "Danny"),

    # --- Kazlic ---
    _w(r"kazl[iy]c?k?|kasl[iy]ck?|cazl[iy]ck?|kaz+l[iy]k", "Kazlic"),

    # --- Boomer / Boomer song ---
    _wp(r"\bboome?r\s+song\b", "Boomer song"),
    _w(r"boome?rs?|boo?mme?rs?", "Boomer"),

    # --- Slot / casino terms ---
    _w(r"bonus\s*hunt|bonush[ua]nt", "Bonushunt"),
    _wp(r"\bbonus\s+open(?:ing|ings?)?\b", "Bonus opening"),
    _w(r"up\s*gr[ae]de?r|upgrader", "Upgrader"),
    _w(r"wi?lds?", "Wilds"),
    _wp(r"\bmax\s+wi?ns?\b", "Max win"),

    # --- Short / exact terms (simple case-fix, no fuzzy needed) ---
    _w(r"VIP", "VIP"),
    _w(r"spam", "Spam"),
    _w(r"send", "Send"),
    _w(r"WW|w\s*w", "WW"),
    _w(r"boxes|box", "Boxes"),
    _w(r"bonus", "Bonus"),
    _w(r"BANG|bang", "BANG"),

    # --- Slot providers ---
    _wp(r"\bpragmatic\s+play\b", "Pragmatic Play"),
    _wp(r"\bpreg\s*matic\b", "Pragmatic"),
    _w(r"pregmatic|pragmatic|pragmaticplay", "Pragmatic"),
    _wp(r"\bhax(?:or|xor)\s+gaming\b", "Hacksaw Gaming"),
    _w(r"hacksaw|hack\s*saw|hacksaw\s*gaming|hax(?:or|xor)|haxsaw", "Hacksaw"),
    _wp(r"\bno\s*-?\s*limit\s+city\b", "Nolimit City"),
    _w(r"nolimit|no\s*-?\s*limit|no\s+limit", "Nolimit"),
    # --- Pragmatic Play — flagship / frequent titles (phrase fixes) ---
    # Longer titles first so "… 1000" is not split.
    _wp(r"\bgates?\s+of\s+olympus\s+1000\b", "Gates of Olympus 1000"),
    _wp(
        r"\bgates?\s+of\s+olympus\s+super\s+scatter\b",
        "Gates of Olympus Super Scatter",
    ),
    _wp(
        r"\bgates?\s+of\s+ol[yi]mp(?:us|is|ics|ix)\b",
        "Gates of Olympus",
    ),
    _wp(r"\bsweet\s+b[ao]n[ae]nz[ao]\s+1000\b", "Sweet Bonanza 1000"),
    _wp(r"\bsweet\s+b[ao]n[ae]nz[ao]\b", "Sweet Bonanza"),
    _wp(r"\bstar\s*light\s+princess\s+1000\b", "Starlight Princess 1000"),
    _wp(r"\bstar\s*light\s+princess\b", "Starlight Princess"),
    _wp(r"\bsugar\s+rush\s+1000\b", "Sugar Rush 1000"),
    _wp(r"\bbig\s+bass\s+b[ao]n[ae]nz[ao]\b", "Big Bass Bonanza"),
    _wp(r"\bbig\s+bass\s+raceday\s+repeat\b", "Big Bass Raceday Repeat"),
    _wp(r"\bsugar\s+rush\b", "Sugar Rush"),
    _wp(r"\bmustang\s+gold\b", "Mustang Gold"),
    _wp(r"\bwild\s+west\s+gold\b", "Wild West Gold"),
    _wp(r"\bgreat\s+rhino\b", "Great Rhino"),
    _wp(r"\bjelly\s+express\b", "Jelly Express"),
    _wp(r"\bsnow\s+party\b", "Snow Party"),
    _wp(r"\bsteamin['\u2019]?\s*reels?\b", "Steamin' Reels"),
    # --- Hacksaw Gaming — official-style titles (conservative phrases) ---
    _wp(r"\bepic\s+bullets?\s+and\s+bounty\b", "Epic Bullets and Bounty"),
    # Non-epic variant after epic so both match intended title
    _wp(r"\bbullets?\s+and\s+bounty\b", "Bullets and Bounty"),
    _wp(r"\ble\s+bunny\b", "Le Bunny"),
    _wp(r"\bdusk\s+princess\b", "Dusk Princess"),
    _wp(r"\brainbow\s+princess\b", "Rainbow Princess"),
    _wp(r"\bchaos\s+crew\s*3\b", "Chaos Crew 3"),
    _wp(r"\bmiami\s+mayhem\b", "Miami Mayhem"),
    _wp(r"\bzeus\s+ze\s+zec(?:ond|on|o)\b", "Zeus Ze Zecond"),
    _wp(r"\bmarlin\s+masters?\b", "Marlin Masters: The Big Haul"),
    # --- Nolimit City — flagship titles ---
    _wp(
        r"\bsan\s+quentin\s+2\b",
        "San Quentin 2: Death Row",
    ),
    _wp(r"\bsan\s+quentin\b", "San Quentin"),
    _wp(r"\btombstone\s+(?:r\.?i\.?p\.?|rip)\b", "Tombstone RIP"),
    _wp(r"\bfire\s+in\s+the\s+hole\b", "Fire in the Hole"),
    _wp(r"\bdas\s+x\s*boot\s+2\b|das\s*x\s*boot\s+2\b", "Das xBoot 2wei"),
    _wp(r"\bdas\s+x\s*boot\b|das\s*x\s*boot\b|doss\s+x\s*boot\b", "Das xBoot"),
    _wp(r"\bdeadwood\b", "Deadwood"),
    _wp(
        r"\bplay\s*n\s*go\b|play'?n'?go|playngo|play\s+and\s+go|play\s+ngo",
        "Play'n GO",
    ),
    _w(r"b\s*-?\s*gaming|bgaming|bee\s+gaming|bee\s*gaming", "BGaming"),

    # --- Originals (Keno, Limbo, Dice, Mines, Plinko) ---
    _w(r"keeno|kino", "Keno"),
    _w(r"limbo", "Limbo"),
    _w(r"dyce|dyse|\bdice\b", "Dice"),
    _w(r"mines|mine'?s\s+game|mines\s+game", "Mines"),
    _w(r"plinko|plincko|plink[oa]|plinco", "Plinko"),

    # --- Social platforms (YouTube, Instagram, Discord, Telegram, X, Twitter) ---
    _w(r"youtubers", "YouTubers"),
    _w(r"youtuber", "YouTuber"),
    _w(r"youtube|you\s*-?\s*tube|u\s*-?\s*tube", "YouTube"),
    _w(r"instagram|instagrahm|insta\.?gram|\binsta\b", "Instagram"),
    _w(r"discord|discorde|discoard", "Discord"),
    _w(r"telegram|telegrm|tele\s*-?\s*gram", "Telegram"),
    _w(r"twitter|twittter|twiter|twitta", "Twitter"),
    # X (rebrand): phonetic "eks" after "on" (Whisper often writes "eks" for the letter X)
    _wp(r"\bon\s+eks\b", "on X"),
]


def normalize_vocab(text: str) -> str:
    if not (text or "").strip():
        return text
    t = text.strip()
    # Two passes: fixes like "Lux Drops" → LuxDrop then nearby words can align
    for _ in range(2):
        for pat, repl in VOCAB_PATTERNS:
            t = pat.sub(repl, t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


def normalize_brand_transcript(text: str) -> str:
    """Backward-compatible name for ``streamer_agent.py``; applies full vocabulary."""
    return normalize_vocab(text)
