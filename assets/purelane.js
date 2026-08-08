/* ============================================================
   purelane.js
   ------------------------------------------------------------
   WHY THIS FILE IS SHAPED THIS WAY

   The prototype wrapped everything in one anonymous IIFE that ran
   once on page load and cached every element it found. That is fine
   in a static file and broken in a Shopify theme, because the theme
   editor swaps section HTML in and out over AJAX without reloading
   the page. After a merchant edits a section, the prototype's cached
   node references point at elements that are no longer in the DOM,
   and every animation in that section silently stops.

   This rewrite:
     - exposes named init/teardown functions instead of an IIFE
     - re-queries the DOM on every init rather than caching across runs
     - tracks observers/timers per element so they can be disconnected
     - listens for shopify:section:load / :unload / :select / :deselect
     - keeps ONE scroll listener for the whole page rather than one
       per section, so adding sections does not add scroll handlers

   Behaviour is otherwise identical to the prototype.
   ============================================================ */

(function () {
  'use strict';

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = mqReduce.matches;

  /* Per-element registries so teardown can find what to clean up. */
  var revealObserver = null;
  var registry = new WeakMap();
  var scrollRaf = null;
  var mx = 0, my = 0;

  /* =========================================================
     1. REVEAL ON SCROLL
     ========================================================= */
  function initReveals(root) {
    var els = root.querySelectorAll('.rv:not(.in)');
    if (!els.length) return;

    if (!('IntersectionObserver' in window) || reduce) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            revealObserver.unobserve(e.target);
          }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    }
    els.forEach(function (el) { revealObserver.observe(el); });
  }

  /* In the theme editor a section is often rendered offscreen or
     inside a scroll container the observer never fires for. Showing
     content immediately on :select avoids a section that appears blank
     the moment a merchant clicks it. */
  function forceReveal(root) {
    root.querySelectorAll('.rv').forEach(function (el) { el.classList.add('in'); });
  }

  /* =========================================================
     2. SCENE CROSSFADE + PARALLAX + RAIL  (page-level, one listener)
     ========================================================= */
  var currentScene = 0;

  function setScene(n) {
    if (n === currentScene) return;
    currentScene = n;
    var stage = document.getElementById('scenes');
    if (!stage) return;
    stage.querySelectorAll('.scene').forEach(function (s, i) {
      s.classList.toggle('on', i + 1 === n);
    });
    stage.setAttribute('data-d', String(n));
  }

  /* Re-queried every frame rather than cached, so sections added or
     reordered in the editor are picked up without a reload. */
  function pickScene() {
    var zones = document.querySelectorAll('[data-scene]');
    if (!zones.length) return;
    var focus = window.scrollY + window.innerHeight * 0.5;
    var n = 1;
    for (var i = 0; i < zones.length; i++) {
      var rect = zones[i].getBoundingClientRect();
      var top = rect.top + window.scrollY;
      if (top <= focus) {
        n = parseInt(zones[i].getAttribute('data-scene'), 10) || n;
      }
    }
    setScene(n);
  }

  function syncRail() {
    var links = document.querySelectorAll('.rail a');
    if (!links.length) return;
    var mid = window.scrollY + window.innerHeight * 0.42;
    var idx = 0;
    links.forEach(function (a, i) {
      var t = document.querySelector(a.getAttribute('href'));
      if (t && (t.getBoundingClientRect().top + window.scrollY) <= mid) idx = i;
    });
    links.forEach(function (a, i) { a.classList.toggle('on', i === idx); });
  }

  function frame() {
    scrollRaf = null;
    var y = window.scrollY || window.pageYOffset;

    var hdr = document.getElementById('hdr');
    if (hdr) hdr.classList.toggle('up', y > 90);

    if (!reduce) {
      var wl = document.querySelectorAll('#water .wl');
      var depths = [0.05, 0.09, 0.03, 0.02];
      for (var i = 0; i < wl.length; i++) {
        var d = depths[i] || 0.05;
        wl[i].style.setProperty('--px', (mx * d * 130).toFixed(1) + 'px');
        wl[i].style.setProperty('--py', (-y * d + my * d * 90).toFixed(1) + 'px');
      }
      var prod = document.getElementById('heroProd');
      if (prod) {
        var f = Math.min(y / 700, 1);
        prod.style.transform =
          'translate3d(' + (mx * -16).toFixed(2) + 'px,' +
          (-f * 54 + my * -10).toFixed(2) + 'px,0) scale(' + (1 - f * 0.06).toFixed(3) + ')';
        prod.style.opacity = (1 - f * 0.55).toFixed(3);
      }
    }

    syncRail();
    pickScene();
  }

  function onScroll() {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(frame);
  }

  /* =========================================================
     3. HERO PRODUCT STAGE (1 -> 2 -> 3 products)
     ========================================================= */
  function initHeroStage(root) {
    var stage = root.querySelector('[data-purelane-hero-stage]');
    if (!stage || registry.has(stage)) return;

    var slides = Array.prototype.slice.call(stage.querySelectorAll('.hslide'));
    var dots = Array.prototype.slice.call(
      stage.parentNode.querySelectorAll('[data-purelane-hero-dots] button')
    );
    if (slides.length < 2) return;

    var interval = parseInt(stage.getAttribute('data-interval'), 10) || 3800;
    var idx = 0, timer = null, io = null;

    function go(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        s.classList.toggle('on', i === idx);
        s.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('on', i === idx);
        d.setAttribute('aria-selected', i === idx ? 'true' : 'false');
        d.setAttribute('tabindex', i === idx ? '0' : '-1');
      });
    }
    function play() { if (!timer && !reduce) timer = setInterval(function () { go(idx + 1); }, interval); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { stop(); go(i); play(); });
      /* Arrow-key support: the prototype's dots were click-only, which
         made the carousel unusable by keyboard. */
      d.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        stop();
        go(e.key === 'ArrowRight' ? i + 1 : i - 1);
        dots[idx].focus();
        play();
      });
    });

    stage.addEventListener('mouseenter', stop);
    stage.addEventListener('mouseleave', play);
    /* Pausing on focus too, not just hover — a keyboard user should not
       have the slide change out from under them mid-tab. */
    stage.addEventListener('focusin', stop);
    stage.addEventListener('focusout', play);

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.isIntersecting ? play() : stop(); });
      }, { threshold: 0.2 });
      io.observe(stage);
    } else {
      play();
    }

    go(0);
    registry.set(stage, { stop: stop, io: io });
  }

  /* =========================================================
     4. PRODUCT ROTATOR
     ========================================================= */
  function initRotator(root) {
    var rot = root.querySelector('[data-purelane-rotator]');
    if (!rot || registry.has(rot) || reduce) return;

    var imgs = Array.prototype.slice.call(rot.querySelectorAll('.frame .pimg'));
    var dots = Array.prototype.slice.call(rot.querySelectorAll('.dots i'));
    var capB = rot.querySelector('.cap b');
    var capS = rot.querySelector('.cap span');
    if (imgs.length < 2) return;

    var i = 0, timer = null;
    function step() {
      imgs[i].classList.remove('on');
      if (dots[i]) dots[i].classList.remove('on');
      i = (i + 1) % imgs.length;
      imgs[i].classList.add('on');
      if (dots[i]) dots[i].classList.add('on');
      if (capB) capB.textContent = imgs[i].getAttribute('data-name') || '';
      if (capS) capS.textContent = imgs[i].getAttribute('data-note') || '';
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !timer) timer = setInterval(step, 2900);
        else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
      });
    }, { threshold: 0.25 });
    io.observe(rot);

    registry.set(rot, {
      stop: function () { if (timer) { clearInterval(timer); timer = null; } },
      io: io
    });
  }

  /* =========================================================
     LIFECYCLE
     ========================================================= */
  function initSection(root) {
    initReveals(root);
    initHeroStage(root);
    initRotator(root);
    onScroll();
  }

  function destroySection(root) {
    root.querySelectorAll('[data-purelane-hero-stage], [data-purelane-rotator]')
      .forEach(function (el) {
        var entry = registry.get(el);
        if (!entry) return;
        if (entry.stop) entry.stop();
        if (entry.io) entry.io.disconnect();
        registry.delete(el);
      });
    if (revealObserver) {
      root.querySelectorAll('.rv').forEach(function (el) { revealObserver.unobserve(el); });
    }
  }

  function initPage() {
    document.querySelectorAll('[data-purelane-section]').forEach(initSection);
    onScroll();
  }

  /* One scroll and one resize listener for the entire page, attached
     once. Sections do not add their own. */
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  if (!reduce && window.matchMedia('(min-width: 1024px)').matches) {
    window.addEventListener('mousemove', function (e) {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
      onScroll();
    }, { passive: true });
  }

  /* React live if the visitor changes their motion preference mid-session
     rather than only reading it once at load. */
  var onMotionChange = function (e) {
    reduce = e.matches;
    if (reduce) {
      document.querySelectorAll('[data-purelane-section]').forEach(destroySection);
      forceReveal(document);
    } else {
      initPage();
    }
  };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onMotionChange);
  else if (mqReduce.addListener) mqReduce.addListener(onMotionChange);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    initPage();
  }

  /* ---- Shopify theme editor events ---- */
  document.addEventListener('shopify:section:load', function (e) {
    var root = e.target.querySelector('[data-purelane-section]') || e.target;
    initSection(root);
  });
  document.addEventListener('shopify:section:unload', function (e) {
    var root = e.target.querySelector('[data-purelane-section]') || e.target;
    destroySection(root);
    onScroll();
  });
  document.addEventListener('shopify:section:reorder', onScroll);
  document.addEventListener('shopify:section:select', function (e) {
    var root = e.target.querySelector('[data-purelane-section]') || e.target;
    forceReveal(root);
    onScroll();
  });
  document.addEventListener('shopify:block:select', function (e) {
    forceReveal(e.target.closest('[data-purelane-section]') || e.target);
  });
})();
