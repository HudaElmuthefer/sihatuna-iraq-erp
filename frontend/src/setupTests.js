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
