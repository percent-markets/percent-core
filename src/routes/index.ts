import { Router } from 'express';
import proposalRoutes from './proposals';
import analyticsRoutes from './analytics';
import twapRoutes from './twap';
import vaultRoutes from './vaults';
import swapRoutes from './swap';
import historyRoutes from './history';
import networkRoutes from './network';
import poolRoutes from './pools';
import routerRoutes from './router';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

router.use('/proposals', proposalRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/twap', twapRoutes);
router.use('/vaults', vaultRoutes);
router.use('/swap', swapRoutes);
router.use('/history', historyRoutes);
router.use('/network', networkRoutes);
router.use('/pools', poolRoutes);
router.use('/router', routerRoutes);

export default router;