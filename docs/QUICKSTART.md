# Quick Start Guide

Get DevInsight up and running in 3 steps!

## Step 1: Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Install Python dependencies
pip install -r backend/requirements.txt
```

**Note:** Python 3.8+ is required. If you're using `python3`, you might need to use `pip3` instead.

## Step 2: Configure Environment (Optional)

The app works out of the box with default settings. For custom configuration:

```bash
cp .env.example .env
# Edit .env if needed (usually not required for development)
```

## Step 3: Start the Application

Run both Electron and FastAPI in one command:

```bash
pnpm dev
```

This will:
1. Start Electron with hot-reload
2. Start FastAPI backend on `http://localhost:8000`
3. Open the DevInsight application window

The app will be ready to use immediately!

## Alternative: Run Services Separately

If you prefer to run them in separate terminals:

```bash
# Terminal 1: Start Electron
pnpm electron-dev

# Terminal 2: Start FastAPI backend
pnpm backend-dev
```

## First Steps with the App

1. **Dashboard**: Click "Dashboard" to see your system status
2. **Environment Health**: Check detailed system metrics
3. **Code Review**: Paste Python code (or any code) to analyze it
4. **Commit Story**: Enter a repository path (e.g., `.`) to analyze git history

## Troubleshooting

### "Backend is not running" error
- Make sure `pnpm dev` or `pnpm backend-dev` is running
- Check that port 8000 is not in use
- On Windows, you might need to install Python from python.org

### Code review doesn't work
- This is normal if pylint isn't installed
- Install pylint for better Python analysis: `pip install pylint`
- Basic analysis will still work without it

### Application won't start
- Make sure you ran `pnpm install` in the project root
- Check that Node.js 16+ is installed: `node --version`
- Check that Python 3.8+ is installed: `python --version`

## Building for Distribution

When you're ready to share the app:

```bash
# Create native installers for your platform
pnpm dist
```

Find your installer in the `dist/` folder!

## Getting Help

- Check the main [README.md](README.md) for detailed documentation
- Review the source code in `src/` (frontend) and `backend/` (backend)
- Open DevTools with F12 in the Electron window for debugging

Happy analyzing! 🚀
