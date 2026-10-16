// backend/middleware/asyncHandler.js
//
// A shared wrapper for any async route handler function.
// Without this wrapper, any exception thrown inside an async function
// (such as a PostgreSQL connection error) is not automatically caught by
// Express 4, and turns into an Unhandled Promise Rejection instead of
// reaching the central error handler -- this can drop the request with no
// clear response to the user, or in the worst case crash the whole server
// process.
//
// Usage:
//   router.post('/payments', asyncHandler(paymentController.createPayment));
//
// This way, any error inside createPayment is automatically passed to
// next(err), which the central error handler in server.js catches and
// turns into a consistent response for the user.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
