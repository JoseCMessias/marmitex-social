import express from 'express';
import {
  createAdminToken,
  getAdminConfig,
  requireAdminAuth,
  verifyAdminCredentials,
} from '../auth/adminAuth.js';

export const adminRouter = express.Router();

adminRouter.post('/login', (req, res) => {
  const rawUsername = req.body?.username ?? req.body?.login;
  const rawPassword = req.body?.password;

  if (!String(rawUsername ?? '').trim() || !String(rawPassword ?? '')) {
    return res.status(400).json({ error: 'Informe o login e a senha de acesso.' });
  }

  if (!verifyAdminCredentials(rawUsername, rawPassword)) {
    return res.status(401).json({ error: 'Login ou senha inválidos.' });
  }

  const { username } = getAdminConfig();
  const session = createAdminToken(username);
  return res.json({
    ...session,
    message: 'Login administrativo realizado com sucesso.',
  });
});

adminRouter.get('/session', requireAdminAuth, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      username: req.admin.username,
      role: req.admin.role,
    },
    expiresAt: new Date(req.admin.exp).toISOString(),
  });
});

adminRouter.post('/logout', (_req, res) => {
  res.json({ ok: true, message: 'Sessão administrativa encerrada.' });
});
