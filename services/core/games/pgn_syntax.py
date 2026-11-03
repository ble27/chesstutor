import re

from services.core.games.discovery import DiscoveryError

# python-chess deliberately skips unrecognized text. This lexical pass makes
# malformed tokens and contradictory/missing movetext results import errors.
TOKEN = re.compile(
    r"(?P<space>\s+)|(?P<comment>\{[^}]*\}|;[^\r\n]*|^%[^\r\n]*)"
    r'|(?P<header>\[[A-Za-z0-9_]+\s+"(?:[^"\\]|\\["\\])*"\s*\])'
    r"|(?P<result>1/2-1/2|1-0|0-1|\*)"
    r"|(?P<number>\d+\.(?:\.\.)?|\.\.\.)|(?P<nag>\$\d+|[!?]+)"
    r"|(?P<open>\()|(?P<close>\))"
    r"|(?P<move>(?:[NBKRQ]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBQR])?"
    r"|O-O(?:-O)?|0-0(?:-0)?)[+#]?)",
    re.MULTILINE,
)


def validate_pgn_syntax(pgn: str, expected: str) -> None:
    offset, depth = 0, 0
    started, ended = False, False
    while offset < len(pgn):
        match = TOKEN.match(pgn, offset)
        if match is None:
            raise DiscoveryError("invalid_pgn", "The PGN contains unrecognized text.")
        kind = match.lastgroup
        offset = match.end()
        if kind in {"space", "comment"}:
            continue
        if kind == "header":
            if started:
                raise DiscoveryError("invalid_pgn", "The PGN contains misplaced headers.")
            continue
        if ended:
            raise DiscoveryError("invalid_pgn", "The PGN contains moves after its result.")
        started = True
        if kind == "open":
            depth += 1
            if depth > 64:
                raise DiscoveryError("invalid_pgn", "PGN variations are nested too deeply.")
        elif kind == "close":
            depth -= 1
            if depth < 0:
                raise DiscoveryError("invalid_pgn", "The PGN has unmatched variations.")
        elif kind == "result" and depth == 0:
            if match.group() != expected:
                raise DiscoveryError(
                    "unfinished_game", "PGN and provider completion results disagree."
                )
            ended = True
    if depth != 0 or not ended:
        raise DiscoveryError("invalid_pgn", "The PGN has no complete main-line result.")
