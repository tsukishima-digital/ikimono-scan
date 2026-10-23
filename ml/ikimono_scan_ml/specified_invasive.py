"""Extract the official specified-invasive designation scopes from the MOE list page."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser

SOURCE_ID = "moe-specified-invasive-alien-species"
ORGANISM_GROUPS = [
    "mammals",
    "birds",
    "reptiles",
    "amphibians",
    "fish",
    "insects",
    "crustaceans",
    "arachnids",
    "mollusks",
    "plants",
]


@dataclass
class _Cell:
    text_parts: list[str] = field(default_factory=list)
    rowspan: int = 1
    colspan: int = 1

    @property
    def text(self) -> str:
        return _normalize("".join(self.text_parts))


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[_Cell]]] = []
        self._table: list[list[_Cell]] | None = None
        self._row: list[_Cell] | None = None
        self._cell: _Cell | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "table":
            self._table = []
        elif self._table is not None and tag == "tr":
            self._row = []
        elif self._row is not None and tag in {"td", "th"}:
            self._cell = _Cell(
                rowspan=_positive_int(attributes.get("rowspan")),
                colspan=_positive_int(attributes.get("colspan")),
            )
        elif self._cell is not None and tag == "br":
            self._cell.text_parts.append(" ")

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.text_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._cell is not None and self._row is not None:
            self._row.append(self._cell)
            self._cell = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            if self._row:
                self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            self.tables.append(self._table)
            self._table = None


def extract_designations(
    content: bytes,
    *,
    group_names: list[str] = ORGANISM_GROUPS,
    specified_heading: str = "特定外来生物",
    conditional_marker: str = "条件付特定外来生物",
) -> list[dict]:
    """Return official designation scopes in source order, preserving conditional exceptions."""

    parser = _TableParser()
    parser.feed(content.decode("utf-8"))
    parser.close()
    grids = [_expand_table(table) for table in parser.tables]
    specified_tables = [
        grid for grid in grids if grid and any(cell.text == specified_heading for cell in grid[0])
    ]
    if len(specified_tables) != len(group_names):
        raise ValueError(
            "Official specified-invasive table count changed: "
            f"expected {len(group_names)}, found {len(specified_tables)}"
        )

    designations: list[dict] = []
    for organism_group, grid in zip(group_names, specified_tables, strict=True):
        heading_row = grid[0]
        designation_column = next(
            index for index, cell in enumerate(heading_row) if cell.text == specified_heading
        )
        designation_cells: list[_Cell] = []
        for row in grid[2:]:
            if designation_column >= len(row):
                continue
            cell = row[designation_column]
            if cell not in designation_cells and cell.text not in {"", "なし"}:
                designation_cells.append(cell)

        for cell in designation_cells:
            wholly_conditional = conditional_marker in cell.text
            scope_text = _without_marker(cell.text, conditional_marker)
            conditional_members: list[str] = []
            if not wholly_conditional:
                for row in grid[2:]:
                    if designation_column >= len(row) or row[designation_column] is not cell:
                        continue
                    for detail in row[designation_column + 1 : -1]:
                        if detail is cell or conditional_marker not in detail.text:
                            continue
                        member = _without_marker(detail.text, conditional_marker)
                        if member and member not in conditional_members:
                            conditional_members.append(member)

            designations.append(
                {
                    "id": _designation_id(organism_group, scope_text),
                    "sourceId": SOURCE_ID,
                    "organismGroup": organism_group,
                    "scopeText": scope_text,
                    "regulationType": "conditional" if wholly_conditional else "specified",
                    "conditionalMembers": conditional_members,
                }
            )
    return designations


def _expand_table(rows: list[list[_Cell]]) -> list[list[_Cell]]:
    grid: list[list[_Cell]] = []
    active_rowspans: dict[int, tuple[_Cell, int]] = {}
    for source_row in rows:
        row: list[_Cell] = []
        column = 0
        for cell in source_row:
            column = _fill_rowspans(row, active_rowspans, column)
            for _ in range(cell.colspan):
                row.append(cell)
                if cell.rowspan > 1:
                    active_rowspans[column] = (cell, cell.rowspan - 1)
                column += 1
        _fill_rowspans(row, active_rowspans, column)
        grid.append(row)
    return grid


def _fill_rowspans(
    row: list[_Cell],
    active_rowspans: dict[int, tuple[_Cell, int]],
    column: int,
) -> int:
    while column in active_rowspans:
        cell, remaining = active_rowspans[column]
        row.append(cell)
        if remaining == 1:
            del active_rowspans[column]
        else:
            active_rowspans[column] = (cell, remaining - 1)
        column += 1
    return column


def _designation_id(organism_group: str, scope_text: str) -> str:
    digest = hashlib.sha256(f"{organism_group}\0{scope_text}".encode()).hexdigest()[:16]
    return f"moe-ias-{digest}"


def _without_marker(text: str, marker: str) -> str:
    value = text.replace(marker, "")
    value = re.sub(r"[【】]", "", value)
    value = re.sub(r"\(\s*\)", "", value)
    return _normalize(value).strip()


def _normalize(value: str) -> str:
    return " ".join(value.split())


def _positive_int(value: str | None) -> int:
    try:
        return max(1, int(value or "1"))
    except ValueError:
        return 1
