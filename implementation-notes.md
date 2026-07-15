# Implementation Notes — Upsell A/B Test (Join Fridays)

## How the popup is triggered

- A single `click` listener is attached to `document` in the **capture
  phase** (`addEventListener('click', handler, true)`). Capture phase
  runs before the SPA framework's own bubble-phase Radix/React handlers,
  so `preventDefault()` / `stopImmediatePropagation()` reliably blocks
  the plan option's default selection before React sees the click.
- The listener checks the click target against each configured rule's
  `triggerSelector` using a three-strategy approach:
  1. **Direct match**: `e.target.closest(triggerSelector)` — catches
     clicks directly on the `<button data-testid="price-option-*">`.
  2. **Container match**: Walk up to the parent
     `<label data-slot="radio-group-item">`, then check if it
     *contains* a matching trigger button — catches clicks on the
     plan text, price, or other children of the label.
  3. **Text fallback**: If no selector matches, match by the visible
     text of the nearest option container — safety net if `data-testid`
     values change in the future.
- The modal only fires when the current URL contains `/onboarding`
  (the checkout flow).

## Real DOM structure (verified 2026-07-15)

The checkout page at `/onboarding/checkout` uses Radix UI radio groups:

```html
<label data-slot="radio-group-item">
  <button role="radio" data-slot="radio-group-indicator"
          data-testid="price-option-211">   <!-- Medication Only -->
  </button>
  <div class="grow">
    <!-- Plan name, description, pricing text -->
  </div>
</label>
```

| Plan               | `data-testid`          |
| ------------------- | ---------------------- |
| Medication Only     | `price-option-211`     |
| Monthly Auto-Refill | `price-option-3`       |
| 3 Month Supply      | `price-option-231`     |
| 6 Month Supply      | `price-option-232`     |
| 12 Month Supply     | `price-option-233`     |

Continue button: `<button data-slot="action">Continue</button>`

## Why this survives SPA back/forward navigation without re-running the script

The listener is attached **once**, to `document`, which is never
destroyed by client-side (soft) navigation — only the subtree under it
re-renders. So leaving the checkout step and coming back doesn't
require re-injecting the script or re-attaching listeners; the
delegated listener is still there and simply starts matching again
once the plan option elements re-render into the DOM. A route-change
logger (via monkey-patched `history.pushState`/`replaceState` +
`popstate`) is included only for visibility in the console while
testing, not because it's required for the interception to keep
working.

An `active` flag on `window.__fridaysUpsellTest` guards against
double-injection if the script is pasted into the console more than
once, which would otherwise register duplicate listeners and open the
modal twice per click.

## How plan selection is handled

- **Upgrade CTA** → closes the modal, resolves the upgrade target
  element (by `data-testid` selector with text fallback), walks up to
  the parent `<label>` to find the `<button role="radio">` inside it,
  and dispatches a **synthetic `click` event** on that button so Radix
  UI's own selection logic runs exactly as if the user had clicked it
  themselves. Optionally clicks the Continue button afterward.
- **Decline option** → closes the modal and dispatches the same
  synthetic click, but on the *original* trigger element, so the plan
  the user originally clicked ends up selected. Also optionally clicks
  Continue.
- **Guarding against re-triggering the interceptor**: `price-option-3`
  (Monthly Auto-Refill) is both the *upgrade target* of rule 1 and
  the *trigger* of rule 2. Without a guard, programmatically selecting
  it after an upgrade would immediately reopen the second modal. A
  `suppressNextIntercept` flag is set synchronously right before the
  synthetic dispatch and cleared right after, so the click-interceptor
  ignores clicks that originate from our own code and only ever reacts
  to genuine user clicks.

## Design decisions

- **Figma-matching UI**: The modal uses a dark olive-green primary
  color (`#3D4F27`) matching the Figma design, with a "RECOMMENDED
  PLAN UPGRADE" top badge, "Most Popular for New Patients" tag,
  product card with benefits, savings badge, and pricing display.
- **Mobile bottom sheet → desktop centered modal**: On screens
  < 640px, the modal slides up from the bottom as a bottom sheet
  (rounded top corners). On desktop, it appears as a centered card
  with fully rounded corners and a subtle scale animation.
- **CSS scoping**: All styles use the `fw-upsell-` prefix and are
  injected as a single `<style>` tag to avoid collisions with the
  host site's own Tailwind/Radix CSS.

## Assumptions made

1. The plan option `data-testid` values (`price-option-211`,
   `price-option-3`, `price-option-231`) were verified on the live
   site on 2026-07-15. If the site changes these IDs, the text-
   matching fallback will still find the correct elements.
2. "Continue the checkout flow" is implemented as a click on the
   `button[data-slot="action"]` Continue button after a 100ms delay,
   giving the SPA time to re-render the selection state.
3. Content (headlines, prices, savings amounts, benefit copy) is
   written to match the live site's pricing as closely as possible
   but can be freely changed per the assignment requirements.
4. The popup uses a bottom-sheet layout on mobile (<640px) and a
   centered modal on desktop, matching the provided Figma designs.

## How to test in console

1. Open `https://app.joinfridays.com/onboarding/main-info` in Chrome.
2. Complete the onboarding steps to reach `/onboarding/checkout`.
3. Open DevTools → Console, paste the full contents of
   `upsell-ab-test.js`, press Enter.
4. Click **"Medication Only"** → the upsell modal should appear
   offering to upgrade to Monthly Auto-Refill.
5. Click **"UPGRADE MY PLAN"** → Monthly Auto-Refill should be
   selected and checkout continues.
6. Or simulate directly without clicking a plan:
   `__fridaysUpsellTest.simulate("medication-to-monthly")`
   `__fridaysUpsellTest.simulate("monthly-to-threemonth")`
7. Navigate away (click Back) and return to checkout — the modal
   should still trigger without re-pasting the script.
