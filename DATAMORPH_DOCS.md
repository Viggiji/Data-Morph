# DataMorph — Project Documentation & Q&A

> This is a living document. Questions and answers will be added here as we discuss.

---

## 1. Current Project Overview

**DataMorph** is a React + Vite + TailwindCSS web app. The entire frontend lives in a **single file**: `src/App.jsx` (517 lines).

It has two main views:
1. **Landing Page** — A premium dark-themed page with 3D animations, feature cards, and CTA buttons.
2. **Chat Dashboard** — A ChatGPT-style interface where you can type queries and attach files (images, CSV, PDF, JSON).

---

## 2. How Login / Signup Currently Works

### Current State: ❌ FAKE (No real authentication)

Right now, clicking **"Log in"**, **"Sign up"**, or **"TRYING"** on the landing page all call a single function:

```js
const handleAuth = (type) => {
  setUserEmail(type === 'trying' ? 'tester@datamorph.app' : 'user@datamorph.app');
  setView('chat');
};
```

**What this does:**
- Sets a **hardcoded fake email** (`tester@datamorph.app` or `user@datamorph.app`)
- Immediately switches the view to the Chat Dashboard
- **No password input**, **no Firebase**, **no database** — it is purely visual

### What needs to be done:
- Create proper Login and Signup **forms** (email + password inputs)
- Connect them to **Firebase Authentication**
- Store user data in a **database** (Firebase Firestore)
- Show real user info after login
- Protect the Chat Dashboard so only authenticated users can access it

---

## 3. How AI Is Currently Being Used

### Current State: ❌ FULLY SIMULATED (No real AI)

There is **zero AI** in this project right now. The chat responses are completely **hardcoded with a `setTimeout`**:

```js
// Inside handleSend() in the ChatDashboard component:
setTimeout(() => {
  let botResponse = "I've processed your query.";
  if (newUserMsg.text.includes('[Attached:') || newUserMsg.text.includes('[Uploaded:')) {
    botResponse = "I've received the image(s). Running vision extraction...";
  }
  setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', text: botResponse }]);
}, 1500);
```

**What this does:**
- Waits 1.5 seconds to simulate "thinking"
- If the user attached a file → shows a fake "vision extraction" message
- If the user just typed text → shows a generic "I've processed your query" message
- **No actual API call is made** — the responses are static strings

### What the landing page *claims* the AI can do:
1. **Natural Language SQL** — "Ask for your data in plain English, the engine writes and executes secure queries"
2. **Vision to Database** — "Drop an invoice or chart. The local Llava model extracts structured JSON and routes it to your tables"
3. **Dynamic Morphing** — "Data automatically reshapes itself to fit your schema"

### What needs to be done:
- Connect to a **real AI model** (Ollama running locally)
- Implement **Natural Language to SQL** conversion
- Implement **image/document extraction** (vision model via Ollama)
- Connect to a **real database** to actually execute queries

---

## 4. File Upload

File uploads work on the frontend (you can select files), but the files are **never sent anywhere**. They are only used to display file names in the chat message. No processing happens.

---

## 5. Q&A Section — Your Answers & Full Explanation

### Q: "Is what I'm doing viable? What are the restrictions/problems?"

Great question. Here is an **honest, detailed breakdown**:

---

### ✅ What IS Viable

| Feature | Viability | Notes |
|---|---|---|
| Firebase Auth (Email + Google Sign-in) | ✅ Fully viable | Free tier handles thousands of users. Very easy to set up. |
| Firebase Firestore for user profiles | ✅ Fully viable | Free tier gives 1GB storage, 50k reads/day. More than enough for a project. And yes, you can switch to another DB later. |
| Ollama for AI chat | ✅ Viable | Runs 100% locally, free, no API costs. But depends heavily on your PC specs (see below). |
| Natural Language to SQL | ✅ Viable | Ollama can generate SQL from English. Accuracy depends on model size. |
| Image/Vision extraction | ⚠️ Viable WITH caveats | Needs a vision-capable model (like `llava`). These are large and need good hardware. |

---

### ⚠️ Restrictions & Problems You WILL Face

#### 1. **Ollama Has ZERO Models Downloaded Right Now**
I ran `ollama list` on your system and it returned **empty**. You currently have no AI models installed.

You will need to download models before anything works:
```bash
# For text/SQL generation (pick ONE based on your RAM):
ollama pull llama3.2        # ~2GB download, needs ~4GB RAM (lighter, less accurate)
ollama pull llama3.1        # ~4.7GB download, needs ~8GB RAM (better quality)

# For image/vision extraction:
ollama pull llava           # ~4.7GB download, needs ~8GB RAM
ollama pull llava:7b        # Same as above
```

