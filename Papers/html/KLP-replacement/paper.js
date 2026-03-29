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
    btn.setAttribute('aria-label', 'Toggle dark mode');
    document.body.appendChild(btn);

    // If the title has an author-chosen inline color, lighten it for dark mode
    // (preserves hue/saturation, forces lightness to 70% so it reads on dark bg)
    const titleEl = document.querySelector('.ltx_title_document');
    const titleOrigColor = titleEl ? titleEl.style.color : null;

    // Default to system preference; saved override takes precedence
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('nk-theme');
    setDark(saved ? saved === 'dark' : sysDark, /*persist=*/false);

    btn.addEventListener('click', function () {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setDark(!isDark, /*persist=*/true);
    });

    // Hide on scroll-down, show on scroll-up (mobile best practice)
    var lastScrollY = window.scrollY, ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          var current = window.scrollY;
          if (current > lastScrollY + 8) btn.classList.add('nk-hidden');
          else if (current < lastScrollY - 8) btn.classList.remove('nk-hidden');
          lastScrollY = current;
          ticking = false;
        });
        ticking = true;
      }
    }, {passive: true});

    function isMobile() { return window.innerWidth <= 600; }

    function updateLabel(on) {
      btn.textContent = isMobile() ? '◑' : (on ? '◑ light' : '◑ dark');
    }
    window.addEventListener('resize', function () { updateLabel(
      document.documentElement.getAttribute('data-theme') === 'dark'); });

    function setDark(on, persist) {
      document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
      updateLabel(on);
      if (persist) localStorage.setItem('nk-theme', on ? 'dark' : 'light');
      if (titleEl && titleOrigColor) {
        titleEl.style.color = on ? lightenHex(titleOrigColor) : titleOrigColor;
      }
    }

    function lightenHex(color) {
      // Browsers normalize inline colors to rgb(r,g,b) — parse that format
      const m = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
      if (!m) return color;
      const r = parseInt(m[1])/255;
      const g = parseInt(m[2])/255;
      const b = parseInt(m[3])/255;
      const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
      let h = 0, s = 0, l = (max+min)/2;
      if (d) {
        s = l > 0.5 ? d/(2-max-min) : d/(max+min);
        switch (max) {
          case r: h = ((g-b)/d + (g<b?6:0))/6; break;
          case g: h = ((b-r)/d + 2)/6; break;
          case b: h = ((r-g)/d + 4)/6; break;
        }
      }
      return 'hsl('+Math.round(h*360)+','+Math.round(s*100)+'%,70%)';
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
        // Old papers embed affiliation inside ltx_personname via <br> breaks.
        // Modern papers put it in ltx_author_notes. Handle both.
        const breaks = nameEl.querySelectorAll('br.ltx_break');
        let authorName, affiliationText = null;

        if (breaks.length > 0) {
          // Split at first <br>: before = name, after = affiliation lines
          const nameParts = [], affParts = [];
          let seenBreak = false;
          for (const node of nameEl.childNodes) {
            if (node.nodeName === 'BR') { seenBreak = true; continue; }
            const txt = node.textContent.trim();
            if (!txt) continue;
            if (!seenBreak) nameParts.push(txt);
            else affParts.push(txt);
          }
          authorName = nameParts.join(' ').trim();
          affiliationText = affParts.filter(Boolean).join(', ');
        } else {
          authorName = nameEl.textContent.trim();
        }

        // Author name line
        const nameBlock = document.createElement('div');
        nameBlock.style.marginBottom = '0.3rem';
        nameBlock.textContent = authorName;
        nameBlock.style.fontWeight = '500';
        nameBlock.style.fontVariant = 'small-caps';
        nameBlock.style.fontSize = '1.05rem';
        container.appendChild(nameBlock);

        // Affiliation from embedded breaks (old papers)
        if (affiliationText) {
          const affBlock = document.createElement('div');
          affBlock.style.marginBottom = '0.3rem';
          affBlock.style.fontSize = '0.82rem';
          affBlock.style.color = 'var(--muted)';
          affBlock.textContent = affiliationText;
          container.appendChild(affBlock);
        }
        // ltx_author_notes: affiliation for modern papers, contact info for old papers — show either way
        if (noteEl) {
          const noteBlock = document.createElement('div');
          noteBlock.style.marginBottom = '0.8rem';
          noteBlock.style.fontSize = affiliationText ? '0.75rem' : '0.82rem';
          noteBlock.style.color = 'var(--muted)';
          noteBlock.innerHTML = noteEl.innerHTML;
          container.appendChild(noteBlock);
        }
      }
    });

    authorDiv.after(container);
  }

  /* ── Proof toggle helper ───────────────────────────────────── */
  /* overflow:visible by default so margin floats escape the proof body.
     We set overflow:hidden only during the collapse animation, then restore. */
  function attachProofToggle(body, btn) {
    btn.addEventListener('click', function () {
      const collapsed = body.classList.toggle('nk-collapsed');
      btn.textContent = collapsed ? 'show' : 'hide';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      if (collapsed) {
        body.style.overflow = 'hidden';
      } else {
        body.addEventListener('transitionend', function () {
          body.style.overflow = '';
        }, { once: true });
      }
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
    });
  }

  /* ── Proof toggle ──────────────────────────────────────────── */
  /* Finds proof items (ltx_item containing "Proof" tag) and
     theorem appendix proofs, adds a [hide proof] button.
     Content stays in DOM at all times.                           */
  function initProofToggles() {
    // Handle div.ltx_proof (older papers — LaTeXML emits this directly from amsthm)
    document.querySelectorAll('div.ltx_proof').forEach(function (proof) {
      const label = proof.querySelector('h6.ltx_title_proof');
      if (!label) return;
      const paras = Array.from(proof.children).filter(function (el) {
        return el.classList.contains('ltx_para');
      });
      if (!paras.length) return;

      const body = document.createElement('div');
      body.className = 'nk-proof-body';
      paras.forEach(function (p) { body.appendChild(p); });
      proof.appendChild(body);

      const btn = document.createElement('span');
      btn.className = 'nk-proof-toggle';
      btn.textContent = 'hide';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-expanded', 'true');
      label.appendChild(btn);

      attachProofToggle(body, btn);
      body.classList.add('nk-collapsed');
      body.style.overflow = 'hidden';
      btn.textContent = 'show';
      btn.setAttribute('aria-expanded', 'false');
    });

    // All nk-proof proofs are wrapped by apply_design.py.
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

      attachProofToggle(body, btn);
      body.classList.add('nk-collapsed');
      body.style.overflow = 'hidden';
      btn.textContent = 'show';
      btn.setAttribute('aria-expanded', 'false');
    });

    // Pattern B: nk-proof-bold — bold "Proof." span inside p.ltx_p inside div.ltx_para.
    // Label para is the first child; remaining div.ltx_para children go into nk-proof-body.
    document.querySelectorAll('div.nk-proof-bold').forEach(function (proof) {
      const boldSpan = proof.querySelector('.ltx_font_bold');
      if (!boldSpan || !/^\s*Proof[.\s]/.test(boldSpan.textContent)) return;

      const paras = Array.from(proof.children).filter(function (el) {
        return el.classList.contains('ltx_para');
      });
      if (!paras.length) return;

      const body = document.createElement('div');
      body.className = 'nk-proof-body';

      // Always move everything after the bold span (in the label p) into the body,
      // then also any subsequent sibling paras. This way "Proof." stays visible
      // when collapsed, and all proof content is toggled.
      const labelP = boldSpan.closest('p');
      const nodesToMove = [];
      let past = false;
      Array.from(labelP.childNodes).forEach(function (node) {
        if (past) { nodesToMove.push(node); }
        else if (node === boldSpan) { past = true; }
      });
      nodesToMove.forEach(function (node) { body.appendChild(node); });
      // Also move any siblings of labelP within the first para div (e.g. equation tables
      // that LaTeXML places as children of ltx_para alongside the <p>).
      const firstParaDiv = labelP.parentElement;
      if (firstParaDiv && firstParaDiv.classList.contains('ltx_para')) {
        const afterLabelP = [];
        let seenLabelP = false;
        Array.from(firstParaDiv.childNodes).forEach(function (node) {
          if (seenLabelP) { afterLabelP.push(node); }
          else if (node === labelP) { seenLabelP = true; }
        });
        afterLabelP.forEach(function (node) { body.appendChild(node); });
      }
      paras.slice(1).forEach(function (para) { body.appendChild(para); });
      proof.appendChild(body);

      const btn = document.createElement('span');
      btn.className = 'nk-proof-toggle';
      btn.textContent = 'hide';
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-expanded', 'true');
      boldSpan.appendChild(btn);

      attachProofToggle(body, btn);
      body.classList.add('nk-collapsed');
      body.style.overflow = 'hidden';
      btn.textContent = 'show';
      btn.setAttribute('aria-expanded', 'false');
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
    let activeTouchLink = null;  // tracks which link has an open touch tooltip

    function showTooltip(targetId, x, y) {
      const entry = bibMap[targetId];
      if (!entry) return false;
      clearTimeout(activeTimeout);
      tooltip.innerHTML = entry;
      placeTooltip(x, y);
      tooltip.style.display = 'block';
      return true;
    }

    function hideTooltip() {
      tooltip.style.display = 'none';
      activeTouchLink = null;
    }

    function placeTooltip(x, y) {
      const maxX = window.scrollX + window.innerWidth - 400;
      tooltip.style.left = Math.min(x, maxX) + 'px';
      tooltip.style.top = y + 'px';
      tooltip.style.position = 'absolute';
    }

    document.querySelectorAll('.ltx_cite a.ltx_ref').forEach(function (link) {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const targetId = href.slice(1);

      // Desktop: hover
      link.addEventListener('mouseenter', function (e) {
        showTooltip(targetId, e.clientX + window.scrollX + 12, e.clientY + window.scrollY - 10);
      });

      link.addEventListener('mousemove', function (e) {
        placeTooltip(e.clientX + window.scrollX + 12, e.clientY + window.scrollY - 10);
      });

      link.addEventListener('mouseleave', function () {
        activeTimeout = setTimeout(hideTooltip, 150);
      });

      // Mobile: intercept first tap to show tooltip; suppress navigation
      link.addEventListener('click', function (e) {
        if (!window.matchMedia('(hover: none)').matches) return;  // desktop: allow normal click
        if (activeTouchLink === link) {
          // Second tap on same link: hide tooltip, let navigation proceed
          hideTooltip();
          return;
        }
        e.preventDefault();
        activeTouchLink = link;
        const rect = link.getBoundingClientRect();
        const x = rect.left + window.scrollX;
        const y = rect.bottom + window.scrollY + 4;
        showTooltip(targetId, x, y);
      });
    });

    // Mobile: tap outside any cite link dismisses the tooltip
    document.addEventListener('touchstart', function (e) {
      if (activeTouchLink && !e.target.closest('.ltx_cite')) {
        hideTooltip();
      }
    }, { passive: true });
  }

  /* ── Back-to-text button ───────────────────────────────────── */
  /* When a citation link navigates to a bib entry, show a floating
     "↩ back to text" button that restores the saved scroll position.
     Scroll is saved on touchstart/mousedown (before hashchange fires). */
  function initBackToText() {
    var savedScrollY = null;

    var btn = document.createElement('button');
    btn.id = 'nk-back-btn';
    btn.textContent = '↩ back to text';
    btn.setAttribute('aria-label', 'Return to citation in text');
    btn.style.display = 'none';
    document.body.appendChild(btn);

    // Save scroll position as early as possible (before navigation fires)
    document.querySelectorAll('.ltx_cite a.ltx_ref').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href || !href.startsWith('#bib.')) return;
      function saveScroll() { savedScrollY = window.scrollY; }
      link.addEventListener('mousedown', saveScroll);
      link.addEventListener('touchstart', saveScroll, { passive: true });
      // Show button on click — handles both first-time and same-hash repeat clicks.
      // Check defaultPrevented so we don't show it when the tooltip intercepted the tap.
      link.addEventListener('click', function (e) {
        if (e.defaultPrevented) return;
        btn.style.display = 'block';
      });
    });

    // hashchange handles navigation via keyboard or direct URL editing
    window.addEventListener('hashchange', function () {
      if (location.hash.startsWith('#bib.') && savedScrollY !== null) {
        btn.style.display = 'block';
      } else if (!location.hash.startsWith('#bib.')) {
        btn.style.display = 'none';
      }
    });

    btn.addEventListener('click', function () {
      if (savedScrollY !== null) {
        window.scrollTo({ top: savedScrollY, behavior: 'smooth' });
      }
      btn.style.display = 'none';
      savedScrollY = null;
    });
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
      initBackToText();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
