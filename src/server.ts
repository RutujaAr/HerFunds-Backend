import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import pool from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 🔑 INITIALIZE GOOGLE AUTH CLIENT
const GOOGLE_CLIENT_ID = "1058256639702-ui0bbo682f3itque8029bf8qcrdbdnc1.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// 📝 1. MANUAL USER REGISTRATION ENDPOINT
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, knowledgeLevel } = req.body;

  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      'INSERT INTO users (name, email, password, knowledge_level) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [name, email, hashedPassword, knowledgeLevel || 'Beginner']
    );

    const token = jwt.sign({ id: newUser.rows[0].id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: newUser.rows[0]
    });
  } catch (error) {
    // 🌟 Type-safe extraction for TypeScript
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Registration Error:', errorMessage);
    res.status(500).json({ success: false, message: 'Server error processing registration.' });
  }
});


// 🌐 2. MOBILE GOOGLE SIGN-IN / SIGN-UP ENDPOINT
app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: [
        "1058256639702-kf6keqod679iifii1jvudn89r9f3e621.apps.googleusercontent.com", // Web Client ID from main.dart
        "1058256639702-ui0bbo682f3itque8029bf8qcrdbdnc1.apps.googleusercontent.com"  // Android Client ID from Cloud Console
      ],
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ success: false, message: 'Invalid Google token payload.' });
    }

    const { name, email } = payload;

    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = userResult.rows[0];

    if (!user) {
      const placeholderPassword = await bcrypt.hash(Math.random().toString(36), 10);
      
      const newUser = await pool.query(
        'INSERT INTO users (name, email, password, knowledge_level) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
        [name, email, placeholderPassword, 'Beginner']
      );
      user = newUser.rows[0];
    }

    const sessionToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

    res.status(200).json({
      success: true,
      message: 'Google Sign-In successful!',
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    // 🌟 Type-safe extraction for TypeScript
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Google Auth Error:', errorMessage);
    res.status(500).json({ success: false, message: 'Google authentication processing error.' });
  }
});


// 🩺 3. DATABASE HEALTH CHECK ENDPOINT
app.get('/api/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({ status: 'Online', databaseTime: dbCheck.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'Database Error', error: err });
  }
});


// 🚀 START SERVER LISTENING
app.listen(PORT, () => {
  console.log(`HerFunds Backend running cleanly on port ${PORT}`);
});