/**
 * Generic Zod body validation middleware.
 * Usage: router.post('/path', validateToken, extractTenantId, validateBody(MySchema), handler)
 */

export default function validateBody(schema) {
  return (req, res, next) => {
    try {
      const result = schema.parse(req.body);
      // Replace body with parsed result (strips unknown keys if schema uses .strict())
      req.body = result;
      next();
    } catch (error) {
      // Zod v4 uses `error.issues`; Zod v3 uses `error.errors`
      const issuesArray = error.issues || error.errors;
      if (issuesArray && Array.isArray(issuesArray)) {
        const issues = issuesArray.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({
          error: 'Validation failed',
          issues,
        });
      }
      return res.status(400).json({ error: 'Invalid request body' });
    }
  };
}
