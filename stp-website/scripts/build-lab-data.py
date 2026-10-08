#!/usr/bin/env python3
"""
Builds the Laboratory page data from the lab team's files.

  python scripts/build-lab-data.py "<Lab Report ... .xlsx>" "<MMM-YY Lab Report.docx>" [more .docx ...]

Reads the monthly sheets of the Excel workbook (daily inlet/outlet readings) and the daily report pages of
each Word file (permissible limits, power consumption, sample photographs), then writes:

  data/lab/lab-data.json          everything the /dashboard/laboratory page shows
  data/lab/photos/<YYYY-MM>/<DD>-*.jpeg  photographs taken from the Word reports (served only to signed-in users)

Standard library only (no pip installs). Re-run it whenever the files are updated; re-running replaces the output.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / 'data' / 'lab' / 'lab-data.json'
# Photographs are NOT in public/: they carry GPS coordinates of the plant, so they are served by the signed-in-only
# route app/api/lab/photo/[month]/[file]/route.ts
OUT_IMG = ROOT / 'data' / 'lab' / 'photos'

# Excel header (group label, lower-cased) -> parameter key
GROUPS = {
    'flow details': 'flow', 'temperature': 'temp', 'tempereture': 'temp', 'ph': 'ph', 'bod': 'bod', 'cod': 'cod',
    't.s.s': 'tss', 'pho.': 'phos', 'alk.': 'alk', 't. alk.': 'alk', 'do': 'do', 'tn': 'tn', 'nh4-n': 'nh4',
    'oil & greese': 'oil', 'oil & grease': 'oil',
}
# Row order of the parameter table on each Word report page
DOCX_ROWS = ['flow', 'temp', 'ph', 'bod', 'cod', 'tss', 'phos', 'alk', 'do', 'tn', 'nh4', 'oil', 'coliform']

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def num(v):
    """Cell text -> float, or None for blanks / 'NIL' / '-' / '--'."""
    if v is None:
        return None
    v = str(v).strip()
    if v == '' or v.upper() in ('NIL', '-', '--', '—', 'N/A', 'NA') or v.startswith('#'):
        return None
    try:
        return round(float(v), 4)
    except ValueError:
        return None


# ── Excel ────────────────────────────────────────────────────────────────────

def read_workbook(path):
    z = zipfile.ZipFile(path)
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    for s in wb.find('m:sheets', NS):
        target = rels[s.get('{%s}id' % NS['r'])].lstrip('/')
        target = target if target.startswith('xl/') else 'xl/' + target
        root = ET.fromstring(z.read(target))
        rows = []
        for row in root.find('m:sheetData', NS).findall('m:row', NS):
            cells = {}
            for c in row.findall('m:c', NS):
                v = c.find('m:v', NS)
                if v is None:
                    continue
                cells[col_index(c.get('r'))] = shared[int(v.text)] if c.get('t') == 's' else v.text
            rows.append((int(row.get('r')), cells))
        yield s.get('name').strip(), rows


def parse_month_sheet(name, rows, warnings):
    """Returns a list of daily records, or None if the sheet is not a monthly lab sheet."""
    group_row = next((i for i, (_, c) in enumerate(rows) if any((v or '').strip().lower() == 'flow details' for v in c.values())), None)
    if group_row is None or group_row + 1 >= len(rows):
        return None
    groups = rows[group_row][1]
    sub = rows[group_row + 1][1]
    # column -> (param key, 'in'|'out'|'pumping'|'treated')
    layout = {}
    current = None
    for col in sorted(set(groups) | set(sub)):
        label = (groups.get(col) or '').strip().lower()
        s = (sub.get(col) or '').strip().lower()
        if label in GROUPS:
            current = GROUPS[label]
        elif label and label != 'date':
            if '°' in s:  # e.g. a mistyped "Temperature" header: the "(°c)" sub-header gives it away
                current = 'temp'
                warnings.append(f'{name}: column group "{groups[col].strip()}" read as Temperature')
            else:
                warnings.append(f'{name}: unknown column group "{groups[col]}"')
        if col == 0 or current is None:
            continue
        if current == 'flow':
            layout[col] = ('flow', 'pumping' if 'pump' in s else 'treated')
        else:
            layout[col] = (current, 'in' if s.startswith('inlet') else 'out')
    days = []
    for _, cells in rows[group_row + 2:]:
        a = cells.get(0)
        try:
            serial = float(a)
        except (TypeError, ValueError):
            continue  # Avg row, signatures, blanks
        d = date(1899, 12, 30) + timedelta(days=int(serial))
        rec = {'date': d.isoformat()}
        for col, (param, side) in layout.items():
            v = num(cells.get(col))
            if v is not None:
                rec.setdefault(param, {})[side] = v
        if len(rec) > 1:  # at least one reading besides the date
            days.append(rec)
    return days


# ── Word ─────────────────────────────────────────────────────────────────────

def limit_of(text):
    """'≤ 10' -> {'max': 10}; '5.5 – 9.0' -> {'min': 5.5, 'max': 9.0}; '—'/'MGD' -> None"""
    t = text.strip()
    m = re.match(r'^[≤<]=?\s*([\d.]+)$', t)
    if m:
        return {'max': float(m.group(1))}
    m = re.match(r'^([\d.]+)\s*[–-]\s*([\d.]+)$', t)
    if m:
        return {'min': float(m.group(1)), 'max': float(m.group(2))}
    return None


def read_docx(path, warnings):
    z = zipfile.ZipFile(path)
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
    body = ET.fromstring(z.read('word/document.xml')).find(W + 'body')

    def text(el):
        return ''.join(t.text or '' for t in el.iter(W + 't')).strip()

    def rows_of(tbl):
        return [[text(tc) for tc in tr.findall(W + 'tc')] for tr in tbl.findall(W + 'tr')]

    reports, current, limits = {}, None, {}
    for el in body:
        if el.tag == W + 'tbl':
            rows = rows_of(el)
            flat = ' '.join(c for r in rows for c in r)
            m = re.search(r'Date\s*(\d\d)\.(\d\d)\.(\d{4})', flat)
            if m:
                current = f'{m.group(3)}-{m.group(2)}-{m.group(1)}'
                reports[current] = {'date': current, 'photos': []}
            elif current and rows and rows[0][:1] == ['Parameter']:
                data = rows[1:]
                if len(data) != len(DOCX_ROWS):
                    warnings.append(f'{current}: parameter table has {len(data)} rows, expected {len(DOCX_ROWS)}')
                for key, r in zip(DOCX_ROWS, data):
                    if key not in limits and len(r) >= 2 and limit_of(r[1]):
                        limits[key] = limit_of(r[1])
                    reports[current].setdefault('lab', {})[key] = {'in': num(r[2]) if len(r) > 2 else None,
                                                                 'out': num(r[3]) if len(r) > 3 else None}
            elif current and any(r[:1] in (['Energy Meter'], ['Total Reading']) for r in rows):
                # The meter table and the total-reading table sit in one Word table; each header row is followed by its values
                power = reports[current].setdefault('power', {})
                for i, r in enumerate(rows[:-1]):
                    v = rows[i + 1]
                    if r[:1] == ['Energy Meter'] and len(v) >= 4:
                        power.update({'open': num(v[1]), 'close': num(v[2]), 'diff': num(v[3])})
                    elif r[:1] == ['Total Reading'] and len(v) >= 4:
                        power.update({'multiplier': num(v[1]), 'units': num(v[2]), 'pf': num(v[3])})
        if current:
            for blip in el.iter(A + 'blip'):
                reports[current]['photos'].append(rels[blip.get(R + 'embed')])
    return z, reports, limits


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    xlsx, docxs = sys.argv[1], sys.argv[2:]
    warnings = []

    months = {}
    for name, rows in read_workbook(xlsx):
        days = parse_month_sheet(name, rows, warnings)
        if not days:
            continue
        key = days[0]['date'][:7]
        if key in months:
            warnings.append(f'{name}: duplicate month {key}, keeping the first sheet')
            continue
        if any(d['date'][:7] != key for d in days):
            warnings.append(f'{name}: contains dates outside {key}')
        months[key] = {'key': key, 'sheet': name, 'days': days}

    reports, limits = {}, {}
    import shutil
    if OUT_IMG.exists():
        shutil.rmtree(OUT_IMG)
    for path in docxs:
        z, rep, lim = read_docx(path, warnings)
        limits.update(lim)
        for day, r in rep.items():
            photos = []
            media = r.pop('photos')
            # two photos per page = [inlet/outlet sample, OLMS analyser screen]; one photo = OLMS screen only
            kinds = ['olms'] if len(media) == 1 else ['sample', 'olms'] if len(media) == 2 else []
            if media and not kinds:
                warnings.append(f'{day}: {len(media)} photos, expected 1 or 2')
            folder = OUT_IMG / day[:7]
            folder.mkdir(parents=True, exist_ok=True)
            for kind, target in zip(kinds, media):
                name = f'{day[8:10]}-{kind}.jpeg'
                (folder / name).write_bytes(z.read('word/' + target))
                photos.append({'kind': kind, 'src': f'/api/lab/photo/{day[:7]}/{name}'})
            r['photos'] = photos
            reports[day] = r

    # Power readings: complete, and total units = difference x multiplication factor
    for day, r in reports.items():
        p = r.get('power', {})
        if any(p.get(k) is None for k in ('open', 'close', 'diff', 'multiplier', 'units', 'pf')):
            warnings.append(f'{day}: power reading incomplete {p}')
        elif abs(p['diff'] * p['multiplier'] - p['units']) > 0.5:
            warnings.append(f'{day}: power units {p["units"]} != diff {p["diff"]} x MF {p["multiplier"]}')
        elif abs((p['close'] - p['open']) - p['diff']) > 0.006:
            warnings.append(f'{day}: meter close - open = {p["close"] - p["open"]:.2f}, report says {p["diff"]}')

    # Cross-check Word reports against the Excel sheet for the same day
    for day, r in reports.items():
        xd = next((d for d in months.get(day[:7], {}).get('days', []) if d['date'] == day), None)
        if not xd:
            warnings.append(f'{day}: Word report has no matching Excel row')
            continue
        for key, vals in r.get('lab', {}).items():
            for side in ('in', 'out'):
                a = vals.get(side)
                b = xd.get(key, {}).get(side)
                if key in ('flow',):
                    b = xd.get('flow', {}).get('pumping' if side == 'in' else 'treated')
                if a is not None and b is not None and abs(a - b) > 0.005:
                    warnings.append(f'{day}: {key}/{side} differs - Word {a} vs Excel {b}')

    out = {
        'generatedAt': datetime.now().isoformat(timespec='seconds'),
        'source': {'xlsx': Path(xlsx).name, 'docx': [Path(p).name for p in docxs]},
        'limits': limits,
        'months': [months[k] for k in sorted(months)],
        'reports': dict(sorted(reports.items())),
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False), encoding='utf-8')

    n_days = sum(len(m['days']) for m in months.values())
    print(f'{len(months)} months, {n_days} days, {len(reports)} Word reports -> {OUT_JSON.relative_to(ROOT)}')
    print('limits:', limits)
    for w in warnings:
        print('WARN', w)


if __name__ == '__main__':
    main()
