#!/usr/bin/env python3
"""Export a Confluence page as Markdown, JSON, or YAML.

This script uses only Python's standard library. It supports Confluence Cloud
URLs that include a page id, plus legacy /display/SPACE/Page+Title URLs.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Any


SUPPORTED_FORMATS = ("markdown", "json", "yaml")


class ConfluenceError(RuntimeError):
    pass


class MarkdownHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.href_stack: list[str | None] = []
        self.list_stack: list[str] = []
        self.table_rows: list[list[str]] = []
        self.current_row: list[str] | None = None
        self.current_cell: list[str] | None = None
        self.in_pre = False
        self.heading_level: int | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self._block_break()
            self.heading_level = int(tag[1])
            self.parts.append("#" * self.heading_level + " ")
        elif tag == "p":
            self._block_break()
        elif tag == "br":
            self.parts.append("\n")
        elif tag in {"strong", "b"}:
            self.parts.append("**")
        elif tag in {"em", "i"}:
            self.parts.append("*")
        elif tag == "code" and not self.in_pre:
            self.parts.append("`")
        elif tag == "pre":
            self._block_break()
            self.in_pre = True
            self.parts.append("```\n")
        elif tag == "a":
            self.href_stack.append(attrs_map.get("href"))
            self.parts.append("[")
        elif tag in {"ul", "ol"}:
            self.list_stack.append(tag)
            self._block_break()
        elif tag == "li":
            self._block_break()
            marker = "1. " if self.list_stack[-1:] == ["ol"] else "- "
            self.parts.append("  " * max(0, len(self.list_stack) - 1) + marker)
        elif tag == "table":
            self._block_break()
            self.table_rows = []
        elif tag == "tr":
            self.current_row = []
        elif tag in {"td", "th"}:
            self.current_cell = []

    def handle_endtag(self, tag: str) -> None:
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.heading_level = None
            self._block_break()
        elif tag == "p":
            self._block_break()
        elif tag in {"strong", "b"}:
            self.parts.append("**")
        elif tag in {"em", "i"}:
            self.parts.append("*")
        elif tag == "code" and not self.in_pre:
            self.parts.append("`")
        elif tag == "pre":
            self.in_pre = False
            self.parts.append("\n```\n\n")
        elif tag == "a":
            href = self.href_stack.pop() if self.href_stack else None
            self.parts.append(f"]({href})" if href else "]")
        elif tag in {"ul", "ol"}:
            if self.list_stack:
                self.list_stack.pop()
            self._block_break()
        elif tag == "li":
            self.parts.append("\n")
        elif tag in {"td", "th"} and self.current_cell is not None:
            if self.current_row is not None:
                self.current_row.append(clean_inline("".join(self.current_cell)))
            self.current_cell = None
        elif tag == "tr" and self.current_row is not None:
            self.table_rows.append(self.current_row)
            self.current_row = None
        elif tag == "table":
            self.parts.append(render_markdown_table(self.table_rows))
            self.parts.append("\n\n")
            self.table_rows = []

    def handle_data(self, data: str) -> None:
        if self.current_cell is not None:
            self.current_cell.append(data)
            return
        if self.in_pre:
            self.parts.append(data)
            return
        if data.strip():
            self.parts.append(re.sub(r"\s+", " ", data))

    def markdown(self) -> str:
        return normalize_markdown("".join(self.parts))

    def _block_break(self) -> None:
        current = "".join(self.parts)
        if not current.endswith("\n\n"):
            if current.endswith("\n"):
                self.parts.append("\n")
            elif current:
                self.parts.append("\n\n")


def clean_inline(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().replace("|", "\\|")


def normalize_markdown(value: str) -> str:
    lines = [line.rstrip() for line in value.replace("\r\n", "\n").split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def render_markdown_table(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    width = max(len(row) for row in rows)
    padded = [row + [""] * (width - len(row)) for row in rows]
    header = padded[0]
    separator = ["---"] * width
    body = padded[1:]
    rendered = ["| " + " | ".join(header) + " |", "| " + " | ".join(separator) + " |"]
    rendered.extend("| " + " | ".join(row) + " |" for row in body)
    return "\n".join(rendered)


class HeadingParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.headings: list[dict[str, Any]] = []
        self.current: dict[str, Any] | None = None
        self.text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            attrs_map = dict(attrs)
            self.current = {"level": int(tag[1]), "id": attrs_map.get("id")}
            self.text = []

    def handle_endtag(self, tag: str) -> None:
        if self.current and tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            title = clean_inline("".join(self.text))
            if title:
                self.current["title"] = title
                self.current["anchor"] = self.current["id"] or slugify(title)
                self.headings.append(self.current)
            self.current = None
            self.text = []

    def handle_data(self, data: str) -> None:
        if self.current is not None:
            self.text.append(data)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9 _.-]", "", value).strip().lower()
    return re.sub(r"[\s_]+", "-", slug)


def storage_to_markdown(storage_html: str) -> str:
    parser = MarkdownHTMLParser()
    parser.feed(storage_html)
    parser.close()
    return parser.markdown()


def extract_toc(storage_html: str) -> list[dict[str, Any]]:
    parser = HeadingParser()
    parser.feed(storage_html)
    parser.close()
    return parser.headings


def parse_confluence_url(page_url: str) -> dict[str, str | None]:
    parsed = urllib.parse.urlparse(page_url)
    if not parsed.scheme or not parsed.netloc:
        raise ConfluenceError("Expected an absolute Confluence page URL.")

    path = parsed.path.rstrip("/")
    query = urllib.parse.parse_qs(parsed.query)
    page_id = first(query.get("pageId") or query.get("pageId".lower()))

    patterns = [
        r"/pages/(\d+)(?:/|$)",
        r"/pageId/(\d+)(?:/|$)",
        r"/wiki/spaces/[^/]+/pages/(\d+)(?:/|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, path)
        if match:
            page_id = match.group(1)
            break

    display_match = re.search(r"/display/([^/]+)/([^/]+)$", path)
    space_key = None
    title = None
    if display_match:
        space_key = urllib.parse.unquote_plus(display_match.group(1))
        title = urllib.parse.unquote_plus(display_match.group(2))

    base_path = ""
    segments = [segment for segment in parsed.path.split("/") if segment]
    if "wiki" in segments:
        base_path = "/" + "/".join(segments[: segments.index("wiki") + 1])
    elif "confluence" in segments:
        base_path = "/" + "/".join(segments[: segments.index("confluence") + 1])

    return {
        "base_url": urllib.parse.urlunparse((parsed.scheme, parsed.netloc, base_path, "", "", "")),
        "page_id": page_id,
        "space_key": space_key,
        "title": title,
    }


def first(values: list[str] | None) -> str | None:
    if not values:
        return None
    return values[0]


def request_json(url: str, token: str, auth: str, email: str | None) -> dict[str, Any]:
    headers = {"Accept": "application/json"}
    if auth == "basic":
        if not email:
            raise ConfluenceError("--email is required when --auth basic is used.")
        raw = f"{email}:{token}".encode("utf-8")
        headers["Authorization"] = "Basic " + base64.b64encode(raw).decode("ascii")
    else:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise ConfluenceError(f"Confluence API returned HTTP {error.code}: {details}") from error
    except urllib.error.URLError as error:
        raise ConfluenceError(f"Could not reach Confluence API: {error.reason}") from error


def fetch_page(page_url: str, token: str, auth: str, email: str | None) -> dict[str, Any]:
    parsed = parse_confluence_url(page_url)
    base_url = parsed["base_url"]
    page_id = parsed["page_id"]

    if page_id:
        api_url = f"{base_url}/api/v2/pages/{page_id}?body-format=storage"
        try:
            page = request_json(api_url, token, auth, email)
            return normalize_v2_page(page, page_url)
        except ConfluenceError as error:
            if "/wiki" in base_url:
                raise error
            api_url = f"{base_url}/rest/api/content/{page_id}?expand=body.storage,version,space,metadata.labels"
            page = request_json(api_url, token, auth, email)
            return normalize_v1_page(page, page_url)

    if parsed["space_key"] and parsed["title"]:
        params = urllib.parse.urlencode(
            {
                "spaceKey": parsed["space_key"],
                "title": parsed["title"],
                "expand": "body.storage,version,space,metadata.labels",
            }
        )
        api_url = f"{base_url}/rest/api/content?{params}"
        page = request_json(api_url, token, auth, email)
        results = page.get("results") or []
        if not results:
            raise ConfluenceError("No Confluence page matched the /display/SPACE/Title URL.")
        return normalize_v1_page(results[0], page_url)

    raise ConfluenceError(
        "Could not find a page id in the URL. Use a URL with pageId=... or /pages/<id>/..."
    )


def normalize_v2_page(page: dict[str, Any], page_url: str) -> dict[str, Any]:
    storage = (((page.get("body") or {}).get("storage") or {}).get("value")) or ""
    if not storage:
        raise ConfluenceError("The Confluence response did not include storage body content.")

    metadata = {
        "id": page.get("id"),
        "title": page.get("title"),
        "status": page.get("status"),
        "space_id": page.get("spaceId"),
        "parent_id": page.get("parentId"),
        "author_id": page.get("authorId"),
        "owner_id": page.get("ownerId"),
        "created_at": page.get("createdAt"),
        "version": page.get("version"),
        "links": page.get("_links"),
        "source_url": page_url,
    }
    return build_export(metadata, storage)


def normalize_v1_page(page: dict[str, Any], page_url: str) -> dict[str, Any]:
    storage = (((page.get("body") or {}).get("storage") or {}).get("value")) or ""
    if not storage:
        raise ConfluenceError("The Confluence response did not include storage body content.")

    space = page.get("space") or {}
    metadata = {
        "id": page.get("id"),
        "type": page.get("type"),
        "title": page.get("title"),
        "status": page.get("status"),
        "space": {
            "id": space.get("id"),
            "key": space.get("key"),
            "name": space.get("name"),
        },
        "version": page.get("version"),
        "links": page.get("_links"),
        "source_url": page_url,
    }
    return build_export(metadata, storage)


def build_export(metadata: dict[str, Any], storage_html: str) -> dict[str, Any]:
    return {
        "metadata": remove_none(metadata),
        "table_of_contents": extract_toc(storage_html),
        "content_format": "markdown",
        "content": storage_to_markdown(storage_html),
    }


def remove_none(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: remove_none(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [remove_none(item) for item in value]
    return value


def to_yaml(value: Any, indent: int = 0) -> str:
    prefix = " " * indent
    if isinstance(value, dict):
        lines: list[str] = []
        for key, item in value.items():
            if isinstance(item, (dict, list)):
                lines.append(f"{prefix}{key}:")
                lines.append(to_yaml(item, indent + 2))
            else:
                lines.append(f"{prefix}{key}: {yaml_scalar(item)}")
        return "\n".join(lines)
    if isinstance(value, list):
        if not value:
            return f"{prefix}[]"
        lines = []
        for item in value:
            if isinstance(item, dict):
                lines.append(f"{prefix}-")
                lines.append(to_yaml(item, indent + 2))
            elif isinstance(item, list):
                lines.append(f"{prefix}-")
                lines.append(to_yaml(item, indent + 2))
            else:
                lines.append(f"{prefix}- {yaml_scalar(item)}")
        return "\n".join(lines)
    return f"{prefix}{yaml_scalar(value)}"


def yaml_scalar(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value)
    if "\n" in text:
        indented = "\n".join("  " + line for line in text.splitlines())
        return "|\n" + indented
    return json.dumps(text)


def format_markdown(export: dict[str, Any]) -> str:
    metadata = export["metadata"]
    toc = export["table_of_contents"]
    title = metadata.get("title") or "Confluence Page"

    lines = [f"# {title}", "", "## Metadata", ""]
    for key, value in metadata.items():
        if isinstance(value, (dict, list)):
            lines.append(f"- **{key}**: `{json.dumps(value, ensure_ascii=False)}`")
        else:
            lines.append(f"- **{key}**: {value}")

    lines.extend(["", "## Table of Contents", ""])
    if toc:
        for heading in toc:
            indent = "  " * max(0, int(heading["level"]) - 1)
            lines.append(f"{indent}- [{heading['title']}](#{heading['anchor']})")
    else:
        lines.append("_No headings found._")

    lines.extend(["", "## Content", "", export["content"].rstrip(), ""])
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export a Confluence page as Markdown, JSON, or YAML.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """\
            Examples:
              python3 scripts/confluence_page_export.py "$URL" "$TOKEN" --format markdown
              CONFLUENCE_TOKEN="$TOKEN" python3 scripts/confluence_page_export.py "$URL" --format json
              python3 scripts/confluence_page_export.py "$URL" "$TOKEN" --auth basic --email user@example.com
            """
        ),
    )
    parser.add_argument("url", help="Confluence page URL.")
    parser.add_argument("token", nargs="?", help="Confluence token. Defaults to CONFLUENCE_TOKEN.")
    parser.add_argument(
        "--format",
        choices=SUPPORTED_FORMATS,
        default="markdown",
        help="Output format. Defaults to markdown.",
    )
    parser.add_argument(
        "--auth",
        choices=("bearer", "basic"),
        default="bearer",
        help="Authentication mode. Defaults to bearer.",
    )
    parser.add_argument("--email", help="Email address for Atlassian API token basic auth.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = args.token or os.environ.get("CONFLUENCE_TOKEN")
    if not token:
        print("Missing token. Pass it as an argument or set CONFLUENCE_TOKEN.", file=sys.stderr)
        return 2

    try:
        export = fetch_page(args.url, token, args.auth, args.email)
        if args.format == "json":
            print(json.dumps(export, ensure_ascii=False, indent=2))
        elif args.format == "yaml":
            print(to_yaml(export))
        else:
            print(format_markdown(export))
        return 0
    except ConfluenceError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
