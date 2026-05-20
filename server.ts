import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import "dotenv/config";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "data", "database.json");
const MESSAGES_PATH = path.join(__dirname, "data", "messages.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// R2 Client Lazy Init
let r2Client: S3Client | null = null;
const getR2Client = () => {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return r2Client;
};

const R2_BUCKET = process.env.R2_BUCKET_NAME || "gallery";
const R2_PUBLIC_URL = (process.env.VITE_R2_PUBLIC_URL || "").replace(/\/$/, "");

async function uploadToR2(filePath: string, key: string, contentType: string) {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("Cloudflare R2 credentials are not configured in environment variables.");
  }
  const fileBuffer = await fs.readFile(filePath);
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });
  await getR2Client().send(command);
  return `${R2_PUBLIC_URL}/${key}`;
}

async function deleteFromR2(url: string) {
  if (!url || !R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) return;
  const key = url.replace(`${R2_PUBLIC_URL}/`, "");
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });
    await getR2Client().send(command);
  } catch (err) {
    console.warn("Failed to delete from R2:", key, err);
  }
}

async function initDB() {
  try {
    await fs.access(path.join(__dirname, "data"));
  } catch {
    await fs.mkdir(path.join(__dirname, "data"));
  }

  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR);
  }

  const THUMBNAILS_DIR = path.join(UPLOADS_DIR, "thumbnails");
  try {
    await fs.access(THUMBNAILS_DIR);
  } catch {
    await fs.mkdir(THUMBNAILS_DIR);
  }

  try {
    const dbExists = await fs.access(DB_PATH).then(() => true).catch(() => false);
    if (!dbExists) {
      const initialDB = { 
        portfolio: [], project: [], personal: [], 
        about: { title: "KeenVi", description: "Studio...", bio: "Bio...", career: [], skills: [], tools: [] },
        intro: { logoText: "KEENVI", headline: "Artist", links: {}, gateways: {} },
        categories: { portfolio: [], project: [], personal: [] }
      };
      await fs.writeFile(DB_PATH, JSON.stringify(initialDB, null, 2), "utf-8");
    }
    const messExists = await fs.access(MESSAGES_PATH).then(() => true).catch(() => false);
    if (!messExists) {
      await fs.writeFile(MESSAGES_PATH, "[]", "utf-8");
    }
  } catch (err) {
    console.error("DB Init failed:", err);
  }
}

