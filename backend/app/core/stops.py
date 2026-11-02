"""
Static stops lookup: stop_name + route -> stop_order.

Hardcoded from the dataset's unique (Route, Stop_Name, Stop_Order) combinations.
The 9 stops run in opposite order depending on route direction.
"""

# (route_api_key, stop_name) -> stop_order
# route_api_key uses the API convention: "belman_to_udupi" / "udupi_to_belman"
STOP_ORDER_LOOKUP: dict[tuple[str, str], int] = {
    # Belman -> Udupi direction
    ("belman_to_udupi", "Belman"):       1,
    ("belman_to_udupi", "Jantra"):       2,
    ("belman_to_udupi", "Shirva"):       3,
    ("belman_to_udupi", "Bantakal"):     4,
    ("belman_to_udupi", "SMVITM"):       5,
    ("belman_to_udupi", "Shankarpura"):  6,
    ("belman_to_udupi", "Subhasnagara"): 7,
    ("belman_to_udupi", "Katpadi"):      8,
    ("belman_to_udupi", "Udupi"):        9,
    # Udupi -> Belman direction (reversed order)
    ("udupi_to_belman", "Udupi"):        1,
    ("udupi_to_belman", "Katpadi"):      2,
    ("udupi_to_belman", "Subhasnagara"): 3,
    ("udupi_to_belman", "Shankarpura"):  4,
    ("udupi_to_belman", "SMVITM"):       5,
    ("udupi_to_belman", "Bantakal"):     6,
    ("udupi_to_belman", "Shirva"):       7,
    ("udupi_to_belman", "Jantra"):       8,
    ("udupi_to_belman", "Belman"):       9,
}

# All known stop names (for frontend dropdown population)
ALL_STOP_NAMES = [
    "Belman", "Jantra", "Shirva", "Bantakal", "SMVITM",
    "Shankarpura", "Subhasnagara", "Katpadi", "Udupi",
]

# Mapping from API route keys to the original dataset route strings (with arrows)
ROUTE_API_TO_DATASET = {
    "belman_to_udupi": "Belman \u2192 Udupi",
    "udupi_to_belman": "Udupi \u2192 Belman",
}


def get_stop_order(route: str, stop_name: str) -> int | None:
    """Return stop order for a (route, stop_name) pair, or None if invalid."""
    return STOP_ORDER_LOOKUP.get((route, stop_name))
