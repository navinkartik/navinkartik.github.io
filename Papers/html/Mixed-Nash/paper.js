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
    var group = document.createElement('div');
    group.id = 'nk-btn-group';
    group.appendChild(btn);
    document.body.appendChild(group);

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
        let authorName, affiliationText = null, inlineNoteHTML = null;

        if (breaks.length > 0) {
          const firstEl = nameEl.firstElementChild;
          if (firstEl && firstEl.nodeName === 'SPAN' && firstEl !== breaks[0]) {
            // All-authors-in-one-span pattern (e.g. \thanks[a]{} affiliations):
            // firstEl is a bold span with all author names + sup[a,b,c] markers.
            // After first <br>: outer sup marker then a font-size span with addresses.
            const clone = firstEl.cloneNode(true);
            clone.querySelectorAll('sup').forEach(function(s) { s.remove(); });
            authorName = clone.textContent.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
            const affLines = [];
            let pastFirstBreak = false;
            for (const node of nameEl.childNodes) {
              if (!pastFirstBreak) { if (node.nodeName === 'BR') pastFirstBreak = true; continue; }
              if (node.nodeName === 'SUP') continue;
              if (node.nodeName === 'SPAN') {
                let lineText = '';
                for (const child of node.childNodes) {
                  if (child.nodeName === 'BR') {
                    const l = lineText.replace(/\s+/g, ' ').trim();
                    if (l) affLines.push(l);
                    lineText = '';
                  } else if (child.nodeName === 'SUP') {
                    continue;
                  } else {
                    lineText += child.textContent;
                  }
                }
                const l = lineText.replace(/\s+/g, ' ').trim();
                if (l) affLines.push(l);
              } else if (node.nodeType === 3) {
                const txt = node.textContent.replace(/\s+/g, ' ').trim();
                if (txt) affLines.push(txt);
              }
            }
            affiliationText = affLines.join('\n');
          } else {
            // Simple pattern: plain text nodes separated by <br> breaks.
            const nameParts = [], affParts = [];
            let seenBreak = false;
            for (const node of nameEl.childNodes) {
              if (node.nodeName === 'BR') { seenBreak = true; continue; }
              if (node.nodeName === 'SUP') continue;
              const txt = node.textContent.trim();
              if (!txt) continue;
              if (!seenBreak) nameParts.push(txt);
              else affParts.push(txt);
            }
            authorName = nameParts.join(' ').trim();
            affiliationText = affParts.filter(Boolean).join(', ');
          }
        } else {
          // Old papers: affiliation in ltx_note ltx_role_footnote inside ltx_personname.
          // Clone name, strip the note to get clean author name, extract note content separately.
          const inlineNote = nameEl.querySelector('.ltx_note.ltx_role_footnote');
          if (inlineNote) {
            const nameClone = nameEl.cloneNode(true);
            nameClone.querySelectorAll('.ltx_note').forEach(function(n) { n.remove(); });
            authorName = nameClone.textContent.trim();
            const noteContent = inlineNote.querySelector('.ltx_note_content');
            if (noteContent) {
              const cc = noteContent.cloneNode(true);
              cc.querySelectorAll('.ltx_note_mark, .ltx_tag').forEach(function(n) { n.remove(); });
              inlineNoteHTML = cc.innerHTML.trim();
            }
          } else {
            authorName = nameEl.textContent.trim();
          }
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
          if (affiliationText.includes('\n')) {
            affiliationText.split('\n').forEach(function(line) {
              const d = document.createElement('div');
              d.textContent = line;
              affBlock.appendChild(d);
            });
          } else {
            affBlock.textContent = affiliationText;
          }
          container.appendChild(affBlock);
        }
        // Affiliation from inline footnote inside ltx_personname (old \thanks{} pattern)
        if (inlineNoteHTML && !noteEl) {
          const noteBlock = document.createElement('div');
          noteBlock.style.marginBottom = '0.8rem';
          noteBlock.style.fontSize = '0.82rem';
          noteBlock.style.color = 'var(--muted)';
          noteBlock.innerHTML = inlineNoteHTML;
          container.appendChild(noteBlock);
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

    // Pattern D: nk-proof-smallcaps — smallcaps "Proof:" span (e.g. Opinions, ∥ QED).
    // Structurally identical to Pattern B but keyed on ltx_font_smallcaps.
    document.querySelectorAll('div.nk-proof-smallcaps').forEach(function (proof) {
      const scSpan = proof.querySelector('.ltx_font_smallcaps');
      if (!scSpan || !/^\s*Proof[.:\s]/.test(scSpan.textContent)) return;

      const paras = Array.from(proof.children).filter(function (el) {
        return el.classList.contains('ltx_para');
      });
      if (!paras.length) return;

      const body = document.createElement('div');
      body.className = 'nk-proof-body';

      const labelP = scSpan.closest('p');
      const nodesToMove = [];
      let past = false;
      Array.from(labelP.childNodes).forEach(function (node) {
        if (past) { nodesToMove.push(node); }
        else if (node === scSpan) { past = true; }
      });
      nodesToMove.forEach(function (node) { body.appendChild(node); });
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
      scSpan.appendChild(btn);

      attachProofToggle(body, btn);
      body.classList.add('nk-collapsed');
      body.style.overflow = 'hidden';
      btn.textContent = 'show';
      btn.setAttribute('aria-expanded', 'false');
    });

    // Pattern C: nk-proof-italic — italic <em>Proof</em> inside p.ltx_p inside div.ltx_para.
    // The em tag contains only "Proof"; the period is a text node sibling immediately after.
    // We keep the period in the label and move everything after it into nk-proof-body.
    document.querySelectorAll('div.nk-proof-italic').forEach(function (proof) {
      const emTag = proof.querySelector('em');
      if (!emTag || !/^\s*Proof[.\s]?/.test(emTag.textContent)) return;

      const paras = Array.from(proof.children).filter(function (el) {
        return el.classList.contains('ltx_para');
      });
      if (!paras.length) return;

      const body = document.createElement('div');
      body.className = 'nk-proof-body';
      const labelP = emTag.closest('p');

      // If the node immediately after emTag is a text node starting with '.', split it:
      // keep '.' in the label (so "Proof." stays visible when collapsed), move the rest to body.
      // The button will be inserted after the '.' text node.
      let anchor = emTag; // button inserts after this node
      const afterEm = emTag.nextSibling;
      if (afterEm && afterEm.nodeType === Node.TEXT_NODE && afterEm.textContent.startsWith('.')) {
        const rest = afterEm.textContent.slice(1);
        afterEm.textContent = '.';
        if (rest) {
          labelP.insertBefore(document.createTextNode(rest), afterEm.nextSibling);
        }
        anchor = afterEm; // button goes after the '.'
      }

      // Move everything after anchor into body
      const nodesToMove = [];
      let pastAnchor = false;
      Array.from(labelP.childNodes).forEach(function (node) {
        if (pastAnchor) nodesToMove.push(node);
        else if (node === anchor) pastAnchor = true;
      });
      nodesToMove.forEach(function (node) { body.appendChild(node); });

      // Also move any siblings of labelP within the first para div
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
      labelP.insertBefore(btn, anchor.nextSibling);

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

  /* ── TOC toggle ─────────────────────────────────────────────── */
  document.querySelectorAll('nav.ltx_TOC').forEach(function (toc) {
    var heading = toc.querySelector('h6.ltx_title_contents');
    var list    = toc.querySelector('ol.ltx_toclist');
    if (!heading || !list) return;

    var body = document.createElement('div');
    body.className = 'nk-toc-body';
    toc.insertBefore(body, list);
    body.appendChild(list);

    var ind = document.createElement('span');
    ind.className = 'nk-toc-indicator';
    ind.textContent = '▸';
    heading.appendChild(ind);

    body.classList.add('nk-collapsed');

    heading.addEventListener('click', function () {
      var collapsed = body.classList.toggle('nk-collapsed');
      ind.textContent = collapsed ? '▸' : '▾';
    });
  });

  /* ── Cross-reference preview tooltips ─────────────────────── */
  function initRefPreviews() {
    // Desktop only — skip touch/hover:none devices
    if (window.matchMedia('(hover: none)').matches) return;

    var preview = document.createElement('div');
    preview.id = 'nk-ref-preview';
    preview.style.display = 'none';
    document.body.appendChild(preview);

    function cloneTheoremContent(el) {
      var clone = el.cloneNode(true);
      clone.querySelectorAll('.nk-proof, .nk-proof-toggle, button').forEach(function(n) { n.remove(); });
      return clone;
    }

    function resolveContent(id) {
      if (id.startsWith('bib.bib') || id.startsWith('footnote')) return null;
      var target = document.getElementById(id);
      if (!target) return null;
      if (target.classList.contains('ltx_theorem'))   return cloneTheoremContent(target);
      if (target.classList.contains('ltx_eqn_table')) return target.cloneNode(true);
      return null;
    }

    function placePreview(x, y) {
      var pw = Math.max(preview.offsetWidth, 200);
      var ph = Math.max(preview.offsetHeight, 100);
      var maxX = window.scrollX + window.innerWidth - pw - 16;
      var px = Math.min(x + 16, maxX);
      var py = y + 20;
      if (py + ph > window.scrollY + window.innerHeight - 16) py = y - ph - 8;
      preview.style.left = Math.max(window.scrollX + 8, px) + 'px';
      preview.style.top  = Math.max(window.scrollY + 8, py) + 'px';
    }

    var showTimer = null, hideTimer = null;

    document.querySelectorAll('a.ltx_ref').forEach(function(link) {
      if (link.closest('.ltx_cite, #nk-toc-sidebar, #nk-toc-panel, #nk-ref-preview')) return;
      var href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;

      link.addEventListener('mouseenter', function(e) {
        clearTimeout(hideTimer);
        clearTimeout(showTimer);
        var ex = e.pageX, ey = e.pageY;
        showTimer = setTimeout(function() {
          var content = resolveContent(href.slice(1));
          if (!content) return;
          preview.innerHTML = '';
          preview.appendChild(content);
          preview.style.display = 'block';
          placePreview(ex, ey);
        }, 300);
      });

      link.addEventListener('mousemove', function(e) {
        if (preview.style.display !== 'none') placePreview(e.pageX, e.pageY);
      });

      link.addEventListener('mouseleave', function() {
        clearTimeout(showTimer);
        hideTimer = setTimeout(function() {
          preview.style.display = 'none';
          preview.innerHTML = '';
        }, 150);
      });
    });
  }

  /* ── Back-to-text button ───────────────────────────────────── */
  /* When any internal link (#...) navigates away, show a floating
     "↩ back to text" button that restores the saved scroll position.
     Scroll is saved on touchstart/mousedown (before navigation fires). */
  function initBackToText() {
    var savedScrollY = null;

    var btn = document.createElement('button');
    btn.id = 'nk-back-btn';
    btn.textContent = '↩ back';
    btn.setAttribute('aria-label', 'Return to previous position in text');
    btn.style.display = 'none';
    document.body.appendChild(btn);

    // Save scroll position as early as possible (before navigation fires)
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
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
      if (savedScrollY !== null) {
        btn.style.display = 'block';
      }
    });

    function doBack() {
      if (savedScrollY !== null) {
        window.scrollTo({ top: savedScrollY, behavior: 'smooth' });
      }
      btn.style.display = 'none';
      savedScrollY = null;
    }

    btn.addEventListener('click', doBack);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.style.display !== 'none') doBack();
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
      // Find the link associated with THIS etal: walk next siblings (not first in cite)
      let link = null;
      let sib = etal.nextSibling;
      while (sib) {
        if (sib.nodeType === Node.ELEMENT_NODE && sib.matches('a.ltx_ref[href^="#bib.bib"]')) {
          link = sib;
          break;
        }
        sib = sib.nextSibling;
      }
      if (!link) return;
      const bibId = link.getAttribute('href').slice(1); // strip leading #
      const fullNames = bibMap[bibId];
      if (!fullNames) return;
      // Replace the leading author text node (previous sibling of etal span)
      // Preserve any non-alpha prefix (e.g. "; " separator between citations)
      const prev = etal.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        const m = prev.textContent.match(/^([\s\S]*?)([A-Za-z][\s\S]*)$/);
        prev.textContent = m ? m[1] + fullNames : fullNames;
      } else {
        etal.parentNode.insertBefore(document.createTextNode(fullNames), etal);
      }
      etal.remove();
    });
  }

  /* ── Lightbox ───────────────────────────────────────────────── */
  function initLightbox() {
    var lb = document.createElement('div');
    lb.id = 'nk-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Figure zoom');
    var lbImg = document.createElement('img');
    lbImg.id = 'nk-lightbox-img';
    lbImg.alt = '';
    var lbCap = document.createElement('div');
    lbCap.id = 'nk-lightbox-caption';
    lb.appendChild(lbImg);
    lb.appendChild(lbCap);
    document.body.appendChild(lb);

    function openLb(src, captionEl) {
      lbImg.src = src;
      lbImg.classList.toggle('nk-lb-svg', src.endsWith('.svg'));
      lbCap.innerHTML = captionEl ? captionEl.innerHTML : '';
      lb.classList.add('nk-lb-active');
    }
    function closeLb() {
      lb.classList.remove('nk-lb-active');
      lbImg.src = '';
      lbCap.innerHTML = '';
    }

    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLb();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('nk-lb-active')) closeLb();
    });

    var figs = document.querySelectorAll('figure.ltx_figure, figure.ltx_figure_panel');
    figs.forEach(function (fig) {
      var caption = fig.querySelector('figcaption.ltx_caption');

      fig.querySelectorAll('img.ltx_graphics:not(.ltx_markedasmath)').forEach(function (img) {
        img.addEventListener('click', function (e) {
          e.stopPropagation();
          openLb(img.src, caption);
        });
      });

      fig.querySelectorAll('object.ltx_graphics').forEach(function (obj) {
        var wrap = document.createElement('span');
        wrap.className = 'nk-fig-wrap';
        obj.parentNode.insertBefore(wrap, obj);
        wrap.appendChild(obj);
        var overlay = document.createElement('span');
        overlay.className = 'nk-fig-overlay';
        wrap.appendChild(overlay);
        overlay.addEventListener('click', function (e) {
          e.stopPropagation();
          openLb(obj.data, caption);
        });
      });
    });

    // Bare object.ltx_graphics not inside a figure (e.g. inline footnote diagrams)
    document.querySelectorAll('object.ltx_graphics').forEach(function (obj) {
      if (obj.closest('figure')) return; // already handled above
      var wrap = document.createElement('span');
      wrap.className = 'nk-fig-wrap';
      obj.parentNode.insertBefore(wrap, obj);
      wrap.appendChild(obj);
      var overlay = document.createElement('span');
      overlay.className = 'nk-fig-overlay';
      wrap.appendChild(overlay);
      overlay.addEventListener('click', function (e) {
        e.stopPropagation();
        openLb(obj.data, null);
      });
    });
  }

  /* ── Scroll to top ─────────────────────────────────────────── */
  function initScrollToTop() {
    var group = document.getElementById('nk-btn-group');
    if (!group) return;

    var btn = document.createElement('button');
    btn.id = 'nk-top-btn';
    btn.setAttribute('aria-label', 'Scroll to top');
    btn.classList.add('nk-hidden'); // hidden until scrolled past threshold

    function isMobile() { return window.innerWidth <= 600; }
    function updateLabel() { btn.textContent = isMobile() ? '↑' : '↑ Top'; }
    updateLabel();
    window.addEventListener('resize', updateLabel);

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Show on scroll-up past threshold; hide on scroll-down or near top
    var THRESHOLD = 400;
    var lastY = window.scrollY, ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          var current = window.scrollY;
          if (current < THRESHOLD) {
            btn.classList.add('nk-hidden');
          } else if (current > lastY + 8) {
            btn.classList.add('nk-hidden');
          } else if (current < lastY - 8) {
            btn.classList.remove('nk-hidden');
          }
          lastY = current;
          ticking = false;
        });
        ticking = true;
      }
    }, {passive: true});

    // Prepend so scroll-to-top sits above dark mode toggle in the column
    group.insertBefore(btn, group.firstChild);
  }

  /* ── TOC Sidebar + Panel ───────────────────────────────────── */
  function initToc() {
    var HEADING_SELECTOR = [
      'section.ltx_section    > h2.ltx_title_section',
      'section.ltx_appendix   > h2.ltx_title_appendix',
      'section.ltx_subsection > h3.ltx_title_subsection'
    ].join(',');

    var headingEls = document.querySelectorAll(HEADING_SELECTOR);
    if (!headingEls.length) return;

    // Build entries
    var entries = [];
    headingEls.forEach(function(h) {
      var sec = h.closest('section[id]');
      if (!sec) return;
      var id = sec.id;
      var isAppendix = /^A/.test(id);
      var level = h.classList.contains('ltx_title_subsection') ? 2 : 1;

      var tagSpan = h.querySelector('[class*="ltx_tag_"]');
      var num = tagSpan ? tagSpan.textContent.trim() : '';
      var clone = h.cloneNode(true);
      var cloneTag = clone.querySelector('[class*="ltx_tag_"]');
      if (cloneTag) cloneTag.remove();
      var title = clone.textContent.trim();

      entries.push({ id: id, level: level, isAppendix: isAppendix,
                     num: num, title: title, sidebarItem: null, panelItem: null });
    });

    if (!entries.length) return;

    var hasRegular = entries.some(function(e) { return !e.isAppendix; });
    var firstAppendixIdx = -1;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isAppendix && firstAppendixIdx === -1) { firstAppendixIdx = i; break; }
    }

    function buildList(forPanel) {
      var ul = document.createElement('ul');
      ul.className = 'nk-toc-list';
      entries.forEach(function(e, idx) {
        if (idx === firstAppendixIdx && hasRegular) {
          var div = document.createElement('li');
          div.className = 'nk-toc-divider';
          div.setAttribute('aria-hidden', 'true');
          ul.appendChild(div);
        }
        var li = document.createElement('li');
        li.className = 'nk-toc-item nk-toc-l' + e.level;
        if (e.isAppendix) li.classList.add('nk-toc-appendix');
        li.dataset.tocId = e.id;

        var a = document.createElement('a');
        a.href = '#' + e.id;
        var numSpan = document.createElement('span');
        numSpan.className = 'nk-toc-num';
        numSpan.textContent = e.num;
        var titleSpan = document.createElement('span');
        titleSpan.className = 'nk-toc-title';
        titleSpan.textContent = e.title;
        a.appendChild(numSpan);
        a.appendChild(titleSpan);
        li.appendChild(a);

        if (forPanel) {
          e.panelItem = li;
          a.addEventListener('click', closePanel);
        } else {
          e.sidebarItem = li;
        }
        ul.appendChild(li);
      });
      return ul;
    }

    // Sidebar
    var sidebar = document.createElement('nav');
    sidebar.id = 'nk-toc-sidebar';
    sidebar.setAttribute('aria-label', 'Table of contents');
    var sidebarHeader = document.createElement('div');
    sidebarHeader.className = 'nk-toc-header';
    var sidebarTitle = document.createElement('span');
    sidebarTitle.textContent = 'Contents';
    var sidebarCloseBtn = document.createElement('button');
    sidebarCloseBtn.id = 'nk-toc-sidebar-close';
    sidebarCloseBtn.setAttribute('aria-label', 'Close table of contents');
    sidebarCloseBtn.textContent = '✕';
    sidebarCloseBtn.addEventListener('click', toggleSidebar);
    sidebarHeader.appendChild(sidebarTitle);
    sidebarHeader.appendChild(sidebarCloseBtn);
    sidebar.appendChild(sidebarHeader);
    sidebar.appendChild(buildList(false));
    document.body.appendChild(sidebar);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'nk-toc-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Table of contents');

    var panelHeader = document.createElement('div');
    panelHeader.className = 'nk-toc-panel-header';
    var panelTitle = document.createElement('span');
    panelTitle.textContent = 'Contents';
    var closeBtn = document.createElement('button');
    closeBtn.id = 'nk-toc-close';
    closeBtn.setAttribute('aria-label', 'Close table of contents');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', closePanel);
    panelHeader.appendChild(panelTitle);
    panelHeader.appendChild(closeBtn);

    var panelNav = document.createElement('nav');
    panelNav.appendChild(buildList(true));
    panel.appendChild(panelHeader);
    panel.appendChild(panelNav);
    document.body.appendChild(panel);

    var backdrop = document.createElement('div');
    backdrop.id = 'nk-toc-backdrop';
    backdrop.addEventListener('click', closePanel);
    document.body.appendChild(backdrop);

    // Toggle button
    var group = document.getElementById('nk-btn-group');
    var tocBtn = document.createElement('button');
    tocBtn.id = 'nk-toc-btn';
    tocBtn.setAttribute('aria-label', 'Toggle table of contents');
    tocBtn.setAttribute('aria-expanded', 'true');

    function isMobile() { return window.innerWidth <= 600; }
    function isSidebarMode() { return window.innerWidth >= 110 * 16; }

    function updateLabel() { tocBtn.textContent = isMobile() ? '☰' : '☰ TOC'; }
    updateLabel();
    window.addEventListener('resize', updateLabel);

    group.insertBefore(tocBtn, group.firstChild);

    // Panel open/close
    var panelOpen = false;
    function openPanel() {
      panel.classList.add('nk-toc-open');
      backdrop.classList.add('nk-toc-open');
      tocBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      panelOpen = true;
    }
    function closePanel() {
      panel.classList.remove('nk-toc-open');
      backdrop.classList.remove('nk-toc-open');
      tocBtn.setAttribute('aria-expanded', panelOpen ? 'false' : 'true');
      document.body.style.overflow = '';
      panelOpen = false;
    }

    // Sidebar toggle
    var sidebarHidden = false;
    function toggleSidebar() {
      sidebarHidden = !sidebarHidden;
      sidebar.classList.toggle('nk-toc-hidden', sidebarHidden);
      tocBtn.setAttribute('aria-expanded', sidebarHidden ? 'false' : 'true');
    }

    tocBtn.addEventListener('click', function() {
      if (isSidebarMode()) toggleSidebar();
      else if (panelOpen) closePanel();
      else openPanel();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panelOpen) closePanel();
    });

    window.addEventListener('resize', function() {
      if (isSidebarMode() && panelOpen) closePanel();
    });

    // Hide button on scroll down (same pattern as other group buttons)
    var lastTocY = window.scrollY, tocTicking = false;
    window.addEventListener('scroll', function() {
      if (!tocTicking) {
        window.requestAnimationFrame(function() {
          var current = window.scrollY;
          if (current > lastTocY + 8) tocBtn.classList.add('nk-hidden');
          else if (current < lastTocY - 8) tocBtn.classList.remove('nk-hidden');
          lastTocY = current;
          tocTicking = false;
        });
        tocTicking = true;
      }
    }, {passive: true});

    // Scroll-spy
    var activeId = null;
    var scanPending = false;

    function setActive(id) {
      if (id === activeId) return;
      activeId = id;
      entries.forEach(function(e) {
        var on = e.id === id;
        if (e.sidebarItem) e.sidebarItem.classList.toggle('nk-toc-active', on);
        if (e.panelItem)   e.panelItem.classList.toggle('nk-toc-active', on);
      });
      if (id && !sidebarHidden && isSidebarMode()) {
        var el = sidebar.querySelector('[data-toc-id="' + CSS.escape(id) + '"]');
        if (el) el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      }
    }

    function scanActive() {
      var threshold = window.scrollY + window.innerHeight * 0.25;
      var best = null;
      entries.forEach(function(e) {
        var sec = document.getElementById(e.id);
        if (!sec) return;
        if (sec.getBoundingClientRect().top + window.scrollY <= threshold) best = e;
      });
      setActive(best ? best.id : null);
    }

    var io = new IntersectionObserver(function(records) {
      records.forEach(function(rec) {
        if (rec.isIntersecting) setActive(rec.target.id);
      });
      if (!scanPending) {
        scanPending = true;
        requestAnimationFrame(function() { scanActive(); scanPending = false; });
      }
    }, {rootMargin: '0px 0px -75% 0px', threshold: 0});

    entries.forEach(function(e) {
      var sec = document.getElementById(e.id);
      if (sec) io.observe(sec);
    });

    scanActive();
  }

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    fixPageTitle();
    initDarkMode();
    initScrollToTop();
    initToc();
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
      initRefPreviews();
      initBackToText();
      initLightbox();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
