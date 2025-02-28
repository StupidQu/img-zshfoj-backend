import express from "express";
import nunjucks from "nunjucks";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import qiniu from "qiniu";
import bodyParser from "body-parser";
import session from "express-session";
import flash from "connect-flash";
import config from "./config.js";
import {
  initializeDB,
  registerUser,
  loginUser,
  recordUpload,
  getUserById,
  getUserUploads,
  isAuthenticated,
} from "./auth.js";

// Get current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
const dbInitResult = await initializeDB();
if (!dbInitResult.success) {
  console.error("Failed to initialize database. Exiting application.");
  process.exit(1);
}

// Create Express application
const app = express();

// Configure nunjucks template engine
nunjucks.configure("views", {
  autoescape: true,
  express: app,
});

// Add session support
app.use(
  session({
    secret: config.app.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Should be set to true in production
  })
);

// Use flash messages
app.use(flash());

// Configure body-parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Global variables middleware
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash("success");
  res.locals.error_msg = req.flash("error");
  next();
});

// Configure multer middleware for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit to 5MB
  },
  fileFilter: (req, file, cb) => {
    // Only allow image uploads
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

// Configure Qiniu Cloud
const mac = new qiniu.auth.digest.Mac(
  config.qiniu.accessKey,
  config.qiniu.secretKey
);
const qiniuConfig = new qiniu.conf.Config();
// Zone configuration, can be omitted if not sure
// qiniuConfig.zone = qiniu.zone.Zone_z0;

// Helper function to get client IP
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress
  );
}

// Check if file exists in Qiniu cloud storage
async function fileExistsInQiniu(key) {
  try {
    const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);
    return new Promise((resolve, reject) => {
      bucketManager.stat(config.qiniu.bucket, key, (err, respBody, respInfo) => {
        if (err) {
          console.error("Error checking file existence:", err);
          resolve(false);
        } else {
          if (respInfo.statusCode === 200) {
            // File exists
            resolve(true);
          } else if (respInfo.statusCode === 612) {
            // File does not exist (resource does not exist)
            resolve(false);
          } else {
            console.error("Unexpected status code when checking file:", respInfo.statusCode);
            resolve(false);
          }
        }
      });
    });
  } catch (error) {
    console.error("Error in fileExistsInQiniu:", error);
    return false;
  }
}

// Render home page (requires login)
app.get("/", isAuthenticated, async (req, res) => {
  // Get user upload records
  const uploadsResult = await getUserUploads(req.session.userId);
  let uploads = [];

  if (uploadsResult.success) {
    uploads = uploadsResult.uploads.map((upload) => ({
      key: upload.key,
      url: `${config.qiniu.domain}/${upload.key}`,
      date: new Date(upload.uploadedAt).toLocaleString(),
    }));
  }

  res.render("index.njk", {
    title: "LVJ Image - Free Image Hosting",
    username: req.session.user.username,
    uploads: uploads,
  });
});

// Login page
app.get("/login", (req, res) => {
  // If user is already logged in, redirect to home page
  if (req.session.userId) {
    return res.redirect("/");
  }

  res.render("login.njk", {
    title: "登录",
  });
});

// Handle login request
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);

  // Validate input
  if (!username || !password) {
    req.flash("error", "请填写所有字段");
    return res.redirect("/login");
  }

  // Attempt to login
  const result = await loginUser(username, password, ip);

  if (result.success) {
    // Login successful, set session
    req.session.userId = result.user.id;
    req.session.user = {
      username: result.user.username,
      email: result.user.email,
    };

    req.flash("success", "登录成功");

    // If there's a return URL, redirect to it
    const returnTo = req.session.returnTo || "/";
    delete req.session.returnTo;

    return res.redirect(returnTo);
  } else {
    // Login failed
    req.flash("error", result.message);
    return res.redirect("/login");
  }
});

// Registration page
app.get("/register", (req, res) => {
  // If user is already logged in, redirect to home page
  if (req.session.userId) {
    return res.redirect("/");
  }

  res.render("register.njk", {
    title: "注册",
  });
});

// Handle registration request
app.post("/register", async (req, res) => {
  const { username, email, password, password2 } = req.body;
  const ip = getClientIp(req);

  // Validate input
  const errors = [];

  if (!username || !email || !password || !password2) {
    errors.push("请填写所有字段");
  }

  if (password !== password2) {
    errors.push("两次输入的密码不一致");
  }

  if (password.length < 6) {
    errors.push("密码至少6个字符");
  }

  if (errors.length > 0) {
    req.flash("error", errors.join(", "));
    return res.redirect("/register");
  }

  // Attempt to register
  const result = await registerUser(username, email, password, ip);

  if (result.success) {
    // Registration successful
    req.flash("success", "注册成功，请登录");
    return res.redirect("/login");
  } else {
    // Registration failed
    req.flash("error", result.message);
    return res.redirect("/register");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.redirect("/login");
  });
});

// Handle upload request (requires login)
app.post(
  "/upload",
  isAuthenticated,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "请选择要上传的文件" });
      }

      // Calculate file SHA256 hash
      const sha256Hash = crypto
        .createHash("sha256")
        .update(req.file.buffer)
        .digest("hex");
      const key = `${sha256Hash}.png`;
      
      // Check if file already exists in Qiniu
      const fileExists = await fileExistsInQiniu(key);
      
      if (fileExists) {
        console.log(`File with key ${key} already exists, skipping upload`);
        
        // Build access URL for existing file
        const imageUrl = `${config.qiniu.domain}/${key}`;
        
        // Record the upload information in our database
        const ip = getClientIp(req);
        await recordUpload(req.session.userId, key, ip);
        
        // Return the existing file info
        return res.json({
          success: true,
          imageUrl,
          key,
          message: "File already exists and has been linked to your account"
        });
      }

      // Generate upload token
      const putPolicy = new qiniu.rs.PutPolicy({
        scope: `${config.qiniu.bucket}:${key}`,
      });
      const uploadToken = putPolicy.uploadToken(mac);

      // Create form upload object
      const formUploader = new qiniu.form_up.FormUploader(qiniuConfig);
      const putExtra = new qiniu.form_up.PutExtra();

      // Upload file to Qiniu
      const uploadResult = await new Promise((resolve, reject) => {
        formUploader.put(
          uploadToken,
          key,
          req.file.buffer,
          putExtra,
          (err, body, info) => {
            if (err) {
              return reject(err);
            }
            if (info.statusCode === 200) {
              resolve(body);
            } else {
              reject(new Error(`上传失败: ${info.statusCode}`));
            }
          }
        );
      });

      // Build access URL
      const imageUrl = `${config.qiniu.domain}/${key}`;

      // Record upload information
      const ip = getClientIp(req);
      await recordUpload(req.session.userId, key, ip);

      // Return upload success information
      return res.json({
        success: true,
        imageUrl,
        key,
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({
        success: false,
        message: `上传失败: ${error.message}`,
      });
    }
  }
);

// Start server
app.listen(config.app.port, () => {
  console.log(`Server running at http://localhost:${config.app.port}`);
});