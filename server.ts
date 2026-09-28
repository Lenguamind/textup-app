import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- PORTABLE JSON DATABASE SETUP ---
const DB_PATH = path.join(__dirname, "database.json");

interface User {
  userId: string;
  premium: boolean;
  dailyUsage: number;
  lastReset: string;
}

const loadDB = (): Record<string, User> => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading JSON DB:", err);
  }
  return {};
};

const saveDB = (data: Record<string, User>) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving JSON DB:", err);
  }
};

const getOrCreateUser = (userId: string): User => {
  const db = loadDB();
  let user = db[userId];

  const now = new Date();
  
  if (!user) {
    user = {
      userId,
      premium: false,
      dailyUsage: 0,
      lastReset: now.toISOString()
    };
    db[userId] = user;
    saveDB(db);
    return user;
  }

  // Check for 24h reset
  const lastResetDate = new Date(user.lastReset);
  const diffHours = (now.getTime() - lastResetDate.getTime()) / (1000 * 60 * 60);

  if (diffHours >= 24) {
    user.dailyUsage = 0;
    user.lastReset = now.toISOString();
    db[userId] = user;
    saveDB(db);
  }

  return user;
};

// --- GEMINI SETUP ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// --- GOOGLE PLAY AUTH ---
let auth;
try {
  const possibleEnvs = [
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    process.env.GOOGLE_SERVICE
  ];

  let parsedCredentials = null;

  for (const envVal of possibleEnvs) {
    if (envVal && envVal.trim().startsWith('{')) {
      try {
        parsedCredentials = JSON.parse(envVal);
        break;
      } catch (e) {
        console.warn("Error parsejant JSON de variable d'entorn:", e.message);
      }
    }
  }

  if (parsedCredentials) {
    auth = new google.auth.GoogleAuth({
      credentials: parsedCredentials,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    console.log("✅ Credencials de Google Play carregades des d'una variable d'entorn (JSON string).");
  } else {
    // Si no hi ha JSON string, intentem el mètode per defecte de fitxer
    auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    console.log("ℹ️ Buscant credencials de Google Play via camí de fitxer (default).");
  }
} catch (e) {
  console.warn("⚠️ No s'han pogut inicialitzar del tot les credencials de Google Play.", e);
  auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
}

const androidPublisher = google.androidpublisher({ version: "v3", auth });

// --- ENDPOINTS ---

// 1. GENERATE (AI) - PROTECTED ENDPOINT
app.post("/api/generate", async (req: any, res: any) => {
  const { userId, prompt, model = "gemini-3-flash-preview" } = req.body;

  if (!userId || !prompt) {
    return res.status(400).json({ status: "error", code: "MISSING_FIELDS" });
  }

  try {
    const user = getOrCreateUser(userId);

    // Lògica d'ús: 5 interaccions gratuïtes per als usuaris "free"
    if (!user.premium && user.dailyUsage >= 5) {
      return res.status(403).json({ 
        status: "error", 
        code: "QUOTA_EXCEEDED", 
        message: "Has esgotat les teves 5 interaccions gratuïtes d'avui. Fes-te Premium per tenir ús il·limitat!" 
      });
    }

    // Nota: L'SDK @google/genai utilitza 'generateContent'
    const result = await ai.models.generateContent({ model, contents: prompt });
    const responseText = result.text;

    // Incrementem l'ús si no és premium
    if (!user.premium) {
      const db = loadDB();
      if (db[userId]) {
        db[userId].dailyUsage += 1;
        saveDB(db);
      }
    }

    res.json({ status: "success", text: responseText });

  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ status: "error", code: "SERVER_ERROR", message: error.message });
  }
});

// 2. VALIDATE SUBSCRIPTION (CRITICAL SECURITY)
app.post("/api/validate-subscription", async (req: any, res: any) => {
  const { userId, purchaseToken, productId } = req.body;

  if (!userId || !purchaseToken || !productId) {
    return res.status(400).json({ status: "error", message: "Faltan camps obligatoris" });
  }

  try {
    // 1. BYPASS PER A PROVES (Especialment útil al navegador preview)
    // Si el token és "debug_premium", activem el premium directament.
    if (purchaseToken === "debug_premium") {
      console.log(`🛠️ ACTIVANT PREMIUM (DEBUG TOKEN) per a l'usuari: ${userId}`);
      getOrCreateUser(userId);
      const db = loadDB();
      db[userId].premium = true;
      saveDB(db);
      return res.json({ 
        status: "success", 
        isPremium: true, 
        message: "Premium actiu (Mode PROVA)!" 
      });
    }

    // 2. VALIDACIÓ REAL AMB GOOGLE PLAY (S'usarà al mòbil real)
    const response = await androidPublisher.purchases.subscriptions.get({
      packageName: "com.textup.geroni4.app", 
      subscriptionId: productId,
      token: purchaseToken,
    });

    const expiryTime = parseInt(response.data.expiryTimeMillis || "0");
    const now = Date.now();

    // Verificació real: Està pagat i no ha caducat?
    // paymentState 1 = Rebut, paymentState 2 = En prova (Free Trial)
    const isActive = expiryTime > now && (response.data.paymentState === 1 || response.data.paymentState === 2);

    if (isActive) {
      getOrCreateUser(userId);
      const db = loadDB();
      db[userId].premium = true;
      saveDB(db);
      
      console.log(`✅ Subscripció VALIDADA per a user ${userId}. Prod: ${productId}`);
      res.json({ 
        status: "success", 
        isPremium: true, 
        expiryDate: new Date(expiryTime).toISOString() 
      });
    } else {
      console.warn(`⚠️ Subscripció NO activa per a user ${userId}. Expira: ${new Date(expiryTime)}`);
      res.status(402).json({ 
        status: "error", 
        code: "SUBSCRIPTION_EXPIRED", 
        message: "La subscripció no està activa o ha caducat." 
      });
    }

  } catch (error: any) {
    console.error("❌ Google Play Validation Failure:", error.message);
    res.status(500).json({ 
      status: "error", 
      code: "VALIDATION_FAILED", 
      details: error.message,
      message: "No s'ha pogut validar la subscripció amb Google Play. Revisa que el purchaseToken sigui vàlid."
    });
  }
});

// 3. GET USER STATUS
app.get("/api/user/:userId", async (req: any, res: any) => {
  try {
    const user = getOrCreateUser(req.params.userId);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- VITE MIDDLEWARE ---
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));
  app.get("*all", (req, res) => {
    try {
      res.sendFile(path.join(distPath, "index.html"));
    } catch (err) {
      console.error("Error serving index.html:", err);
      res.status(500).send("Internal Server Error - could not load app");
    }
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});