async function startServer() {
  await initDB();
  const app = express();
  const PORT = 3000;

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());
  app.use("/uploads", express.static(UPLOADS_DIR));

  // --- API ROUTES FIRST ---
  app.get("/api/test", (req, res) => res.json({ message: "express is alive" }));
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // Upload Original
  app.post("/api/upload", upload.single("file"), async (req: any, res, next) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(req.file.filename).toLowerCase();
      const mainKey = `uploads/${uniqueSuffix}${ext}`;
      
      const originalUrl = await uploadToR2(req.file.path, mainKey, req.file.mimetype);
      let thumbnailUrl = originalUrl;

      const isImage = [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
      if (isImage) {
        const thumbFilename = `thumb-${uniqueSuffix}.jpg`;
        const thumbPath = path.join(UPLOADS_DIR, "thumbnails", thumbFilename);
        const thumbKey = `uploads/thumbnails/${thumbFilename}`;
        
        // Resize to 450px as requested for original upload thumbnail
        await sharp(req.file.path).resize({ width: 450 }).jpeg({ quality: 90 }).toFile(thumbPath);
        thumbnailUrl = await uploadToR2(thumbPath, thumbKey, "image/jpeg");
        await fs.unlink(thumbPath).catch(() => {});
      }
      await fs.unlink(req.file.path).catch(() => {});
      res.json({ url: originalUrl, thumbnailUrl });
    } catch (err: any) {
      console.error("R2 Upload error:", err);
      next(err);
    }
  });

  // Upload Thumbnail only (수동으로 그대로 저장)
  app.post("/api/upload/thumbnail", upload.single("file"), async (req: any, res, next) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const thumbFilename = `t-${uniqueSuffix}.jpg`;
      const thumbPath = path.join(UPLOADS_DIR, "thumbnails", thumbFilename);
      const thumbKey = `uploads/thumbnails/${thumbFilename}`;
      
      // Get dimensions before processing (or just use the uploaded file)
      const metadata = await sharp(req.file.path).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const ratio = width && height ? parseFloat((width / height).toFixed(3)) : 1;

      // Just convert to jpeg without resizing as requested for manual upload
      await sharp(req.file.path).jpeg({ quality: 90 }).toFile(thumbPath);
      
      const url = await uploadToR2(thumbPath, thumbKey, "image/jpeg");
      await fs.unlink(req.file.path).catch(() => {});
      await fs.unlink(thumbPath).catch(() => {});
      
      res.json({ url, width, height, ratio });
    } catch (err: any) {
      console.error("R2 Thumb upload error:", err);
      next(err);
    }
  });

  // Generate high-quality thumbnail from URL (CORS safe, sharp filter)
  app.post("/api/generate-thumbnail-from-url", async (req, res, next) => {
    const { imageUrl, width } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }
    const targetWidth = parseInt(width) || 450;

    try {
      let buffer: Buffer;
      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image from URL: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (imageUrl.startsWith("/uploads/")) {
        const localRelativePath = imageUrl.replace(/^\/uploads\//, "");
        const fullLocalPath = path.join(UPLOADS_DIR, localRelativePath);
        buffer = await fs.readFile(fullLocalPath);
      } else {
        const fullLocalPath = path.join(__dirname, imageUrl);
        buffer = await fs.readFile(fullLocalPath);
      }

      const image = sharp(buffer);
      const metadata = await image.metadata();

      const originalWidth = metadata.width || 0;
      const originalHeight = metadata.height || 0;

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      
      // Clean up final prefix and character names
      const originalName = imageUrl
        .split('/')
        .pop()
        ?.split('?')[0]
        ?.replace(/\.[^/.]+$/, '') || 'thumb';
      const safeName = originalName
        .replace(/[^a-zA-Z0-9-_가-힣]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const thumbFilename = `t-${safeName || uniqueSuffix}.jpg`;
      const thumbPath = path.join(UPLOADS_DIR, "thumbnails", thumbFilename);
      const thumbKey = `uploads/thumbnails/${thumbFilename}`;

      // High-quality resizing using sharp with sharpen filter
      await image
        .resize({ width: targetWidth, fit: 'inside', withoutEnlargement: false })
        .sharpen({ sigma: 0.5, m1: 1.0, m2: 2.0 })
        .jpeg({ quality: 90 })
        .toFile(thumbPath);

      const url = await uploadToR2(thumbPath, thumbKey, "image/jpeg");
      await fs.unlink(thumbPath).catch(() => {});

      res.json({
        url,
        width: originalWidth,
        height: originalHeight,
        ratio: originalWidth && originalHeight ? parseFloat((originalWidth / originalHeight).toFixed(3)) : 1
      });
    } catch (err: any) {
      console.error("Backend server generate-thumbnail error:", err);
      res.status(500).json({ error: err.message || "Failed to generate thumbnail from URL" });
    }
  });

  app.post("/api/storage/cleanup", async (req, res) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls)) return res.status(400).json({ error: "Invalid urls" });
    try {
      for (const url of urls) await deleteFromR2(url);
      res.json({ status: "success" });
    } catch (err) { res.status(500).json({ error: "Cleanup failed" }); }
  });

  // DB Getters
  app.get("/api/categories", async (req, res) => {
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    res.json(data.categories || { portfolio: [], project: [], personal: [] });
  });

  app.get("/api/gallery/:type", async (req, res) => {
    const { type } = req.params;
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    const items = data[type] || [];
    res.json([...items].sort((a, b) => (b.order ?? 0) - (a.order ?? 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  });

  app.get("/api/about", async (req, res) => {
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    res.json(data.about || {});
  });

  app.get("/api/intro", async (req, res) => {
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    res.json(data.intro || {});
  });

  // DB Setters
  app.post("/api/gallery/:type", async (req, res) => {
    const { type } = req.params;
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    if (!data[type]) data[type] = [];
    const maxOrder = data[type].length > 0 ? Math.max(...data[type].map((i: any) => i.order || 0)) : -1;
    const newItem = { ...req.body, id: Date.now().toString(), createdAt: new Date().toISOString(), order: maxOrder + 1 };
    data[type].unshift(newItem);
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
    res.json(newItem);
  });

  app.put("/api/gallery/:type/:id", async (req, res) => {
    const { type, id } = req.params;
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    const idx = data[type].findIndex((i: any) => i.id === id);
    if (idx !== -1) {
      data[type][idx] = { ...data[type][idx], ...req.body };
      await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
      res.json(data[type][idx]);
    } else res.status(404).json({ error: "Not found" });
  });

  app.delete("/api/gallery/:type/:id", async (req, res) => {
    const { type, id } = req.params;
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    const item = data[type].find((i: any) => i.id === id);
    if (item) {
      if (item.imageUrl) await deleteFromR2(item.imageUrl);
      if (item.thumbnailUrl) await deleteFromR2(item.thumbnailUrl);
      data[type] = data[type].filter((i: any) => i.id !== id);
      await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
      res.json({ status: "success" });
    } else res.status(404).json({ error: "Not found" });
  });

  app.put("/api/gallery/:type/reorder", async (req, res) => {
    const { type } = req.params;
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    data[type] = req.body.items;
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
    res.json(data[type]);
  });

  app.put("/api/intro", async (req, res) => {
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    data.intro = req.body;
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
    res.json(data.intro);
  });

  app.put("/api/about", async (req, res) => {
    const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
    data.about = req.body;
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
    res.json(data.about);
  });

  // Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Express Error:", err);
    res.status(err.status || 500).json({ 
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  });

  app.post("/api/admin/login", (req, res) => {
    const { id, password } = req.body;
    if ((id === "keenvi" && password === "667429") || (id === "admin" && password === "admin12345")) {
      res.json({ token: "auth-token", type: id === "admin" ? "master" : "normal" });
    } else res.status(401).json({ error: "Invalid credentials" });
  });

  app.post("/api/contact", async (req, res) => {
    const messages = JSON.parse(await fs.readFile(MESSAGES_PATH, "utf-8"));
    messages.push({ id: Date.now().toString(), ...req.body, date: new Date().toISOString() });
    await fs.writeFile(MESSAGES_PATH, JSON.stringify(messages, null, 2));
    res.json({ status: "success" });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server listening on port ${PORT}`));
}

startServer().catch(err => console.error("Server fatal error:", err));
