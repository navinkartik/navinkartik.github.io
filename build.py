#!/usr/bin/env python3
"""
Build script for Navin Kartik's academic website.

Usage: python build.py

This script reads papers.yaml and coauthors.yaml, then generates:
- index.html (main page)
- published.html (mobile-only published papers)
- unpublished.html (mobile-only unpublished papers)
"""

import yaml
from datetime import datetime

# =============================================================================
# CONFIGURATION
# =============================================================================

FOOTER_DATE = "December 2025"  # Update this when making changes

# PhD students on job market (update as needed)
PHD_STUDENTS_ON_MARKET = [
    {"name": "Tianhao Liu", "url": "https://sites.google.com/view/tianhaoliuecon"},
    {"name": "Yangfan Zhou", "url": "https://sites.google.com/view/yangfanzhou/"},
]

# =============================================================================
# LOAD DATA
# =============================================================================

def load_yaml(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def load_data():
    papers = load_yaml('papers.yaml')
    coauthors = load_yaml('coauthors.yaml')
    return papers, coauthors

# =============================================================================
# HTML GENERATION HELPERS
# =============================================================================

def format_coauthors(coauthor_names, coauthors_dict, on_next_line=False):
    """Format coauthors with links."""
    if not coauthor_names:
        return ""

    parts = []
    for i, name in enumerate(coauthor_names):
        url = coauthors_dict.get(name, "")
        if url:
            parts.append(f'<a class="coauthor" href="{url}">{name}</a>')
        else:
            parts.append(name)

    # Join with commas and "and"
    if len(parts) == 1:
        coauth_str = parts[0]
    elif len(parts) == 2:
        coauth_str = f"{parts[0]} and {parts[1]}"
    else:
        coauth_str = ", ".join(parts[:-1]) + ", and " + parts[-1]

    if on_next_line:
        return f'<div class="coauthor-next-line">\n      with {coauth_str}\n    </div>'
    else:
        return f", with {coauth_str}"

def render_unpublished_paper(paper, coauthors_dict):
    """Render a single unpublished paper."""
    title = paper['title']
    pdf = paper.get('pdf', '')
    date = paper.get('date', '')
    slides = paper.get('slides', '')
    links = paper.get('links', [])
    notes = paper.get('notes', '')
    coauth_names = paper.get('coauthors', [])
    coauth_on_next_line = paper.get('coauthors_on_next_line', False)

    html = '  <li>'

    # Title with PDF link
    if pdf:
        html += f'<a class="papertitle" href="{pdf}">{title}</a>'
    else:
        html += title

    # Coauthors (inline) and date
    if coauth_names and not coauth_on_next_line:
        html += format_coauthors(coauth_names, coauthors_dict, False)

    if date:
        html += f', {date}'

    # Slides/links inline
    inline_links = []
    if slides:
        inline_links.append(f'<a href="{slides}">Slides</a>')
    for link in links:
        inline_links.append(f'<a class="slidestitle" href="{link["url"]}">{link["label"]}</a>')

    if inline_links:
        html += f' <span class="paper-links-inline">{" ".join(inline_links)}</span>'

    # Coauthors on next line
    if coauth_names and coauth_on_next_line:
        html += '\n    ' + format_coauthors(coauth_names, coauthors_dict, True)

    # Notes
    if notes:
        html += f'\n    <div class="paper-notes">\n      <span>\n        {notes.strip()}'
        html += '\n      </span>\n    </div>'

    html += '</li>'
    return html

def render_published_paper(paper, coauthors_dict):
    """Render a single published paper."""
    title = paper['title']
    pdf = paper.get('pdf', '')
    journal = paper.get('journal', '')
    journal_url = paper.get('journal_url', '')
    pub_date = paper.get('pub_date', '')
    slides = paper.get('slides', '')
    links = paper.get('links', [])
    notes = paper.get('notes', '')
    coauth_names = paper.get('coauthors', [])
    coauth_on_next_line = paper.get('coauthors_on_next_line', False)
    notes_inside_journal_div = paper.get('notes_inside_journal_div', False)
    notes_in_div = paper.get('notes_in_div', False)

    html = '  <li>'

    # Title with PDF link
    if pdf:
        html += f'<a class="papertitle" href="{pdf}">{title}</a>'
    else:
        html += title

    # Coauthors (inline)
    if coauth_names and not coauth_on_next_line:
        html += format_coauthors(coauth_names, coauthors_dict, False)

    # Coauthors on next line
    if coauth_names and coauth_on_next_line:
        html += '\n    ' + format_coauthors(coauth_names, coauthors_dict, True)

    # Journal and links
    html += '\n    <div class="journal-and-links">'
    if journal:
        html += f'\n      <a class="journal" href="{journal_url}"><i>{journal}</i></a>, {pub_date}'

    # Slides and other links
    inline_links = []
    if slides:
        inline_links.append(f'<a href="{slides}">Slides</a>')
    for link in links:
        inline_links.append(f'<a href="{link["url"]}">{link["label"]}</a>')

    if inline_links:
        html += f'\n      <span class="paper-links-inline" style="margin-left: 1rem;">\n        {" ".join(inline_links)}\n      </span>'

    # Notes inside journal div
    if notes and notes_inside_journal_div:
        html += f'\n      <div class="paper-notes">\n        {notes.strip()}\n      </div>'

    html += '\n    </div>'

    # Notes outside journal div
    if notes and not notes_inside_journal_div:
        if notes_in_div:
            html += f'\n    <div class="paper-notes">\n      <div>\n        {notes.strip()}\n      </div>\n    </div>'
        else:
            html += f'\n    <div class="paper-notes">\n      <span>\n        {notes.strip()}\n      </span>\n    </div>'

    html += '\n  </li>'
    return html

# =============================================================================
# PAGE TEMPLATES
# =============================================================================

INDEX_HEADER = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Navin Kartik</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="mystyles.css" type="text/css">
  <link rel="shortcut icon" href="Images/favicon.png" type="image/x-icon">

  <style>
  @media (max-width: 700px) {
    table, td {
      display: block;
      width: 100% !important;
    }
    .header-row {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .header-left, .header-right {
      width: 100% !important;
      text-align: center;
    }
    .header-right img {
      margin-top: 15px;
      height: auto;
      max-height: 240px;
      width: auto;
    }
    .footer {
      text-align: center;
      font-size: 10pt;
    }
  }

  body {
            font-family: 'Georgia', serif;
            line-height: 1.6;
            color: #333;
            background-color: #fafafa;
        }
  </style>
</head>

<body>
<center>
<table border="0" cellpadding="5" cellspacing="0" width="1000">
  <tr>
    <td>
      <table border="0" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Left: Name, title, logo, contact -->
          <td style="padding-right: 30px;">
<div style="line-height: 1.5; margin-top: 0;">
  <span class="name-header">
    Navin Kartik
  </span><br>
<span class="title-header">
  Professor of
  <a class="yalelink" href="https://economics.yale.edu">Economics</a><span class="omit-on-mobile">,</span>
  <a class="yalelink yale-univ-link" href="https://www.yale.edu">Yale&nbsp;University</a>
</span>
<br>
</div>
<p style="padding-top: 0px;">
<span class="omit-on-mobile">Email&nbsp;&nbsp;&nbsp;&nbsp;:</span>
<span class="email-addr">
<script language=javascript>          document.write( unescape('%3C%61%20%68%72%65%66%3D%22%6D%61%69%6C%74%6F%3A%6E%6B%61%72%74%69%6B%40%67%6D%61%69%6C%2E%63%6F%6D%22%3E%6E%6B%61%72%74%69%6B%40%67%6D%61%69%6C%2E%63%6F%6D%3C%2F%61%3E%0A%0A'));
</script>
</span>
<div class="address-block">
				        Phone&nbsp;&nbsp; : (+1) 203-432-3521
					<p>
				        Address: Yale Economics Department, P.O. Box 208268, New Haven, CT 06520-8268 (USA)</p>
</div>
				      <br>
	<!-- Mobile-only photo -->
	<img src="Images/nk_head_current.jpg" alt="Navin Kartik photo" class="headshot mobile-pic">


      <!-- Navigation Links -->
	<div class="nav-links">
	  <a href="bio.html">Bio</a>
	  <a href="CV/cv.pdf">Curriculum Vitae</a>
          <a href="unpublished.html" class="nav-only-mobile">Unpublished Papers</a>
          <a href="published.html" class="nav-only-mobile">Published Papers</a>
          <a href="teaching.html" class="nav-only-mobile">Teaching</a>
	  <a href="https://scholar.google.com/citations?user=jG0PhDwAAAAJ&hl=en">Google Scholar</a>
	  <a href="students.html">Students</a>
	  <a href="https://www.aeaweb.org/journals/mic">AEJ Micro</a>
	</div>

				  </td>

          <!-- Non-mobile photo -->
          <td valign="top">
            <img src="Images/nk_head_current.jpg" alt="Navin Kartik photo"  class="headshot desktop-pic">
          </td>
        </tr>
      </table>

'''

INDEX_FOOTER = '''


<span class="omit-on-mobile">
						<h2>Teaching</h2>
							<ul>
							<!-- <li> Spring 2025: Microeconomic Analysis II (GR6212); course materials are available at <a href="http://courseworks.columbia.edu">Courseworks</a>. -->
							<li> Spring 2026: Will be added.

							</ul>
</span>


    </td>
  </tr>
</table>
</center>

<p class="footer">{footer_date}</p>


<script>
  if (window.innerWidth <= 700) {{
    document.addEventListener("DOMContentLoaded", () => {{
      document.querySelectorAll("h2.papers-header, h2.teaching, ul.papers, ol.papers").forEach(el => el.style.display = "none");
    }});
  }}
</script>

</body>
</html>
'''

MOBILE_PAGE_HEADER = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta content="text/html; charset=utf-8" http-equiv="Content-Type"/>
<title>{title} - Navin Kartik</title>
<link href="mystyles.css" rel="stylesheet" type="text/css"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link href="Images/favicon.png" rel="shortcut icon" type="image/x-icon"/>
<style>
  @media (max-width: 700px) {{
    table, td {{
      display: block;
      width: 100% !important;
    }}
    .header-row {{
      display: flex;
      flex-direction: column;
      align-items: center;
    }}
    .header-left, .header-right {{
      width: 100% !important;
      text-align: center;
    }}
    .header-right img {{
      margin-top: 15px;
      height: auto;
      max-height: 240px;
      width: auto;
    }}
    .footer {{
      text-align: center;
      font-size: 10pt;
      margin-top: 40px;
    }}
  }}

        body {{
            font-family: 'Georgia', serif;
            line-height: 1.6;
            color: #333;
            background-color: #fafafa;
        }}

</style>
</head>
<body>


  <div class="nav-links" style="text-align: center; margin-top: 1em;">
    <a href="index.html" style="font-size: 1.2em;">Home</a>
  </div>

<center>
  <span class="name-header">
    Navin Kartik
  </span>
<h1>{heading}</h1>
</center>

'''

MOBILE_PAGE_FOOTER = '''
<p class="footer">{footer_date}</p>
</body>
</html>
'''

# =============================================================================
# BUILD FUNCTIONS
# =============================================================================

def build_index(papers, coauthors):
    """Build index.html."""
    unpublished = [p for p in papers if p['status'] == 'unpublished']
    published = [p for p in papers if p['status'] == 'published']

    html = INDEX_HEADER

    # PhD students on job market (only show if there are students)
    if PHD_STUDENTS_ON_MARKET:
        html += '\n\n\t\t\t\t\t\t<h2>PhD Students on the job market</h2>\n'
        html += '\t\t\t\t\t\t<ul class="Papers">\n'
        for student in PHD_STUDENTS_ON_MARKET:
            html += f'\t\t\t\t\t\t<li><a href="{student["url"]}">{student["name"]}</a>\n'
        html += '\t\t\t\t\t\t</ul> \n\n\n'

    # Unpublished papers
    html += '<h2  class="papers-header">Unpublished Papers</h2>\n'
    html += '<ul class="papers">\n'
    for paper in unpublished:
        html += render_unpublished_paper(paper, coauthors) + '\n\n'
    html += '</ul>\n\n'

    # Published papers
    html += '<h2 class="papers-header">Published and Forthcoming Papers</h2>\n'
    html += '<ol reversed class="papers">\n\n'
    for paper in published:
        html += render_published_paper(paper, coauthors) + '\n\n'
    html += '</ol>\n'

    html += INDEX_FOOTER.format(footer_date=FOOTER_DATE)

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Generated index.html")

def build_published(papers, coauthors):
    """Build published.html (mobile page)."""
    published = [p for p in papers if p['status'] == 'published']

    html = MOBILE_PAGE_HEADER.format(title="Published Papers", heading="Published and Forthcoming Papers")

    html += '<ol reversed class="papers">\n'
    for paper in published:
        html += render_published_paper(paper, coauthors) + '\n\n'
    html += '</ol>\n'

    html += MOBILE_PAGE_FOOTER.format(footer_date=FOOTER_DATE)

    with open('published.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Generated published.html")

def build_unpublished(papers, coauthors):
    """Build unpublished.html (mobile page)."""
    unpublished = [p for p in papers if p['status'] == 'unpublished']

    html = MOBILE_PAGE_HEADER.format(title="Unpublished Papers", heading="Unpublished Papers")

    html += '<ul class="papers">\n'
    for paper in unpublished:
        html += render_unpublished_paper(paper, coauthors) + '\n\n'
    html += '</ul>\n'

    html += MOBILE_PAGE_FOOTER.format(footer_date=FOOTER_DATE)

    with open('unpublished.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Generated unpublished.html")

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("Loading data...")
    papers, coauthors = load_data()

    print(f"Found {len(papers)} papers")
    print(f"Found {len(coauthors)} coauthors")

    print("\nBuilding pages...")
    build_index(papers, coauthors)
    build_published(papers, coauthors)
    build_unpublished(papers, coauthors)

    print("\nDone! Remember to review the generated files before committing.")

if __name__ == '__main__':
    main()
