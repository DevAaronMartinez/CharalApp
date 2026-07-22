const { Router } = require('express');
const store = require('../store');

const router = Router();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const userId = store.getUserIdFromToken(header.slice(7));
  if (!userId) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  req.userId = userId;
  next();
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const userId = store.getUserIdFromToken(header.slice(7));
    if (userId) req.userId = userId;
  }
  next();
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'comunidad-salud-api',
    storage: store.useDynamo() ? 'dynamodb' : 'memory',
  });
});

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    const result = await store.login(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    res.json(result);
  })
);

router.post(
  '/auth/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, conditionIds, latitude, longitude, city, bio } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
    }
    const result = await store.register({
      name,
      email,
      password,
      conditionIds,
      latitude,
      longitude,
      city,
      bio,
    });
    if (result.error) {
      return res.status(409).json({ error: result.error });
    }
    res.status(201).json(result);
  })
);

router.get(
  '/auth/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await store.getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  })
);

router.post('/auth/logout', authMiddleware, (_req, res) => {
  store.logout();
  res.json({ message: 'Sesión cerrada' });
});

router.get('/conditions', (_req, res) => {
  res.json(store.getConditions());
});

router.get('/conditions/:id/recommendations', (req, res) => {
  const data = store.getRecommendations(req.params.id);
  if (!data) return res.status(404).json({ error: 'Condición no encontrada' });
  res.json(data);
});

router.get('/services', (req, res) => {
  res.json(store.getServices({ conditionId: req.query.conditionId }));
});

router.get('/medications/identify', optionalAuth, (req, res) => {
  const { barcode, q, conditionId } = req.query;
  if (!barcode && !q && !conditionId) {
    return res.json(store.identifyMedications());
  }
  res.json(
    store.identifyMedications({
      barcode: barcode ? String(barcode) : undefined,
      query: q ? String(q) : undefined,
      conditionId: conditionId ? String(conditionId) : undefined,
    })
  );
});

router.post('/medications/identify-ocr', optionalAuth, (req, res) => {
  const { text, conditionId } = req.body ?? {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Texto del envase requerido' });
  }
  res.json(
    store.identifyFromOcrText(String(text), conditionId ? String(conditionId) : undefined)
  );
});

router.post(
  '/medications/identify-image',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { imageBase64, conditionId } = req.body ?? {};
    if (!imageBase64 || !String(imageBase64).trim()) {
      return res.status(400).json({ error: 'Imagen requerida (base64)' });
    }
    const raw = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');
    res.json(
      await store.identifyFromImageBase64(
        raw,
        conditionId ? String(conditionId) : undefined
      )
    );
  })
);

router.post(
  '/health/evidence/detect',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { type, imageBase64, ocrText } = req.body ?? {};
    const result = await store.detectEvidence({ type, imageBase64, ocrText });
    if (result.error) {
      return res.status(422).json(result);
    }
    res.json(result);
  })
);

router.post(
  '/health/evidence/evaluate',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { type, imageBase64, manual, ocrText } = req.body ?? {};
    const result = await store.evaluateEvidence({ type, imageBase64, manual, ocrText });
    if (result.error) {
      return res.status(422).json(result);
    }
    res.json(result);
  })
);

router.get(
  '/users',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json(
      await store.getUsers({
        conditionId: req.query.conditionId,
        needsHelp: req.query.needsHelp,
      })
    );
  })
);

router.get(
  '/users/clusters',
  asyncHandler(async (req, res) => {
    res.json(await store.getClusters({ conditionId: req.query.conditionId }));
  })
);

router.patch(
  '/users/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await store.updateUserById(req.userId, req.body);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  })
);

router.get(
  '/posts',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json(await store.getPosts({ conditionId: req.query.conditionId }));
  })
);

router.post(
  '/posts',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { conditionId, title, content, tags } = req.body;
    if (!conditionId || !title || !content) {
      return res.status(400).json({ error: 'conditionId, title y content son requeridos' });
    }
    const post = await store.createPost(req.userId, { conditionId, title, content, tags });
    if (!post) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.status(201).json(post);
  })
);

router.post(
  '/posts/:id/like',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const post = await store.likePost(req.params.id);
    if (!post) return res.status(404).json({ error: 'Publicación no encontrada' });
    res.json(post);
  })
);

module.exports = router;
