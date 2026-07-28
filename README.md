Hello This is test branch.
# 📚 LibraFlow — Library Management System

A full-featured, mobile-responsive Library Management System built with vanilla HTML/CSS/JS frontend and Node.js serverless backend, deployed on **Vercel** with **Neon PostgreSQL** database.

## ✨ Features

- **Book Management** — Add, edit, delete, and search books by title/author/ISBN/category
- **Member Management** — Register members with ID generation, view borrow history
- **Book Borrowing** — Issue books with automatic due date calculation (configurable)
- **Book Returns** — Process returns with automatic overdue fine calculation
- **Fine Tracking** — View all fines, pending payments, and overdue records
- **Dashboard** — Real-time stats, recent activity, and category charts
- **Settings** — Configure fine per day, max borrow days, grace period
- **Fully Responsive** — Works seamlessly on desktop, tablet, and mobile

---

## 🚀 DEPLOYMENT STEPS

### Prerequisites
- GitHub account (free): https://github.com
- Vercel account (free): https://vercel.com
- Neon account (free): https://neon.tech

---

### STEP 1: Set Up Database (Neon PostgreSQL)

1. Go to **https://neon.tech** and sign up for a free account
2. Click **"New Project"** → Give it a name (e.g., `libraflow`)
3. Select your nearest region → Click **"Create Project"**
4. You'll see a **Connection String** — copy it (looks like):
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
5. Click the **"SQL Editor"** tab in Neon dashboard
6. **Paste the entire contents of `database.sql`** into the editor
7. Click **"Run"** — this creates all tables and inserts sample data
8. ✅ Database is ready!

---

### STEP 2: Push Code to GitHub

1. Go to **https://github.com** → Sign in
2. Click **"New repository"** (top right, "+" button)
3. Name it `libraflow` (or anything you like)
4. Keep it **Public** → Click **"Create repository"**
5. On your computer, open Terminal/Command Prompt
6. Navigate to the project folder:
   ```bash
   cd path/to/library-management-system
   ```
7. Run these commands:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: LibraFlow LMS"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/libraflow.git
   git push -u origin main
   ```
8. ✅ Code is on GitHub!

---

### STEP 3: Deploy on Vercel

1. Go to **https://vercel.com** → Sign up / Log in (use "Continue with GitHub")
2. Click **"Add New…"** → **"Project"**
3. Find your `libraflow` repository → Click **"Import"**
4. Vercel auto-detects the config — **do not change any settings**
5. Click **"Environment Variables"** section → Add:
   - **Name:** `DATABASE_URL`
   - **Value:** (paste your Neon connection string from Step 1)
   - Click **"Add"**
6. Click **"Deploy"**
7. Wait ~60 seconds for deployment
8. ✅ Your app is live at `https://libraflow.vercel.app` (or similar URL)!

---

### STEP 4: Access Your App

- Visit the URL Vercel gives you
- The dashboard will load with sample data from the database
- Start by adding books and members, then try borrowing!

---

## 🔄 Updating Your App

After any code change:
```bash
git add .
git commit -m "Your change description"
git push
```
Vercel automatically redeploys within ~30 seconds!

---

## 📁 Project Structure

```
library-management-system/
├── api/                    # Serverless API functions (Node.js)
│   ├── db.js              # Database connection helper
│   ├── books.js           # Books CRUD endpoints
│   ├── members.js         # Members CRUD endpoints
│   ├── borrow.js          # Borrow & Return logic
│   ├── dashboard.js       # Dashboard stats
│   └── config.js          # Fine configuration
├── public/                 # Static frontend files
│   ├── index.html         # Main SPA HTML
│   ├── css/
│   │   └── style.css      # Full responsive stylesheet
│   └── js/
│       └── app.js         # Frontend application logic
├── database.sql           # Database schema + sample data
├── vercel.json            # Vercel routing configuration
├── package.json           # Node.js dependencies
├── .gitignore
├── .env.example           # Example environment variables
└── README.md
```

---

## ⚙️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard statistics |
| GET/POST/PUT/DELETE | `/api/books` | Book management |
| GET/POST/PUT | `/api/members` | Member management |
| GET | `/api/borrow` | List borrow records |
| POST | `/api/borrow` | Borrow a book |
| PUT | `/api/borrow?borrow_id=BR00001` | Return a book |
| GET/PUT | `/api/config` | Fine configuration |

---

## 💰 Fine Calculation

- Default: **৳5 per day** after due date
- Default borrow period: **14 days**
- Grace period: **0 days** (configurable)
- Fines are calculated automatically on return

---

## 🆓 Free Tier Limits

| Service | Free Limit |
|---------|-----------|
| Vercel | Unlimited deployments, 100GB bandwidth/month |
| Neon DB | 512 MB storage, 1 compute unit |
| GitHub | Unlimited public repos |

This LMS runs entirely within free tier limits for small to medium libraries.

---

## 🛠 Local Development

```bash
# Install dependencies
npm install

# Install Vercel CLI
npm install -g vercel

# Create .env file from example
cp .env.example .env
# Edit .env and add your DATABASE_URL

# Run locally
vercel dev
```

Open http://localhost:3000

---

## 📱 Mobile Usage

The app is fully responsive. Access your Vercel URL on any phone browser — no app installation needed!

---

*Built with ❤️ using Vanilla JS, Node.js Serverless Functions, and PostgreSQL*
