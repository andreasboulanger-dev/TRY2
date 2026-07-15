(() => {
  "use strict";

  const titles = {
    home: "Home",
    search: "Search",
    library: "Library",
    profile: "Profile",
    compose: "New",
  };

  const tabItems = document.querySelectorAll(".tab-item");
  const tabGroup = document.querySelector(".tab-group");

  // A tap on a grouped tab fires both the drag handlers below (pointerup ->
  // endDrag -> selectTab) AND the item's own "click" listener a moment
  // later, since a tap is a tiny drag. Both used to call selectTab(),
  // which was harmless but wasteful and would double-fire anything added
  // later (haptics, analytics, sounds). This flag lets endDrag mark that
  // it already handled the selection so the following click is a no-op.
  let suppressNextClick = false;
  const screens = document.querySelectorAll(".screen");
  const pageTitle = document.getElementById("pageTitle");
  const content = document.getElementById("content");
  const indicator = document.getElementById("tabIndicator");

  // Slide the Liquid Glass morph pill behind whichever grouped tab is
  // active. Only the 4 grouped tabs share the indicator — the detached
  // 5th action has its own capsule and doesn't participate.
  function moveIndicator(target) {
    if (!indicator || !target || !target.closest(".tab-group")) return;
    const group = target.parentElement;
    const groupRect = group.getBoundingClientRect();
    const itemRect = target.getBoundingClientRect();
    indicator.style.width = `${itemRect.width}px`;
    indicator.style.transform = `translateX(${itemRect.left - groupRect.left - 4}px)`;
  }

  function selectTab(name) {
    let target = null;
    tabItems.forEach((item) => {
      const active = item.dataset.tab === name;
      item.setAttribute("aria-selected", String(active));
      if (active) target = item;
    });

    screens.forEach((screen) => {
      screen.hidden = screen.dataset.screen !== name;
    });

    if (pageTitle && titles[name]) {
      pageTitle.textContent = titles[name];
    }

    if (target && target.closest(".tab-group")) {
      moveIndicator(target);
    }

    // Reset scroll position when switching tabs, like native tab bars do
    content.scrollTo({ top: 0, behavior: "auto" });
  }

  tabItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      selectTab(item.dataset.tab);
    });
  });

  // --- Drag-to-select across the grouped tabs ---
  // Mirrors iOS segmented-control behavior: press anywhere in the glass
  // capsule, drag, and the pill follows your finger continuously; lifting
  // commits whichever tab you're over.
  //
  // The earlier version called getBoundingClientRect() on every
  // pointermove (forces layout) and left the CSS spring transition
  // active while dragging, so each move re-triggered an animation that
  // hadn't finished — overlapping transitions is what made it feel
  // laggy/stuttery instead of tracking the finger. Fixed by caching
  // rects once at drag start, turning the transition off entirely
  // during the drag, and batching updates to one per animation frame.
  if (tabGroup) {
    let dragging = false;
    let rafId = null;
    let pendingX = null;
    let cachedItems = []; // [{ item, center, left, width }]
    let cachedGroupLeft = 0;
    let cachedGroupWidth = 0;

    const groupTabs = () => Array.from(tabGroup.querySelectorAll(".tab-item"));

    function cacheLayout() {
      const groupRect = tabGroup.getBoundingClientRect();
      cachedGroupLeft = groupRect.left;
      cachedGroupWidth = groupRect.width;
      cachedItems = groupTabs().map((item) => {
        const rect = item.getBoundingClientRect();
        return {
          item,
          left: rect.left - groupRect.left,
          width: rect.width,
          center: rect.left - groupRect.left + rect.width / 2,
        };
      });
    }

    function nearestCached(x) {
      let closest = cachedItems[0];
      let minDist = Infinity;
      cachedItems.forEach((entry) => {
        const dist = Math.abs(x - entry.center);
        if (dist < minDist) {
          minDist = dist;
          closest = entry;
        }
      });
      return closest;
    }

    function paintIndicatorAt(clientX) {
      if (!indicator || cachedItems.length === 0) return;
      // Indicator follows the pointer continuously (clamped to the
      // group's bounds) rather than jumping discretely between the 4
      // fixed tab slots — that continuous motion is what reads as smooth.
      const nearest = nearestCached(clientX - cachedGroupLeft);
      const halfWidth = nearest.width / 2;
      const rawCenter = clientX - cachedGroupLeft;
      const clampedCenter = Math.min(
        Math.max(rawCenter, halfWidth + 4),
        cachedGroupWidth - halfWidth - 4
      );
      indicator.style.width = `${nearest.width}px`;
      indicator.style.transform = `translateX(${clampedCenter - halfWidth - 4}px)`;
      return nearest;
    }

    function scheduleFrame() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pendingX !== null) paintIndicatorAt(pendingX);
      });
    }

    function beginDrag(e) {
      dragging = true;
      tabGroup.setPointerCapture(e.pointerId);
      cacheLayout();
      if (indicator) indicator.style.transition = "none"; // instant tracking, no fighting with the spring
      pendingX = e.clientX;
      paintIndicatorAt(e.clientX);
    }

    function trackDrag(e) {
      if (!dragging) return;
      pendingX = e.clientX;
      scheduleFrame();
    }

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      pendingX = null;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      const nearest = nearestCached(e.clientX - cachedGroupLeft);
      if (indicator) indicator.style.transition = ""; // restore the CSS spring for the settle
      if (nearest) {
        suppressNextClick = true;
        selectTab(nearest.item.dataset.tab);
      }
    }

    tabGroup.addEventListener("pointerdown", beginDrag);
    tabGroup.addEventListener("pointermove", trackDrag);
    tabGroup.addEventListener("pointerup", endDrag);
    tabGroup.addEventListener("pointercancel", endDrag);
  }

  // Keep the pill aligned to the active tab on resize/orientation change
  window.addEventListener("resize", () => {
    const active = document.querySelector(".tab-group .tab-item[aria-selected='true']");
    if (active) moveIndicator(active);
  });

  // Position the pill once fonts/layout settle on first paint
  window.addEventListener("load", () => {
    const active = document.querySelector(".tab-group .tab-item[aria-selected='true']");
    if (active) moveIndicator(active);
  });

  // --- Diagnostics shown on the Home screen ---
  const standaloneValue = document.getElementById("standaloneValue");
  const swValue = document.getElementById("swValue");
  const safeTopValue = document.getElementById("safeTopValue");
  const safeBottomValue = document.getElementById("safeBottomValue");
  const screenSizeValue = document.getElementById("screenSizeValue");
  const innerSizeValue = document.getElementById("innerSizeValue");
  const visualVpValue = document.getElementById("visualVpValue");
  const htmlRectValue = document.getElementById("htmlRectValue");
  const appRectValue = document.getElementById("appRectValue");
  const dprValue = document.getElementById("dprValue");

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  if (standaloneValue) {
    standaloneValue.textContent = isStandalone() ? "Yes" : "No (browser tab)";
  }

  if (safeTopValue && safeBottomValue) {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;visibility:hidden;" +
      "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    safeTopValue.textContent = cs.paddingTop || "0px";
    safeBottomValue.textContent = cs.paddingBottom || "0px";
    probe.remove();
  }

  // These four numbers are the ones that actually distinguish "the
  // WKWebView frame iOS handed us is smaller than the physical screen"
  // (screenSize > innerSize, and appRect is short even though its CSS
  // says min-height: 100dvh) from "the frame is full size but something
  // in our own layout isn't filling it" (screenSize === innerSize, but
  // appRect is still short). Re-measure on resize so orientation/rotation
  // and any late-arriving safe-area updates are reflected too.
  function updateSizeDiagnostics() {
    if (screenSizeValue) {
      screenSizeValue.textContent = `${window.screen.width} × ${window.screen.height}`;
    }
    if (innerSizeValue) {
      innerSizeValue.textContent = `${window.innerWidth} × ${window.innerHeight}`;
    }
    if (visualVpValue) {
      visualVpValue.textContent = window.visualViewport
        ? `${Math.round(window.visualViewport.width)} × ${Math.round(window.visualViewport.height)} (offset ${Math.round(window.visualViewport.offsetTop)})`
        : "Unsupported";
    }
    if (htmlRectValue) {
      const r = document.documentElement.getBoundingClientRect();
      htmlRectValue.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
    }
    if (appRectValue) {
      const appEl = document.getElementById("app");
      if (appEl) {
        const r = appEl.getBoundingClientRect();
        appRectValue.textContent = `${Math.round(r.width)} × ${Math.round(r.height)} (top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)})`;
      }
    }
    if (dprValue) {
      dprValue.textContent = String(window.devicePixelRatio);
    }
  }

  updateSizeDiagnostics();
  window.addEventListener("resize", updateSizeDiagnostics);
  window.addEventListener("orientationchange", updateSizeDiagnostics);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateSizeDiagnostics);
  }

  // --- Disable pinch-zoom / double-tap-zoom ---
  // The viewport meta (maximum-scale=1, user-scalable=no) and the CSS
  // touch-action rules handle most of this, but Safari also fires its own
  // non-standard gesturestart/gesturechange/gestureend events for pinch
  // gestures — those aren't governed by touch-action at all, so block them
  // directly. document-level, not window, since that's what Safari targets.
  ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    document.addEventListener(type, (e) => e.preventDefault());
  });

  // Backstop for double-tap-to-zoom: if two touchend events land inside
  // iOS's ~300ms double-tap window, swallow the second one.
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );

  // --- Service worker registration (app-shell caching for offline + installability) ---
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js")
        .then(() => {
          if (swValue) swValue.textContent = "Registered";
        })
        .catch(() => {
          if (swValue) swValue.textContent = "Failed to register";
        });
    });
  } else if (swValue) {
    swValue.textContent = "Unsupported";
  }
})();
