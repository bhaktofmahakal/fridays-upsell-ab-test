# Join Fridays — Upsell A/B Test

This repository contains the implementation of a subscription upsell A/B test variation for **Join Fridays**.

## 🔗 Live Links

### Task 1 — Join Fridays Upsell A/B Test
- **Live Sandbox Preview:** [https://bhaktofmahakal.github.io/fridays-upsell-ab-test/](https://bhaktofmahakal.github.io/fridays-upsell-ab-test/)
- **GitHub Repository:** [https://github.com/bhaktofmahakal/fridays-upsell-ab-test](https://github.com/bhaktofmahakal/fridays-upsell-ab-test)

### Task 2 — AMZexpand Landing Page
- **Live Deployment:** [https://a-b-test-lemon.vercel.app/](https://a-b-test-lemon.vercel.app/)

---

## 📋 Objective

Build an interactive upsell modal flow that intercepts plan selections during checkout to encourage users to upgrade their subscription tier:
1. **Medication Only** $\rightarrow$ Upsell to **Monthly Auto-Refill** (Save $130)
2. **Monthly Auto-Refill** $\rightarrow$ Upsell to **3-Month Supply** (Save $471)

The implementation must be highly reliable, function within a Single Page Application (SPA) without breaking default framework behavior (React/Radix UI), and match the styling specifications of the Figma design.

---

## 🛠️ Key Technical Features

- **Capture Phase Click Delegation:** Global event listener attached to `document` in the capture phase. Intercepts clicks and stops propagation before the SPA framework's bubble-phase event handlers run, ensuring stable event blocking.
- **Dynamic DOM Selection:** Traverses Radix UI radio group structures (`label[data-slot="radio-group-item"]`) automatically, locating the actual radio button element to trigger programmatic state updates.
- **SPA Lifecycle Preservation:** The delegated script persists across navigation changes (back/forward history states) without needing re-injection.
- **Re-trigger Prevention Guard:** Uses a state bypass flag (`suppressNextIntercept`) to ensure programmatic clicks fired during upgrades do not trigger infinite loops or double-popup actions.
- **Figma-Aligned Responsive Layout:** 
  - **Desktop (≥640px):** Centered modal card with scale-up hover animations.
  - **Mobile (<640px):** Modern slide-up bottom sheet layout.
- **CSS Isolation:** Styles are packaged inside a single `<style>` element scoped under unique `fw-upsell-` class prefixes to prevent Tailwind CSS overrides or collision.

---

## 📂 Repository Structure

- `upsell-ab-test.js`: Core vanilla JS script (IIFE) containing config, trigger rules, and modal rendering logic.
- `implementation-notes.md`: Detailed breakdown of triggers, selectors, assumptions, and implementation choices.
- `index.html`: Local sandbox imitating the real checkout page to verify the test logic.

---

## 🧪 How to Test

### Method 1: Using the Live Sandbox Page
1. Navigate to the [Live Sandbox Preview](https://bhaktofmahakal.github.io/fridays-upsell-ab-test/).
2. Select **Medication Only** or **Monthly Auto-Refill**.
3. View the upsell modal popup, test upgrading or declining, and observe simulated state changes in the log panel.

### Method 2: Testing Live on Join Fridays Checkout
1. Open the Fridays checkout flow: [app.joinfridays.com/onboarding/checkout](https://app.joinfridays.com/onboarding/checkout)
2. Open Chrome DevTools Console (`F12` $\rightarrow$ `Console`).
3. Paste the complete contents of [upsell-ab-test.js](upsell-ab-test.js) and press `Enter`.
4. Interact with the plan cards to trigger the respective modal popups.
5. Alternatively, run:
   ```javascript
   __fridaysUpsellTest.simulate("medication-to-monthly");
   ```
