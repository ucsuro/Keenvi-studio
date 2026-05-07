import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "data", "database.json");
const MESSAGES_PATH = path.join(__dirname, "data", "messages.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

import multer from "multer";
import sharp from "sharp";

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

  // Ensure thumbnails directory exists
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
        portfolio: [], 
        project: [], 
        personal: [], 
        about: {
          title: "KeenVi Studio",
          description: "Studio description...",
          bio: "Studio biography...",
          career: [],
          skills: [],
          tools: []
        },
        intro: {
          logoText: "KEENVI STUDIO",
          headline: "Visual Storyteller & Concept Artist based in Seoul.",
          links: {
            artstation: "#",
            instagram: "#",
            linkedin: "#",
            facebook: "#",
            naver: "#",
            twitter: "#"
          },
          gateways: {
            portfolio: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=1200&q=80",
            project: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&w=1200&q=80",
            personal: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80"
          }
        },
        categories: {
          portfolio: ["Illustration", "Key Art / Story", "Concept Art"],
          project: ["Freelance", "RFonline:RE", "Blade & Soul", "Genesis4"],
          personal: ["Original Art", "Study", "Character", "Worldbuilding", "AI / 3D Experiment"]
        }
      };
      await fs.writeFile(DB_PATH, JSON.stringify(initialDB, null, 2), "utf-8");
    } else {
      // Data Migration: Ensure categories is a keyed object
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      if (!data.categories || Array.isArray(data.categories)) {
        const oldCats = Array.isArray(data.categories) ? data.categories : [];
        data.categories = {
          portfolio: oldCats.length > 0 ? oldCats : ["Illustration", "Key Art / Story", "Concept Art"],
          project: ["Freelance", "RFonline:RE", "Blade & Soul", "Genesis4"],
          personal: ["Original Art", "Study", "Character", "Worldbuilding", "AI / 3D Experiment"]
        };
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
      }
      
      if (!data.intro) {
        data.intro = {
          logoText: "KEENVI STUDIO",
          headline: "Visual Storyteller & Concept Artist based in Seoul.",
          links: {
            artstation: "#",
            instagram: "#",
            linkedin: "#",
            facebook: "#",
            naver: "#",
            twitter: "#"
          },
          gateways: {
            portfolio: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=1200&q=80",
            project: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&w=1200&q=80",
            personal: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&q=80"
          }
        };
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
      } else {
        // Upgrade existing intro data
        let changed = false;
        if (!data.intro.logoText) {
          data.intro.logoText = "KEENVI STUDIO";
          changed = true;
        }
        if (!data.intro.links.facebook) {
          data.intro.links.facebook = "#";
          changed = true;
        }
        if (changed) {
          await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
        }
      }

      // Initialize 'order' for existing gallery items if missing
      const galleryTypes = ["portfolio", "project", "personal"];
      let migrationNeeded = false;
      galleryTypes.forEach(type => {
        if (data[type] && Array.isArray(data[type])) {
          data[type].forEach((item: any, index: number) => {
            if (typeof item.order !== 'number') {
              // Inverse index so that items at the top of the array (newer) get higher numbers
              // This preserves current visual order if they are already sub-sorted by date
              item.order = data[type].length - 1 - index;
              migrationNeeded = true;
            }
          });
        }
      });
      if (migrationNeeded) {
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
      }
    }
  } catch (err) {
    console.error("DB Initialization error:", err);
  }

  try {
    await fs.access(MESSAGES_PATH);
  } catch {
    await fs.writeFile(MESSAGES_PATH, JSON.stringify([], null, 2));
  }
}

