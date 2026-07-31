// frontend/src/setupTests.js
//
// Loaded automatically by react-scripts (CRA) before every test file — no
// extra Jest config needed. jest-dom adds custom matchers used across
// component tests (toBeInTheDocument, toHaveValue, etc.).
//
// How to add a new component test:
//   1. Create ComponentName.test.js next to the component (or the page it
//      lives in) — react-scripts picks up any *.test.js automatically.
//   2. Render with React Testing Library:
//        import { render, screen } from '@testing-library/react';
//        import userEvent from '@testing-library/user-event';
//        render(<ComponentName {...props} />);
//   3. Query by what a real user would see (screen.getByRole/getByLabelText/
//      getByPlaceholderText) rather than test IDs or implementation details.
//   4. For interactions, use `userEvent.setup()` once per test, then
//      `await user.click(...)` / `await user.type(...)` (v14 API — every
//      interaction is async).
//   5. Pages that read from AppContext (useApp()) need a wrapper provider or
//      a mock of '../contexts/AppContext' — see existing page tests for the
//      pattern once one exists; don't reach into component internals to
//      avoid that setup.
// Keep these tests focused on user-visible behavior (what renders, what a
// click/keystroke produces) — not on internal state or implementation
// details, which change more often than behavior does.
import '@testing-library/jest-dom';

// react-router-dom v7 references TextEncoder/TextDecoder at module-load
// time (Web APIs available in real browsers and modern Node, but not
// polyfilled by jsdom's test environment as configured by react-scripts 5,
// which predates react-router v7). Node's own `util` module already
// implements both — this just exposes them as globals before any test
// file's imports run.
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
