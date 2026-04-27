import { Router } from 'express';
import { services } from '../config/services.js';

const router = Router();

/**
 * GET /health
 * Returns gateway status and the upstream service registry.
 */
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    upstreams: Object.entries(services).map(([name, cfg]) => ({
      name,
      url: cfg.url,
      prefix: cfg.prefix,
    })),
  });
});

export default router;