async function startServer() {
  await initDB();

  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Diagnostic log for environment variables
  console.log("Checking Environment Variables:");
  console.log(`- ADMIN_ID: ${process.env.ADMIN_ID ? "SET (Using custom)" : "NOT SET (Using default: keenvi)"}`);
  console.log(`- ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? "SET (Using custom)" : "NOT SET (Using default: 667429)"}`);

  // Upload Route
  app.post("/api/upload", upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const originalUrl = `/uploads/${req.file.filename}`;
    let thumbnailUrl = originalUrl;

    // Check if it's an image to generate a thumbnail
    const ext = path.extname(req.file.filename).toLowerCase();
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);

    if (isImage) {
      const thumbFilename = `thumb-${req.file.filename}`;
      const thumbPath = path.join(UPLOADS_DIR, "thumbnails", thumbFilename);
      
      try {
        await sharp(req.file.path)
          .resize(430, null, { // Width of 430, height auto
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3 // High quality scaling
          })
          .toFile(thumbPath);
        thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
      } catch (error) {
        console.error("Thumbnail generation failed:", error);
      }
    }

    res.json({ url: originalUrl, thumbnailUrl: thumbnailUrl });
  });

  // Manual Thumbnail Upload Route
  app.post("/api/upload/thumbnail", upload.single("file"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const thumbFilename = `manual-thumb-${req.file.filename}`;
    const thumbPath = path.join(UPLOADS_DIR, "thumbnails", thumbFilename);

    try {
      // Even manual uploads are forced to 430px width if larger, as requested
      await sharp(req.file.path)
        .resize(430, null, {
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3
        })
        .toFile(thumbPath);
      
      // Remove the non-resized version from main uploads since we only need the thumb
      await fs.unlink(req.file.path);
      
      res.json({ url: `/uploads/thumbnails/${thumbFilename}` });
    } catch (error) {
      res.status(500).json({ error: "Manual thumbnail processing failed" });
    }
  });

  // GET Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      res.json(data.categories || { portfolio: [], project: [], personal: [] });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // POST Category
  app.post("/api/categories/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const { name } = req.body;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      if (!data.categories) data.categories = { portfolio: [], project: [], personal: [] };
      if (!data.categories[type]) data.categories[type] = [];
      
      if (!data.categories[type].includes(name)) {
        data.categories[type].push(name);
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
      }
      res.json(data.categories[type]);
    } catch (error) {
      res.status(500).json({ error: "Failed to add category" });
    }
  });

  // DELETE Category
  app.delete("/api/categories/:type/:name", async (req, res) => {
    try {
      const { type, name } = req.params;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      if (data.categories && data.categories[type]) {
        data.categories[type] = data.categories[type].filter((c: string) => c !== name);
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
      }
      res.json(data.categories ? data.categories[type] : []);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // REORDER Categories
  app.put("/api/categories/:type/reorder", async (req, res) => {
    try {
      const { type } = req.params;
      const { categories } = req.body;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      
      if (!data.categories) data.categories = { portfolio: [], project: [], personal: [] };
      data.categories[type] = categories;
      
      await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
      res.json(data.categories[type]);
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder categories" });
    }
  });

  // GET Gallery
  app.get("/api/gallery/:type", async (req, res) => {
    try {
      const type = req.params.type;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      const items = data[type] || [];
      const cats = (data.categories && data.categories[type]) || [];

      // Sort logic: order DESC, then createdAt DESC
      const sorted = [...items].sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderB !== orderA) return orderB - orderA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      res.json(sorted);
    } catch (error) {
      res.status(500).json({ error: "Failed to read database" });
    }
  });

  // Create Gallery Item with incremental order
  app.post("/api/gallery/:type", async (req, res) => {
    try {
      const type = req.params.type;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      const items = data[type] || [];
      
      const maxOrder = items.length > 0 ? Math.max(...items.map((i: any) => i.order || 0)) : -1;
      
      const newItem = { 
        ...req.body, 
        id: Date.now().toString(), 
        createdAt: new Date().toISOString(),
        order: maxOrder + 1 
      };
      
      if (!data[type]) data[type] = [];
      data[type].unshift(newItem);
      await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
      res.json(newItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to create item" });
    }
  });

  // GET About
  app.get("/api/about", async (req, res) => {
    try {
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      res.json(data.about || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to read database" });
    }
  });

  // POST Contact
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, company, message } = req.body;
      const messages = JSON.parse(await fs.readFile(MESSAGES_PATH, "utf-8"));
      const newMessage = { id: Date.now().toString(), name, email, company, message, date: new Date().toISOString() };
      messages.push(newMessage);
      await fs.writeFile(MESSAGES_PATH, JSON.stringify(messages, null, 2));
      
      console.log(`Email notification sent to ucsuro@naver.com for message from ${name}`);
      
      res.json({ status: "success" });
    } catch (error) {
      res.status(500).json({ error: "Failed to save message" });
    }
  });

  // Admin Login
  app.post("/api/admin/login", (req, res) => {
    const { id, password } = req.body;
    
    // Trim and handle defaults
    const adminId = (process.env.ADMIN_ID || "keenvi").trim();
    const adminPass = (process.env.ADMIN_PASSWORD || "667429").trim();

    // Debug log for troubleshooting (redacts the actual password)
    console.log(`Login attempt for ID: ${id}. Expected: ${adminId}`);

    if (id?.trim() === adminId && password?.trim() === adminPass) {
      res.json({ token: "keenvi-auth-session" });
    } else {
      console.warn(`Failed login attempt for ID: ${id}`);
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // UPDATE Gallery Item
  app.put("/api/gallery/:type/:id", async (req, res) => {
    try {
      const { type, id } = req.params;
      const updatedItem = req.body;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      
      const index = data[type].findIndex((item: any) => item.id === id);
      if (index !== -1) {
        data[type][index] = { ...data[type][index], ...updatedItem };
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
        res.json(data[type][index]);
      } else {
        res.status(404).json({ error: "Item not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  // UPDATE About Data
  app.put("/api/about", async (req, res) => {
    try {
      const updatedAbout = req.body;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      data.about = updatedAbout;
      await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
      res.json(data.about);
    } catch (error) {
      res.status(500).json({ error: "Failed to update about data" });
    }
  });

  // GET Intro Data
  app.get("/api/intro", async (req, res) => {
    try {
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      res.json(data.intro || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch intro data" });
    }
  });

  // UPDATE Intro Data
  app.put("/api/intro", async (req, res) => {
    try {
      const updatedIntro = req.body;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      data.intro = updatedIntro;
      await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
      res.json(data.intro);
    } catch (error) {
      res.status(500).json({ error: "Failed to update intro data" });
    }
  });

  // DELETE Gallery Item with physical file removal
  app.delete("/api/gallery/:type/:id", async (req, res) => {
    try {
      const { type, id } = req.params;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      
      const itemToDelete = data[type].find((item: any) => item.id === id);
      
      if (itemToDelete) {
        // Physical file deletion
        const deleteFile = async (url: string) => {
          if (!url) return;
          // Handles both /uploads/filename.ext and /uploads/thumbnails/filename.ext
          const filePath = path.join(__dirname, "public", url);
          try {
            await fs.access(filePath);
            await fs.unlink(filePath);
          } catch (err) {
            // Ignore if file doesn't exist or can't be deleted
          }
        };

        if (itemToDelete.imageUrl) await deleteFile(itemToDelete.imageUrl);
        if (itemToDelete.thumbnailUrl) await deleteFile(itemToDelete.thumbnailUrl);

        data[type] = data[type].filter((item: any) => item.id !== id);
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
        res.json({ status: "success" });
      } else {
        res.status(404).json({ error: "Item not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // REORDER Gallery Items
  app.put("/api/gallery/:type/reorder", async (req, res) => {
    try {
      const { type } = req.params;
      const { items } = req.body;
      const data = JSON.parse(await fs.readFile(DB_PATH, "utf-8"));
      
      data[type] = items;
      
      await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
      res.json(data[type]);
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder gallery items" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
