require('dotenv').config(); // <-- Yeh sabse top pe hona chahiye

const express = require('express');
const mysql = require('mysql2/promise');
const socketio = require('socket.io');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


// Test DB Connection
async function testDBConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL Database Connected!');
    conn.release();
  } catch (err) {
    console.error('❌ Database Connection Failed:', err);
    process.exit(1);
  }
}

// Create Tables (without dropping existing ones)
async function createTables() {
  try {
    // Create tables if they don't exist (don't drop them)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        is_points_based BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quiz_id INT NOT NULL,
        question_text TEXT NOT NULL,
        option1 VARCHAR(255) NOT NULL,
        option2 VARCHAR(255) NOT NULL,
        option3 VARCHAR(255),
        option4 VARCHAR(255),
        correct_option INT NOT NULL,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
      )
    `);
    
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        quiz_id INT NOT NULL,
        score INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
      )
    `);
    
    console.log('✅ Database tables verified');
  } catch (err) {
    console.error('❌ Failed to create tables:', err);
  }
}

// Routes

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await pool.execute(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Failed to register user' });
    }
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Return user data without password
    const { password: _, ...userData } = user;
    res.json(userData);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get all quizzes
app.get('/api/quizzes', async (req, res) => {
  try {
    const [quizzes] = await pool.execute('SELECT * FROM quizzes');
    res.json(quizzes);
  } catch (err) {
    console.error('Fetch quizzes error:', err);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get questions for a quiz
app.get('/api/quizzes/:id/questions', async (req, res) => {
  try {
    const quizId = req.params.id;
    const [questions] = await pool.execute(
      'SELECT * FROM questions WHERE quiz_id = ?',
      [quizId]
    );
    res.json(questions);
  } catch (err) {
    console.error('Fetch questions error:', err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Create new quiz (Admin)
app.post('/api/quizzes', async (req, res) => {
  try {
    const { title, description, is_points_based } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO quizzes (title, description, is_points_based) VALUES (?, ?, ?)',
      [title, description, is_points_based]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Create quiz error:', err);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// Add question (Admin)
app.post('/api/questions', async (req, res) => {
  try {
    const { quiz_id, question_text, options, correct_option } = req.body;
    
    // Pad options to 4 elements
    const paddedOptions = [...options];
    while (paddedOptions.length < 4) {
      paddedOptions.push(null);
    }
    
    const [result] = await pool.execute(
      'INSERT INTO questions (quiz_id, question_text, option1, option2, option3, option4, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [quiz_id, question_text, ...paddedOptions, correct_option]
    );
    
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Add question error:', err);
    res.status(500).json({ 
      error: 'Failed to add question',
      details: err.message
    });
  }
});

// Save score
app.post('/api/scores', async (req, res) => {
  try {
    const { user_id, quiz_id, score } = req.body;
    
    // Validate input
    if (isNaN(user_id) || isNaN(quiz_id) || isNaN(score)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    await pool.execute(
      'INSERT INTO scores (user_id, quiz_id, score) VALUES (?, ?, ?)',
      [user_id, quiz_id, score]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Save score error:', err);
    res.status(500).json({ 
      error: 'Failed to save score',
      details: err.message
    });
  }
});

// Get leaderboard for a quiz
app.get('/api/leaderboard/:quizId', async (req, res) => {
  try {
    const quizId = req.params.quizId;
    
    // Handle same rank for same scores
    const [scores] = await pool.execute(`
      SELECT 
        u.username,
        s.score,
        DENSE_RANK() OVER (ORDER BY s.score DESC) AS 'rank'
      FROM scores s
      JOIN users u ON s.user_id = u.id
      WHERE s.quiz_id = ? AND u.username != 'testuser'
      ORDER BY s.score DESC
      LIMIT 10
    `, [quizId]);
    
    res.json(scores);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard',
      details: err.message
    });
  }
});

// Get overall leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Get top scores across all quizzes
    const [scores] = await pool.execute(`
      SELECT 
        u.username,
        SUM(s.score) AS total_score,
        DENSE_RANK() OVER (ORDER BY SUM(s.score) DESC) AS 'rank'
      FROM scores s
      JOIN users u ON s.user_id = u.id
      WHERE u.username != 'testuser'
      GROUP BY u.id
      ORDER BY total_score DESC
      LIMIT 10
    `);
    
    res.json(scores);
  } catch (err) {
    console.error('Overall leaderboard error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch overall leaderboard',
      details: err.message
    });
  }
});

// Get taken quizzes for a user
app.get('/api/scores/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const [scores] = await pool.execute(
      'SELECT quiz_id FROM scores WHERE user_id = ?',
      [userId]
    );
    res.json(scores);
  } catch (err) {
    console.error('User scores error:', err);
    res.status(500).json({ error: 'Failed to fetch user scores' });
  }
});

// Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Home route - serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await testDBConnection();
  await createTables();
  console.log('✅ Database ready');
});

// Socket.io setup
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  socket.on('joinQuiz', (quizId) => {
    socket.join(quizId);
    console.log(`📝 User joined quiz ${quizId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});