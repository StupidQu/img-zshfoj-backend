import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite database configuration
const dbFile = path.join(__dirname, 'database.sqlite');

// Database connection
let db;

// Initialize the database
async function initializeDB() {
  try {
    // Open the database
    db = new Database(dbFile, { verbose: console.log });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        registeredAt TEXT NOT NULL,
        lastLogin TEXT NOT NULL,
        ip TEXT
      )
    `);

    // Create login_history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        date TEXT NOT NULL,
        ip TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    // Create uploads table
    db.exec(`
      CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        key TEXT UNIQUE NOT NULL,
        uploadedAt TEXT NOT NULL,
        ip TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    console.log('Database initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('Database initialization error:', error);
    return { success: false, message: 'Failed to initialize database' };
  }
}

// Register a new user
async function registerUser(username, email, password, ip) {
  try {
    // Prepare statements
    const checkUsername = db.prepare('SELECT id FROM users WHERE username = ?');
    const checkEmail = db.prepare('SELECT id FROM users WHERE email = ?');
    const insertUser = db.prepare('INSERT INTO users (id, username, email, password, registeredAt, lastLogin, ip) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertLoginHistory = db.prepare('INSERT INTO login_history (userId, date, ip) VALUES (?, ?, ?)');

    // Check if username already exists
    const existingUsername = checkUsername.get(username);
    if (existingUsername) {
      return { success: false, message: "用户名已被使用" };
    }

    // Check if email already exists
    const existingEmail = checkEmail.get(email);
    if (existingEmail) {
      return { success: false, message: "邮箱已被注册" };
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate user ID
    const userId = Date.now().toString();
    const now = new Date().toISOString();

    // Use transaction for atomic operations
    const transaction = db.transaction(() => {
      // Create user
      insertUser.run(userId, username, email, hashedPassword, now, now, ip);
      
      // Record login history
      insertLoginHistory.run(userId, now, ip);
    });

    // Execute transaction
    transaction();

    return {
      success: true,
      user: {
        id: userId,
        username,
        email
      }
    };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, message: "注册失败，请稍后再试" };
  }
}

// Authenticate a user
async function loginUser(usernameOrEmail, password, ip) {
  try {
    // Prepare statements
    const findUser = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
    const updateLastLogin = db.prepare('UPDATE users SET lastLogin = ?, ip = ? WHERE id = ?');
    const insertLoginHistory = db.prepare('INSERT INTO login_history (userId, date, ip) VALUES (?, ?, ?)');

    // Try to find user by username or email
    const user = findUser.get(usernameOrEmail, usernameOrEmail);

    if (!user) {
      return { success: false, message: "用户名或密码错误" };
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { success: false, message: "用户名或密码错误" };
    }

    // Update last login time and IP
    const now = new Date().toISOString();
    
    // Use transaction for atomic operations
    const transaction = db.transaction(() => {
      updateLastLogin.run(now, ip, user.id);
      insertLoginHistory.run(user.id, now, ip);
    });

    // Execute transaction
    transaction();

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, message: "登录失败，请稍后再试" };
  }
}

// Record an upload
async function recordUpload(userId, _key, ip) {
  const key = `${userId}/${_key}/${Date.now()}`;
  try {
    // Prepare statement
    const insertUpload = db.prepare(
      'INSERT INTO uploads (id, userId, key, uploadedAt, ip) VALUES (?, ?, ?, ?, ?)'
    );

    const uploadId = Date.now().toString();
    const uploadedAt = new Date().toISOString();

    // Execute insert
    insertUpload.run(uploadId, userId, key, uploadedAt, ip);

    return {
      success: true,
      upload: {
        id: uploadId,
        userId,
        key,
        uploadedAt,
        ip
      }
    };
  } catch (error) {
    console.error("Upload recording error:", error);
    return { success: false, message: "记录上传失败" };
  }
}

// Get user by ID
async function getUserById(userId) {
  try {
    // Prepare statement
    const getUser = db.prepare('SELECT id, username, email FROM users WHERE id = ?');
    
    // Execute query
    const user = getUser.get(userId);
    
    if (!user) {
      return { success: false, message: "用户不存在" };
    }

    return {
      success: true,
      user
    };
  } catch (error) {
    console.error("Get user error:", error);
    return { success: false, message: "获取用户信息失败" };
  }
}

// Get user uploads
async function getUserUploads(userId) {
  try {
    // Prepare statement
    const getUserUploads = db.prepare('SELECT * FROM uploads WHERE userId = ? ORDER BY uploadedAt DESC LIMIT 50');
    
    // Execute query
    const uploads = getUserUploads.all(userId);
    
    return { success: true, uploads };
  } catch (error) {
    console.error("Get uploads error:", error);
    return { success: false, message: "获取上传记录失败" };
  }
}

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Save the requested URL to redirect back after login
  req.session.returnTo = req.originalUrl;
  
  req.flash('error', '请先登录');
  res.redirect('/login');
}

export {
  initializeDB,
  registerUser,
  loginUser,
  recordUpload,
  getUserById,
  getUserUploads,
  isAuthenticated,
  db
};