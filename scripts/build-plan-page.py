#!/usr/bin/env python3
"""Build a standalone HTML page from docs/ai-pipeline-plan.md for publishing as an artifact.

Usage: python3 scripts/build-plan-page.py [input.md] [output.html]
Supports the Markdown subset used in the plan: #/##/### headings, paragraphs,
one-level nested lists, pipe tables, fenced code, inline code, **bold**, links, bare URLs.
"""
import re, html, pathlib, sys

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/ai-pipeline-plan.md')
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'ai-pipeline-plan.html')
lines = SRC.read_text(encoding='utf-8').split('\n')

def inline(text):
    codes = []
    def code_repl(m):
        codes.append('<code>' + html.escape(m.group(1), quote=False) + '</code>')
        return '\x00%d\x00' % (len(codes) - 1)
    text = re.sub(r'`([^`]+)`', code_repl, text)
    text = html.escape(text, quote=False)
    text = re.sub(r'\[([^\]]+)\]\((https?://[^)\s]+)\)', r'<a href="\2">\1</a>', text)
    def url_repl(m):
        url = m.group(0); trail = ''
        while url and url[-1] in '.,;:)»':
            trail = url[-1] + trail; url = url[:-1]
        return '<a href="%s">%s</a>%s' % (url, url, trail)
    text = re.sub(r'(?<![">])https?://[^\s<]+', url_repl, text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return re.sub('\x00(\\d+)\x00', lambda m: codes[int(m.group(1))], text)

def render_list(items):
    top = 'ol' if items[0][1][0].isdigit() else 'ul'
    parts = ['<%s>' % top]; open_li = False; sub = []
    def flush_sub():
        nonlocal sub
        if sub:
            t = 'ol' if sub[0][0][0].isdigit() else 'ul'
            parts.append('<%s>%s</%s>' % (t, ''.join('<li>%s</li>' % inline(x[1]) for x in sub), t)); sub = []
    for indent, marker, text in items:
        if indent == 0:
            flush_sub()
            if open_li: parts.append('</li>')
            parts.append('<li>%s' % inline(text)); open_li = True
        else:
            sub.append((marker, text))
    flush_sub()
    if open_li: parts.append('</li>')
    parts.append('</%s>' % top)
    return ''.join(parts)

body, toc, lead, para = [], [], [], []
title = ''; i = 0; n = len(lines); h2c = h3c = 0; seen_h2 = False; warnings = []
def flush_para():
    global para
    if para:
        (body if seen_h2 else lead).append('<p>%s</p>' % inline(' '.join(para))); para = []
while i < n:
    ln = lines[i]
    if ln.startswith('```'):
        flush_para(); lang = ln[3:].strip(); i += 1; buf = []
        while i < n and not lines[i].startswith('```'): buf.append(lines[i]); i += 1
        i += 1
        body.append('<pre class="code" data-lang="%s"><code>%s</code></pre>' % (html.escape(lang), html.escape('\n'.join(buf), quote=False))); continue
    if ln.strip() == '---':
        flush_para(); i += 1; continue
    m = re.match(r'^(#{1,3}) (.*)', ln)
    if m:
        flush_para(); level = len(m.group(1)); text = m.group(2)
        if level == 1: title = text
        elif level == 2:
            seen_h2 = True; h2c += 1; h3c = 0; hid = 's%d' % h2c; toc.append((2, hid, text))
            body.append('<h2 id="%s">%s</h2>' % (hid, inline(text)))
        else:
            h3c += 1; hid = 's%d-%d' % (h2c, h3c); toc.append((3, hid, text))
            body.append('<h3 id="%s">%s</h3>' % (hid, inline(text)))
        i += 1; continue
    if ln.startswith('|'):
        flush_para(); rows = []
        while i < n and lines[i].startswith('|'): rows.append(lines[i]); i += 1
        cells = lambda r: [c.strip() for c in r.strip().strip('|').split('|')]
        head = cells(rows[0]); rows_b = [cells(r) for r in rows[2:]]
        for r in rows_b:
            if len(r) != len(head): warnings.append('table cell mismatch near: %s' % r[:1])
        thead = '<tr>%s</tr>' % ''.join('<th>%s</th>' % inline(c) for c in head)
        tbody = ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % inline(c) for c in r) for r in rows_b)
        body.append('<div class="table-wrap"><table><thead>%s</thead><tbody>%s</tbody></table></div>' % (thead, tbody)); continue
    if re.match(r'^(\s*)([-*]|\d+\.) ', ln):
        flush_para(); items = []
        while i < n:
            m2 = re.match(r'^(\s*)([-*]|\d+\.) (.*)', lines[i])
            if not m2: break
            items.append((len(m2.group(1)), m2.group(2), m2.group(3))); i += 1
        body.append(render_list(items)); continue
    if ln.strip() == '':
        flush_para(); i += 1; continue
    para.append(ln.strip()); i += 1
