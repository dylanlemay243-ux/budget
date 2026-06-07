# 💰 Budget Tracker v2 — Android App

A personal budget tracking app for Android with a full reports suite.

## Features

### 📅 Calendar Tab
- Calendar view with colored dots (🟢 income, 🔴 expenses) per day
- Tap any day to see its entries and daily net total
- Add income or expenses with description, **category**, and date
- Edit or delete any entry

### 📊 Reports Tab — Monthly
- Income / Expenses / Net / Savings Rate summary cards
- Budget utilization bar (how much of your income you spent)
- Spending breakdown by category with visual bars
- Top 5 expenses and top 5 income sources for the month
- Navigate backward/forward by month

### 📊 Reports Tab — Yearly
- Full-year income/expenses/net/avg-per-month cards
- Side-by-side bar chart for all 12 months
- Month-by-month table with net column
- Category breakdown for the whole year
- Navigate backward/forward by year

### 📊 Reports Tab — All Time
- Lifetime totals and entry count
- Year-by-year comparison table
- All-time category breakdown

### 🏷️ Categories (10)
Food & Dining · Transport · Shopping · Housing · Health · Entertainment · Utilities · Salary · Freelance · Other

---

## 🚀 How to Build & Install the APK

### Step 1 — Create a GitHub repository
1. Go to [github.com](https://github.com) and sign in
2. Click **+** → **New repository** → name it `budget-tracker` → **Create**

### Step 2 — Upload all files
On your new repo page click **"uploading an existing file"**, drag all files from this zip (keeping folder structure), then **Commit changes**.

> ⚠️ Make sure `.github/workflows/build-apk.yml` is included — it's the build script.

### Step 3 — Wait for GitHub Actions (~10–15 min)
Click the **Actions** tab → watch **"Build Android APK"** run → wait for ✅

### Step 4 — Download the APK
Click the finished run → scroll to **Artifacts** → download **BudgetTracker-debug-apk** → unzip → get `app-debug.apk`

### Step 5 — Install on Android
1. Settings → Security → enable **Install unknown apps**
2. Send the APK to your phone (email, Drive, USB, etc.)
3. Tap the APK → **Install**

---

## 🔄 Updating
Edit `App.tsx`, push to GitHub → Actions rebuilds automatically → re-install.

## 🛠️ Tech Stack
React Native 0.73 · react-native-calendars · @react-native-async-storage · GitHub Actions
