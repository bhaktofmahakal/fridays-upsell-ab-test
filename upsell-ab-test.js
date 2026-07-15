/**
 * Join Fridays — Upsell A/B Test
 * -------------------------------------------------------------
 * Paste this whole file into the DevTools console on
 * https://app.joinfridays.com/onboarding/checkout to test it live.
 *
 * DOM SELECTORS (verified against the live site 2026-07-15):
 *   - Plan options use Radix UI radio group:
 *       <label data-slot="radio-group-item">
 *         <button role="radio" data-testid="price-option-{id}">
 *       </label>
 *   - Continue button: <button data-slot="action">Continue</button>
 *
 * See implementation-notes.md for the reasoning behind every
 * design decision here.
 */
(function upsellABTest() {
  'use strict';

  // Prevent double-injection if this script is pasted twice, or if
  // the SPA's own hot-reload re-executes an injected <script> tag.
  if (window.__fridaysUpsellTest && window.__fridaysUpsellTest.active) {
    console.log('[UpsellTest] Already running — skipping re-init.');
    return;
  }

  // ============================================================
  // 1. CONFIG — the only section you should need to edit per-site
  // ============================================================
  const CONFIG = {
    // Only intercept clicks while the URL contains this substring.
    checkoutPathMatch: '/onboarding',

    // Radix UI wraps each plan option in a <label> with this
    // data-slot. Used as a fallback container selector for text
    // matching when data-testid selectors don't match.
    optionContainerSelector: 'label[data-slot="radio-group-item"]',

    rules: [
      {
        id: 'medication-to-monthly',
        // "Medication Only" — data-testid="price-option-211"
        triggerSelector: '[data-testid="price-option-211"]',
        triggerText: 'Medication Only',
        upgrade: {
          // "Monthly Auto-Refill" — data-testid="price-option-3"
          targetSelector: '[data-testid="price-option-3"]',
          targetText: 'Monthly Auto-Refill',
          label: 'Monthly Auto-Refill',
          description: 'Compounded Tirzepatide (GLP-1/GIP)',
          price: '$259',
          priceUnit: '/mo',
          originalPrice: '$389',
          savings: 'SAVE $130',
        },
        modal: {
          badge: 'RECOMMENDED PLAN UPGRADE',
          tag: 'Most Popular for New Patients',
          headline: 'Commit to Results & Save $130 Instantly',
          body: 'Avoid treatment gaps. Upgrade to Auto-Refill to guarantee your supply and lock in Member Pricing.',
          benefits: [
            'Lock in Member Pricing',
            'Guaranteed Support',
            'New Supply Every Month',
          ],
          ctaUpgrade: 'UPGRADE MY PLAN',
          ctaDecline: "I'll Stick To The Higher Monthly Rate",
          billingNote: 'Billed every 30 days ($259). Cancel anytime.',
        },
      },
      {
        id: 'monthly-to-threemonth',
        // "Monthly Auto-Refill" — data-testid="price-option-3"
        triggerSelector: '[data-testid="price-option-3"]',
        triggerText: 'Monthly Auto-Refill',
        upgrade: {
          // "3 Month Supply" — data-testid="price-option-231"
          targetSelector: '[data-testid="price-option-231"]',
          targetText: '3 Month Supply',
          label: '3-Month Supply',
          description: 'Compounded Tirzepatide (GLP-1/GIP)',
          price: '$232',
          priceUnit: '/mo',
          originalPrice: '$389',
          savings: 'SAVE $471',
        },
        modal: {
          badge: 'RECOMMENDED PLAN UPGRADE',
          tag: 'Most Popular for New Patients',
          headline: 'Commit to Results & Save $471 Instantly',
          body: 'Avoid treatment gaps. Upgrade to Auto-Refill to guarantee your supply and lock in Member Pricing.',
          benefits: [
            'Unlimited Provider Visits',
            'Guaranteed Support',
            'New Supply Every Month',
          ],
          ctaUpgrade: 'UPGRADE MY PLAN',
          ctaDecline: "I'll Stick To The Higher Monthly Rate",
          billingNote: 'Billed every 90 days ($696). Cancel anytime.',
        },
      },
    ],

    // After a plan is selected (upgrade OR decline), optionally click
    // a "Continue" button so checkout proceeds automatically.
    // Set to null to skip this step entirely.
    continueButtonSelector: 'button[data-slot="action"]',
  };

  // ============================================================
  // 2. STATE
  // ============================================================
  const state = {
    suppressNextIntercept: false, // true while WE are dispatching a synthetic click
  };

  // ============================================================
  // 3. DOM HELPERS
  // ============================================================
  function isOnCheckoutPath() {
    // Intercept on the real onboarding path OR when running in the test sandbox/preview environment
    return location.pathname.indexOf(CONFIG.checkoutPathMatch) !== -1 ||
           location.pathname.indexOf('fridays-upsell-ab-test') !== -1 ||
           location.hostname === 'localhost' ||
           location.hostname === '127.0.0.1';
  }

  /**
   * Find an element by CSS selector first; if that fails, fall back
   * to text-matching inside option containers.
   */
  function findBySelectorOrText(selector, text) {
    if (selector) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    if (text) return matchByText(text);
    return null;
  }

  /**
   * Fallback finder: walks candidate option elements and returns the
   * first whose visible text contains the needle. This keeps the
   * script working even if data-testid values change.
   */
  function matchByText(text) {
    const candidates = document.querySelectorAll(CONFIG.optionContainerSelector);
    const needle = text.trim().toLowerCase();
    for (const el of candidates) {
      const ownText = (el.textContent || '').trim().toLowerCase();
      if (ownText && ownText.indexOf(needle) !== -1 && ownText.length < needle.length + 120) {
        return el;
      }
    }
    return null;
  }

  /**
   * Given a click target, walk up the DOM looking for a plan option
   * that matches one of the configured trigger rules.
   *
   * The real DOM structure is:
   *   <label data-slot="radio-group-item">
   *     <button role="radio" data-testid="price-option-211">
   *       <span>...</span>
   *     </button>
   *     <div class="grow">...plan text...</div>
   *   </label>
   *
   * A click can land on the button, the span inside it, or the
   * text content div — so we always walk up to the <label> first,
   * then check if the label CONTAINS a matching data-testid button.
   */
  function findTriggerElement(target) {
    // Strategy 1: Check if the click target itself (or an ancestor)
    // matches a trigger selector directly.
    for (const rule of CONFIG.rules) {
      if (rule.triggerSelector) {
        const el = target.closest ? target.closest(rule.triggerSelector) : null;
        if (el) return { rule, el: el.closest(CONFIG.optionContainerSelector) || el };
      }
    }

    // Strategy 2: Walk up to the label container, then check if it
    // contains a matching trigger button inside.
    const label = target.closest ? target.closest(CONFIG.optionContainerSelector) : null;
    if (label) {
      for (const rule of CONFIG.rules) {
        if (rule.triggerSelector) {
          const btn = label.querySelector(rule.triggerSelector);
          if (btn) return { rule, el: label };
        }
      }

      // Strategy 3: Text fallback — match by visible label text.
      for (const rule of CONFIG.rules) {
        const ownText = (label.textContent || '').trim().toLowerCase();
        if (ownText.indexOf(rule.triggerText.toLowerCase()) !== -1) {
          return { rule, el: label };
        }
      }
    }

    return null;
  }

  // ============================================================
  // 4. CLICK INTERCEPTION (capture phase — runs BEFORE the SPA's
  //    own bubble-phase React/Radix handlers, so preventDefault
  //    here reliably blocks the default selection behavior).
  // ============================================================
  function handleDocumentClick(e) {
    if (state.suppressNextIntercept) return; // our own synthetic click — let it through
    if (!isOnCheckoutPath()) return;

    const match = findTriggerElement(e.target);
    if (!match) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openModal(match.rule, match.el);
  }

  // Attached ONCE, on `document`, which is never destroyed by SPA
  // client-side navigation (only the subtree under it re-renders).
  // This is what makes the logic survive leaving and re-entering the
  // checkout step without re-running this script.
  document.addEventListener('click', handleDocumentClick, true);

  // ============================================================
  // 5. PLAN SELECTION
  // ============================================================
  function selectPlanElement(el, logLabel) {
    if (!el) {
      console.warn('[UpsellTest] Could not find target plan element for "' + logLabel + '". Check CONFIG selectors.');
      return;
    }

    // The click target needs to be the <button role="radio"> inside
    // the label, not the label itself, for Radix UI to register the
    // selection change.
    var clickTarget = el;
    if (el.tagName === 'LABEL') {
      var btn = el.querySelector('button[role="radio"]');
      if (btn) clickTarget = btn;
    }

    // Suppress our own interceptor so this synthetic click is treated
    // as a normal selection, not as another upsell trigger.
    state.suppressNextIntercept = true;
    clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    state.suppressNextIntercept = false;

    console.log('[UpsellTest] Plan selected:', logLabel);
    maybeClickContinue();
  }

  function applyUpgrade(rule) {
    closeModal();
    var targetEl = findBySelectorOrText(rule.upgrade.targetSelector, rule.upgrade.targetText);
    // If we got the button itself, walk up to the label for
    // selectPlanElement's label→button logic.
    if (targetEl && targetEl.tagName === 'BUTTON') {
      targetEl = targetEl.closest(CONFIG.optionContainerSelector) || targetEl;
    }
    selectPlanElement(targetEl, rule.triggerText + ' -> ' + rule.upgrade.label + ' (upgraded)');
  }

  function applyDecline(rule, triggerEl) {
    closeModal();
    selectPlanElement(triggerEl, rule.triggerText + ' (kept original)');
  }

  function maybeClickContinue() {
    if (!CONFIG.continueButtonSelector) return;
    // Give the SPA a tick to re-render its selected state before we
    // look for the continue button.
    setTimeout(function () {
      var btn = document.querySelector(CONFIG.continueButtonSelector);
      if (btn) {
        btn.click();
        console.log('[UpsellTest] Clicked continue button.');
      }
    }, 100);
  }

  // ============================================================
  // 6. MODAL — built once, content swapped per rule
  // ============================================================
  function ensureModalDOM() {
    if (document.getElementById('fw-upsell-overlay')) return;
    injectStyles();

    var overlay = document.createElement('div');
    overlay.id = 'fw-upsell-overlay';
    overlay.className = 'fw-upsell-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="fw-upsell-modal" role="dialog" aria-modal="true" aria-labelledby="fw-upsell-headline">' +

        /* Close button */
        '<button class="fw-upsell-close" type="button" aria-label="Close">&times;</button>' +

        /* Badge: "RECOMMENDED PLAN UPGRADE" */
        '<div class="fw-upsell-top-badge" id="fw-upsell-top-badge"></div>' +

        /* Tag: "Most Popular for New Patients" */
        '<div class="fw-upsell-tag" id="fw-upsell-tag">' +
          '<span class="fw-upsell-tag-dot"></span>' +
          '<span id="fw-upsell-tag-text"></span>' +
        '</div>' +

        /* Headline */
        '<h2 class="fw-upsell-headline" id="fw-upsell-headline"></h2>' +

        /* Body */
        '<p class="fw-upsell-body" id="fw-upsell-body"></p>' +

        /* Plan pill tag (e.g. "Monthly Auto-Refill") */
        '<div class="fw-upsell-plan-pill" id="fw-upsell-plan-pill"></div>' +

        /* Product card */
        '<div class="fw-upsell-product">' +
          '<div class="fw-upsell-product-left">' +
            '<div class="fw-upsell-product-img" id="fw-upsell-product-img"></div>' +
          '</div>' +
          '<div class="fw-upsell-product-right">' +
            '<div class="fw-upsell-product-name" id="fw-upsell-product-name"></div>' +
            '<ul class="fw-upsell-benefits" id="fw-upsell-benefits"></ul>' +
          '</div>' +
        '</div>' +

        /* Savings badge + Pricing */
        '<div class="fw-upsell-pricing-row">' +
          '<span class="fw-upsell-savings-badge" id="fw-upsell-savings-badge"></span>' +
          '<span class="fw-upsell-original-price" id="fw-upsell-original-price"></span>' +
          '<span class="fw-upsell-price" id="fw-upsell-price"></span>' +
          '<span class="fw-upsell-price-unit" id="fw-upsell-price-unit"></span>' +
        '</div>' +

        /* Upgrade CTA */
        '<button class="fw-upsell-cta-upgrade" id="fw-upsell-cta-upgrade" type="button"></button>' +

        /* Billing note */
        '<p class="fw-upsell-billing-note" id="fw-upsell-billing-note"></p>' +

        /* Decline */
        '<button class="fw-upsell-cta-decline" id="fw-upsell-cta-decline" type="button"></button>' +

      '</div>';
    document.body.appendChild(overlay);

    // Close handlers
    overlay.querySelector('.fw-upsell-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  var activeRule = null;

  function openModal(rule, triggerEl) {
    ensureModalDOM();
    activeRule = rule;

    var $ = function (id) { return document.getElementById(id); };

    $('fw-upsell-top-badge').textContent = rule.modal.badge;
    $('fw-upsell-tag-text').textContent = rule.modal.tag;
    $('fw-upsell-headline').innerHTML = rule.modal.headline.replace(
      /(\$[\d,]+)/g, '<strong>$1</strong>'
    );
    $('fw-upsell-body').textContent = rule.modal.body;
    $('fw-upsell-plan-pill').textContent = '↻ ' + rule.upgrade.label;
    $('fw-upsell-product-name').textContent = rule.upgrade.label;

    // Product description (e.g. "Compounded Tirzepatide (GLP-1/GIP)")
    var descEl = $('fw-upsell-product-name');
    descEl.innerHTML = '<strong>' + rule.upgrade.label + '</strong>' +
      '<br><span class="fw-upsell-product-desc">' + rule.upgrade.description + '</span>';

    // Benefits
    var benefitsList = $('fw-upsell-benefits');
    benefitsList.innerHTML = '';
    rule.modal.benefits.forEach(function (b) {
      var li = document.createElement('li');
      li.textContent = b;
      benefitsList.appendChild(li);
    });

    // Pricing
    $('fw-upsell-savings-badge').textContent = rule.upgrade.savings;
    $('fw-upsell-original-price').textContent = rule.upgrade.originalPrice;
    $('fw-upsell-price').textContent = rule.upgrade.price;
    $('fw-upsell-price-unit').textContent = rule.upgrade.priceUnit;

    // Billing note
    $('fw-upsell-billing-note').textContent = rule.modal.billingNote;

    // CTA buttons
    var upgradeBtn = $('fw-upsell-cta-upgrade');
    upgradeBtn.textContent = rule.modal.ctaUpgrade;
    upgradeBtn.onclick = function () { applyUpgrade(rule); };

    var declineBtn = $('fw-upsell-cta-decline');
    declineBtn.textContent = rule.modal.ctaDecline;
    declineBtn.onclick = function () { applyDecline(rule, triggerEl); };

    // Show
    var overlay = document.getElementById('fw-upsell-overlay');
    overlay.classList.add('fw-upsell-open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    var overlay = document.getElementById('fw-upsell-overlay');
    if (overlay) {
      overlay.classList.remove('fw-upsell-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    activeRule = null;
  }

  // ============================================================
  // 7. STYLES — scoped under the "fw-upsell-" prefix so nothing
  //    collides with the host site's own Tailwind classes.
  //    Design matches the Figma: dark olive-green CTA, badge
  //    styling, product card with image placeholder, etc.
  // ============================================================
  function injectStyles() {
    if (document.getElementById('fw-upsell-styles')) return;
    var style = document.createElement('style');
    style.id = 'fw-upsell-styles';
    style.textContent = [
      /* ---- Overlay ---- */
      '.fw-upsell-overlay {',
      '  position: fixed;',
      '  inset: 0;',
      '  background: rgba(9, 26, 32, 0.55);',
      '  display: flex;',
      '  align-items: flex-end;',
      '  justify-content: center;',
      '  opacity: 0;',
      '  pointer-events: none;',
      '  transition: opacity 0.25s ease;',
      '  z-index: 2147483000;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
      '}',
      '.fw-upsell-overlay.fw-upsell-open {',
      '  opacity: 1;',
      '  pointer-events: auto;',
      '}',

      /* ---- Modal ---- */
      '.fw-upsell-modal {',
      '  position: relative;',
      '  width: 100%;',
      '  max-width: 440px;',
      '  background: #FFFFFF;',
      '  border-radius: 20px 20px 0 0;',
      '  padding: 28px 24px 24px;',
      '  box-shadow: 0 -8px 40px rgba(9, 26, 32, 0.25);',
      '  transform: translateY(24px);',
      '  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);',
      '  max-height: 90vh;',
      '  overflow-y: auto;',
      '}',
      '.fw-upsell-open .fw-upsell-modal {',
      '  transform: translateY(0);',
      '}',

      /* ---- Close button ---- */
      '.fw-upsell-close {',
      '  position: absolute;',
      '  top: 14px;',
      '  right: 16px;',
      '  border: none;',
      '  background: transparent;',
      '  font-size: 22px;',
      '  line-height: 1;',
      '  color: #9AA6A9;',
      '  cursor: pointer;',
      '  padding: 4px 8px;',
      '  z-index: 2;',
      '}',

      /* ---- Top badge: "RECOMMENDED PLAN UPGRADE" ---- */
      '.fw-upsell-top-badge {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  background: #3D4F27;',
      '  color: #FFFFFF;',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '  letter-spacing: 0.08em;',
      '  text-transform: uppercase;',
      '  padding: 6px 14px;',
      '  border-radius: 999px;',
      '  margin-bottom: 14px;',
      '}',
      '.fw-upsell-top-badge::before {',
      '  content: "✓";',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  width: 16px;',
      '  height: 16px;',
      '  background: rgba(255,255,255,0.2);',
      '  border-radius: 50%;',
      '  font-size: 10px;',
      '}',

      /* ---- Tag: "Most Popular for New Patients" ---- */
      '.fw-upsell-tag {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  background: #FFF8E1;',
      '  border: 1px solid #F5D36E;',
      '  padding: 4px 12px;',
      '  border-radius: 6px;',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  color: #6B4E00;',
      '  margin-bottom: 12px;',
      '}',
      '.fw-upsell-tag-dot {',
      '  width: 6px;',
      '  height: 6px;',
      '  background: #E8A800;',
      '  border-radius: 50%;',
      '}',

      /* ---- Headline ---- */
      '.fw-upsell-headline {',
      '  margin: 0 0 8px;',
      '  font-size: 20px;',
      '  font-weight: 700;',
      '  color: #10262E;',
      '  line-height: 1.3;',
      '}',
      '.fw-upsell-headline strong {',
      '  color: #10262E;',
      '  text-decoration: underline;',
      '  text-decoration-color: #3D4F27;',
      '  text-underline-offset: 2px;',
      '}',

      /* ---- Body text ---- */
      '.fw-upsell-body {',
      '  margin: 0 0 14px;',
      '  font-size: 13px;',
      '  color: #55686D;',
      '  line-height: 1.55;',
      '}',

      /* ---- Plan pill (e.g. "↻ Monthly Auto-Refill") ---- */
      '.fw-upsell-plan-pill {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '  background: #3D4F27;',
      '  color: #fff;',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  padding: 5px 14px;',
      '  border-radius: 999px;',
      '  margin-bottom: 14px;',
      '}',

      /* ---- Product card ---- */
      '.fw-upsell-product {',
      '  display: flex;',
      '  gap: 14px;',
      '  border: 1px solid #E3E9EA;',
      '  border-radius: 14px;',
      '  padding: 14px;',
      '  margin-bottom: 14px;',
      '  background: #FAFBFB;',
      '}',
      '.fw-upsell-product-left {',
      '  flex-shrink: 0;',
      '}',
      '.fw-upsell-product-img {',
      '  width: 56px;',
      '  height: 64px;',
      '  background: linear-gradient(135deg, #2C3A3E 0%, #1A2528 100%);',
      '  border-radius: 8px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '}',
      '.fw-upsell-product-img::after {',
      '  content: "💊";',
      '  font-size: 24px;',
      '}',
      '.fw-upsell-product-right { flex: 1; min-width: 0; }',
      '.fw-upsell-product-name {',
      '  font-size: 14px;',
      '  font-weight: 700;',
      '  color: #10262E;',
      '  margin-bottom: 6px;',
      '  line-height: 1.3;',
      '}',
      '.fw-upsell-product-desc {',
      '  font-weight: 400;',
      '  font-size: 12px;',
      '  color: #55686D;',
      '}',

      /* ---- Benefits list ---- */
      '.fw-upsell-benefits {',
      '  margin: 0;',
      '  padding: 0;',
      '  list-style: none;',
      '}',
      '.fw-upsell-benefits li {',
      '  font-size: 12px;',
      '  color: #3A4D52;',
      '  padding-left: 18px;',
      '  position: relative;',
      '  margin-bottom: 4px;',
      '  line-height: 1.4;',
      '}',
      '.fw-upsell-benefits li:last-child { margin-bottom: 0; }',
      '.fw-upsell-benefits li::before {',
      '  content: "✓";',
      '  position: absolute;',
      '  left: 0;',
      '  color: #3D4F27;',
      '  font-weight: 700;',
      '  font-size: 11px;',
      '}',

      /* ---- Pricing row ---- */
      '.fw-upsell-pricing-row {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  margin-bottom: 14px;',
      '  flex-wrap: wrap;',
      '}',
      '.fw-upsell-savings-badge {',
      '  background: #3D4F27;',
      '  color: #FFFFFF;',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '  letter-spacing: 0.02em;',
      '  padding: 4px 10px;',
      '  border-radius: 4px;',
      '}',
      '.fw-upsell-original-price {',
      '  font-size: 14px;',
      '  color: #9AA6A9;',
      '  text-decoration: line-through;',
      '}',
      '.fw-upsell-price {',
      '  font-size: 28px;',
      '  font-weight: 800;',
      '  color: #10262E;',
      '}',
      '.fw-upsell-price-unit {',
      '  font-size: 14px;',
      '  font-weight: 600;',
      '  color: #55686D;',
      '  align-self: flex-end;',
      '  margin-bottom: 4px;',
      '}',

      /* ---- Upgrade CTA (dark olive-green per Figma) ---- */
      '.fw-upsell-cta-upgrade {',
      '  width: 100%;',
      '  border: none;',
      '  background: #3D4F27;',
      '  color: #FFFFFF;',
      '  font-size: 15px;',
      '  font-weight: 700;',
      '  letter-spacing: 0.04em;',
      '  padding: 15px;',
      '  border-radius: 10px;',
      '  cursor: pointer;',
      '  margin-bottom: 8px;',
      '  transition: background 0.15s ease, transform 0.1s ease;',
      '  text-transform: uppercase;',
      '}',
      '.fw-upsell-cta-upgrade:hover { background: #2E3D1C; }',
      '.fw-upsell-cta-upgrade:active { transform: scale(0.99); }',

      /* ---- Billing note ---- */
      '.fw-upsell-billing-note {',
      '  text-align: center;',
      '  font-size: 11px;',
      '  color: #9AA6A9;',
      '  margin: 0 0 6px;',
      '}',

      /* ---- Decline link ---- */
      '.fw-upsell-cta-decline {',
      '  width: 100%;',
      '  border: none;',
      '  background: transparent;',
      '  color: #55686D;',
      '  font-size: 13px;',
      '  font-weight: 500;',
      '  padding: 10px;',
      '  cursor: pointer;',
      '  text-decoration: underline;',
      '  text-underline-offset: 2px;',
      '}',
      '.fw-upsell-cta-decline:hover { color: #3A4D52; }',

      /* ---- Desktop: centered card instead of bottom sheet ---- */
      '@media (min-width: 640px) {',
      '  .fw-upsell-overlay { align-items: center; }',
      '  .fw-upsell-modal {',
      '    border-radius: 20px;',
      '    max-width: 460px;',
      '    transform: translateY(12px) scale(0.98);',
      '  }',
      '  .fw-upsell-open .fw-upsell-modal { transform: translateY(0) scale(1); }',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ============================================================
  // 8. SPA-navigation awareness (debug/logging aid — the click
  //    delegation above already survives navigation on its own,
  //    this just gives visibility into route changes in console).
  // ============================================================
  (function patchHistory() {
    ['pushState', 'replaceState'].forEach(function (method) {
      var original = history[method];
      if (original.__upsellPatched) return; // don't double-patch
      history[method] = function () {
        var result = original.apply(this, arguments);
        console.log('[UpsellTest] Route changed ->', location.pathname);
        return result;
      };
      history[method].__upsellPatched = true;
    });
    window.addEventListener('popstate', function () {
      console.log('[UpsellTest] Route changed (back/forward) ->', location.pathname);
    });
  })();

  // ============================================================
  // 9. PUBLIC DEBUG API — for testing from the console per the
  //    assignment's requirement.
  // ============================================================
  window.__fridaysUpsellTest = {
    active: true,
    config: CONFIG,
    /**
     * Force-open the modal without needing to click a real plan option.
     * Usage: __fridaysUpsellTest.simulate('medication-to-monthly')
     *        __fridaysUpsellTest.simulate('monthly-to-threemonth')
     */
    simulate: function (ruleId) {
      var rule = CONFIG.rules.filter(function (r) { return r.id === ruleId; })[0];
      if (!rule) {
        console.warn('[UpsellTest] Unknown rule id. Available:', CONFIG.rules.map(function (r) { return r.id; }));
        return;
      }
      var triggerEl = findBySelectorOrText(rule.triggerSelector, rule.triggerText);
      openModal(rule, triggerEl);
    },
    close: closeModal,
  };

  console.log('[UpsellTest] ✅ Initialized. Rules:', CONFIG.rules.map(function (r) { return r.id; }).join(', '));
  console.log('[UpsellTest] Try: __fridaysUpsellTest.simulate("medication-to-monthly")');
})();
