#!/usr/bin/env python3
"""
Cuts the two download templates out of the lab team's own files, so the downloads keep their exact look
(fonts, colours, merged headers, logos, photo frames, page setup):

  python scripts/build-lab-templates.py "<Lab Report ... .xlsx>" "<MMM-YY Lab Report.docx>"

Writes (commit these; the website fills them with data at download time):
  templates/lab/month-sheet-template.xlsx    one month sheet (the Sep-26 layout) with its styles and both logos
  templates/lab/daily-report-template.docx   one daily report page (a day that has both photos), no media

Run again only if the lab team changes the layout of their files. Standard library only.
"""
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'templates' / 'lab'

SHEET_PREFERENCE = ('SEP-26', 'AUG-26', 'JULY-26')  # a full 30/31-day month with every column, in the current layout
TEMPLATE_DAY = '15.09.2026'  # a page that has both photographs (sample + OLMS)


def rels_of(z, path):
    d, f = path.rsplit('/', 1)
    name = f'{d}/_rels/{f}.rels'
    return dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', z.read(name).decode('utf-8'))) if name in z.namelist() else {}


def norm(base, target):
    parts = (base.rsplit('/', 1)[0] + '/' + target).split('/') if not target.startswith('/') else target.lstrip('/').split('/')
    out = []
    for p in parts:
        if p == '..':
            out.pop()
        elif p != '.':
            out.append(p)
    return '/'.join(out)


def build_xlsx(src, dst):
    z = zipfile.ZipFile(src)
    wb = z.read('xl/workbook.xml').decode('utf-8')
    wb_rels = {m[0]: m[1] for m in re.findall(r'<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"', z.read('xl/_rels/workbook.xml.rels').decode('utf-8'))}
    # attribute order differs between files, so parse both orders
    for m in re.finditer(r'<Relationship [^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"', z.read('xl/_rels/workbook.xml.rels').decode('utf-8')):
        wb_rels.setdefault(m.group(2), m.group(1))
    sheets = {m.group(1).strip(): wb_rels[m.group(2)] for m in re.finditer(r'<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"', wb)}
    pick = next((s for s in SHEET_PREFERENCE if s in sheets), None)
    if not pick:
        sys.exit(f'None of {SHEET_PREFERENCE} found in the workbook (sheets: {list(sheets)})')
    sheet_path = norm('xl/workbook.xml', sheets[pick])
    sheet = z.read(sheet_path).decode('utf-8')
    sheet = re.sub(r'(<pageSetup [^>]*?) r:id="[^"]+"', r'\1', sheet)  # drop the printer-settings link

    srels = rels_of(z, sheet_path)
    draw_rid = re.search(r'<drawing r:id="([^"]+)"', sheet).group(1)
    draw_path = norm(sheet_path, srels[draw_rid])
    sheet = re.sub(r'<drawing r:id="[^"]+"', '<drawing r:id="rId1"', sheet)
    drels = rels_of(z, draw_path)
    media = {rid: norm(draw_path, t) for rid, t in drels.items()}

    NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
    REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    files = {
        '[Content_Types].xml': (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
            '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
            '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
            '</Types>').encode(),
        '_rels/.rels': (
            f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="{NS}">'
            f'<Relationship Id="rId1" Type="{REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>').encode(),
        # {{SHEET_NAME}} is replaced when the file is generated
        'xl/workbook.xml': (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="{REL}">'
            '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="12000"/></bookViews>'
            '<sheets><sheet name="{{SHEET_NAME}}" sheetId="1" r:id="rId1"/></sheets>'
            '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>').encode(),
        'xl/_rels/workbook.xml.rels': (
            f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="{NS}">'
            f'<Relationship Id="rId1" Type="{REL}/worksheet" Target="worksheets/sheet1.xml"/>'
            f'<Relationship Id="rId2" Type="{REL}/styles" Target="styles.xml"/>'
            f'<Relationship Id="rId3" Type="{REL}/theme" Target="theme/theme1.xml"/>'
            f'<Relationship Id="rId4" Type="{REL}/sharedStrings" Target="sharedStrings.xml"/></Relationships>').encode(),
        'xl/worksheets/sheet1.xml': sheet.encode('utf-8'),
        'xl/worksheets/_rels/sheet1.xml.rels': (
            f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="{NS}">'
            f'<Relationship Id="rId1" Type="{REL}/drawing" Target="../drawings/drawing1.xml"/></Relationships>').encode(),
        'xl/drawings/drawing1.xml': z.read(draw_path),
        'xl/drawings/_rels/drawing1.xml.rels': (
            f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="{NS}">'
            + ''.join(f'<Relationship Id="{rid}" Type="{REL}/image" Target="../media/{Path(p).name}"/>' for rid, p in media.items())
            + '</Relationships>').encode(),
        'xl/styles.xml': z.read('xl/styles.xml'),
        'xl/theme/theme1.xml': z.read('xl/theme/theme1.xml'),
        'xl/sharedStrings.xml': z.read('xl/sharedStrings.xml'),
    }
    for p in media.values():
        files[f'xl/media/{Path(p).name}'] = z.read(p)
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as out:
        for name, data in files.items():
            out.writestr(name, data)
    print(f'{dst.name}: sheet {pick} ({sheet_path}), {len(media)} logos, {dst.stat().st_size // 1024} KB')


def build_docx(src, dst):
    z = zipfile.ZipFile(src)
    doc = z.read('word/document.xml').decode('utf-8')
    marks = [m.start() for m in re.finditer('Daily Laboratory Analysis Report', doc)]
    starts = [doc.rfind('<w:tbl>', 0, m) for m in marks]
    sect = doc.rindex('<w:sectPr')
    blocks = [doc[s:(starts[i + 1] if i + 1 < len(starts) else sect)] for i, s in enumerate(starts)]
    block = next((b for b in blocks if TEMPLATE_DAY in b), None)
    if not block:
        sys.exit(f'No page for {TEMPLATE_DAY} in the Word file')
    assert block.count('pic:pic') >= 4 or block.count('<pic:pic') == 2, 'template page should have two photographs'
    body = doc.index('<w:body>') + len('<w:body>')
    new_doc = doc[:body] + block + doc[sect:]

    rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
    rels = re.sub(r'<Relationship [^>]*?relationships/image"[^>]*?/>', '', rels)
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as out:
        out.writestr('[Content_Types].xml', z.read('[Content_Types].xml'))
        for item in z.infolist():
            n = item.filename
            if n == '[Content_Types].xml' or n.startswith('word/media/'):
                continue
            data = z.read(n)
            if n == 'word/document.xml':
                data = new_doc.encode('utf-8')
            elif n == 'word/_rels/document.xml.rels':
                data = rels.encode('utf-8')
            out.writestr(n, data)
    print(f'{dst.name}: page {TEMPLATE_DAY}, {len(block) // 1024} KB of page XML, {dst.stat().st_size // 1024} KB')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    OUT.mkdir(parents=True, exist_ok=True)
    build_xlsx(sys.argv[1], OUT / 'month-sheet-template.xlsx')
    build_docx(sys.argv[2], OUT / 'daily-report-template.docx')