flush_para()

toc_html = ['<ol class="toc-list">']; open_h2 = False
for level, hid, text in toc:
    if level == 2:
        if open_h2: toc_html.append('</ol></li>')
        toc_html.append('<li class="t2"><a href="#%s">%s</a><ol>' % (hid, inline(text))); open_h2 = True
    else:
        toc_html.append('<li class="t3"><a href="#%s">%s</a></li>' % (hid, inline(re.sub(r'^\d+\.\d+ ', '', text))))
if open_h2: toc_html.append('</ol></li>')
toc_html.append('</ol>')
TOC = ''.join(toc_html)

CSS = """
:root{--bg:#F4F6F9;--surface:#FFFFFF;--ink:#18212F;--ink-2:#3B4859;--muted:#68778C;--line:#D8DFE8;--line-2:#E9EEF4;--accent:#0A5DC2;--accent-ink:#0B4A98;--accent-soft:#E4EEFA;--code-bg:#EEF2F7;--code-ink:#1E2A3A;--th-bg:#F0F3F8;--shadow:0 1px 2px rgba(20,32,50,.06);--amber:#8A5200}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0E131A;--surface:#141B25;--ink:#E4E9F1;--ink-2:#C2CBD8;--muted:#8B99AD;--line:#26303D;--line-2:#1D2631;--accent:#7EB3FF;--accent-ink:#A9CCFF;--accent-soft:#17263D;--code-bg:#0B1017;--code-ink:#D8E0EA;--th-bg:#18212C;--shadow:0 1px 2px rgba(0,0,0,.4);--amber:#E3AA55}}
:root[data-theme="dark"]{--bg:#0E131A;--surface:#141B25;--ink:#E4E9F1;--ink-2:#C2CBD8;--muted:#8B99AD;--line:#26303D;--line-2:#1D2631;--accent:#7EB3FF;--accent-ink:#A9CCFF;--accent-soft:#17263D;--code-bg:#0B1017;--code-ink:#D8E0EA;--th-bg:#18212C;--shadow:0 1px 2px rgba(0,0,0,.4);--amber:#E3AA55}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--ink);font:16.5px/1.6 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none;border-bottom:1px solid transparent}
a:hover,a:focus-visible{border-bottom-color:currentColor}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
code,pre{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.page{max-width:1240px;margin:0 auto;padding:40px 28px 96px;display:grid;grid-template-columns:250px minmax(0,1fr);gap:56px;align-items:start}
@media (max-width:959px){.page{grid-template-columns:minmax(0,1fr);gap:24px;padding:24px 18px 72px}}
.hdr{grid-column:1/-1;border-bottom:1px solid var(--line);padding-bottom:28px;margin-bottom:8px}
.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 14px}
.eyebrow b{color:var(--accent);font-weight:500}
h1{font-family:"Manrope","IBM Plex Sans",system-ui,sans-serif;font-weight:800;font-size:clamp(1.9rem,3.4vw,2.7rem);line-height:1.12;letter-spacing:-.015em;margin:0 0 18px;max-width:22ch;text-wrap:balance}
.lead{max-width:72ch;color:var(--ink-2);font-size:1.06rem}
.lead p{margin:0 0 12px}
.lead p:last-child{margin-bottom:0}
.meta{display:flex;flex-wrap:wrap;gap:10px 32px;margin:22px 0 0;padding-top:18px;border-top:1px solid var(--line-2)}
.meta div{display:flex;flex-direction:column;gap:2px}
.meta dt{font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.meta dd{margin:0;font-size:.95rem;color:var(--ink)}
.meta dd code{font-size:.86em}
.side{position:sticky;top:24px;max-height:calc(100vh - 48px);overflow:auto;font-size:.86rem;line-height:1.4;padding-right:6px}
@media (max-width:959px){.side{position:static;max-height:none;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:4px 14px}}
.side summary{cursor:pointer;font-family:"Manrope",sans-serif;font-weight:700;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:8px 0;list-style:none}
.side summary::-webkit-details-marker{display:none}
@media (min-width:960px){.side summary{pointer-events:none}}
.toc-list,.toc-list ol{list-style:none;margin:0;padding:0}
.toc-list>li{margin:0 0 6px}
.toc-list a{display:block;color:var(--ink-2);padding:4px 10px;border-left:2px solid var(--line-2);border-bottom:0;border-radius:0}
.toc-list .t2>a{font-weight:600;color:var(--ink)}
.toc-list .t3>a{padding-left:20px;color:var(--muted);font-size:.83rem}
.toc-list a:hover{color:var(--accent);border-left-color:var(--line)}
.toc-list a.active{color:var(--accent);border-left-color:var(--accent);background:var(--accent-soft)}
.main{min-width:0}
.main h2{font-family:"Manrope","IBM Plex Sans",sans-serif;font-weight:800;font-size:1.55rem;line-height:1.2;letter-spacing:-.01em;margin:56px 0 18px;padding-top:28px;border-top:1px solid var(--line);text-wrap:balance;scroll-margin-top:20px}
.main h2:first-child{margin-top:8px;border-top:0;padding-top:0}
.main h3{font-family:"Manrope","IBM Plex Sans",sans-serif;font-weight:700;font-size:1.13rem;line-height:1.3;margin:34px 0 10px;text-wrap:balance;scroll-margin-top:20px}
.main p,.main ul,.main ol{max-width:74ch}
.main p{margin:0 0 14px}
.main ul,.main ol{margin:0 0 16px;padding-left:1.35em}
.main li{margin:0 0 6px}
.main li>ul,.main li>ol{margin:6px 0 4px}
.main strong{font-weight:600;color:var(--ink)}
.main code{background:var(--code-bg);color:var(--code-ink);font-size:.86em;padding:.12em .38em;border-radius:4px;border:1px solid var(--line-2)}
.main pre.code{position:relative;background:var(--code-bg);color:var(--code-ink);border:1px solid var(--line-2);border-radius:6px;padding:16px 18px;overflow-x:auto;font-size:.84rem;line-height:1.5;margin:0 0 20px;max-width:100%}
.main pre.code code{background:none;border:0;padding:0;font-size:inherit;color:inherit}
.main pre.code[data-lang]:not([data-lang=""])::after{content:attr(data-lang);position:absolute;top:8px;right:12px;font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.table-wrap{overflow-x:auto;margin:6px 0 24px;border:1px solid var(--line);border-radius:6px;background:var(--surface);box-shadow:var(--shadow)}
table{border-collapse:collapse;width:100%;font-size:.9rem;line-height:1.45}
th,td{text-align:left;vertical-align:top;padding:10px 14px;border-bottom:1px solid var(--line-2)}
th{background:var(--th-bg);font-family:"Manrope",sans-serif;font-weight:700;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
td:first-child{font-weight:500;color:var(--ink)}
td code{white-space:nowrap}
.foot{grid-column:1/-1;margin-top:48px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
"""
JS = """(function(){var d=document.getElementById('toc');try{if(d&&window.matchMedia('(max-width: 959px)').matches)d.open=false;}catch(e){}
var links={};document.querySelectorAll('.toc-list a').forEach(function(a){links[a.getAttribute('href').slice(1)]=a;});
var heads=Array.prototype.slice.call(document.querySelectorAll('.main h2, .main h3'));var current=null;
function setActive(id){if(current===id)return;if(current&&links[current])links[current].classList.remove('active');current=id;if(links[id])links[id].classList.add('active');}
function update(){var y=window.scrollY+120,best=null;for(var i=0;i<heads.length;i++){if(heads[i].offsetTop<=y)best=heads[i];}if(best)setActive(best.id);}
window.addEventListener('scroll',update,{passive:true});update();})();"""

