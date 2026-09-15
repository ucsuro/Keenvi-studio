import express from "express";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import sharp from "sharp";

dotenv.config({ path: ".env.local" });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseVerifier = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

async function requireAdmin(req: any, res: any, next: any) {
  if (!supabaseVerifier) {
    return res.status(503).json({ error: "Supabase authentication is not configured." });
  }

  if (adminEmails.size === 0) {
    return res.status(503).json({ error: "ADMIN_EMAILS is not configured." });
  }

  const authorization = req.header("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const { data: { user }, error } = await supabaseVerifier.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }

  if (adminEmails.size > 0 && (!user.email || !adminEmails.has(user.email.toLowerCase()))) {
    return res.status(403).json({ error: "Administrator access required." });
  }

  req.user = user;
  next();
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_REMOTE_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const EXTENSIONS_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WebP, GIF, and AVIF images are allowed."));
    }
    cb(null, true);
  },
});

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
const thumbnailAllowedHosts = new Set(
  ["cdna.artstation.com", "cdnb.artstation.com", ...(process.env.THUMBNAIL_ALLOWED_HOSTS || "").split(",")]
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

for (const trustedBaseUrl of [R2_PUBLIC_URL, supabaseUrl]) {
  if (!trustedBaseUrl) continue;
  try {
    thumbnailAllowedHosts.add(new URL(trustedBaseUrl).hostname.toLowerCase());
  } catch {
    console.warn("A configured thumbnail base URL is invalid.");
  }
}

async function fetchAllowedImage(imageUrl: string) {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("imageUrl must be a valid HTTPS URL.");
  }

  if (url.protocol !== "https:" || !thumbnailAllowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("This thumbnail host is not allowed.");
  }

  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "image/*" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error("Remote URL did not return a supported image.");
  }

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error("Remote image exceeds the 15 MB limit.");
  }
  if (!response.body) throw new Error("Remote image response was empty.");

  const chunks: Buffer[] = [];
  let received = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_REMOTE_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("Remote image exceeds the 15 MB limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function uploadToR2(body: Buffer, key: string, contentType: string) {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
    throw new Error("Cloudflare R2 credentials are not configured in environment variables.");
  }
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await getR2Client().send(command);
  return `${R2_PUBLIC_URL}/${key}`;
}

async function deleteFromR2(url: string) {
  if (!url || !R2_PUBLIC_URL) return;
  let key: string;
  try {
    const objectUrl = new URL(url);
    const publicBase = new URL(`${R2_PUBLIC_URL}/`);
    if (objectUrl.origin !== publicBase.origin || !objectUrl.pathname.startsWith(publicBase.pathname)) return;
    key = objectUrl.pathname.slice(publicBase.pathname.length);
    if (!key) return;
  } catch {
    return;
  }
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: "256kb" }));

  // --- API ROUTES FIRST ---
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.get("/api/admin/me", requireAdmin, (req: any, res) => {
    res.json({ authorized: true, email: req.user.email });
  });

  // Upload Original
  app.post("/api/upload", requireAdmin, upload.single("file"), async (req: any, res, next) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = EXTENSIONS_BY_MIME[req.file.mimetype];
      const mainKey = `uploads/${uniqueSuffix}${ext}`;

      const originalUrl = await uploadToR2(req.file.buffer, mainKey, req.file.mimetype);
      res.json({ url: originalUrl, thumbnailUrl: originalUrl });
    } catch (err: any) {
      console.error("R2 Upload error:", err);
      next(err);
    }
  });

  // Upload Thumbnail only (수동으로 그대로 저장)
  app.post("/api/upload/thumbnail", requireAdmin, upload.single("file"), async (req: any, res, next) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const thumbFilename = `t-${uniqueSuffix}.jpg`;
      const thumbKey = `uploads/thumbnails/${thumbFilename}`;
      
      const image = sharp(req.file.buffer, { limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const ratio = width && height ? parseFloat((width / height).toFixed(3)) : 1;

      const thumbnail = await image.jpeg({ quality: 90 }).toBuffer();
      const url = await uploadToR2(thumbnail, thumbKey, "image/jpeg");
      
      res.json({ url, width, height, ratio });
    } catch (err: any) {
      console.error("R2 Thumb upload error:", err);
      next(err);
    }
  });

  // Generate high-quality thumbnail from URL (CORS safe, sharp filter)
  app.post("/api/generate-thumbnail-from-url", requireAdmin, async (req, res, next) => {
    const { imageUrl, width } = req.body;
    if (typeof imageUrl !== "string" || !imageUrl) {
      return res.status(400).json({ error: "imageUrl is required" });
    }
    const parsedWidth = Number.parseInt(String(width), 10) || 450;
    const targetWidth = Math.min(Math.max(parsedWidth, 64), 2000);

    try {
      const buffer = await fetchAllowedImage(imageUrl);

      const image = sharp(buffer, { limitInputPixels: 40_000_000 });
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

      const thumbFilename = `t-${safeName ? safeName + '-' : ''}${uniqueSuffix}.jpg`;
      const thumbKey = `uploads/thumbnails/${thumbFilename}`;

      const thumbnail = await image
        .resize({ width: targetWidth, fit: 'inside', withoutEnlargement: false })
        .sharpen({ sigma: 0.5, m1: 1.0, m2: 2.0 })
        .jpeg({ quality: 90 })
        .toBuffer();

      const url = await uploadToR2(thumbnail, thumbKey, "image/jpeg");

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

  app.post("/api/storage/cleanup", requireAdmin, async (req, res) => {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length > 100 || urls.some((url) => typeof url !== "string")) {
      return res.status(400).json({ error: "Invalid urls" });
    }
    try {
      for (const url of urls) await deleteFromR2(url);
      res.json({ status: "success" });
    } catch (err) { res.status(500).json({ error: "Cleanup failed" }); }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.get("/", (_req, res) => res.json({ service: "keenvi-studio-api", status: "ok" }));
    app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));
  }

  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("Express Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  });

  app.listen(PORT, "0.0.0.0", () => console.log(`Server listening on port ${PORT}`));
}

startServer().catch(err => console.error("Server fatal error:", err));
