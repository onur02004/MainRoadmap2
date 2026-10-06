import * as userService from '../services/userService.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import logger from '../utils/logger.js';


export const register = async (req, res) => {
  try {
    const { user_name, email, password, real_name, relation } = req.body;

    // Check if user exists
    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const newUser = await userService.createUser({
      user_name, email, password, real_name, relation
    });

    // Generate Token
    const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    logger.info(`REGISTER`, `User registered: ${newUser.email}`);
    res.status(201).json({
      status: 'success',
      data: { user: newUser, token }
    });
  } catch (error) {
    logger.error(`REGISTER`, 'error registering user', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await userService.findUserByIdentifier(identifier);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    logger.info(`LOGIN`, `User logged in: ${user.user_name}`);
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({ status: 'success', data: { token } });
  } catch (error) {
    logger.warn(`LOGIN`, 'error login user', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