HEAD = ('<title>Агентный конвейер Test_CAP</title>\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@700;800&display=swap">\n'
        '<style>%s</style>' % CSS)
META = ('<dl class="meta">'
        '<div><dt>Статус</dt><dd>План принят 2026-09-07, идёт реализация</dd></div>'
        '<div><dt>Источник в репозитории</dt><dd><code>docs/ai-pipeline-plan.md</code></dd></div>'
        '<div><dt>Проверено</dt><dd>npm registry, GitHub API, первоисточники, 2026-09-06</dd></div>'
        '<div><dt>Текущий этап</dt><dd>Этап 0: окружение, Node 22, cds 10</dd></div>'
        '</dl>')
page = HEAD + '''
<div class="page">
  <header class="hdr">
    <p class="eyebrow"><b>Test_CAP</b> · план · исследование 2026-09-06</p>
    <h1>%s</h1>
    <div class="lead">%s</div>
    %s
  </header>
  <aside class="side"><details id="toc" open><summary>Содержание</summary><nav aria-label="Содержание">%s</nav></details></aside>
  <main class="main">%s</main>
  <footer class="foot">Документ подготовлен в Claude Code для репозитория Test_CAP. Версии пакетов и ссылки актуальны на 2026-09-06; перед использованием сверяйте с реестром npm.</footer>
</div>
<script>%s</script>
''' % (inline(title), ''.join(lead), META, TOC, '\n'.join(body), JS)
OUT.write_text(page, encoding='utf-8')
print('written %s (%d bytes); sections: %d; toc: %d; warnings: %s' % (OUT, len(page), h2c, len(toc), warnings or 'none'))