> **Critical Question: How much RAM does your PC have?** This is the #1 factor that decides how well (or if) Ollama will work for you.
> - **8GB RAM** → Can run small models (llama3.2, llava:7b) but will be slow, and you can only run ONE at a time
> - **16GB RAM** → Comfortable for most models
> - **32GB+ RAM** → Can run large models easily
> - **If you have a NVIDIA GPU** → Models run MUCH faster using GPU acceleration

#### 2. **MySQL Is NOT Accessible From Your Terminal**
I ran `mysql --version` and it said "not recognized". This means either:
- MySQL is not installed, OR
- MySQL is installed but not added to your system PATH

This needs to be fixed before the "Natural Language to SQL" feature can work, because we need an actual database to run queries against.

#### 3. **You Need a Backend Server**
Right now DataMorph is a **frontend-only** app (just React running in the browser). But:
- **Browsers cannot directly talk to Ollama** (CORS restrictions)
- **Browsers cannot directly connect to MySQL** (security — you'd expose your DB password in the browser)
- **Firebase Auth needs server-side validation** for security

**Solution:** We need to create a lightweight **Node.js backend server** (using Express.js) that sits between your React frontend and:
- Ollama (for AI responses)
- MySQL (for database queries)
- Firebase Admin SDK (for verifying user tokens)

```
[Browser/React] ←→ [Node.js Express Server] ←→ [Ollama API (localhost:11434)]
                                              ←→ [MySQL Database]
                                              ←→ [Firebase Auth verification]
```

#### 4. **Security Concern: SQL Injection**
If you let AI generate SQL queries and run them directly on your database, a user could potentially trick the AI into running destructive queries like `DROP TABLE` or `DELETE * FROM`. We need safeguards:
- Only allow `SELECT` queries (read-only)
- Use a separate database user with restricted permissions
- Validate and sanitize all AI-generated SQL before executing

#### 5. **Image Extraction Accuracy**
Vision models like `llava` are good but not perfect. For things like invoices or receipts:
- Clear, well-lit photos → Good results
- Handwritten text → Poor results
- Complex tables/charts → Mixed results

This is a limitation of current local vision models. Cloud APIs (Gemini, GPT-4 Vision) are more accurate but cost money.

---

### 📋 What Will Happen — Step by Step

Here is the **complete flow** of what we'll build:

#### Phase 1: Firebase Authentication
1. You create a Firebase project in the Firebase Console (I'll guide you)
2. Enable Email/Password and Google Sign-in providers
3. I add Firebase SDK to your React app
4. I build proper Login and Signup pages/modals
5. I add auth state management (who is logged in, protect routes)
6. I store user profile data in Firestore

#### Phase 2: Backend Server (Node.js + Express)
1. I create a `server/` folder in your project
2. Set up Express.js with routes for:
   - `/api/chat` → Send user message to Ollama, return AI response
   - `/api/query` → Execute AI-generated SQL on your MySQL database
   - `/api/vision` → Send uploaded image to Ollama's vision model
3. Add Firebase Admin SDK for verifying logged-in users

#### Phase 3: Ollama AI Integration
1. You download the required models (`llama3.2` + `llava`)
2. I connect the chat to Ollama's local API (`http://localhost:11434`)
3. For text queries → AI generates SQL → Backend validates → Runs on MySQL → Returns results
4. For image uploads → Image sent to `llava` model → Extracts structured data → Returns JSON

#### Phase 4: MySQL Database
1. We verify MySQL is working on your system
2. Create a demo database with sample tables
3. Connect the backend to MySQL
4. AI can then query real data

---

## 6. Follow-Up Questions (I NEED ANSWERS BEFORE STARTING)

> [!IMPORTANT]
> Please answer these before I write any code:

1. **How much RAM does your PC have?** (Right-click on "This PC" → Properties → check "Installed RAM")
   - This decides which Ollama models we can use.

2. **Do you have a NVIDIA GPU?** If yes, which one? (e.g., RTX 3060, RTX 4070, etc.)
   - GPU acceleration makes Ollama 5-10x faster.

3. **Is MySQL actually installed on your system?** Can you check:
   - Open Windows search → type "MySQL" → see if "MySQL Workbench" or "MySQL Server" shows up
   - Or check in `C:\Program Files\MySQL\` or `C:\ProgramData\MySQL\`

4. **Is this a college/university project (DBMS course)?** 
   - If yes, are there specific requirements from your professor? (like using specific DB tables, specific features, etc.)
   - This affects how I design the database schema.

5. **For the "TRYING" button** — what should it do now? Options:
   - a) Remove it entirely (just keep Login + Signup)
   - b) Make it a "Guest Mode" that lets you use the chat with limited features without signing up
   - c) Something else?

---
