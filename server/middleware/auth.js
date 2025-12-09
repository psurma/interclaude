/**
 * API Key Authentication Middleware
 *
 * If API_KEY is configured in environment, validates X-API-Key header.
 * If API_KEY is not set, allows all requests (development mode).
 */
export function authenticate(req, res, next) {
  const expectedKey = process.env.API_KEY;

  // No API key configured - allow all requests (dev mode)
  if (!expectedKey) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing API key. Provide X-API-Key header.',
      timestamp: new Date().toISOString()
    });
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      timestamp: new Date().toISOString()
    });
  }

  next();
}
