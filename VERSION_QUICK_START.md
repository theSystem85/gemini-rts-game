# Version Management - Quick Reference

## 🎯 Fixed Issue
The recursion bug has been fixed! Version won't infinitely increment anymore.

## ✅ Current Status
- Version reset to: **0.1.0**
- Using `prepare-commit-msg` hook (no recursion)
- Ready to use!

## 🚀 How to Use

Just commit normally with the right prefix:

```bash
# Add your changes
git add .

# Commit with prefix → automatic version bump
git commit -m "FEAT: Your feature description"
# Version: 0.1.0 → 0.2.0 (minor bump, included in same commit)

git commit -m "FIX: Your bug fix"
# Version: 0.2.0 → 0.2.1 (patch bump, included in same commit)

git commit -m "IMPROVE: Your improvement"
# Version: 0.2.1 → 0.3.0 (minor bump, included in same commit)

git commit -m "REFACTOR: Your refactor"
# Version: 0.3.0 → 0.3.1 (patch bump, included in same commit)

git commit -m "docs: Update readme"
# Version: 0.3.1 → 0.3.1 (no bump - doesn't match patterns)
```

## 📋 Commit Prefixes

| Prefix | Version Bump | Example |
|--------|-------------|---------|
| `FEAT` | Minor (0.X.0) | `FEAT: Add multiplayer mode` |
| `IMPROVE` | Minor (0.X.0) | `IMPROVE: Better AI pathfinding` |
| `FIX` | Patch (0.0.X) | `FIX: Correct unit selection bug` |
| `REFACTOR` | Patch (0.0.X) | `REFACTOR: Simplify render loop` |
| Other | No bump | `docs: Update README` |

## 🎮 See Version in Game

1. Start game: `npm run dev`
2. Click gear icon (⚙) next to "Shuffle Map"
3. Version shown at bottom of settings menu

## 📁 What Changed

- ✅ Removed buggy `post-commit` hook
- ✅ Added safe `prepare-commit-msg` hook  
- ✅ Version changes included in same commit
- ✅ No recursion - runs exactly once per commit
- ✅ Both `package.json` and `src/version.js` updated together

## 🔧 Verify It Works

```bash
# Check current version
grep '"version"' package.json
# Should show: "version": "0.1.0",

# Make a test commit
echo "// test" >> test.txt
git add test.txt
git commit -m "FEAT: Test version bump"

# Check new version
grep '"version"' package.json
# Should show: "version": "0.2.0",

# Clean up
git reset HEAD~1
rm test.txt
```

## 📚 Full Documentation

- **VERSION_MANAGEMENT.md** - Complete system documentation
- **VERSION_SYSTEM_FIX.md** - Detailed explanation of the bug fix

---

**That's it!** Just commit with the right prefix and the version updates automatically. No more infinite loops! 🎉
