/* ================================================================
   paper.js — Interactive features for LaTeXML-generated papers
   All features degrade gracefully: content is always in the DOM.
   ================================================================ */

(function () {
  'use strict';

  /* ── Dark mode toggle ──────────────────────────────────────── */
  function initDarkMode() {
    const btn = document.createElement('button');
    btn.id = 'nk-dark-toggle';
    btn.textContent = '◑ dark';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    document.body.appendChild(btn);

    const saved = localStorage.getItem('nk-theme');
    if (saved === 'dark') setDark(true);

    btn.addEventListener('click', function () {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setDark(!isDark);
    });

    function setDark(on) {
      document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
      btn.textContent = on ? '◑ light' : '◑ dark';
      localStorage.setItem('nk-theme', on ? 'dark' : 'light');
    }
  }

  /* ── Affiliation display ───────────────────────────────────── */
  /* LaTeXML puts affiliations in .ltx_author_notes (hidden in CSS).
     Reformat: each author on own line, with affiliation directly below. */
  function initAffiliations() {
    const authorCreators = document.querySelectorAll('.ltx_creator.ltx_role_author');
    if (!authorCreators.length) return;

    const authorDiv = document.querySelector('.ltx_authors');
    if (!authorDiv) return;

    // Build new author block with affiliations inline
    const container = document.createElement('div');
    container.id = 'nk-affiliations';

    authorCreators.forEach(function (creator) {
      const nameEl = creator.querySelector('.ltx_personname');
      const noteEl = creator.querySelector('.ltx_author_notes');

      if (nameEl) {
        // Author name line
        const nameBlock = document.createElement('div');
        nameBlock.style.marginBottom = '0.3rem';
        nameBlock.textContent = nameEl.textContent.trim();
        nameBlock.style.fontWeight = '500';
        nameBlock.style.fontVariant = 'small-caps';
        nameBlock.style.fontSize = '1.05rem';
        container.appendChild(nameBlock);

        // Affiliation line (if present)
        if (noteEl) {
          const affBlock = document.createElement('div');
          affBlock.style.marginBottom = '0.8rem';
          affBlock.style.fontSize = '0.82rem';
          affBlock.style.color = 'var(--muted)';
          affBlock.innerHTML = noteEl.innerHTML;
          container.appendChild(affBlock);
        }
      }
    });

    authorDiv.after(container);
  }

  /* ── Proof toggle ──────────────────────────────────────────── */
  /* Finds proof items (ltx_item containing "Proof" tag) and
     theorem appendix proofs, adds a [hide proof] button.
     Content stays in DOM at all times.                           */
  function initProofToggles() {
    // All proofs are wrapped in div.nk-proof by apply_design.py.
    // Two sub-cases based on structure:
    // - Multi-paragraph: multiple div.ltx_para children → collapse all but the label para
    // - Single-paragraph: one div.ltx_para child (content inside li) → collapse li content
    document.querySelectorAll('div.nk-proof').forEach(function (proof) {
      const tag = proof.querySelector('.ltx_tag_item');
      if (!tag || !/^\s*Proof[.\s]/.test(tag.textContent)) return;

      const paras = Array.from(proof.children).filter(function (el) {
        return el.classList.contains('ltx_para');
      });

      const body = document.createElement('div');
      body.className = 'nk-proof-body';

      const li = tag.closest('li');
      if (!li) return;
      if (paras.length >= 2) {
        // Sibling paras exist: extract any li content first, then sibling paras.
        // Covers both: (a) empty li + sibling paras, (b) li with partial content + sibling paras.
        Array.from(li.childNodes).forEach(function (child) {
          if (child !== tag) body.appendChild(child);
        });
        paras.slice(1).forEach(function (para) { body.appendChild(para); });
        proof.appendChild(body);
      } else {
        // All proof content is inside the li (after the tag span).
        Array.from(li.childNodes).forEach(function (child) {
          if (child !== tag) body.appendChild(child);
        });
        li.appendChild(body);
      }

      const btn = document.createElement('span');
      btn.className = 'nk-proof-toggle';
      btn.textContent = 'hide';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-expanded', 'true');
      tag.appendChild(btn);

      btn.addEventListener('click', function () {
        const collapsed = body.classList.toggle('nk-collapsed');
        btn.textContent = collapsed ? 'show' : 'hide';
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      });
    });
  }

  /* ── Citation hover tooltips ───────────────────────────────── */
  /* On hover over a .ltx_cite link, show the full bibliography
     entry as a tooltip. Content already in DOM; this is display only. */
  function initCitationTooltips() {
    const tooltip = document.createElement('div');
    tooltip.className = 'nk-cite-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    // Build a map: bibitem id → HTML content
    const bibMap = {};
    document.querySelectorAll('.ltx_bibitem').forEach(function (item) {
      const id = item.id;
      if (id) {
        // Get HTML, strip the tag (e.g. "[BKL21]")
        const clone = item.cloneNode(true);
        const tag = clone.querySelector('.ltx_tag');
        if (tag) tag.remove();
        // Remove images to avoid [Image #N] artifacts
        clone.querySelectorAll('img').forEach(function (img) { img.remove(); });
        // Unwrap links (keep text, remove <a> tags)
        clone.querySelectorAll('a').forEach(function (link) {
          const text = document.createTextNode(link.textContent);
          link.parentNode.replaceChild(text, link);
        });
        // Remove metadata sections (Cited by, External Links, etc.)
        clone.querySelectorAll('div, span, p').forEach(function (el) {
          if (el.textContent.match(/Cited\s+by:|External|Links:/i)) el.remove();
        });
        bibMap[id] = clone.innerHTML.trim();
      }
    });

    let activeTimeout;

    document.querySelectorAll('.ltx_cite a.ltx_ref').forEach(function (link) {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const targetId = href.slice(1);

      link.addEventListener('mouseenter', function (e) {
        const entry = bibMap[targetId];
        if (!entry) return;
        clearTimeout(activeTimeout);
        tooltip.innerHTML = entry;
        positionTooltip(e);
        tooltip.style.display = 'block';
      });

      link.addEventListener('mousemove', positionTooltip);

      link.addEventListener('mouseleave', function () {
        activeTimeout = setTimeout(function () {
          tooltip.style.display = 'none';
        }, 150);
      });
    });

    function positionTooltip(e) {
      const x = e.clientX + window.scrollX + 12;
      const y = e.clientY + window.scrollY - 10;
      // Keep within viewport horizontally
      const maxX = window.scrollX + window.innerWidth - 400;
      tooltip.style.left = Math.min(x, maxX) + 'px';
      tooltip.style.top = y + 'px';
      tooltip.style.position = 'absolute';
    }
  }

  /* ── Fix <title> tag ───────────────────────────────────────── */
  /* LaTeXML merges \thanks into <title>. Strip everything after
     the paper title (i.e., after the first sentence/thanks text). */
  function fixPageTitle() {
    const h1 = document.querySelector('.ltx_title_document');
    if (!h1) return;
    // Get text from h1, excluding the hidden .ltx_note
    const clone = h1.cloneNode(true);
    clone.querySelectorAll('.ltx_note').forEach(function (n) { n.remove(); });
    const clean = clone.textContent.trim();
    if (clean) document.title = clean;
  }

  /* ── JSON-LD structured metadata ──────────────────────────── */
  /* Add machine-readable metadata for AI tools and search engines */
  function injectJsonLd() {
    const title = document.querySelector('.ltx_title_document');
    const abstract = document.querySelector('.ltx_abstract .ltx_p');
    const date = document.querySelector('.ltx_dates');
    const authors = document.querySelectorAll('.ltx_personname');

    if (!title) return;

    const titleClone = title.cloneNode(true);
    titleClone.querySelectorAll('.ltx_note').forEach(function (n) { n.remove(); });

    const data = {
      '@context': 'https://schema.org',
      '@type': 'ScholarlyArticle',
      'name': titleClone.textContent.trim(),
      'author': Array.from(authors).map(function (a) {
        return { '@type': 'Person', 'name': a.textContent.trim() };
      }),
      'description': abstract ? abstract.textContent.trim() : undefined,
      'datePublished': date ? date.textContent.replace(/[()]/g, '').trim() : undefined,
      'url': window.location.href
    };

    // Remove undefined fields
    Object.keys(data).forEach(function (k) {
      if (data[k] === undefined) delete data[k];
    });

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data, null, 2);
    document.head.appendChild(script);
  }

  /* ── Fix missing Abstract heading ──────────────────────────── */
  function ensureAbstractHeading() {
    const abs = document.querySelector('.ltx_abstract');
    if (!abs) return;
    const heading = abs.querySelector('.ltx_title_abstract');
    if (heading) return; // Already has heading
    // Add missing heading
    const h6 = document.createElement('h6');
    h6.className = 'ltx_title ltx_title_abstract';
    h6.textContent = 'Abstract';
    abs.insertBefore(h6, abs.firstChild);
  }

  /* ── Clean up bibliography metadata ──────────────────────── */
  function cleanBibliographyMetadata() {
    document.querySelectorAll('.ltx_bibitem').forEach(function (item) {
      item.querySelectorAll('*').forEach(function (el) {
        // Remove "Cited by:" and "External Links:" sections
        if (el.textContent.match(/^(Cited\s+by:|External\s+Links:)/i)) {
          el.remove();
        }
      });
    });
  }

  /* ── Fix double periods in proof tags ──────────────────────– */
  function fixDoublePeriodsInProofs() {
    document.querySelectorAll('.ltx_tag_item').forEach(function (tag) {
      if (tag.textContent.match(/\.\.$/) && tag.textContent.match(/^Proof/)) {
        tag.textContent = tag.textContent.replace(/\.\./, '.');
      }
    });
  }

  /* ── Expand "et al." to full author list ───────────────────── */
  function expandEtAl() {
    // Build map: bib element id → formatted last-name list
    // Source: ltx_tag_bibitem text, e.g. "N. Kartik, S. Lee, and D. Rappoport (2024b)"
    const bibMap = {};
    document.querySelectorAll('.ltx_bibitem').forEach(function (item) {
      const tag = item.querySelector('.ltx_tag_bibitem');
      if (!tag) return;
      // Strip trailing year "(2024b)" to get author string
      const authorStr = tag.textContent.trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
      // Split on ", and ", " and ", or "," to get individual author entries
      const parts = authorStr.split(/,\s*and\s+|\s+and\s+|,\s+/);
      // Strip leading initials ("F. " or "F. M. ") to get surname incl. particles ("van den Berg")
      const lastNames = parts.map(function (p) {
        return p.trim().replace(/^([A-Z]\.\s*)+/, '').trim();
      }).filter(function (n) { return n.length > 0; });
      // Format: "A and B" or "A, B, and C"
      let full;
      if (lastNames.length <= 1) {
        full = lastNames[0] || '';
      } else if (lastNames.length === 2) {
        full = lastNames[0] + ' and ' + lastNames[1];
      } else {
        full = lastNames.slice(0, -1).join(', ') + ', and ' + lastNames[lastNames.length - 1];
      }
      bibMap[item.id] = full;
    });

    // Replace each "et al." span with the full name list
    document.querySelectorAll('.ltx_bib_etal').forEach(function (etal) {
      const cite = etal.closest('.ltx_cite');
      if (!cite) return;
      // Find the link to the bib entry (may be sibling of etal or ancestor)
      const link = cite.querySelector('a.ltx_ref[href^="#bib.bib"]');
      if (!link) return;
      const bibId = link.getAttribute('href').slice(1); // strip leading #
      const fullNames = bibMap[bibId];
      if (!fullNames) return;
      // Replace the leading author text node (previous sibling of etal span)
      const prev = etal.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        prev.textContent = fullNames;
      } else {
        etal.parentNode.insertBefore(document.createTextNode(fullNames), etal);
      }
      etal.remove();
    });
  }

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    fixPageTitle();
    initDarkMode();
    initAffiliations();
    ensureAbstractHeading();
    expandEtAl();
    cleanBibliographyMetadata();
    fixDoublePeriodsInProofs();
    injectJsonLd();
    // Slight delay so DOM layout is stable for proof height measurement
    requestAnimationFrame(function () {
      initProofToggles();
      initCitationTooltips();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
