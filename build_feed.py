#!/usr/bin/env python3
"""Build feed.xml (RSS 2.0) for The Weekly Snarry Prophet from the published Google Sheet.

Runs on GitHub Actions (see .github/workflows/site.yml). Uses only the Python standard library.
The CSV link is read from common.js, so it only ever needs changing in one place.
"""
import csv, datetime, html, io, re, sys, urllib.request
from zoneinfo import ZoneInfo
from email.utils import format_datetime
from xml.sax.saxutils import escape

SITE_URL = "https://snarryprophet.github.io/"
TITLE = "The Weekly Snarry Prophet"
DESCRIPTION = "A weekly roundup of everything Snape/Harry: new fics, WIP updates, art, meta, recs and fests."
MAX_ITEMS = 100


def csv_url():
    js = open("common.js", encoding="utf-8").read()
    m = re.search(r'CSV_URL:\s*"([^"]+)"', js)
    if not m:
        raise SystemExit("CSV_URL not found in common.js")
    return m.group(1)


def fetch_rows(url):
    req = urllib.request.Request(url, headers={"User-Agent": "snarryprophet-feed"})
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode("utf-8-sig")
    rows = []
    for raw in csv.DictReader(io.StringIO(text)):
        row = {(k or "").strip(): (v or "").strip() for k, v in raw.items()}
        if row.get("Title") and not row["Title"].upper().startswith("EXAMPLE"):
            rows.append(row)
    return rows


def parse_date(s):
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d. %m. %Y", "%m/%d/%Y"):
        try:
            d = datetime.datetime.strptime(s, fmt)
            return d.replace(hour=12, tzinfo=datetime.timezone.utc)
        except ValueError:
            pass
    return None


def safe(url):
    return url if re.match(r"^https?://", url or "", re.I) else ""


def item_xml(r):
    kind = r.get("Type", "")
    editorial = kind.lower() == "editorial"
    title = r["Title"]
    if editorial:
        title = "Editorial: " + title
    else:
        if r.get("Author / Artist"):
            title += " by " + r["Author / Artist"]
        if kind:
            title = "[" + kind + "] " + title
        if r.get("Chapters") and (kind == "WIP Update" or r.get("Status", "").lower().startswith(("wip", "series"))):
            title += " (Ch. " + r["Chapters"] + ")"

    week = r.get("Week", "")
    site_link = SITE_URL + ("#" + week if week else "")
    link = site_link if editorial else (safe(r.get("Link", "")) or site_link)

    facts = [r.get(k, "") for k in ("Rating", "Status", "Setting", "Platform")]
    if r.get("Words"):
        facts.append(r["Words"] + " words")
    w = r.get("Archive Warnings", "")
    if w and not w.lower().startswith("no archive warnings"):
        facts.append("Warnings: " + w)
    parts = []
    if not editorial and any(facts):
        parts.append("<p>" + html.escape(" · ".join(f for f in facts if f)) + "</p>")
    for para in (r.get("Notes") or "").splitlines():
        if para.strip():
            parts.append("<p>" + html.escape(para.strip()) + "</p>")
    if week:
        parts.append('<p><a href="' + html.escape(site_link) + '">See it in the Prophet</a></p>')

    date = parse_date(r.get("Added", ""))
    guid = "|".join([link, r.get("Added", ""), r.get("Chapters", ""), r.get("Status", "")])
    out = ["<item>",
           "<title>" + escape(title) + "</title>",
           "<link>" + escape(link) + "</link>",
           '<guid isPermaLink="false">' + escape(guid) + "</guid>",
           "<description>" + escape("".join(parts)) + "</description>"]
    if kind:
        out.append("<category>" + escape(kind) + "</category>")
    if date:
        out.append("<pubDate>" + format_datetime(date) + "</pubDate>")
    out.append("</item>")
    return "\n".join(out), date


def main():
    try:
        rows = fetch_rows(csv_url())
    except Exception as e:  # never break the site build because of the feed
        print("WARNING: could not build feed:", e)
        return 0

    today = datetime.datetime.now(ZoneInfo("Europe/Prague")).date().isoformat()
    rows = [r for r in rows if not (re.match(r"^\d{4}-\d{2}-\d{2}$", r.get("Week", "")) and r["Week"] > today)]
    built = [item_xml(r) for r in rows]
    epoch = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)
    built.sort(key=lambda x: x[1] or epoch, reverse=True)
    built = built[:MAX_ITEMS]
    newest = built[0][1] if built and built[0][1] else datetime.datetime.now(datetime.timezone.utc)

    feed = "\n".join([
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "<channel>",
        "<title>" + escape(TITLE) + "</title>",
        "<link>" + SITE_URL + "</link>",
        "<description>" + escape(DESCRIPTION) + "</description>",
        "<language>en</language>",
        '<atom:link href="' + SITE_URL + 'feed.xml" rel="self" type="application/rss+xml"/>',
        "<lastBuildDate>" + format_datetime(newest) + "</lastBuildDate>",
        *[b[0] for b in built],
        "</channel>",
        "</rss>",
        "",
    ])
    open("feed.xml", "w", encoding="utf-8").write(feed)
    print("feed.xml written with", len(built), "items")
    return 0


if __name__ == "__main__":
    sys.exit(main())
