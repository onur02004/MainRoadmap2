import express from 'express';
import { getHome, getAccount, getLogin } from '../controllers/viewController.js';

const router = express.Router();

router.get('/', getHome);
router.get('/account', getAccount);
router.get('/login', getLogin);

export default router;